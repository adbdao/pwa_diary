document.addEventListener('DOMContentLoaded', async () => {
    // 確保在所有元素被參照之前先載入主題，使初始顯示正確
    loadThemePreference();

    const calendarEl = document.getElementById('calendar');
    const currentMonthYearEl = document.getElementById('current-month-year');
    const selectedDateDisplayEl = document.getElementById('selected-date-display');
    const diaryEntryEl = document.getElementById('diary-entry');
    const saveBtn = document.getElementById('save-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const showAllBtn = document.getElementById('show-all-btn');
    const copyBtn = document.getElementById('copy-btn');
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const editTodayBtn = document.getElementById('edit-today-btn');
    const resultsArea = document.getElementById('results-area');
    const themeToggleBtn = document.getElementById('theme-toggle');

    // 匯出與匯入按鈕與元素
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let selectedDate = new Date();

    // 用於防止非同步競態條件（Race Condition）的序號計數器
    let displayRequestToken = 0;

    // --- IndexedDB 設定 ---
    const DB_NAME = 'MyDiaryDatabase';
    const STORE_NAME = 'entries';
    const DB_VERSION = 1;

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME); // 以日期字串作為 Key
                }
            };
        });
    }

    async function getDiary(date) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(date);
                request.onsuccess = () => resolve(request.result || '');
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('讀取日記失敗:', error);
            return '';
        }
    }

    // [優化 1] 改用 Cursor（游標）逐筆讀取，避免一次載入過大記憶體
    async function getAllDiaries() {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const diaries = {};

                const request = store.openCursor();
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        diaries[cursor.key] = cursor.value;
                        cursor.continue();
                    } else {
                        resolve(diaries);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('取得所有日記失敗:', error);
            return {};
        }
    }

    async function saveDiaryEntryToDB(date, content) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            let request;
            if (content.trim() === '') {
                request = store.delete(date);
            } else {
                request = store.put(content.trim(), date);
            }

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async function deleteDiaryEntryFromDB(date) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(date);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async function clearAllDiariesFromDB() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // --- 主題切換功能 ---
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('themePreference', isDarkMode ? 'dark' : 'light');
    });

    function loadThemePreference() {
        const savedTheme = localStorage.getItem('themePreference');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
        }
    }

    function formatDate(dateObj) {
        const year = dateObj.getFullYear();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async function displayDiaryEntry(date) {
        const currentToken = ++displayRequestToken;

        selectedDateDisplayEl.textContent = `編輯日記：${date}`;
        const content = await getDiary(date);

        if (currentToken !== displayRequestToken) return;

        diaryEntryEl.value = content;
        resultsArea.innerHTML = '';
        copyBtn.style.display = 'none';

        document.querySelectorAll('.day.selected').forEach(d => d.classList.remove('selected'));
        const dayCell = document.querySelector(`.day[data-date="${date}"]`);
        if (dayCell) {
            dayCell.classList.add('selected');
        }
    }

    async function renderCalendar() {
        calendarEl.innerHTML = '';
        const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];
        daysOfWeek.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.classList.add('day-header');
            dayHeader.textContent = day;
            calendarEl.appendChild(dayHeader);
        });

        const firstDay = new Date(currentYear, currentMonth, 1);
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const startDayIndex = firstDay.getDay();
        const todayStr = formatDate(new Date());

        const diaries = await getAllDiaries();

        currentMonthYearEl.textContent = `${currentYear} 年 ${currentMonth + 1} 月`;

        for (let i = 0; i < startDayIndex; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.classList.add('day');
            calendarEl.appendChild(emptyDay);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.classList.add('day');
            day.textContent = i;
            const dateStr = formatDate(new Date(currentYear, currentMonth, i));
            day.dataset.date = dateStr;

            if (dateStr === todayStr) {
                day.classList.add('today');
            }

            if (diaries[dateStr]) {
                day.classList.add('has-entry');
            }

            day.addEventListener('click', async () => {
                selectedDate = new Date(currentYear, currentMonth, i);
                await displayDiaryEntry(dateStr);
            });
            calendarEl.appendChild(day);
        }

        await displayDiaryEntry(formatDate(selectedDate));
    }

    document.getElementById('prev-month').addEventListener('click', async () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        await renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', async () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        await renderCalendar();
    });

    saveBtn.addEventListener('click', async () => {
        try {
            const content = diaryEntryEl.value.trim();
            const dateStr = formatDate(selectedDate);

            await saveDiaryEntryToDB(dateStr, content);
            await renderCalendar();
            alert(content === '' ? '請輸入日記內容' : '日記已儲存/更新！');
        } catch (error) {
            console.error('儲存失敗:', error);
            alert('儲存失敗，請檢查瀏覽器儲存空間或權限。');
        }
    });

    deleteBtn.addEventListener('click', async () => {
        try {
            const dateStr = formatDate(selectedDate);
            const currentContent = await getDiary(dateStr);

            if (!currentContent) {
                alert('這天沒有記錄日記，無需刪除。');
                return;
            }

            if (confirm(`確定要刪除 ${dateStr} 的日記嗎？`)) {
                if (confirm('真的決定刪除？此操作不可逆！')) {
                    await deleteDiaryEntryFromDB(dateStr);
                    await renderCalendar();
                    await displayDiaryEntry(dateStr);
                    alert('日記已刪除！');
                }
            }
        } catch (error) {
            console.error('刪除失敗:', error);
            alert('刪除過程發生錯誤。');
        }
    });

    editTodayBtn.addEventListener('click', async () => {
        selectedDate = new Date();
        currentMonth = selectedDate.getMonth();
        currentYear = selectedDate.getFullYear();
        await renderCalendar();
    });

    // [優化 2] 改用 DocumentFragment 批次渲染 DOM，大幅提升顯示速度
    function displayDiariesList(diaries, searchTerm = '') {
        resultsArea.innerHTML = '';
        copyBtn.style.display = 'inline-block';
        let allContentString = '';
        let matchCount = 0;

        const fragment = document.createDocumentFragment();
        const statsEl = document.createElement('div');
        const keys = Object.keys(diaries).sort().reverse();

        fragment.appendChild(statsEl);

        // 統計區塊下方加一道分隔線，與日記清單區隔
        const topHr = document.createElement('hr');
        fragment.appendChild(topHr);

        keys.forEach(date => {
            let content = diaries[date];
            if (searchTerm) {
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                const matches = content.match(regex);
                if (matches) {
                    matchCount += matches.length;
                    content = content.replace(regex, '<span class="highlight">$1</span>');
                }
            }
            // 顯示所有日記：套用 .diary-card 類別實現淺灰色圓角方塊效果
            // 建立圓角卡片容器
            const entryDiv = document.createElement('div');
            entryDiv.className = 'diary-card'; // 套用 CSS 樣式
            entryDiv.innerHTML = `<strong>${date}</strong><br>${content}`;
            fragment.appendChild(entryDiv);

            allContentString += `${date}, ${diaries[date]}\n`;
        });

        if (searchTerm) {
            statsEl.innerHTML = `<p><strong>搜尋統計：找到 ${keys.length} 篇日記，關鍵字「${searchTerm}」共出現 ${matchCount} 次。</strong></p>`;
        } else {
            statsEl.innerHTML = `<p><strong>總計：共 ${keys.length} 篇日記。</strong></p>`;
        }

        resultsArea.appendChild(fragment);

        copyBtn.onclick = () => {
            navigator.clipboard.writeText(allContentString).then(() => {
                alert('所有日記內容已複製到剪貼簿！');
            }).catch(err => {
                console.error('複製失敗: ', err);
            });
        };
    }

    showAllBtn.addEventListener('click', async () => {
        try {
            const diaries = await getAllDiaries();
            displayDiariesList(diaries);
        } catch (error) {
            console.error('顯示全部失敗:', error);
            alert('無法載入日記清單。');
        }
    });

    searchBtn.addEventListener('click', async () => {
        const searchTerm = searchInput.value.trim();
        if (searchTerm === '') {
            alert('請輸入搜尋關鍵字。');
            return;
        }
        try {
            const diaries = await getAllDiaries();
            const filteredDiaries = Object.keys(diaries)
                .filter(date => diaries[date].includes(searchTerm))
                .reduce((obj, key) => {
                    obj[key] = diaries[key];
                    return obj;
                }, {});

            displayDiariesList(filteredDiaries, searchTerm);
        } catch (error) {
            console.error('搜尋失敗:', error);
            alert('搜尋過程發生錯誤。');
        }
    });

    clearAllBtn.addEventListener('click', async () => {
        if (confirm('確定要清除所有我的日記嗎？此操作不可逆！')) {
            if (confirm('不後悔嗎？真的決定刪除？')) {
                if (confirm('最後一次問你：確定要刪除所有我的日記')) {
                    try {
                        await clearAllDiariesFromDB();
                        alert('所有日記已清除。');
                        await renderCalendar();
                        diaryEntryEl.value = '';
                        resultsArea.innerHTML = '';
                    } catch (error) {
                        console.error('清除全部失敗:', error);
                        alert('清除操作失敗。');
                    }
                }
            }
        }
    });

    // 匯出日記成 日記6.txt（倒序：最新日期在第一行）
    async function exportDiariesToFile() {
        const diaries = await getAllDiaries();
        const keys = Object.keys(diaries).sort().reverse();

        if (keys.length === 0) {
            return false;
        }

        let fileContent = '';
        keys.forEach(date => {
            fileContent += `${date}, ${diaries[date]}\n`;
        });

        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '日記6.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                const success = await exportDiariesToFile();
                if (!success) {
                    alert('目前沒有任何日記可以匯出。');
                    return;
                }
                alert('「日記6.txt」匯出成功！');
            } catch (error) {
                console.error('匯出失敗:', error);
                alert('匯出日記時發生錯誤。');
            }
        });
    }

    // 全部匯入（含安全備份詢問、格式過濾、重複日期合併為【】）
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => {
            importFile.click();
        });

        importFile.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const confirmImport = confirm('匯入將會處理現有資料。請問是否要先匯出目前的舊資料為「日記6.txt」再進行匯入？');

            try {
                if (confirmImport) {
                    await exportDiariesToFile();
                } else {
                    const forceOverwrite = confirm('確定要在不備份的情況下直接匯入嗎？');
                    if (!forceOverwrite) {
                        importFile.value = '';
                        return;
                    }
                }

                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const text = e.target.result;
                        const lines = text.split(/\r?\n/);
                        let count = 0;

                        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

                        for (let line of lines) {
                            if (!line.trim()) continue;

                            const firstCommaIndex = line.indexOf(',');
                            if (firstCommaIndex !== -1) {
                                const dateStr = line.substring(0, firstCommaIndex).trim();
                                const content = line.substring(firstCommaIndex + 1).trim();

                                if (dateRegex.test(dateStr)) {
                                    const existingContent = await getDiary(dateStr);

                                    if (existingContent) {
                                        const mergedContent = `${existingContent}【${content}】`;
                                        await saveDiaryEntryToDB(dateStr, mergedContent);
                                    } else {
                                        await saveDiaryEntryToDB(dateStr, content);
                                    }
                                    count++;
                                }
                            }
                        }

                        await renderCalendar();
                        alert(`匯入完成！共處理了 ${count} 筆符合格式的日記。`);
                    } catch (error) {
                        console.error('匯入解析失敗:', error);
                        alert('檔案格式錯誤或匯入失敗。');
                    } finally {
                        importFile.value = '';
                    }
                };
                reader.readAsText(file, 'UTF-8');
            } catch (error) {
                console.error('匯入流程錯誤:', error);
                alert('匯入過程發生錯誤。');
                importFile.value = '';
            }
        });
    }

    // 初始化月曆和顯示當前日記
    try {
        await renderCalendar();
    } catch (error) {
        console.error('初始化月曆失敗:', error);
    }
});
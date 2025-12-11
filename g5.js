document.addEventListener('DOMContentLoaded', () => {
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

    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();
    let selectedDate = new Date();
    const DIARY_STORAGE_KEY = 'myDiaryEntries';

    // --- 主題切換功能 ---
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('themePreference', isDarkMode ? 'dark' : 'light');
    });

    function loadThemePreference() {
        const savedTheme = localStorage.getItem('themePreference');
        // 如果有儲存的偏好，就應用；否則預設為淺色
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (savedTheme === 'light') {
            document.body.classList.remove('dark-mode');
        }
    }
    
    // ... (後續所有函數保持不變) ...

    function getDiaries() {
        const entries = localStorage.getItem(DIARY_STORAGE_KEY);
        return entries ? JSON.parse(entries) : {};
    }
    
    function saveDiaryEntry(date, content) {
        const diaries = getDiaries();
        if (content.trim() === '') {
            delete diaries[date];
        } else {
            diaries[date] = content.trim();
        }
        localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(diaries));
        renderCalendar();
    }

    function deleteDiaryEntry(date) {
        const diaries = getDiaries();
        delete diaries[date];
        localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(diaries));
        renderCalendar();
        displayDiaryEntry(date);
    }
    
    function formatDate(dateObj) {
        const year = dateObj.getFullYear();
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function displayDiaryEntry(date) {
        selectedDateDisplayEl.textContent = `編輯日記：${date}`;
        const diaries = getDiaries();
        diaryEntryEl.value = diaries[date] || '';
        resultsArea.innerHTML = '';
        copyBtn.style.display = 'none';
        
        document.querySelectorAll('.day.selected').forEach(d => d.classList.remove('selected'));
        const dayCell = document.querySelector(`.day[data-date="${date}"]`);
        if (dayCell) {
            dayCell.classList.add('selected');
        }
    }

    function renderCalendar() {
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
        const diaries = getDiaries();

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

            day.addEventListener('click', () => {
                selectedDate = new Date(currentYear, currentMonth, i);
                displayDiaryEntry(dateStr);
            });
            calendarEl.appendChild(day);
        }
        
        displayDiaryEntry(formatDate(selectedDate));
    }

    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });

    saveBtn.addEventListener('click', () => {
        if (!diaryEntryEl.value){
            alert('請輸入日記內容')
        }else{
            saveDiaryEntry(formatDate(selectedDate), diaryEntryEl.value);
            alert('日記已儲存/更新！');
        }
    });

    deleteBtn.addEventListener('click', () => {
        if (confirm('確定要刪除這天的日記嗎？')) {
            deleteDiaryEntry(formatDate(selectedDate));
            alert('日記已刪除！');
        }
    });

    editTodayBtn.addEventListener('click', () => {
        selectedDate = new Date();
        currentMonth = selectedDate.getMonth();
        currentYear = selectedDate.getFullYear();
        renderCalendar();
    });

    function displayDiariesList(diaries, searchTerm = '') {
        resultsArea.innerHTML = '';
        copyBtn.style.display = 'inline-block';
        let allContentString = '';
        let matchCount = 0;

        Object.keys(diaries).sort().reverse().forEach(date => {
            let content = diaries[date];
            if (searchTerm) {
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                const matches = content.match(regex);
                if (matches) {
                    matchCount += matches.length;
                    content = content.replace(regex, '<span class="highlight">$1</span>');
                }
            }
            const entryHtml = `<div><strong>${date}</strong>, ${content}</div>`;
            resultsArea.innerHTML += entryHtml;
            allContentString += `${date}, ${diaries[date]}\n`;
        });

        const statsEl = document.createElement('div');
        if (searchTerm) {
            statsEl.innerHTML = `<p><strong>搜尋統計：找到 ${Object.keys(diaries).length} 篇日記，關鍵字「${searchTerm}」共出現 ${matchCount} 次。</strong></p>`;
        } else {
            statsEl.innerHTML = `<p><strong>總計：共 ${Object.keys(diaries).length} 篇日記。</strong></p>`;
        }
        resultsArea.insertBefore(statsEl, resultsArea.firstChild);
        
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(allContentString).then(() => {
                alert('所有日記內容已複製到剪貼簿！');
            }).catch(err => {
                console.error('複製失敗: ', err);
            });
        };
    }

    showAllBtn.addEventListener('click', () => {
        const diaries = getDiaries();
        displayDiariesList(diaries);
    });

    searchBtn.addEventListener('click', () => {
        const searchTerm = searchInput.value.trim();
        if (searchTerm === '') {
            alert('請輸入搜尋關鍵字。');
            return;
        }
        const diaries = getDiaries();
        const filteredDiaries = Object.keys(diaries)
            .filter(date => diaries[date].includes(searchTerm))
            .reduce((obj, key) => {
                obj[key] = diaries[key];
                return obj;
            }, {});
        
        displayDiariesList(filteredDiaries, searchTerm); 
    });

    clearAllBtn.addEventListener('click', () => {
        if (confirm('確定要清除所有我的日記嗎？此操作不可逆！')) {
            localStorage.removeItem(DIARY_STORAGE_KEY);
            alert('所有日記已清除。');
            renderCalendar();
            diaryEntryEl.value = '';
            resultsArea.innerHTML = '';
        }
    });

    // 初始化月曆和顯示當前日記
    renderCalendar();
    displayDiaryEntry(formatDate(selectedDate));
});

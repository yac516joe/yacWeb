// 創建一個 common.js 檔案
async function loadHeader() {
    try {
        const response = await fetch('/common/header.html');
        const html = await response.text();
        document.getElementById('header-placeholder').innerHTML = html;
    } catch (error) {
        console.error('Error loading header:', error);
    }
}

async function loadNavigationBanner() {
    try {
        const response = await fetch('/common/navigation-banner.html');
        const html = await response.text();
        document.getElementById('navigation-placeholder').innerHTML = html;
    } catch (error) {
        console.error('Error loading navigation banner:', error);
    }
}

// 當頁面載入時執行
document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
    loadNavigationBanner();
});

// 當頁面載入時執行
document.addEventListener('DOMContentLoaded', loadHeader); 

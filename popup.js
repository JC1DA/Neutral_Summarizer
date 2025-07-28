// Popup script to handle popup functionality
document.addEventListener('DOMContentLoaded', function() {
  const openSidebarButton = document.getElementById('openSidebar');
  
  // Open sidebar on current page
  openSidebarButton.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleSidebar'});
      window.close();
    });
  });
});

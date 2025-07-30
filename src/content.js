// Content script to inject sidebar into webpages
let sidebarInjected = false;

// Function to inject sidebar
function injectSidebar(width = 400) {
  if (sidebarInjected) return;
  
  // Create container for sidebar
  const container = document.createElement('div');
  container.id = 'neutral-summarizer-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${width}px;
    height: 100vh;
    z-index: 10000;
    box-shadow: -2px 0 5px rgba(0,0,0,0.1);
    display: none;
  `;
  
  // Create iframe for sidebar
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('sidebar.html');
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;
  
  container.appendChild(iframe);
  document.body.appendChild(container);
  sidebarInjected = true;
}

// Function to update sidebar width
function updateSidebarWidth(width) {
  const container = document.getElementById('neutral-summarizer-container');
  if (container) {
    container.style.width = `${width}px`;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleSidebar') {
    // Get saved width setting before injecting
    chrome.storage.sync.get(['sidebarWidth'], (result) => {
      const width = result.sidebarWidth || 400;
      injectSidebar(width);
      const container = document.getElementById('neutral-summarizer-container');
      if (container) {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
      }
    });
  }
  
  if (request.action === 'updateSidebarWidth') {
    updateSidebarWidth(request.width);
  }
});

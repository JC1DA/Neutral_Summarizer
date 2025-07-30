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
  
  // Inject YouTube transcription button if on YouTube
  injectYouTubeButton();
}

// Function to update sidebar width
function updateSidebarWidth(width) {
  const container = document.getElementById('neutral-summarizer-container');
  if (container) {
    container.style.width = `${width}px`;
  }
}

// Function to check if current page is YouTube video
function isYouTubeVideo() {
  // First, try to use the actual tab URL if we have it
  if (window.__actualTabUrl) {
    try {
      const urlObj = new URL(window.__actualTabUrl);
      
      // Check if hostname is YouTube (including www.youtube.com, youtube.com, etc.)
      const isYouTubeDomain = urlObj.hostname.includes('youtube.com') || 
                              urlObj.hostname.includes('youtu.be');
      
      // Check if it's a watch page
      const isWatchPage = urlObj.pathname.includes('/watch');
      
      return isYouTubeDomain && isWatchPage;
    } catch (e) {
      // Fall through to other methods if URL parsing fails
    }
  }
  
  // Check if we're on a YouTube page by examining the document URL
  // We need to be careful because content scripts run in an isolated world
  try {
    // Try to get the URL from the document
    const url = window.location.href;
    const urlObj = new URL(url);
    
    // Check if hostname is YouTube (including www.youtube.com, youtube.com, etc.)
    const isYouTubeDomain = urlObj.hostname.includes('youtube.com') || 
                            urlObj.hostname.includes('youtu.be');
    
    // Check if it's a watch page
    const isWatchPage = urlObj.pathname.includes('/watch');
    
    return isYouTubeDomain && isWatchPage;
  } catch (e) {
    // Fallback: check the document title and known YouTube elements
    const title = document.title || '';
    const hasYouTubeTitle = title.includes(' - YouTube');
    const hasWatchPath = window.location.pathname.includes('/watch');
    
    return hasYouTubeTitle && hasWatchPath;
  }
}

// Function to inject YouTube transcription button
function injectYouTubeButton() {
  if (!isYouTubeVideo()) return;
  
  // Wait for YouTube page to load
  const interval = setInterval(() => {
    // Look for the video title element as an anchor point
    const titleElement = document.querySelector('h1.ytd-watch-metadata');
    if (titleElement && !document.getElementById('transcribe-button')) {
      clearInterval(interval);
      
      // Create transcribe button
      const button = document.createElement('button');
      button.id = 'transcribe-button';
      button.textContent = '📝 Transcribe Video';
      button.style.cssText = `
        margin-left: 16px;
        padding: 8px 16px;
        background-color: #ff0000;
        color: white;
        border: none;
        border-radius: 18px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
      `;
      
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#cc0000';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#ff0000';
      });
      
      button.addEventListener('click', () => {
        // Send message to background script to open sidebar and transcribe
        chrome.runtime.sendMessage({
          action: 'transcribeYouTube',
          videoUrl: window.location.href
        });
      });
      
      // Insert button after title
      titleElement.parentNode.insertBefore(button, titleElement.nextSibling);
    }
  }, 1000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleSidebar') {
    // Store the URL if provided
    if (request.url) {
      // Store the actual tab URL for YouTube detection
      window.__actualTabUrl = request.url;
    }
    
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

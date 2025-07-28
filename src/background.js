// Background script for Neutral Summarizer

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    // Get the content of the current page
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        func: () => {
          // Extract text content from the page
          const content = document.body.innerText || document.body.textContent;
          return content.substring(0, 10000); // Limit content size
        }
      }, (results) => {
        if (results && results[0]) {
          sendResponse({content: results[0].result});
        } else {
          sendResponse({content: 'Could not extract page content'});
        }
      });
    });
    return true; // Keep message channel open for async response
  }
});

// Initialize settings when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings if they don't exist
  chrome.storage.sync.get([
    'apiUrl',
    'apiKey',
    'modelName',
    'systemPrompt',
    'sidebarWidth',
    'fontSize'
  ], (result) => {
    const defaultSettings = {
      apiUrl: 'https://openrouter.ai/api/v1',
      apiKey: '',
      modelName: 'qwen/qwen3-235b-a22b-2507',
      systemPrompt: `You are a helpful assistant that summarizes web pages. 
Please provide a concise, neutral summary of the content provided. 
Focus on the main points and key information.
Make sure you separate between information and opinions.
Breakdown them in two separated sessions: "Information" and "Opinions from writer"
Use markdown format for users to read.
Notes:
* If user asks following questions after the summary, just answer them based on available information. You don't need to include "Opinions from writer" session anymore.
* Show the most important information first`,
      sidebarWidth: 400,
      fontSize: 14
    };
    
    // Only set defaults for settings that don't exist
    const settingsToSet = {};
    for (const [key, value] of Object.entries(defaultSettings)) {
      if (result[key] === undefined) {
        settingsToSet[key] = value;
      }
    }
    
    if (Object.keys(settingsToSet).length > 0) {
      chrome.storage.sync.set(settingsToSet);
    }
  });
});

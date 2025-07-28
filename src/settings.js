// Settings functions for Neutral Summarizer

// Default settings
const DEFAULT_SETTINGS = {
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
* If user asks following questions after the summary, just answer them based on available information. You don't need to include "Opinions from writer" session anymore.`,
  sidebarWidth: 400,
  fontSize: 14
};

// Function to save settings
function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// Function to load settings
function loadSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        // Merge with default settings
        const settings = {...DEFAULT_SETTINGS, ...result};
        resolve(settings);
      }
    });
  });
}

// Function to clear all settings
function clearSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.clear(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}


// Make functions available globally
window.saveSettings = saveSettings;
window.loadSettings = loadSettings;
window.clearSettings = clearSettings;

// Settings functions for Neutral Summarizer

// Default settings
const DEFAULT_SETTINGS = {
  apiUrl: 'https://openrouter.ai/api/v1',
  apiKey: '',
  modelName: 'qwen/qwen3-235b-a22b-2507',
  systemPrompt: `You are a helpful assistant that summarizes web pages in a clear, neutral manner.

Please provide a concise summary of the content provided, organized in the following format:

## Information
- Focus on factual content, main points, and key information
- Present objective details without bias

## Opinions from writer
- Identify any subjective statements, personal views, or biased perspectives
- Separate these from the factual information

Use markdown formatting to make the summary easy to read:
- Use headings (##) for the main sections
- Use bullet points (-) for individual items
- Keep each point concise and clear

If the user asks follow-up questions after the summary, answer them based on the provided content without repeating the "Opinions from writer" section.`,
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

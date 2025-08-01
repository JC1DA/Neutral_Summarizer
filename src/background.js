// Background service worker for Neutral Summarizer extension
class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    chrome.action.onClicked.addListener((tab) => {
      this.handleExtensionClick(tab);
    });
  }

  async handleMessage(message, sender, sendResponse) {
    const { type, data } = message;

    switch (type) {
      case 'TOGGLE_SIDEBAR':
        if (sender.tab) {
          this.handleExtensionClick(sender.tab);
        }
        sendResponse({ success: true });
        break;
      case 'GET_SETTINGS':
        this.getSettings(sendResponse);
        break;
      case 'SAVE_SETTINGS':
        this.saveSettings(data, sendResponse);
        break;
      case 'INJECT_SIDEBAR':
        this.injectSidebar(sender.tab.id, sendResponse);
        break;
      case 'FETCH_YOUTUBE_TRANSCRIPT':
        await this.fetchYouTubeTranscript(data, sendResponse);
        break;
      default:
        console.warn('Unknown message type:', type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  handleExtensionClick(tab) {
    console.log('Extension clicked, tab:', tab);
    
    // Inject the content script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error injecting content script:', chrome.runtime.lastError);
        return;
      }
      
      console.log('Content script injected successfully');
      
      // Wait a bit for the content script to initialize, then send the toggle message
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR_VISIBILITY' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error toggling sidebar:', chrome.runtime.lastError);
          } else {
            console.log('Sidebar toggled successfully, response:', response);
          }
        });
      }, 100);
    });
  }

  toggleSidebar(tabId, sendResponse) {
    chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_SIDEBAR_VISIBILITY' }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, visible: response?.visible });
      }
    });
  }

  injectSidebar(tabId, sendResponse) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }, () => {
      if (chrome.runtime.lastError) {
        if (sendResponse) sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        if (sendResponse) sendResponse({ success: true });
      }
    });
  }

  async getSettings(sendResponse) {
    try {
      const result = await chrome.storage.sync.get(this.getDefaultSettings());
      sendResponse({ success: true, settings: result });
    } catch (error) {
      console.error('Error getting settings:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async saveSettings(settings, sendResponse) {
    try {
      await chrome.storage.sync.set(settings);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error saving settings:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  getDefaultSettings() {
    return {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: '',
      dumplingApiKey: '',
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
  }

  async fetchYouTubeTranscript(data, sendResponse) {
    try {
      // Get DumplingAI API key from storage
      const result = await chrome.storage.sync.get(['dumplingApiKey']);
      const dumplingApiKey = result.dumplingApiKey;
      
      if (!dumplingApiKey) {
        sendResponse({ success: false, error: 'No DumplingAI API key available' });
        return;
      }
      
      const apiEndpoint = "https://app.dumplingai.com/api/v1/get-youtube-transcript";
      
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${dumplingApiKey}`,
      };
      
      const payload = {
        videoUrl: data.videoUrl,
        includeTimestamps: true,
        timestampsToCombine: 5,
      };
      
      console.log('Fetching YouTube transcript:', payload);
      
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error('DumplingAI API error:', response.status, errorBody);
        sendResponse({ 
          success: false, 
          error: `API request failed with status ${response.status}: ${errorBody}` 
        });
        return;
      }
      
      const transcriptData = await response.json();
      console.log('Transcript retrieved successfully:', transcriptData);
      
      sendResponse({ success: true, transcript: transcriptData });
      
    } catch (error) {
      console.error('Error fetching YouTube transcript:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
}

// Initialize the background service
new BackgroundService();

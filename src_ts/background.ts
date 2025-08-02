// Background service worker for Neutral Summarizer extension
import {
  ExtensionMessage,
  Settings,
  ChromeTab,
  ChromeMessageSender,
  YouTubeTranscriptResponse,
  FetchYouTubeTranscriptMessage,
  SettingsResult,
  ValidationResult
} from './types';

class BackgroundService {
  private defaultSettings: Settings = {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    dumplingApiKey: '',
    modelName: 'qwen/qwen3-235b-a22b-2507',
    temperature: 0.3,
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

  constructor() {
    this.init();
  }

  private init(): void {
    chrome.runtime.onMessage.addListener((
      message: ExtensionMessage,
      sender: ChromeMessageSender,
      sendResponse: (response: any) => void
    ) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    chrome.action.onClicked.addListener((tab: ChromeTab) => {
      this.handleExtensionClick(tab);
    });
  }

  private async handleMessage(
    message: ExtensionMessage,
    sender: ChromeMessageSender,
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { type, data } = message;

    switch (type) {
      case 'TOGGLE_SIDEBAR':
        if (sender.tab) {
          this.handleExtensionClick(sender.tab);
        }
        sendResponse({ success: true });
        break;
      case 'GET_SETTINGS':
        await this.getSettings(sendResponse);
        break;
      case 'SAVE_SETTINGS':
        await this.saveSettings(data as Partial<Settings>, sendResponse);
        break;
      case 'INJECT_SIDEBAR':
        this.injectSidebar(sender.tab?.id || 0, sendResponse);
        break;
      case 'FETCH_YOUTUBE_TRANSCRIPT':
        await this.fetchYouTubeTranscript(data as FetchYouTubeTranscriptMessage['data'], sendResponse);
        break;
      default:
        console.warn('Unknown message type:', type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  private handleExtensionClick(tab: ChromeTab): void {
    console.log('Extension clicked, tab:', tab);
    
    // Inject the content script
    if (tab.id) {
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
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR_VISIBILITY' }, (response: any) => {
              if (chrome.runtime.lastError) {
                console.error('Error toggling sidebar:', chrome.runtime.lastError);
              } else {
                console.log('Sidebar toggled successfully, response:', response);
              }
            });
          }
        }, 100);
      });
    }
  }

  private toggleSidebar(tabId: number, sendResponse: (response: any) => void): void {
    chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_SIDEBAR_VISIBILITY' }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, visible: response?.visible });
      }
    });
  }

  private injectSidebar(tabId: number, sendResponse: (response: any) => void): void {
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

  private async getSettings(sendResponse: (response: SettingsResult) => void): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(this.defaultSettings);
      sendResponse({ 
        success: true, 
        data: result as Settings,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error getting settings:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  private async saveSettings(settings: Partial<Settings>, sendResponse: (response: SettingsResult) => void): Promise<void> {
    try {
      // Validate settings before saving
      const validation = this.validateSettings(settings);
      if (!validation.valid) {
        sendResponse({
          success: false,
          error: 'Settings validation failed',
          validationErrors: validation.errors,
          timestamp: Date.now()
        });
        return;
      }

      await chrome.storage.sync.set(settings);
      sendResponse({ 
        success: true,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  private validateSettings(settings: Partial<Settings>): ValidationResult {
    const errors: string[] = [];

    // Validate base URL
    if (settings.baseUrl !== undefined) {
      if (!settings.baseUrl) {
        errors.push('Base URL is required');
      } else {
        try {
          new URL(settings.baseUrl);
        } catch (error) {
          errors.push('Base URL is not a valid URL');
        }
      }
    }

    // Validate API key
    if (settings.apiKey !== undefined) {
      if (!settings.apiKey) {
        errors.push('API key is required');
      }
    }

    // Validate model name
    if (settings.modelName !== undefined) {
      if (!settings.modelName) {
        errors.push('Model name is required');
      }
    }

    // Validate sidebar width
    if (settings.sidebarWidth !== undefined) {
      const width = parseInt(settings.sidebarWidth.toString());
      if (isNaN(width) || width < 300 || width > 800) {
        errors.push('Sidebar width must be between 300 and 800 pixels');
      }
    }

    // Validate font size
    if (settings.fontSize !== undefined) {
      const fontSize = parseInt(settings.fontSize.toString());
      if (isNaN(fontSize) || fontSize < 10 || fontSize > 24) {
        errors.push('Font size must be between 10 and 24 pixels');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async fetchYouTubeTranscript(
    data: FetchYouTubeTranscriptMessage['data'],
    sendResponse: (response: YouTubeTranscriptResponse) => void
  ): Promise<void> {
    try {
      // Get DumplingAI API key from storage
      const result = await chrome.storage.sync.get(['dumplingApiKey']);
      const dumplingApiKey = (result as any).dumplingApiKey;
      
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
      
      sendResponse({ 
        success: true, 
        transcript: transcriptData.transcript,
        videoInfo: transcriptData
      });
      
    } catch (error) {
      console.error('Error fetching YouTube transcript:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Initialize the background service
new BackgroundService();

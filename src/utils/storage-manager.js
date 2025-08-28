// Storage manager utility for Neutral Summarizer extension
class StorageManager {
  constructor() {
    this.defaultSettings = {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: '',
      dumplingApiKey: '',
      dumplingApiUrl: 'https://app.dumplingai.com/api/v1',
      pdf2markdownUrl: 'https://xtomd.vercel.app/api',
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
      fontSize: 14,
      lastUpdated: null
    };
    
    this.storageArea = 'sync'; // Use sync storage for cross-device synchronization
  }

  // Get all settings
  async getSettings() {
    try {
      const result = await chrome.storage[this.storageArea].get(this.defaultSettings);
      
      // Ensure all required settings exist
      const settings = { ...this.defaultSettings, ...result };
      
      // Add timestamp if not exists
      if (!settings.lastUpdated) {
        settings.lastUpdated = Date.now();
        await this.saveSettings(settings);
      }
      
      return {
        success: true,
        settings: settings,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return {
        success: false,
        error: error.message,
        settings: this.defaultSettings,
        timestamp: Date.now()
      };
    }
  }

  // Save settings
  async saveSettings(settings) {
    try {
      // Validate settings before saving
      const validation = this.validateSettings(settings);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Settings validation failed',
          validationErrors: validation.errors
        };
      }

      // Clean and prepare settings
      const cleanSettings = this.cleanSettings(settings);
      
      // Add timestamp
      cleanSettings.lastUpdated = Date.now();
      
      // Save to storage
      await chrome.storage[this.storageArea].set(cleanSettings);
      
      return {
        success: true,
        settings: cleanSettings,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error saving settings:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Update specific settings
  async updateSettings(updates) {
    try {
      // Get current settings
      const currentResult = await this.getSettings();
      
      if (!currentResult.success) {
        return {
          success: false,
          error: 'Failed to get current settings',
          timestamp: Date.now()
        };
      }
      
      // Merge updates with current settings
      const updatedSettings = {
        ...currentResult.settings,
        ...updates,
        lastUpdated: Date.now()
      };
      
      // Validate updated settings
      const validation = this.validateSettings(updatedSettings);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Settings validation failed',
          validationErrors: validation.errors
        };
      }
      
      // Save updated settings
      const saveResult = await this.saveSettings(updatedSettings);
      
      return saveResult;
    } catch (error) {
      console.error('Error updating settings:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Reset settings to defaults
  async resetSettings() {
    try {
      await chrome.storage[this.storageArea].clear();
      
      // Save default settings
      const result = await this.saveSettings(this.defaultSettings);
      
      return {
        success: true,
        settings: this.defaultSettings,
        timestamp: Date.now(),
        message: 'Settings reset to defaults'
      };
    } catch (error) {
      console.error('Error resetting settings:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Get a specific setting
  async getSetting(key) {
    try {
      const result = await chrome.storage[this.storageArea].get([key]);
      
      return {
        success: true,
        value: result[key] || this.defaultSettings[key],
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Error getting setting '${key}':`, error);
      return {
        success: false,
        error: error.message,
        value: this.defaultSettings[key],
        timestamp: Date.now()
      };
    }
  }

  // Set a specific setting
  async setSetting(key, value) {
    try {
      // Validate the specific setting
      const validation = this.validateSetting(key, value);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }
      
      // Get current settings
      const currentResult = await this.getSettings();
      
      if (!currentResult.success) {
        return {
          success: false,
          error: 'Failed to get current settings'
        };
      }
      
      // Update the specific setting
      const updatedSettings = {
        ...currentResult.settings,
        [key]: value,
        lastUpdated: Date.now()
      };
      
      // Save updated settings
      const result = await this.saveSettings(updatedSettings);
      
      return result;
    } catch (error) {
      console.error(`Error setting '${key}':`, error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Remove a specific setting (reset to default)
  async removeSetting(key) {
    try {
      // Get current settings
      const currentResult = await this.getSettings();
      
      if (!currentResult.success) {
        return {
          success: false,
          error: 'Failed to get current settings'
        };
      }
      
      // Remove the setting (it will fall back to default)
      await chrome.storage[this.storageArea].remove(key);
      
      return {
        success: true,
        key: key,
        defaultValue: this.defaultSettings[key],
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Error removing setting '${key}':`, error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Export settings as JSON
  async exportSettings() {
    try {
      const result = await this.getSettings();
      
      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }
      
      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        settings: result.settings
      };
      
      return {
        success: true,
        data: exportData,
        json: JSON.stringify(exportData, null, 2)
      };
    } catch (error) {
      console.error('Error exporting settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Import settings from JSON
  async importSettings(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      // Validate import data structure
      if (!data.settings || typeof data.settings !== 'object') {
        return {
          success: false,
          error: 'Invalid import data format'
        };
      }
      
      // Validate imported settings
      const validation = this.validateSettings(data.settings);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Imported settings validation failed',
          validationErrors: validation.errors
        };
      }
      
      // Clean and save imported settings
      const cleanSettings = this.cleanSettings(data.settings);
      cleanSettings.lastUpdated = Date.now();
      
      const result = await this.saveSettings(cleanSettings);
      
      return {
        ...result,
        imported: true,
        message: 'Settings imported successfully'
      };
    } catch (error) {
      console.error('Error importing settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get storage usage statistics
  async getStorageInfo() {
    try {
      const info = await chrome.storage[this.storageArea].getBytesInUse();
      const quota = chrome.storage[this.storageArea].QUOTA_BYTES_PER_ITEM;
      
      return {
        success: true,
        bytesInUse: info,
        quotaBytes: quota,
        usagePercent: (info / quota) * 100,
        availableBytes: quota - info,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Clear all extension data
  async clearAllData() {
    try {
      await chrome.storage[this.storageArea].clear();
      
      return {
        success: true,
        message: 'All extension data cleared',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error clearing data:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Settings validation
  validateSettings(settings) {
    const errors = [];

    // Validate base URL
    if (!settings.baseUrl) {
      errors.push('Base URL is required');
    } else {
      try {
        new URL(settings.baseUrl);
      } catch (error) {
        errors.push('Base URL must be a valid URL');
      }
    }

    // Validate API key
    if (!settings.apiKey) {
      errors.push('API key is required');
    } else if (settings.apiKey.length < 10) {
      errors.push('API key appears to be too short');
    }

    // Validate model name
    if (!settings.modelName) {
      errors.push('Model name is required');
    }

    // Validate system prompt
    if (!settings.systemPrompt) {
      errors.push('System prompt is required');
    } else if (settings.systemPrompt.length < 20) {
      errors.push('System prompt appears to be too short');
    }

    // Validate sidebar width
    if (settings.sidebarWidth) {
      const width = parseInt(settings.sidebarWidth);
      if (isNaN(width) || width < 300 || width > 800) {
        errors.push('Sidebar width must be between 300 and 800 pixels');
      }
    }

    // Validate font size
    if (settings.fontSize) {
      const fontSize = parseInt(settings.fontSize);
      if (isNaN(fontSize) || fontSize < 10 || fontSize > 24) {
        errors.push('Font size must be between 10 and 24 pixels');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  // Individual setting validation
  validateSetting(key, value) {
    switch (key) {
      case 'baseUrl':
        if (!value) {
          return { valid: false, error: 'Base URL is required' };
        }
        try {
          new URL(value);
          return { valid: true };
        } catch (error) {
          return { valid: false, error: 'Base URL must be a valid URL' };
        }
        
      case 'apiKey':
        if (!value) {
          return { valid: false, error: 'API key is required' };
        }
        if (value.length < 10) {
          return { valid: false, error: 'API key appears to be too short' };
        }
        return { valid: true };
        
      case 'modelName':
        if (!value) {
          return { valid: false, error: 'Model name is required' };
        }
        return { valid: true };
        
      case 'systemPrompt':
        if (!value) {
          return { valid: false, error: 'System prompt is required' };
        }
        if (value.length < 20) {
          return { valid: false, error: 'System prompt appears to be too short' };
        }
        return { valid: true };
        
      case 'sidebarWidth':
        const width = parseInt(value);
        if (isNaN(width) || width < 300 || width > 800) {
          return { valid: false, error: 'Sidebar width must be between 300 and 800 pixels' };
        }
        return { valid: true };
        
      case 'fontSize':
        const fontSize = parseInt(value);
        if (isNaN(fontSize) || fontSize < 10 || fontSize > 24) {
          return { valid: false, error: 'Font size must be between 10 and 24 pixels' };
        }
        return { valid: true };
        
      default:
        return { valid: true };
    }
  }

  // Clean settings before saving
  cleanSettings(settings) {
    const clean = {};
    
    for (const [key, value] of Object.entries(settings)) {
      // Skip undefined values
      if (value === undefined) {
        continue;
      }
      
      // Trim string values
      if (typeof value === 'string') {
        clean[key] = value.trim();
      } else {
        clean[key] = value;
      }
    }
    
    return clean;
  }

  // Listen for storage changes
  onChanged(callback) {
    const listener = (changes, areaName) => {
      if (areaName === this.storageArea) {
        callback(changes, areaName);
      }
    };
    
    chrome.storage.onChanged.addListener(listener);
    
    // Return function to remove listener
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }
}

// Factory function to create storage manager
export function createStorageManager() {
  return new StorageManager();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageManager, createStorageManager };
}

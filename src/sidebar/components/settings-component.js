// Settings component for Neutral Summarizer extension
class SettingsComponent {
  constructor() {
    this.baseUrlInput = document.getElementById('neutral-summarizer-base-url');
    this.apiKeyInput = document.getElementById('neutral-summarizer-api-key');
    this.dumplingKeyInput = document.getElementById('neutral-summarizer-dumpling-key');
    this.modelNameInput = document.getElementById('neutral-summarizer-model-name');
    this.systemPromptInput = document.getElementById('neutral-summarizer-system-prompt');
    this.sidebarWidthInput = document.getElementById('neutral-summarizer-sidebar-width');
    this.fontSizeInput = document.getElementById('neutral-summarizer-font-size');
    this.saveBtn = document.getElementById('neutral-summarizer-save-settings');
    
    this.widthValueSpan = document.getElementById('neutral-summarizer-width-value');
    this.fontValueSpan = document.getElementById('neutral-summarizer-font-value');
    
    this.currentSettings = null;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSettings();
  }

  setupEventListeners() {
    this.saveBtn.addEventListener('click', () => this.saveSettings());
    
    // Real-time updates for range inputs
    this.sidebarWidthInput.addEventListener('input', (e) => {
      this.widthValueSpan.textContent = `${e.target.value}px`;
      this.updateSidebarWidth(e.target.value);
    });
    
    this.fontSizeInput.addEventListener('input', (e) => {
      this.fontValueSpan.textContent = `${e.target.value}px`;
      this.updateFontSize(e.target.value);
    });
    
    // Save on Enter key for text inputs
    [this.baseUrlInput, this.apiKeyInput, this.dumplingKeyInput, this.modelNameInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.saveSettings();
        }
      });
    });
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success) {
        this.currentSettings = response.settings;
        this.populateForm();
      } else {
        console.error('Failed to load settings:', response.error);
        this.showNotification('Failed to load settings. Please refresh the page.', 'error');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showNotification('Error loading settings. Please try again.', 'error');
    }
  }

  populateForm() {
    if (!this.currentSettings) return;
    
    this.baseUrlInput.value = this.currentSettings.baseUrl || '';
    this.apiKeyInput.value = this.currentSettings.apiKey || '';
    this.dumplingKeyInput.value = this.currentSettings.dumplingApiKey || '';
    this.modelNameInput.value = this.currentSettings.modelName || '';
    this.systemPromptInput.value = this.currentSettings.systemPrompt || '';
    this.sidebarWidthInput.value = this.currentSettings.sidebarWidth || 400;
    this.fontSizeInput.value = this.currentSettings.fontSize || 14;
    
    // Update display values
    this.widthValueSpan.textContent = `${this.currentSettings.sidebarWidth || 400}px`;
    this.fontValueSpan.textContent = `${this.currentSettings.fontSize || 14}px`;
    
    // Apply current settings to UI
    this.updateSidebarWidth(this.currentSettings.sidebarWidth || 400);
    this.updateFontSize(this.currentSettings.fontSize || 14);
  }

  async saveSettings() {
    const settings = {
      baseUrl: this.baseUrlInput.value.trim(),
      apiKey: this.apiKeyInput.value.trim(),
      dumplingApiKey: this.dumplingKeyInput.value.trim(),
      modelName: this.modelNameInput.value.trim(),
      systemPrompt: this.systemPromptInput.value.trim(),
      sidebarWidth: parseInt(this.sidebarWidthInput.value),
      fontSize: parseInt(this.fontSizeInput.value)
    };
    
    // Basic validation
    if (!settings.baseUrl) {
      this.showNotification('Base URL is required', 'error');
      return;
    }
    
    if (!settings.apiKey) {
      this.showNotification('API Key is required', 'error');
      return;
    }
    
    if (!settings.modelName) {
      this.showNotification('Model Name is required', 'error');
      return;
    }
    
    if (!settings.systemPrompt) {
      this.showNotification('System Prompt is required', 'error');
      return;
    }
    
    if (settings.sidebarWidth < 300 || settings.sidebarWidth > 800) {
      this.showNotification('Sidebar width must be between 300 and 800 pixels', 'error');
      return;
    }
    
    if (settings.fontSize < 10 || settings.fontSize > 24) {
      this.showNotification('Font size must be between 10 and 24 pixels', 'error');
      return;
    }
    
    // Validate URL format
    try {
      new URL(settings.baseUrl);
    } catch (error) {
      this.showNotification('Please enter a valid URL for Base URL', 'error');
      return;
    }
    
    this.setLoading(true);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        data: settings
      });
      
      if (response.success) {
        this.currentSettings = settings;
        this.showNotification('Settings saved successfully!', 'success');
        
        // Notify content script about settings changes
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'UPDATE_SETTINGS',
              data: settings
            });
          }
        });
        
      } else {
        this.showNotification('Failed to save settings: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showNotification('Error saving settings. Please try again.', 'error');
    } finally {
      this.setLoading(false);
    }
  }

  updateSidebarWidth(width) {
    const sidebar = document.getElementById('neutral-summarizer-sidebar');
    if (sidebar) {
      sidebar.style.width = `${width}px`;
    }
  }

  updateFontSize(fontSize) {
    document.documentElement.style.setProperty('--neutral-summarizer-font-size', `${fontSize}px`);
  }

  setLoading(isLoading) {
    this.saveBtn.disabled = isLoading;
    this.saveBtn.textContent = isLoading ? 'Saving...' : 'Save Settings';
    
    // Disable all form inputs during save
    const inputs = [
      this.baseUrlInput, this.apiKeyInput, this.dumplingKeyInput,
      this.modelNameInput, this.systemPromptInput, 
      this.sidebarWidthInput, this.fontSizeInput
    ];
    
    inputs.forEach(input => {
      input.disabled = isLoading;
    });
  }

  showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.getElementById('neutral-summarizer-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'neutral-summarizer-notification';
    notification.className = `neutral-summarizer-notification ${type}`;
    notification.textContent = message;
    
    // Add notification styles if not already present
    if (!document.getElementById('neutral-summarizer-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'neutral-summarizer-notification-styles';
      styles.textContent = `
        .neutral-summarizer-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 14px;
          z-index: 1000000;
          max-width: 300px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          animation: slideIn 0.3s ease-out;
        }
        
        .neutral-summarizer-notification.success {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        
        .neutral-summarizer-notification.error {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }
        
        .neutral-summarizer-notification.info {
          background: #dbeafe;
          color: #1e40af;
          border: 1px solid #93c5fd;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove notification after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  // Public method for testing settings
  async testConnection() {
    const testSettings = {
      baseUrl: this.baseUrlInput.value.trim(),
      apiKey: this.apiKeyInput.value.trim(),
      modelName: this.modelNameInput.value.trim()
    };
    
    if (!testSettings.baseUrl || !testSettings.apiKey || !testSettings.modelName) {
      this.showNotification('Please fill in Base URL, API Key, and Model Name to test connection', 'error');
      return;
    }
    
    this.setLoading(true);
    
    try {
      const response = await fetch(`${testSettings.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${testSettings.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        this.showNotification('Connection test successful!', 'success');
      } else {
        const errorBody = await response.text();
        this.showNotification('Connection test failed. Please check your credentials.', 'error');
        console.error('Connection test error:', errorBody);
      }
    } catch (error) {
      console.error('Connection test error:', error);
      this.showNotification('Connection test failed. Please check your network and settings.', 'error');
    } finally {
      this.setLoading(false);
    }
  }
}

// Initialize the settings component when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new SettingsComponent());
} else {
  new SettingsComponent();
}

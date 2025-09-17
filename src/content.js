// Content script for Neutral Summarizer extension

// PDF Handler class (integrated directly to avoid ES6 import issues)
class PDFHandler {
  constructor() {
    this.pdfCache = new Map(); // Cache for PDF conversions
  }

  // Check if current page is a PDF
  isPDFPage() {
    const url = window.location.href;
    const contentType = document.contentType;
    
    // Check if URL ends with .pdf
    if (url.toLowerCase().endsWith('.pdf')) {
      return true;
    }
    
    // Check if content type is PDF
    if (contentType && contentType.toLowerCase().includes('pdf')) {
      return true;
    }
    
    // Check if there's an embed/object with PDF type
    const pdfElements = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"]');
    if (pdfElements.length > 0) {
      return true;
    }
    
    return false;
  }

  // Convert PDF to Markdown using the PDF2Markdown API via background script
  async convertPDFToMarkdown(pdfUrl, pdf2markdownUrl) {
    try {
      // Check cache first
      const cacheKey = `${pdfUrl}-${pdf2markdownUrl}`;
      if (this.pdfCache.has(cacheKey)) {
        const cached = this.pdfCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 30 * 60 * 1000) { // 30 minutes cache
          return cached.result;
        }
      }

      // Send message to background script to handle PDF conversion
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'CONVERT_PDF_TO_MARKDOWN',
          data: {
            pdfUrl: pdfUrl,
            pdf2markdownUrl: pdf2markdownUrl
          }
        }, (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });

      if (!response.success) {
        throw new Error(`PDF conversion failed: ${response.error}`);
      }

      // Cache the result
      this.pdfCache.set(cacheKey, {
        result: response.markdown,
        timestamp: Date.now()
      });

      // Return the markdown content
      return response.markdown;

    } catch (error) {
      console.error('Error converting PDF to Markdown:', error);
      throw new Error(`Failed to convert PDF to Markdown: ${error.message}`);
    }
  }

  // Extract PDF content for summarization
  async extractPDFContent(pdf2markdownUrl) {
    try {
      const pdfUrl = window.location.href;
      
      // Convert PDF to Markdown
      const markdownContent = await this.convertPDFToMarkdown(pdfUrl, pdf2markdownUrl);
      
      // Create a clean content object similar to regular page content
      return {
        title: document.title || 'PDF Document',
        url: pdfUrl,
        content: markdownContent,
        meta: {
          description: 'PDF Document converted to Markdown',
          author: this.extractPDFAuthor(),
          publish_date: this.extractPDFDate()
        },
        isPDF: true,
        isYouTube: false,
        youtubeData: {}
      };
    } catch (error) {
      console.error('Error extracting PDF content:', error);
      throw error;
    }
  }

  // Extract PDF author metadata
  extractPDFAuthor() {
    // Try to find author metadata in the document
    const authorSelectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      '[name="author"]'
    ];
    
    for (const selector of authorSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const content = element.getAttribute('content') || element.textContent;
        if (content && content.trim()) {
          return content.trim();
        }
      }
    }
    
    return 'Unknown Author';
  }

  // Extract PDF date metadata
  extractPDFDate() {
    // Try to find date metadata in the document
    const dateSelectors = [
      'meta[name="date"]',
      'meta[property="article:published_time"]',
      '[name="date"]'
    ];
    
    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const content = element.getAttribute('content') || element.textContent;
        if (content && content.trim()) {
          return content.trim();
        }
      }
    }
    
    return new Date().toISOString().split('T')[0]; // Today's date as fallback
  }

  // Clear the PDF cache
  clearCache() {
    this.pdfCache.clear();
  }

  // Get cache size
  getCacheSize() {
    return this.pdfCache.size;
  }
}

class SidebarManager {
  constructor() {
    this.pdfHandler = new PDFHandler();
    this.isVisible = false;
    this.sidebarContainer = null;
    this.overlay = null;
    this.init();
  }

  init() {
    this.setupMessageListener();
    this.createStyles();
    this.loadSettings();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  handleMessage(message, sender, sendResponse) {
    console.log('Content script received message:', message);
    const { type, data } = message;

    switch (type) {
      case 'TOGGLE_SIDEBAR_VISIBILITY':
        console.log('Toggling sidebar visibility');
        this.toggleSidebar();
        sendResponse({ visible: this.isVisible });
        break;
      case 'INJECT_SIDEBAR':
        console.log('Injecting sidebar');
        this.injectSidebar();
        sendResponse({ success: true });
        break;
      case 'UPDATE_SETTINGS':
        console.log('Updating settings');
        this.applySettings(data);
        sendResponse({ success: true });
        break;
      default:
        console.warn('Unknown message type in content script:', type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  createStyles() {
    const styleId = 'neutral-summarizer-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const styles = `
      #neutral-summarizer-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999998;
        display: none;
        backdrop-filter: blur(2px);
      }

      #neutral-summarizer-sidebar {
        position: fixed;
        top: 0;
        right: 0;
        width: 400px;
        height: 100%;
        background: white;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
        z-index: 999999;
        transition: transform 0.3s ease-in-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
      }

      #neutral-summarizer-sidebar.open {
        transform: translateX(0);
      }

      #neutral-summarizer-sidebar-header {
        padding: 16px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f9fafb;
      }

      #neutral-summarizer-sidebar-title {
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
      }

      #neutral-summarizer-close-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #6b7280;
        padding: 4px;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      #neutral-summarizer-close-btn:hover {
        background: #e5e7eb;
        color: #374151;
      }

      #neutral-summarizer-tabs {
        display: flex;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        height: 48px;
        padding: 6px;
        gap: 6px;
        position: relative;
        overflow: hidden;
      }

      #neutral-summarizer-tabs::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
        pointer-events: none;
      }

      .neutral-summarizer-tab {
        flex: 1;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        outline: none;
        position: relative;
        overflow: hidden;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      
      .neutral-summarizer-tab::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        transition: left 0.5s;
      }
      
      .neutral-summarizer-tab:hover::before {
        left: 100%;
      }
      
      .neutral-summarizer-tab:hover {
        background: rgba(255, 255, 255, 0.25);
        color: white;
        border-color: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px) scale(1.01);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      .neutral-summarizer-tab:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
      }
      
      .neutral-summarizer-tab.active {
        background: rgba(255, 255, 255, 0.9);
        color: #1e40af;
        border-color: rgba(255, 255, 255, 0.4);
        font-weight: 700;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transform: translateY(-1px);
      }
      
      .neutral-summarizer-tab.active:hover {
        background: white;
        color: #1e40af;
        transform: translateY(-1px) scale(1.01);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
      }
      
      .neutral-summarizer-tab:active {
        transform: translateY(-1px) scale(0.98);
      }

      .neutral-summarizer-tab .tab-icon {
        margin-right: 6px;
        font-size: 14px;
      }

      #neutral-summarizer-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }

      #neutral-summarizer-tab-content {
        display: none;
      }

      #neutral-summarizer-tab-content.active {
        display: block;
      }

      .neutral-summarizer-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 60px 20px;
        background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        border-radius: 16px;
        margin: 20px;
        color: #64748b;
        min-height: 400px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
      }

      .neutral-summarizer-empty-state::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
        animation: float 20s infinite linear;
      }

      @keyframes float {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .neutral-summarizer-empty-state .neutral-summarizer-empty-icon {
        font-size: 64px;
        margin-bottom: 24px;
        opacity: 0.8;
        animation: bounce 2s infinite;
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
      }

      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-10px); }
        60% { transform: translateY(-5px); }
      }

      .neutral-summarizer-empty-state h3 {
        font-size: 20px;
        font-weight: 700;
        color: #1e293b;
        margin: 0 0 12px 0;
        text-transform: uppercase;
        letter-spacing: 1px;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .neutral-summarizer-empty-state p {
        font-size: calc(var(--neutral-summarizer-font-size, 14px) + 2px);
        margin: 0;
        line-height: 1.6;
        color: #64748b;
        font-weight: 400;
        max-width: 280px;
      }

      .neutral-summarizer-empty-state .shimmer {
        position: relative;
        overflow: hidden;
        margin-top: 20px;
        padding: 8px 16px;
        background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 20px;
        color: #94a3b8;
        font-size: var(--neutral-summarizer-font-size, 14px);
        font-weight: 500;
      }

      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  toggleSidebar() {
    if (this.isVisible) {
      this.hideSidebar();
    } else {
      this.showSidebar();
    }
  }

  showSidebar() {
    if (!this.sidebarContainer) {
      this.injectSidebar();
    }

    this.overlay.style.display = 'block';
    this.sidebarContainer.classList.add('open');
    this.isVisible = true;
    
    // Apply saved sidebar width when showing sidebar
    this.applySidebarWidth();
  }

  hideSidebar() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    if (this.sidebarContainer) {
      this.sidebarContainer.classList.remove('open');
    }
    this.isVisible = false;
  }

  injectSidebar() {
    if (this.sidebarContainer) {
      return;
    }

    console.log('Creating sidebar DOM elements...');

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'neutral-summarizer-overlay';
    this.overlay.addEventListener('click', () => this.hideSidebar());
    document.body.appendChild(this.overlay);
    console.log('Overlay created');

    // Create sidebar container
    this.sidebarContainer = document.createElement('div');
    this.sidebarContainer.id = 'neutral-summarizer-sidebar';

    // Create sidebar structure
    this.sidebarContainer.innerHTML = `
      <div id="neutral-summarizer-sidebar-header">
        <div id="neutral-summarizer-sidebar-title">Neutral Summarizer</div>
        <button id="neutral-summarizer-close-btn" title="Close sidebar">✕</button>
      </div>
      
      <div id="neutral-summarizer-tabs">
        <button class="neutral-summarizer-tab active" data-tab="content">
          <span class="tab-icon">💬</span>
          Content
        </button>
        <button class="neutral-summarizer-tab" data-tab="settings">
          <span class="tab-icon">⚙️</span>
          Settings
        </button>
      </div>
      
      <div id="neutral-summarizer-content">
        <div id="neutral-summarizer-tab-content" class="active" data-tab="content">
          <div id="neutral-summarizer-chat-container">
            <div class="neutral-summarizer-empty-state">
              <div class="neutral-summarizer-empty-icon">💬</div>
              <h3>Chat Interface</h3>
              <p>Components will be loaded here...</p>
            </div>
          </div>
        </div>
        <div id="neutral-summarizer-tab-content" data-tab="settings">
          <div id="neutral-summarizer-settings-container">
            <div class="neutral-summarizer-empty-state">
              <div class="neutral-summarizer-empty-icon">⚙️</div>
              <h3>Settings Interface</h3>
              <p>Settings will be loaded here...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.sidebarContainer);
    console.log('Sidebar container created and added to DOM');

    // Add event listeners
    this.setupEventListeners();
    console.log('Event listeners set up');

    // Load basic styles first, then try components
    this.loadComponentStyles();
    
    // Try to load components after a delay
    setTimeout(() => {
      this.loadComponents();
    }, 500);
  }

  setupEventListeners() {
    // Close button
    const closeBtn = document.getElementById('neutral-summarizer-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideSidebar());
    }

    // Tab switching
    const tabs = document.querySelectorAll('.neutral-summarizer-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.neutral-summarizer-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('#neutral-summarizer-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.querySelector(`#neutral-summarizer-tab-content[data-tab="${tabName}"]`).classList.add('active');

    // Load settings when switching to Settings tab
    if (tabName === 'settings') {
      console.log('Switched to Settings tab, loading saved settings...');
      this.loadCurrentSettings();
    }
  }

  loadComponents() {
    console.log('Loading components...');
    try {
      // Load chat interface
      const chatContainer = document.getElementById('neutral-summarizer-chat-container');
      if (chatContainer) {
        console.log('Setting up chat interface...');
        chatContainer.innerHTML = `
          <div class="neutral-summarizer-chat-actions">
            <button id="neutral-summarizer-summarize-btn" class="neutral-summarizer-btn primary">
              <span class="neutral-summarizer-btn-icon">📄</span>
              Summarize Page
            </button>
            <button id="neutral-summarizer-clear-btn" class="neutral-summarizer-btn secondary">
              <span class="neutral-summarizer-btn-icon">🗑️</span>
              Clear Chat
            </button>
          </div>
          
          <div id="neutral-summarizer-chat-messages"></div>
          
          <div class="neutral-summarizer-chat-input-container">
            <textarea id="neutral-summarizer-chat-input" placeholder="Ask about the page content..."></textarea>
            <button id="neutral-summarizer-send-btn">
              <span class="neutral-summarizer-btn-icon">📤</span>
              Send
            </button>
          </div>
        `;
        
        // Set up chat event listeners
        this.setupChatEventListeners();
      }

      // Load settings interface
      const settingsContainer = document.getElementById('neutral-summarizer-settings-container');
      if (settingsContainer) {
        console.log('Setting up settings interface...');
        settingsContainer.innerHTML = `
          <div class="neutral-summarizer-settings-section">
            <div class="neutral-summarizer-section-header">
              <h4>🔌 API Configuration</h4>
            </div>
            <div class="neutral-summarizer-settings-form">
              <div class="neutral-summarizer-settings-group">
                <label for="neutral-summarizer-base-url">
                  <span class="neutral-summarizer-label-icon">🌐</span>
                  Base OpenAI Compatible URL
                </label>
                <input type="url" id="neutral-summarizer-base-url" placeholder="https://openrouter.ai/api/v1" value="https://openrouter.ai/api/v1">
              </div>
              
              <div class="neutral-summarizer-settings-group">
                <label for="neutral-summarizer-api-key">
                  <span class="neutral-summarizer-label-icon">🔑</span>
                  API Key
                </label>
                <input type="password" id="neutral-summarizer-api-key" placeholder="Enter your API key">
              </div>
              

              <div class="neutral-summarizer-settings-group">
                <label for="neutral-summarizer-dumpling-key">
                  <span class="neutral-summarizer-label-icon">🥟</span>
                  DumplingAI API Key
                </label>
                <input type="password" id="neutral-summarizer-dumpling-key" placeholder="Enter DumplingAI API key">
              </div>
              
              <div class="neutral-summarizer-settings-group">
                <label for="neutral-summarizer-dumpling-url">
                  <span class="neutral-summarizer-label-icon">🌐</span>
                  Dumpling API URL
                </label>
                <input type="url" id="neutral-summarizer-dumpling-url" placeholder="https://app.dumplingai.com/api/v1" value="https://app.dumplingai.com/api/v1">
              </div>
              
              <div class="neutral-summarizer-settings-group">
                <label for="neutral-summarizer-pdf2markdown-url">
                  <span class="neutral-summarizer-label-icon">📄</span>
                  PDF2Markdown API URL
                </label>
                <input type="url" id="neutral-summarizer-pdf2markdown-url" placeholder="https://xtomd.vercel.app/api" value="https://xtomd.vercel.app/api">
              </div>
            </div>
          </div>
          
          <div class="neutral-summarizer-settings-section">
            <div class="neutral-summarizer-section-header">
              <h4>🤖 Model Configuration</h4>
            </div>
            <div class="neutral-summarizer-settings-form">
              <div class="neutral-summarizer-settings-group">
                <label for="neutral-summarizer-model-name">
                  <span class="neutral-summarizer-label-icon">🧠</span>
                  Model Name
                </label>
                <input type="text" id="neutral-summarizer-model-name" placeholder="qwen/qwen3-235b-a22b-2507" value="qwen/qwen3-235b-a22b-2507">
              </div>
              
              <div class="neutral-summarizer-settings-group">
                <label for="neutral-summarizer-temperature">
                  <span class="neutral-summarizer-label-icon">🌡️</span>
                  Temperature: <span id="neutral-summarizer-temperature-value">0.3</span>
                </label>
                <input type="range" id="neutral-summarizer-temperature" min="0" max="2" step="0.1" value="0.3">
                <small style="color: #6b7280; font-size: calc(var(--neutral-summarizer-font-size, 14px) - 2px); margin-top: 4px;">
                  Controls randomness: Lower values (0.0-0.5) for more focused responses, higher values (0.5-2.0) for more creative responses
                </small>
              </div>
              
              <div class="neutral-summarizer-settings-group">
                <label for="neutral-summarizer-system-prompt">
                  <span class="neutral-summarizer-label-icon">📝</span>
                  System Prompt
                </label>
                <textarea id="neutral-summarizer-system-prompt" rows="8" placeholder="Enter system prompt...">You are a helpful assistant that summarizes web pages. 
Please provide a concise, neutral summary of the content provided. 
Focus on the main points and key information.
Make sure you separate between information and opinions.
Breakdown them in two separated sessions: "Information" and "Opinions from writer"
Use markdown format for users to read.
Notes:
* If user asks following questions after the summary, just answer them based on available information. You don't need to include "Opinions from writer" session anymore.
* Show the most important information first</textarea>
              </div>
            </div>
          </div>
          
          <div class="neutral-summarizer-settings-section">
            <div class="neutral-summarizer-section-header">
              <h4>🎨 Appearance</h4>
            </div>
            <div class="neutral-summarizer-settings-form">
              <div class="neutral-summarizer-settings-group">
                <label for="neutral-summarizer-sidebar-width">
                  <span class="neutral-summarizer-label-icon">📏</span>
                  Sidebar Width: <span id="neutral-summarizer-width-value">400px</span>
                </label>
                <input type="range" id="neutral-summarizer-sidebar-width" min="300" max="800" value="400">
              </div>
              
              <div class="neutral-summarizer-settings-group">
                <label for="neutral-summarizer-font-size">
                  <span class="neutral-summarizer-label-icon">🔤</span>
                  Font Size: <span id="neutral-summarizer-font-value">14px</span>
                </label>
                <input type="range" id="neutral-summarizer-font-size" min="10" max="24" value="14">
              </div>
            </div>
          </div>
          
          <div class="neutral-summarizer-settings-actions">
            <button id="neutral-summarizer-save-settings" class="neutral-summarizer-btn primary">
              <span class="neutral-summarizer-btn-icon">💾</span>
              Save Settings
            </button>
          </div>
        `;
        
        // Set up settings event listeners
        this.setupSettingsEventListeners();
        
        // Load saved settings into the form
        setTimeout(() => {
          this.loadSettingsIntoForm({});
        }, 100);
        setTimeout(() => {
          this.loadSettingsIntoForm({});
        }, 300);
        setTimeout(() => {
          this.loadSettingsIntoForm({});
        }, 600);
      }

      // Load additional styles for components
      this.loadComponentStyles();
      
      console.log('All components loaded successfully');

    } catch (error) {
      console.error('Error loading components:', error);
    }
  }

  loadComponentStyles() {
    const styles = `
      .neutral-summarizer-chat-section {
        margin-bottom: 20px;
        background: white;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e5e7eb;
      }

      .neutral-summarizer-section-header {
        padding: 12px 16px;
        background: #f8fafc;
        border-bottom: 1px solid #e5e7eb;
      }

      .neutral-summarizer-section-header h4 {
        margin: 0;
        font-size: var(--neutral-summarizer-font-size, 14px);
        font-weight: 600;
        color: #374151;
      }

      .neutral-summarizer-chat-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }

      .neutral-summarizer-chat-actions {
        display: flex;
        gap: 8px;
        padding: 12px;
        flex-shrink: 0;
      }
      
      .neutral-summarizer-btn {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: var(--neutral-summarizer-font-size, 14px);
        font-weight: 500;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .neutral-summarizer-btn-icon {
        font-size: calc(var(--neutral-summarizer-font-size, 14px) + 2px);
      }
      
      .neutral-summarizer-btn.primary {
        background: #3b82f6;
        color: white;
      }
      
      .neutral-summarizer-btn.primary:hover {
        background: #2563eb;
      }
      
      .neutral-summarizer-btn.secondary {
        background: #e5e7eb;
        color: #374151;
      }
      
      .neutral-summarizer-btn.secondary:hover {
        background: #d1d5db;
      }
      
      #neutral-summarizer-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #fafbfc;
        border-radius: 8px;
        margin: 0 12px 12px 12px;
        min-height: 300px;
        display: flex;
        flex-direction: column;
      }

      #neutral-summarizer-chat-messages::-webkit-scrollbar {
        width: 8px;
      }

      #neutral-summarizer-chat-messages::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }

      #neutral-summarizer-chat-messages::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 4px;
      }

      #neutral-summarizer-chat-messages::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
      }
      
      .neutral-summarizer-message {
        margin-bottom: 16px;
        padding: 14px 18px;
        border-radius: 8px;
        line-height: 1.5;
        font-size: var(--neutral-summarizer-font-size, 14px);
        position: relative;
        animation: fadeIn 0.3s ease-in;
        flex-shrink: 0;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .neutral-summarizer-message.user {
        background: #dbeafe;
        margin-left: 20px;
      }
      
      .neutral-summarizer-message.ai {
        background: #f3f4f6;
        margin-right: 20px;
      }
      
      .neutral-summarizer-message.error {
        background: #fee2e2;
        color: #dc2626;
        border: 1px solid #fecaca;
      }
      
      .neutral-summarizer-message.loading {
        background: #f3f4f6;
        color: #6b7280;
        font-style: italic;
      }
      
      .neutral-summarizer-chat-input-container {
        display: flex;
        gap: 8px;
        padding: 12px;
        flex-shrink: 0;
      }
      
      #neutral-summarizer-chat-input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        resize: vertical;
        min-height: 44px;
        max-height: 120px;
        font-family: inherit;
        font-size: var(--neutral-summarizer-font-size, 14px);
        line-height: 1.4;
        background: #fafbfc;
        transition: all 0.2s;
      }

      #neutral-summarizer-chat-input:focus {
        background: white;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      #neutral-summarizer-chat-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      #neutral-summarizer-send-btn {
        padding: 8px 16px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
        box-shadow: 0 1px 3px rgba(59, 130, 246, 0.3);
        min-width: 60px;
        font-size: calc(var(--neutral-summarizer-font-size, 14px) - 1px);
      }

      #neutral-summarizer-send-btn:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4);
      }

      #neutral-summarizer-send-btn:active {
        transform: translateY(0);
      }
      
      #neutral-summarizer-send-btn:hover {
        background: #2563eb;
      }
      
      #neutral-summarizer-send-btn:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }
      
      .neutral-summarizer-settings-section {
        margin-bottom: 20px;
        background: white;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #e5e7eb;
      }

      .neutral-summarizer-settings-actions {
        margin-top: 24px;
        text-align: center;
      }

      .neutral-summarizer-settings-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }
      
      .neutral-summarizer-settings-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .neutral-summarizer-settings-group label {
        font-weight: 500;
        color: #374151;
        font-size: var(--neutral-summarizer-font-size, 14px);
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }

      .neutral-summarizer-label-icon {
        font-size: 16px;
        opacity: 0.8;
      }
      
      .neutral-summarizer-settings-group input,
      .neutral-summarizer-settings-group textarea {
        padding: 12px 16px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-family: inherit;
        font-size: var(--neutral-summarizer-font-size, 14px);
        background: #fafbfc;
        transition: all 0.2s;
        line-height: 1.4;
      }

      .neutral-summarizer-settings-group input:focus,
      .neutral-summarizer-settings-group textarea:focus {
        background: white;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        outline: none;
      }
      
      .neutral-summarizer-settings-group input:focus,
      .neutral-summarizer-settings-group textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      .neutral-summarizer-settings-group textarea {
        resize: vertical;
        min-height: 100px;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      }
      
      .neutral-summarizer-settings-group input[type="range"] {
        padding: 0;
        height: 6px;
        background: #e5e7eb;
        border-radius: 3px;
        outline: none;
        -webkit-appearance: none;
      }

      .neutral-summarizer-settings-group input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        background: #3b82f6;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s;
      }

      .neutral-summarizer-settings-group input[type="range"]::-webkit-slider-thumb:hover {
        background: #2563eb;
        transform: scale(1.1);
      }

      .neutral-summarizer-settings-group input[type="range"]::-moz-range-thumb {
        width: 18px;
        height: 18px;
        background: #3b82f6;
        border-radius: 50%;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }

      .neutral-summarizer-settings-group input[type="range"]::-moz-range-thumb:hover {
        background: #2563eb;
        transform: scale(1.1);
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  setupChatEventListeners() {
    // Summarize button
    const summarizeBtn = document.getElementById('neutral-summarizer-summarize-btn');
    if (summarizeBtn) {
      summarizeBtn.addEventListener('click', () => this.summarizePage());
    }

    // Clear chat button
    const clearBtn = document.getElementById('neutral-summarizer-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearChat());
    }

    // Send button
    const sendBtn = document.getElementById('neutral-summarizer-send-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Enter key in chat input
    const chatInput = document.getElementById('neutral-summarizer-chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }
  }

  setupSettingsEventListeners() {
    // Save settings button
    const saveBtn = document.getElementById('neutral-summarizer-save-settings');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveSettings());
    }

    // Sidebar width slider
    const widthSlider = document.getElementById('neutral-summarizer-sidebar-width');
    if (widthSlider) {
      widthSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('neutral-summarizer-width-value').textContent = `${value}px`;
      });
    }

    // Font size slider
    const fontSlider = document.getElementById('neutral-summarizer-font-size');
    if (fontSlider) {
      fontSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('neutral-summarizer-font-value').textContent = `${value}px`;
      });
    }

    // Temperature slider
    const temperatureSlider = document.getElementById('neutral-summarizer-temperature');
    if (temperatureSlider) {
      temperatureSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('neutral-summarizer-temperature-value').textContent = value;
      });
    }
  }

  async summarizePage() {
    const chatMessages = document.getElementById('neutral-summarizer-chat-messages');
    if (!chatMessages) return;

    // Clear all existing messages (both loading and regular messages)
    this.clearChat();

    // Add loading message
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'neutral-summarizer-message loading';
    loadingMsg.textContent = 'Analyzing page content...';
    chatMessages.appendChild(loadingMsg);

    try {
      // Extract page content
      const pageContent = await this.extractPageContent(loadingMsg);
      
      // Get current settings
      const settings = await new Promise((resolve) => {
        chrome.storage.sync.get({
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
* Show the most important information first`
        }, resolve);
      });
      
      await this.performSummarization(pageContent, settings, loadingMsg, chatMessages);
    } catch (error) {
      console.error('Error in summarizePage:', error);
      
      // Remove loading message
      if (loadingMsg && loadingMsg.parentNode === chatMessages) {
        chatMessages.removeChild(loadingMsg);
      }
      
      // Add error message
      const errorMsg = document.createElement('div');
      errorMsg.className = 'neutral-summarizer-message error';
      errorMsg.innerHTML = `
        <strong>⚠️ Error</strong><br>
        Failed to analyze page content: ${error.message}<br>
        <small>Please try again later.</small>
      `;
      chatMessages.appendChild(errorMsg);
    }
  }

  async performSummarization(pageContent, settings, loadingMsg, chatMessages) {
    // Check if API key is available
    if (!settings.apiKey && !settings.dumplingApiKey) {
      // Remove loading message
      if (loadingMsg && loadingMsg.parentNode === chatMessages) {
        chatMessages.removeChild(loadingMsg);
      }
      
      // Add error message
      const errorMsg = document.createElement('div');
      errorMsg.className = 'neutral-summarizer-message error';
      errorMsg.innerHTML = `
        <strong>⚠️ Configuration Required</strong><br>
        Please configure API keys in Settings to enable real AI summarization.<br>
        <small>Go to Settings tab and add your OpenAI API key or DumplingAI API key.</small>
      `;
      chatMessages.appendChild(errorMsg);
      return;
    }

    // Prepare API request with enhanced content
    let userPrompt;
    
    if (pageContent.isYouTube) {
      userPrompt = `Please analyze and summarize this YouTube video:\n\n`;
      userPrompt += `Title: ${pageContent.title}\n`;
      userPrompt += `URL: ${pageContent.url}\n\n`;
      userPrompt += `${pageContent.content}\n\n`;
      // userPrompt += `Please provide:\n`;
      // userPrompt += `1. A concise summary of the video content\n`;
      // userPrompt += `2. Key points and main topics covered\n`;
      // userPrompt += `3. Information vs Opinion separation\n`;
      // userPrompt += `4. Overall sentiment and tone analysis\n`;
      
      // Add transcript-specific instructions if transcript is available
      if (pageContent.youtubeData.hasTranscript) {
        userPrompt += `\nNOTE: A full video transcript is available above. Please base your analysis primarily on the transcript content as it provides the most accurate representation of what was actually said in the video.`;
      } else {
        userPrompt += `\nNOTE: No video transcript is available. Please base your analysis on the metadata, description, and comments provided.`;
      }
    } else {
      userPrompt = `Please summarize this webpage:\n\nTitle: ${pageContent.title}\nURL: ${pageContent.url}\n\n`;
      
      // Add content
      userPrompt += `Content:\n${pageContent.content}\n\n`;
      
      // Add metadata if available
      if (pageContent.meta.description) {
        userPrompt += `Description: ${pageContent.meta.description}\n\n`;
      }
      if (pageContent.meta.author) {
        userPrompt += `Author: ${pageContent.meta.author}\n\n`;
      }
      if (pageContent.meta.publish_date) {
        userPrompt += `Published: ${pageContent.meta.publish_date}\n\n`;
      }
    }
    
    const requestBody = {
      model: settings.modelName,
      messages: [
        {
          role: 'system',
          content: settings.systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      max_tokens: 2048,
      temperature: settings.temperature || 0.3,
      stream: true  // Enable streaming mode
    };

    // Determine which API to use
    const apiUrl = settings.baseUrl;
    const apiKey = settings.apiKey || settings.dumplingApiKey;

    try {
      // Make streaming API call
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
          // Note: Removed HTTP-Referer and X-Title headers to avoid encoding issues
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is not readable');
      }

      // Remove loading message and create streaming message
      if (loadingMsg && loadingMsg.parentNode === chatMessages) {
        chatMessages.removeChild(loadingMsg);
      }

      // Create streaming AI message
      const aiMsg = document.createElement('div');
      aiMsg.className = 'neutral-summarizer-message ai streaming';
      aiMsg.innerHTML = '';
      chatMessages.appendChild(aiMsg);

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return; // Stream finished
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                const content = parsed.choices[0].delta.content || '';
                fullContent += content;
                
                // Update the streaming message
                aiMsg.innerHTML = this.formatMarkdown(fullContent) + '<span class="streaming-cursor">▋</span>';
                
                // Auto-scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
              console.debug('Stream parsing:', e);
            }
          }
        }
      }

      // Remove streaming cursor and finalize message
      aiMsg.innerHTML = this.formatMarkdown(fullContent);
      aiMsg.classList.remove('streaming');

    } catch (error) {
      console.error('Summarization API error:', error);
      
      // Remove loading message
      if (loadingMsg && loadingMsg.parentNode === chatMessages) {
        chatMessages.removeChild(loadingMsg);
      }
      
      // Add error message
      const errorMsg = document.createElement('div');
      errorMsg.className = 'neutral-summarizer-message error';
      errorMsg.innerHTML = `
        <strong>⚠️ API Error</strong><br>
        Failed to generate summary: ${error.message}<br>
        <small>Please check your API keys and network connection.</small>
      `;
      chatMessages.appendChild(errorMsg);
    }
  }

  formatMarkdown(text) {
    // Simple markdown formatting for basic elements
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/^(#+)\s+(.*)$/gm, '<h4>$2</h4>')
      .replace(/^- (.*?)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  }

  clearChat() {
    const chatMessages = document.getElementById('neutral-summarizer-chat-messages');
    if (chatMessages) {
      chatMessages.innerHTML = '';
    }
  }

  sendMessage() {
    const chatInput = document.getElementById('neutral-summarizer-chat-input');
    const chatMessages = document.getElementById('neutral-summarizer-chat-messages');
    
    if (!chatInput || !chatMessages || !chatInput.value.trim()) return;

    // Remove any existing loading messages first
    const existingLoadingMsgs = chatMessages.querySelectorAll('.neutral-summarizer-message.loading');
    existingLoadingMsgs.forEach(msg => {
      if (msg.parentNode === chatMessages) {
        chatMessages.removeChild(msg);
      }
    });

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'neutral-summarizer-message user';
    userMsg.textContent = chatInput.value;
    chatMessages.appendChild(userMsg);

    // Add loading message
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'neutral-summarizer-message loading';
    loadingMsg.textContent = 'AI is thinking...';
    chatMessages.appendChild(loadingMsg);

    // Get user input and clear
    const userInput = chatInput.value;
    chatInput.value = '';

    // Get current settings and page content
    chrome.storage.sync.get({
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
* Show the most important information first`
    }, (settings) => {
      this.performChatResponse(userInput, settings, loadingMsg, chatMessages);
    });
  }

  async performChatResponse(userInput, settings, loadingMsg, chatMessages) {
    // Check if API key is available
    if (!settings.apiKey && !settings.dumplingApiKey) {
      // Remove loading message
      if (loadingMsg && loadingMsg.parentNode === chatMessages) {
        chatMessages.removeChild(loadingMsg);
      }
      
      // Add error message
      const errorMsg = document.createElement('div');
      errorMsg.className = 'neutral-summarizer-message error';
      errorMsg.innerHTML = `
        <strong>⚠️ Configuration Required</strong><br>
        Please configure API keys in Settings to enable real AI chat functionality.<br>
        <small>Go to Settings tab and add your OpenAI API key or DumplingAI API key.</small>
      `;
      chatMessages.appendChild(errorMsg);
      return;
    }

    // Get page content for context
    const pageContent = await this.extractPageContent();

    // Prepare API request with enhanced context
    let systemPrompt = settings.systemPrompt;
    
    // Add page context to system prompt
    systemPrompt += `\n\nPage Context:\nTitle: ${pageContent.title}\nURL: ${pageContent.url}`;
    
    if (pageContent.isYouTube) {
      systemPrompt += `\nPage Type: YouTube Video`;
      systemPrompt += `\nVideo ID: ${pageContent.youtubeData.videoId || 'Unknown'}`;
      systemPrompt += `\nChannel: ${pageContent.youtubeData.channelName || 'Unknown'}`;
      systemPrompt += `\nViews: ${pageContent.youtubeData.viewCount || 'Unknown'}`;
      systemPrompt += `\nLikes: ${pageContent.youtubeData.likeCount || 'Unknown'}`;
      
      if (pageContent.youtubeData.publishDate) {
        systemPrompt += `\nPublished: ${pageContent.youtubeData.publishDate}`;
      }
      
      // Add a note about YouTube-specific analysis
      systemPrompt += `\n\nNote: This is a YouTube video. Please provide analysis specific to video content, including visual elements, audio content, and community engagement metrics.`;
    } else {
      // Add metadata to context
      if (pageContent.meta.description) {
        systemPrompt += `\nDescription: ${pageContent.meta.description}`;
      }
      if (pageContent.meta.author) {
        systemPrompt += `\nAuthor: ${pageContent.meta.author}`;
      }
      if (pageContent.meta.publish_date) {
        systemPrompt += `\nPublished: ${pageContent.meta.publish_date}`;
      }
    }
    
    // Add content summary for context (limit to avoid overwhelming the AI)
    const contentSummary = pageContent.content.length > 65536 ? 
      pageContent.content.substring(0, 65536) + '...[content truncated]' : 
      pageContent.content;
    
    systemPrompt += `\n\nPage Content Summary:\n${contentSummary}`;

    const requestBody = {
      model: settings.modelName,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userInput
        }
      ],
      max_tokens: 1000,
      temperature: settings.temperature || 0.3,
      stream: true  // Enable streaming mode
    };

    // Determine which API to use
    const apiUrl = settings.baseUrl;
    const apiKey = settings.apiKey || settings.dumplingApiKey;

    try {
      // Helper method to sanitize header values to ensure ISO-8859-1 compliance
      const sanitizeHeaderValue = (value) => {
        if (!value) return '';
        
        // Convert to string if not already
        const stringValue = String(value);
        
        // Remove or replace non-ISO-8859-1 characters
        return stringValue
          .replace(/[^\x00-\xFF]/g, '') // Remove non-ISO-8859-1 characters
          .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters except space
      };

      // Make streaming API call
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': sanitizeHeaderValue(window.location.href),
          'X-Title': sanitizeHeaderValue(pageContent.title)
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is not readable');
      }

      // Remove loading message and create streaming message
      if (loadingMsg && loadingMsg.parentNode === chatMessages) {
        chatMessages.removeChild(loadingMsg);
      }

      // Create streaming AI message
      const aiMsg = document.createElement('div');
      aiMsg.className = 'neutral-summarizer-message ai streaming';
      aiMsg.innerHTML = '';
      chatMessages.appendChild(aiMsg);

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // Decode the chunk
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return; // Stream finished
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
                const content = parsed.choices[0].delta.content || '';
                fullContent += content;
                
                // Update the streaming message
                aiMsg.innerHTML = this.formatMarkdown(fullContent) + '<span class="streaming-cursor">▋</span>';
                
                // Auto-scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
              console.debug('Stream parsing:', e);
            }
          }
        }
      }

      // Remove streaming cursor and finalize message
      aiMsg.innerHTML = this.formatMarkdown(fullContent);
      aiMsg.classList.remove('streaming');

    } catch (error) {
      console.error('Chat API error:', error);
      
      // Remove loading message
      if (loadingMsg && loadingMsg.parentNode === chatMessages) {
        chatMessages.removeChild(loadingMsg);
      }
      
      // Add error message
      const errorMsg = document.createElement('div');
      errorMsg.className = 'neutral-summarizer-message error';
      errorMsg.innerHTML = `
        <strong>⚠️ API Error</strong><br>
        Failed to get response: ${error.message}<br>
        <small>Please check your API keys and network connection.</small>
      `;
      chatMessages.appendChild(errorMsg);
    }
  }

  saveSettings() {
    const settings = {
      baseUrl: document.getElementById('neutral-summarizer-base-url').value,
      apiKey: document.getElementById('neutral-summarizer-api-key').value,
      dumplingApiKey: document.getElementById('neutral-summarizer-dumpling-key').value,
      dumplingApiUrl: document.getElementById('neutral-summarizer-dumpling-url').value,
      modelName: document.getElementById('neutral-summarizer-model-name').value,
      temperature: parseFloat(document.getElementById('neutral-summarizer-temperature').value),
      systemPrompt: document.getElementById('neutral-summarizer-system-prompt').value,
      sidebarWidth: parseInt(document.getElementById('neutral-summarizer-sidebar-width').value),
      fontSize: parseInt(document.getElementById('neutral-summarizer-font-size').value)
    };

    // Apply settings immediately
    this.applySettings(settings);

    // Save to Chrome storage
    chrome.storage.sync.set(settings, () => {
      console.log('Settings saved successfully');
      
      // Show success message
      const saveBtn = document.getElementById('neutral-summarizer-save-settings');
      if (saveBtn) {
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.background = '#10b981';
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.background = '#3b82f6';
        }, 2000);
      }
    });
  }

  async extractPageContent(loadingMsgElement = null) {
    try {
      // Get page title
      const title = document.title;
      
      // Get page URL
      const url = window.location.href;
      
      // Check if this is a PDF page
      if (this.pdfHandler.isPDFPage()) {
        // Update loading message for PDF processing
        if (loadingMsgElement) {
          loadingMsgElement.textContent = 'Converting PDF to Markdown...';
        }
        
        // Get PDF2Markdown URL from settings
        const settings = await new Promise((resolve) => {
          chrome.storage.sync.get(['pdf2markdownUrl'], resolve);
        });
        
        const pdf2markdownUrl = settings.pdf2markdownUrl || 'https://xtomd.vercel.app/api';
        
        // Extract PDF content
        const pdfContent = await this.pdfHandler.extractPDFContent(pdf2markdownUrl);
        
        return pdfContent;
      }
      
      // Check if this is a YouTube page
      const isYouTube = url.includes('youtube.com') && url.includes('/watch');
      
      // Extract meaningful content
      let content;
      let youtubeData = {};
      
      if (isYouTube) {
        // Use YouTube-specific content extraction (this is async)
        const result = await this.extractYouTubeContent(loadingMsgElement);
        content = result.content;
        youtubeData = result.youtubeData || {};
      } else {
        // Use regular content extraction
        content = this.extractMainContent();
        
        // If content extraction failed, fallback to body text
        if (!content || content.length < 100) {
          content = this.extractBodyContent();
        }
      }
      
      // Ensure content is a string
      if (!content || typeof content !== 'string') {
        content = 'Unable to extract page content.';
      }
      
      // Limit content length for API (but much larger than before)
      const maxContentLength = 65536;
      if (content && content.length > maxContentLength) {
        content = content.substring(0, maxContentLength) + '...[truncated]';
      }
      
      // Ensure youtubeData is an object
      if (!youtubeData || typeof youtubeData !== 'object') {
        youtubeData = {};
      }
      
      return {
        title: title || 'Untitled Page',
        url: url,
        content: content,
        meta: this.extractPageMetadata(),
        isYouTube: isYouTube,
        youtubeData: youtubeData
      };
    } catch (error) {
      console.error('Error extracting page content:', error);
      return {
        title: document.title || 'Untitled Page',
        url: window.location.href,
        content: 'Unable to extract page content.',
        meta: {},
        isYouTube: false,
        youtubeData: {}
      };
    }
  }

  async extractYouTubeContent(loadingMsgElement) {
    try {
      const url = window.location.href;
      const youtubeData = {};
      
      // Extract video ID from URL
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
      if (videoIdMatch) {
        youtubeData.videoId = videoIdMatch[1];
      }
      
      // Get video title
      const titleElement = document.querySelector('h1.title');
      if (titleElement) {
        youtubeData.videoTitle = titleElement.textContent.trim();
      }
      
      // Get channel name
      const channelElement = document.querySelector('ytd-channel-name #text');
      if (channelElement) {
        youtubeData.channelName = channelElement.textContent.trim();
      }
      
      // Get view count
      const viewCountElement = document.querySelector('.view-count');
      if (viewCountElement) {
        youtubeData.viewCount = viewCountElement.textContent.trim();
      }
      
      // Get like count
      const likeButton = document.querySelector('like-button-view-model #text');
      if (likeButton) {
        youtubeData.likeCount = likeButton.textContent.trim();
      }
      
      // Get description
      const descriptionElement = document.querySelector('#description #text');
      if (descriptionElement) {
        youtubeData.description = descriptionElement.textContent.trim();
      }
      
      // Get published date
      const dateElement = document.querySelector('ytd-video-primary-info-renderer #info-strings #text');
      if (dateElement) {
        youtubeData.publishDate = dateElement.textContent.trim();
      }
      
      // Get comments summary (first few comments)
      const comments = [];
      const commentElements = document.querySelectorAll('#content #content-text');
      commentElements.forEach((element, index) => {
        if (index < 5 && element.textContent.trim()) {
          comments.push(element.textContent.trim());
        }
      });
      youtubeData.topComments = comments;
      
      // Get video tags
      const tags = [];
      const tagElements = document.querySelectorAll('.super-title');
      tagElements.forEach(element => {
        if (element.textContent.trim()) {
          tags.push(element.textContent.trim());
        }
      });
      youtubeData.tags = tags;
      
      // Update loading message to show transcript retrieval
      if (loadingMsgElement) {
        loadingMsgElement.textContent = 'Retrieving Video Transcript...';
      }
      
      // Try to get transcript using DumplingAI API
      youtubeData.transcript = await this.getYouTubeTranscript(url);
      
      // Update loading message back to normal after transcript retrieval
      if (loadingMsgElement) {
        loadingMsgElement.textContent = 'Analyzing page content...';
      }
      
      // Create content summary for AI
      let content = `YouTube Video Analysis\n\n`;
      content += `Title: ${youtubeData.videoTitle || 'Unknown Title'}\n`;
      content += `Channel: ${youtubeData.channelName || 'Unknown Channel'}\n`;
      content += `Views: ${youtubeData.viewCount || 'Unknown'}\n`;
      content += `Likes: ${youtubeData.likeCount || 'Unknown'}\n`;
      
      if (youtubeData.publishDate) {
        content += `Published: ${youtubeData.publishDate}\n`;
      }
      
      content += `\nDescription:\n${youtubeData.description || 'No description available.'}\n`;
      
      if (youtubeData.tags.length > 0) {
        content += `\nTags: ${youtubeData.tags.join(', ')}\n`;
      }
      
      // Add transcript if available
      if (youtubeData.transcript && youtubeData.transcript.transcript) {
        content += `\nVideo Transcript:\n${youtubeData.transcript.transcript}\n`;
        youtubeData.hasTranscript = true;
      } else {
        content += `\nVideo Transcript: Not available\n`;
        youtubeData.hasTranscript = false;
      }
      
      if (youtubeData.topComments.length > 0) {
        content += `\nTop Comments:\n`;
        youtubeData.topComments.forEach((comment, index) => {
          content += `${index + 1}. ${comment}\n`;
        });
      }
      
      return {
        content: content,
        youtubeData: youtubeData
      };
      
    } catch (error) {
      console.error('Error extracting YouTube content:', error);
      return {
        content: 'YouTube video content extraction failed.',
        youtubeData: {}
      };
    }
  }

  async getYouTubeTranscript(videoUrl) {
    try {
      // Send message to background script to fetch transcript
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'FETCH_YOUTUBE_TRANSCRIPT',
          data: {
            videoUrl: videoUrl
          }
        }, resolve);
      });
      
      if (response && response.success) {
        console.log('Transcript retrieved successfully via background script:', response.transcript);
        return response.transcript;
      } else {
        console.error('Failed to fetch transcript via background script:', response?.error);
        return null;
      }
      
    } catch (error) {
      console.error('Error fetching YouTube transcript via background script:', error);
      return null;
    }
  }

  extractMainContent() {
    try {
      // Try to find main content area
      const contentSelectors = [
        'article',
        '[role="main"]',
        'main',
        '.main',
        '.content',
        '.article',
        '.post',
        '.entry',
        '.story',
        '.text-content',
        '#main',
        '#content',
        '#article',
        '#post',
        '#story'
      ];
      
      let mainContent = '';
      
      // Try each selector
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          // Get text content, excluding scripts, styles, and navigation
          const text = this.getTextContent(element);
          if (text.length > mainContent.length) {
            mainContent = text;
          }
        }
      }
      
      // If no main content found, try to extract from paragraphs
      if (!mainContent || mainContent.length < 200) {
        const paragraphs = document.querySelectorAll('p');
        const paragraphTexts = Array.from(paragraphs)
          .map(p => p.textContent.trim())
          .filter(text => text.length > 20); // Filter out very short paragraphs
          
        mainContent = paragraphTexts.join('\n\n');
      }
      
      return mainContent.trim();
    } catch (error) {
      console.error('Error extracting main content:', error);
      return '';
    }
  }

  extractBodyContent() {
    try {
      // Clone the body to avoid modifying the original
      const bodyClone = document.body.cloneNode(true);
      
      // Remove unwanted elements
      const unwantedSelectors = [
        'script',
        'style',
        'noscript',
        'iframe',
        'nav',
        '.nav',
        '.navigation',
        '.navbar',
        '.menu',
        '.sidebar',
        '.advertisement',
        '.ads',
        '.social',
        '.share',
        '.comments',
        '.footer',
        '.header',
        '.toolbar'
      ];
      
      unwantedSelectors.forEach(selector => {
        const elements = bodyClone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });
      
      // Get text content
      const textContent = bodyClone.textContent || bodyClone.innerText;
      
      // Clean up the text
      return textContent
        .replace(/\s+/g, ' ') // Multiple spaces to single space
        .replace(/\n\s*\n/g, '\n\n') // Multiple newlines to double newlines
        .trim();
    } catch (error) {
      console.error('Error extracting body content:', error);
      return document.body.textContent || document.body.innerText || '';
    }
  }

  getTextContent(element) {
    try {
      // Clone element to avoid modifying original
      const clone = element.cloneNode(true);
      
      // Remove unwanted elements from clone
      const unwanted = clone.querySelectorAll('script, style, noscript, iframe, nav, .nav, .navigation, .ads, .advertisement');
      unwanted.forEach(el => el.remove());
      
      // Get text content
      const text = clone.textContent || clone.innerText;
      
      // Clean up text
      return text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
    } catch (error) {
      console.error('Error getting text content:', error);
      return element.textContent || element.innerText || '';
    }
  }

  extractPageMetadata() {
    try {
      const meta = {};
      
      // Get meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        meta.description = metaDescription.getAttribute('content');
      }
      
      // Get OpenGraph description
      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        meta.og_description = ogDescription.getAttribute('content');
      }
      
      // Get meta keywords
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        meta.keywords = metaKeywords.getAttribute('content');
      }
      
      // Get article author if available
      const author = document.querySelector('meta[name="author"]') || 
                     document.querySelector('[rel="author"]') ||
                     document.querySelector('.author') ||
                     document.querySelector('.byline');
      if (author) {
        meta.author = author.textContent || author.getAttribute('content') || author.getAttribute('href');
      }
      
      // Get publication date if available
      const publishDate = document.querySelector('meta[property="article:published_time"]') ||
                         document.querySelector('meta[name="date"]') ||
                         document.querySelector('.date') ||
                         document.querySelector('.published');
      if (publishDate) {
        meta.publish_date = publishDate.getAttribute('content') || publishDate.textContent;
      }
      
      return meta;
    } catch (error) {
      console.error('Error extracting page metadata:', error);
      return {};
    }
  }

  applySettings(settings) {
    if (settings.sidebarWidth) {
      const sidebar = document.getElementById('neutral-summarizer-sidebar');
      if (sidebar) {
        sidebar.style.width = `${settings.sidebarWidth}px`;
      }
      
      // Update width value display
      const widthValue = document.getElementById('neutral-summarizer-width-value');
      if (widthValue) {
        widthValue.textContent = `${settings.sidebarWidth}px`;
      }
      
      // Update width slider
      const widthSlider = document.getElementById('neutral-summarizer-sidebar-width');
      if (widthSlider) {
        widthSlider.value = settings.sidebarWidth;
      }
    }
    
    if (settings.fontSize) {
      // Set CSS custom property
      document.documentElement.style.setProperty('--neutral-summarizer-font-size', `${settings.fontSize}px`);
      
      // Update font size value display
      const fontValue = document.getElementById('neutral-summarizer-font-value');
      if (fontValue) {
        fontValue.textContent = `${settings.fontSize}px`;
      }
      
      // Update font size slider
      const fontSlider = document.getElementById('neutral-summarizer-font-size');
      if (fontSlider) {
        fontSlider.value = settings.fontSize;
      }
      
      // Force a reflow to ensure font size changes take effect
      document.body.style.display = 'none';
      document.body.offsetHeight; // Trigger reflow
      document.body.style.display = '';
      
      console.log('Applied font size:', settings.fontSize);
    }
  }

  applySidebarWidth() {
    // Apply sidebar width from current settings
    if (this.currentSettings && this.currentSettings.sidebarWidth) {
      const sidebar = document.getElementById('neutral-summarizer-sidebar');
      if (sidebar) {
        sidebar.style.width = `${this.currentSettings.sidebarWidth}px`;
        console.log('Applied sidebar width:', this.currentSettings.sidebarWidth);
      }
    } else {
      // If no settings loaded, get from storage
      chrome.storage.sync.get(['sidebarWidth'], (result) => {
        if (result.sidebarWidth) {
          const sidebar = document.getElementById('neutral-summarizer-sidebar');
          if (sidebar) {
            sidebar.style.width = `${result.sidebarWidth}px`;
            console.log('Applied sidebar width from storage:', result.sidebarWidth);
          }
        }
      });
    }
  }

  loadSettings() {
    chrome.storage.sync.get({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: '',
      dumplingApiKey: '',
      dumplingApiUrl: 'https://app.dumplingai.com/api/v1',
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
    }, (settings) => {
      console.log('Initial settings loaded:', settings);
      this.applySettings(settings);
      
      // Store settings for later use
      this.currentSettings = settings;
      
      // Try to load settings into form multiple times to ensure it works
      const loadForm = () => {
        this.loadSettingsIntoForm(settings);
      };
      
      // Try immediately
      loadForm();
      
      // Try after 100ms
      setTimeout(loadForm, 100);
      
      // Try after 200ms
      setTimeout(loadForm, 200);
      
      // Try after 500ms
      setTimeout(loadForm, 500);
    });
  }

  loadCurrentSettings() {
    chrome.storage.sync.get({
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: '',
      dumplingApiKey: '',
      dumplingApiUrl: 'https://app.dumplingai.com/api/v1',
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
    }, (settings) => {
      console.log('Loading current settings for Settings tab:', settings);
      this.loadSettingsIntoForm(settings);
    });
  }

  loadSettingsIntoForm(settings) {
    // Check if settings parameter is valid and settings form elements exist
    if (!settings || typeof settings !== 'object') {
      console.log('Invalid settings parameter:', settings);
      return;
    }
    
    const settingsContainer = document.getElementById('neutral-summarizer-settings-container');
    if (!settingsContainer) {
      console.log('Settings container not found');
      return;
    }

    console.log('Loading settings into form:', settings);

    // Load settings without delay for immediate response
    if (settings.baseUrl !== undefined) {
      const baseUrlInput = document.getElementById('neutral-summarizer-base-url');
      if (baseUrlInput) {
        baseUrlInput.value = settings.baseUrl;
        console.log('Set baseUrl to:', settings.baseUrl);
      }
    }
    
    if (settings.apiKey !== undefined) {
      const apiKeyInput = document.getElementById('neutral-summarizer-api-key');
      if (apiKeyInput) {
        apiKeyInput.value = settings.apiKey;
        console.log('Set apiKey');
      }
    }
    
    if (settings.dumplingApiKey !== undefined) {
      const dumplingKeyInput = document.getElementById('neutral-summarizer-dumpling-key');
      if (dumplingKeyInput) {
        dumplingKeyInput.value = settings.dumplingApiKey;
        console.log('Set dumplingApiKey');
      }
    }
    
    if (settings.dumplingApiUrl !== undefined) {
      const dumplingUrlInput = document.getElementById('neutral-summarizer-dumpling-url');
      if (dumplingUrlInput) {
        dumplingUrlInput.value = settings.dumplingApiUrl || 'https://app.dumplingai.com/api/v1';
        console.log('Set dumplingApiUrl');
      }
    }
    
    if (settings.modelName !== undefined) {
      const modelNameInput = document.getElementById('neutral-summarizer-model-name');
      if (modelNameInput) {
        modelNameInput.value = settings.modelName;
        console.log('Set modelName to:', settings.modelName);
      }
    }
    
    if (settings.systemPrompt !== undefined) {
      const systemPromptInput = document.getElementById('neutral-summarizer-system-prompt');
      if (systemPromptInput) {
        systemPromptInput.value = settings.systemPrompt;
        console.log('Set systemPrompt');
      }
    }
    
    if (settings.sidebarWidth !== undefined) {
      const widthSlider = document.getElementById('neutral-summarizer-sidebar-width');
      const widthValue = document.getElementById('neutral-summarizer-width-value');
      if (widthSlider) {
        widthSlider.value = settings.sidebarWidth;
        if (widthValue) widthValue.textContent = `${settings.sidebarWidth}px`;
        console.log('Set sidebarWidth to:', settings.sidebarWidth);
      }
    }
    
    if (settings.fontSize !== undefined) {
      const fontSlider = document.getElementById('neutral-summarizer-font-size');
      const fontValue = document.getElementById('neutral-summarizer-font-value');
      if (fontSlider) {
        fontSlider.value = settings.fontSize;
        if (fontValue) fontValue.textContent = `${settings.fontSize}px`;
        console.log('Set fontSize to:', settings.fontSize);
      }
    }
    
    if (settings.temperature !== undefined) {
      const temperatureSlider = document.getElementById('neutral-summarizer-temperature');
      const temperatureValue = document.getElementById('neutral-summarizer-temperature-value');
      if (temperatureSlider) {
        temperatureSlider.value = settings.temperature;
        if (temperatureValue) temperatureValue.textContent = settings.temperature;
        console.log('Set temperature to:', settings.temperature);
      }
    }
    
    console.log('Settings loaded into form successfully');
  }
}

// Initialize the sidebar manager
console.log('Neutral Summarizer content script initializing...');
new SidebarManager();
console.log('Neutral Summarizer content script initialized successfully');

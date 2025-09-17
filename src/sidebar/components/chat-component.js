// Chat component for Neutral Summarizer extension
class ChatComponent {
  constructor() {
    this.chatMessages = document.getElementById('neutral-summarizer-chat-messages');
    this.chatInput = document.getElementById('neutral-summarizer-chat-input');
    this.sendBtn = document.getElementById('neutral-summarizer-send-btn');
    this.summarizeBtn = document.getElementById('neutral-summarizer-summarize-btn');
    this.clearBtn = document.getElementById('neutral-summarizer-clear-btn');
    
    this.settings = null;
    this.isGenerating = false;
    this.currentConversation = [];
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSettings();
    this.createMarkdownRenderer();
  }

  setupEventListeners() {
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.summarizeBtn.addEventListener('click', () => this.summarizePage());
    this.clearBtn.addEventListener('click', () => this.clearChat());
    
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success) {
        this.settings = response.settings;
      } else {
        console.error('Failed to load settings:', response.error);
        this.showError('Failed to load settings. Please check your configuration.');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showError('Error loading settings. Please try again.');
    }
  }

  createMarkdownRenderer() {
    // Use the global markdown renderer if available
    if (window.neutralSummarizerMarkdownRenderer) {
      this.markdownRenderer = window.neutralSummarizerMarkdownRenderer;
    } else {
      // Fallback to simple renderer
      this.markdownRenderer = {
        render: (text) => {
          return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.*)$/gm, '<p>$1</p>')
            .replace(/<p><\/p>/g, '')
            .replace(/<p>(<h[1-6]>)/g, '$1')
            .replace(/(<\/h[1-6]>)<\/p>/g, '$1');
        }
      };
    }
  }

  async sendMessage() {
    if (this.isGenerating) return;
    
    const message = this.chatInput.value.trim();
    if (!message) return;
    
    this.addMessage('user', message);
    this.chatInput.value = '';
    this.setLoading(true);
    
    try {
      const pageContent = await this.extractPageContent();
      await this.generateAIResponse(message, pageContent);
    } catch (error) {
      console.error('Error sending message:', error);
      this.showError('Failed to get AI response. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  async summarizePage() {
    if (this.isGenerating) return;
    
    this.clearChat();
    this.setLoading(true);
    
    try {
      const pageContent = await this.extractPageContent();
      const systemPrompt = this.settings.systemPrompt || this.getDefaultSystemPrompt();
      
      await this.generateAIResponse('Please summarize this page content.', pageContent, systemPrompt);
    } catch (error) {
      console.error('Error summarizing page:', error);
      this.showError('Failed to summarize page. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  async extractPageContent() {
    // Check if this is a YouTube page
    if (this.isYouTubePage()) {
      return await this.extractYouTubeContent();
    }
    
    // Extract regular web page content
    return this.extractWebPageContent();
  }

  isYouTubePage() {
    return window.location.hostname.includes('youtube.com') && 
           window.location.pathname.includes('/watch');
  }

  async extractYouTubeContent() {
    if (!this.settings.dumplingApiKey) {
      throw new Error('DumplingAI API key is required for YouTube video summarization');
    }
    
    try {
      const transcript = await this.getYouTubeTranscript();
      return {
        title: document.title,
        url: window.location.href,
        content: transcript,
        isYouTube: true
      };
    } catch (error) {
      console.error('Error extracting YouTube content:', error);
      throw new Error('Failed to extract YouTube transcript. Please check if the video has captions available.');
    }
  }

  async getYouTubeTranscript() {
    const dumplingApiUrl = this.settings.dumplingApiUrl || 'https://app.dumplingai.com/api/v1';
    const response = await fetch(`${dumplingApiUrl}/get-youtube-transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.dumplingApiKey}`
      },
      body: JSON.stringify({
        videoUrl: window.location.href,
        includeTimestamps: false,
        timestampsToCombine: 5
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed: ${errorBody}`);
    }

    const data = await response.json();
    return data.transcript || '';
  }

  extractWebPageContent() {
    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'noscript', 'iframe', 'nav', 'header', 'footer',
      '.advertisement', '.ads', '.sidebar', '.menu', '.navigation'
    ];
    
    const content = document.body.cloneNode(true);
    
    // Remove unwanted elements
    unwantedSelectors.forEach(selector => {
      const elements = content.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // Extract text content
    const text = content.textContent || content.innerText || '';
    
    // Clean and limit content
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const limitedText = cleanText.substring(0, 8000); // Limit to prevent API issues
    
    return {
      title: document.title,
      url: window.location.href,
      content: limitedText,
      isYouTube: false
    };
  }

  // Helper method to sanitize header values to ensure ISO-8859-1 compliance
  sanitizeHeaderValue(value) {
    if (!value) return '';
    
    // Convert to string if not already
    const stringValue = String(value);
    
    // Remove or replace non-ISO-8859-1 characters
    return stringValue
      .replace(/[^\x00-\xFF]/g, '') // Remove non-ISO-8859-1 characters
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters except space
  }

  async generateAIResponse(userMessage, pageContent, systemPrompt = null) {
    if (!this.settings.apiKey || !this.settings.baseUrl) {
      throw new Error('API configuration is incomplete. Please check your settings.');
    }
    
    const messages = this.buildConversationMessages(userMessage, pageContent, systemPrompt);
    
    try {
      const response = await fetch(`${this.settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'HTTP-Referer': this.sanitizeHeaderValue(window.location.href),
          'X-Title': this.sanitizeHeaderValue('Neutral Summarizer Extension')
        },
        body: JSON.stringify({
          model: this.settings.modelName || 'gpt-3.5-turbo',
          messages: messages,
          stream: true,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API request failed: ${errorBody}`);
      }

      await this.handleStreamingResponse(response);
      
    } catch (error) {
      console.error('AI API Error:', error);
      throw error;
    }
  }

  buildConversationMessages(userMessage, pageContent, systemPrompt = null) {
    const messages = [];
    
    // Add system prompt
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    } else {
      messages.push({
        role: 'system',
        content: this.getDefaultSystemPrompt()
      });
    }
    
    // Add page context
    messages.push({
      role: 'system',
      content: `Page Title: ${pageContent.title}\nPage URL: ${pageContent.url}\n\nPage Content:\n${pageContent.content}`
    });
    
    // Add conversation history
    this.currentConversation.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });
    
    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });
    
    return messages;
  }

  async handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let aiMessageElement = this.addMessage('ai', '');
    let fullContent = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              
              if (content) {
                fullContent += content;
                aiMessageElement.innerHTML = this.markdownRenderer.render(fullContent);
                this.scrollToBottom();
              }
            } catch (e) {
              // Skip invalid JSON
              continue;
            }
          }
        }
      }
      
      // Add to conversation history
      this.currentConversation.push({
        role: 'assistant',
        content: fullContent
      });
      
    } catch (error) {
      console.error('Error reading stream:', error);
      aiMessageElement.innerHTML = '<em>Error reading response. Please try again.</em>';
    }
  }

  addMessage(type, content) {
    const messageElement = document.createElement('div');
    messageElement.className = `neutral-summarizer-message ${type}`;
    
    if (type === 'ai' && content) {
      messageElement.innerHTML = this.markdownRenderer.render(content);
    } else {
      messageElement.textContent = content;
    }
    
    this.chatMessages.appendChild(messageElement);
    this.scrollToBottom();
    
    return messageElement;
  }

  showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'neutral-summarizer-message error';
    errorElement.textContent = `Error: ${message}`;
    
    this.chatMessages.appendChild(errorElement);
    this.scrollToBottom();
    
    console.error('Extension Error:', message);
  }

  showLoading() {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'neutral-summarizer-message loading';
    loadingElement.textContent = 'AI is thinking...';
    loadingElement.id = 'neutral-summarizer-loading';
    
    this.chatMessages.appendChild(loadingElement);
    this.scrollToBottom();
  }

  hideLoading() {
    const loadingElement = document.getElementById('neutral-summarizer-loading');
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  clearChat() {
    this.chatMessages.innerHTML = '';
    this.currentConversation = [];
  }

  setLoading(isLoading) {
    this.isGenerating = isLoading;
    this.sendBtn.disabled = isLoading;
    this.summarizeBtn.disabled = isLoading;
    
    if (isLoading) {
      this.showLoading();
    } else {
      this.hideLoading();
    }
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  getDefaultSystemPrompt() {
    return `You are a helpful assistant that summarizes web pages. 
Please provide a concise, neutral summary of the content provided. 
Focus on the main points and key information.
Make sure you separate between information and opinions.
Breakdown them in two separated sessions: "Information" and "Opinions from writer"
Use markdown format for users to read.
Notes:
* If user asks following questions after the summary, just answer them based on available information. You don't need to include "Opinions from writer" session anymore.
* Show the most important information first`;
  }
}

// Initialize the chat component when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ChatComponent());
} else {
  new ChatComponent();
}

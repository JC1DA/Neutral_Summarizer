// Sidebar script to handle UI interactions
document.addEventListener('DOMContentLoaded', function() {
  // Close sidebar functionality
  const closeButton = document.getElementById('close-sidebar');
  closeButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({action: 'closeSidebar'});
  });
  
  // Tab switching functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show active tab pane
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `${tabName}-tab`) {
          pane.classList.add('active');
        }
      });
    });
  });
  
  // Summarize button functionality
  const summarizeButton = document.getElementById('summarize-button');
  const chatMessages = document.getElementById('chat-messages');
  
  // Clear button functionality
  const clearButton = document.getElementById('clear-button');
  clearButton.addEventListener('click', () => {
    chatMessages.innerHTML = '';
  });
  
  summarizeButton.addEventListener('click', async () => {
    // Disable button during processing
    summarizeButton.disabled = true;
    const originalText = summarizeButton.textContent;
    summarizeButton.textContent = '📝 Summarizing...';
    
    try {
      // Get current page content
      const pageContent = await getCurrentPageContent();
      
      // Get settings
      const settings = await getSettings();
      
      // Create AI message element before streaming
      const messageElement = document.createElement('div');
      messageElement.classList.add('chat-message', 'ai');
      chatMessages.appendChild(messageElement);
      
      // Add a temporary loading indicator
      messageElement.innerHTML = '<em>Generating summary...</em>';
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // Generate summary using AI with streaming
      await generateSummary(pageContent, settings, messageElement);
    } catch (error) {
      addMessageToChat('AI', `❌ Error: ${error.message}`);
    } finally {
      // Re-enable button
      summarizeButton.disabled = false;
      summarizeButton.textContent = originalText;
    }
  });
  
  // Chat functionality
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  
  sendButton.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  function sendMessage() {
    const message = chatInput.value.trim();
    if (message) {
      addMessageToChat('User', message);
      chatInput.value = '';
      
      // Process user message with AI
      processUserMessage(message);
    }
  }
  
  // Function to add message to chat
  function addMessageToChat(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender.toLowerCase());
    
    // Parse markdown and set HTML content
    messageElement.innerHTML = parseMarkdown(message);
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Simple markdown parser
  function parseMarkdown(text) {
    // Create a temporary element to escape HTML
    const temp = document.createElement('div');
    
    // Escape HTML characters to prevent XSS
    temp.textContent = text;
    text = temp.innerHTML;
    
    // Code blocks (```code```)
    text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code (`code`)
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold (**text** or __text__)
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Italic (*text* or _text_)
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Links ([text](url))
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Line breaks
    text = text.replace(/\n/g, '<br>');
    
    return text;
  }
  
  // Function to get current page content
  function getCurrentPageContent() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({action: 'getPageContent'}, (response) => {
        resolve(response.content);
      });
    });
  }
  
  // Function to get settings
  async function getSettings() {
    try {
      if (typeof window.loadSettings === 'function') {
        return await window.loadSettings();
      }
      return {};
    } catch (error) {
      console.error('Error loading settings:', error);
      return {};
    }
  }
  
  // Function to process user message
  async function processUserMessage(message) {
    try {
      // Get current page content
      const pageContent = await getCurrentPageContent();
      
      // Get settings
      const settings = await getSettings();
      
      // Generate response using AI with streaming
      await generateResponse(message, pageContent, settings);
    } catch (error) {
      addMessageToChat('AI', `❌ Error: ${error.message}`);
    }
  }
  
  // Function to generate summary with streaming
  async function generateSummary(pageContent, settings, messageElement) {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Only add Authorization header if apiKey is not empty
      if (settings.apiKey) {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
      }
      
      const response = await fetch(`${settings.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: settings.modelName,
          messages: [
            {
              role: "system",
              content: settings.systemPrompt
            },
            {
              role: "user",
              content: `Please summarize the following web page content:\n\n${pageContent}`
            }
          ],
          temperature: 0.7,
          stream: true  // Enable streaming
        })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              // Scroll to bottom when done
              const chatMessages = document.getElementById('chat-messages');
              chatMessages.scrollTop = chatMessages.scrollHeight;
              return fullContent.trim();
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                fullContent += content;
                // Update the message element with streaming content
                messageElement.innerHTML = parseMarkdown(fullContent);
                
                // Scroll to bottom
                const chatMessages = document.getElementById('chat-messages');
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } catch (e) {
              // Ignore parsing errors for incomplete JSON
            }
          }
        }
      }
      
      return fullContent.trim();
    } catch (error) {
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }
  
  // Function to generate response with streaming
  async function generateResponse(userMessage, pageContent, settings) {
    try {
      // Create AI message element before streaming
      const messageElement = document.createElement('div');
      messageElement.classList.add('chat-message', 'ai');
      document.getElementById('chat-messages').appendChild(messageElement);
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Only add Authorization header if apiKey is not empty
      if (settings.apiKey) {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
      }
      
      const response = await fetch(`${settings.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: settings.modelName,
          messages: [
            {
              role: "system",
              content: settings.systemPrompt
            },
            {
              role: "user",
              content: `The current web page content is:\n\n${pageContent}\n\nUser question: ${userMessage}`
            }
          ],
          temperature: 0.7,
          stream: true  // Enable streaming
        })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              // Scroll to bottom when done
              const chatMessages = document.getElementById('chat-messages');
              chatMessages.scrollTop = chatMessages.scrollHeight;
              return fullContent.trim();
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                fullContent += content;
                // Update the message element with streaming content
                messageElement.innerHTML = parseMarkdown(fullContent);
                
                // Scroll to bottom
                const chatMessages = document.getElementById('chat-messages');
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } catch (e) {
              // Ignore parsing errors for incomplete JSON
            }
          }
        }
      }
      
      return fullContent.trim();
    } catch (error) {
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }
  
  
  // Load settings when settings tab is opened
  const settingsTabButton = document.querySelector('.tab-button[data-tab="settings"]');
  settingsTabButton.addEventListener('click', loadSettingsForm);
});

// Function to load settings into form
async function loadSettingsForm() {
  try {
    // Use the settings.js loadSettings function which properly merges defaults
    const settings = await window.loadSettings();
    document.getElementById('api-url').value = settings.apiUrl || '';
    document.getElementById('api-key').value = settings.apiKey || '';
    document.getElementById('model-name').value = settings.modelName || '';
    document.getElementById('system-prompt').value = settings.systemPrompt || '';
    document.getElementById('sidebar-width').value = settings.sidebarWidth || 400;
    document.getElementById('font-size').value = settings.fontSize || 14;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Initialize settings form
document.getElementById('settings-form').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const settings = {
    apiUrl: document.getElementById('api-url').value,
    apiKey: document.getElementById('api-key').value,
    modelName: document.getElementById('model-name').value,
    systemPrompt: document.getElementById('system-prompt').value,
    sidebarWidth: parseInt(document.getElementById('sidebar-width').value) || 400,
    fontSize: parseInt(document.getElementById('font-size').value) || 14
  };
  
  chrome.storage.sync.set(settings, () => {
    // Show success message
    const saveButton = document.getElementById('save-settings');
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Settings Saved!';
    
    setTimeout(() => {
      saveButton.textContent = originalText;
    }, 2000);
    
    // Apply the new settings immediately
    applySettings(settings);
  });
});

// Load settings when settings tab is shown
document.addEventListener('DOMContentLoaded', function() {
  loadSettingsForm();
  // Also apply settings immediately when the page loads
  window.loadSettings().then(settings => {
    if (settings) {
      applySettings(settings);
    }
  });
});

// Function to apply settings immediately
function applySettings(settings) {
  // Apply sidebar width
  const sidebarContainer = document.querySelector('.sidebar-container');
  if (sidebarContainer) {
    sidebarContainer.style.width = `${settings.sidebarWidth}px`;
  }
  
  // Send message to update container width
  chrome.runtime.sendMessage({
    action: 'updateSidebarWidth',
    width: settings.sidebarWidth
  });
  
  // Apply font size to chat messages
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) {
    chatMessages.style.fontSize = `${settings.fontSize}px`;
  }
  
  // Apply font size to chat input
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.style.fontSize = `${settings.fontSize}px`;
  }
}

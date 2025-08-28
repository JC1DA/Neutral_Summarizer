// API client utility for Neutral Summarizer extension
class APIClient {
  constructor(settings) {
    this.settings = settings;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  updateSettings(settings) {
    this.settings = settings;
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.settings.baseUrl}/models`, {
        method: 'GET',
        headers: {
          ...this.defaultHeaders,
          'Authorization': `Bearer ${this.settings.apiKey}`
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Connection test failed: ${errorBody}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('API Connection Test Error:', error);
      return { success: false, error: error.message };
    }
  }

  async chatCompletion(messages, options = {}) {
    if (!this.settings.apiKey || !this.settings.baseUrl) {
      throw new Error('API configuration is incomplete. Please check your settings.');
    }

    const defaultOptions = {
      model: this.settings.modelName || 'gpt-3.5-turbo',
      stream: true,
      temperature: 0.7,
      max_tokens: 4000
    };

    const finalOptions = { ...defaultOptions, ...options };

    const payload = {
      model: finalOptions.model,
      messages: messages,
      stream: finalOptions.stream,
      temperature: finalOptions.temperature,
      max_tokens: finalOptions.max_tokens
    };

    try {
      const response = await fetch(`${this.settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          ...this.defaultHeaders,
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'Neutral Summarizer Extension'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API request failed: ${errorBody}`);
      }

      if (finalOptions.stream) {
        return this.handleStreamingResponse(response);
      } else {
        const data = await response.json();
        return { success: true, data };
      }

    } catch (error) {
      console.error('API Chat Completion Error:', error);
      throw error;
    }
  }

  async handleStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let fullContent = '';
    let isDone = false;

    return {
      async *[Symbol.asyncIterator]() {
        try {
          while (!isDone) {
            const { done, value } = await reader.read();
            
            if (done) {
              isDone = true;
              break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  isDone = true;
                  break;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0]?.delta?.content || '';
                  
                  if (content) {
                    fullContent += content;
                    yield {
                      type: 'content',
                      content: content,
                      fullContent: fullContent
                    };
                  }
                } catch (e) {
                  // Skip invalid JSON
                  continue;
                }
              }
            }
          }
          
          yield {
            type: 'done',
            fullContent: fullContent
          };
          
        } catch (error) {
          console.error('Stream reading error:', error);
          yield {
            type: 'error',
            error: error.message
          };
        }
      }
    };
  }

  async getYouTubeTranscript(videoUrl, dumplingApiKey, dumplingApiUrl = 'https://app.dumplingai.com/api/v1') {
    if (!dumplingApiKey) {
      throw new Error('DumplingAI API key is required');
    }

    try {
      const response = await fetch(`${dumplingApiUrl}/get-youtube-transcript`, {
        method: 'POST',
        headers: {
          ...this.defaultHeaders,
          'Authorization': `Bearer ${dumplingApiKey}`
        },
        body: JSON.stringify({
          videoUrl: videoUrl,
          includeTimestamps: false,
          timestampsToCombine: 5
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`YouTube transcript API request failed: ${errorBody}`);
      }

      const data = await response.json();
      return {
        success: true,
        transcript: data.transcript || '',
        videoInfo: data.videoInfo || null
      };

    } catch (error) {
      console.error('YouTube Transcript API Error:', error);
      return { success: false, error: error.message };
    }
  }

  async validateSettings() {
    const errors = [];

    // Validate base URL
    if (!this.settings.baseUrl) {
      errors.push('Base URL is required');
    } else {
      try {
        new URL(this.settings.baseUrl);
      } catch (error) {
        errors.push('Base URL is not a valid URL');
      }
    }

    // Validate API key
    if (!this.settings.apiKey) {
      errors.push('API key is required');
    }

    // Validate model name
    if (!this.settings.modelName) {
      errors.push('Model name is required');
    }

    // Validate system prompt
    if (!this.settings.systemPrompt) {
      errors.push('System prompt is required');
    }

    // Validate numeric settings
    if (this.settings.sidebarWidth) {
      const width = parseInt(this.settings.sidebarWidth);
      if (isNaN(width) || width < 300 || width > 800) {
        errors.push('Sidebar width must be between 300 and 800 pixels');
      }
    }

    if (this.settings.fontSize) {
      const fontSize = parseInt(this.settings.fontSize);
      if (isNaN(fontSize) || fontSize < 10 || fontSize > 24) {
        errors.push('Font size must be between 10 and 24 pixels');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  // Helper method to sanitize URLs
  sanitizeUrl(url) {
    try {
      const parsed = new URL(url);
      
      // Only allow http and https protocols
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
      
      // Prevent javascript: protocol
      if (parsed.protocol === 'javascript:') {
        throw new Error('JavaScript protocol not allowed');
      }
      
      return url;
    } catch (error) {
      throw new Error('Invalid URL');
    }
  }

  // Helper method to escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper method to create error responses
  createErrorResponse(message, technicalDetails = null) {
    const error = {
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    };

    if (technicalDetails) {
      error.technical = technicalDetails;
    }

    return error;
  }

  // Helper method to create success responses
  createSuccessResponse(data, message = null) {
    const response = {
      success: true,
      data: data,
      timestamp: new Date().toISOString()
    };

    if (message) {
      response.message = message;
    }

    return response;
  }
}

// Factory function to create API client
export function createAPIClient(settings) {
  return new APIClient(settings);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { APIClient, createAPIClient };
}

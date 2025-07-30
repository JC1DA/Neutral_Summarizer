// Content extraction utility for Neutral Summarizer extension
class ContentExtractor {
  constructor() {
    this.defaultOptions = {
      maxContentLength: 8000,
      preserveImages: false,
      preserveLinks: false,
      preserveStructure: true,
      removeSelectors: [
        'script', 'style', 'noscript', 'iframe', 'nav', 'header', 'footer',
        '.advertisement', '.ads', '.sidebar', '.menu', '.navigation', '.toolbar',
        '.social-share', '.comments', '.related', '.recommendations', '.popup',
        '.modal', '.banner', '.cookie-notice', '.newsletter', '.subscription'
      ],
      contentSelectors: [
        'article', 'main', '[role="main"]', '.content', '.main-content',
        '.article-content', '.post-content', '.entry-content'
      ]
    };
  }

  extractPageContent(options = {}) {
    const finalOptions = { ...this.defaultOptions, ...options };
    
    try {
      const content = this.extractContent(finalOptions);
      const cleanedContent = this.cleanContent(content, finalOptions);
      const limitedContent = this.limitContentLength(cleanedContent, finalOptions.maxContentLength);
      
      return {
        success: true,
        title: this.extractTitle(),
        url: window.location.href,
        content: limitedContent,
        metadata: this.extractMetadata(),
        wordCount: this.countWords(limitedContent),
        estimatedReadingTime: this.calculateReadingTime(limitedContent)
      };
    } catch (error) {
      console.error('Content extraction error:', error);
      return {
        success: false,
        error: error.message,
        title: document.title,
        url: window.location.href,
        content: '',
        metadata: {},
        wordCount: 0,
        estimatedReadingTime: 0
      };
    }
  }

  extractContent(options) {
    // Try to find main content area first
    const mainContent = this.findMainContent(options.contentSelectors);
    
    if (mainContent) {
      return this.extractFromElement(mainContent, options);
    }
    
    // Fallback to body content
    return this.extractFromBody(options);
  }

  findMainContent(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && this.hasSignificantContent(element)) {
        return element;
      }
    }
    return null;
  }

  hasSignificantContent(element) {
    const text = element.textContent || '';
    const cleanText = text.replace(/\s+/g, ' ').trim();
    return cleanText.length > 100; // Minimum content threshold
  }

  extractFromElement(element, options) {
    const clone = element.cloneNode(true);
    
    // Remove unwanted elements
    options.removeSelectors.forEach(selector => {
      const elements = clone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // Extract text content
    return this.getTextContent(clone, options);
  }

  extractFromBody(options) {
    const body = document.body.cloneNode(true);
    
    // Remove unwanted elements
    options.removeSelectors.forEach(selector => {
      const elements = body.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // Remove header, footer, nav if they still exist
    const structuralElements = body.querySelectorAll('header, footer, nav, aside');
    structuralElements.forEach(el => el.remove());
    
    return this.getTextContent(body, options);
  }

  getTextContent(element, options) {
    if (options.preserveStructure) {
      return this.extractStructuredText(element, options);
    } else {
      return element.textContent || element.innerText || '';
    }
  }

  extractStructuredText(element, options) {
    let text = '';
    
    const processNode = (node) => {
      switch (node.nodeType) {
        case Node.TEXT_NODE:
          const content = node.textContent.trim();
          if (content) {
            text += content + ' ';
          }
          break;
          
        case Node.ELEMENT_NODE:
          const tagName = node.tagName.toLowerCase();
          
          // Skip certain elements
          if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) {
            return;
          }
          
          // Handle block elements
          if (this.isBlockElement(tagName)) {
            text += '\n';
          }
          
          // Process children
          Array.from(node.childNodes).forEach(processNode);
          
          // Add spacing after block elements
          if (this.isBlockElement(tagName)) {
            text += '\n';
          }
          
          break;
      }
    };
    
    processNode(element);
    return text;
  }

  isBlockElement(tagName) {
    const blockElements = [
      'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'table',
      'tr', 'td', 'th', 'section', 'article', 'main'
    ];
    return blockElements.includes(tagName);
  }

  cleanContent(content, options) {
    let cleaned = content;
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/\n\s*\n/g, '\n\n');
    cleaned = cleaned.replace(/^\s+|\s+$/g, '');
    
    // Remove common boilerplate text
    cleaned = this.removeBoilerplate(cleaned);
    
    // Remove HTML entities and decode
    cleaned = this.decodeHTMLEntities(cleaned);
    
    return cleaned;
  }

  removeBoilerplate(text) {
    const boilerplatePatterns = [
      /click here for more information/gi,
      /read more/gi,
      /continue reading/gi,
      /advertisement/gi,
      /sponsored content/gi,
      /cookie policy/gi,
      /terms of service/gi,
      /privacy policy/gi,
      /all rights reserved/gi,
      /copyright ©/gi,
      /skip to main content/gi,
      /back to top/gi
    ];
    
    let cleaned = text;
    boilerplatePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    return cleaned;
  }

  decodeHTMLEntities(text) {
    const entities = {
      '&nbsp;': ' ',
      '&': '&',
      '<': '<',
      '>': '>',
      '"': '"',
      '&#39;': "'",
      '&rsquo;': "'",
      '&lsquo;': "'",
      '&rdquo;': '"',
      '&ldquo;': '"',
      '&ndash;': '–',
      '&mdash;': '—',
      '&hellip;': '...'
    };
    
    let decoded = text;
    Object.entries(entities).forEach(([entity, replacement]) => {
      decoded = decoded.replace(new RegExp(entity, 'g'), replacement);
    });
    
    return decoded;
  }

  limitContentLength(content, maxLength) {
    if (content.length <= maxLength) {
      return content;
    }
    
    // Try to cut at word boundary
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) { // Don't cut if it would remove too much content
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  extractTitle() {
    // Try multiple sources for title
    const titleSources = [
      () => document.querySelector('h1')?.textContent,
      () => document.querySelector('title')?.textContent,
      () => document.querySelector('[property="og:title"]')?.content,
      () => document.querySelector('[name="twitter:title"]')?.content
    ];
    
    for (const source of titleSources) {
      const title = source();
      if (title && title.trim()) {
        return title.trim();
      }
    }
    
    return document.title || 'Untitled Page';
  }

  extractMetadata() {
    const metadata = {
      description: '',
      author: '',
      publishDate: '',
      imageUrl: '',
      siteName: ''
    };
    
    // Description
    const descriptionSources = [
      () => document.querySelector('[name="description"]')?.content,
      () => document.querySelector('[property="og:description"]')?.content,
      () => document.querySelector('[name="twitter:description"]')?.content
    ];
    
    for (const source of descriptionSources) {
      const description = source();
      if (description && description.trim()) {
        metadata.description = description.trim();
        break;
      }
    }
    
    // Author
    const authorSources = [
      () => document.querySelector('[name="author"]')?.content,
      () => document.querySelector('[property="article:author"]')?.content,
      () => document.querySelector('.author')?.textContent,
      () => document.querySelector('.byline')?.textContent
    ];
    
    for (const source of authorSources) {
      const author = source();
      if (author && author.trim()) {
        metadata.author = author.trim();
        break;
      }
    }
    
    // Publish date
    const dateSources = [
      () => document.querySelector('[property="article:published_time"]')?.content,
      () => document.querySelector('[name="date"]')?.content,
      () => document.querySelector('time')?.getAttribute('datetime'),
      () => document.querySelector('.publish-date')?.textContent
    ];
    
    for (const source of dateSources) {
      const date = source();
      if (date && date.trim()) {
        metadata.publishDate = date.trim();
        break;
      }
    }
    
    // Image URL
    const imageSources = [
      () => document.querySelector('[property="og:image"]')?.content,
      () => document.querySelector('[name="twitter:image"]')?.content,
      () => document.querySelector('article img')?.src,
      () => document.querySelector('.featured-image img')?.src
    ];
    
    for (const source of imageSources) {
      const image = source();
      if (image && image.trim()) {
        metadata.imageUrl = image.trim();
        break;
      }
    }
    
    // Site name
    const siteNameSources = [
      () => document.querySelector('[property="og:site_name"]')?.content,
      () => document.querySelector('[name="application-name"]')?.content,
      () => document.querySelector('.site-name')?.textContent
    ];
    
    for (const source of siteNameSources) {
      const siteName = source();
      if (siteName && siteName.trim()) {
        metadata.siteName = siteName.trim();
        break;
      }
    }
    
    return metadata;
  }

  countWords(text) {
    if (!text) return 0;
    
    // Remove extra whitespace and split into words
    const words = text.trim().split(/\s+/);
    
    // Filter out empty strings
    return words.filter(word => word.length > 0).length;
  }

  calculateReadingTime(text, wordsPerMinute = 200) {
    const wordCount = this.countWords(text);
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    
    return Math.max(1, minutes); // Minimum 1 minute
  }

  // YouTube-specific content extraction
  isYouTubePage() {
    return window.location.hostname.includes('youtube.com') && 
           window.location.pathname.includes('/watch');
  }

  extractYouTubeContent() {
    if (!this.isYouTubePage()) {
      return {
        success: false,
        error: 'Not a YouTube video page'
      };
    }
    
    try {
      const videoData = {
        title: this.extractYouTubeTitle(),
        url: window.location.href,
        videoId: this.extractYouTubeVideoId(),
        author: this.extractYouTubeAuthor(),
        description: this.extractYouTubeDescription(),
        viewCount: this.extractYouTubeViewCount(),
        publishDate: this.extractYouTubePublishDate(),
        isYouTube: true
      };
      
      return {
        success: true,
        ...videoData,
        content: this.formatYouTubeContent(videoData)
      };
    } catch (error) {
      console.error('YouTube content extraction error:', error);
      return {
        success: false,
        error: error.message,
        isYouTube: true,
        url: window.location.href,
        title: document.title
      };
    }
  }

  extractYouTubeTitle() {
    const titleSources = [
      () => document.querySelector('h1.title')?.textContent,
      () => document.querySelector('[itemprop="name"]')?.textContent,
      () => document.querySelector('meta[property="og:title"]')?.content
    ];
    
    for (const source of titleSources) {
      const title = source();
      if (title && title.trim()) {
        return title.trim();
      }
    }
    
    return 'YouTube Video';
  }

  extractYouTubeVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v') || '';
  }

  extractYouTubeAuthor() {
    const authorSources = [
      () => document.querySelector('[itemprop="author"]')?.textContent,
      () => document.querySelector('.ytd-channel-name')?.textContent,
      () => document.querySelector('.channel-name')?.textContent
    ];
    
    for (const source of authorSources) {
      const author = source();
      if (author && author.trim()) {
        return author.trim();
      }
    }
    
    return 'Unknown Channel';
  }

  extractYouTubeDescription() {
    const descriptionSources = [
      () => document.querySelector('[itemprop="description"]')?.textContent,
      () => document.querySelector('meta[property="og:description"]')?.content,
      () => document.querySelector('#description')?.textContent
    ];
    
    for (const source of descriptionSources) {
      const description = source();
      if (description && description.trim()) {
        return description.trim();
      }
    }
    
    return '';
  }

  extractYouTubeViewCount() {
    const viewCountSources = [
      () => document.querySelector('[itemprop="interactionCount"]')?.content,
      () => document.querySelector('.view-count')?.textContent,
      () => document.querySelector('.ytd-view-count-renderer')?.textContent
    ];
    
    for (const source of viewCountSources) {
      const count = source();
      if (count && count.trim()) {
        return count.trim();
      }
    }
    
    return '';
  }

  extractYouTubePublishDate() {
    const dateSources = [
      () => document.querySelector('[itemprop="datePublished"]')?.content,
      () => document.querySelector('meta[itemprop="datePublished"]')?.content,
      () => document.querySelector('.date')?.textContent
    ];
    
    for (const source of dateSources) {
      const date = source();
      if (date && date.trim()) {
        return date.trim();
      }
    }
    
    return '';
  }

  formatYouTubeContent(videoData) {
    let content = `YouTube Video: ${videoData.title}\n`;
    content += `Channel: ${videoData.author}\n`;
    content += `URL: ${videoData.url}\n`;
    
    if (videoData.viewCount) {
      content += `Views: ${videoData.viewCount}\n`;
    }
    
    if (videoData.publishDate) {
      content += `Published: ${videoData.publishDate}\n`;
    }
    
    if (videoData.description) {
      content += `\nDescription:\n${videoData.description}\n`;
    }
    
    return content;
  }
}

// Factory function to create content extractor
export function createContentExtractor() {
  return new ContentExtractor();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ContentExtractor, createContentExtractor };
}

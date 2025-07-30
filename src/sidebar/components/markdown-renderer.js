// Markdown renderer component for Neutral Summarizer extension
class MarkdownRenderer {
  constructor() {
    this.marked = null;
    this.init();
  }

  init() {
    this.loadMarkedLibrary();
  }

  async loadMarkedLibrary() {
    try {
      // Try to load marked from extension assets
      const markedScript = document.createElement('script');
      markedScript.src = chrome.runtime.getURL('assets/lib/marked.min.js');
      markedScript.onload = () => {
        this.marked = window.marked;
        this.setupMarkedOptions();
      };
      document.head.appendChild(markedScript);
    } catch (error) {
      console.error('Error loading marked library:', error);
      // Fallback to simple renderer
      this.createSimpleRenderer();
    }
  }

  setupMarkedOptions() {
    if (this.marked) {
      // Configure marked options for security and compatibility
      this.marked.setOptions({
        breaks: true,        // Add line breaks
        gfm: true,          // GitHub Flavored Markdown
        headerIds: false,   // Don't generate header IDs for security
        mangle: false,      // Don't mangle email addresses
        sanitize: false,    // Don't sanitize (we handle it ourselves)
        smartLists: true,   // Use smarter list behavior
        smartypants: true,  // Use smart typography
        xhtml: false        // Don't output XHTML
      });

      // Custom renderer for better security and styling
      const renderer = new this.marked.Renderer();
      
      // Custom link renderer for security
      renderer.link = (href, title, text) => {
        const safeHref = this.sanitizeUrl(href);
        const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : '';
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
      };
      
      // Custom image renderer for security
      renderer.image = (href, title, text) => {
        const safeHref = this.sanitizeUrl(href);
        const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : '';
        return `<img src="${safeHref}" alt="${this.escapeHtml(text)}"${titleAttr} style="max-width: 100%; height: auto;">`;
      };
      
      // Custom code block renderer with syntax highlighting placeholder
      renderer.code = (code, language) => {
        const escapedCode = this.escapeHtml(code);
        const langAttr = language ? ` class="language-${this.escapeHtml(language)}"` : '';
        return `<pre><code${langAttr}>${escapedCode}</code></pre>`;
      };
      
      // Custom inline code renderer
      renderer.codespan = (code) => {
        return `<code>${this.escapeHtml(code)}</code>`;
      };
      
      // Custom heading renderer with anchor links
      renderer.heading = (text, level) => {
        const escapedText = this.escapeHtml(text);
        const anchor = this.createAnchor(text);
        return `<h${level} id="${anchor}">${escapedText}</h${level}>`;
      };
      
      // Custom table renderer with proper styling
      renderer.table = (header, body) => {
        return `<table class="neutral-summarizer-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>`;
      };
      
      // Custom table cell renderer
      renderer.tablecell = (content, flags) => {
        const type = flags.header ? 'th' : 'td';
        const align = flags.align ? ` style="text-align: ${flags.align}"` : '';
        return `<${type}${align}>${content}</${type}>`;
      };
      
      this.marked.setOptions({ renderer });
    }
  }

  createSimpleRenderer() {
    // Fallback simple renderer if marked.js fails to load
    this.marked = {
      parse: (text) => {
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

  render(markdown) {
    if (!this.marked) {
      // If marked is not loaded yet, return plain text
      return this.escapeHtml(markdown);
    }

    try {
      let html = this.marked.parse(markdown);
      
      // Post-process HTML for better styling
      html = this.postProcessHtml(html);
      
      return html;
    } catch (error) {
      console.error('Error rendering markdown:', error);
      return this.escapeHtml(markdown);
    }
  }

  postProcessHtml(html) {
    // Add CSS classes for styling
    html = html.replace(/<h([1-6])>/g, '<h$1 class="neutral-summarizer-heading">');
    html = html.replace(/<pre>/g, '<pre class="neutral-summarizer-pre">');
    html = html.replace(/<code>/g, '<code class="neutral-summarizer-code">');
    html = html.replace(/<blockquote>/g, '<blockquote class="neutral-summarizer-blockquote">');
    html = html.replace(/<ul>/g, '<ul class="neutral-summarizer-list">');
    html = html.replace(/<ol>/g, '<ol class="neutral-summarizer-list">');
    html = html.replace(/<li>/g, '<li class="neutral-summarizer-list-item">');
    html = html.replace(/<p>/g, '<p class="neutral-summarizer-paragraph">');
    html = html.replace(/<a /g, '<a class="neutral-summarizer-link" ');
    html = html.replace(/<img /g, '<img class="neutral-summarizer-image" ');
    
    return html;
  }

  sanitizeUrl(url) {
    try {
      // Basic URL sanitization
      const parsed = new URL(url);
      
      // Only allow http and https protocols
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '#';
      }
      
      // Prevent javascript: protocol
      if (parsed.protocol === 'javascript:') {
        return '#';
      }
      
      return url;
    } catch (error) {
      // If URL parsing fails, return #
      return '#';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  createAnchor(text) {
    // Create a simple anchor from heading text
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Add CSS styles for markdown elements
  addStyles() {
    const styleId = 'neutral-summarizer-markdown-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    const styles = `
      .neutral-summarizer-heading {
        color: #1f2937;
        margin: 16px 0 8px 0;
        font-weight: 600;
        line-height: 1.3;
      }
      
      .neutral-summarizer-heading h1 {
        font-size: 1.5em;
        border-bottom: 2px solid #e5e7eb;
        padding-bottom: 4px;
      }
      
      .neutral-summarizer-heading h2 {
        font-size: 1.3em;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 2px;
      }
      
      .neutral-summarizer-heading h3 {
        font-size: 1.1em;
      }
      
      .neutral-summarizer-paragraph {
        margin: 8px 0;
        line-height: 1.5;
        color: #374151;
      }
      
      .neutral-summarizer-list {
        margin: 8px 0;
        padding-left: 20px;
        color: #374151;
      }
      
      .neutral-summarizer-list-item {
        margin: 4px 0;
        line-height: 1.4;
      }
      
      .neutral-summarizer-code {
        background: #f3f4f6;
        color: #1f2937;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9em;
      }
      
      .neutral-summarizer-pre {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 12px;
        margin: 12px 0;
        overflow-x: auto;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9em;
        line-height: 1.4;
      }
      
      .neutral-summarizer-pre code {
        background: none;
        padding: 0;
        border: none;
        border-radius: 0;
      }
      
      .neutral-summarizer-blockquote {
        background: #f9fafb;
        border-left: 4px solid #3b82f6;
        margin: 12px 0;
        padding: 8px 16px;
        color: #6b7280;
        font-style: italic;
      }
      
      .neutral-summarizer-link {
        color: #3b82f6;
        text-decoration: underline;
      }
      
      .neutral-summarizer-link:hover {
        color: #2563eb;
      }
      
      .neutral-summarizer-image {
        max-width: 100%;
        height: auto;
        border-radius: 6px;
        margin: 8px 0;
      }
      
      .neutral-summarizer-table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
        background: white;
        border-radius: 6px;
        overflow: hidden;
      }
      
      .neutral-summarizer-table th,
      .neutral-summarizer-table td {
        border: 1px solid #e5e7eb;
        padding: 8px 12px;
        text-align: left;
      }
      
      .neutral-summarizer-table th {
        background: #f9fafb;
        font-weight: 600;
        color: #1f2937;
      }
      
      .neutral-summarizer-table tr:nth-child(even) {
        background: #f9fafb;
      }
      
      .neutral-summarizer-table tr:hover {
        background: #f3f4f6;
      }
      
      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .neutral-summarizer-heading {
          color: #f9fafb;
        }
        
        .neutral-summarizer-paragraph {
          color: #e5e7eb;
        }
        
        .neutral-summarizer-list {
          color: #e5e7eb;
        }
        
        .neutral-summarizer-code {
          background: #374151;
          color: #f9fafb;
        }
        
        .neutral-summarizer-pre {
          background: #1f2937;
          border-color: #374151;
          color: #f9fafb;
        }
        
        .neutral-summarizer-blockquote {
          background: #374151;
          border-left-color: #60a5fa;
          color: #9ca3af;
        }
        
        .neutral-summarizer-link {
          color: #60a5fa;
        }
        
        .neutral-summarizer-link:hover {
          color: #93c5fd;
        }
        
        .neutral-summarizer-table th,
        .neutral-summarizer-table td {
          border-color: #374151;
        }
        
        .neutral-summarizer-table th {
          background: #374151;
          color: #f9fafb;
        }
        
        .neutral-summarizer-table tr:nth-child(even) {
          background: #1f2937;
        }
        
        .neutral-summarizer-table tr:hover {
          background: #374151;
        }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
}

// Auto-initialize and add styles when script loads
document.addEventListener('DOMContentLoaded', () => {
  const renderer = new MarkdownRenderer();
  renderer.addStyles();
  
  // Make it available globally for other components
  window.neutralSummarizerMarkdownRenderer = renderer;
});

// Also initialize immediately if DOM is already loaded
if (document.readyState !== 'loading') {
  const renderer = new MarkdownRenderer();
  renderer.addStyles();
  window.neutralSummarizerMarkdownRenderer = renderer;
}

// PDF handler utility for Neutral Summarizer extension
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

  // Convert PDF to Markdown using the PDF2Markdown API
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

      // Download the PDF first
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to download PDF: ${pdfResponse.status} - ${pdfResponse.statusText}`);
      }

      const pdfBlob = await pdfResponse.blob();
      
      // Create FormData for the API request
      const formData = new FormData();
      formData.append('file', pdfBlob, 'document.pdf');

      // Call the PDF2Markdown API
      const response = await fetch(pdf2markdownUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`PDF conversion failed: ${response.status} - ${response.statusText}`);
      }

      const resultText = await response.text();
      
      // Parse the JSON response
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (parseError) {
        // If it's not JSON, treat the whole response as markdown
        result = {
          results: [{
            markdown: resultText
          }]
        };
      }

      // Cache the result
      this.pdfCache.set(cacheKey, {
        result: result,
        timestamp: Date.now()
      });

      // Return the markdown content
      return result.results && result.results[0] && result.results[0].markdown 
        ? result.results[0].markdown 
        : resultText;

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

// Factory function to create PDF handler
export function createPDFHandler() {
  return new PDFHandler();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PDFHandler, createPDFHandler };
}

// YouTube detector utility for Neutral Summarizer extension
class YouTubeDetector {
  constructor() {
    this.youtubePatterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/
    ];
    
    this.mobilePatterns = [
      /^https?:\/\/m\.youtube\.com\/watch\?v=[\w-]+/
    ];
    
    this.tvPatterns = [
      /^https?:\/\/(www\.)?youtube\.com\/tv\/watch\?v=[\w-]+/
    ];
  }

  // Check if current page is a YouTube video page
  isYouTubeVideoPage() {
    const url = window.location.href;
    return this.isYouTubeVideoURL(url);
  }

  // Check if a URL is a YouTube video URL
  isYouTubeVideoURL(url) {
    if (typeof url !== 'string') {
      return false;
    }

    // Combine all patterns
    const allPatterns = [
      ...this.youtubePatterns,
      ...this.mobilePatterns,
      ...this.tvPatterns
    ];

    return allPatterns.some(pattern => pattern.test(url));
  }

  // Check if current page is any YouTube page (including channel, playlist, etc.)
  isYouTubePage() {
    const hostname = window.location.hostname;
    return hostname.includes('youtube.com') || hostname.includes('youtu.be');
  }

  // Extract video ID from current page
  getVideoId() {
    return this.extractVideoId(window.location.href);
  }

  // Extract video ID from URL
  extractVideoId(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // Try different URL patterns
    const patterns = [
      // Standard watch URL
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([\w-]{11})/,
      // Mobile URL
      /(?:m\.youtube\.com\/watch\?v=)([\w-]{11})/,
      // TV URL
      /(?:youtube\.com\/tv\/watch\?v=)([\w-]{11})/,
      // Direct v parameter
      /[?&]v=([\w-]{11})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  // Get video information from current page
  getVideoInfo() {
    if (!this.isYouTubeVideoPage()) {
      return {
        success: false,
        error: 'Not a YouTube video page'
      };
    }

    try {
      const videoId = this.getVideoId();
      if (!videoId) {
        return {
          success: false,
          error: 'Could not extract video ID'
        };
      }

      const info = {
        videoId: videoId,
        title: this.extractTitle(),
        author: this.extractAuthor(),
        description: this.extractDescription(),
        thumbnailUrl: this.extractThumbnailUrl(videoId),
        duration: this.extractDuration(),
        viewCount: this.extractViewCount(),
        likeCount: this.extractLikeCount(),
        publishDate: this.extractPublishDate(),
        url: window.location.href,
        isLive: this.isLiveVideo(),
        isPremiere: this.isPremiereVideo()
      };

      return {
        success: true,
        info: info
      };
    } catch (error) {
      console.error('Error extracting YouTube video info:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Extract video title
  extractTitle() {
    const selectors = [
      'h1.title',
      'h1.yt-formatted-string',
      '[itemprop="name"]',
      'meta[property="og:title"]',
      'meta[name="title"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const title = selector.includes('meta') ? element.content : element.textContent;
        if (title && title.trim()) {
          return title.trim();
        }
      }
    }

    return document.title.replace(' - YouTube', '').trim() || 'YouTube Video';
  }

  // Extract channel/author name
  extractAuthor() {
    const selectors = [
      '[itemprop="author"]',
      '.ytd-channel-name',
      '.channel-name',
      '.yt-channel-name',
      'a.yt-simple-endpoint[href*="/channel/"]',
      'a.yt-simple-endpoint[href*="/user/"]',
      'span.yt-formatted-string[aria-label*="channel"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const author = element.textContent || element.getAttribute('aria-label');
        if (author && author.trim()) {
          return author.trim();
        }
      }
    }

    return 'Unknown Channel';
  }

  // Extract video description
  extractDescription() {
    const selectors = [
      '[itemprop="description"]',
      '#description',
      '#description-text',
      '.ytd-expandable-video-description-body',
      'meta[property="og:description"]',
      'meta[name="description"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const description = selector.includes('meta') ? element.content : element.textContent;
        if (description && description.trim()) {
          return description.trim();
        }
      }
    }

    return '';
  }

  // Extract thumbnail URL
  extractThumbnailUrl(videoId) {
    if (!videoId) {
      return '';
    }

    // Try to find thumbnail in the page
    const selectors = [
      'meta[property="og:image"]',
      'link[rel="image_src"]',
      '.ytd-thumbnail img'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const thumbnailUrl = selector.includes('meta') ? element.content : element.src;
        if (thumbnailUrl && thumbnailUrl.trim()) {
          return thumbnailUrl.trim();
        }
      }
    }

    // Fallback to YouTube's default thumbnail URLs
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }

  // Extract video duration
  extractDuration() {
    const selectors = [
      'meta[itemprop="duration"]',
      '.ytd-time-status-renderer',
      '.ytd-thumbnail-overlay-time-status-renderer',
      'span.ytd-thumbnail-overlay-time-status-renderer'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const duration = selector.includes('meta') ? element.content : element.textContent;
        if (duration && duration.trim()) {
          return duration.trim();
        }
      }
    }

    return '';
  }

  // Extract view count
  extractViewCount() {
    const selectors = [
      '[itemprop="interactionCount"]',
      '.view-count',
      '.ytd-view-count-renderer',
      '.ytd-video-view-count-renderer',
      'span.yt-view-count-renderer'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const viewCount = selector.includes('meta') ? element.content : element.textContent;
        if (viewCount && viewCount.trim()) {
          return viewCount.trim();
        }
      }
    }

    return '';
  }

  // Extract like count
  extractLikeCount() {
    const selectors = [
      '.ytd-menu-renderer button[aria-label*="like"]',
      '.ytd-segmented-like-dislike-button-renderer #segmented-like-button button',
      'button[aria-label*="like"]',
      '.like-button-renderer-like-button'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const likeText = element.getAttribute('aria-label') || element.textContent;
        if (likeText && likeText.trim()) {
          // Extract numbers from the text
          const match = likeText.match(/[\d,]+/);
          if (match) {
            return match[0];
          }
        }
      }
    }

    return '';
  }

  // Extract publish date
  extractPublishDate() {
    const selectors = [
      'meta[itemprop="datePublished"]',
      'time[itemprop="datePublished"]',
      '.ytd-video-primary-info-renderer .ytd-date-time-renderer',
      '.date-time',
      '.publish-date'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const date = selector.includes('meta') ? element.content : 
                     element.getAttribute('datetime') || 
                     element.textContent;
        if (date && date.trim()) {
          return date.trim();
        }
      }
    }

    return '';
  }

  // Check if video is live
  isLiveVideo() {
    const liveIndicators = [
      '.ytd-badge-supported-renderer.badge-style-type-live-now-alternate',
      '.ytd-live-badge-renderer',
      '.badge-style-type-live-now',
      '[aria-label*="live"]',
      '.ytd-thumbnail-overlay-time-status-renderer[aria-label*="LIVE"]'
    ];

    return liveIndicators.some(selector => {
      const element = document.querySelector(selector);
      return element !== null;
    });
  }

  // Check if video is a premiere
  isPremiereVideo() {
    const premiereIndicators = [
      '.ytd-premiere-badge-renderer',
      '.badge-style-type-premiere',
      '[aria-label*="premiere"]',
      '.ytd-thumbnail-overlay-time-status-renderer[aria-label*="PREMIERE"]'
    ];

    return premiereIndicators.some(selector => {
      const element = document.querySelector(selector);
      return element !== null;
    });
  }

  // Get available captions/languages for the video
  getAvailableCaptions() {
    const selectors = [
      '.ytd-menu-renderer button[aria-label*="captions"]',
      '.ytd-menu-renderer button[aria-label*="subtitles"]',
      '.captions-text',
      '.subtitles-text'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return {
          available: true,
          element: element
        };
      }
    }

    return {
      available: false,
      element: null
    };
  }

  // Check if captions are available for the video
  hasCaptions() {
    const captionsInfo = this.getAvailableCaptions();
    return captionsInfo.available;
  }

  // Get video quality options
  getVideoQualities() {
    // This is a simplified version - in practice, YouTube doesn't expose this easily
    // through the DOM without user interaction
    return {
      available: false,
      qualities: []
    };
  }

  // Normalize YouTube URL to standard format
  normalizeURL(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      return null;
    }

    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  // Get embed URL for the video
  getEmbedURL(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      return null;
    }

    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Get short URL for the video
  getShortURL(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      return null;
    }

    return `https://youtu.be/${videoId}`;
  }

  // Validate YouTube URL
  validateYouTubeURL(url) {
    if (!url || typeof url !== 'string') {
      return {
        valid: false,
        error: 'URL is required'
      };
    }

    const videoId = this.extractVideoId(url);
    if (!videoId) {
      return {
        valid: false,
        error: 'Invalid YouTube URL or video ID not found'
      };
    }

    // YouTube video IDs are typically 11 characters
    if (videoId.length !== 11) {
      return {
        valid: false,
        error: 'Invalid YouTube video ID'
      };
    }

    // Video ID should only contain specific characters
    if (!/^[\w-]+$/.test(videoId)) {
      return {
        valid: false,
        error: 'Invalid YouTube video ID format'
      };
    }

    return {
      valid: true,
      videoId: videoId,
      normalizedUrl: this.normalizeURL(url),
      embedUrl: this.getEmbedURL(url),
      shortUrl: this.getShortURL(url)
    };
  }

  // Check if the page has enough content for summarization
  hasSufficientContent() {
    if (!this.isYouTubeVideoPage()) {
      return false;
    }

    // Check if we have at least a title
    const title = this.extractTitle();
    if (!title || title.length < 5) {
      return false;
    }

    // Check if we have a description or transcript would be available
    const description = this.extractDescription();
    const hasCaptions = this.hasCaptions();

    return hasCaptions || description.length > 50;
  }

  // Get video metadata for API calls
  getVideoMetadata() {
    const info = this.getVideoInfo();
    
    if (!info.success) {
      return {
        success: false,
        error: info.error
      };
    }

    return {
      success: true,
      metadata: {
        id: info.info.videoId,
        title: info.info.title,
        author: info.info.author,
        description: info.info.description,
        url: info.info.url,
        thumbnail: info.info.thumbnailUrl,
        duration: info.info.duration,
        views: info.info.viewCount,
        likes: info.info.likeCount,
        published: info.info.publishDate,
        isLive: info.info.isLive,
        isPremiere: info.info.isPremiere,
        hasCaptions: this.hasCaptions(),
        hasSufficientContent: this.hasSufficientContent()
      }
    };
  }
}

// Factory function to create YouTube detector
export function createYouTubeDetector() {
  return new YouTubeDetector();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { YouTubeDetector, createYouTubeDetector };
}

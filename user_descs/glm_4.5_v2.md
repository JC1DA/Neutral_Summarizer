# Neutral Summarizer Chrome Extension - Requirements v2.0

## Overview
A professional Chrome extension that provides intelligent web page summarization and interactive AI chat capabilities through an elegant sidebar interface. The extension leverages modern AI technologies to deliver real-time streaming responses with specialized YouTube video analysis using transcript-based AI processing.

## Architecture Requirements

### 0. Source Code Structure
- **Source Directory**: All source code must be organized in `src` directory
- **Code Quality**: Must be well-organized, clean, and readable for junior developers
- **File Organization**: Logical separation of concerns across multiple files
- **Manifest**: Use Chrome Extension Manifest v3
- **No Build Dependencies**: Pure vanilla JavaScript implementation

## Core Extension Requirements

### 1. Sidebar Interface Architecture
- **Immediate Activation**: Sidebar opens instantly when clicking extension icon
- **No Secondary Popups**: Direct sidebar access without intermediate popups
- **Slide Animation**: Smooth expand/collapse from right side of webpage
- **Header Section**: Contains extension title and close button (✕) in top-right corner
- **Tabbed Navigation**: Two main tabs - "Content" (chat) and "Settings"
- **Multiple Close Methods**: Close via close button, extension icon click, or overlay click
- **Overlay Background**: Semi-transparent overlay with blur effect when sidebar is open
- **Responsive Width**: Sidebar width adjustable via settings

### 2. Settings Tab Configuration
The settings tab must provide comprehensive configuration options organized in sections:

#### 2.1 API Configuration Section
- **Base OpenAI Compatible URL**: API endpoint configuration (default: https://openrouter.ai/api/v1)
- **API Key**: Primary authentication key for AI services
- **DumplingAI API Key**: Specialized authentication key for YouTube transcript service

#### 2.2 Model Configuration Section
- **Model Name**: AI model selection (default: qwen/qwen3-235b-a22b-2507)
- **Temperature Control**: Creativity/randomness slider (range: 0.0-2.0, default: 0.3, step: 0.1)
  - Real-time value display
  - Descriptive help text explaining temperature effects
  - Visual temperature indicator with 🌡️ icon
- **System Prompt**: Configurable AI instructions with multi-line textarea
  - Default prompt provided for web page summarization
  - Markdown formatting support in prompt

#### 2.3 Appearance Section
- **Sidebar Width**: Adjustable slider (300-800px, default: 400px)
  - Real-time width value display
  - Visual width indicator with 📏 icon
- **Font Size**: Adjustable slider (10-24px, default: 14px)
  - Real-time font size value display
  - Visual font size indicator with 🔤 icon
  - CSS custom property integration for consistent font sizing

#### 2.4 Settings Management
- **Save Button**: Prominent button to persist all settings
- **Visual Feedback**: Success confirmation with color change and text update
- **Settings Persistence**: All settings saved across browser sessions
- **Form Validation**: Input validation before saving
- **Real-time Updates**: Settings apply immediately when changed

### 3. Content Tab (Chat Interface)
The content tab must provide a professional chat experience:

#### 3.1 Action Buttons
- **Two Primary Actions**: "Summarize Page" and "Clear Chat" buttons
  - Equal sizing and horizontal alignment
  - Icon integration (📄 for summarize, 🗑️ for clear)
  - Hover effects and visual feedback
  - Gradient backgrounds for visual appeal

#### 3.2 Chat Display Area
- **Message Container**: Scrollable area for conversation history
  - Custom scrollbar styling
  - Smooth scrolling to latest messages
  - Flexbox layout for proper message alignment
- **Message Types**: Clear distinction between user and AI messages
  - User messages: Right-aligned with blue background
  - AI messages: Left-aligned with gray background
  - Error messages: Red background with clear error indicators
  - Loading messages: Italic text with loading indicators

#### 3.3 Streaming Responses
- **Real-time Streaming**: Word-by-word response generation
  - Server-Sent Events (SSE) implementation
  - Blinking cursor indicator during streaming
  - Smooth text appearance with fade-in animations
  - Auto-scroll following streaming content

#### 3.4 Input Area
- **Chat Input**: Multi-line textarea with proper styling
  - Expandable height (44px min, 120px max)
  - Focus effects with border highlighting
  - Enter key support for message submission (Shift+Enter for new line)
- **Send Button**: Styled submit button with icon (📤)
  - Gradient background with hover effects
  - Disabled state during API calls
  - Visual feedback on interaction

### 4. Advanced Features Requirements

#### 4.1 YouTube Video Analysis
- **Automatic Detection**: Instant recognition of YouTube video pages
- **Two-Stage Loading Process**:
  - Stage 1: "Retrieving Video Transcript..." while calling DumplingAI API
  - Stage 2: "Analyzing page content..." after transcript retrieval
- **Transcript Integration**: Full video transcript incorporation into analysis
- **Video Metadata**: Title, channel, views, likes, description, and comments integration
- **Enhanced Summarization**: Transcript-based AI analysis for comprehensive video understanding

#### 4.2 Smart Chat Management
- **Automatic Chat Clearing**: "Summarize Page" automatically clears previous chat
- **Context Preservation**: Maintains conversation context for follow-up questions
- **Loading State Management**: Proper handling of loading messages and states
- **Error Resilience**: Graceful handling of API failures and network issues

#### 4.3 Content Processing
- **Intelligent Extraction**: Smart content extraction from various web page structures
- **Content Cleaning**: Removal of scripts, styles, and irrelevant elements
- **Metadata Extraction**: Author, publish date, description, and other metadata
- **Content Limitation**: Intelligent truncation for large content (16,000 character limit)
- **YouTube-Specific Extraction**: Specialized content extraction for video pages

### 5. Technical Implementation Requirements

#### 5.1 API Integration
- **Streaming API Calls**: Full Server-Sent Events (SSE) implementation
- **Multiple API Support**: OpenAI, OpenRouter, and other OpenAI-compatible APIs
- **Request Structure**: Proper API request formatting with all required parameters
- **Response Handling**: Real-time streaming response processing
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Temperature Integration**: User-configurable temperature parameter in all API calls

#### 5.2 Storage Management
- **Chrome Storage API**: Use chrome.storage.sync for settings persistence
- **Settings Structure**: Organized settings object with all configuration options
- **Default Values**: Sensible defaults for all configurable options
- **Settings Loading**: Multiple attempt loading with fallback mechanisms
- **Form Population**: Dynamic form population from saved settings

#### 5.3 Message Passing Architecture
- **Background Script**: Handles cross-origin API calls and YouTube transcript fetching
- **Content Script**: Manages UI, streaming, and user interactions
- **Popup Script**: Minimal popup implementation for extension icon
- **Message Types**: Well-defined message types for different operations
- **Error Propagation**: Proper error handling across message boundaries

#### 5.4 CSS Architecture
- **CSS Custom Properties**: Use of CSS variables for theming and consistency
- **Component-Based Styling**: Modular CSS organization
- **Responsive Design**: Fluid layouts with proper sizing
- **Animation System**: Smooth transitions and professional animations
- **Font Size Integration**: CSS custom property for dynamic font sizing

### 6. User Experience Requirements

#### 6.1 Visual Design
- **Modern Interface**: Clean, professional appearance with gradient accents
- **Consistent Theming**: Unified color scheme and styling throughout
- **Icon Integration**: Meaningful icons for all interactive elements
- **Hover Effects**: Smooth hover animations and visual feedback
- **Loading States**: Professional loading indicators and animations

#### 6.2 Interaction Design
- **Immediate Feedback**: Visual response to all user interactions
- **Smooth Animations**: Professional transitions for all UI changes
- **Keyboard Support**: Full keyboard navigation and shortcuts
- **Accessibility**: Screen reader compatibility and proper ARIA labels
- **Error Communication**: Clear, user-friendly error messages

#### 6.3 Performance Requirements
- **Fast Loading**: Quick sidebar opening and UI responsiveness
- **Efficient Streaming**: Real-time response streaming without lag
- **Memory Management**: Proper cleanup and memory management
- **Network Optimization**: Efficient API call handling and caching
- **Smooth Scrolling**: Optimized chat area scrolling

### 7. Advanced Technical Features

#### 7.1 Streaming Implementation
- **SSE Integration**: Full Server-Sent Events implementation
- **Chunk Processing**: Efficient processing of streaming data chunks
- **Buffer Management**: Proper buffer handling for incomplete data
- **Real-time Updates**: Immediate UI updates during streaming
- **Error Recovery**: Graceful handling of streaming interruptions

#### 7.2 YouTube Integration
- **Transcript API**: DumplingAI API integration for transcript retrieval
- **Background Processing**: Cross-origin API calls via background script
- **Video Metadata**: Comprehensive video information extraction
- **Transcript Analysis**: AI analysis of full video transcripts
- **Loading Feedback**: Clear loading states during transcript retrieval

#### 7.3 Settings System
- **Real-time Updates**: Immediate application of setting changes
- **Form Validation**: Input validation and error handling
- **Persistence**: Reliable settings storage and retrieval
- **UI Synchronization**: Consistent UI state with settings
- **Fallback Handling**: Graceful handling of missing or invalid settings

### 8. File Structure Requirements

#### 8.1 Core Files
- **manifest.json**: Chrome extension manifest (v3)
- **content.js**: Main content script with sidebar management
- **background.js**: Background service worker for API calls
- **popup.html/popup.js**: Extension popup interface

#### 8.2 Component Files
- **sidebar/components/chat-component.js**: Chat interface logic
- **sidebar/components/settings-component.js**: Settings management
- **sidebar/components/markdown-renderer.js**: Markdown formatting

#### 8.3 Utility Files
- **utils/api-client.js**: OpenAI/DumplingAI API clients
- **utils/content-extractor.js**: Web content extraction
- **utils/storage-manager.js**: Chrome storage utilities
- **utils/youtube-detector.js**: YouTube page detection

#### 8.4 Asset Files
- **assets/icons/**: Extension icons (16px, 48px, 128px)
- **assets/lib/**: External libraries (marked.min.js for markdown)

### 9. Chrome Extension Requirements

#### 9.1 Manifest Configuration
- **Manifest Version**: Must use Manifest v3
- **Permissions**: Minimum required permissions for functionality
- **Content Scripts**: Proper content script injection
- **Background Service**: Service worker configuration
- **Host Permissions**: API endpoint permissions

#### 9.2 Security Requirements
- **CORS Handling**: Proper cross-origin request handling
- **API Key Security**: Secure storage of API keys
- **Content Security**: Proper content security policies
- **Input Validation**: Client-side input validation
- **Error Handling**: Secure error message handling

#### 9.3 Browser Compatibility
- **Chrome Version**: Support for Chrome 88+ (Manifest v3 requirement)
- **Modern APIs**: Use of modern browser APIs (Streams, Fetch, etc.)
- **Fallback Support**: Graceful degradation for older browsers
- **Testing**: Cross-browser testing where applicable

### 10. Non-Requirements

#### 10.1 Excluded Features
- **No Separate Popup**: No additional popup windows beyond the sidebar
- **No Additional Permissions**: No unnecessary browser permissions
- **No External Dependencies**: No external build tools or frameworks
- **No Backend Services**: No external backend services required
- **No Analytics**: No user tracking or analytics collection

#### 10.2 Implementation Constraints
- **Vanilla JavaScript**: No frameworks or libraries beyond core utilities
- **No Build Process**: Direct browser-ready code
- **Minimal Dependencies**: Only essential external libraries (markdown parser)
- **No Server Components**: Client-side only implementation

## Implementation Notes

### Development Guidelines
- **Code Clarity**: Write clean, self-documenting code
- **Error Handling**: Implement comprehensive error handling
- **Performance**: Optimize for performance and memory usage
- **Maintainability**: Structure code for easy maintenance
- **Testing**: Include basic error scenarios and edge cases

### API Integration Notes
- **OpenAI Compatibility**: Ensure compatibility with OpenAI API specification
- **Streaming Support**: Full streaming response support required
- **Error Recovery**: Implement retry logic and fallback mechanisms
- **Rate Limiting**: Handle API rate limiting gracefully
- **Configuration**: Support for multiple API providers

### User Experience Notes
- **Intuitiveness**: Design for ease of use without instructions
- **Feedback**: Provide clear visual feedback for all actions
- **Accessibility**: Ensure accessibility for all users
- **Performance**: Maintain fast, responsive interface
- **Professionalism**: Deliver professional-grade user experience

## Quality Assurance

### Testing Requirements
- **Functionality Testing**: All features must work as specified
- **Error Testing**: All error scenarios must handle gracefully
- **Performance Testing**: Interface must remain responsive under load
- **Compatibility Testing**: Test across supported Chrome versions
- **Usability Testing**: Ensure intuitive user experience

### Documentation Requirements
- **Code Comments**: Well-documented code with clear comments
- **README Documentation**: Comprehensive user documentation
- **API Documentation**: Clear API integration documentation
- **Setup Instructions**: Easy-to-follow setup and usage instructions

---

This requirements document provides a comprehensive foundation for rebuilding the Neutral Summarizer Chrome Extension with all current features and implementations. The document is structured to be implementation-agnostic while providing sufficient detail for accurate reconstruction of all functionality.

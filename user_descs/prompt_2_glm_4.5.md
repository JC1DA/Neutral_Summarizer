# Neutral Summarizer Chrome Extension - Requirements

## Overview
A Chrome extension that allows users to summarize web pages and chat with an AI about the page content. All interactions happen through a sidebar that appears on the right side of the webpage.

## Core Requirements

### 1. Sidebar Interface
- The sidebar must open immediately when clicking the extension icon
- No popup should appear asking users to click again to open the sidebar
- The sidebar should expand from the right side of the current webpage
- The sidebar must have a header with a close button (✕) in the top-right corner
- The sidebar should contain two tabs: "Content" and "Settings"
- Users must be able to close the sidebar using the close button or by clicking the extension icon again

### 2. Settings Tab
The settings tab must allow users to configure:
- **Base OpenAI Compatible URL**: The API endpoint (default: https://openrouter.ai/api/v1)
- **API Key**: Authentication key for the AI service
- **DumplingAI API Key**: Authentication key for YouTube transcript service
- **Model Name**: The AI model to use (default: qwen/qwen3-235b-a22b-2507)
- **System Prompt**: Instructions for the AI (with a default prompt provided)
- **Sidebar Width**: Adjustable between 300-800 pixels (default: 400)
- **Font Size**: Adjustable between 10-24 pixels (default: 14)
- **Save Button**: To persist settings across browser sessions

### 3. Content Tab (Chat Interface)
The content tab must provide:
- **Two Action Buttons**: "Summarize Page" and "Clear Chat" buttons, equally sized and horizontally aligned
- **Summarize Function**: When clicked, it should generate a summary of the current web page content
- **Clear Function**: When clicked, it should remove all messages from the chat area
- **Chat Display Area**: Shows the conversation between user and AI
- **Markdown Support**: The chat area must properly display markdown formatting
- **Message Input Field**: Allows users to type questions about the page content
- **Send Button**: Submits user questions to the AI

### 4. Functionality Requirements
- **Streaming Responses**: All API calls must use streaming mode to show real-time updates as the AI generates responses
- **Summarization Feature**: Must use the system prompt configured in settings to summarize page content
- **Continued Conversation**: After initial summarization, users must be able to continue chatting with the AI about the page content
- **Message Distinction**: The extension must clearly show which messages are from the user vs. the AI
- **Settings Persistence**: All user settings must be saved and restored across browser sessions
- **Multiple Close Methods**: Sidebar can be closed using the close button, clicking the extension icon again, or clicking the overlay area

### 5. Technical Requirements
- **Chrome Extension**: Must be built as a Chrome extension using manifest version 3
- **Modern JavaScript**: Must use modern JavaScript with async/await for API calls
- **Error Handling**: Must implement proper error handling for API requests
- **Security Best Practices**: Must follow Chrome extension security best practices
- **Responsive Design**: Must work properly with the configurable sidebar width
- **Message Passing**: Must use proper message passing between background script, content script, and popup for sidebar management

### 6. User Experience Requirements
- **Immediate Feedback**: Users should see visual feedback when actions are performed
- **Loading States**: Should show loading indicators when waiting for AI responses
- **Error Messages**: Should display user-friendly error messages when things go wrong
- **Smooth Animations**: Sidebar should have smooth open/close animations
- **Intuitive Interface**: Should be easy to use without requiring instructions
- **Accessibility**: Should be usable with keyboard navigation and screen readers

### 7. Content Processing Requirements
- **Page Content Extraction**: Must be able to extract text content from web pages
- **Content Cleaning**: Should remove irrelevant elements like scripts and styles
- **Content Limits**: Should handle large pages by limiting content to prevent API issues
- **Context Preservation**: Must maintain page context throughout the conversation
- **URL Awareness**: Should be aware of the current page URL and title

### 8. Integration Requirements
- **OpenAI Compatibility**: Must work with OpenAI-compatible API endpoints
- **API Flexibility**: Should support different AI models and providers
- **Network Resilience**: Should handle network issues gracefully
- **Configuration Validation**: Should validate API settings before use
- **Connection Testing**: Should be able to test API connectivity

### 9. YouTube Video Summarization Feature
When visiting YouTube video pages, the extension provides special functionality:
- **Automatic Detection**: Automatically detects YouTube video pages
- **Transcription Button**: Adds a "Transcribe Video" button below the video title
- **Transcript Retrieval**: Retrieves video transcripts using the DumplingAI API
- **Video Summarization**: Summarizes video content using the configured AI model
- **Continued Chat**: Allows continued chat with the AI about the video content
- **API Key Requirement**: Requires DumplingAI API key configuration in Settings

## Non-Requirements
- Icons are not needed for the extension
- No separate popup window should be used
- No browser action popup should appear before opening the sidebar
- No additional browser permissions beyond what's necessary for core functionality

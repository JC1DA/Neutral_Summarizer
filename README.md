# Neutral Summarizer Chrome Extension

Neutral Summarizer is a Chrome extension that allows you to summarize web pages and chat with an AI about the content. The extension provides a sidebar interface that can be toggled on any webpage.

## Features

1. **Sidebar Interface**: Click the extension icon to open a sidebar on the right side of any webpage
2. **Two Tabs**:
   - **Content Tab**: Summarize the current page and chat with the AI about the content
   - **Settings Tab**: Configure the AI model settings
3. **AI Integration**: Uses OpenAI-compatible APIs for summarization and chat
4. **Persistent Settings**: Saves your API configuration for future use

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Configuration

In the Settings tab, you can configure:

- **Base OpenAI Compatible URL**: The API endpoint (default: https://api.openai.com/v1)
- **API Key**: Your API key for authentication
- **Model Name**: The AI model to use (default: gpt-3.5-turbo)
- **System Prompt**: Instructions for the AI on how to summarize content

## Usage

1. Click the Neutral Summarizer icon in your Chrome toolbar
2. Click "Open Sidebar" to inject the sidebar into the current page
3. Switch to the Content tab and click "Summarize Page" to get a summary
4. Use the chat interface to ask questions about the page content
5. Configure your API settings in the Settings tab

## Default System Prompt

The extension uses the following default system prompt for summarization:

"You are a helpful assistant that summarizes web pages. Please provide a concise summary of the content provided. Focus on the main points and key information. Keep your summary to 3-5 paragraphs."

You can customize this prompt in the Settings tab to change how the AI summarizes content.

## Supported APIs

The extension works with any OpenAI-compatible API, including:

- OpenAI
- Azure OpenAI
- Local AI models with OpenAI-compatible APIs

## Privacy

This extension does not collect or store any personal data. All API requests are made directly from your browser to the configured API endpoint.

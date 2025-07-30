# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2025-07-29

### Fixed

- YouTube URL detection in content script isolation environment
- Improved reliability of YouTube page identification
- Better handling of tab URLs in extension messaging

## [1.1.0] - 2025-07-29

### Added

- YouTube transcription and summarization feature
- Automatic detection of YouTube video pages
- "Transcribe Video" button on YouTube pages
- Integration with DumplingAI API for YouTube transcript retrieval
- Special handling for YouTube content in summarization
- Host permissions for YouTube and DumplingAI domains

### Changed

- Updated manifest.json with additional host permissions
- Enhanced sidebar.js with YouTube-specific functionality
- Modified content.js to inject YouTube transcription button
- Extended background.js to handle YouTube transcription messages

## [1.0.0] - 2025-07-27

### Added

- Initial release of Neutral Summarizer Chrome Extension
- Sidebar interface with Content and Settings tabs
- Page summarization functionality
- Chat interface for interacting with AI about page content
- Settings management for API configuration
- Support for OpenAI-compatible APIs
- Persistent storage of settings using Chrome storage API

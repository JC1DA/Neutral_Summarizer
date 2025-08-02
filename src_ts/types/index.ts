// Type definitions for Neutral Summarizer Chrome Extension

// Chrome Extension Types
export interface ChromeTab {
  id?: number;
  url?: string;
  title?: string;
}

export interface ChromeMessageSender {
  tab?: ChromeTab;
  frameId?: number;
}

export interface ChromeStorageArea {
  get: (keys: string | string[] | object | null) => Promise<object>;
  set: (items: object) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
  getBytesInUse: () => Promise<number>;
}

// Extension Message Types
export interface BaseMessage {
  type: string;
  data?: any;
}

export interface ToggleSidebarMessage extends BaseMessage {
  type: 'TOGGLE_SIDEBAR';
}

export interface ToggleSidebarVisibilityMessage extends BaseMessage {
  type: 'TOGGLE_SIDEBAR_VISIBILITY';
}

export interface GetSettingsMessage extends BaseMessage {
  type: 'GET_SETTINGS';
}

export interface SaveSettingsMessage extends BaseMessage {
  type: 'SAVE_SETTINGS';
  data: Partial<Settings>;
}

export interface UpdateSettingsMessage extends BaseMessage {
  type: 'UPDATE_SETTINGS';
  data: Settings;
}

export interface InjectSidebarMessage extends BaseMessage {
  type: 'INJECT_SIDEBAR';
}

export interface FetchYouTubeTranscriptMessage extends BaseMessage {
  type: 'FETCH_YOUTUBE_TRANSCRIPT';
  data: {
    videoUrl: string;
  };
}

export type ExtensionMessage = 
  | ToggleSidebarMessage
  | ToggleSidebarVisibilityMessage
  | GetSettingsMessage
  | SaveSettingsMessage
  | UpdateSettingsMessage
  | InjectSidebarMessage
  | FetchYouTubeTranscriptMessage;

// Settings Types
export interface Settings {
  baseUrl: string;
  apiKey: string;
  dumplingApiKey: string;
  modelName: string;
  temperature: number;
  systemPrompt: string;
  sidebarWidth: number;
  fontSize: number;
  lastUpdated?: number;
}

export interface DefaultSettings {
  baseUrl: string;
  apiKey: string;
  dumplingApiKey: string;
  modelName: string;
  temperature: number;
  systemPrompt: string;
  sidebarWidth: number;
  fontSize: number;
}

// API Types
export interface ApiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ApiMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

// YouTube Types
export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  author: string;
  description: string;
  thumbnailUrl: string;
  duration: string;
  viewCount: string;
  likeCount: string;
  publishDate: string;
  url: string;
  isLive: boolean;
  isPremiere: boolean;
  hasCaptions: boolean;
  hasSufficientContent: boolean;
  hasTranscript?: boolean;
}

export interface YouTubeTranscriptResponse {
  success: boolean;
  transcript?: string;
  videoInfo?: any;
  error?: string;
}

// Content Extraction Types
export interface PageContent {
  title: string;
  url: string;
  content: string;
  meta: PageMetadata;
  isYouTube: boolean;
  youtubeData?: YouTubeVideoInfo | undefined;
  wordCount: number;
  estimatedReadingTime: number;
}

export interface PageMetadata {
  description: string;
  author: string;
  publishDate: string;
  imageUrl: string;
  siteName: string;
  og_description: string;
}

export interface ContentExtractionOptions {
  maxContentLength?: number;
  preserveImages?: boolean;
  preserveLinks?: boolean;
  preserveStructure?: boolean;
  removeSelectors?: string[];
  contentSelectors?: string[];
}

// Storage Types
export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface SettingsResult extends StorageResult<Settings> {
  validationErrors?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Component Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface ChatComponentState {
  messages: ChatMessage[];
  isGenerating: boolean;
  settings: Settings | null;
}

export interface MarkdownRendererOptions {
  breaks?: boolean;
  gfm?: boolean;
  headerIds?: boolean;
  sanitize?: boolean;
  smartLists?: boolean;
  smartypants?: boolean;
}

// Error Types
export class ExtensionError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ExtensionError';
  }
}

export class ApiError extends ExtensionError {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message, 'API_ERROR', { statusCode, response });
    this.name = 'ApiError';
  }
}

export class ValidationError extends ExtensionError {
  constructor(
    message: string,
    public validationErrors: string[]
  ) {
    super(message, 'VALIDATION_ERROR', { validationErrors });
    this.name = 'ValidationError';
  }
}

export class StorageError extends ExtensionError {
  constructor(
    message: string,
    public operation?: string
  ) {
    super(message, 'STORAGE_ERROR', { operation });
    this.name = 'StorageError';
  }
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;

// DOM Types
export interface SidebarElements {
  container: HTMLElement | null;
  overlay: HTMLElement | null;
  header: HTMLElement | null;
  title: HTMLElement | null;
  closeBtn: HTMLElement | null;
  tabs: NodeListOf<HTMLElement>;
  content: HTMLElement | null;
  chatContainer: HTMLElement | null;
  settingsContainer: HTMLElement | null;
}

export interface ChatElements {
  messages: HTMLElement | null;
  input: HTMLTextAreaElement | null;
  sendBtn: HTMLButtonElement | null;
  summarizeBtn: HTMLButtonElement | null;
  clearBtn: HTMLButtonElement | null;
}

export interface SettingsElements {
  baseUrl: HTMLInputElement | null;
  apiKey: HTMLInputElement | null;
  dumplingKey: HTMLInputElement | null;
  modelName: HTMLInputElement | null;
  systemPrompt: HTMLTextAreaElement | null;
  sidebarWidth: HTMLInputElement | null;
  fontSize: HTMLInputElement | null;
  saveBtn: HTMLButtonElement | null;
  widthValue: HTMLElement | null;
  fontValue: HTMLElement | null;
}

// Event Handler Types
export interface MessageHandler {
  (message: ExtensionMessage, sender: ChromeMessageSender, sendResponse: (response: any) => void): void;
}

export interface EventHandler {
  (event: Event): void;
}

export interface AsyncEventHandler {
  (event: Event): Promise<void>;
}

// Streaming Types
export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  fullContent?: string;
  error?: string;
}

export interface AsyncIterableStream<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

export interface AsyncIterator<T> {
  next(): Promise<IteratorResult<T>>;
}

// Chrome API Types (Extended)
export interface ChromeRuntime {
  sendMessage: (message: any, callback?: (response: any) => void) => void;
  onMessage: {
    addListener: (callback: MessageHandler) => void;
    removeListener: (callback: MessageHandler) => void;
  };
}

export interface ChromeTabs {
  query: (queryInfo: any, callback: (tabs: ChromeTab[]) => void) => void;
  sendMessage: (tabId: number, message: any, callback?: (response: any) => void) => void;
  executeScript: (injectDetails: any, callback?: () => void) => void;
}

export interface ChromeStorage {
  sync: ChromeStorageArea;
  local: ChromeStorageArea;
  onChanged: {
    addListener: (callback: (changes: any, areaName: string) => void) => void;
    removeListener: (callback: (changes: any, areaName: string) => void) => void;
  };
}

export interface ChromeScripting {
  executeScript: (injectDetails: any, callback?: () => void) => void;
}

export interface ChromeAction {
  onClicked: {
    addListener: (callback: (tab: ChromeTab) => void) => void;
  };
}

// Chrome API declarations for service worker and content script context
declare const chrome: {
  runtime: {
    onMessage: {
      addListener: (callback: (message: any, sender: any, sendResponse: (response: any) => void) => void) => void;
    };
    lastError?: { message: string };
  };
  action: {
    onClicked: {
      addListener: (callback: (tab: ChromeTab) => void) => void;
    };
  };
  scripting: {
    executeScript: (injectDetails: { target: { tabId: number }; files: string[] }, callback?: () => void) => void;
  };
  tabs: {
    sendMessage: (tabId: number, message: any, callback?: (response: any) => void) => void;
  };
  storage: {
    sync: {
      get: (keys: any, callback?: (result: any) => void) => void;
      set: (items: any, callback?: () => void) => void;
    };
  };
};

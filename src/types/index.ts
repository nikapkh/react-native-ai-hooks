export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  apiKey: string;
  provider?: 'claude' | 'openai' | 'gemini';
  model?: string;
}

export interface AIResponse {
  content: string;
  error?: string;
}
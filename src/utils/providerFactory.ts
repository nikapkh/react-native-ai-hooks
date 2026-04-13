/**
 * Unified Provider Factory for handling multiple AI providers
 * Normalizes responses across Anthropic, OpenAI, and Gemini
 */

import type {
  AIResponse,
  AIRequestOptions,
  AnthropicResponse,
  OpenAIResponse,
  GeminiResponse,
  ProviderConfig,
} from '../types';
import { fetchWithRetry } from './fetchWithRetry';

interface ProviderFactoryOptions extends ProviderConfig {
  system?: string;
  context?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface ProviderRequest {
  prompt: string;
  options?: AIRequestOptions;
  context?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export class ProviderFactory {
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
    };
  }

  private getBaseUrl(): string {
    if (this.config.baseUrl) {
      return this.config.baseUrl;
    }

    switch (this.config.provider) {
      case 'anthropic':
        return 'https://api.anthropic.com';
      case 'openai':
        return 'https://api.openai.com';
      case 'gemini':
        return 'https://generativelanguage.googleapis.com';
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  async makeRequest(request: ProviderRequest): Promise<AIResponse> {
    switch (this.config.provider) {
      case 'anthropic':
        return this.makeAnthropicRequest(request);
      case 'openai':
        return this.makeOpenAIRequest(request);
      case 'gemini':
        return this.makeGeminiRequest(request);
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  private async makeAnthropicRequest(request: ProviderRequest): Promise<AIResponse> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/v1/messages`;

    const body = {
      model: this.config.model,
      max_tokens: request.options?.maxTokens || 1024,
      temperature: request.options?.temperature ?? 0.7,
      system: request.options?.system,
      messages: this.buildAnthropicMessages(request),
    };

    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      },
      {
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
      },
    );

    const data = (await response.json()) as AnthropicResponse;

    if (!response.ok) {
      throw new Error(data?.error?.message || `Anthropic API error: ${response.status}`);
    }

    return this.normalizeAnthropicResponse(data);
  }

  private async makeOpenAIRequest(request: ProviderRequest): Promise<AIResponse> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/v1/chat/completions`;

    const body = {
      model: this.config.model,
      max_tokens: request.options?.maxTokens || 1024,
      temperature: request.options?.temperature ?? 0.7,
      system: request.options?.system,
      messages: this.buildOpenAIMessages(request),
    };

    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      },
      {
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
      },
    );

    const data = (await response.json()) as OpenAIResponse;

    if (!response.ok) {
      throw new Error(data?.error?.message || `OpenAI API error: ${response.status}`);
    }

    return this.normalizeOpenAIResponse(data);
  }

  private async makeGeminiRequest(request: ProviderRequest): Promise<AIResponse> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const body = {
      contents: this.buildGeminiMessages(request),
      generationConfig: {
        maxOutputTokens: request.options?.maxTokens || 1024,
        temperature: request.options?.temperature ?? 0.7,
      },
    };

    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      {
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
      },
    );

    const data = (await response.json()) as GeminiResponse;

    if (!response.ok) {
      throw new Error(data?.error?.message || `Gemini API error: ${response.status}`);
    }

    return this.normalizeGeminiResponse(data);
  }

  private buildAnthropicMessages(
    request: ProviderRequest,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages = request.context || [];
    return [...messages, { role: 'user', content: request.prompt }];
  }

  private buildOpenAIMessages(
    request: ProviderRequest,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages = request.context || [];
    return [...messages, { role: 'user', content: request.prompt }];
  }

  private buildGeminiMessages(request: ProviderRequest): Array<{ role: string; parts: Array<{ text: string }> }> {
    const messages = request.context || [];

    return messages
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }))
      .concat({
        role: 'user',
        parts: [{ text: request.prompt }],
      });
  }

  private normalizeAnthropicResponse(data: AnthropicResponse): AIResponse {
    const textContent = data.content?.find(block => block.type === 'text');
    const text = (textContent?.type === 'text' && 'text' in textContent ? (textContent as any).text : '') || '';

    if (!text) {
      throw new Error('No text content returned by Anthropic API');
    }

    return {
      text,
      raw: data,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
    };
  }

  private normalizeOpenAIResponse(data: OpenAIResponse): AIResponse {
    const text = data.choices?.[0]?.message?.content || '';

    if (!text) {
      throw new Error('No text content returned by OpenAI API');
    }

    return {
      text,
      raw: data,
      usage: {
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    };
  }

  private normalizeGeminiResponse(data: GeminiResponse): AIResponse {
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      throw new Error('No text content returned by Gemini API');
    }

    return {
      text,
      raw: data,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
        totalTokens: data.usageMetadata?.totalTokenCount,
      },
    };
  }
}

export function createProvider(config: ProviderConfig): ProviderFactory {
  return new ProviderFactory(config);
}

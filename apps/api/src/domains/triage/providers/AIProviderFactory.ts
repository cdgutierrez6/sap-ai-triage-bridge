import type { AIProvider } from './AIProvider.interface';
import { ClaudeProvider } from './ClaudeProvider';
import { OpenAIProvider } from './OpenAIProvider';

export class AIProviderFactory {
  static create(provider: 'claude' | 'openai'): AIProvider {
    return provider === 'claude' ? new ClaudeProvider() : new OpenAIProvider();
  }
}

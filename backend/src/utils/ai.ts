import { createOpenAI } from '@ai-sdk/openai';

export const ai = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
});

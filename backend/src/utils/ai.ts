import { createOpenAI } from '@ai-sdk/openai';
import { config } from 'dotenv';

config();

export const ai = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
});

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { streamText } from 'ai';
import { z } from 'zod';
import { ai } from './utils/ai.js';

const app = new Hono().basePath('/api');

app.use(cors());

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['data', 'system', 'user', 'assistant']),
      content: z.string(),
    })
  ),
  model: z.string(),
});

app.post('/chat', async (c) => {
  try {
    const jsonBody = await c.req.json();
    const parsed = bodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const { messages, model } = parsed.data;

    if (!model.endsWith(':free')) {
      return c.json(
        { error: 'Invalid model. Only free models are allowed.' },
        403
      );
    }

    const result = streamText({
      model: ai(model),
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        ...messages,
      ],
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat error:', error);
    return c.json(
      {
        error: 'An error occurred during chat processing',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);

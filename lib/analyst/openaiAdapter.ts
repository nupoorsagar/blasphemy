import OpenAI from 'openai';
import type { StructuredModelAdapter } from './orchestrator';

/** OpenAI Responses adapter used by the multi-pass analyst and judge. */
export function createOpenAIAnalystAdapter(): StructuredModelAdapter {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_ANALYST_MODEL || process.env.OPENAI_MODEL || 'gpt-5.6-luna';

  return {
    async generate({ system, user, jsonSchema }) {
      const response = await client.responses.create({
        model,
        input: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
        ],
        text: { format: jsonSchema as any },
      });
      return JSON.parse(response.output_text);
    },
  };
}

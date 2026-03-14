
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const MODEL_FALLBACK_LIST = [
    'googleai/gemini-2.0-flash',
    'googleai/gemini-2.5-flash',
    'googleai/gemini-2.5-pro',
    'googleai/gemini-2.0-flash-lite',
    'googleai/gemini-2.5-flash-lite',
];

export async function generateWithFallback<T extends z.ZodType<any, any, any>>(
  prompt: string,
  outputSchema: T,
  debugName: string
): Promise<z.infer<T> | null> {
  for (const modelName of MODEL_FALLBACK_LIST) {
    try {
      console.log(`${debugName} → trying ${modelName}`);
      const response = await ai.generate({
        model: modelName as any,
        prompt,
        output: { schema: outputSchema },
        config: { temperature: 0.5 },
      });
      const output = response.output;
      if (output) {
        console.log(`${debugName} success with ${modelName}`);
        return output;
      }
    } catch (error: any) {
      console.warn(`${debugName} failed on ${modelName}:`, error.message);
    }
  }
  return null;
}


/**
 * @fileOverview A flow to suggest commands and strategies for clearing npm cache and other unnecessary files.
 *
 * - suggestCacheCleaningStrategies - A function that provides suggestions for cleaning npm cache and unnecessary files.
 * - SuggestCacheCleaningStrategiesInput - The input type for the suggestCacheCleaningStrategies function.
 * - SuggestCacheCleaningStrategiesOutput - The return type for the suggestCacheCleaningStrategies function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

const SuggestCacheCleaningStrategiesInputSchema = z.object({
  currentDiskUsage: z.string().describe('The current disk usage status.'),
  npmCacheSize: z.string().describe('The current size of the npm cache.'),
});
export type SuggestCacheCleaningStrategiesInput = z.infer<typeof SuggestCacheCleaningStrategiesInputSchema>;

const SuggestCacheCleaningStrategiesOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('An array of suggested commands and strategies for clearing npm cache and other unnecessary files.'),
});
export type SuggestCacheCleaningStrategiesOutput = z.infer<typeof SuggestCacheCleaningStrategiesOutputSchema>;

export async function suggestCacheCleaningStrategies(input: SuggestCacheCleaningStrategiesInput): Promise<SuggestCacheCleaningStrategiesOutput> {
  return suggestCacheCleaningStrategiesFlow(input);
}

const suggestCacheCleaningStrategiesFlow = ai.defineFlow(
  {
    name: 'suggestCacheCleaningStrategiesFlow',
    inputSchema: SuggestCacheCleaningStrategiesInputSchema,
    outputSchema: SuggestCacheCleaningStrategiesOutputSchema,
  },
  async (input) => {
    const prompt = `You are an expert software developer specializing in optimizing disk space for Node.js projects.

Based on the current disk usage and npm cache size, suggest commands and strategies for clearing npm cache and other unnecessary files to free up disk space and improve system performance.

Current Disk Usage: ${input.currentDiskUsage}
NPM Cache Size: ${input.npmCacheSize}

Provide at least three distinct suggestions, including specific commands where applicable. Explain what each suggestion does and why it is helpful.`;
    
    let response;
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting to generate with model: ${modelName}`);
            response = await ai.generate({
                prompt: prompt,
                model: modelName as any,
                output: { schema: SuggestCacheCleaningStrategiesOutputSchema },
            });
            if (response) {
              console.log(`Success with model: ${modelName}`);
              break;
            }
        } catch (error: any) {
            console.warn(`Model ${modelName} failed for cache cleaning suggestions. Error: ${error.message}`);
        }
    }
    
    if (!response || !response.output) {
      throw new Error("AI model did not return valid suggestions after trying all fallbacks.");
    }
    
    const output = response.output;
    return output;
  }
);

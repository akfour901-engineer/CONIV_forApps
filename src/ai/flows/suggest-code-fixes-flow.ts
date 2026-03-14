
'use server';
/**
 * @fileOverview Suggests specific code fixes for identified Zod errors, including Zod v3 to v4 migrations.
 *
 * - suggestCodeFixes - A function that handles the suggestion of code fixes.
 * - SuggestCodeFixesInput - The input type for the suggestCodeFixes function.
 * - SuggestCodeFixesOutput - The return type for the suggestCodeFixes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

const SuggestCodeFixesInputSchema = z.object({
  codeSnippet: z.string().describe('The code snippet containing the Zod error.'),
  errorMessage: z.string().describe('The error message associated with the code snippet.'),
  zodVersion: z.string().optional().describe('The version of Zod being used.'),
  aiLibraryVersion: z.string().optional().describe('The version of the AI library being used.'),
});
export type SuggestCodeFixesInput = z.infer<typeof SuggestCodeFixesInputSchema>;

const SuggestCodeFixesOutputSchema = z.object({
  suggestedFix: z.string().describe('A suggested code fix for the Zod error.'),
  reasoning: z.string().describe('The reasoning behind the suggested fix.'),
});
export type SuggestCodeFixesOutput = z.infer<typeof SuggestCodeFixesOutputSchema>;

export async function suggestCodeFixes(input: SuggestCodeFixesInput): Promise<SuggestCodeFixesOutput> {
  return suggestCodeFixesFlow(input);
}

const suggestCodeFixesFlow = ai.defineFlow(
  {
    name: 'suggestCodeFixesFlow',
    inputSchema: SuggestCodeFixesInputSchema,
    outputSchema: SuggestCodeFixesOutputSchema,
  },
  async input => {
    const prompt = `You are an expert software developer specializing in debugging Zod schema errors and suggesting code migrations.

You will be provided with a code snippet, an error message, the Zod version, and the AI library version (if available).

Based on this information, you will suggest a specific code fix for the Zod error. Also explain your reasoning.

Code Snippet: ${input.codeSnippet}
Error Message: ${input.errorMessage}
Zod Version: ${input.zodVersion || 'not specified'}
AI Library Version: ${input.aiLibraryVersion || 'not specified'}

Suggest a code fix and explain your reasoning.`;

    let response;
    for (const modelName of MODEL_FALLBACK_LIST) {
      try {
        response = await ai.generate({
            prompt,
            model: modelName as any,
            output: {schema: SuggestCodeFixesOutputSchema},
        });
        if (response?.output) break;
      } catch(e: any) {
          console.warn(`Code fix suggestion model ${modelName} failed`, e.message);
      }
    }
    
    if (!response?.output) {
        throw new Error("AI failed to suggest code fixes.");
    }
    
    return response.output;
  }
);

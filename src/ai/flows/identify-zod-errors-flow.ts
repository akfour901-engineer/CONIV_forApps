
'use server';
/**
 * @fileOverview Identifies Zod-related errors in a codebase.
 *
 * - identifyZodErrors - A function that handles the Zod error identification process.
 * - IdentifyZodErrorsInput - The input type for the identifyZodErrors function.
 * - IdentifyZodErrorsOutput - The return type for the identifyZodErrors function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

const IdentifyZodErrorsInputSchema = z.object({
  codebase: z.string().describe('The codebase to analyze for Zod-related errors.'),
  zodVersion: z.string().optional().describe('The Zod library version used in the codebase.'),
});
export type IdentifyZodErrorsInput = z.infer<typeof IdentifyZodErrorsInputSchema>;

const ZodErrorSchema = z.object({
  filePath: z.string().describe('The path to the file containing the error.'),
  lineNumber: z.number().optional().describe('The line number where the error occurs.'),
  errorDescription: z.string().describe('A description of the Zod-related error.'),
});

const IdentifyZodErrorsOutputSchema = z.object({
  errors: z.array(ZodErrorSchema).describe('A list of Zod-related errors found in the codebase.'),
  summary: z.string().describe('A summary of the analysis, including the number of errors found.'),
});
export type IdentifyZodErrorsOutput = z.infer<typeof IdentifyZodErrorsOutputSchema>;

export async function identifyZodErrors(input: IdentifyZodErrorsInput): Promise<IdentifyZodErrorsOutput> {
  return identifyZodErrorsFlow(input);
}

const identifyZodErrorsFlow = ai.defineFlow(
  {
    name: 'identifyZodErrorsFlow',
    inputSchema: IdentifyZodErrorsInputSchema,
    outputSchema: IdentifyZodErrorsOutputSchema,
  },
  async input => {
    const prompt = `You are an expert software developer specializing in identifying Zod-related errors in a codebase.

Analyze the following codebase for potential Zod-related errors based on common patterns such as 'required_error' and schema type mismatches:

Codebase:\n${input.codebase}\n\nZod Version: ${input.zodVersion || 'Not specified'}\n\nIdentify Zod-related errors, including the file path, line number (if available), and a description of the error. Provide a summary of the analysis, including the number of errors found.`;

    let response;
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting to generate with model: ${modelName}`);
            response = await ai.generate({
                prompt: prompt,
                model: modelName as any,
                output: { schema: IdentifyZodErrorsOutputSchema },
            });
            if (response) {
                console.log(`Success with model: ${modelName}`);
                break;
            }
        } catch (error: any) {
            console.warn(`Model ${modelName} failed for identifying Zod errors. Error: ${error.message}`);
        }
    }

    if (!response || !response.output) {
      throw new Error("AI model did not return a valid analysis for Zod errors after trying all fallbacks.");
    }
    
    const output = response.output;
    return output;
  }
);

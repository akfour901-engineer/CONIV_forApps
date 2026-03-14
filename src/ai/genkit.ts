import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * Core Genkit instance for the application.
 * 
 * Note: Initialization side-effects (like cron registration) must not happen here 
 * to avoid circular dependencies during module resolution.
 */
export const ai = genkit({
  plugins: [googleAI()],
});

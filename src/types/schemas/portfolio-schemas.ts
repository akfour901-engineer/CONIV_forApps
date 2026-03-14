
import { z } from 'zod';

export const GeneratePortfolioInputSchema = z.object({
  portfolioType: z.enum(['singleCompany', 'allCompanies']),
  companyId: z.string().optional().describe("Required if portfolioType is 'singleCompany'."),
  userId: z.string(),
  prompt: z.string().optional(),
  publicId: z.string().min(3, "URL path must be at least 3 characters.").regex(/^[a-z0-9-]+$/, "URL path can only contain lowercase letters, numbers, and hyphens."),
  portfolioId: z.string().optional().describe("If provided, the flow will update this existing portfolio instead of creating a new one."),
});
export type GeneratePortfolioInput = z.infer<typeof GeneratePortfolioInputSchema>;

export const GeneratePortfolioOutputSchema = z.object({
  portfolioId: z.string(),
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});
export type GeneratePortfolioOutput = z.infer<typeof GeneratePortfolioOutputSchema>;

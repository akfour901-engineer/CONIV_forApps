
'use server';
/**
 * @fileOverview A flow to generate or update a company portfolio webpage.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, Company, WorkOrder, Portfolio } from '@/types/server-only';
import { GeneratePortfolioInputSchema, GeneratePortfolioOutputSchema } from '@/types/schemas/portfolio-schemas';
import { logActivity } from '@/lib/activityLog';
import { AI_PORTFOLIO_GENERATION_COST } from '@/lib/constants';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

export type GeneratePortfolioInput = z.infer<typeof GeneratePortfolioInputSchema>;
export type GeneratePortfolioOutput = z.infer<typeof GeneratePortfolioOutputSchema>;

const portfolioContentSchema = z.object({
  htmlContent: z.string().describe("The complete, single, ready-to-render HTML content for a modern and responsive portfolio webpage, styled with Tailwind CSS. CRITICAL: Do NOT include <html>, <head>, or <body> tags. Your response must start with the first <header> or <section> and end with the final </footer>."),
});

const generatePortfolioFlow = ai.defineFlow(
  {
      name: 'generatePortfolioFlow',
      inputSchema: GeneratePortfolioInputSchema,
      outputSchema: GeneratePortfolioOutputSchema,
  },
  async (input) => {
    const adminDb = getDb();
    
    const userProfileRef = adminDb.collection('users').doc(input.userId);
    const userProfileSnap = await userProfileRef.get();
    if (!userProfileSnap.exists) throw new Error("User profile not found.");
    const userProfile = userProfileSnap.data() as UserProfile;
    const currentPoints = userProfile.resourcePoints ?? 0;
    if (currentPoints < AI_PORTFOLIO_GENERATION_COST) {
      throw new Error(`Insufficient resource points. You need ${AI_PORTFOLIO_GENERATION_COST}.`);
    }
    
    if (!input.portfolioId) { // Only check for uniqueness if it's a new portfolio
        const existingPortfolioSnap = await adminDb.collection('portfolios').where('publicId', '==', input.publicId).limit(1).get();
        if (!existingPortfolioSnap.empty) {
            throw new Error(`The portfolio URL path '${input.publicId}' is already taken. Please choose a unique one.`);
        }
    }

    let mainCompanyName = "Portfolio";
    let mainCompanyLogo: string | null = null;
    let mainCompanyId: string | null = null;
    let combinedPromptData: string = input.prompt ?? '';

    // Fetch existing work orders to enrich the prompt
    const allWorkOrdersQuery = adminDb.collection('workOrders').where('userId', '==', input.userId).where('status', '==', 'completed');
    const allWorkOrdersSnapshot = await allWorkOrdersQuery.get();
    const allWorkOrders = allWorkOrdersSnapshot.docs.map(doc => doc.data() as WorkOrder);
    
    if (allWorkOrders.length > 0) {
        const workOrderSummaries = allWorkOrders.slice(0, 10).map(wo => {
            return `Project: ${wo.scopeOfWork}, Value: ${wo.grandTotal}, Timeline: ${wo.startDate} to ${wo.endDate}. Image: ${wo.awardProofUrl || 'none'}`;
        }).join('\\n');
        combinedPromptData += `\\n\\n**ADDITIONAL CONTEXT FROM USER'S COMPLETED PROJECTS (use these to enrich the project showcase section):**\\n${workOrderSummaries}`;
    } else {
        combinedPromptData += `\\n\\n**ADDITIONAL CONTEXT:** No completed projects found in the user's account. Rely only on user-provided project details.`;
    }

    try {
        const values = JSON.parse(input.prompt ?? '{}');
        mainCompanyName = values.portfolioName;
        mainCompanyLogo = values.logoUrl;
    } catch (e) {
        console.warn("Could not parse input.prompt as JSON in generatePortfolioFlow. Treating as plain text. Error:", e);
         if (input.portfolioId) {
            const existingPortfolio = await adminDb.collection('portfolios').doc(input.portfolioId).get();
            if (existingPortfolio.exists) {
                mainCompanyName = existingPortfolio.data()?.portfolioName || "Portfolio";
                mainCompanyLogo = existingPortfolio.data()?.companyLogoUrl || null;
            }
        }
    }


    const promptText = `
        You are an expert web designer and copywriter. Your task is to generate a complete, single HTML file for a professional, responsive, and interconnected public-facing portfolio webpage based on the user's provided details and their existing project data.

        **CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE RULES:**
        1.  **NO \`<html>\`, \`<head>\`, or \`<body>\` TAGS.** Your entire response MUST be a single block of HTML starting with the first \`<header>\` or \`<section>\` and ending with the final \`</footer>\`. DO NOT wrap the output in a parent \`<div>\`.
        2.  **Editable Text:** Every user-facing text element (h1, h2, p, a, button, etc.) MUST include the attribute \`data-editable="true"\`. Example: \`<h1 data-editable="true">About Us</h1>\`.
        3.  **Section Tags & Titles:** Every major part of the page (Header, Hero, About, Services, Projects, Contact, Footer) MUST be wrapped in its own semantic tag: \`<header>\`, \`<section>\`, or \`<footer>\`. Each of these tags MUST have a unique \`id\` AND a \`data-section-title\` attribute that describes its purpose (e.g., \`<section id="about-us" data-section-title="About Us Section" ...>\`).
        4.  **Strict Structure:** The top-level elements of your response must be the sectioning tags themselves (\`<header>\`, \`<section>\`, \`<footer>\`).
        5.  **Internal Links:** All navigation links and buttons (like "Get Quote") MUST be anchor links pointing to the correct section ID (e.g., \`<a href="#contact">...\`).
        6.  **Styling:** Use Tailwind CSS for ALL styling. Do NOT include your own <style> block or CSS. Use generic Tailwind color classes like 'bg-primary' and 'text-primary'.
        7.  **Images:** For any user-provided images, use the data URI directly. For any other images you need to generate, use placeholder images from \`https://picsum.photos/seed/{seedId}/width/height\`. Add a \`data-ai-hint\` attribute with 1-2 keywords to each image (e.g., "construction site").
        8.  **Contact Form:** CRITICAL - Where the contact form should go, insert ONLY the exact placeholder string: \`[CONTACT_FORM]\`. DO NOT generate any HTML form elements yourself.

        **USER PROVIDED DATA & EXISTING PROJECT INFO (USE ALL OF THIS TO POPULATE THE CONTENT):**
        ${combinedPromptData}
        ${input.portfolioId ? `\\n**IMPORTANT CONTEXT:** This is a rebuild of an existing portfolio. Use the provided data to update and enhance the content and design.` : ''}

        **REQUIRED SECTIONS & CONTENT (MUST USE \`<header>\`, \`<section>\`, \`<footer>\` TAGS):**
        1.  **Header:** A professional, responsive \`<header id="header" data-section-title="Header Bar" ...>\` with a nav element and anchor links.
        2.  **Hero Section:** A \`<section id="hero" data-section-title="Hero Section" ...>\` with a compelling headline and a button linking to the contact section (\`#contact\`).
        3.  **About Us Section:** A \`<section id="about" data-section-title="About Us Section" ...>\` describing the company.
        4.  **Services Section:** A \`<section id="services" data-section-title="Services Section" ...>\` highlighting the key services.
        5.  **Project Showcase:** A \`<section id="projects" data-section-title="Project Showcase" ...>\` featuring the most significant projects, combining user-provided projects and data from their account history.
        6.  **Contact Section:** A \`<section id="contact" data-section-title="Contact Section" ...>\` with contact info and the special placeholder \`[CONTACT_FORM]\`.
        7.  **Footer:** A simple \`<footer id="footer" data-section-title="Footer" ...>\` with copyright information and social links.

        Generate only the complete HTML content for the portfolio webpage.
    `;

    let response;
    for (const modelName of MODEL_FALLBACK_LIST) {
        try {
            console.log(`Attempting to generate portfolio with model: ${modelName}`);
            response = await ai.generate({
                prompt: promptText,
                model: modelName as any,
                output: { schema: portfolioContentSchema },
                config: { temperature: 0.5 }
            });
            if (response) {
              console.log(`Success with model: ${modelName}`);
              break;
            }
        } catch (error: any) {
            console.warn(`Model ${modelName} failed for portfolio generation. Error: ${error.message}`);
        }
    }

    if (!response || !response.output) {
      throw new Error("AI model did not return valid portfolio content after trying all fallbacks.");
    }
    const output = response.output;
    
    let portfolioId: string;
    
    if (input.portfolioId) {
      // It's an update/rebuild
      portfolioId = input.portfolioId;
      const portfolioRef = adminDb.collection('portfolios').doc(portfolioId);
      await portfolioRef.update({
        content: output.htmlContent,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // It's a new creation
      const newPortfolio: Omit<Portfolio, 'id'> = {
        userId: input.userId,
        companyId: mainCompanyId,
        companyName: mainCompanyName,
        companyLogoUrl: mainCompanyLogo,
        portfolioName: mainCompanyName,
        publicId: input.publicId,
        content: output.htmlContent,
        themeColor: '#008080',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const portfolioRef = await adminDb.collection('portfolios').add(newPortfolio);
      portfolioId = portfolioRef.id;
    }

    const newResourcePoints = currentPoints - AI_PORTFOLIO_GENERATION_COST;
    await userProfileRef.update({ resourcePoints: newResourcePoints });

    await logActivity({
      ownerId: input.userId, 
      actorUid: input.userId, 
      actorName: userProfile.fullName || "User",
      actionType: input.portfolioId ? 'portfolio_updated' : 'portfolio_generated',
      entityType: 'Portfolio',
      entityId: portfolioId,
      entityName: mainCompanyName,
      details: { message: `AI ${input.portfolioId ? 'Rebuilt' : 'Generated'} a portfolio.`, cost: AI_PORTFOLIO_GENERATION_COST }
    });

    return { portfolioId, newResourcePoints };
  }
);

export async function generatePortfolio(input: GeneratePortfolioInput): Promise<GeneratePortfolioOutput> {
    return await generatePortfolioFlow(input);
}

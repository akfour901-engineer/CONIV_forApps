
'use server';

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, Company } from '@/types/server-only';
import { GenerateBrandingInputSchema, type GenerateBrandingInput, type GenerateBrandingOutput, type Letterhead } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

export type { GenerateBrandingInput, GenerateBrandingOutput };

const LogoOutputSchema = z.object({
  logo: z
    .string()
    .describe(
      'A single, complete, valid SVG code string for one logo. The SVG MUST have a `viewBox="0 0 100 100"`. Do NOT include XML declarations.'
    ),
});

const LetterheadOutputSchema = z.object({
  letterheads: z
    .array(
      z.object({
        name: z.string(),
        html: z.string(),
        css: z.string(),
      })
    )
    .length(3)
    .describe(
      '3 distinct letterhead designs, each with a name, HTML, and CSS. Be creative and ensure they are visually different (e.g., try different layouts, color applications, and typographic treatments).'
    ),
});

const BRANDING_COST = 10;

async function generateWithFallback<T extends z.ZodType<any, any, any>>(
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
        config: { temperature: 0.8 }, // Increased creativity
      });
      const output = response.output;
      if (output) {
        console.log(`${debugName} success with ${modelName}`);
        console.log(
          `[AI ${debugName.toUpperCase()} OUTPUT from ${modelName}]:`,
          JSON.stringify(output, null, 2)
        );
        return output;
      }
    } catch (error: any) {
      console.warn(`${debugName} failed on ${modelName}:`, error.message);
    }
  }
  return null;
}

const generateBrandingFlow = ai.defineFlow(
  {
    name: 'generateBrandingFlow',
    inputSchema: GenerateBrandingInputSchema,
    outputSchema: z.custom<GenerateBrandingOutput>(),
  },
  async (input) => {
    const db = getDb();

    const userRef = db.collection('users').doc(input.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error('User profile not found.');

    const user = userSnap.data() as UserProfile;
    const points = user.resourcePoints ?? 0;
    if (points < BRANDING_COST) {
      throw new Error(`Need ${BRANDING_COST} resource points.`);
    }

    const newPoints = points - BRANDING_COST;
    const now = new Date().toISOString();

    const companySnap = await db
      .collection('companies')
      .doc(input.companyId)
      .get();
    if (!companySnap.exists) throw new Error('Company not found.');
    const company = companySnap.data() as Company;

    const baseInfo = `
Company: ${company.name}
Address: ${company.address}
Contact: ${company.contactPhone || ''} | ${company.contactEmail || ''}
User style prompt: ${input.prompt || 'modern, professional, clean'}
${
  input.referenceImage
    ? `Reference image: {{media url='${input.referenceImage}'}}`
    : ''
}
`.trim();

    if (input.regenerateLogo) {
      const regenPrompt = `
You are an expert SVG logo designer. Create one new, unique, professional, and simple SVG logo for a company.
It should be a different variation, inspired by the reference logo if provided.

**CRITICAL INSTRUCTIONS:**
1. **Output valid JSON.** Your entire response must be a JSON object with a single key "logo".
2. The "logo" value must be a **string containing valid SVG code**.
3. **Use Theme Colors:** Use HSL CSS variables for colors (e.g., \`fill="hsl(var(--primary))"\`).
4. **Standard ViewBox:** The SVG MUST have a \`viewBox="0 0 100 100"\`.
5. **No XML Declaration:** Do not include the \`<?xml ...?>\` declaration.

**Company & Style Information:**
${baseInfo}
${
  input.logoToRegenerate
    ? `**Reference Logo to create a variation of:** {{media url='${input.logoToRegenerate}'}}`
    : ''
}
${
  input.regenerationPrompt
    ? `**User's Specific Change Request:** "${input.regenerationPrompt}"`
    : ''
}

Generate the JSON for one unique logo.
        `.trim();

      const logoResult = await generateWithFallback(
        regenPrompt,
        LogoOutputSchema,
        'Regen Logo'
      );

      if (!logoResult?.logo) throw new Error('AI failed to regenerate the logo.');

      await userRef.update({
        resourcePoints: newPoints,
        resourcePointsLastUpdated: now,
      });

      await logActivity({
        ownerId: input.userId,
        actorUid: input.actorUid || input.userId,
        actorName: user.fullName || 'User',
        actionType: 'ai_branding_generated',
        entityType: 'AI',
        entityName: `Logo regeneration for ${company.name}`,
        details: { cost: BRANDING_COST, message: 'Regenerated a single logo.' },
      });

      return {
        logos: [logoResult.logo],
        letterheads: [],
        newResourcePoints: newPoints,
      };
    }

    const logoPrompt = `
You are an expert SVG logo designer. Create a unique, professional, and simple SVG logo for a company.

**CRITICAL INSTRUCTIONS:**
1.  **Output valid JSON.** Your entire response must be a JSON object with a single key "logo".
2.  The "logo" value must be a **string containing valid SVG code**.
3.  **Use Theme Colors:** Use HSL CSS variables for colors (e.g., \`fill="hsl(var(--primary))"\`, \`stroke="hsl(var(--accent))"\`). Do NOT use hex codes.
4.  **Standard ViewBox:** The SVG MUST have a \`viewBox="0 0 100 100"\`.
5.  **No XML Declaration:** Do not include the \`<?xml ...?>\` declaration.
6.  **Simplicity is Key:** The design should be clean, modern, and suitable for a business logo.

**Company & Style Information:**
${baseInfo}

Now, generate the JSON for one unique logo.
`.trim();

    const letterheadPrompt = `
You are an expert graphic designer. Based on the provided company details, create **3 distinct and unique letterhead header designs**.

**Company & Style Information:**
${baseInfo}

**Your Task:**
For each of the 3 designs, provide:
- name: A short, descriptive name (e.g., "Classic Blue Bar", "Modern Minimalist", "Geometric Accent").
- html: The HTML code for a <header> element. Use placeholders like {{companyName}}, {{address}}, {{contact}}, and {{logo}}. The logo placeholder is just \`{{logo}}\`.
- css: The self-contained CSS for that header.

**CRITICAL INSTRUCTIONS:**
1.  **BE CREATIVE & DISTINCT:** Each of the 3 designs must be visually different. Try different layouts (left-aligned, centered, right-aligned), color applications, and typographic treatments.
2.  **USE THEME COLORS:** Use HSL CSS variables for colors (e.g., \`color: hsl(var(--primary));\`, \`background-color: hsl(var(--accent));\`).
3.  **INSPIRATION (do not copy exactly):**
    - **Design 1 (Modern):** Try a full-width colored bar at the top with the logo on the left and contact details on the right.
    - **Design 2 (Classic):** Try a centered layout with the logo at the top, followed by the company name and address.
    - **Design 3 (Minimalist):** Try a clean design with a simple line separator and elegantly placed text on opposite sides.
4.  **JSON OUTPUT:** Return a **strict JSON** object with a single key "letterheads", which is an array of these 3 design objects.
`.trim();

    console.log('--- STARTING LOGO GENERATION ---');
    const logoPromises = Array(3)
      .fill(0)
      .map((_, i) =>
        generateWithFallback(
          `${logoPrompt}\n\nVariant ${
            i + 1
          } of 3. Ensure this design is unique from other potential variants.`,
          LogoOutputSchema,
          `Logo ${i + 1}`
        )
      );
    const logoResults = await Promise.all(logoPromises);
    const validLogos = logoResults
      .map((result) => result?.logo)
      .filter((logo): logo is string => !!logo && logo.trim().startsWith('<svg'));
    console.log(
      `--- FINISHED LOGO GENERATION, FOUND ${validLogos.length} VALID LOGOS ---`
    );
    if (validLogos.length < 3) {
      console.warn(
        `Generated only ${validLogos.length} valid logos. Filling with placeholders.`
      );
      while (validLogos.length < 3) {
        const seed = Date.now() + validLogos.length;
        validLogos.push(
          `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="hsl(var(--muted))"/><text x="50" y="50" dominant-baseline="middle" text-anchor="middle" fill="hsl(var(--muted-foreground))" font-size="10">Placeholder ${seed}</text></svg>`
        );
      }
    }

    console.log('--- STARTING LETTERHEAD GENERATION ---');
    const letterheadOutput = await generateWithFallback(
      letterheadPrompt,
      LetterheadOutputSchema,
      'Letterhead'
    );
    if (!letterheadOutput || letterheadOutput.letterheads?.length !== 3) {
      throw new Error(
        'Failed to generate 3 valid letterhead designs after trying all models.'
      );
    }
    const letterheads = letterheadOutput.letterheads as Letterhead[];
    console.log('--- FINISHED LETTERHEAD GENERATION ---');

    const brandingResultDocRef = db
      .collection('companies')
      .doc(input.companyId)
      .collection('brandingResults')
      .doc();

    const batch = db.batch();
    batch.update(userRef, {
      resourcePoints: newPoints,
      resourcePointsLastUpdated: now,
    });
    batch.set(brandingResultDocRef, {
      logos: validLogos,
      letterheads,
      prompt: input.prompt,
      referenceImage: input.referenceImage,
      createdAt: now,
    });
    await batch.commit();

    await logActivity({
      ownerId: input.userId,
      actorUid: input.actorUid || input.userId,
      actorName: user.fullName || 'User',
      actionType: 'ai_branding_generated',
      entityType: 'AI',
      entityName: `Branding for ${company.name}`,
      details: { cost: BRANDING_COST, model: 'Fallback Chain' },
    });

    return { logos: validLogos, letterheads, newResourcePoints: newPoints };
  }
);

export async function generateBranding(
  input: GenerateBrandingInput
): Promise<GenerateBrandingOutput> {
  return await generateBrandingFlow(input);
}

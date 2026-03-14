


import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { z } from 'zod';
import { generateMarketingContent } from '@/ai/flows/generate-marketing-content-flow';
import type { GenerateMarketingContentInput, GenerateMarketingContentOutput, MailingListContent } from '@/types/server-only';
export const dynamic = 'force-dynamic';
const productOrServiceSchema = z.object({
  name: z.string().min(1, "Name is required."),
  description: z.string().min(1, "Description is required."),
  imageUrl: z.string().optional().nullable(),
});

const regenerateSchema = z.object({
  prompt: z.string().min(1, "A prompt is required to regenerate content."),
  products: z.array(productOrServiceSchema).optional(),
  userId: z.string(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const contentId = params.id;
  const authAdmin = getAuth();
  const adminDb = getDb();

  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    const requestBody = await request.json();
    const validationResult = regenerateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
    }

    const { prompt, userId, products } = validationResult.data;

    // Authorization check
    if (decodedToken.uid !== userId) {
      return NextResponse.json({ error: 'Forbidden: You can only regenerate content for your own account.' }, { status: 403 });
    }

    const originalContentDoc = await adminDb.collection('mailingListContent').doc(contentId).get();
    if (!originalContentDoc.exists || originalContentDoc.data()?.userId !== userId) {
        return NextResponse.json({ error: 'Original content not found or access denied.' }, { status: 404 });
    }
    const originalContent = originalContentDoc.data() as MailingListContent;
    
    // Construct new input for the generation flow
    const flowInput: GenerateMarketingContentInput = {
        userId,
        contentName: originalContent.contentName,
        prompt: `Regenerate the following content with this new instruction: "${prompt}".\n\nOriginal Subject: ${originalContent.subject}\nOriginal Body: ${originalContent.htmlContent}`,
        isRegeneration: true,
        contentIdToUpdate: contentId,
        products: products, // Pass products to the flow
        companyId: originalContent.companyId || undefined, // Pass original company context
    };

    const result: GenerateMarketingContentOutput = await generateMarketingContent(flowInput);

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`API /marketing/content/[${contentId}]/regenerate error:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

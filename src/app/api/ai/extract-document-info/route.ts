import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { UserProfile, AppConfiguration, TeamMember } from '@/types/server-only';
import { ExtractDocumentInfoInputSchema, ExtractDocumentInfoOutputSchema } from '@/types/server-only';
import type { ExtractDocumentInfoInput, ExtractDocumentInfoOutput } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { MODEL_FALLBACK_LIST } from '@/ai/models';
export const dynamic = 'force-dynamic';
const extractDocumentInfoPromptText = `You are an expert document analyst with OCR capabilities. Analyze the provided image.
    1. Extract all text from the document.
    2. Identify the document type (e.g., Invoice, Receipt, Work Order, Plan).
    3. Extract all relevant key-value pairs (like Invoice No., Date, Total Amount, etc.).
    4. Provide a brief analysis of the document's content and purpose.
    
    Image for analysis: {{media url=imageDataUri}}`;

const extractDocumentInfoFlow = ai.defineFlow(
  {
      name: 'extractDocumentInfoFlow_api',
      inputSchema: ExtractDocumentInfoInputSchema,
      outputSchema: ExtractDocumentInfoOutputSchema,
  },
  async (input) => {
      const adminDb = getDb();
      let actualCost = 10;
      try {
        const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
        if(configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            const costConfig = config.actionCosts?.find(c => c.key === 'AI_DOCUMENT_ANALYSIS_COST');
            if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
        }
      } catch(e) { console.warn("Could not fetch cost for AI document analysis."); }

      const userProfileRef = adminDb.collection('users').doc(input.userId);
      const userProfileSnap = await userProfileRef.get();
      if (!userProfileSnap.exists) throw new Error("User profile not found.");
      const currentPoints = (userProfileSnap.data() as UserProfile).resourcePoints ?? 0;
      if (currentPoints < actualCost) {
          throw new Error(`Insufficient resource points. You need ${actualCost}, but have ${currentPoints}.`);
      }

      let response;
      const schema = ExtractDocumentInfoOutputSchema.omit({ newResourcePoints: true, error: true });
      for (const modelName of MODEL_FALLBACK_LIST) {
        try {
          console.log(`Attempting to generate with model: ${modelName}`);
          const { output } = await ai.generate({
              prompt: extractDocumentInfoPromptText.replace('{{media url=imageDataUri}}', `{{media url='${input.imageDataUri}'}}`),
              model: modelName as any
          });
          if (output) {
              response = schema.parse(output);
              console.log(`Success with model: ${modelName}`);
              break;
          }
        } catch (e: any) {
          console.warn(`Model ${modelName} failed for OCR, trying next...`, e);
        }
      }
      
      if (!response) {
        throw new Error("AI model did not return an output for document analysis after trying all fallbacks.");
      }
      const output = response;
      
      const newResourcePoints = currentPoints - actualCost;
      await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });
      
      await logActivity({
          ownerId: input.userId,
          actorUid: input.actorUid || input.userId,
          actorName: input.actorName || "AI User",
          actionType: 'ai_document_analysis',
          entityType: 'AI',
          entityName: `OCR: ${output.detectedType || 'Document'}`,
          details: { message: `AI document analysis performed.`, cost: actualCost }
      });


      return {
          ...output,
          newResourcePoints, 
      };
  });

export async function POST(request: Request) {
    const functionCallId = `api_extract_document_POST_${Date.now()}`;
    const authAdmin = getAuth();
    const adminDb = getDb();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
          return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
        }
        const idToken = authorizationHeader.split('Bearer ')[1];
        
        let decodedToken;
        try {
          decodedToken = await authAdmin.verifyIdToken(idToken);
        } catch (error: any) {
          return NextResponse.json({ error: 'Unauthorized: Invalid or expired token', code: error.code }, { status: 401 });
        }
        const authenticatedUserUid = decodedToken.uid;

        const input: ExtractDocumentInfoInput = await request.json();
        const dataOwnerIdForRequest = input.userId;

        // Authorization check
        let canUseAI = false;
        if (authenticatedUserUid === dataOwnerIdForRequest) {
            canUseAI = true; // Owner can always use
        } else {
            // Check if actor is a team member with permissions
            const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
            if (actorProfileDoc.exists && (actorProfileDoc.data() as UserProfile)?.ownerId === dataOwnerIdForRequest) {
                const teamMemberDoc = await adminDb.collection('users').doc(dataOwnerIdForRequest).collection('teamMembers').doc(authenticatedUserUid).get();
                if (teamMemberDoc.exists && (teamMemberDoc.data() as TeamMember).permissions?.canUseAiDocumentAnalysis) {
                    canUseAI = true;
                }
            }
        }
        
        if (!canUseAI) {
            return NextResponse.json({ error: 'Forbidden: You do not have permission to use this feature.' }, { status: 403 });
        }
        
        const result = await extractDocumentInfoFlow(input);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error(`[${functionCallId}] Error in /api/extract-document-info:`, error);
        const errorMessage = error.message || 'An unexpected error occurred.';
        const status = (error as any).status || 500;
        const isQuotaError = status === 429 || errorMessage.toLowerCase().includes('quota');
        if (isQuotaError) {
             return NextResponse.json({ error: errorMessage, code: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
        }
        return NextResponse.json({ error: 'Internal Server Error', details: errorMessage, code: (error as any).code || 'UNKNOWN_SERVER_ERROR' });
    }
}

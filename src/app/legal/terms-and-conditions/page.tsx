
// This is a Server Component
import { adminDb } from '@/lib/firebase-admin-init';
import type { AppConfiguration } from '@/types/server-only';
import { DEFAULT_TERMS_AND_CONDITIONS } from '@/lib/constants';
import LegalDocumentDisplay from '@/components/legal/legal-document-display';
import { APP_NAME } from '@/lib/constants';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
async function getTermsContent(): Promise<string> {
    try {
        const configDoc = await adminDb.collection("appConfiguration").doc("mainConfig").get();
        if (configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            return config.termsAndConditionsContent || DEFAULT_TERMS_AND_CONDITIONS;
        }
        return DEFAULT_TERMS_AND_CONDITIONS;
    } catch (error) {
        console.error("Error fetching terms and conditions:", error);
        return DEFAULT_TERMS_AND_CONDITIONS;
    }
}

export async function generateMetadata(): Promise<Metadata> {
  const content = await getTermsContent();
  const description = content.substring(0, 150).replace(/\s+/g, ' ').trim() + '...';
  
  return {
    title: `Terms & Conditions | ${APP_NAME}`,
    description: `Read the Terms and Conditions for ${APP_NAME}. ${description}`,
  };
}


export default async function TermsAndConditionsPage() {
    const content = await getTermsContent();
    return <LegalDocumentDisplay title="Terms and Conditions" content={content} />;
}

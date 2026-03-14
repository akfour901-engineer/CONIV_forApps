
// This is a Server Component
import { adminDb } from '@/lib/firebase-admin-init';
import type { AppConfiguration } from '@/types/server-only';
import { DEFAULT_PRIVACY_POLICY } from '@/lib/constants';
import LegalDocumentDisplay from '@/components/legal/legal-document-display';
import { APP_NAME } from '@/lib/constants';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
async function getPrivacyPolicyContent(): Promise<string> {
    try {
        const configDoc = await adminDb.collection("appConfiguration").doc("mainConfig").get();
        if (configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            return config.privacyPolicyContent || DEFAULT_PRIVACY_POLICY;
        }
        return DEFAULT_PRIVACY_POLICY;
    } catch (error) {
        console.error("Error fetching privacy policy:", error);
        return DEFAULT_PRIVACY_POLICY;
    }
}

export async function generateMetadata(): Promise<Metadata> {
  const content = await getPrivacyPolicyContent();
  const description = content.substring(0, 150).replace(/\s+/g, ' ').trim() + '...';
  
  return {
    title: `Privacy Policy | ${APP_NAME}`,
    description: `Read the Privacy Policy for ${APP_NAME}. ${description}`,
  };
}

export default async function PrivacyPolicyPage() {
    const content = await getPrivacyPolicyContent();
    return <LegalDocumentDisplay title="Privacy Policy" content={content} />;
}

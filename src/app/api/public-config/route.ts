import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin-init';
import type { AppConfiguration } from '@/types/server-only';
import {
  APP_NAME,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_TERMS_AND_CONDITIONS,
  DEFAULT_PRIVACY_POLICY
} from '@/lib/constants';

export const dynamic = 'force-dynamic';

// This is a public API route, no auth is required.
// It consolidates fetching for all public-facing configuration to reduce database reads.
export async function GET() {
    const adminDb = getDb();
    try {
        const configDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
        const configSnap = await configDocRef.get();
        
        if (configSnap.exists) {
            const configData = configSnap.data() as AppConfiguration;
            // Return a specific object with only the data needed by public pages.
            return NextResponse.json({
                appName: configData.appName ?? APP_NAME,
                socialLinks: configData.socialLinks ?? DEFAULT_SOCIAL_LINKS,
                termsAndConditionsContent: configData.termsAndConditionsContent ?? DEFAULT_TERMS_AND_CONDITIONS,
                privacyPolicyContent: configData.privacyPolicyContent ?? DEFAULT_PRIVACY_POLICY,
                mobileAppUrl: configData.mobileAppUrl ?? null,
                desktopAppUrl: configData.desktopAppUrl ?? null,
            });
        }
        
        // If config doesn't exist, return defaults
        return NextResponse.json({ 
            appName: APP_NAME,
            socialLinks: DEFAULT_SOCIAL_LINKS,
            termsAndConditionsContent: DEFAULT_TERMS_AND_CONDITIONS,
            privacyPolicyContent: DEFAULT_PRIVACY_POLICY,
            mobileAppUrl: null,
            desktopAppUrl: null,
        });

    } catch (error: any) {
        console.error("API /api/public-config GET error:", error);
        // In case of error, return defaults to prevent breaking the client
        return NextResponse.json({ 
            appName: APP_NAME,
            socialLinks: DEFAULT_SOCIAL_LINKS, 
            termsAndConditionsContent: DEFAULT_TERMS_AND_CONDITIONS,
            privacyPolicyContent: DEFAULT_PRIVACY_POLICY,
            mobileAppUrl: null,
            desktopAppUrl: null,
            error: "Failed to fetch public config" 
        }, { status: 500 });
    }
}

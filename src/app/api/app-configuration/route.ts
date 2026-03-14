import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { AppConfiguration, UserProfile } from '@/types/server-only';
import {
  ACTION_COSTS_DISPLAY,
  DEFAULT_COIN_PURCHASE_PACKAGES,
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_PRIVACY_POLICY,
  DEFAULT_SIGNUP_RESOURCE_POINTS,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_SYSTEM_EMAILS,
  DEFAULT_TERMS_AND_CONDITIONS
} from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';

export const dynamic = 'force-dynamic';

async function fetchConfigFromFirestore(): Promise<Partial<AppConfiguration>> {
  const adminDb = getDb();
  const configDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
  const configSnap = await configDocRef.get();

  if (configSnap.exists) {
    const configData = configSnap.data() as AppConfiguration;

    const actionCostsMap = new Map((configData.actionCosts || []).map(item => [item.key, item.cost]));
    const mergedActionCosts = ACTION_COSTS_DISPLAY.map(defaultItem => ({
      key: defaultItem.key,
      label: defaultItem.label,
      cost: actionCostsMap.has(defaultItem.key) ? actionCostsMap.get(defaultItem.key)! : 0,
    }));

    return {
      appName: configData.appName || 'ContractX',
      defaultSignupResourcePoints: configData.defaultSignupResourcePoints ?? DEFAULT_SIGNUP_RESOURCE_POINTS,
      actionCosts: mergedActionCosts,
      coinPurchasePackages: configData.coinPurchasePackages?.length ? configData.coinPurchasePackages : DEFAULT_COIN_PURCHASE_PACKAGES,
      temporaryBanners: configData.temporaryBanners || [],
      systemEmails: { ...DEFAULT_SYSTEM_EMAILS, ...(configData.systemEmails || {}) },
      emailTemplates: { ...DEFAULT_EMAIL_TEMPLATES, ...(configData.emailTemplates || {}) },
      socialLinks: { ...DEFAULT_SOCIAL_LINKS, ...(configData.socialLinks || {}) },
      termsAndConditionsContent: configData.termsAndConditionsContent || DEFAULT_TERMS_AND_CONDITIONS,
      privacyPolicyContent: configData.privacyPolicyContent || DEFAULT_PRIVACY_POLICY,
      mobileAppUrl: configData.mobileAppUrl || null,
      desktopAppUrl: configData.desktopAppUrl || null,
      razorpayKeyId: configData.razorpayKeyId || process.env.RAZORPAY_KEY_ID || null,
      razorpayKeySecret: configData.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || null,
      defaultTermsAndConditions: configData.defaultTermsAndConditions || "",
      defaultTaxRate: configData.defaultTaxRate ?? 0,
      defaultPasswordChangeDays: configData.defaultPasswordChangeDays ?? null,
      defaultPinChangeDays: configData.defaultPinChangeDays ?? null,
      featureFlags: configData.featureFlags || { isMarketplaceEnabled: true, isAiToolsEnabled: true },
      defaultSorVisibility: configData.defaultSorVisibility || 'private',
      supportContactPhone: configData.supportContactPhone || null,
    };
  }

  console.warn("⚠️ App configuration 'mainConfig' not found. Returning all defaults.");
  return {
    appName: 'ContractX',
    defaultSignupResourcePoints: DEFAULT_SIGNUP_RESOURCE_POINTS,
    actionCosts: ACTION_COSTS_DISPLAY.map(item => ({ ...item, cost: 0 })),
    coinPurchasePackages: DEFAULT_COIN_PURCHASE_PACKAGES,
    temporaryBanners: [],
    systemEmails: DEFAULT_SYSTEM_EMAILS,
    emailTemplates: DEFAULT_EMAIL_TEMPLATES,
    socialLinks: DEFAULT_SOCIAL_LINKS,
    termsAndConditionsContent: DEFAULT_TERMS_AND_CONDITIONS,
    privacyPolicyContent: DEFAULT_PRIVACY_POLICY,
    mobileAppUrl: null,
    desktopAppUrl: null,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || null,
    defaultTermsAndConditions: "",
    defaultTaxRate: 0,
    defaultPasswordChangeDays: null,
    defaultPinChangeDays: null,
    featureFlags: { isMarketplaceEnabled: true, isAiToolsEnabled: true },
    defaultSorVisibility: 'private',
    supportContactPhone: null,
  };
}

export async function GET(request: Request) {
  try {
    const authAdmin = getAuth();
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    await authAdmin.verifyIdToken(idToken);

    const config = await fetchConfigFromFirestore();
    return NextResponse.json(config);
  } catch (error: any) {
    console.error('❌ API Error in GET /api/app-configuration:', error);
    if(error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return NextResponse.json({ error: 'Unauthorized: Invalid Token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);

    const userProfileSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userProfileSnap.exists || !userProfileSnap.data()?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const adminProfile = userProfileSnap.data() as UserProfile;

    const configData: Partial<AppConfiguration> = await request.json();
    const configDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
    
    await configDocRef.set({
        ...configData,
        updatedAt: new Date().toISOString(),
        updatedBy: decodedToken.uid,
        updatedByName: adminProfile.fullName || adminProfile.email,
    }, { merge: true });
    
    await logActivity({
        ownerId: decodedToken.uid,
        actorUid: decodedToken.uid,
        actorName: adminProfile.fullName || 'Admin',
        actionType: 'update',
        entityType: 'System',
        entityName: 'App Configuration',
        details: 'Admin updated the global application configuration.'
    });

    return NextResponse.json({ success: true, message: 'Configuration updated.' });
  } catch (error: any) {
    console.error('❌ API Error in PUT /api/app-configuration:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

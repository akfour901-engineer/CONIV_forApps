
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import type { Company, Organization, Estimate, SorRate, TeamPermissions, UserProfile } from '@/types';

export const dynamic = 'force-dynamic';

async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
  // A user can always access their own data.
  if (authenticatedUserUid === requestedDataOwnerId) {
    return true;
  }
  
  const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!userProfileDoc.exists) {
    console.warn(`form-data check: User profile for ${authenticatedUserUid} not found.`);
    return false;
  }
  const userProfile = userProfileDoc.data() as UserProfile;

  // A team member can access their owner's data if they have permission.
  if (userProfile.ownerId === requestedDataOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const permissions = teamMemberDocSnap.data()?.permissions as TeamPermissions;
      // Allow if user has permission to create estimates (which requires this data)
      if (permissions?.canCreateEstimates) {
        return true;
      }
    }
  }
  return false;
}

export async function GET(request: Request) {
  const functionCallId = `api_estimate_form_data_GET_${Date.now()}`;
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });

    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    if (!dataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });
    
    const hasPermission = await checkPermissions(authenticatedUserUid, dataOwnerId);
    if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [companiesSnap, userOrgsSnap, publicOrgsSnap, userSorRatesSnap, publicSorSnap, estimatesSnap] = await Promise.all([
      adminDb.collection('companies').where('userId', '==', dataOwnerId).get(),
      adminDb.collection('organizations').where('userId', '==', dataOwnerId).get(),
      adminDb.collection('organizations').where('visibility', '==', 'public').get(),
      adminDb.collection('sorRates').where('userId', '==', dataOwnerId).get(),
      adminDb.collection('sorRates').where('visibility', '==', 'public').get(),
      adminDb.collection('estimates').where('userId', '==', dataOwnerId).get() // Also fetch estimates for templating
    ]);

    const companies: Company[] = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
    
    const organizationsMap = new Map<string, Organization>();
    userOrgsSnap.docs.forEach(doc => {
      organizationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Organization);
    });
    publicOrgsSnap.docs.forEach(doc => {
      if (!organizationsMap.has(doc.id)) {
        organizationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Organization);
      }
    });

    const estimates: Estimate[] = estimatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Estimate));

    const sorRatesMap = new Map<string, SorRate>();
    userSorRatesSnap.docs.forEach(doc => sorRatesMap.set(doc.id, { id: doc.id, ...doc.data() } as SorRate));
    publicSorSnap.docs.forEach(doc => {
        if (!sorRatesMap.has(doc.id)) {
            sorRatesMap.set(doc.id, { id: doc.id, ...doc.data() } as SorRate);
        }
    });
    const combinedSorRates = Array.from(sorRatesMap.values());

    return NextResponse.json({
      companies,
      organizations: Array.from(organizationsMap.values()),
      estimates,
      sorRates: combinedSorRates,
    }, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error fetching form data for estimate:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

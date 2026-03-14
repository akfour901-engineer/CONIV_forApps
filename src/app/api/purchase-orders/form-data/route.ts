
import { NextResponse } from 'next/server';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { Company, Organization, WorkOrder, SorRate, TeamPermissions, UserProfile, Subcontractor } from '@/types';

export const dynamic = 'force-dynamic';

async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
  const adminDb = getDb();
  if (authenticatedUserUid === requestedDataOwnerId) return true;
  
  const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!userProfileDoc.exists) return false;
  const userProfile = userProfileDoc.data() as UserProfile;

  if (userProfile.ownerId === requestedDataOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const permissions = teamMemberDocSnap.data()?.permissions as TeamPermissions;
      if (permissions?.canCreatePurchaseOrders) return true;
    }
  }
  return false;
}

export async function GET(request: Request) {
  const functionCallId = `api_po_form_data_GET_${Date.now()}`;
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });

    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const authenticatedUserUid = decodedToken.uid;

    const url = new URL(request.url);
    const dataOwnerId = url.searchParams.get('dataOwnerId');
    const companyId = url.searchParams.get('companyId'); // Get companyId from query

    if (!dataOwnerId) return NextResponse.json({ error: 'Bad Request: dataOwnerId is required' }, { status: 400 });
    
    const hasPermission = await checkPermissions(authenticatedUserUid, dataOwnerId);
    if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let workOrdersQuery = adminDb.collection('workOrders').where('userId', '==', dataOwnerId);
    if (companyId) {
      // Filter work orders by the selected company if a companyId is provided
      workOrdersQuery = workOrdersQuery.where('companyId', '==', companyId);
    }
    
    const [companiesSnap, orgsSnap, subcontractorsSnap, workOrdersSnap, sorRatesSnap, publicSorSnap] = await Promise.all([
      adminDb.collection('companies').where('userId', '==', dataOwnerId).get(),
      adminDb.collection('organizations').where('userId', '==', dataOwnerId).get(),
      adminDb.collection('subcontractors').where('userId', '==', dataOwnerId).get(),
      workOrdersQuery.get(), // Use the potentially filtered query
      adminDb.collection('sorRates').where('userId', '==', dataOwnerId).get(),
      adminDb.collection('sorRates').where('visibility', '==', 'public').get()
    ]);

    const companies: Company[] = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
    
    const organizationsMap = new Map<string, Organization>();
    orgsSnap.docs.forEach(doc => organizationsMap.set(doc.id, { id: doc.id, ...doc.data() } as Organization));

    const subcontractors: Subcontractor[] = subcontractorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subcontractor));

    const workOrders: WorkOrder[] = workOrdersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkOrder));
    workOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const sorRatesMap = new Map<string, SorRate>();
    sorRatesSnap.docs.forEach(doc => sorRatesMap.set(doc.id, { id: doc.id, ...doc.data() } as SorRate));
    publicSorSnap.docs.forEach(doc => {
        if (!sorRatesMap.has(doc.id)) {
            sorRatesMap.set(doc.id, { id: doc.id, ...doc.data() } as SorRate);
        }
    });
    const combinedSorRates = Array.from(sorRatesMap.values());

    return NextResponse.json({
      companies,
      organizations: Array.from(organizationsMap.values()),
      subcontractors,
      workOrders,
      sorRates: combinedSorRates,
    }, { status: 200 });

  } catch (error: any) {
    console.error(`[${functionCallId}] Error fetching form data for PO:`, error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

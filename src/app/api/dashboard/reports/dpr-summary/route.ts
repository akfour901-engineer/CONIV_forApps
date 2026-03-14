import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { DailyProgressReport } from '@/types';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();

  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // Expects YYYY-MM format
    const workOrderId = searchParams.get('workOrderId');

    if (!month || !workOrderId) {
      return NextResponse.json({ error: 'Month (YYYY-MM) and Work Order ID are required.' }, { status: 400 });
    }

    const startDate = startOfMonth(parseISO(month));
    const endDate = endOfMonth(parseISO(month));

    const dprQuery = adminDb.collection('dailyProgressReports')
      .where('userId', '==', userId)
      .where('workOrderId', '==', workOrderId)
      .where('reportDate', '>=', startDate.toISOString().split('T')[0])
      .where('reportDate', '<=', endDate.toISOString().split('T')[0])
      .orderBy('reportDate', 'asc');

    const dprSnapshot = await dprQuery.get();
    
    if (dprSnapshot.empty) {
      return NextResponse.json({ message: "No DPRs found for the selected period." }, { status: 200 });
    }

    const reports = dprSnapshot.docs.map(doc => doc.data() as DailyProgressReport);
    
    // Simple summary for now. More complex aggregation can be added.
    const summary = {
      totalReports: reports.length,
      averageRating: reports.reduce((acc, r) => acc + r.workRating, 0) / reports.length,
      consumedItemsSummary: reports.flatMap(r => r.consumedItems || []).reduce((acc, item) => {
        if (!acc[item.description]) {
          acc[item.description] = { totalQuantity: 0, totalAmount: 0, unit: item.rate };
        }
        acc[item.description].totalQuantity += item.consumedQuantity;
        acc[item.description].totalAmount += item.amount;
        return acc;
      }, {} as Record<string, { totalQuantity: number, totalAmount: number, unit: number }>)
    };

    return NextResponse.json(summary, { status: 200 });

  } catch (error: any) {
    console.error("[API/dpr-summary] Error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

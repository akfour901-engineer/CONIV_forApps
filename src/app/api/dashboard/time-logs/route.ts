import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin-init';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { LabourRegister, LabourTimeLog, WorkOrder, UserProfile, TeamMember, AppConfiguration, LabourAdvance } from '@/types';
import { TIME_TRACKING_LOG_COST } from '@/lib/constants';
import { logActivity } from '@/lib/activityLog';
import { recalculateLabourerTotals } from '@/lib/server-utils';
export const dynamic = 'force-dynamic';
const timeLogGetSchema = z.object({
  workOrderId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}$/, "Date must be in YYYY-MM format."),
  dataOwnerId: z.string().min(1),
});

const timeLogPostSchema = z.object({
  dataOwnerId: z.string().min(1),
  workOrderId: z.string().min(1),
  timeLogItem: z.object({
    labourRegisterId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    hoursWorked: z.number().min(0).max(24).nullable(),
    remarks: z.string().max(200).nullable(),
    existingTimeLogId: z.string().optional().nullable(),
  }),
});

async function checkPermissions(authenticatedUserUid: string, requestedDataOwnerId: string): Promise<boolean> {
  if (authenticatedUserUid === requestedDataOwnerId) return true;
  
  const userProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!userProfileDoc.exists) return false;
  const userProfile = userProfileDoc.data() as UserProfile;

  if (userProfile.ownerId === requestedDataOwnerId) {
    const teamMemberDocRef = adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid);
    const teamMemberDocSnap = await teamMemberDocRef.get();
    if (teamMemberDocSnap.exists) {
      const permissions = (teamMemberDocSnap.data() as TeamMember).permissions;
      return permissions?.canRecordLabourAttendance || permissions?.canManageTimeTracking || false;
    }
  }
  return false;
}

export async function GET(request: Request) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = await adminAuth.verifyIdToken(authorizationHeader.split('Bearer ')[1]);
    
    const url = new URL(request.url);
    const { dataOwnerId, workOrderId, date } = Object.fromEntries(url.searchParams.entries());

    const hasPermission = await checkPermissions(idToken.uid, dataOwnerId);
    if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [year, month] = date.split('-').map(Number);
    const startDate = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
    
    const labourersSnapshot = await adminDb.collection('labourRegisters')
      .where('userId', '==', dataOwnerId)
      .where('workOrderId', '==', workOrderId)
      .get();
    
    const labourers = labourersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabourRegister));
    
    // Fetch all logs for the work order first, then filter by date in code.
    const timeLogsSnapshot = await adminDb.collection('labourTimeLogs')
        .where('userId', '==', dataOwnerId)
        .where('workOrderId', '==', workOrderId)
        .get();
      
    const timeLogs = timeLogsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as LabourTimeLog & { id: string }))
        .filter(log => log.date >= startDate && log.date <= endDate)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return NextResponse.json({ labourers, timeLogs }, { status: 200 });
  } catch (error: any) {
    console.error("API /api/time-logs GET error:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = await adminAuth.verifyIdToken(authorizationHeader.split('Bearer ')[1]);
        const actorUid = idToken.uid;
        
        const requestBody = await request.json();
        const validationResult = timeLogPostSchema.safeParse(requestBody);
        if(!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
        
        const { dataOwnerId, workOrderId, timeLogItem } = validationResult.data;
        const hasPermission = await checkPermissions(actorUid, dataOwnerId);
        if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        
        const actorProfileSnap = await adminDb.collection('users').doc(actorUid).get();
        if(!actorProfileSnap.exists) throw new Error('Actor profile not found');
        const actorProfile = actorProfileSnap.data() as UserProfile;

        // Point deduction logic for a single log change
        const costPerLog = (await adminDb.collection("appConfiguration").doc("mainConfig").get()).data()?.actionCosts?.find((c: any) => c.key === 'TIME_TRACKING_LOG_COST')?.cost ?? TIME_TRACKING_LOG_COST;
        
        const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
        let newResourcePoints;

        await adminDb.runTransaction(async (transaction) => {
            const now = new Date().toISOString();
            
            // --- All READS must come before any writes ---
            const pointPayerProfileSnap = await transaction.get(pointPayerProfileRef);
            if(!pointPayerProfileSnap.exists) throw new Error("Point payer profile not found.");
            const currentPoints = (pointPayerProfileSnap.data() as UserProfile).resourcePoints ?? 0;
            if (currentPoints < costPerLog) {
                throw new Error(`Insufficient points. You need ${costPerLog} to log an entry.`);
            }

            const { labourerRef, totalDaysWorked, totalAmount, advancesPaid, netAmount } = await recalculateLabourerTotals(timeLogItem.labourRegisterId, transaction, {
              date: timeLogItem.date,
              hoursWorked: timeLogItem.hoursWorked,
            });
            // --- End of READS ---

            // Now perform all WRITES
            const logData: Omit<LabourTimeLog, 'id'> = {
                userId: dataOwnerId,
                createdByName: actorProfile.fullName || actorProfile.email || 'N/A',
                labourRegisterId: timeLogItem.labourRegisterId,
                workOrderId: workOrderId,
                date: timeLogItem.date,
                hoursWorked: timeLogItem.hoursWorked,
                remarks: timeLogItem.remarks,
                createdAt: now,
                updatedAt: now,
                updatedBy: actorUid,
            };

            if (timeLogItem.existingTimeLogId) {
                const docRef = adminDb.collection('labourTimeLogs').doc(timeLogItem.existingTimeLogId);
                transaction.update(docRef, { hoursWorked: timeLogItem.hoursWorked, remarks: timeLogItem.remarks, updatedAt: now, updatedBy: actorUid });
            } else {
                const docRef = adminDb.collection('labourTimeLogs').doc();
                transaction.set(docRef, logData);
            }

            // Write the recalculated totals
            transaction.update(labourerRef, {
                totalDaysWorked,
                totalAmount,
                advancesPaid,
                netAmount,
                updatedAt: now,
            });

            // Deduct points
            newResourcePoints = currentPoints - costPerLog;
            transaction.update(pointPayerProfileRef, { resourcePoints: newResourcePoints });
        });

        const labourerName = (await adminDb.collection('labourRegisters').doc(timeLogItem.labourRegisterId).get()).data()?.workerName || 'Labourer';

        await logActivity({
            ownerId: dataOwnerId,
            actorUid: actorUid,
            actorName: actorProfile.fullName || actorProfile.email || 'User',
            actionType: 'attendance_marked',
            entityType: 'LabourTimeLog',
            entityName: `${labourerName} on ${timeLogItem.date}`,
            details: {
                message: `Attendance updated for ${labourerName}. Hours: ${timeLogItem.hoursWorked ?? 'N/A'}.`,
                cost: costPerLog
            }
        });

        return NextResponse.json({ message: 'Time log saved successfully', newResourcePoints }, { status: 200 });

    } catch (error: any) {
        console.error("API /api/time-logs POST error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

    
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { Task, UserProfile, TeamMember, AppConfiguration, WorkOrder } from '@/types';
import { TASK_CREATION_COST } from '@/lib/constants';
import { logActivity } from '@/lib/activityLog';
import { format } from 'date-fns';
export const dynamic = 'force-dynamic';
const baseTaskSchema = z.object({
  name: z.string().min(1, "Task name is required."),
  startDate: z.union([z.string(), z.date()]).refine(val => !isNaN(Date.parse(val.toString())), { message: "Invalid start date." }),
  endDate: z.union([z.string(), z.date()]).refine(val => !isNaN(Date.parse(val.toString())), { message: "Invalid end date." }),
  progress: z.coerce.number().min(0).max(100).default(0),
  dependencies: z.string().optional().nullable(),
});

const taskUpdateSchema = baseTaskSchema.extend({
  id: z.string().min(1),
  workOrderId: z.string().min(1),
});

const taskCreateSchema = baseTaskSchema.extend({
  workOrderId: z.string().min(1),
});

const taskDeleteSchema = z.object({
  id: z.string().min(1),
});

async function canAccess(
  authenticatedUserUid: string,
  workOrderId: string
): Promise<{ authorized: boolean; dataOwnerId?: string; actorProfile?: UserProfile }> {
  const adminDb = getDb();
  
  const woDoc = await adminDb.collection('workOrders').doc(workOrderId).get();
  if (!woDoc.exists) {
    return { authorized: false };
  }
  const dataOwnerId = woDoc.data()!.userId;

  const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
  if (!actorProfileDoc.exists) {
    return { authorized: false };
  }
  const actorProfile = { uid: actorProfileDoc.id, ...actorProfileDoc.data() } as UserProfile;

  if (authenticatedUserUid === dataOwnerId) {
    return { authorized: true, dataOwnerId, actorProfile };
  }

  if (actorProfile.ownerId === dataOwnerId) {
    const memberDoc = await adminDb.collection('users').doc(dataOwnerId).collection('teamMembers').doc(authenticatedUserUid).get();
    if (memberDoc.exists) {
      const permissions = (memberDoc.data() as TeamMember).permissions;
      if (permissions?.canViewWorkOrders || permissions?.canEditWorkOrders || permissions?.canCreateWorkOrders || permissions?.canViewGanttCharts) {
        return { authorized: true, dataOwnerId, actorProfile };
      }
    }
  }

  return { authorized: false };
}


export async function GET(request: Request) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const authenticatedUserUid = decodedToken.uid;

        const url = new URL(request.url);
        const workOrderId = url.searchParams.get('workOrderId');
        if (!workOrderId) return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 });
        
        const authResult = await canAccess(authenticatedUserUid, workOrderId);
        if (!authResult.authorized) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const tasksSnapshot = await adminDb.collection('tasks').where('workOrderId', '==', workOrderId).get();
        const tasks: Task[] = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        
        tasks.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        
        return NextResponse.json(tasks, { status: 200 });

    } catch(error: any) {
        console.error("API GET /api/tasks error:", error);
        if (error.code === 9) {
             return NextResponse.json({ error: 'A Firestore index is required. Please check server logs for details.' }, { status: 500 });
        }
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
  const adminDb = getDb();
  const authAdmin = getAuth();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = await authAdmin.verifyIdToken(authorizationHeader.split('Bearer ')[1]);
    const authenticatedUserUid = idToken.uid;
    
    const requestBody = await request.json();
    
    // Determine if it's an update or create based on the presence of an 'id'
    if (requestBody.id) {
        // This is an update
        const validationResult = taskUpdateSchema.safeParse(requestBody);
        if (!validationResult.success) return NextResponse.json({ error: 'Invalid input for update', details: validationResult.error.flatten() }, { status: 400 });
        const { id, workOrderId, ...dataToUpdate } = validationResult.data;

        const authResult = await canAccess(authenticatedUserUid, workOrderId);
        if (!authResult.authorized || !authResult.dataOwnerId || !authResult.actorProfile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const taskRef = adminDb.collection('tasks').doc(id);
        const updatePayload: Partial<Task> = { 
            ...dataToUpdate,
            startDate: format(new Date(dataToUpdate.startDate), 'yyyy-MM-dd'),
            endDate: format(new Date(dataToUpdate.endDate), 'yyyy-MM-dd'),
            updatedAt: new Date().toISOString() 
        };
        
        await taskRef.update(updatePayload);

        console.log("LOGGING ACTIVITY FOR: Task Update");
        await logActivity({
          ownerId: authResult.dataOwnerId,
          actorUid: authenticatedUserUid,
          actorName: authResult.actorProfile.fullName || "User",
          actionType: 'update',
          entityType: 'Task',
          entityId: id,
          entityName: dataToUpdate.name,
          details: `Task '${dataToUpdate.name}' updated.`
        });
        console.log("LOGGING COMPLETE FOR: Task Update");

        const updatedDoc = await taskRef.get();
        return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() }, { status: 200 });

    } else {
        // This is a create
        const validationResult = taskCreateSchema.safeParse(requestBody);
        if (!validationResult.success) return NextResponse.json({ error: 'Invalid input for create', details: validationResult.error.flatten() }, { status: 400 });
        const { workOrderId, ...data } = validationResult.data;

        const authResult = await canAccess(authenticatedUserUid, workOrderId);
        if (!authResult.authorized || !authResult.dataOwnerId || !authResult.actorProfile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const { dataOwnerId, actorProfile } = authResult;
        
        const pointPayerProfileRef = adminDb.collection('users').doc(dataOwnerId);
        let actualCost = TASK_CREATION_COST;
        try {
            const appConfigSnap = await adminDb.collection("appConfiguration").doc("mainConfig").get();
            if(appConfigSnap.exists) {
                const configData = appConfigSnap.data() as AppConfiguration;
                actualCost = configData.actionCosts?.find(c => c.key === 'TASK_CREATION_COST')?.cost ?? TASK_CREATION_COST;
            }
        } catch(e) { console.warn("Could not fetch cost config for task creation"); }

        const pointPayerProfileSnap = await pointPayerProfileRef.get();
        if (!pointPayerProfileSnap.exists) throw new Error("Data owner profile not found for billing.");
        const pointPayerProfileData = pointPayerProfileSnap.data() as UserProfile;
        if ((pointPayerProfileData.resourcePoints ?? 0) < actualCost) {
            return NextResponse.json({ error: `Insufficient resource points. Owner needs ${actualCost}.`, code: 'INSUFFICIENT_POINTS' }, { status: 402 });
        }
        
        const now = new Date().toISOString();
        const newTaskData: Omit<Task, 'id'> = {
            userId: dataOwnerId, workOrderId: workOrderId, ...data,
            startDate: format(new Date(data.startDate), 'yyyy-MM-dd'),
            endDate: format(new Date(data.endDate), 'yyyy-MM-dd'),
            progress: data.progress || 0, dependencies: data.dependencies || null,
            createdAt: now, updatedAt: now,
        };

        const batch = adminDb.batch();
        const newTaskRef = adminDb.collection('tasks').doc();
        batch.set(newTaskRef, newTaskData);
        batch.update(pointPayerProfileRef, { resourcePoints: admin.firestore.FieldValue.increment(-actualCost) });
        await batch.commit();

        const newResourcePoints = (pointPayerProfileData.resourcePoints ?? 0) - actualCost;
        
        const workOrderNumber = (await adminDb.collection('workOrders').doc(workOrderId).get()).data()?.workOrderNumber || 'N/A';
        console.log("LOGGING ACTIVITY FOR: Task Creation");
        await logActivity({
          ownerId: dataOwnerId, actorUid: authenticatedUserUid, actorName: actorProfile.fullName || "User",
          actionType: 'create', entityType: 'Task', entityId: newTaskRef.id, entityName: newTaskData.name,
          details: { message: `Task '${newTaskData.name}' created for WO #${workOrderNumber}.`, cost: actualCost }
        });
        console.log("LOGGING COMPLETE FOR: Task Creation");

        return NextResponse.json({ id: newTaskRef.id, ...newTaskData, newResourcePoints, cost: actualCost }, { status: 201 });
    }

  } catch (error: any) {
    console.error("API POST /api/tasks error:", error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
    const adminDb = getDb();
    const authAdmin = getAuth();
    try {
        const authorizationHeader = request.headers.get('Authorization');
        if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const idToken = authorizationHeader.split('Bearer ')[1];
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const authenticatedUserUid = decodedToken.uid;

        const requestBody = await request.json();
        const validationResult = taskDeleteSchema.safeParse(requestBody);
        if (!validationResult.success) return NextResponse.json({ error: 'Invalid input', details: validationResult.error.flatten() }, { status: 400 });
        
        const { id } = validationResult.data;
        const taskRef = adminDb.collection('tasks').doc(id);
        const taskSnap = await taskRef.get();
        if(!taskSnap.exists) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        
        const taskData = taskSnap.data() as Task;
        
        const authResult = await canAccess(authenticatedUserUid, taskData.workOrderId);
        if (!authResult.authorized || !authResult.dataOwnerId || !authResult.actorProfile) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const workOrderNumber = (await adminDb.collection('workOrders').doc(taskData.workOrderId).get()).data()?.workOrderNumber || 'N/A';
        await taskRef.delete();
        
        console.log("LOGGING ACTIVITY FOR: Task Deletion");
        await logActivity({
          ownerId: authResult.dataOwnerId, actorUid: authenticatedUserUid, actorName: authResult.actorProfile.fullName || "User",
          actionType: 'delete', entityType: 'Task', entityId: id, entityName: taskData.name,
          details: `Task '${taskData.name}' from WO #${workOrderNumber} deleted.`
        });
        console.log("LOGGING COMPLETE FOR: Task Deletion");

        return NextResponse.json({ message: 'Task deleted' }, { status: 200 });

    } catch (error: any) {
        console.error("API DELETE /api/tasks error:", error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

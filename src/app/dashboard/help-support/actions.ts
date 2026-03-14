
'use server';

import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin-init';
import { logActivity } from '@/lib/activityLog';
import type { UserSubmission, UserSubmissionType, UserProfile } from '@/types';
import { USER_SUBMISSION_TYPE_OPTIONS } from '@/types';

const supportFormSchema = z.object({
  submissionType: z.enum(USER_SUBMISSION_TYPE_OPTIONS),
  subject: z.string().min(5).max(150),
  description: z.string().min(20).max(2000),
  attachmentUrl: z.string().optional().nullable(),
});

type SupportFormValues = z.infer<typeof supportFormSchema>;

export async function createSubmission(values: SupportFormValues, userId: string, userProfile: UserProfile | null): Promise<{success: boolean, error?: string}> {
    try {
        if (!userId || !userProfile) {
            throw new Error("User authentication data is missing.");
        }

        const now = new Date().toISOString();

        const newSubmission: Omit<UserSubmission, 'id'> = {
            userId: userId,
            userName: userProfile.fullName || userProfile.email || 'N/A',
            userEmail: userProfile.email || 'N/A',
            submissionType: values.submissionType,
            subject: values.subject,
            description: values.description,
            status: 'New',
            attachmentUrl: values.attachmentUrl || null,
            createdAt: now,
            updatedAt: now,
        };

        const newDocRef = await adminDb.collection('userSubmissions').add(newSubmission);
        
        await logActivity({
            ownerId: userId,
            actorUid: userId,
            actorName: userProfile.fullName || userProfile.email || "User",
            actionType: 'create',
            entityType: 'UserSubmission',
            entityId: newDocRef.id,
            entityName: `Submission: ${values.subject.substring(0, 50)}...`,
            details: 'User created a new support/feedback submission.'
        });
        
        return { success: true };
    } catch (error: any) {
        console.error("Error in createSubmission server action:", error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

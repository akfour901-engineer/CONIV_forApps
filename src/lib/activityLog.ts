import { getDb } from './firebase-admin-init';
import type { ActivityLog } from '@/types';

export async function logActivity(logData: Omit<ActivityLog, 'id' | 'timestamp'>) {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    await db.collection('activityLogs').add({
      ...logData,
      timestamp: now,
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}
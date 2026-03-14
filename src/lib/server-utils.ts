import { getDb } from './firebase-admin-init';
import type { LabourRegister, LabourTimeLog, LabourAdvance } from '@/types';

export async function recalculateLabourerTotals(labourerId: string, transaction?: any, newLog?: { date: string, hoursWorked: number | null }) {
  const db = getDb();
  const labourerRef = db.collection('labourRegisters').doc(labourerId);
  
  const [attendanceSnap, advancesSnap] = await Promise.all([
    db.collection('labourTimeLogs').where('labourRegisterId', '==', labourerId).get(),
    db.collection('labourAdvances').where('labourRegisterId', '==', labourerId).get()
  ]);

  const logs = attendanceSnap.docs.map(d => d.data() as LabourTimeLog);
  const advances = advancesSnap.docs.map(d => d.data() as LabourAdvance);

  if (newLog) {
      const existingLogIndex = logs.findIndex(l => l.date === newLog.date);
      if (existingLogIndex >= 0) {
          logs[existingLogIndex].hoursWorked = newLog.hoursWorked;
      } else {
          logs.push(newLog as LabourTimeLog);
      }
  }

  const presentDates = new Set(logs.filter(l => (l.hoursWorked ?? 0) > 0).map(l => l.date));
  const totalDaysWorked = presentDates.size;
  
  const labourerDoc = (await labourerRef.get()).data() as LabourRegister;
  const totalAmount = totalDaysWorked * (labourerDoc.dailyWage || 0);
  const advancesPaid = advances.reduce((sum, a) => sum + a.amount, 0);
  const netAmount = totalAmount - advancesPaid;

  const updateData = {
    totalDaysWorked,
    totalAmount,
    advancesPaid,
    netAmount,
    updatedAt: new Date().toISOString()
  };

  if (transaction) {
    transaction.update(labourerRef, updateData);
  } else {
    await labourerRef.update(updateData);
  }

  return { labourerRef, ...updateData };
}
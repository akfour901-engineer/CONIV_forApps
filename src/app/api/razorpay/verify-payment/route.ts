

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, getAuth } from '@/lib/firebase-admin-init';
import type { UserProfile, PaymentTransaction, AppConfiguration } from '@/types';
import { logActivity } from '@/lib/activityLog';
import * as admin from 'firebase-admin';
import { sendPurchaseConfirmationEmail } from '@/ai/flows/internal/send-purchase-confirmation-email-flow';
export const dynamic = 'force-dynamic';

const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;


export async function POST(request: Request) {
  const functionCallId = `api_verify_payment_POST_${Date.now()}`;
  console.log(`[${functionCallId}] /api/razorpay/verify-payment: Request received.`);
  const adminDb = getDb();
  const authAdmin = getAuth();
  
  if (!razorpayKeySecret) {
    console.error(`[${functionCallId}] RAZORPAY_KEY_SECRET is not set.`);
    return NextResponse.json({ error: 'Server configuration error (RZS_MISS).', verified: false }, { status: 503 });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dataOwnerId } = await request.json();
    
    // 1. Signature Verification
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret).update(body.toString()).digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn(`[${functionCallId}] Signature mismatch for order: ${razorpay_order_id}`);
      return NextResponse.json({ error: 'Payment verification failed: Invalid signature.', verified: false }, { status: 400 });
    }
    console.log(`[${functionCallId}] Signature verified successfully for order: ${razorpay_order_id}`);

    // 2. Authorization
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const actorUid = decodedToken.uid;

    if (!dataOwnerId) {
      return NextResponse.json({ error: 'Bad Request: dataOwnerId is required.' }, { status: 400 });
    }

    const [actorProfileDoc, ownerProfileDoc] = await Promise.all([
      adminDb.collection('users').doc(actorUid).get(),
      adminDb.collection('users').doc(dataOwnerId).get()
    ]);
    if (!actorProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Actor profile not found.' }, { status: 403 });
    if (!ownerProfileDoc.exists) return NextResponse.json({ error: 'Forbidden: Owner profile not found.' }, { status: 404 });

    const actorProfile = actorProfileDoc.data() as UserProfile;
    const ownerProfile = ownerProfileDoc.data() as UserProfile;

    if (actorUid !== dataOwnerId && actorProfile.ownerId !== dataOwnerId) {
        return NextResponse.json({ error: 'Forbidden: You are not authorized to purchase for this account.' }, { status: 403 });
    }
    
    // 3. Fetch Pending Payment Details from Firestore
    const pendingPaymentRef = adminDb.collection('pendingPayments').doc(razorpay_order_id);
    const pendingPaymentSnap = await pendingPaymentRef.get();
    if (!pendingPaymentSnap.exists) {
        throw new Error(`Pending payment record not found for order ID: ${razorpay_order_id}. Cannot credit points.`);
    }
    const orderNotes = pendingPaymentSnap.data();

    // 4. Firestore Updates (Atomic Batch)
    const targetUserDocRef = adminDb.collection('users').doc(dataOwnerId);
    const paymentTxRef = adminDb.collection('paymentTransactions').doc();
    
    const { packageId, packageName, pointsToCredit, amountPaid, paymentType } = orderNotes as any;
    
    const amountPaidNum = Number(amountPaid);
    const pointsToCreditNum = Number(pointsToCredit);

    if (isNaN(pointsToCreditNum)) {
        throw new Error('Invalid pointsToCredit value received from pending payment record.');
    }
    
    const paymentTransactionData: Omit<PaymentTransaction, 'id'> = {
      userId: dataOwnerId,
      userName: ownerProfile.fullName || undefined,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      packageId, packageName, amountPaid: amountPaidNum, currency: 'INR', pointsAwarded: pointsToCreditNum,
      status: 'captured',
      transactionDate: new Date().toISOString(),
      method: 'razorpay',
      metadata: { paymentType: paymentType || 'coin_purchase', actorUid, actorName: actorProfile.fullName || undefined, userEmail: ownerProfile.email || undefined }
    };

    const batch = adminDb.batch();
    
    batch.set(paymentTxRef, paymentTransactionData);

    const currentPoints = ownerProfile.resourcePoints ?? 0;
    const newBalance = currentPoints + pointsToCreditNum;

    if(pointsToCreditNum > 0) {
      batch.update(targetUserDocRef, {
        resourcePoints: admin.firestore.FieldValue.increment(pointsToCreditNum),
        resourcePointsLastUpdated: new Date().toISOString(),
      });
    }

    // Delete the pending payment record
    batch.delete(pendingPaymentRef);
    
    await batch.commit();
    console.log(`[${functionCallId}] Firestore batch commit successful for order ${razorpay_order_id}.`);
    
    // 5. Activity Logging
    await logActivity({
      ownerId: dataOwnerId,
      actorUid: actorUid,
      actorName: actorProfile.fullName || "User",
      actionType: paymentType === 'support_contribution' ? 'support_payment_success' : 'coin_purchase_success',
      entityType: 'PaymentTransaction',
      entityId: razorpay_payment_id,
      entityName: packageName,
      details: {
        message: `Payment successful: ${packageName}.`,
        cost: paymentType === 'support_contribution' ? undefined : 0,
        pointsAwarded: pointsToCreditNum,
        amountPaid: amountPaid,
        package: packageName,
        purchaserUid: actorUid,
      },
    });

    // 6. Send Email Confirmation - Conditionally
    if (paymentType === 'coin_purchase' && ownerProfile.email && pointsToCreditNum > 0) {
      await sendPurchaseConfirmationEmail({
          userId: dataOwnerId,
          userName: ownerProfile.fullName || 'Valued Customer',
          userEmail: ownerProfile.email,
          packageName: packageName,
          pointsAwarded: pointsToCreditNum,
          amountPaid: amountPaidNum,
          newBalance: newBalance,
          transactionId: razorpay_payment_id,
      });
    }

    // 7. Respond to Client - Unconditionally
    return NextResponse.json({ 
        message: 'Payment verified and processed successfully.',
        verified: true,
        newResourcePoints: newBalance
    }, { status: 200 });

  } catch (error: any) { 
    console.error(`[${functionCallId}] UNHANDLED error in /api/razorpay/verify-payment:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error during payment verification.', verified: false }, { status: 500 });
  }
}

    

    
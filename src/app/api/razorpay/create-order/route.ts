

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin-init';
import Razorpay from 'razorpay';
import type { AppConfigCoinPurchasePackage, AppConfiguration } from '@/types';
export const dynamic = 'force-dynamic';
// --- Start of a new debug block ---
console.log("--- Razorpay API Route Initialization (razorpay.ts) ---");
const keyIdFromEnv = process.env.RAZORPAY_KEY_ID;
const keySecretFromEnv = process.env.RAZORPAY_KEY_SECRET;
console.log("RAZORPAY_KEY_ID (razorpay.ts) from process.env:", keyIdFromEnv ? `${keyIdFromEnv.substring(0, 8)}...` : "NOT FOUND");
console.log("RAZORPAY_KEY_SECRET (razorpay.ts) from process.env:", keySecretFromEnv ? "Exists (sensitive)" : "NOT FOUND");

let razorpayInstance: Razorpay | null = null;
if (keyIdFromEnv && keySecretFromEnv) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyIdFromEnv,
      key_secret: keySecretFromEnv,
    });
    console.log("Razorpay SDK instance (razorpay.ts): Successfully created.");
    // @ts-ignore
    console.log("Razorpay SDK instance (razorpay.ts): Initialized with key_id prefix:", razorpayInstance.key_id ? 'INSTANCE OR KEY_ID FIELD UNDEFINED' : 'UNDEFINED');
  } catch(e) {
    console.error("Razorpay SDK instance (razorpay.ts): FAILED to create.", e);
  }
} else {
  console.error("Razorpay SDK instance (razorpay.ts): NOT created due to missing env vars.");
}
console.log("--- End Razorpay Library Initialization (razorpay.ts) ---");
// --- End of the new debug block ---

const MIN_CUSTOM_AMOUNT = 10;
const MIN_CUSTOM_SUPPORT_AMOUNT = 10;
const MAX_CUSTOM_SUPPORT_AMOUNT = 10000;
const HIGH_VALUE_THRESHOLD = 3999;
const HIGH_VALUE_RATE = 9.5;

function calculatePointsForCustomApiAmount(
  amount: number, 
  packages: AppConfigCoinPurchasePackage[]
): number {
  if (isNaN(amount) || amount < MIN_CUSTOM_AMOUNT) {
    console.warn(`API: Custom coin amount ${amount} is below the minimum of ${MIN_CUSTOM_AMOUNT}.`);
    return 0;
  }
  if (!packages || packages.length === 0) {
    console.warn("API: Coin packages not available for rate calculation for custom purchase.");
    return 0;
  }
  const sortedPackages = [...packages].sort((a, b) => a.amount - b.amount);
  const exactMatchPackage = sortedPackages.find(p => p.amount === amount);
  if (exactMatchPackage) return exactMatchPackage.points;

  if (amount >= HIGH_VALUE_THRESHOLD) {
    return Math.floor(amount * HIGH_VALUE_RATE);
  }

  let applicableRate = 0;
  if (amount < sortedPackages[0].amount) {
    applicableRate = sortedPackages[0].points / sortedPackages[0].amount;
  } else {
    let lowerBoundPackage = null;
    let upperBoundPackage = null;
    for (let i = 0; i < sortedPackages.length - 1; i++) {
        if (amount >= sortedPackages[i].amount && amount < sortedPackages[i + 1].amount) {
            lowerBoundPackage = sortedPackages[i];
            upperBoundPackage = sortedPackages[i + 1];
            break;
        }
    }
    
    if (!lowerBoundPackage && sortedPackages.length > 1 && amount >= sortedPackages[sortedPackages.length - 2].amount) {
        lowerBoundPackage = sortedPackages[sortedPackages.length - 2];
        upperBoundPackage = sortedPackages[sortedPackages.length - 1];
    }
    
    if (lowerBoundPackage && upperBoundPackage) {
      const rateA = lowerBoundPackage.points / lowerBoundPackage.amount;
      const rateB = upperBoundPackage.points / upperBoundPackage.amount;
      applicableRate = (rateA + rateB) / 2;
    } else if (lowerBoundPackage) { 
      applicableRate = lowerBoundPackage.points / lowerBoundPackage.amount;
    } else { 
      applicableRate = sortedPackages[0].points / sortedPackages[0].amount;
    }
  }

  return Math.floor(amount * applicableRate);
}

export async function POST(request: Request) {
  
  const requestTimestamp = Date.now();
  console.log(`[${requestTimestamp}] --- Handling POST to /api/razorpay/create-order ---`);
  const adminDb = getDb();
  
  try {
    console.log(`[${requestTimestamp}] Fetching 'mainConfig' from 'appConfiguration' collection.`);
    const configDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
    const configSnap = await configDocRef.get();
    
    let razorpayKeyId: string | null = null;
    let razorpayKeySecret: string | null = null;
    let currentPackages: AppConfigCoinPurchasePackage[] = [];

    if (configSnap.exists) {
        const configData = configSnap.data() as AppConfiguration;
        console.log(`[${requestTimestamp}] Firestore config found.`);
        razorpayKeyId = configData.razorpayKeyId || null;
        razorpayKeySecret = configData.razorpayKeySecret || null;
        console.log(`[${requestTimestamp}] Razorpay Key ID from Firestore:`, razorpayKeyId ? "Exists" : "NOT FOUND");
        console.log(`[${requestTimestamp}] Razorpay Key Secret from Firestore:`, razorpayKeySecret ? "Exists" : "NOT FOUND");
        
        if (configData.coinPurchasePackages && configData.coinPurchasePackages.length > 0) {
            currentPackages = configData.coinPurchasePackages;
        }
    } else {
        console.warn(`[${requestTimestamp}] Firestore 'mainConfig' document does not exist.`);
    }

    if (!razorpayKeyId || !razorpayKeySecret) {
        console.error(`[${requestTimestamp}] CRITICAL: Razorpay credentials not found in Firestore config. Cannot create Razorpay instance.`);
        return NextResponse.json({ error: 'The payment gateway is not configured. Please contact support.' }, { status: 503 });
    }
    
    // Create a new instance for every request to ensure it's fresh
    const localRazorpayInstance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });
    console.log(`[${requestTimestamp}] Razorpay instance created successfully for this request.`);

    
    let requestBody;
    try {
      requestBody = await request.json();
      console.log(`[${requestTimestamp}] Parsed request body:`, requestBody);
    } catch (jsonError: any) {
      console.error(`[${requestTimestamp}] Failed to parse request body:`, jsonError);
      return NextResponse.json({ error: 'Invalid request format.' }, { status: 400 });
    }
    
    const { packageId, customAmountValue, customPointsValue, userIdForOrderNote, paymentType = 'coin_purchase' } = requestBody;

    let amountInPaisa: number;
    let pointsToCredit: number;
    let packageNameForNotes: string;
    let packageIdForNotes = packageId; 
    const finalMaxCustomSupportAmount = MAX_CUSTOM_SUPPORT_AMOUNT;

    if (paymentType === 'support_contribution') {
        const supportAmountNum = Number(customAmountValue);
        if (isNaN(supportAmountNum) || supportAmountNum < MIN_CUSTOM_SUPPORT_AMOUNT || supportAmountNum > finalMaxCustomSupportAmount) {
            return NextResponse.json({ error: `Invalid amount. Must be between ${MIN_CUSTOM_SUPPORT_AMOUNT} and ${finalMaxCustomSupportAmount}.` }, { status: 400 });
        }
        amountInPaisa = Math.round(supportAmountNum * 100);
        pointsToCredit = 0; // No points for support
        packageNameForNotes = packageId?.startsWith('support_tier_') ? `Support Tier - ₹${supportAmountNum}` : `Support Contribution - ₹${supportAmountNum}`;
        packageIdForNotes = (packageId && packageId.startsWith('support_tier_')) 
                                ? packageId 
                                : `support_custom_${supportAmountNum.toFixed(0)}`;
    } else { // Existing coin purchase logic
        if (packageId === 'custom' && customAmountValue !== undefined) {
            const customAmountNum = Number(customAmountValue);
            if (isNaN(customAmountNum) || customAmountNum < MIN_CUSTOM_AMOUNT) {
                return NextResponse.json({ error: `Invalid custom amount. Must be at least ₹${MIN_CUSTOM_AMOUNT}.` }, { status: 400 });
            }
            amountInPaisa = Math.round(customAmountNum * 100);
            pointsToCredit = customPointsValue !== undefined && typeof customPointsValue === 'number' && customPointsValue > 0 
                             ? customPointsValue 
                             : calculatePointsForCustomApiAmount(customAmountNum, currentPackages);
            if (pointsToCredit <= 0) {
                return NextResponse.json({ error: 'Could not calculate valid points for the custom amount.' }, { status: 400 });
            }
            packageNameForNotes = `Custom Purchase (${pointsToCredit} Points)`;
            packageIdForNotes = `custom_pack_${customAmountNum.toFixed(0)}`;
        } else if (packageId) {
            const selectedPackage = currentPackages.find(p => p.id === packageId);
            if (!selectedPackage) {
              return NextResponse.json({ error: 'Invalid package ID' }, { status: 400 });
            }
            amountInPaisa = Math.round(selectedPackage.amount * 100);
            pointsToCredit = selectedPackage.points;
            packageNameForNotes = selectedPackage.name;
        } else {
            return NextResponse.json({ error: 'Package ID or custom amount details missing.' }, { status: 400 });
        }
    }

    if (isNaN(amountInPaisa) || amountInPaisa <= 0) {
        return NextResponse.json({ error: 'Calculated order amount is invalid.' }, { status: 400 });
    }

    const options = {
      amount: amountInPaisa,
      currency: 'INR',
      receipt: `receipt_order_${Date.now()}`,
    };
    
    console.log(`[${requestTimestamp}] Creating Razorpay order with options:`, options);
    const order = await localRazorpayInstance.orders.create(options);
    
    if (!order || !order.id) {
      console.error(`[${requestTimestamp}] Razorpay Error: Unknown error during order creation. Response:`, order);
      return NextResponse.json({ error: `Razorpay Error: Unknown error during order creation.` }, { status: 500 });
    }

    console.log(`[${requestTimestamp}] Razorpay order created successfully:`, order.id);

    const pendingPaymentData = {
        orderId: order.id,
        userId: userIdForOrderNote,
        packageId: packageIdForNotes,
        packageName: packageNameForNotes,
        pointsToCredit: pointsToCredit,
        amountPaid: amountInPaisa / 100,
        paymentType: paymentType,
        status: 'created',
        createdAt: new Date().toISOString(),
    };

    await adminDb.collection('pendingPayments').doc(order.id).set(pendingPaymentData);
    console.log(`[${requestTimestamp}] Pending payment record saved to Firestore for order ${order.id}.`);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount, 
      currency: order.currency,
      packageName: packageNameForNotes,
      pointsToCredit: pointsToCredit,
      key: razorpayKeyId
    });

  } catch (error: any) {
    console.error(`[${requestTimestamp}] UNHANDLED error in /api/razorpay/create-order:`, error);
    const errorMessage = error.message || 'Internal server error during order creation.';
    return NextResponse.json({ error: `Unexpected Server Error: ${errorMessage}` }, { status: 500 });
  }
}

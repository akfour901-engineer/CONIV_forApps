
'use server';

// This file is now a placeholder. The Razorpay instance is created on-demand
// in the API route using credentials fetched from Firestore to ensure reliability.
// This avoids issues with environment variable loading in serverless functions.
export function getRazorpayInstance(): null {
  console.warn("--- DEBUG ---: getRazorpayInstance in src/lib/razorpay.ts is DEPRECATED and should not be called.");
  return null;
}

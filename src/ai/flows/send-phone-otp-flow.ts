'use server';

import { z } from 'zod';
import { ai } from '@/ai/genkit';

export const SendPhoneOtpInputSchema = z.object({
  phoneNumber: z.string().min(10, "A valid phone number is required."),
});

export const SendPhoneOtpOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const sendPhoneOtpFlow = ai.defineFlow(
  {
    name: 'sendPhoneOtpFlow',
    inputSchema: SendPhoneOtpInputSchema,
    outputSchema: SendPhoneOtpOutputSchema,
  },
  async ({ phoneNumber }) => {
    // This server flow is deprecated. Phone OTP is now handled by the Firebase client SDK.
    // To re-enable, you would integrate with an SMS gateway service here.
    console.warn("Deprecated 'sendPhoneOtpFlow' was called. No OTP sent.");
    return { success: false, message: "Phone OTP functionality is currently disabled." };
  }
);


/**
 * @deprecated Phone OTP is disabled. This function will not send an OTP and will return a failure message.
 */
export async function sendPhoneOtp(
  input: z.infer<typeof SendPhoneOtpInputSchema>
): Promise<z.infer<typeof SendPhoneOtpOutputSchema>> {
  console.warn("sendPhoneOtp is deprecated and was called. No OTP was sent.");
  return { success: false, message: "Phone OTP functionality is currently disabled." };
}

'use server';

interface SmsOptions {
  to: string; // Should be in E.164 format, e.g., +919876543210
  body: string;
}

// THIS IS A PLACEHOLDER. Replace with a real SMS gateway service like Twilio.
export async function sendSms(options: SmsOptions): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Twilio environment variables not set. Simulating SMS send.");
    console.log("--- SIMULATING SMS SEND ---");
    console.log(`To: ${options.to}`);
    console.log(`Body: ${options.body}`);
    console.log("--- END OF SIMULATED SMS ---");
    return { success: true };
  }
  
  // In a real implementation, you would use your SMS provider's SDK here.
  // For example, with Twilio:
  //
  // import twilio from 'twilio';
  // const client = twilio(accountSid, authToken);
  // try {
  //   const message = await client.messages.create({
  //     body: options.body,
  //     from: fromNumber,
  //     to: options.to
  //   });
  //   if (message.sid) {
  //     return { success: true };
  //   } else {
  //     return { success: false, error: "Twilio failed to provide a message SID." };
  //   }
  // } catch (error: any) {
  //   return { success: false, error: error.message };
  // }

  // Since this is a simulation, we'll always return success.
  console.log(`Simulating SMS to ${options.to} as Twilio keys are present but commented out.`);
  return { success: true };
}


'use client';

import { Suspense } from 'react';
import { SignUpForm } from '@/components/auth/signup/signup-form';
import { sendEmailOtp } from '@/ai/flows/send-email-otp-flow';
import { verifyOtpAndCreateUser } from '@/ai/flows/verify-otp-and-create-user-flow';

function SignUpPageContent() {
  // Pass server actions to the client component as props
  return (
    <SignUpForm
      sendEmailOtpAction={sendEmailOtp}
      verifyAndCreateUserAction={verifyOtpAndCreateUser}
    />
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpPageContent />
    </Suspense>
  );
}

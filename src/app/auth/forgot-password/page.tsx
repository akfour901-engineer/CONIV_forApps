
'use client';

import  {Suspense }  from 'react';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { sendPasswordResetOtp } from '@/ai/flows/send-password-reset-otp-flow';

function ForgotPasswordPageContent() {
  return <ForgotPasswordForm sendPasswordResetOtpAction={sendPasswordResetOtp} />;
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}

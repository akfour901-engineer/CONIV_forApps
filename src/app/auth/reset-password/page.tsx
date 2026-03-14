
'use client';

import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { sendPasswordResetOtp } from '@/ai/flows/send-password-reset-otp-flow';
import { verifyPasswordResetOtp } from '@/ai/flows/verify-password-reset-otp-flow';
import { resetPasswordWithToken } from '@/ai/flows/reset-password-with-token-flow';

function ResetPasswordPageContent() {
  return (
    <ResetPasswordForm
      sendPasswordResetOtpAction={sendPasswordResetOtp}
      verifyOtpAction={verifyPasswordResetOtp}
      resetPasswordAction={resetPasswordWithToken}
    />
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}

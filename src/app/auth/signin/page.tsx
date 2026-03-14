

'use client';

import { Suspense } from 'react';
import { SignInForm } from '@/components/auth/signin-form';

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInForm />
    </Suspense>
  );
}

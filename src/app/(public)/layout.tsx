import type { ReactNode } from 'react';

// This is a new, simplified layout for all public-facing pages.
// It deliberately does NOT include the AuthProvider or ClientLayout
// to ensure no authentication or session logic is applied.
export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}

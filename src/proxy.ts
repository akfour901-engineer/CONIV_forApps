
import { NextRequest, NextResponse } from 'next/server';
//
/**
 * @fileOverview The proxy interceptor for Next.js 16+
 */
export function proxy(request: NextRequest) {
  // Standard middleware logic can be added here
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

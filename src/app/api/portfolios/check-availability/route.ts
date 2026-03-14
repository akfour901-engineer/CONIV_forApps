import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin-init';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const checkAvailabilitySchema = z.object({
  publicId: z.string().min(3).regex(/^[a-z0-9-]+$/),
});

export async function POST(request: Request) {
  try {
    const adminDb = getDb();
    const body = await request.json();
    const validationResult = checkAvailabilitySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ available: false, error: 'Invalid ID format.' }, { status: 400 });
    }
    
    const { publicId } = validationResult.data;
    
    const portfolioQuery = adminDb.collection('portfolios').where('publicId', '==', publicId).limit(1);
    const snapshot = await portfolioQuery.get();
    
    return NextResponse.json({ available: snapshot.empty });

  } catch (error: any) {
    console.error("Error checking portfolio ID availability:", error);
    return NextResponse.json({ available: false, error: 'Internal server error.' }, { status: 500 });
  }
}

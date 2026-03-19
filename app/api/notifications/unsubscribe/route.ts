import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!session?.user?.workerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    // Delete the subscription
    await prisma.pushSubscription.deleteMany({
      where: {
        workerId: session.user.workerId,
        endpoint,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unsubscribing from notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

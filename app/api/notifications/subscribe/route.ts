import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    // Check if subscription already exists
    const existing = await prisma.pushSubscription.findFirst({
      where: {
        workerId: session.id,
        endpoint,
      },
    });

    if (existing) {
      return NextResponse.json({ success: true, message: 'Subscription already exists' });
    }

    // Create new subscription
    await prisma.pushSubscription.create({
      data: {
        workerId: session.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { authErrorResponse } from '@/lib/apiErrors'

// Only real browser push services, so the server never posts to an
// arbitrary address it was handed.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/,
  /^android\.googleapis\.com$/,
]

function isPushServiceEndpoint(endpoint: unknown) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && PUSH_HOSTS.some(host => host.test(url.hostname))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (!session?.user?.workerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!isPushServiceEndpoint(endpoint) || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
      return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    // Check if subscription already exists
    const existing = await prisma.pushSubscription.findFirst({
      where: {
        workerId: session.user.workerId,
        endpoint,
      },
    });

    if (existing) {
      return NextResponse.json({ success: true, message: 'Subscription already exists' });
    }

    // Create new subscription
    await prisma.pushSubscription.create({
      data: {
        workerId: session.user.workerId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const authError = authErrorResponse(error)
    if (authError) return authError
    console.error('Error subscribing to notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

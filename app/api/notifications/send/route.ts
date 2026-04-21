import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import webpush from 'web-push';

// Force dynamic so Next.js doesn't evaluate VAPID config at build time.
export const dynamic = 'force-dynamic';

let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:example@batchflow.com',
    publicKey,
    privateKey
  );
  vapidConfigured = true;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    if (!ensureVapidConfigured()) {
      return NextResponse.json(
        { error: 'Push notifications not configured on this server' },
        { status: 503 }
      );
    }
    const body = await request.json();
    const { workerId, title, body: messageBody, url } = body;

    if (!workerId || !title || !messageBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch all push subscriptions for the worker
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { workerId },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'No subscriptions found' });
    }

    // Send notifications to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            JSON.stringify({
              title,
              body: messageBody,
              url,
            })
          );
        } catch (error: any) {
          // If subscription is invalid (410 or 404), delete it
          if (error?.statusCode === 410 || error?.statusCode === 404) {
            await prisma.pushSubscription.delete({
              where: { id: subscription.id },
            });
          }
          throw error;
        }
      })
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount,
    });
  } catch (error) {
    console.error('Error sending notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

'use client';

import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export default function NotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
    }

    // Check if user is logged in
    const workerId = getCookie('workerId');
    if (workerId) {
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (!isSupported || !isLoggedIn) {
      return;
    }

    async function setupNotifications() {
      try {
        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission denied');
          return;
        }

        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready;

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        // If subscription exists, check if it's stored locally
        const storedEndpoint = localStorage.getItem('push-subscription-endpoint');
        if (subscription && storedEndpoint === subscription.endpoint) {
          // Already subscribed and stored
          return;
        }

        // If no subscription, create one
        if (!subscription) {
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidPublicKey) {
            console.error('VAPID public key not found');
            return;
          }

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
        }

        // Send subscription to server
        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
              auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
            },
          }),
        });

        if (response.ok) {
          // Store endpoint in localStorage to avoid duplicate API calls
          localStorage.setItem('push-subscription-endpoint', subscription.endpoint);
          console.log('Push notification subscription successful');
        } else {
          console.error('Failed to save push subscription');
        }
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    }

    setupNotifications();
  }, [isSupported, isLoggedIn]);

  return null;
}

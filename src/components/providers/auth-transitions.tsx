'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
const channelName = 'dashboard-auth-transition';
let sender: string | undefined;
const tabId = () => (sender ??= crypto.randomUUID());
export function notifyAuthTransition() {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(channelName);
    try {
      channel.postMessage({ type: 'changed', sender: tabId() });
    } finally {
      channel.close();
    }
  } catch {
    /* Cache coordination must not turn a successful sign-in into a failure. */
  }
}
export function AuthTransitions() {
  const router = useRouter();
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(channelName);
    } catch {
      return;
    }
    let pending = false;
    const refresh = () => {
      if (document.visibilityState === 'visible' && pending) {
        pending = false;
        router.refresh();
      }
    };
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (
        data &&
        typeof data === 'object' &&
        'type' in data &&
        data.type === 'changed' &&
        'sender' in data &&
        typeof data.sender === 'string' &&
        data.sender !== tabId()
      ) {
        pending = true;
        refresh();
      }
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      channel.close();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);
  return null;
}

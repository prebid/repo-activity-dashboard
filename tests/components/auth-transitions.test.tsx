import { beforeEach, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { AuthTransitions, notifyAuthTransition } from '@/components/providers/auth-transitions';
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
class Channel {
  static instances: Channel[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  sent: unknown[] = [];
  closed = false;
  constructor() {
    Channel.instances.push(this);
  }
  postMessage(value: unknown) {
    this.sent.push(value);
  }
  close() {
    this.closed = true;
  }
}
beforeEach(() => {
  Channel.instances = [];
  mocks.refresh.mockReset();
  vi.stubGlobal('BroadcastChannel', Channel);
});
it('refreshes only for another tab and coalesces notifications while hidden', () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const { unmount } = render(<AuthTransitions />);
  const listener = Channel.instances[0];
  notifyAuthTransition();
  act(() =>
    listener.onmessage?.(new MessageEvent('message', { data: Channel.instances[1].sent[0] })),
  );
  expect(mocks.refresh).not.toHaveBeenCalled();
  act(() =>
    listener.onmessage?.(
      new MessageEvent('message', { data: { type: 'changed', sender: 'another-tab' } }),
    ),
  );
  expect(mocks.refresh).toHaveBeenCalledOnce();
  visibility.mockReturnValue('hidden');
  act(() => {
    listener.onmessage?.(
      new MessageEvent('message', { data: { type: 'changed', sender: 'another-tab' } }),
    );
    listener.onmessage?.(
      new MessageEvent('message', { data: { type: 'changed', sender: 'third-tab' } }),
    );
  });
  expect(mocks.refresh).toHaveBeenCalledOnce();
  visibility.mockReturnValue('visible');
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
  act(() => listener.onmessage?.(new MessageEvent('message', { data: { role: 'admin' } })));
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
  unmount();
  expect(listener.closed).toBe(true);
});
it('does not block authentication when the optional browser channel is unavailable', () => {
  vi.stubGlobal('BroadcastChannel', undefined);
  expect(() => notifyAuthTransition()).not.toThrow();
  const missing = render(<AuthTransitions />);
  missing.unmount();
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      constructor() {
        throw new Error('blocked');
      }
    },
  );
  expect(() => notifyAuthTransition()).not.toThrow();
  expect(() => render(<AuthTransitions />)).not.toThrow();
});

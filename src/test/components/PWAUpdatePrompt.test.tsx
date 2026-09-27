import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { PWAUpdatePrompt } from '../../components/common/PWAUpdatePrompt';

const pwa = vi.hoisted(() => ({
  options: undefined as RegisterSWOptions | undefined,
  deferRegistration: false,
  update: vi.fn(async () => undefined),
  postMessage: vi.fn(),
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: RegisterSWOptions) => {
    pwa.options = options;
    if (!pwa.deferRegistration) options.onRegisteredSW?.('/sw.js', {
        waiting: { postMessage: pwa.postMessage },
      } as unknown as ServiceWorkerRegistration);
    return pwa.update;
  },
}));

describe('PWAUpdatePrompt', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: new EventTarget() });
    pwa.options = undefined;
    pwa.deferRegistration = false;
    pwa.update.mockClear();
    pwa.postMessage.mockClear();
  });

  it('waits for explicit user action before activating an available update', async () => {
    const reloadPage = vi.fn();
    render(<PWAUpdatePrompt reloadPage={reloadPage} />);

    act(() => pwa.options?.onNeedRefresh?.());
    expect(screen.getByRole('status')).toHaveTextContent('An update is ready');
    expect(pwa.postMessage).toHaveBeenCalledWith({ type: 'OPSTUDIO_CLAIM_WAITING' });

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update now' })));
    expect(pwa.postMessage).toHaveBeenCalledWith({ type: 'OPSTUDIO_ACTIVATE_IF_SOLE_CLIENT' });
    act(() => pwa.options?.onNeedReload?.());
    expect(reloadPage).toHaveBeenCalledOnce();
  });

  it('claims a waiting worker when registration resolves after the refresh event', () => {
    pwa.deferRegistration = true;
    render(<PWAUpdatePrompt />);
    act(() => pwa.options?.onNeedRefresh?.());
    expect(pwa.postMessage).not.toHaveBeenCalled();
    act(() => pwa.options?.onRegisteredSW?.('/sw.js', {
      waiting: { postMessage: pwa.postMessage },
    } as unknown as ServiceWorkerRegistration));
    expect(pwa.postMessage).toHaveBeenCalledWith({ type: 'OPSTUDIO_CLAIM_WAITING' });
  });

  it('allows the update prompt to be deferred without changing the current session', () => {
    const reloadPage = vi.fn();
    render(<PWAUpdatePrompt reloadPage={reloadPage} />);
    act(() => pwa.options?.onNeedRefresh?.());

    fireEvent.click(screen.getByRole('button', { name: 'Later' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(pwa.postMessage).toHaveBeenCalledTimes(1);
    expect(pwa.postMessage).toHaveBeenCalledWith({ type: 'OPSTUDIO_CLAIM_WAITING' });
    act(() => pwa.options?.onNeedReload?.());
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('does not reload this tab when another tab activates an update', () => {
    const reloadPage = vi.fn();
    render(<PWAUpdatePrompt reloadPage={reloadPage} />);
    act(() => pwa.options?.onNeedRefresh?.());

    act(() => pwa.options?.onNeedReload?.());

    expect(reloadPage).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('An update is ready');
  });

  it('keeps the worker waiting when another studio tab is open and allows a retry', async () => {
    const reloadPage = vi.fn();
    render(<PWAUpdatePrompt reloadPage={reloadPage} />);
    act(() => pwa.options?.onNeedRefresh?.());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update now' })));

    act(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', {
      data: { type: 'OPSTUDIO_UPDATE_BLOCKED_OPEN_TABS' },
    })));

    expect(screen.getByRole('status')).toHaveTextContent('Close other OP-PatchStudio tabs');
    act(() => pwa.options?.onNeedReload?.());
    expect(reloadPage).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Update now' })));
    expect(pwa.postMessage.mock.calls.filter(([message]) =>
      message.type === 'OPSTUDIO_ACTIVATE_IF_SOLE_CLIENT')).toHaveLength(2);
  });
});

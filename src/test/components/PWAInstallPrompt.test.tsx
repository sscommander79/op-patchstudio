import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import PWAInstallPrompt from '../../components/common/PWAInstallPrompt';

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(localStorage.getItem).mockReturnValue(null);
  vi.mocked(localStorage.setItem).mockClear();
  vi.mocked(localStorage.removeItem).mockClear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches: false})));
});
afterEach(() => {cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();});
async function showPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  render(<PWAInstallPrompt/>);
  const prompt = vi.fn(async () => {});
  const event = Object.assign(new Event('beforeinstallprompt', {cancelable: true}), {
    prompt, userChoice: Promise.resolve({outcome, platform: 'web'}), platforms: ['web']
  });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  await act(async () => {await vi.advanceTimersByTimeAsync(5010);});
  expect(screen.getByRole('button', {name: 'install'})).toBeVisible();
  return prompt;
}
it('Later closes promotion and resets reminder tracking without installing', async () => {
  const prompt = await showPrompt();
  fireEvent.click(screen.getByRole('button', {name: 'later'}));
  await act(async () => {await vi.advanceTimersByTimeAsync(200);});
  expect(screen.queryByRole('button', {name: 'install'})).not.toBeInTheDocument();
  expect(localStorage.removeItem).toHaveBeenCalledWith('pwa_install_dismissed');
  expect(localStorage.setItem).toHaveBeenCalledWith('pwa_visit_count', '0');
  expect(prompt).not.toHaveBeenCalled();
});
it('Dismiss records a cooldown and closes promotion', async () => {
  const prompt = await showPrompt();
  fireEvent.click(screen.getByRole('button', {name: 'dismiss'}));
  await act(async () => {await vi.advanceTimersByTimeAsync(200);});
  expect(localStorage.setItem).toHaveBeenCalledWith('pwa_install_dismissed', expect.any(String));
  expect(screen.queryByRole('button', {name: 'install'})).not.toBeInTheDocument();
  expect(prompt).not.toHaveBeenCalled();
});
for (const outcome of ['accepted', 'dismissed'] as const) it(`Install records browser ${outcome} choice and closes`, async () => {
  const prompt = await showPrompt(outcome);
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'install'}));});
  expect(prompt).toHaveBeenCalledTimes(1);
  expect(localStorage.setItem).toHaveBeenCalledWith(`pwa_install_${outcome}`, expect.any(String));
  await act(async () => {await vi.advanceTimersByTimeAsync(200);});
  expect(screen.queryByRole('button', {name: 'install'})).not.toBeInTheDocument();
});
for (const reason of ['accepted', 'dismissed']) it(`suppresses the promotion when recently ${reason}`, async () => {
  vi.mocked(localStorage.getItem).mockImplementation(key => key === `pwa_install_${reason}` ? new Date().toISOString() : null);
  render(<PWAInstallPrompt/>);
  act(() => window.dispatchEvent(new Event('beforeinstallprompt')));
  await act(async () => {await vi.advanceTimersByTimeAsync(10000);});
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

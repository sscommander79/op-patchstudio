import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';

type PromptModule = typeof import('../../components/common/PWAInstallPrompt');
let documents = 0;
/**
 * One loaded document. The component counts a visit once per evaluation of its module, which is
 * what a page load is, so each simulated load takes a fresh module instance through a unique query
 * (React itself stays shared). The specifier is a variable because no file on disk has that name.
 */
async function loadDocument() {
  const specifier = `../../components/common/PWAInstallPrompt.tsx?document=${++documents}`;
  return ((await import(/* @vite-ignore */ specifier)) as PromptModule).default;
}

const store = new Map<string, string>();
beforeEach(() => {
  vi.useFakeTimers();
  store.clear();
  vi.mocked(localStorage.getItem).mockImplementation(key => store.get(key) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key, value) => {store.set(key, String(value));});
  vi.mocked(localStorage.removeItem).mockImplementation(key => {store.delete(key);});
  vi.mocked(localStorage.setItem).mockClear();
  vi.mocked(localStorage.removeItem).mockClear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches: false})));
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
  vi.mocked(console.log).mockRestore();
  Reflect.deleteProperty(navigator, 'userAgent');
});
function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const prompt = vi.fn(async () => {});
  const event = Object.assign(new Event('beforeinstallprompt', {cancelable: true}), {
    prompt, userChoice: Promise.resolve({outcome, platform: 'web'}), platforms: ['web']
  });
  return {event, prompt};
}
async function showPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const Prompt = await loadDocument();
  render(<Prompt/>);
  const {event, prompt} = installEvent(outcome);
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  await act(async () => {await vi.advanceTimersByTimeAsync(5010);});
  expect(screen.getByRole('button', {name: 'Install'})).toBeVisible();
  return {prompt, Prompt};
}
/** One mount inside an already loaded document: lets the browser offer installation and reports whether the promotion appeared. */
async function mountIn(Prompt: PromptModule['default']) {
  const view = render(<Prompt/>);
  act(() => window.dispatchEvent(installEvent().event));
  await act(async () => {await vi.advanceTimersByTimeAsync(10000);});
  const shown = screen.queryByRole('button', {name: 'Install'}) !== null;
  view.unmount();
  return shown;
}
/** One page load: a new document that mounts the prompt once. */
async function visit() {
  return mountIn(await loadDocument());
}
it('Later closes promotion and resets reminder tracking without installing', async () => {
  const {prompt} = await showPrompt();
  fireEvent.click(screen.getByRole('button', {name: 'Later'}));
  await act(async () => {await vi.advanceTimersByTimeAsync(200);});
  expect(screen.queryByRole('button', {name: 'Install'})).not.toBeInTheDocument();
  expect(localStorage.removeItem).toHaveBeenCalledWith('pwa_install_dismissed');
  expect(localStorage.setItem).toHaveBeenCalledWith('pwa_install_remind_later', expect.any(String));
  expect(localStorage.setItem).toHaveBeenCalledWith('pwa_visit_count', '0');
  expect(prompt).not.toHaveBeenCalled();
});
it('Later keeps the promotion away for the visits its tooltip promises, then asks once more', async () => {
  await showPrompt();
  const later = screen.getByRole('button', {name: 'Later'});
  expect(later).toHaveAttribute('title', 'Hide this and ask again after 6 more visits');
  fireEvent.click(later);
  await act(async () => {await vi.advanceTimersByTimeAsync(200);});
  cleanup();

  for (let n = 1; n <= 5; n += 1) expect(await visit(), `visit ${n} after Later`).toBe(false);
  expect(await visit(), 'sixth visit after Later').toBe(true);
});
it('Dismiss after a Later reminder falls back to the week-long cooldown only', async () => {
  store.set('pwa_install_remind_later', new Date().toISOString());
  store.set('pwa_visit_count', '9');
  await showPrompt();
  fireEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
  await act(async () => {await vi.advanceTimersByTimeAsync(200);});
  cleanup();

  expect(store.has('pwa_install_remind_later')).toBe(false);
  expect(await visit()).toBe(false);
  store.set('pwa_install_dismissed', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString());
  expect(await visit()).toBe(true);
});
it('counts one visit per page load on a mobile browser', async () => {
  Object.defineProperty(navigator, 'userAgent', {configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'});
  expect(await visit()).toBe(true);
  expect(store.get('pwa_visit_count')).toBe('1');
});
it('counts a document once however often the prompt remounts, and counts the next document again', async () => {
  const first = await loadDocument();
  for (let n = 1; n <= 4; n += 1) {
    await mountIn(first);
    expect(store.get('pwa_visit_count'), `mount ${n} in the first document`).toBe('1');
  }
  const second = await loadDocument();
  await mountIn(second);
  await mountIn(second);
  expect(store.get('pwa_visit_count')).toBe('2');
});
it('leaving and returning to the studio after Later does not use up the promised visits', async () => {
  const {Prompt} = await showPrompt();
  fireEvent.click(screen.getByRole('button', {name: 'Later'}));
  await act(async () => {await vi.advanceTimersByTimeAsync(200);});
  cleanup();

  // More round trips than the threshold, all inside the document where Later was chosen.
  for (let n = 1; n <= 8; n += 1) expect(await mountIn(Prompt), `remount ${n} after Later`).toBe(false);
  expect(store.get('pwa_visit_count')).toBe('0');

  // The promise still holds across real page loads, each of which may also remount.
  for (let n = 1; n <= 5; n += 1) {
    const next = await loadDocument();
    expect(await mountIn(next), `visit ${n} after Later`).toBe(false);
    expect(await mountIn(next), `visit ${n} after Later, remounted`).toBe(false);
  }
  expect(await visit(), 'sixth visit after Later').toBe(true);
});
it('Dismiss records a cooldown and closes promotion', async () => {
  const {prompt} = await showPrompt();
  fireEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
  await act(async () => {await vi.advanceTimersByTimeAsync(200);});
  expect(localStorage.setItem).toHaveBeenCalledWith('pwa_install_dismissed', expect.any(String));
  expect(screen.queryByRole('button', {name: 'Install'})).not.toBeInTheDocument();
  expect(prompt).not.toHaveBeenCalled();
});
for (const outcome of ['accepted', 'dismissed'] as const) it(`Install records browser ${outcome} choice and closes`, async () => {
  const {prompt} = await showPrompt(outcome);
  await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Install'}));});
  expect(prompt).toHaveBeenCalledTimes(1);
  expect(localStorage.setItem).toHaveBeenCalledWith(`pwa_install_${outcome}`, expect.any(String));
  await act(async () => {await vi.advanceTimersByTimeAsync(200);});
  expect(screen.queryByRole('button', {name: 'Install'})).not.toBeInTheDocument();
  expect(console.log).not.toHaveBeenCalled();
});
for (const reason of ['accepted', 'dismissed']) it(`suppresses the promotion when recently ${reason}`, async () => {
  store.set(`pwa_install_${reason}`, new Date().toISOString());
  const Prompt = await loadDocument();
  render(<Prompt/>);
  act(() => window.dispatchEvent(new Event('beforeinstallprompt')));
  await act(async () => {await vi.advanceTimersByTimeAsync(10000);});
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('never promotes installation inside the installed standalone app', async () => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({matches: query === '(display-mode: standalone)'})));
  expect(await visit()).toBe(false);
});
it('an install completed from the browser closes the promotion and stops future ones', async () => {
  await showPrompt();
  act(() => window.dispatchEvent(new Event('appinstalled')));
  await act(async () => {await vi.advanceTimersByTimeAsync(200);});
  expect(screen.queryByRole('button', {name: 'Install'})).not.toBeInTheDocument();
  expect(console.log).not.toHaveBeenCalled();
  cleanup();

  expect(store.has('pwa_install_accepted')).toBe(true);
  expect(await visit()).toBe(false);
});

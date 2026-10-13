import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SessionRestorationModal } from '../../components/common/SessionRestorationModal';

const info = { timestamp: Date.UTC(2026, 9, 6, 12), drumSamplesCount: 1, multisampleFilesCount: 2 };
const restoreButton = () => screen.getByRole('button', { name: 'Restore saved work' });
const discardButton = () => screen.getByRole('button', { name: 'Discard saved work and start new' });
/** useOwnedDialog chooses its initial target in a microtask, after the component's own effect. */
const settle = () => Promise.resolve();

describe('SessionRestorationModal default action', () => {
  it('opens on Restore so Enter never discards saved work', async () => {
    const onLoadSession = vi.fn(), onStartNew = vi.fn(async () => {});
    render(<SessionRestorationModal isOpen onLoadSession={onLoadSession} onStartNew={onStartNew} sessionInfo={info} />);
    await settle();
    await waitFor(() => expect(restoreButton()).toHaveFocus());
    expect(discardButton()).not.toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(onLoadSession).toHaveBeenCalledOnce();
    expect(onStartNew).not.toHaveBeenCalled();
  });

  it('holds focus on the dialog while pending, then returns to Restore beside the error', async () => {
    const onLoadSession = vi.fn(), onStartNew = vi.fn(async () => {});
    const view = render(<SessionRestorationModal isOpen pending onLoadSession={onLoadSession} onStartNew={onStartNew} sessionInfo={info} />);
    await settle();
    expect(screen.getByRole('dialog')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onLoadSession).not.toHaveBeenCalled();
    expect(onStartNew).not.toHaveBeenCalled();

    view.rerender(<SessionRestorationModal isOpen error="Could not restore saved work: quota. The saved copy has been kept." onLoadSession={onLoadSession} onStartNew={onStartNew} sessionInfo={info} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The saved copy has been kept');
    expect(restoreButton()).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onLoadSession).toHaveBeenCalledOnce();
    expect(onStartNew).not.toHaveBeenCalled();
  });

  it('still discards only through its explicitly named button', async () => {
    const onLoadSession = vi.fn(), onStartNew = vi.fn(async () => {});
    render(<SessionRestorationModal isOpen onLoadSession={onLoadSession} onStartNew={onStartNew} sessionInfo={info} />);
    await userEvent.click(discardButton());
    expect(onStartNew).toHaveBeenCalledOnce();
    expect(onLoadSession).not.toHaveBeenCalled();
  });
});

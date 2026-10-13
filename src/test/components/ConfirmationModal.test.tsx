import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';

function deferred() {
  let resolve!: () => void, reject!: (reason: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('ConfirmationModal', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { vi.mocked(console.error).mockRestore(); });

  it('opens on cancel and lets Escape or the backdrop cancel while idle', async () => {
    const onCancel = vi.fn(), onConfirm = vi.fn();
    render(<ConfirmationModal isOpen message="Delete this preset?" onConfirm={onConfirm} onCancel={onCancel} />);
    const dialog = screen.getByRole('dialog', { name: 'confirm action' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'cancel' })).toHaveFocus());
    expect(dialog).toHaveAccessibleDescription('Delete this preset?');
    expect(dialog.querySelector('.fa-exclamation-triangle')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(dialog.parentElement!);
    fireEvent.click(dialog);
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cannot be cancelled or confirmed twice while the confirm is running', async () => {
    const work = deferred();
    const onCancel = vi.fn(), onConfirm = vi.fn(() => work.promise);
    render(<ConfirmationModal isOpen message="Delete this preset?" onConfirm={onConfirm} onCancel={onCancel} />);
    const dialog = screen.getByRole('dialog');
    const ok = screen.getByRole('button', { name: 'ok' });

    fireEvent.click(ok);
    fireEvent.click(ok);
    await waitFor(() => expect(dialog).toHaveAttribute('aria-busy', 'true'));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'cancel' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Working on it. Please wait.');
    expect(dialog).toHaveFocus();

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape);
    fireEvent.click(dialog.parentElement!);
    expect(escape.defaultPrevented).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(dialog).toHaveFocus();

    await act(async () => { work.resolve(); await work.promise; });
    expect(dialog).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('stays open with a retry path when the confirm rejects', async () => {
    const first = deferred(), second = deferred();
    const onCancel = vi.fn();
    const onConfirm = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<ConfirmationModal isOpen message="Delete this preset?" onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'ok' }));
    await act(async () => { first.reject(new Error('storage unavailable')); await first.promise.catch(() => {}); });

    expect(screen.getByRole('dialog')).toHaveTextContent('Delete this preset?');
    expect(screen.getByRole('alert')).toHaveTextContent('That did not finish');
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'cancel' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'ok' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'ok' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await act(async () => { second.resolve(); await second.promise; });
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('forgets an earlier failure when it is reopened', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('nope'));
    const view = render(<ConfirmationModal isOpen message="Delete?" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'ok' }));
    expect(await screen.findByRole('alert')).toBeVisible();

    view.rerender(<ConfirmationModal isOpen={false} message="Delete?" onConfirm={onConfirm} onCancel={vi.fn()} />);
    view.rerender(<ConfirmationModal isOpen message="Delete?" onConfirm={onConfirm} onCancel={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

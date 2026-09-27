import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuildIdentityNotice } from '../../components/common/BuildIdentityNotice';

describe('BuildIdentityNotice', () => {
  it('stays silent when the served build matches or cannot be checked', async () => {
    const current = vi.fn(async () => ({ status: 'current' as const }));
    const { unmount } = render(<BuildIdentityNotice check={current} />);
    await waitFor(() => expect(current).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    unmount();

    const unavailable = vi.fn(async () => ({ status: 'unavailable' as const }));
    render(<BuildIdentityNotice check={unavailable} />);
    await waitFor(() => expect(unavailable).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('names both builds, asks for a manual reload, and never reloads by itself', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const check = vi.fn(async () => ({ status: 'different' as const, served: { version: '0.16.0', buildId: 'server-build-abcdef12', mode: 'development' as const } }));
    render(<BuildIdentityNotice check={check} />);

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('This tab is running a different build from the local server.');
    expect(notice).toHaveTextContent('Server: v0.16.0 development build abcdef12.');
    expect(notice).toHaveTextContent('Save or back up your work, then reload this page.');
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

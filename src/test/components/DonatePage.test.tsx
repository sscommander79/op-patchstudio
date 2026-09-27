import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DonatePage } from '../../components/common/DonatePage';

const fetchMock = vi.fn<typeof fetch>();

describe('DonatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReturnValue(new Promise(() => {}));
  });

  it('renders remote post content as plain text and rejects unsafe post links', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        data: [
          {
            id: '123',
            type: 'post',
            attributes: {
              title: 'remote update',
              content: '<p onclick="window.__unsafe = true">hello <strong>makers</strong><img src=x onerror="window.__unsafe = true"><a href="javascript:alert(1)">today</a></p>',
              published_at: '2026-09-05T00:00:00.000Z',
              url: 'javascript:alert(1)',
            },
          },
        ],
      }),
    } as Response);

    render(<DonatePage />);

    expect(await screen.findByText(/hello makers today/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'today' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'read more →' })).toHaveAttribute(
      'href',
      'https://www.patreon.com/posts/123',
    );
    expect(document.querySelector('[onclick], [onerror], [href^="javascript:"]')).toBeNull();
  });

  it('cancels oversized streamed responses and labels the unavailable live feed', async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({done:false, value:new Uint8Array(600_000)})
            .mockResolvedValueOnce({done:false, value:new Uint8Array(600_000)}),
          cancel,
          releaseLock: vi.fn(),
        }),
      },
    } as unknown as Response);

    render(<DonatePage />);

    expect(await screen.findByText(/Live Patreon posts are unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name:'View posts directly on Patreon.'})).toHaveAttribute(
      'href',
      'https://www.patreon.com/c/oppatchstudio/posts',
    );
    expect(cancel).toHaveBeenCalledTimes(3);
    expect(screen.queryByText('recent')).not.toBeInTheDocument();
  });

  it('should render donate page with headers', () => {
    render(<DonatePage />);

    expect(screen.getByText('support the project')).toBeInTheDocument();
    expect(screen.getByText('latest posts')).toBeInTheDocument();
  });

  it('should render support text and links', () => {
    render(<DonatePage />);

    // Check main text content
    expect(screen.getByText(/OP-PatchStudio is a 100% free and/)).toBeInTheDocument();

    // Check links
    const githubLink = screen.getByText('open-source');
    expect(githubLink).toHaveAttribute('href', 'https://github.com/sscommander79/op-patchstudio');

    const patreonLink = screen.getByRole('link', { name: /project patreon/i });
    expect(patreonLink).toHaveAttribute('href', 'https://www.patreon.com/c/oppatchstudio');
    expect(screen.getByText(/support links benefit the original project's creator, Joseph Holland/)).toBeInTheDocument();
  });

  it('should render support buttons', () => {
    render(<DonatePage />);

    const patreonButton = screen.getByText('support on patreon');
    expect(patreonButton).toHaveAttribute('href', 'https://www.patreon.com/c/oppatchstudio');

    const coffeeButton = screen.getByRole('link', { name: 'buy Joseph a coffee' });
    expect(coffeeButton).toHaveAttribute('href', 'https://buymeacoffee.com/jxavierh');
  });

  it('should handle mobile layout', () => {
    // Mock window.innerWidth
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500, // Mobile width
    });

    render(<DonatePage />);

    // Check if mobile styles are applied to the content divs
    const contentDivs = screen.getAllByText(/support the project|latest posts/)
      .map(heading => heading.closest('div')?.parentElement?.nextElementSibling)
      .filter(Boolean);

    contentDivs.forEach(div => {
      expect(div).toHaveStyle({ padding: '1rem' });
    });

    // Restore window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('should handle desktop layout', () => {
    // Mock window.innerWidth
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024, // Desktop width
    });

    render(<DonatePage />);

    // Check if desktop styles are applied to the content divs
    const contentDivs = screen.getAllByText(/support the project|latest posts/)
      .map(heading => heading.closest('div')?.parentElement?.nextElementSibling)
      .filter(Boolean);

    contentDivs.forEach(div => {
      expect(div).toHaveStyle({ padding: '2rem' });
    });

    // Restore window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeedbackPage } from '../../components/common/FeedbackPage';

// The page relies on the shared studio layout at every width instead of width-specific inline padding.
function expectSharedLayout() {
  const heading = screen.getByRole('heading', { level: 1, name: 'Feedback' });
  const content = heading.closest('.studio-shell-content') as HTMLElement;
  expect(content).toBeInTheDocument();
  expect(content.style.padding).toBe('');

  const back = screen.getByRole('link', { name: '← Back to the studio' });
  expect(back).toHaveAttribute('href', '#/studio/overview');
  expect(back).not.toHaveAttribute('target');
  expect(content).toContainElement(back);
  expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  const panels = Array.from(content.querySelectorAll<HTMLElement>('section.studio-setup-panel'));
  expect(panels).toHaveLength(2);
  panels.forEach(panel => expect(panel.style.padding).toBe(''));
}

it('does not connect to Google until the form is requested',()=>{render(<FeedbackPage/>);expect(screen.queryByTitle('OP-PatchStudio feedback form')).not.toBeInTheDocument();if(navigator.onLine){fireEvent.click(screen.getByRole('button',{name:'Load Google form'}));expect(screen.getByTitle('OP-PatchStudio feedback form')).toBeInTheDocument();}});

describe('FeedbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it('should render feedback page with header', () => {
    render(<FeedbackPage />);
    if(navigator.onLine)fireEvent.click(screen.getByRole('button',{name:'Load Google form'}));

    expect(screen.getByRole('heading', { level: 1, name: 'Feedback' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Before you send' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Feedback form' })).toBeInTheDocument();
    expect(screen.getByText(/hosted by Google Forms/)).toHaveTextContent(/Your presets, samples, and projects are not attached or sent/);
  });

  it('should render GitHub issues link', () => {
    render(<FeedbackPage />);
    if(navigator.onLine)fireEvent.click(screen.getByRole('button',{name:'Load Google form'}));

    const link = screen.getByText(/check if your bug or request has already been raised here/i);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/sscommander79/op-patchstudio/issues'
    );
  });

  it('replaces the hosted form with clear offline guidance', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    render(<FeedbackPage />);
    if(navigator.onLine)fireEvent.click(screen.getByRole('button',{name:'Load Google form'}));

    expect(screen.queryByTitle('OP-PatchStudio feedback form')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/unavailable while offline/i);
    expect(screen.getByRole('status')).toHaveTextContent(/Back to the studio/i);
  });

  it('should render feedback form iframe', () => {
    render(<FeedbackPage />);
    if(navigator.onLine)fireEvent.click(screen.getByRole('button',{name:'Load Google form'}));

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toBe('https://docs.google.com/forms/d/e/1FAIpQLSdgfoCaXzmQL6iF4QR08owfFSAwH651jlGChzcnz-pqwsI4Gw/viewform?embedded=true');
  });

  it('should handle mobile layout', () => {
    // Mock window.innerWidth
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500, // Mobile width
    });

    render(<FeedbackPage />);
    if(navigator.onLine)fireEvent.click(screen.getByRole('button',{name:'Load Google form'}));

    // Shared layout and back navigation apply at mobile width
    expectSharedLayout();

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

    render(<FeedbackPage />);
    if(navigator.onLine)fireEvent.click(screen.getByRole('button',{name:'Load Google form'}));

    // Shared layout and back navigation apply at desktop width
    expectSharedLayout();

    // Restore window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });
});

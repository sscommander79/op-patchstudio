import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer } from '../../components/common/Footer';

describe('Footer', () => {
  it('shows the build version without linking to a missing public changelog', async () => {
    render(<Footer />);
    const version = await screen.findByText(new RegExp(`^v${__APP_VERSION__.replace(/\./g, '\\.')} · (dev )?build [\\w-]{8}$`));
    expect(version).toHaveAttribute('data-opstudio-build', __APP_BUILD_ID__);
    expect(version).toHaveAttribute('data-opstudio-mode', 'development');
    expect(screen.queryByRole('link', { name: new RegExp(`v${__APP_VERSION__.replace(/\./g, '\\.')}`) })).not.toBeInTheDocument();
  });
});

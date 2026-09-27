import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MainTabs } from '../../components/common/MainTabs';
import { AppContextProvider } from '../../context/AppContext';

describe('MainTabs', () => {
  const renderWithContext = () => {
    return render(
      <AppContextProvider>
        <MainTabs />
      </AppContextProvider>
    );
  };

  it('renders one workspace surface without a competing navigation layer', () => {
    renderWithContext();
    
    // The shell owns navigation, so there is no tablist and therefore no tabpanel semantics.
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('tabpanel')).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'drum tool content' })).toHaveAttribute('id', 'drum-tabpanel');
  });
});

import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {LibraryPagination} from '../../components/library/LibraryPagination';

afterEach(cleanup);
for (const isMobile of [false, true]) describe(`Library pagination ${isMobile ? 'mobile' : 'desktop'}`, () => {
  it('changes pages in both directions and disables boundaries', () => {
    function Harness() {
      const [page, setPage] = useState(1);
      return <LibraryPagination currentPage={page} totalPages={2} onPageChange={setPage} isMobile={isMobile}/>;
    }
    render(<Harness/>);
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(screen.getByText('Page 2 of 2')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'Previous'}));
    expect(screen.getByText('Page 1 of 2')).toBeVisible();
  });
  it('does not navigate an empty result set', () => {
    const change = vi.fn();
    render(<LibraryPagination currentPage={1} totalPages={0} onPageChange={change} isMobile={isMobile}/>);
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(change).not.toHaveBeenCalled();
  });
});

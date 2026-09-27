import {render,screen} from '@testing-library/react';
import {describe,expect,it} from 'vitest';
import {FileDetailsBadges} from '../../components/common/FileDetailsBadges';

describe('FileDetailsBadges',()=>{
  it('shows truthful unknown source depth while retaining the other source details',()=>{
    render(<FileDetailsBadges duration={1} fileSize={32} channels={2} sampleRate={44100}/>);
    expect(screen.getByText('source depth unknown')).toBeInTheDocument();
    expect(screen.getByText('44.1khz')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DrumPresetSettings } from '../../components/drum/DrumPresetSettings';
import { AppContextProvider, useAppContext } from '../../context/AppContext';

const { importPresetFromFile } = vi.hoisted(() => ({ importPresetFromFile: vi.fn() }));
vi.mock('../../utils/presetImport', async () => {
  const actual = await vi.importActual<typeof import('../../utils/presetImport')>('../../utils/presetImport');
  return { ...actual, importPresetFromFile };
});

function Harness() {
  const { state, dispatch } = useAppContext();
  const [showSettings, setShowSettings] = useState(true);

  return <>
    <button onClick={() => dispatch({ type: 'UNDO' })}>force undo</button>
    <button onClick={() => dispatch({ type: 'SET_DRUM_PRESET_PLAYMODE', payload: 'mono' })}>set separate playmode</button>
    <button onClick={() => setShowSettings(value => !value)}>toggle settings</button>
    <output aria-label="preset-state">{JSON.stringify(state.drumSettings.presetSettings)}</output>
    {showSettings && <DrumPresetSettings />}
  </>;
}

function renderSettings() {
  return render(<AppContextProvider><Harness /></AppContextProvider>);
}

async function expectTranspose(value: number) {
  await waitFor(() => {
    expect(screen.getByLabelText('preset-state')).toHaveTextContent(`"transpose":${value}`);
    expect(document.querySelector('#preset-transpose')).toHaveAttribute('aria-valuenow', String(value));
  });
}

describe('project history with the installed Carbon Slider', () => {
  beforeEach(() => importPresetFromFile.mockReset());

  it('keeps a separate edit after programmatic slider synchronization and unmount', async () => {
    importPresetFromFile.mockResolvedValue({
      success: true,
      data: { type: 'drum', engine: { playmode: 'legato', transpose: 9, 'velocity.sensitivity': 16384, volume: 24576, width: 8192 } },
    });
    const { container } = renderSettings();

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['{}'], 'patch.json')] },
    });
    await expectTranspose(9);
    fireEvent.click(screen.getByRole('button', { name: 'set separate playmode' }));
    expect(screen.getByLabelText('preset-state')).toHaveTextContent('"playmode":"mono"');

    fireEvent.click(screen.getByRole('button', { name: 'toggle settings' }));
    expect(screen.getByLabelText('preset-state')).toHaveTextContent('"playmode":"mono"');
    fireEvent.click(screen.getByRole('button', { name: 'force undo' }));
    expect(screen.getByLabelText('preset-state')).toHaveTextContent('"playmode":"legato"');
  });

  it('groups each multi-change keyboard gesture after undo settles an active gesture', async () => {
    renderSettings();
    const slider = document.querySelector('#preset-transpose')!;

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    await expectTranspose(1);
    fireEvent.click(screen.getByRole('button', { name: 'force undo' }));
    await expectTranspose(0);

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    await expectTranspose(1);
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    await expectTranspose(2);
    fireEvent.keyUp(slider, { key: 'ArrowRight' });

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    await expectTranspose(3);
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    await expectTranspose(4);
    fireEvent.keyUp(slider, { key: 'ArrowRight' });

    fireEvent.click(screen.getByRole('button', { name: 'force undo' }));
    await expectTranspose(2);
    fireEvent.click(screen.getByRole('button', { name: 'force undo' }));
    await expectTranspose(0);
  });
});

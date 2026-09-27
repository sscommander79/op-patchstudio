import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '../../context/AppContext';
import { MultisamplePresetSettings } from '../../components/multisample/MultisamplePresetSettings';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  importPresetFile: vi.fn(),
}));

vi.mock('../../context/AppContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/AppContext')>('../../context/AppContext');
  return {
    ...actual,
    useAppContext: () => ({ state: actual.initialState, dispatch: mocks.dispatch,importPresetFile:mocks.importPresetFile }),
    useProjectHistory: () => ({ beginEdit: vi.fn(), endEdit: vi.fn(), cancelEdit: vi.fn(), canUndo:false, canRedo:false, historyLimited:false }),
  };
});

vi.mock('../../components/common/ADSREnvelope', () => ({
  ADSREnvelope: () => <div data-testid="adsr-envelope" />,
}));

describe('MultisamplePresetSettings import', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.importPresetFile.mockReset();
  });

  it('dispatches one coherent preset import for raw preservation and editable hydration', async () => {
    mocks.importPresetFile.mockResolvedValue(undefined);
    const { container } = render(<MultisamplePresetSettings />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, {
      target: { files: [new File(['{}'], 'patch.json', { type: 'application/json' })] },
    });

    await waitFor(() => {
      expect(mocks.importPresetFile).toHaveBeenCalledWith(expect.objectContaining({name:'patch.json'}),'multisample');
    });
    expect(initialState.multisampleSettings.transpose).toBe(0);
  });
});

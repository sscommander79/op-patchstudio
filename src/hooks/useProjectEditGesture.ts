import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useProjectHistory } from '../context/AppContext';

export function useProjectEditGesture(token: string) {
  const { beginEdit, endEdit, cancelEdit } = useProjectHistory();
  const activeRef = useRef(false);

  const begin = useCallback(() => {
    activeRef.current = true;
    beginEdit(token);
  }, [beginEdit, token]);

  const end = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    endEdit(token);
  }, [endEdit, token]);

  const cancel = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    cancelEdit(token);
  }, [cancelEdit, token]);

  useEffect(() => cancel, [cancel]);

  const beginForSliderKey = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp') begin();
  }, [begin]);

  return {
    begin,
    end,
    cancel,
    sliderProps: {
      onPointerDownCapture: begin,
      onKeyDownCapture: beginForSliderKey,
    },
  };
}

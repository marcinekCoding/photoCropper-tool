import { useCallback, useState } from 'react';
import type { AppStep, CropAspectRatio, CropState, QueuedImage, SessionState } from '../types';

const initialState: SessionState = {
  step: 'dimensions',
  aspectRatio: null,
  directoryHandle: null,
  queue: [],
  currentIndex: 0,
  savedCount: 0,
  savedCrops: {},
};

export function useSession() {
  const [state, setState] = useState<SessionState>(initialState);

  const setAspectRatio = useCallback((aspectRatio: CropAspectRatio) => {
    setState((prev) => ({
      ...prev,
      aspectRatio,
      step: 'folder',
    }));
  }, []);

  const setFolder = useCallback(
    (directoryHandle: FileSystemDirectoryHandle, queue: QueuedImage[]) => {
      setState((prev) => ({
        ...prev,
        directoryHandle,
        queue,
        currentIndex: 0,
        savedCount: 0,
        savedCrops: {},
        step: 'crop',
      }));
    },
    [],
  );

  const goToStep = useCallback((step: AppStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const acceptCurrent = useCallback((fileName: string, cropState: CropState) => {
    setState((prev) => {
      const isResave = fileName in prev.savedCrops;
      const savedCrops = { ...prev.savedCrops, [fileName]: cropState };
      return {
        ...prev,
        currentIndex: prev.currentIndex + 1,
        savedCrops,
        savedCount: isResave ? prev.savedCount : prev.savedCount + 1,
      };
    });
  }, []);

  const skipCurrent = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));
  }, []);

  const resetSession = useCallback(() => {
    setState(initialState);
  }, []);

  const currentImage =
    state.step === 'crop' && state.queue.length > 0
      ? state.queue[state.currentIndex] ?? null
      : null;

  const isComplete =
    state.step === 'crop' &&
    state.queue.length > 0 &&
    state.currentIndex >= state.queue.length;

  return {
    state,
    currentImage,
    isComplete,
    setAspectRatio,
    setFolder,
    goToStep,
    acceptCurrent,
    skipCurrent,
    goBack,
    resetSession,
  };
}

export type UseSessionReturn = ReturnType<typeof useSession>;

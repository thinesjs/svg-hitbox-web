import { useState, useRef, useCallback } from "react";

const DEFAULT_MAX_ENTRIES = 100;

interface UseHistoryReturn<T> {
  state: T;
  setState: (valueOrUpdater: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetHistory: (newState?: T) => void;
  beginBatch: () => void;
  commitBatch: () => void;
}

export function useHistory<T>(
  initialState: T,
  maxEntries: number = DEFAULT_MAX_ENTRIES,
): UseHistoryReturn<T> {
  const [current, setCurrent] = useState<T>(initialState);
  const undoStackRef = useRef<T[]>([]);
  const redoStackRef = useRef<T[]>([]);
  const batchRef = useRef<T | null>(null);
  const currentRef = useRef<T>(current);
  currentRef.current = current;

  // Force re-render to update canUndo/canRedo
  const [, forceRender] = useState(0);
  const triggerRender = useCallback(() => forceRender((n) => n + 1), []);

  const setStateImpl = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      if (batchRef.current !== null) {
        setCurrent(valueOrUpdater);
        return;
      }
      const prev = currentRef.current;
      undoStackRef.current = [...undoStackRef.current, prev];
      if (undoStackRef.current.length > maxEntries) {
        undoStackRef.current = undoStackRef.current.slice(undoStackRef.current.length - maxEntries);
      }
      redoStackRef.current = [];
      setCurrent(valueOrUpdater);
      triggerRender();
    },
    [maxEntries, triggerRender],
  );

  // Stable ref wrapper so consumers don't need setState in their dep arrays
  const setStateRef = useRef(setStateImpl);
  setStateRef.current = setStateImpl;
  const stableSetState = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => setStateRef.current(valueOrUpdater),
    [],
  );

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, currentRef.current];
    setCurrent(prev);
    triggerRender();
  }, [triggerRender]);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    const next = stack[stack.length - 1];
    redoStackRef.current = stack.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, currentRef.current];
    setCurrent(next);
    triggerRender();
  }, [triggerRender]);

  const resetHistoryImpl = useCallback(
    (newState?: T) => {
      undoStackRef.current = [];
      redoStackRef.current = [];
      batchRef.current = null;
      if (newState !== undefined) {
        setCurrent(newState);
      }
      triggerRender();
    },
    [triggerRender],
  );

  // Stable ref wrapper for resetHistory
  const resetHistoryRef = useRef(resetHistoryImpl);
  resetHistoryRef.current = resetHistoryImpl;
  const stableResetHistory = useCallback((newState?: T) => resetHistoryRef.current(newState), []);

  const beginBatch = useCallback(() => {
    batchRef.current = currentRef.current;
  }, []);

  const commitBatch = useCallback(() => {
    if (batchRef.current === null) return;
    undoStackRef.current = [...undoStackRef.current, batchRef.current];
    if (undoStackRef.current.length > maxEntries) {
      undoStackRef.current = undoStackRef.current.slice(undoStackRef.current.length - maxEntries);
    }
    redoStackRef.current = [];
    batchRef.current = null;
    triggerRender();
  }, [maxEntries, triggerRender]);

  return {
    state: current,
    setState: stableSetState,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    resetHistory: stableResetHistory,
    beginBatch,
    commitBatch,
  };
}

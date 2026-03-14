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

  const setState = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      setCurrent((prev) => {
        const next =
          typeof valueOrUpdater === "function"
            ? (valueOrUpdater as (prev: T) => T)(prev)
            : valueOrUpdater;

        // If batching, don't push to undo stack
        if (batchRef.current !== null) {
          return next;
        }

        // Push previous state to undo stack
        undoStackRef.current = [...undoStackRef.current, prev];
        if (undoStackRef.current.length > maxEntries) {
          undoStackRef.current = undoStackRef.current.slice(
            undoStackRef.current.length - maxEntries,
          );
        }
        // Clear redo stack on new action
        redoStackRef.current = [];
        triggerRender();
        return next;
      });
    },
    [maxEntries, triggerRender],
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

  const resetHistory = useCallback(
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

  const beginBatch = useCallback(() => {
    batchRef.current = currentRef.current;
  }, []);

  const commitBatch = useCallback(() => {
    if (batchRef.current === null) return;
    // Push the pre-batch state as a single undo entry
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
    setState,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    resetHistory,
    beginBatch,
    commitBatch,
  };
}

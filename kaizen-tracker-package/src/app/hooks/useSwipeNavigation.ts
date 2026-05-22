import { useEffect, useRef } from "react";

const SWIPE_THRESHOLD = 64;   // px horizontal travel to trigger
const AXIS_LOCK = 30;         // px vertical travel that cancels a swipe

interface Options {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  targetRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
}

export function useSwipeNavigation({ onSwipeLeft, onSwipeRight, targetRef, disabled }: Options) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (disabled) return;
    const el = targetRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      startX.current = e.clientX;
      startY.current = e.clientY;
      cancelled.current = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (startX.current === null || startY.current === null) return;
      const dy = Math.abs(e.clientY - startY.current);
      if (dy > AXIS_LOCK) {
        cancelled.current = true;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (startX.current === null || cancelled.current) {
        startX.current = null;
        startY.current = null;
        return;
      }
      const dx = e.clientX - startX.current;
      if (dx < -SWIPE_THRESHOLD) onSwipeLeft();
      else if (dx > SWIPE_THRESHOLD) onSwipeRight();
      startX.current = null;
      startY.current = null;
    };

    const onPointerCancel = () => {
      startX.current = null;
      startY.current = null;
      cancelled.current = false;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [onSwipeLeft, onSwipeRight, targetRef, disabled]);
}

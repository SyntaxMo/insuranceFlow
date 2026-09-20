"use client";

import { useEffect, useRef } from "react";
import styles from "./CursorAmbientGlow.module.css";

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function CursorAmbientGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow || typeof window.matchMedia !== "function") return;

    const finePointer = window.matchMedia(FINE_POINTER_QUERY);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    let frameId: number | null = null;
    let targetX = 0;
    let targetY = 0;

    const canAnimate = () => finePointer.matches && !reducedMotion.matches;

    const hideGlowWhenDisabled = () => {
      if (!canAnimate()) glow.dataset.visible = "false";
    };

    const updateGlow = () => {
      glow.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`;
      glow.dataset.visible = "true";
      frameId = null;
    };

    const followPointer = (event: PointerEvent) => {
      if (!canAnimate() || event.pointerType !== "mouse") return;

      targetX = event.clientX;
      targetY = event.clientY;
      if (frameId === null) frameId = window.requestAnimationFrame(updateGlow);
    };

    window.addEventListener("pointermove", followPointer, { passive: true });
    finePointer.addEventListener("change", hideGlowWhenDisabled);
    reducedMotion.addEventListener("change", hideGlowWhenDisabled);

    return () => {
      window.removeEventListener("pointermove", followPointer);
      finePointer.removeEventListener("change", hideGlowWhenDisabled);
      reducedMotion.removeEventListener("change", hideGlowWhenDisabled);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      data-cursor-ambient-glow
      data-visible="false"
      className={styles.glow}
    />
  );
}

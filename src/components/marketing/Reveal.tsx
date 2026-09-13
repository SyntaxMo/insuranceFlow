"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({ children, className = "", delay = 0, direction = "up" }: { children: ReactNode; className?: string; delay?: number; direction?: "up" | "left" | "right" | "scale" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px 0px 160px", threshold: 0.01 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hiddenTransform = { up: "translate-y-5", left: "-translate-x-5", right: "translate-x-5", scale: "scale-[0.985]" }[direction];
  return <div ref={ref} data-reveal data-visible={visible} style={{ transitionDelay: `${delay}ms` }} className={`${className} transform-gpu transition-[opacity,transform] duration-500 ease-out motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:transition-none ${visible ? "translate-x-0 translate-y-0 scale-100 opacity-100" : `${hiddenTransform} opacity-0`}`}>{children}</div>;
}

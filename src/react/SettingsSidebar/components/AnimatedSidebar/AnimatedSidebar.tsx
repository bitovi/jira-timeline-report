import type { FC, ReactNode } from "react";

import React, { useState, useLayoutEffect, useRef, useEffect } from "react";

import { value } from "../../../../can";
import routeData from "../../../../canjs/routing/route-data";
import { useCanObservable } from "../../../hooks/useCanObservable";

const duration = 300;

interface AnimatedSidebarProps {
  children: ReactNode;
}

const AnimatedSidebar: FC<AnimatedSidebarProps> = ({ children }) => {
  const showSettings = useCanObservable<string>(value.from(routeData, "showSettings"));
  const [visible, setVisible] = useState(true);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!hiddenRef.current) return;

    const clone = hiddenRef.current.cloneNode(true) as HTMLDivElement;

    clone.style.display = "block";
    clone.style.position = "absolute";
    clone.style.visibility = "hidden";
    clone.setAttribute("aria-hidden", "true");

    document.body.appendChild(clone);

    const rect = clone.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    setVisible(false);

    document.body.removeChild(clone);
  }, [showSettings]);

  useEffect(() => {
    if (visible) return;

    const id = setTimeout(() => {
      setVisible(true);
    }, duration);

    return () => clearTimeout(id);
  }, [visible]);

  return (
    <div
      className={`h-full min-w-40 transition-[width] duration-${duration} overflow-hidden`}
      ref={containerRef}
      style={{
        width: size?.width ?? "auto",
        opacity: visible ? 1 : 0,
      }}
    >
      <div ref={hiddenRef} className="hidden">
        {children}
      </div>
      {children}
    </div>
  );
};

export default AnimatedSidebar;

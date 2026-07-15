import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

const TOOLTIP_WIDTH = 256;
const EDGE_MARGIN = 8;

export const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, caretLeft: '50%', below: false });
  const iconRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const iconCenterX = rect.left + rect.width / 2;
    const clampedLeft = Math.max(
      TOOLTIP_WIDTH / 2 + EDGE_MARGIN,
      Math.min(iconCenterX, window.innerWidth - TOOLTIP_WIDTH / 2 - EDGE_MARGIN),
    );
    const caretLeft = `calc(50% + ${iconCenterX - clampedLeft}px)`;
    const below = rect.top < 88;
    setPos({ top: below ? rect.bottom + 8 : rect.top - 8, left: clampedLeft, caretLeft, below });
    setVisible(true);
  };

  return (
    <span className="inline-block ml-1 align-middle">
      <span
        ref={iconRef}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        className="cursor-help text-gray-300 hover:text-gray-400 text-xs select-none"
      >
        ⓘ
      </span>
      {visible &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: pos.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              zIndex: 9999,
            }}
            className="w-64 bg-gray-800 text-white text-xs rounded px-3 py-2 pointer-events-none shadow-lg leading-relaxed"
          >
            {text}
            <span
              style={{
                position: 'absolute',
                left: pos.caretLeft,
                transform: 'translateX(-50%)',
                ...(pos.below
                  ? { bottom: '100%', borderBottom: '4px solid #1f2937', borderTop: '0' }
                  : { top: '100%', borderTop: '4px solid #1f2937', borderBottom: '0' }),
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
              }}
            />
          </div>,
          document.body,
        )}
    </span>
  );
};

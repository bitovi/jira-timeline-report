import React, { useState, useEffect, useRef } from 'react';
import Checkbox from '@atlaskit/checkbox';

// Sentinel stored in route data to represent "user explicitly selected none".
// Route data serializes [] and undefined identically, so this distinguishes them.
export const CHECKLIST_NONE_SENTINEL = '__none__';

export function ChecklistDropdown({
  options,
  value,
  onChange,
  minWidth,
}: {
  options: string[];
  value: string[] | undefined;
  onChange: (values: string[] | undefined) => void;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isNoneMode = value?.length === 1 && value[0] === CHECKLIST_NONE_SENTINEL;
  // isAllMode when value is empty/undefined OR when all options are explicitly selected
  const isAllMode = !isNoneMode && (!value?.length || (options.length > 0 && value.length === options.length));
  const isChecked = (opt: string) => !isNoneMode && (isAllMode || value!.includes(opt));
  const buttonLabel = isAllMode
    ? `All (${options.length})`
    : isNoneMode
      ? 'None selected'
      : `${value!.length} of ${options.length} selected`;

  // When going from partial → all, store options explicitly so computeEffectiveFilter
  // (used by FlowMetricsViewSettings) sees a non-empty array and doesn't re-apply defaults.
  const toggleAll = () => onChange(isAllMode ? [CHECKLIST_NONE_SENTINEL] : [...options]);

  const toggleOption = (opt: string) => {
    if (isAllMode || isNoneMode) {
      const result = isAllMode ? options.filter((o) => o !== opt) : [opt];
      onChange(result.length === 0 ? [CHECKLIST_NONE_SENTINEL] : result);
    } else {
      const set = new Set(value);
      if (set.has(opt)) set.delete(opt);
      else set.add(opt);
      if (set.size === 0) {
        onChange([CHECKLIST_NONE_SENTINEL]);
        return;
      }
      onChange(set.size === options.length ? [...options] : [...set]);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: minWidth ? `${minWidth}px` : undefined }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '3px 10px',
          border: '2px solid #DFE1E6',
          borderRadius: '4px',
          background: '#FAFBFC',
          cursor: 'pointer',
          fontSize: '14px',
          height: '32px',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#172B4D',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{buttonLabel}</span>
        <span style={{ fontSize: '10px', color: '#7A869A', marginLeft: '6px' }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            zIndex: 200,
            background: '#fff',
            border: '1px solid #DFE1E6',
            borderRadius: '4px',
            boxShadow: '0 8px 16px -4px rgba(9,30,66,0.25), 0 0 1px rgba(9,30,66,0.31)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '2px 8px 4px', borderBottom: '1px solid #F4F5F7' }}>
            <Checkbox value="__all__" label={<strong>Select All</strong>} isChecked={isAllMode} onChange={toggleAll} />
          </div>
          {options.map((opt) => (
            <div key={opt} style={{ padding: '2px 8px', whiteSpace: 'nowrap' }}>
              <Checkbox value={opt} label={opt} isChecked={isChecked(opt)} onChange={() => toggleOption(opt)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React from 'react';

import { UncertaintyWeight } from '../../../../../reports/AutoScheduler/scheduler/stats-analyzer';

type Props = {
  uncertaintyWeight: UncertaintyWeight;
  onChange: (value: UncertaintyWeight) => void;
};

const AVERAGE = 55;

const UncertaintySlider: React.FC<Props> = ({ uncertaintyWeight, onChange }) => {
  // Convert display value (55 for "average") to actual uncertaintyWeight and back
  const value = uncertaintyWeight === 'average' ? AVERAGE : uncertaintyWeight;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value, 10);
    onChange(num === AVERAGE ? 'average' : num);
  };

  return (
    <div className="relative flex flex-grow px-2 items-end">
      <input
        className="w-full mb-4"
        type="range"
        min={50}
        max={90}
        step={5}
        value={value}
        onChange={handleChange}
        list="range-values"
      />
      <datalist
        id="range-values"
        style={{
          width: 'calc((100% - 15px) * 10.115 / 9)',
          left: 'calc(7.5px - (100% - 15px) * 10.115 / 9 / 18)',
          gridTemplateColumns: 'repeat(9, 1fr)',
          gridTemplateRows: 'auto',
        }}
        className="grid absolute bottom-0"
      >
        <option value="50" className="text-center text-xs relative left-3">
          Median
        </option>
        <option value="55" className="text-center text-xs">
          Average
        </option>
        <option value="60" className="text-center text-xs">
          60%
        </option>
        <option value="65" className="text-center text-xs">
          65%
        </option>
        <option value="70" className="text-center text-xs">
          70%
        </option>
        <option value="75" className="text-center text-xs">
          75%
        </option>
        <option value="80" className="text-center text-xs">
          80%
        </option>
        <option value="85" className="text-center text-xs">
          85%
        </option>
        <option value="90" className="text-center text-xs">
          90%
        </option>
      </datalist>
    </div>
  );
};

export default UncertaintySlider;

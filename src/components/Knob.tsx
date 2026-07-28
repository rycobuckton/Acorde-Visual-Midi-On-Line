import React, { useRef, useState, useEffect } from 'react';

interface KnobProps {
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  defaultValue?: number;
  onChange: (val: number) => void;
  unit?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  displayValue?: string;
  isLogarithmic?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const Knob: React.FC<KnobProps> = ({
  label,
  min,
  max,
  value,
  step = 1,
  defaultValue,
  onChange,
  unit = '',
  color = 'text-emerald-500',
  size = 'md',
  displayValue,
  isLogarithmic = false,
  onContextMenu,
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startP = useRef(0);
  const startValue = useRef(0);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
  };

  // Compute logarithmic or linear percent [0, 1]
  const getPercentFromValue = (v: number) => {
    const clamped = Math.max(min, Math.min(max, v));
    if (isLogarithmic && min > 0 && max > min) {
      return Math.log(clamped / min) / Math.log(max / min);
    }
    return (clamped - min) / (max - min || 1);
  };

  const percent = getPercentFromValue(value);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    e.preventDefault();
    knobRef.current?.setPointerCapture(e.pointerId);
    setIsDragging(true);
    startY.current = e.clientY;
    startP.current = percent;
    startValue.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.clientY; // drag up to increase
    const pixelsPerRange = 150; // drag 150px to go from 0% to 100%

    if (isLogarithmic && min > 0 && max > min) {
      const deltaP = deltaY / pixelsPerRange;
      const newP = Math.max(0, Math.min(1, startP.current + deltaP));
      let newValue = min * Math.pow(max / min, newP);

      // Smart rounding for logarithmic frequency knobs
      if (newValue < 1000) {
        newValue = Math.round(newValue / 10) * 10;
      } else if (newValue < 5000) {
        newValue = Math.round(newValue / 50) * 50;
      } else {
        newValue = Math.round(newValue / 100) * 100;
      }
      newValue = Math.max(min, Math.min(max, newValue));
      onChange(newValue);
    } else {
      const range = max - min;
      const deltaValue = (deltaY / pixelsPerRange) * range;
      let newValue = startValue.current + deltaValue;
      newValue = Math.max(min, Math.min(max, newValue));

      const steppedValue = Math.round(newValue / step) * step;
      onChange(parseFloat(steppedValue.toFixed(4)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      knobRef.current?.releasePointerCapture(e.pointerId);
      setIsDragging(false);
    }
  };

  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  // Calculate rotation angle (from -135deg to +135deg)
  const knobPercent = getPercentFromValue(value);
  const angle = -135 + knobPercent * 270;

  // SVG parameters for progress ring
  const radius = size === 'sm' ? 14 : size === 'lg' ? 32 : 22;
  const strokeWidth = size === 'sm' ? 2.5 : size === 'lg' ? 4.5 : 3.5;
  const circumference = 2 * Math.PI * radius;
  // Progress stroke-dashoffset (we only draw 270 degrees)
  const angleRange = 270;
  const progressAngle = knobPercent * angleRange;
  const strokeDasharray = `${(angleRange / 360) * circumference} ${circumference}`;
  const strokeDashoffset = ((angleRange - progressAngle) / 360) * circumference;

  return (
    <div 
      className="flex flex-col items-center select-none cursor-context-menu" 
      title="Arraste verticalmente para ajustar (Clique com o botão direito para Aprender MIDI CC)"
      onContextMenu={onContextMenu}
    >
      <span className="text-[8px] font-mono font-black text-zinc-500 uppercase tracking-widest mb-1 truncate max-w-[64px] text-center">
        {label}
      </span>

      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className={`relative flex items-center justify-center cursor-ns-resize touch-none ${sizeClasses[size]}`}
      >
        {/* Glow Ring */}
        <div className={`absolute inset-0.5 rounded-full bg-zinc-950 border border-zinc-800 shadow-inner`} />
        
        {/* SVG Ring and Progress */}
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          {/* Background Arc */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            stroke="#18181b"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            className="rotate-[135deg]"
            style={{ transformOrigin: '50% 50%' }}
          />
          {/* Active Progress Arc */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={`rotate-[135deg] transition-all duration-75 ${color}`}
            style={{ transformOrigin: '50% 50%' }}
          />
        </svg>

        {/* Physical Cap */}
        <div 
          className="w-4/5 h-4/5 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 shadow-lg flex items-center justify-center transition-transform duration-75 relative"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {/* Knob Line Indicator */}
          <div className="absolute top-1 w-0.5 h-1/3 bg-white rounded-full opacity-90 shadow-[0_0_4px_white]" />
          {/* Metallic Inner Ring */}
          <div className="w-[70%] h-[70%] rounded-full bg-zinc-950/30 border border-zinc-750/50" />
        </div>
      </div>

      <span className="text-[9px] font-mono font-bold text-zinc-350 mt-1 min-h-[12px] flex items-center gap-0.5 justify-center">
        {displayValue !== undefined ? (
          <span>{displayValue}</span>
        ) : unit === 'Hz' ? (
          value >= 1000 ? (
            <>
              {(value / 1000).toFixed(value >= 10000 ? 1 : 2)}
              <span className="text-zinc-500 text-[8px] font-bold">kHz</span>
            </>
          ) : (
            <>
              {Math.round(value)}
              <span className="text-zinc-500 text-[8px] font-bold">Hz</span>
            </>
          )
        ) : (
          <>
            {value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}
            <span className="text-zinc-600 text-[8px]">{unit}</span>
          </>
        )}
      </span>
    </div>
  );
};

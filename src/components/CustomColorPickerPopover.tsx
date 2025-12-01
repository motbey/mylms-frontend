import React, { useEffect, useRef, useState } from 'react';

const PRESET_COLORS = [
  '#2563EB', // Blue
  '#4B5563', // Gray
  '#7C3AED', // Purple
  '#F97316', // Orange
  '#DC2626', // Red
  '#22C55E', // Green
  '#EC4899', // Pink
  '#14B8A6', // Teal
];

interface CustomColorPickerPopoverProps {
  /** current colour value, e.g. "#ff7a1a" */
  value: string;
  /** called whenever the user adjusts the colour */
  onChange: (hex: string) => void;
  /** called when user clicks Done */
  onDone: () => void;
  /** called when user clicks Reset (should go back to theme colour) */
  onReset?: () => void;
  /** Optional anchor rect for positioning (the Custom row DOMRect) */
  anchorRect?: DOMRect | null;
}

export const CustomColorPickerPopover: React.FC<CustomColorPickerPopoverProps> = ({
  value,
  onChange,
  onDone,
  onReset,
  anchorRect,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [hexInput, setHexInput] = useState(value.replace('#', ''));

  // Sync hex input when value changes externally
  useEffect(() => {
    setHexInput(value.replace('#', ''));
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) {
        onDone();
      }
    }
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [onDone]);

  // Position to the right of the anchor element, aligned so bottom matches anchor bottom
  const panelHeight = 380; // approximate height of the color picker panel
  const style: React.CSSProperties = anchorRect
    ? {
        position: 'fixed',
        // Align bottom of picker with bottom of anchor (Custom row)
        top: Math.max(
          16, // minimum 16px from top
          anchorRect.bottom - panelHeight
        ),
        left: Math.min(
          anchorRect.right + 12, // 12px gap to the right of anchor
          window.innerWidth - 340 // ensure it fits in viewport
        ),
        zIndex: 50,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 50,
      };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setHexInput(raw);
    if (raw.length === 6) {
      onChange('#' + raw.toUpperCase());
    }
  };

  const handleHexInputBlur = () => {
    if (hexInput.length === 6) {
      onChange('#' + hexInput.toUpperCase());
    } else {
      // Reset to current value if invalid
      setHexInput(value.replace('#', ''));
    }
  };

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" />

      <div
        ref={panelRef}
        style={style}
        className="
          z-50 w-[280px] rounded-xl bg-white shadow-2xl border border-gray-200
          px-4 pb-4 pt-3 flex flex-col gap-4 overflow-hidden
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900">Choose Color</span>
          <button
            type="button"
            onClick={onDone}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Preset colours grid */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">Presets</div>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`
                  h-8 w-8 rounded-lg border-2 shadow-sm transition-all hover:scale-110
                  ${value.toLowerCase() === c.toLowerCase() 
                    ? 'border-orange-500 ring-2 ring-orange-200' 
                    : 'border-white'}
                `}
                style={{ backgroundColor: c }}
                onClick={() => onChange(c)}
              />
            ))}
          </div>
        </div>

        {/* Native color picker + hex input */}
        <div className="flex items-center gap-3">
          {/* Large color picker button */}
          <label className="relative cursor-pointer flex-shrink-0">
            <div
              className="h-14 w-14 rounded-xl border-2 border-gray-200 shadow-inner"
              style={{ backgroundColor: value }}
            />
            <input
              type="color"
              className="absolute inset-0 opacity-0 cursor-pointer"
              value={value}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs text-white/80 font-medium drop-shadow-md">Pick</span>
            </div>
          </label>

          {/* Hex input */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-500 mb-1">Hex Color</div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-gray-400 flex-shrink-0">#</span>
              <input
                type="text"
                className="
                  w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                  font-mono text-gray-800 uppercase focus:outline-none focus:ring-2
                  focus:ring-orange-500 focus:border-transparent
                "
                value={hexInput}
                maxLength={6}
                placeholder="FFFFFF"
                onChange={handleHexInputChange}
                onBlur={handleHexInputBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleHexInputBlur();
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Current color preview */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div
            className="h-10 w-10 rounded-lg border border-gray-200"
            style={{ backgroundColor: value }}
          />
          <div>
            <div className="text-xs text-gray-500">Selected</div>
            <div className="font-mono text-sm font-medium text-gray-800">{value}</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors"
            onClick={() => {
              if (onReset) onReset();
            }}
          >
            Reset to Theme
          </button>

          <button
            type="button"
            className="
              px-6 py-2 rounded-full bg-gray-900 text-sm
              font-medium text-white hover:bg-gray-800 transition-colors
            "
            onClick={onDone}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
};

export default CustomColorPickerPopover;

import React, { useState, useEffect, useRef } from 'react';
import { CustomColorPickerPopover } from '../CustomColorPickerPopover';

// Block style types
export type BlockStyle =
  | 'light'
  | 'gray'
  | 'theme'
  | 'themeTint'
  | 'dark'
  | 'black'
  | 'custom'
  | 'image';

type BlockStyleMenuProps = {
  open: boolean;
  onClose: () => void;
  style: BlockStyle;
  customBackgroundColor?: string;
  onChange: (style: BlockStyle, customBackgroundColor?: string) => void;
  className?: string;
};

// Standard style options (excluding 'custom' which has special UI)
const STANDARD_STYLE_OPTIONS: { value: BlockStyle; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'gray', label: 'Gray' },
  { value: 'theme', label: 'Theme' },
  { value: 'themeTint', label: 'Theme tint' },
  { value: 'dark', label: 'Dark' },
  { value: 'black', label: 'Black' },
  { value: 'image', label: 'Image' },
];

const DEFAULT_CUSTOM_COLOR = '#FFFFFF';
const THEME_COLOR = '#ff7a1a';

// Get preview background class for standard styles
function getPreviewBg(styleValue: BlockStyle): string {
  switch (styleValue) {
    case 'light':
      return 'bg-gray-50';
    case 'gray':
      return 'bg-gray-200';
    case 'theme':
      return 'bg-[#ff7a1a]';
    case 'themeTint':
      return 'bg-[#FFE2CC]';
    case 'dark':
      return 'bg-neutral-800';
    case 'black':
      return 'bg-black';
    case 'image':
      return 'bg-gradient-to-br from-gray-300 to-gray-400';
    default:
      return 'bg-white';
  }
}

export function BlockStyleMenu({
  open,
  onClose,
  style,
  customBackgroundColor,
  onChange,
  className = '',
}: BlockStyleMenuProps) {
  // Ref for the Custom row to anchor the popover
  const customRowRef = useRef<HTMLDivElement | null>(null);

  // State for showing the full color picker popover
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // The current custom color (use prop or default)
  const customColor = customBackgroundColor || DEFAULT_CUSTOM_COLOR;

  // Close picker when menu closes
  useEffect(() => {
    if (!open) {
      setShowCustomPicker(false);
    }
  }, [open]);

  if (!open) return null;

  const handleStandardStyleClick = (styleValue: BlockStyle) => {
    // When selecting a non-custom style, we keep the custom color in case they switch back
    onChange(styleValue, customBackgroundColor);
  };

  const openCustomPicker = () => {
    setShowCustomPicker(true);
    // Ensure style is set to custom
    onChange('custom', customColor);
  };

  const closeCustomPicker = () => {
    setShowCustomPicker(false);
    // Also close the style menu when done with color picker
    onClose();
  };

  const handleCustomColorChange = (hex: string) => {
    onChange('custom', hex.toUpperCase());
  };

  const handleReset = () => {
    // Reset to theme color
    onChange('theme', undefined);
    closeCustomPicker();
  };

  return (
    <>
      <div
        className={`
          absolute z-40 rounded-xl border border-gray-200 bg-white shadow-xl
          w-[280px] max-w-[90vw] text-sm overflow-hidden
          ${className}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="font-medium text-gray-900">Style</div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Section label */}
        <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Color
        </div>

        {/* Options */}
        <div className="px-3 pb-3 space-y-2">
          {/* Standard style options */}
          {STANDARD_STYLE_OPTIONS.map((option) => {
            const isActive = option.value === style;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleStandardStyleClick(option.value)}
                className={`
                  flex w-full items-center justify-between rounded-lg px-3 py-2
                  text-left transition
                  ${isActive ? 'ring-1 ring-[#ff7a1a] bg-orange-50' : 'hover:bg-gray-50'}
                `}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">
                    {option.label}
                  </span>
                </div>
              <div
                className={`ml-3 h-6 w-16 rounded-md border border-gray-200/70 ${getPreviewBg(option.value)}`}
              />
              </button>
            );
          })}

          {/* Custom colour option - opens full color picker */}
          <div
            ref={customRowRef}
            className={`
              flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer transition
              ${style === 'custom' ? 'ring-1 ring-[#ff7a1a] bg-orange-50' : 'hover:bg-gray-50'}
            `}
            onClick={openCustomPicker}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">Custom</span>
              <span className="text-xs text-gray-500">Choose any background colour</span>
            </div>

            {/* Color swatch preview */}
            <div
              className="h-7 w-12 rounded border border-gray-300 shadow-inner"
              style={{ backgroundColor: customColor }}
            />
          </div>
        </div>
      </div>

      {/* Custom Color Picker Popover */}
      {showCustomPicker && (
        <CustomColorPickerPopover
          value={customColor}
          onChange={handleCustomColorChange}
          onDone={closeCustomPicker}
          onReset={handleReset}
          anchorRect={customRowRef.current?.getBoundingClientRect() ?? null}
        />
      )}
    </>
  );
}

export default BlockStyleMenu;

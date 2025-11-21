import React, { useRef, ChangeEvent, KeyboardEvent, ClipboardEvent } from 'react';

interface OtpCodeInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  inputClassName?: string;
}

const OtpCodeInput: React.FC<OtpCodeInputProps> = ({ length = 6, value, onChange, disabled, inputClassName }) => {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  
  const baseClasses = "w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none transition disabled:bg-gray-100/50 disabled:cursor-not-allowed";
  const defaultClasses = "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50";
  const finalClassName = inputClassName ? `${baseClasses} ${inputClassName}` : `${baseClasses} ${defaultClasses}`;


  const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const target = e.target as HTMLInputElement;
    let targetValue = target.value.trim();
    
    // Allow only numeric input
    if (!/^\d*$/.test(targetValue)) {
      return;
    }
    
    targetValue = targetValue.slice(-1); // Keep only the last digit

    const newValue = value.split('');
    newValue[index] = targetValue;
    onChange(newValue.join(''));

    // Move to the next input if a digit is entered
    if (targetValue !== '' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (value[index] === '') {
        // If current input is empty, move to previous and clear it
        if (index > 0) {
          inputsRef.current[index - 1]?.focus();
        }
      } else {
        // If current input has a value, just clear it
        const newValue = value.split('');
        newValue[index] = '';
        onChange(newValue.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().slice(0, length);
    if (/^\d+$/.test(pastedData)) {
      onChange(pastedData);
      inputsRef.current[Math.min(pastedData.length, length - 1)]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => {inputsRef.current[index] = el;}}
          type="text"
          inputMode="numeric"
          pattern="\d{1}"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          disabled={disabled}
          className={finalClassName}
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
};

export default OtpCodeInput;

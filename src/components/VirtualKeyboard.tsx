import React, { useState } from 'react';
import { Keyboard, CornerDownLeft, Delete, ArrowBigUp, Space } from 'lucide-react';
import {
  KeyboardMode,
  KEYBOARD_ROWS,
  KEYBOARD_MODES,
  getLayoutMap,
} from '../utils/keyboardLayouts';

interface VirtualKeyboardProps {
  mode: KeyboardMode;
  onInsertText: (text: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  activeKeyCode: number | null;
  physicalShift: boolean;
  compact?: boolean;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  mode,
  onInsertText,
  onBackspace,
  onEnter,
  activeKeyCode,
  physicalShift,
  compact,
}) => {
  const [virtualShift, setVirtualShift] = useState(false);
  const isShift = physicalShift || virtualShift;
  const layoutMap = getLayoutMap(mode);
  const currentModeInfo = KEYBOARD_MODES.find((m) => m.id === mode);

  const handleKeyClick = (keyCode: number, en: string, enShift: string) => {
    if (layoutMap && layoutMap[keyCode]) {
      const [normalChar, shiftChar] = layoutMap[keyCode];
      const charToInsert = isShift ? shiftChar : normalChar;
      if (charToInsert) {
        onInsertText(charToInsert);
      }
    } else {
      onInsertText(isShift ? enShift : en);
    }
    if (virtualShift) {
      setVirtualShift(false);
    }
  };

  // Common Malayalam vowels, chillus, and signs quick-bar for Manglish / English mode
  const quickMalayalamChars = [
    'അ', 'ആ', 'ഇ', 'ഈ', 'ഉ', 'ഊ', 'ഋ', 'എ', 'ഏ', 'ഐ', 'ഒ', 'ഓ', 'ഔ', 'ം', 'ഃ',
    '്', 'ാ', 'ി', 'ീ', 'ു', 'ൂ', 'ൃ', 'െ', 'േ', 'ൈ', 'ൊ', 'ോ', 'ൗ',
    'ൺ', 'ൻ', 'ർ', 'ൽ', 'ൾ', 'ക്ഷ', 'ന്റ', 'മ്പ', 'ങ്ക', 'ഞ്ച', 'ഞ്ഞ', 'ട്ട',
  ];

  return (
    <div className={`bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 select-none transition-colors${compact ? ' vk-compact' : ''}`} role="group" aria-label="On-screen Malayalam keyboard">
      <div className="vk-head flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Keyboard className="w-4 h-4 text-red-600 dark:text-red-400" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {currentModeInfo?.name} ({currentModeInfo?.malayalamName})
          </span>
          <span aria-hidden="true" className="vk-desc">·</span>
          <span className="vk-desc">{currentModeInfo?.description}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="vk-desc">Shortcut: {currentModeInfo?.shortcut}</span>
          <span aria-hidden="true" className="vk-desc">·</span>
          <button
            type="button"
            onClick={() => setVirtualShift((s) => !s)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isShift
                ? 'bg-red-600 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            Shift {isShift ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Quick Vowel & Chillu Strip */}
      <div className="vk-quick flex flex-wrap gap-1 mb-3 pb-2.5 border-b border-slate-200/70 dark:border-slate-800/70">
        <span className="vk-desc text-[11px] text-slate-400 dark:text-slate-500 self-center mr-1">
          Quick Insert:
        </span>
        {quickMalayalamChars.map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => onInsertText(ch)}
            className="min-w-[28px] h-7 px-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-malayalam text-slate-800 dark:text-slate-200 hover:border-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title={`Insert ${ch}`}
          >
            {ch}
          </button>
        ))}
      </div>

      {/* Interactive Full QWERTY Mapped Keyboard */}
      <div className="vk-rows space-y-1.5 overflow-x-auto pb-1">
        {KEYBOARD_ROWS.map((row, rowIdx) => (
          <div key={rowIdx} className="flex items-center justify-center gap-1.5 min-w-[680px]">
            {rowIdx === 3 && (
              <button
                type="button"
                onClick={() => setVirtualShift((s) => !s)}
                className={`h-12 px-3 rounded-lg border flex items-center justify-center gap-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isShift
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <ArrowBigUp className="w-4 h-4" />
                <span>Shift</span>
              </button>
            )}

            {row.map((key) => {
              const mapped = layoutMap ? layoutMap[key.keyCode] : null;
              const normalOut = mapped ? mapped[0] : key.en;
              const shiftOut = mapped ? mapped[1] : key.enShift;
              const primaryLabel = isShift ? shiftOut : normalOut;
              const secondaryLabel = isShift ? normalOut : shiftOut;
              const isPressed = activeKeyCode === key.keyCode;

              return (
                <button
                  key={key.code}
                  type="button"
                  onClick={() => handleKeyClick(key.keyCode, key.en, key.enShift)}
                  className={`relative flex-1 min-w-[46px] h-12 rounded-lg border p-1.5 flex flex-col justify-between transition-all ${
                    isPressed
                      ? 'bg-red-600 border-red-600 text-white scale-95'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50/30 dark:hover:bg-slate-750'
                  }`}
                >
                  <div className="w-full flex items-center justify-between text-[10px] leading-none">
                    <span
                      className={`font-mono-tabular ${
                        isPressed ? 'text-red-100' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {isShift ? key.enShift : key.en.toUpperCase()}
                    </span>
                    <span
                      className={`font-malayalam ${
                        isPressed ? 'text-red-100' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {secondaryLabel}
                    </span>
                  </div>
                  <div className="w-full text-center text-sm font-semibold font-malayalam leading-none truncate">
                    {primaryLabel || '·'}
                  </div>
                </button>
              );
            })}

            {rowIdx === 0 && (
              <button
                type="button"
                onClick={onBackspace}
                className="h-12 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1 text-xs font-medium whitespace-nowrap shrink-0"
                title="Backspace"
              >
                <Delete className="w-4 h-4" />
                <span>Bksp</span>
              </button>
            )}

            {rowIdx === 2 && (
              <button
                type="button"
                onClick={onEnter}
                className="h-12 px-3.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1 text-xs font-medium whitespace-nowrap shrink-0"
                title="Enter"
              >
                <CornerDownLeft className="w-4 h-4" />
                <span>Enter</span>
              </button>
            )}
          </div>
        ))}

        {/* Bottom Spacebar Row */}
        <div className="flex items-center justify-center gap-2 pt-1 min-w-[680px]">
          <button
            type="button"
            onClick={() => onInsertText('\u200C')}
            className="h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-red-400 whitespace-nowrap shrink-0"
            title="Insert Zero-Width Non-Joiner (ZWNJ) for Chillus"
          >
            ZWNJ (Chillu Split)
          </button>
          <button
            type="button"
            onClick={() => onInsertText(' ')}
            className="h-10 w-72 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5"
          >
            <Space className="w-4 h-4" />
            <span>Spacebar</span>
          </button>
          <button
            type="button"
            onClick={() => onInsertText('\u200D')}
            className="h-10 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-red-400 whitespace-nowrap shrink-0"
            title="Insert Zero-Width Joiner (ZWJ)"
          >
            ZWJ (Conjunct Join)
          </button>
        </div>
      </div>
    </div>
  );
};

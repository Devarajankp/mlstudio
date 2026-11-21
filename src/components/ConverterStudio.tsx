import React, { useState, useEffect } from 'react';
import { Copy, Check, ArrowRightLeft, Sparkles } from 'lucide-react';
import {
  unicodeToMlFml,
  mlFmlToUnicode,
  malayalamToManglish,
} from '../utils/malayalamConverters';
import { correctNewChillu } from '../utils/keyboardLayouts';

export type ConvertSubTab = 'ml' | 'fml' | 'to_unicode' | 'to_manglish';

interface ConverterStudioProps {
  editorText: string;
  onApplyToEditor: (newText: string) => void;
  initialSubTab?: ConvertSubTab;
  showToast: (msg: string) => void;
}

export const ConverterStudio: React.FC<ConverterStudioProps> = ({
  editorText,
  onApplyToEditor,
  initialSubTab = 'ml',
  showToast,
}) => {
  const [subTab, setSubTab] = useState<ConvertSubTab>(initialSubTab);
  const [sourceText, setSourceText] = useState<string>(editorText);
  const [legacyInput, setLegacyInput] = useState<string>(
    'a-e-b-m-f-w \nI-p-ä-n-s-]-³-k-n-Â'
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (editorText.trim()) {
      setSourceText(editorText);
    }
  }, [editorText]);

  const computeOutput = (): string => {
    if (subTab === 'ml') {
      return unicodeToMlFml(sourceText, 1);
    }
    if (subTab === 'fml') {
      return unicodeToMlFml(sourceText, 0);
    }
    if (subTab === 'to_unicode') {
      return mlFmlToUnicode(legacyInput);
    }
    return malayalamToManglish(sourceText);
  };

  const outputText = computeOutput();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      showToast('Converted text copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Could not copy automatically. Please select and copy.');
    }
  };

  const handleNormalizeChillus = () => {
    const fixed = correctNewChillu(sourceText);
    setSourceText(fixed);
    onApplyToEditor(fixed);
    showToast('Normalized atomic Unicode Malayalam Chillus (ൺ, ൻ, ർ, ൽ, ൾ).');
  };

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Malayalam Font & Script Converter
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Font conversion engine for Adobe Photoshop, Illustrator, InDesign, CoralDraw (ML-TTKarthika / FML-Revathi), Unicode, and Manglish.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setSubTab('ml')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'ml'
                ? 'bg-red-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            1. Copy to ML Series
          </button>
          <button
            type="button"
            onClick={() => setSubTab('fml')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'fml'
                ? 'bg-red-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            2. Copy to FML Series
          </button>
          <button
            type="button"
            onClick={() => setSubTab('to_unicode')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'to_unicode'
                ? 'bg-red-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            3. Paste from ML/FML to Unicode
          </button>
          <button
            type="button"
            onClick={() => setSubTab('to_manglish')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'to_manglish'
                ? 'bg-red-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            4. Malayalam to Manglish
          </button>
        </div>
      </div>

      {/* Two-Column Split Converter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Source Input Box */}
        <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {subTab === 'to_unicode'
                ? 'Source: Legacy ASCII (ML / FML Series Encoding)'
                : 'Source: Malayalam Unicode Text'}
            </span>
            {subTab !== 'to_unicode' && (
              <button
                type="button"
                onClick={handleNormalizeChillus}
                className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 hover:underline whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fix Atomic Chillus</span>
              </button>
            )}
          </div>

          {subTab === 'to_unicode' ? (
            <textarea
              value={legacyInput}
              onChange={(e) => setLegacyInput(e.target.value)}
              placeholder="Paste ML-TTKarthika or FML series encoded ASCII text here (e.g. a-e-b-m-f-w)..."
              className="w-full flex-1 min-h-[280px] p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono-tabular text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-red-500 resize-y"
            />
          ) : (
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="മലയാളം യൂണിക്കോഡ് ടെക്സ്റ്റ് ഇവിടെ ടൈപ്പ് ചെയ്യുക..."
              className="w-full flex-1 min-h-[280px] p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-malayalam text-base leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:border-red-500 resize-y"
            />
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Characters:{' '}
              <strong className="font-mono-tabular">
                {subTab === 'to_unicode' ? legacyInput.length : sourceText.length}
              </strong>
            </span>
            {subTab !== 'to_unicode' && (
              <button
                type="button"
                onClick={() => onApplyToEditor(sourceText)}
                className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 whitespace-nowrap shrink-0"
              >
                Sync back to Main Editor
              </button>
            )}
          </div>
        </div>

        {/* Converted Output Box */}
        <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {subTab === 'ml' && 'Converted Output: ML Series (ML-TTKarthika, ML-Nila, etc.)'}
              {subTab === 'fml' && 'Converted Output: FML Series (FML-Revathi, FML-Indulekha, etc.)'}
              {subTab === 'to_unicode' && 'Converted Output: Malayalam Unicode'}
              {subTab === 'to_manglish' && 'Converted Output: Phonetic Manglish (English Script)'}
            </span>
            <div className="flex items-center gap-2">
              {subTab === 'to_unicode' && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyToEditor(outputText);
                    showToast('Sent converted Unicode text to main editor!');
                  }}
                  className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Send to Editor</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Output'}</span>
              </button>
            </div>
          </div>

          <textarea
            readOnly
            value={outputText}
            placeholder="Converted output will appear here automatically..."
            className={`w-full flex-1 min-h-[280px] p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none resize-y ${
              subTab === 'to_unicode'
                ? 'font-malayalam text-base leading-relaxed'
                : 'font-mono-tabular text-sm leading-relaxed'
            }`}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Output length: <strong className="font-mono-tabular">{outputText.length}</strong> chars
            </span>
            <span>
              {subTab === 'ml' || subTab === 'fml'
                ? 'Tip: Paste this output into Photoshop/Illustrator and select an ML or FML font.'
                : 'Ready to copy and share.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

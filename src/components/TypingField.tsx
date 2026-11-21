import React from 'react';
import { canonicalizeUnicode } from '../lib/legacy';
import { getLayoutMap, normalizeMalayalamKeyboardInput, KEYBOARD_MODES, type KeyboardMode } from '../utils/keyboardLayouts';
import { offlinePhoneticTransliterate } from '../utils/manglishTransliterator';

/**
 * A text box / text area that types Malayalam with the active typing method (Inscript, GIST, Typewriter,
 * Panchari, Varityper, Manglish) – the same keys as the document editor. F1–F7 are handled by the app.
 */
interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (v: string) => void;
  mode: KeyboardMode;
  multiline?: boolean;
  rows?: number;
}

export const TypingField: React.FC<Props> = ({ value, onChange, mode, multiline, rows = 4, onKeyDown, ...rest }) => {
  const handle = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onKeyDown?.(e as never);
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.currentTarget;
    const s = el.selectionStart ?? el.value.length;
    const t = el.selectionEnd ?? s;
    const put = (before: string, ins: string, after: string) => {
      const next = canonicalizeUnicode(normalizeMalayalamKeyboardInput(before + ins)) + after;
      const caret = canonicalizeUnicode(normalizeMalayalamKeyboardInput(before + ins)).length;
      onChange(next);
      requestAnimationFrame(() => el.setSelectionRange(caret, caret));
    };
    if (mode === 'english') return;
    if (mode === 'manglish') {
      // Manglish: the word is converted when a space / punctuation key ends it
      if (e.key === ' ' || e.key === 'Enter' || /^[.,;:!?)]$/.test(e.key)) {
        const before = el.value.slice(0, s);
        const m = before.match(/([A-Za-z']+)$/);
        if (!m) return;
        const ml = offlinePhoneticTransliterate(m[1]);
        if (!ml) return;
        e.preventDefault();
        const ins = e.key === 'Enter' && !multiline ? '' : e.key;
        const head = before.slice(0, before.length - m[1].length) + ml;
        onChange(head + ins + el.value.slice(t));
        requestAnimationFrame(() => el.setSelectionRange(head.length + ins.length, head.length + ins.length));
      }
      return;
    }
    const def = getLayoutMap(mode)?.[e.keyCode];
    if (!def) return;
    const ch = e.shiftKey ? def[1] : def[0];
    if (!ch) return;
    e.preventDefault();
    put(el.value.slice(0, s), ch.replace(/​/g, ''), el.value.slice(t));
  };
  const common = { ...rest, value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value), onKeyDown: handle, spellCheck: false };
  return multiline ? <textarea {...(common as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} rows={rows} /> : <input {...(common as React.InputHTMLAttributes<HTMLInputElement>)} />;
};

/** Small strip that shows the typing method and its shortcut keys (F1–F7). */
export const TypingBar: React.FC<{ mode: KeyboardMode; onMode: (m: KeyboardMode) => void }> = ({ mode, onMode }) => (
  <div className="msx-modebar">
    <span className="msx-modebar-label">Typing:</span>
    {KEYBOARD_MODES.map((k) => (
      <button key={k.id} type="button" className={`msx-mode${mode === k.id ? ' is-active' : ''}`} title={k.description} onClick={() => onMode(k.id)}>
        <kbd>{k.shortcut}</kbd> {k.name}
      </button>
    ))}
  </div>
);

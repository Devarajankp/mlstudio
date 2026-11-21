import { useEffect, useRef, useState } from 'react';
import { Check, Info, Moon, Palette, Sun, Volume2, VolumeX } from 'lucide-react';
import { THEMES, accentOf, type UiPrefs } from '../lib/appearance';

interface Props {
  prefs: UiPrefs;
  onPrefs(p: UiPrefs): void;
  dark: boolean;
  onDark(d: boolean): void;
  speaking: boolean;
  onSpeak(): void;
  onAbout(): void;
}

/** Appearance & accessibility pop-over: theme colours, interface size, contrast, motion, read aloud. */
export function AppMenu({ prefs, onPrefs, dark, onDark, speaking, onSpeak, onAbout }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const set = (p: Partial<UiPrefs>) => onPrefs({ ...prefs, ...p });

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); (box.current?.querySelector('.msx-top-btn') as HTMLElement | null)?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="msx-appmenu" ref={box}>
      <button type="button" className="msx-top-btn" aria-haspopup="dialog" aria-expanded={open} aria-label="Appearance and accessibility" title="Theme colour & accessibility" onClick={() => setOpen((o) => !o)}>
        <Palette size={16} />
      </button>
      {open && (
        <div className="msx-pop" role="dialog" aria-label="Appearance and accessibility">
          <h3>Theme colour</h3>
          <div className="msx-swatches" role="radiogroup" aria-label="Theme colour">
            {THEMES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={prefs.theme === t.id} aria-label={t.name} title={t.name} className={prefs.theme === t.id ? 'is-on' : ''} style={{ background: dark ? t.dark : t.accent }} onClick={() => set({ theme: t.id })}>
                {prefs.theme === t.id && <Check size={14} />}
              </button>
            ))}
            <label className={`msx-swatch-custom${prefs.theme === 'custom' ? ' is-on' : ''}`} title="Pick your own colour" style={{ background: prefs.theme === 'custom' ? accentOf(prefs, dark) : undefined }}>
              <span className="sr-only">Custom colour</span>
              {prefs.theme === 'custom' ? <Check size={14} /> : '+'}
              <input type="color" value={prefs.custom} onChange={(e) => set({ theme: 'custom', custom: e.target.value })} />
            </label>
          </div>
          <button type="button" className="msx-pop-row" role="switch" aria-checked={dark} onClick={() => onDark(!dark)}>
            {dark ? <Moon size={15} /> : <Sun size={15} />}<span>Dark mode</span><i className={dark ? 'on' : ''} />
          </button>

          <h3>Comfort & accessibility</h3>
          <div className="msx-seg" role="radiogroup" aria-label="Interface size">
            {([100, 115, 130] as const).map((s, i) => (
              <button key={s} type="button" role="radio" aria-checked={prefs.size === s} className={prefs.size === s ? 'is-on' : ''} onClick={() => set({ size: s })} style={{ fontSize: 12 + i * 2 }}>A{'+'.repeat(i)}</button>
            ))}
          </div>
          <button type="button" className="msx-pop-row" role="switch" aria-checked={prefs.contrast} onClick={() => set({ contrast: !prefs.contrast })}><span>High contrast</span><i className={prefs.contrast ? 'on' : ''} /></button>
          <button type="button" className="msx-pop-row" role="switch" aria-checked={prefs.motion} onClick={() => set({ motion: !prefs.motion })}><span>Reduce motion</span><i className={prefs.motion ? 'on' : ''} /></button>
          <button type="button" className="msx-pop-row" onClick={() => { onSpeak(); setOpen(false); }}>
            {speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}<span>{speaking ? 'Stop reading' : 'Read document aloud'}</span><kbd>Ctrl+Alt+R</kbd>
          </button>
          <button type="button" className="msx-pop-row" onClick={() => { onAbout(); setOpen(false); }}><Info size={15} /><span>About & keyboard help</span><kbd>Ctrl+/</kbd></button>
        </div>
      )}
    </div>
  );
}

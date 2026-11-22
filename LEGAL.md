# Legal notes & risk checklist

*Not legal advice. This file lists what a maintainer should keep in mind so the project stays clean.*

## 1. What is original
All TypeScript/React/Electron source in this repository was written for this project and is released under MIT.
No code, assets or text were copied from Microsoft Word, edentext (AGPL-3.0), Mozhi/Varamozhi, Swanalekha or any other
editor or keyboard product. Features were re-implemented from public behaviour and general ideas only.
**Never paste code from AGPL/GPL projects into this repository** – it would force the whole project under that licence.

## 2. Things you MUST keep
* `public/dict/ATTRIBUTION.txt` and the credits in *About*. The dictionary is ODbL 1.0: if you publish it (the web app does),
  keep the attribution, and publish your re-indexed derivative database under ODbL too (it already lives in this repo).
* `LICENSE` and `THIRD_PARTY_NOTICES.md` in every release.
* OFL fonts may be bundled and used freely but must not be sold on their own, and keep their copyright notices.

## 3. Items to verify before / after going public (highest risk first)
1. ~~ML-TT / MLW-TT fonts~~ — **resolved in 1.2.1:** all proprietary legacy fonts were removed from the repository; only OFL-1.1 fonts are bundled (`public/fonts/FONTS_LICENSE.txt`). Do not add fonts without a licence that allows redistribution, and add them to `THIRD_PARTY_NOTICES.md`.
2. ~~Legacy-font conversion tables~~ — **replaced in 1.2.3.** The old converter was removed. The new ML-TT / FML-TT (ISFOC) conversion
   (`src/lib/isfoc.ts`) is original work: the table was written by reading which letter each character code draws in C-DAC ISFOC
   fonts (Karthika, Ambili, Revathi, Chandrika) and checked by drawing converted text in those fonts. No third-party map file
   or converter code was used. The fonts themselves are not in this repository. ML-TT and FML-TT share one layout, so one
   table serves both. Not decoded: a few rare vowel-sign ligature codes (232–238). "Unicode → Manglish" (`src/lib/romanize.ts`) is also original.
   **Still to confirm:** the Manglish typing word list / phonetic rules (`src/utils/manglishTransliterator.ts`) and the
   GIST / Typewriter / Panchari / Varityper key maps (`src/utils/keyboardLayouts.ts`) — record their sources here or rewrite them.
3. **Google Input Tools** – unofficial endpoint, see THIRD_PARTY_NOTICES.md. It is optional and off-switchable; do not market
   the app as "Google powered" and do not bundle Google logos.
4. **Names and logos** – "Microsoft Word", "Word", "Google", "Windows", "Inscript", "C-DAC", "GIST" are the property of their
   owners and are used only to describe compatibility. The UI is Word-*like* (ribbon, tabs) but uses its own icons, colours,
   wording and code. Do not use Microsoft's logo, icons, fonts (Calibri, Segoe UI) or screenshots.
5. **Keyboard layouts** – Inscript is a Government of India standard; GIST/Typewriter layouts are public key maps. The
   Manglish scheme is a general phonetic transliteration.
6. **Windows code signing** – the installer is not signed, so SmartScreen shows "unknown publisher". That is a trust notice,
   not a licence issue. A certificate removes it.

## 4. Privacy
The app has no analytics, accounts or server. Documents stay on the user's device (browser storage / files they save).
The only network calls are: loading the app itself, optional Google Input Tools suggestions (the word being typed), and
update checks against this repository's GitHub Pages / Releases.

## 5. Trademark & affiliation
Malayalam Studio is an independent project and is **not affiliated with, endorsed by or sponsored by** Microsoft, Google,
C-DAC, the Government of India, Anthropic, or any font or dictionary publisher.

## 6. If you receive a takedown / licence complaint
Remove the disputed asset (usually a font) from the repo *and* its history (`git filter-repo`), publish a patch release, and
note it in `CHANGELOG.md`.

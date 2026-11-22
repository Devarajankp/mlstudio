# Third-party notices

Malayalam Studio's own code is MIT-licensed (see `LICENSE`). It uses the following third-party software, data and fonts,
which keep their own licences. Full licence texts ship inside each package in `node_modules` and, for the Windows
installer, in the installed `LICENSES.chromium.html` / Electron licence files.

## Libraries (runtime)

| Package | Licence | Used for |
|---|---|---|
| react, react-dom | MIT | UI |
| @tiptap/* (core, starter-kit, extensions, react, pm) / ProseMirror | MIT | rich-text editor |
| docx | MIT | .docx export |
| mammoth | BSD-2-Clause | .docx import |
| pdf-lib, @pdf-lib/fontkit | MIT | PDF writing |
| fontkit | MIT | font parsing / glyph shaping |
| fflate | MIT | .odt / .mlstudio zip handling |
| @neslinesli93/qpdf-wasm | ISC wrapper around qpdf (Apache-2.0 / Artistic-2.0) | PDF password encryption (AES-256) |
| wawoff2 | MIT | WOFF2 decoding |
| lucide-react | ISC | icons |
| regenerator-runtime | MIT | runtime helper |

## Build tools
vite (MIT), @vitejs/plugin-react (MIT), tailwindcss (MIT), typescript (Apache-2.0), esbuild (MIT), tsx (MIT).

## Windows app
| Package | Licence |
|---|---|
| Electron (includes Chromium) | MIT (Chromium: BSD-3-Clause and others) |
| koffi | MIT |
| electron-builder | MIT |

## Fonts (all SIL Open Font License 1.1 – full notices in `public/fonts/FONTS_LICENSE.txt`)
| Font | Copyright holder | Source |
|---|---|---|
| Noto Sans / Serif / Mono, Noto Sans Malayalam, Noto Serif Malayalam | The Noto Project Authors (Google) | https://github.com/notofonts/malayalam |
| Chilanka, Manjari, Gayathri | The respective Project Authors – Swathanthra Malayalam Computing (SMC) | https://gitlab.com/smc/fonts |
| Meera, Rachana, Karumbi, Keraleeyam, Dyuthi, Anjali Old Lipi, Uroob | Rachana Akshara Vedi, Hussain K H, Santhosh Thottingal, Rajeesh K Nambiar, Kevin & Siji, Hiran Venugopalan, Kavya Manohar and other contributors – RIT / SMC | https://gitlab.com/rit-fonts · https://github.com/smc/font-installer |
| Anek Malayalam | The Anek Project Authors (Ek Type) | https://github.com/EkType/Anek |
| Baloo Chettan 2 | The Baloo 2 Project Authors (Ek Type) | https://fonts.google.com/specimen/Baloo+Chettan+2 |

**Not bundled:** proprietary legacy DTP fonts (ML-TT, MLW-TT, MLTU0BTT, MLAH0ITT …), Suruma (GPLv3 + font exception) and
Raghu Malayalam Sans (data-licence unclear). Users can add their own copies in the app (File → My fonts); they never leave the device.

## Data
| Data | Licence |
|---|---|
| Olam English–Malayalam dictionary (https://olam.in/open/enml/), re-indexed in `public/dict` | **ODbL 1.0** – attribution + share-alike. Attribution is kept in `public/dict/ATTRIBUTION.txt` and in the About dialog. |
| kiranps/English-Malayalam-Dictionary (the packaging the data was obtained from) | MIT |

## Services (optional, user-triggered)
* **Google Input Tools** (`inputtools.google.com`) – optional online Manglish suggestions. It is an unofficial, undocumented
  endpoint: it may change or stop at any time and is governed by Google's Terms of Service. Turn it off in the app
  (Settings → Online suggestions); everything works offline without it.

## Fonts offered by "Get fonts online" (not bundled)
Downloaded by the user's own device from the public Google Fonts repository (github.com/google/fonts) under the SIL Open Font License 1.1:
Chilanka, Gayathri, Manjari (Swathanthra Malayalam Computing); Anek Malayalam, Baloo Chettan 2, Arima (Ek Type); Noto Sans / Noto Serif Malayalam (Google, Noto Project).

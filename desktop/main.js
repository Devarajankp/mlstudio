// Malayalam Studio (desktop): the full editor in a window + system-wide Malayalam typing from the tray.
const { app, BrowserWindow, Tray, Menu, nativeImage, protocol, net, shell, dialog, screen, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { KeyEngine, offlinePhoneticTransliterate, COMMON_MANGLISH_WORDS } = require('./engine.bundle.js');
const win = require('./winapi.js');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
if (!app.requestSingleInstanceLock()) app.quit();

/* ------------------------------------------------------------------ safety net: never die silently */
const logFile = () => path.join(app.getPath('userData'), 'log.txt');
function log(...a) { try { fs.appendFileSync(logFile(), `${new Date().toISOString()} ${a.map((x) => (x && x.stack) || String(x)).join(' ')}\n`); } catch { /* ignore */ } }
process.on('uncaughtException', (e) => log('uncaught', e));
process.on('unhandledRejection', (e) => log('unhandled', e));
const guard = (fn) => (...args) => { try { return fn(...args); } catch (e) { log(e); return undefined; } };

/* ------------------------------------------------------------------ settings */
const KEYS = { 'Scroll Lock': 0x91, 'Pause/Break': 0x13, Home: 0x24, End: 0x23, Insert: 0x2d, 'Right Ctrl': 0xa3, F8: 0x77, F9: 0x78, F10: 0x79, F11: 0x7a, F12: 0x7b };
const LAYOUTS = { manglish: 'Manglish (type in English letters)', inscript: 'Inscript', gist: 'GIST', typewriter: 'Typewriter', panchari: 'Panchari', varityper: 'Varityper (phonetic)' };
const OUTPUTS = { unicode: 'Unicode fonts (Noto Sans Malayalam, Anjali, Manjari …)', ml: 'ML-TT fonts (ML-TT Ambili, ML-TT Revathi …)', fml: 'MLW-TT fonts (MLW-TT …)' };
const MODIFIER_OR_IGNORED = new Set([0x10, 0xa0, 0xa1, 0x11, 0xa2, 0xa3, 0x12, 0xa4, 0xa5, 0x14, 0x5b, 0x5c]);
const RESET_KEYS = new Set([0x1b, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2e]);

const cfgFile = () => path.join(app.getPath('userData'), 'settings.json');
let cfg = { keepInTray: true, enabled: false, layout: 'manglish', output: 'unicode', toggleKey: 'Scroll Lock', nextLayoutKey: 'Pause/Break', suggest: true, online: true, osd: true, syncLed: true, fontsAsked: false, webUrl: '' };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) }; } catch { /* first run */ }
if (!LAYOUTS[cfg.layout]) cfg.layout = 'manglish';
const save = () => { try { fs.mkdirSync(path.dirname(cfgFile()), { recursive: true }); fs.writeFileSync(cfgFile(), JSON.stringify(cfg, null, 2)); } catch { /* ignore */ } };

const engine = new KeyEngine();
const applyCfg = () => { if (cfg.layout !== 'manglish') { engine.mode = cfg.layout; engine.output = cfg.output; } engine.reset(); resetManglish(); };

let tray, iconOn, iconOff, mainWin = null, quitting = false;
const swallowedUp = new Set();
let chain = Promise.resolve(); // keeps injected text in key order

/* ------------------------------------------------------------------ small overlay windows */
function overlay(file, w, h) {
  const o = new BrowserWindow({ width: w, height: h, show: false, frame: false, transparent: true, resizable: false, movable: false, focusable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, webPreferences: { nodeIntegration: true, contextIsolation: false, spellcheck: false } });
  o.setAlwaysOnTop(true, 'screen-saver');
  o.setIgnoreMouseEvents(true);
  o.loadFile(path.join(__dirname, 'ui', file));
  o.on('closed', () => { if (file === 'osd.html') osdWin = null; else popupWin = null; });
  return o;
}
let osdWin = null, popupWin = null, osdTimer = 0, osdArea = null;
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
ipcMain.on('osd-size', (e, s) => {
  if (!osdWin || osdWin.isDestroyed() || e.sender !== osdWin.webContents || !osdArea) return;
  const w = Math.min(360, Math.max(120, s.w)), h = s.h;
  osdWin.setBounds({ x: Math.round(osdArea.x + osdArea.width / 2 - w / 2), y: Math.round(osdArea.y + osdArea.height - h - 56), width: w, height: h });
  osdWin.showInactive();
  clearTimeout(osdTimer);
  osdTimer = setTimeout(() => { if (osdWin && !osdWin.isDestroyed()) osdWin.hide(); }, 1600);
});

function osd(kind, title, sub) {
  if (!cfg.osd) return;
  if (!osdWin || osdWin.isDestroyed()) osdWin = overlay('osd.html', 240, 56);
  const send = () => {
    const d = screen.getPrimaryDisplay().workArea;
    osdArea = d;
    osdWin.webContents.send('osd', { kind, title: clip(title, 44), sub: clip(sub || '', 60) });
  };
  if (osdWin.webContents.isLoading()) osdWin.webContents.once('did-finish-load', send); else send();
}

/* ------------------------------------------------------------------ Manglish: type English letters, get Malayalam words */
let mbuf = '', cands = [], sel = 0, candToken = 0, onlineFlag = false;
const sugCache = new Map();

function localCands(word) {
  const lower = word.toLowerCase();
  const list = [...(COMMON_MANGLISH_WORDS[lower] || []), offlinePhoneticTransliterate(word)].filter(Boolean);
  return [...new Set(list)];
}
function popupShow() {
  if (!cfg.suggest || !mbuf) return popupHide();
  if (!popupWin || popupWin.isDestroyed()) popupWin = overlay('popup.html', 240, 190);
  const items = [...cands.slice(0, 7), mbuf];
  const send = () => {
    popupWin.webContents.send('cands', { buf: mbuf, items, sel, online: onlineFlag });
    let p = win.caretPos();
    try { p = screen.screenToDipPoint({ x: p.x, y: p.y }); } catch { /* single-DPI */ }
    const disp = screen.getDisplayNearestPoint(p).workArea;
    const [w, h] = popupWin.getSize();
    popupWin.setBounds({ x: Math.min(Math.max(disp.x, p.x - 6), disp.x + disp.width - w), y: Math.min(p.y + 4, disp.y + disp.height - h), width: w, height: h });
    popupWin.showInactive();
  };
  if (popupWin.webContents.isLoading()) popupWin.webContents.once('did-finish-load', send); else send();
}
function popupHide() { if (popupWin && !popupWin.isDestroyed()) popupWin.hide(); }
ipcMain.on('popup-size', (e, s) => { if (popupWin && !popupWin.isDestroyed() && e.sender === popupWin.webContents) { const b = popupWin.getBounds(); popupWin.setBounds({ ...b, width: Math.max(180, s.w), height: s.h }); } });

function resetManglish() { mbuf = ''; cands = []; sel = 0; candToken++; popupHide(); }

async function refreshCands() {
  const word = mbuf;
  const token = ++candToken;
  if (!word) { cands = []; return popupHide(); }
  cands = sugCache.get(word) || localCands(word);
  sel = 0;
  onlineFlag = false;
  popupShow();
  if (!cfg.online || sugCache.has(word)) return;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await net.fetch(`https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=ml-t-i0-und&num=6&cp=0&cs=1&ie=utf-8&oe=utf-8&app=malayalamstudio`, { signal: ctl.signal });
    clearTimeout(t);
    const d = await r.json();
    if (d && d[0] === 'SUCCESS' && Array.isArray(d[1]?.[0]?.[1])) {
      const merged = [...new Set([...d[1][0][1], ...localCands(word)])];
      sugCache.set(word, merged);
      if (token === candToken && word === mbuf) { cands = merged; onlineFlag = true; popupShow(); }
    }
  } catch { /* offline: local words are already shown */ }
}

const PUNCT = { 0xbc: [',', '<'], 0xbe: ['.', '>'], 0xbf: ['/', '?'], 0xba: [';', ':'], 0xde: ["'", '"'], 0xbd: ['-', '_'] };

function commit(trailing, afterKey) {
  const word = mbuf;
  const pick = cands[sel];
  const text = pick && sel < cands.length ? pick : word;
  resetManglish();
  chain = chain
    .then(() => (text === word ? (trailing ? win.sendEdit(0, trailing) : undefined) : win.sendEdit(word.length, text + trailing)))
    .then(() => { if (afterKey) win.sendKey(afterKey); })
    .catch((e) => log(e));
}

/** Manglish layout. Letters pass through untouched while they are collected; the word is swapped on Space / Enter / punctuation. */
function manglishKey(vk) {
  const shiftHeld = win.isDown(0x10);
  if (win.isDown(0x11) || win.isDown(0x12) || win.isDown(0x5b) || win.isDown(0x5c)) { resetManglish(); return false; }
  if (vk >= 0x41 && vk <= 0x5a) {
    let upper = shiftHeld;
    if (win.capsOn()) upper = !upper;
    mbuf += upper ? String.fromCharCode(vk) : String.fromCharCode(vk + 32);
    setImmediate(guard(refreshCands));
    return false;
  }
  if (vk === 0x08) { if (mbuf) { mbuf = mbuf.slice(0, -1); setImmediate(guard(refreshCands)); } return false; }
  if (!mbuf) return false;
  const swallow = (fn) => { swallowedUp.add(vk); fn(); return true; };
  if (vk === 0x1b) return swallow(() => { resetManglish(); });                                       // Esc: keep the English
  if (vk === 0x28 || (vk === 0x09 && popupVisible())) return swallow(() => { sel = (sel + 1) % (cands.length + 1); popupShow(); });
  if (vk === 0x26) return swallow(() => { sel = (sel + cands.length) % (cands.length + 1); popupShow(); });
  if (vk >= 0x31 && vk <= 0x39 && popupVisible() && vk - 0x31 <= cands.length) return swallow(() => { sel = vk - 0x31; commit('', 0); });
  if (vk === 0x20) return swallow(() => commit(' ', 0));
  if (vk === 0x0d) return swallow(() => commit('', 0x0d));
  if (vk === 0x09) return swallow(() => commit('', 0x09));
  if (PUNCT[vk]) return swallow(() => commit(PUNCT[vk][shiftHeld ? 1 : 0], 0));
  resetManglish();
  return false;
}
const popupVisible = () => !!(popupWin && !popupWin.isDestroyed() && popupWin.isVisible());

/* ------------------------------------------------------------------ on / off, keyboard light */
function syncLed() {
  if (!cfg.syncLed || cfg.toggleKey !== 'Scroll Lock') return;
  setTimeout(guard(() => { if (win.scrollLockOn() !== cfg.enabled) win.sendKey(0x91); }), 40); // our own key press flips the light to match
}
function toggle() {
  cfg.enabled = !cfg.enabled; save(); engine.reset(); resetManglish(); refresh(); syncLed();
  osd(cfg.enabled ? 'on' : 'off', cfg.enabled ? 'Malayalam typing ON' : 'Malayalam typing OFF', cfg.enabled ? LAYOUTS[cfg.layout].split(' (')[0] : 'English keys');
}
function setLayout(id) {
  cfg.layout = id; save(); applyCfg(); refresh();
  osd('info', LAYOUTS[id].split(' (')[0] + ' layout', cfg.enabled ? 'typing is ON' : 'press ' + cfg.toggleKey + ' to start');
}
function nextLayout() { const ids = Object.keys(LAYOUTS); setLayout(ids[(ids.indexOf(cfg.layout) + 1) % ids.length]); }

/** return true to swallow the key */
function onKey(vk, down) {
  if (mainWin && !mainWin.isDestroyed() && mainWin.isVisible() && mainWin.isFocused()) return false; // the Studio window has its own typing engine
  if (!down) { if (swallowedUp.delete(vk)) return true; return false; }
  if (vk === KEYS[cfg.toggleKey]) { swallowedUp.add(vk); setImmediate(guard(toggle)); return true; }
  if (vk === KEYS[cfg.nextLayoutKey]) { swallowedUp.add(vk); setImmediate(guard(nextLayout)); return true; }
  if (!cfg.enabled) return false;
  if (MODIFIER_OR_IGNORED.has(vk)) return false;
  if (cfg.layout === 'manglish') return manglishKey(vk);
  if (vk === 0x08 || vk === 0x0d || vk === 0x09 || vk === 0x20 || RESET_KEYS.has(vk) || win.isDown(0x11) || win.isDown(0x12) || win.isDown(0x5b) || win.isDown(0x5c)) { engine.reset(); return false; }
  let shift = win.isDown(0x10);
  if (vk >= 0x41 && vk <= 0x5a && win.capsOn()) shift = !shift; // Caps Lock flips letters, like a real layout
  const r = engine.key(vk, shift);
  if (!r.handled) return false;
  swallowedUp.add(vk);
  chain = chain.then(() => win.sendEdit(r.backspaces, r.text)).catch((e) => log(e));
  return true;
}

/* ------------------------------------------------------------------ tray */
function refresh() {
  if (!tray) return;
  tray.setImage(cfg.enabled ? iconOn : iconOff);
  tray.setToolTip(`Malayalam Studio — ${cfg.enabled ? 'ON' : 'off'} · ${LAYOUTS[cfg.layout]}\n${cfg.toggleKey}: on/off · ${cfg.nextLayoutKey}: next layout`);
  const radio = (table, field, fn) => Object.entries(table).map(([id, label]) => ({ label, type: 'radio', checked: cfg[field] === id, click: guard(() => { if (fn) fn(id); else { cfg[field] = id; save(); applyCfg(); refresh(); } }) }));
  const check = (label, field, after) => ({ label, type: 'checkbox', checked: !!cfg[field], click: guard((i) => { cfg[field] = i.checked; save(); after?.(); refresh(); }) });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Malayalam Studio  ${app.getVersion()}`, enabled: false },
    { label: 'Open editor', click: guard(openStudio) },
    { type: 'separator' },
    { label: cfg.enabled ? '●  Malayalam typing is ON — click to turn off' : '○  Malayalam typing is OFF — click to turn on', click: guard(toggle) },
    { label: `Keyboard layout:  ${LAYOUTS[cfg.layout].split(' (')[0]}`, submenu: radio(LAYOUTS, 'layout', setLayout) },
    { label: 'Manglish suggestion pop-up', type: 'checkbox', checked: cfg.suggest, click: guard((i) => { cfg.suggest = i.checked; save(); if (!i.checked) popupHide(); osd('info', i.checked ? 'Suggestions ON' : 'Suggestions OFF', 'Manglish pop-up'); refresh(); }) },
    { label: 'Font type (output)', submenu: radio(OUTPUTS, 'output') },
    { type: 'separator' },
    { label: 'Settings…', click: guard(openSettings) },
    { label: 'Install / repair Malayalam fonts', click: guard(() => fontsFlow(true)) },
    { label: 'Check for web updates', click: guard(async () => { const m = await checkUpdate(); osd('info', 'Update check', m); }) },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: guard((i) => app.setLoginItemSettings({ openAtLogin: i.checked })) },
    check('Keep running in the tray when the window is closed', 'keepInTray'),
    check('Show on-screen message when switching', 'osd'),
    { type: 'separator' },
    { label: 'Quit Malayalam Studio', click: guard(() => { quitting = true; app.quit(); }) },
  ]));
}

/* ------------------------------------------------------------------ windows */
function openStudio() {
  if (mainWin && !mainWin.isDestroyed()) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.focus(); return; }
  mainWin = new BrowserWindow({ width: 1360, height: 860, minWidth: 900, minHeight: 600, title: 'Malayalam Studio', icon: path.join(__dirname, 'icon.png'), frame: false, autoHideMenuBar: true, backgroundColor: '#e5e7eb', webPreferences: { contextIsolation: true, spellcheck: false, preload: path.join(__dirname, 'preload.js') } });
  mainWin.on('maximize', () => mainWin.webContents.send('win:max', true));
  mainWin.on('unmaximize', () => mainWin.webContents.send('win:max', false));
  mainWin.setMenuBarVisibility(false);
  mainWin.loadURL('app://studio/index.html');
  mainWin.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:|^mailto:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  mainWin.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:|^mailto:/.test(url)) shell.openExternal(url); } });
  // closing the window only hides it: the tray (and Scroll Lock typing) keeps running; "Quit" in the tray exits
  mainWin.on('close', (e) => { if (!quitting && cfg.keepInTray) { e.preventDefault(); mainWin.hide(); } });
  mainWin.on('closed', () => { mainWin = null; if (!cfg.keepInTray && !quitting) { quitting = true; app.quit(); } });
}

let settingsWin = null;
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({ width: 560, height: 720, title: 'Malayalam Studio – Settings', icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true, backgroundColor: '#f3f5f9', webPreferences: { nodeIntegration: true, contextIsolation: false, spellcheck: false } });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'ui', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}
ipcMain.on('app:version', (e) => { e.returnValue = app.getVersion(); });
const fromMain = (e) => (mainWin && !mainWin.isDestroyed() && e.sender === mainWin.webContents ? mainWin : null);
ipcMain.on('win:minimize', (e) => fromMain(e)?.minimize());
ipcMain.on('win:toggle-max', (e) => { const w = fromMain(e); if (w) (w.isMaximized() ? w.unmaximize() : w.maximize()); });
ipcMain.on('win:close', (e) => fromMain(e)?.close());
ipcMain.handle('win:is-max', (e) => !!fromMain(e)?.isMaximized());
ipcMain.on('app:open-external', (_e, u) => { if (/^https?:\/\//.test(u)) shell.openExternal(u); });
ipcMain.handle('settings:get', () => ({ cfg: { ...cfg, startup: app.getLoginItemSettings().openAtLogin }, layouts: LAYOUTS, outputs: OUTPUTS, keys: Object.keys(KEYS) }));
ipcMain.handle('settings:set', guard((_e, patch) => {
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'startup') app.setLoginItemSettings({ openAtLogin: !!v });
    else if (k === 'enabled') { if (!!v !== cfg.enabled) toggle(); }
    else if (k in cfg) cfg[k] = v;
  }
  save(); applyCfg(); refresh();
}));
ipcMain.handle('fonts:install', () => fontsFlow(false, true));
ipcMain.handle('update:check', () => checkUpdate());

/* ------------------------------------------------------------------ fonts */
const fontsSrc = () => path.join(__dirname, 'fonts');
const userFonts = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts');
const sysFonts = () => path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
function missingFonts() {
  let all = [];
  try { all = fs.readdirSync(fontsSrc()).filter((f) => /\.(ttf|otf)$/i.test(f)); } catch { return []; }
  return all.filter((f) => !fs.existsSync(path.join(userFonts(), f)) && !fs.existsSync(path.join(sysFonts(), f)));
}
function installFonts(list) {
  fs.mkdirSync(userFonts(), { recursive: true });
  const lines = ['Windows Registry Editor Version 5.00', '', '[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts]'];
  for (const f of list) {
    const dest = path.join(userFonts(), f);
    fs.copyFileSync(path.join(fontsSrc(), f), dest);
    const kind = /\.otf$/i.test(f) ? 'OpenType' : 'TrueType';
    lines.push(`"${f.replace(/\.[^.]+$/, '')} (${kind})"="${dest.replace(/\\/g, '\\\\')}"`);
    try { win.addFont(dest); } catch { /* ignore */ }
  }
  const reg = path.join(os.tmpdir(), 'mlstudio-fonts.reg');
  fs.writeFileSync(reg, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(lines.join('\r\n') + '\r\n', 'utf16le')]));
  return new Promise((res) => execFile('reg', ['import', reg], { windowsHide: true }, (err) => res(!err)));
}
async function fontsFlow(manual, silent) {
  const miss = missingFonts();
  if (!miss.length) { const m = 'All Malayalam fonts are already installed.'; if (manual && !silent) dialog.showMessageBox({ type: 'info', message: m, buttons: ['OK'] }); return m; }
  if (!silent) {
    const r = await dialog.showMessageBox({ type: 'question', title: 'Malayalam Studio', message: `${miss.length} Malayalam fonts are not installed on this PC.`, detail: 'Install them (for you only, no Administrator needed) so ML-TT / MLW-TT and Unicode Malayalam text looks right in Word, Notepad and other programs?', buttons: ['Install fonts', 'Not now'], defaultId: 0, cancelId: 1 });
    if (r.response !== 0) return 'Skipped.';
  }
  const ok = await installFonts(miss);
  const m = ok ? `Installed ${miss.length} fonts. Restart open programs (Word etc.) to see them.` : 'Fonts were copied; Windows could not register them. Sign out and in again.';
  if (!silent) osd('info', 'Fonts installed', `${miss.length} fonts`);
  return m;
}

/* ------------------------------------------------------------------ pick up changes published from the web version */
const defaults = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'defaults.json'), 'utf8')); } catch { return {}; } })();
if (!cfg.webUrl && defaults.webUrl) cfg.webUrl = defaults.webUrl;
const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
/** The program itself (Electron shell) only changes in a new installer: look for a newer GitHub release. */
async function shellUpdate() {
  if (!defaults.repo) return '';
  try {
    const r = await net.fetch(`https://api.github.com/repos/${defaults.repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return '';
    const rel = await r.json();
    const v = String(rel.tag_name || '').replace(/^v/, '');
    if (v && newer(v, app.getVersion())) { shell.openExternal(rel.html_url); return `New app v${v} – opened download page`; }
  } catch { /* offline */ }
  return '';
}
const webBundled = () => path.join(__dirname, 'web');
const webCache = () => path.join(app.getPath('userData'), 'web-cache');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
async function checkUpdate() {
  const base = (cfg.webUrl || '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) return 'Set the web address in Settings first';
  try {
    const r = await net.fetch(`${base}/update-manifest.json?t=${Date.now()}`);
    if (!r.ok) return `No update list online (HTTP ${r.status})`;
    const remote = await r.json();
    const have = readJson(path.join(webCache(), 'update-manifest.json')) || readJson(path.join(webBundled(), 'update-manifest.json')) || { files: {} };
    const todo = Object.entries(remote.files).filter(([f, h]) => have.files[f] !== h);
    if (!todo.length) return (await shellUpdate()) || `Up to date (v${remote.version || app.getVersion()})`;
    const tmp = path.join(app.getPath('userData'), 'web-update');
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const [f] of todo) {
      const rr = await net.fetch(`${base}/${f.split('/').map(encodeURIComponent).join('/')}`);
      if (!rr.ok) throw new Error(`${f}: HTTP ${rr.status}`);
      const dest = path.join(tmp, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await rr.arrayBuffer()));
    }
    for (const [f] of todo) {
      const dest = path.join(webCache(), f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(tmp, f), dest);
    }
    fs.writeFileSync(path.join(webCache(), 'update-manifest.json'), JSON.stringify(remote));
    fs.rmSync(tmp, { recursive: true, force: true });
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.reloadIgnoringCache();
    return `Updated to web version ${remote.version || ''}`.trim();
  } catch (e) { log('update', e); return 'Could not check (offline?)'; }
}

/* ------------------------------------------------------------------ start */
app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (p === '/' || p === '') p = '/index.html';
    for (const root of [webCache(), webBundled()]) {
      const file = path.normalize(path.join(root, p));
      if (!file.startsWith(root)) return new Response('Forbidden', { status: 403 });
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return net.fetch(pathToFileURL(file).toString());
    }
    return new Response('Not found', { status: 404 });
  });
  iconOn = nativeImage.createFromPath(path.join(__dirname, 'icon-on.png'));
  iconOff = nativeImage.createFromPath(path.join(__dirname, 'icon-off.png'));
  tray = new Tray(cfg.enabled ? iconOn : iconOff);
  tray.on('click', () => guard(openStudio)());
  applyCfg();
  refresh();
  openStudio();
  try {
    win.installHooks({ onKey: guard(onKey), onMouseDown: guard(() => { engine.reset(); resetManglish(); }) });
    let fg = win.foreground();
    setInterval(guard(() => { const f = win.foreground(); if (f !== fg) { fg = f; engine.reset(); resetManglish(); } }), 250);
  } catch (e) { log('Typing hook unavailable', e); }
  syncLed();
  if (!cfg.fontsAsked) { cfg.fontsAsked = true; save(); setTimeout(guard(() => fontsFlow(false)), 1500); }
  if (cfg.webUrl) { setTimeout(guard(checkUpdate), 8000); setInterval(guard(checkUpdate), 6 * 3600 * 1000); }
  app.on('second-instance', () => guard(openStudio)());
});
app.on('before-quit', () => { quitting = true; });
// never quit just because windows were closed – the tray keeps Malayalam typing alive
app.on('window-all-closed', () => { /* stay in the tray */ });
app.on('will-quit', () => {
  try { if (cfg.syncLed && cfg.toggleKey === 'Scroll Lock' && win.scrollLockOn()) win.sendKey(0x91); } catch { /* ignore */ }
  try { win.removeHooks(); } catch { /* ignore */ }
});

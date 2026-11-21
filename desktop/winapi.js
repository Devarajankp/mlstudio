// Thin Win32 layer (koffi = FFI): low-level keyboard/mouse hooks + SendInput. Windows only.
const koffi = require('koffi');

const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');

const KBDLL = koffi.struct('KBDLL', { vkCode: 'uint32', scanCode: 'uint32', flags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr' });
const KEYBD = koffi.struct('KEYBD', { wVk: 'uint16', wScan: 'uint16', dwFlags: 'uint32', time: 'uint32', dwExtraInfo: 'uintptr' });
// INPUT on 64-bit Windows is 40 bytes: type(4) + padding(4) + union (the largest member, MOUSEINPUT, is 32 bytes)
const INPUT = koffi.struct('INPUT', { type: 'uint32', ki: KEYBD, pad: koffi.array('uint8', 8) });

const HookProc = koffi.proto('intptr __stdcall HookProc(int nCode, uintptr wParam, void *lParam)');

const SetWindowsHookExW = user32.func('void *SetWindowsHookExW(int idHook, HookProc *lpfn, void *hmod, uint32 dwThreadId)');
const UnhookWindowsHookEx = user32.func('bool UnhookWindowsHookEx(void *hhk)');
const CallNextHookEx = user32.func('intptr CallNextHookEx(void *hhk, int nCode, uintptr wParam, void *lParam)');
const SendInputRaw = user32.func('uint32 SendInput(uint32 cInputs, INPUT *pInputs, int cbSize)');
const GetAsyncKeyState = user32.func('int16 GetAsyncKeyState(int vKey)');
const GetKeyState = user32.func('int16 GetKeyState(int nVirtKey)');
const GetForegroundWindow = user32.func('void *GetForegroundWindow()');
const gdi32 = koffi.load('gdi32.dll');
const RECT = koffi.struct('RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
const POINT = koffi.struct('POINT', { x: 'int32', y: 'int32' });
const GUITHREADINFO = koffi.struct('GUITHREADINFO', { cbSize: 'uint32', flags: 'uint32', hwndActive: 'void *', hwndFocus: 'void *', hwndCapture: 'void *', hwndMenuOwner: 'void *', hwndMoveSize: 'void *', hwndCaret: 'void *', rcCaret: RECT });
const GetGUIThreadInfo = user32.func('bool GetGUIThreadInfo(uint32 idThread, _Inout_ GUITHREADINFO *pgui)');
const GetWindowThreadProcessId = user32.func('uint32 GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *pid)');
const ClientToScreen = user32.func('bool ClientToScreen(void *hWnd, _Inout_ POINT *pt)');
const GetCursorPos = user32.func('bool GetCursorPos(_Out_ POINT *pt)');
const SendMessageTimeoutW = user32.func('intptr SendMessageTimeoutW(void *hWnd, uint32 msg, uintptr wParam, intptr lParam, uint32 flags, uint32 timeout, _Out_ uintptr *res)');
const AddFontResourceW = gdi32.func('int AddFontResourceW(const char16_t *path)');
const GetModuleHandleW = kernel32.func('void *GetModuleHandleW(const char16_t *name)');

const WH_KEYBOARD_LL = 13, WH_MOUSE_LL = 14;
const KEYEVENTF_KEYUP = 2, KEYEVENTF_UNICODE = 4;
const LLKHF_INJECTED = 0x10;
const MARK = 0x4d4c5921; // "ML!" – tags the events we generate ourselves

const keep = []; // callbacks must stay referenced
let kbHook = null, mouseHook = null;

function installHooks({ onKey, onMouseDown }) {
  const hmod = GetModuleHandleW(null);
  const kbCb = koffi.register((nCode, wParam, lParam) => {
    if (nCode === 0) {
      const k = koffi.decode(lParam, KBDLL);
      const ours = (k.flags & LLKHF_INJECTED) !== 0 || k.dwExtraInfo === MARK;
      if (!ours) {
        const down = wParam === 0x100 || wParam === 0x104; // WM_KEYDOWN / WM_SYSKEYDOWN
        let swallow = false;
        try { swallow = onKey(k.vkCode, down); } catch (e) { console.error(e); }
        if (swallow) return 1;
      }
    }
    return CallNextHookEx(null, nCode, wParam, lParam);
  }, koffi.pointer(HookProc));
  const msCb = koffi.register((nCode, wParam, lParam) => {
    if (nCode === 0 && (wParam === 0x201 || wParam === 0x204 || wParam === 0x207)) {
      try { onMouseDown(); } catch (e) { console.error(e); }
    }
    return CallNextHookEx(null, nCode, wParam, lParam);
  }, koffi.pointer(HookProc));
  keep.push(kbCb, msCb);
  kbHook = SetWindowsHookExW(WH_KEYBOARD_LL, kbCb, hmod, 0);
  mouseHook = SetWindowsHookExW(WH_MOUSE_LL, msCb, hmod, 0);
  if (!kbHook) throw new Error('Could not install the keyboard hook');
}

function removeHooks() {
  if (kbHook) UnhookWindowsHookEx(kbHook);
  if (mouseHook) UnhookWindowsHookEx(mouseHook);
  kbHook = mouseHook = null;
}

const MARKED = true;
const ev = (vk, scan, flags) => ({ type: 1, ki: { wVk: vk, wScan: scan, dwFlags: flags, time: 0, dwExtraInfo: MARK }, pad: new Array(8).fill(0) });

/** Press Backspace `n` times, then type `text` as Unicode characters (works in any app that accepts text). */
function sendEdit(n, text) {
  const list = [];
  for (let i = 0; i < n; i++) list.push(ev(0x08, 0, 0), ev(0x08, 0, KEYEVENTF_KEYUP));
  for (let i = 0; i < text.length; i++) {
    const u = text.charCodeAt(i); // UTF-16 units; surrogate pairs are sent as two units, which Windows accepts
    list.push(ev(0, u, KEYEVENTF_UNICODE), ev(0, u, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
  }
  if (list.length) SendInputRaw(list.length, list, koffi.sizeof(INPUT));
}

const isDown = (vk) => (GetAsyncKeyState(vk) & 0x8000) !== 0;
const capsOn = () => (GetKeyState(0x14) & 1) === 1;
const foreground = () => { const h = GetForegroundWindow(); return h ? koffi.address(h) : 0n; };

/** Press and release one key (used for Enter / Tab / Scroll Lock after a commit). */
function sendKey(vk, extended) {
  const f = extended ? 1 : 0;
  SendInputRaw(2, [ev(vk, 0, f), ev(vk, 0, f | KEYEVENTF_KEYUP)], koffi.sizeof(INPUT));
}

/** Screen position (physical pixels) of the text caret of the focused window, or of the mouse pointer as a fallback. */
function caretPos() {
  try {
    const fg = GetForegroundWindow();
    const tid = fg ? GetWindowThreadProcessId(fg, [0]) : 0;
    const info = { cbSize: koffi.sizeof(GUITHREADINFO), flags: 0, hwndActive: null, hwndFocus: null, hwndCapture: null, hwndMenuOwner: null, hwndMoveSize: null, hwndCaret: null, rcCaret: { left: 0, top: 0, right: 0, bottom: 0 } };
    if (tid && GetGUIThreadInfo(tid, info) && info.hwndCaret && (info.rcCaret.bottom || info.rcCaret.right)) {
      const pt = { x: info.rcCaret.left, y: info.rcCaret.bottom };
      if (ClientToScreen(info.hwndCaret, pt)) return { x: pt.x, y: pt.y, caret: true };
    }
  } catch { /* fall through */ }
  const p = { x: 0, y: 0 };
  GetCursorPos(p);
  return { x: p.x, y: p.y, caret: false };
}

/** Scroll Lock LED / state (true = on). */
const scrollLockOn = () => (GetKeyState(0x91) & 1) === 1;

/** Load a font file for the current session and tell running programs about it. */
function addFont(file) {
  const n = AddFontResourceW(file);
  try { SendMessageTimeoutW(0xffff, 0x001d, 0, 0, 2, 1000, [0]); } catch { /* ignore */ }
  return n;
}

module.exports = { sendKey, caretPos, scrollLockOn, addFont, installHooks, removeHooks, sendEdit, isDown, capsOn, foreground };

/** Application identity: version, build date and where releases live. Filled in by Vite at build time. */
export const APP_NAME = 'Malayalam Studio';
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_DATE: string = __BUILD__;
export const REPO: string = __REPO__; // "owner/repo" – set automatically by the GitHub workflow
export const REPO_URL = REPO ? `https://github.com/${REPO}` : '';
export const RELEASES_URL = REPO_URL ? `${REPO_URL}/releases/latest` : '';

/** What the Windows app (Electron preload) exposes; undefined in a normal browser. */
export interface DesktopBridge {
  version: string;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximized(cb: (m: boolean) => void): void;
  checkUpdate(): Promise<string>;
  openExternal(url: string): void;
}
export const desktop = (): DesktopBridge | undefined => (window as unknown as { mlDesktop?: DesktopBridge }).mlDesktop;
export const IS_DESKTOP = !!desktop() || /Electron\//.test(navigator.userAgent);

const num = (v: string) => v.split('.').map((x) => parseInt(x, 10) || 0);
export function isNewer(remote: string, local = APP_VERSION): boolean {
  const a = num(remote), b = num(local);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

/** Ask the website for its newest version (works for the browser and for the desktop app). */
export async function latestVersion(): Promise<{ version: string; built?: string } | null> {
  try {
    const r = await fetch(`./update-manifest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const m = await r.json();
    return m.version ? { version: m.version, built: m.built } : null;
  } catch {
    return null;
  }
}

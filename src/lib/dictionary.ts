/**
 * Client for the sharded Olam dictionary index built by scripts/build-dict.py.
 * Data: Olam English-Malayalam dataset (https://olam.in/open/enml/), ODbL 1.0 — see public/dict/ATTRIBUTION.txt
 */
export type Direction = 'en-ml' | 'ml-en';

export interface Sense {
  pos: string;
  ml: string;
}
/** [headword, senses[]] */
export type EnEntry = [string, [string, string][]];
/** [malayalam key, [english, pos, rank][]]  (rank 0 = whole-definition match, 1 = short phrase, 2 = word inside phrase) */
export type MlEntry = [string, [string, string, number][]];

const BASE = `${import.meta.env.BASE_URL}dict/`;
const cache = new Map<string, Promise<unknown>>();

function loadJson<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      return r.json() as Promise<T>;
    });
    cache.set(path, p);
    p.catch(() => cache.delete(path)); // allow retry after a failure
  }
  return p;
}

const CHILLU: Array<[string, string]> = [
  ['ണ്‍', 'ൺ'],
  ['ന്‍', 'ൻ'],
  ['ര്‍', 'ർ'],
  ['ല്‍', 'ൽ'],
  ['ള്‍', 'ൾ'],
  ['ക്‍', 'ൿ'],
];

export function normalizeQuery(q: string): string {
  let s = q.replace(/\s+/g, ' ').trim();
  for (const [a, b] of CHILLU) s = s.split(a).join(b);
  return s;
}

export const isMalayalamQuery = (q: string): boolean => /[ഀ-ൿ]/.test(q);

export const enShardKey = (q: string): string =>
  q
    .toLowerCase()
    .slice(0, 2)
    .split('')
    .map((c) => (/[a-z0-9]/.test(c) ? c : '_'))
    .join('');

export const mlShardKey = (q: string): string =>
  Array.from(q)
    .slice(0, 2)
    .map((c) => c.codePointAt(0)!.toString(16).padStart(4, '0'))
    .join('');

function lowerBound<T>(arr: T[], key: string, get: (x: T) => string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (get(arr[mid]) < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface EnResult {
  exact: EnEntry | null;
  matches: EnEntry[]; // prefix matches (includes the exact one first)
}

export async function searchEnglish(raw: string, limit = 40): Promise<EnResult> {
  const q = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!q) return { exact: null, matches: [] };
  const shard = await loadJson<EnEntry[]>(`en/${enShardKey(q)}.json`).catch(() => [] as EnEntry[]);
  const lo = lowerBound(shard, q, (e) => e[0].toLowerCase());
  const matches: EnEntry[] = [];
  for (let i = lo; i < shard.length && matches.length < limit; i++) {
    if (!shard[i][0].toLowerCase().startsWith(q)) break;
    matches.push(shard[i]);
  }
  const exact = matches.find((m) => m[0].toLowerCase() === q) ?? null;
  return { exact, matches };
}

export interface MlResult {
  exact: MlEntry | null;
  matches: MlEntry[];
}

export async function searchMalayalam(raw: string, limit = 40): Promise<MlResult> {
  const q = normalizeQuery(raw);
  if (Array.from(q).length < 2) return { exact: null, matches: [] };
  const shard = await loadJson<MlEntry[]>(`ml/${mlShardKey(q)}.json`).catch(() => [] as MlEntry[]);
  const lo = lowerBound(shard, q, (e) => e[0]);
  const matches: MlEntry[] = [];
  for (let i = lo; i < shard.length && matches.length < limit; i++) {
    if (!shard[i][0].startsWith(q)) break;
    matches.push(shard[i]);
  }
  const exact = matches.find((m) => m[0] === q) ?? null;
  return { exact, matches };
}

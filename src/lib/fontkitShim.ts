/**
 * pdf-lib was written for @pdf-lib/fontkit (stream based subsets). The current official fontkit has the same
 * shaping engine (needed for Malayalam conjuncts and vowel signs) but returns subsets as plain bytes.
 * This adapter gives pdf-lib the interface it expects.
 */
import * as fontkit from 'fontkit';

interface Subset {
  encode(): Uint8Array | ArrayBuffer;
  encodeStream?: () => unknown;
}
interface Font {
  createSubset(): Subset;
}

export const fontkitForPdfLib = {
  create(bytes: Uint8Array, postscriptName?: string) {
    const font = (fontkit as unknown as { create(b: Uint8Array, n?: string): Font }).create(bytes, postscriptName);
    const make = font.createSubset.bind(font);
    font.createSubset = () => {
      const s = make();
      s.encodeStream = () => {
        const handlers: Record<string, Array<(v?: unknown) => void>> = {};
        const api = {
          on(ev: string, cb: (v?: unknown) => void) {
            (handlers[ev] ||= []).push(cb);
            return api;
          },
        };
        queueMicrotask(() => {
          try {
            const out = s.encode();
            handlers.data?.forEach((h) => h(out instanceof Uint8Array ? out : new Uint8Array(out)));
            handlers.end?.forEach((h) => h());
          } catch (e) {
            handlers.error?.forEach((h) => h(e));
          }
        });
        return api;
      };
      return s;
    };
    return font;
  },
};

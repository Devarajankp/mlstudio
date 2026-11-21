declare module 'fontkit';
declare module 'wawoff2' {
  const w: { decompress(b: Uint8Array): Promise<Uint8Array>; compress(b: Uint8Array): Promise<Uint8Array> };
  export default w;
}
declare module '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url' {
  const u: string;
  export default u;
}

declare module 'wawoff2/build/decompress_binding.js?raw' {
  const src: string;
  export default src;
}

declare const __APP_VERSION__: string;
declare const __REPO__: string;
declare const __BUILD__: string;

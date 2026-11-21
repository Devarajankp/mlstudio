// Builds the brand assets: logo.svg (letter drawn as a path, no font needed), PNG sizes, favicon, ICO, tray icons.
import * as fontkit from 'fontkit';
import fs from 'fs';
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('/home/claude/.npm-global/lib/node_modules/playwright');

const font = fontkit.create(fs.readFileSync('public/fonts/NotoSansMalayalam-Regular.woff2'));
const run = font.layout('മ');
const g = run.glyphs[0];
const upm = font.unitsPerEm;
const bb = g.bbox;
const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
// fit the glyph into a 250 x 250 box centred at (256, 292) in a 512 canvas
const s = 196 / Math.max(w, h);
const tx = 236 - (bb.minX + w / 2) * s, ty = 282 + (bb.minY + h / 2) * s;
const d = g.path.toSVG();
const letter = `<path transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)} ${(-s).toFixed(4)})" d="${d}" fill="url(#ink)"/>`;

const svg = (bg = true, mono = null) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2447d6"/><stop offset="1" stop-color="#0b8fb3"/></linearGradient>
<linearGradient id="ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2f9c"/><stop offset="1" stop-color="#0d6f95"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#06223d" flood-opacity=".35"/></filter>
</defs>
${bg ? '<rect width="512" height="512" rx="112" fill="url(#bg)"/>' : ''}
<g filter="url(#sh)">
<path d="M122 62h200l78 78v278a32 32 0 0 1-32 32H122a32 32 0 0 1-32-32V94a32 32 0 0 1 32-32z" fill="#fff"/>
<path d="M322 62l78 78h-46a32 32 0 0 1-32-32z" fill="#cfe3f7"/>
</g>
<g stroke="#8fa6c4" stroke-width="3" stroke-linecap="round">
<path d="M122 108h14M146 108h14M170 108h14M194 108h14M218 108h14M242 108h14M266 108h14"/>
</g>
<g stroke="#2447d6" stroke-width="4" stroke-linecap="round" opacity=".9"><path d="M122 100v16M194 100v16M266 100v16"/></g>
${letter}
<rect x="352" y="214" width="14" height="136" rx="7" fill="#ff7a2f"/>
<path d="M118 408h196" stroke="#c7d6ea" stroke-width="8" stroke-linecap="round"/>
<path d="M118 432h130" stroke="#c7d6ea" stroke-width="8" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync('public/brand/logo.svg', svg(true));
fs.writeFileSync('public/favicon.svg', svg(true));
fs.writeFileSync('public/brand/logo-transparent.svg', svg(false));

const gray = svg(true).replace('#2447d6', '#8b95a5').replace('#0b8fb3', '#6b7686').replace('#1b2f9c', '#4a5463').replace('#0d6f95', '#3a4350').replace('#ff7a2f', '#aab2bd');
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(markup, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${markup}`);
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
for (const n of [16, 24, 32, 48, 64, 128, 180, 256, 512]) await png(svg(true), n, `public/brand/logo-${n}.png`);
await png(svg(true), 32, 'public/brand/tray-on.png');
await png(gray, 32, 'public/brand/tray-off.png');
await browser.close();

// ICO (PNG-compressed entries, Windows Vista+)
const sizes = [16, 24, 32, 48, 64, 128, 256];
const imgs = sizes.map((n) => fs.readFileSync(`public/brand/logo-${n}.png`));
const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let off = 6 + 16 * sizes.length; const dir = [];
sizes.forEach((n, i) => { const e = Buffer.alloc(16); e[0] = n % 256; e[1] = n % 256; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(imgs[i].length, 8); e.writeUInt32LE(off, 12); off += imgs[i].length; dir.push(e); });
fs.writeFileSync('public/brand/logo.ico', Buffer.concat([head, ...dir, ...imgs]));
fs.copyFileSync('public/brand/logo.ico', 'public/favicon.ico');
console.log('brand assets written', fs.readdirSync('public/brand').join(' '));

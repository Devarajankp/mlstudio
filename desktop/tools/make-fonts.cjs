// woff2 (web) -> TTF (Windows can install these). Run: node tools/make-fonts.cjs
const fs = require('fs'), path = require('path');
const wawoff2 = require('wawoff2');
const src = path.join(__dirname, '../../public/fonts'), out = path.join(__dirname, '../fonts');
fs.mkdirSync(out, { recursive: true });
(async () => {
  let n = 0;
  const all = [...fs.readdirSync(src).map((f) => [src, f]), ...fs.readdirSync(path.join(src, 'open')).map((f) => [path.join(src, 'open'), f])];
  for (const [dir, f] of all.filter(([, x]) => x.endsWith('.woff2'))) {
    const ttf = await wawoff2.decompress(fs.readFileSync(path.join(dir, f)));
    const isOtf = Buffer.from(ttf).subarray(0, 4).toString('latin1') === 'OTTO';
    fs.writeFileSync(path.join(out, f.replace(/\.woff2$/, isOtf ? '.otf' : '.ttf')), Buffer.from(ttf)); n++;
  }
  fs.copyFileSync(path.join(src, 'FONTS_LICENSE.txt'), path.join(out, 'FONTS_LICENSE.txt'));
  console.log('fonts converted:', n);
})();

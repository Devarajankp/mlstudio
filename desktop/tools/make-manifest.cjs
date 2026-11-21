// Lists every file of a web build with a hash, so the desktop app can download only what changed. node make-manifest.cjs <dist>
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(process.argv[2]);
const files = {};
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name !== 'update-manifest.json') files[path.relative(root, p).split(path.sep).join('/')] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
  }
})(root);
fs.writeFileSync(path.join(root, 'update-manifest.json'), JSON.stringify({ version: require('../../package.json').version, built: new Date().toISOString(), files }));
console.log('manifest:', Object.keys(files).length, 'files');

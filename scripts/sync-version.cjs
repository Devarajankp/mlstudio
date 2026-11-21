// keeps desktop/package.json in step with the root version (runs automatically on `npm version`)
const fs = require('fs');
const root = require('../package.json');
const f = require('path').join(__dirname, '../desktop/package.json');
const d = JSON.parse(fs.readFileSync(f, 'utf8'));
d.version = root.version;
fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n');
console.log('desktop version ->', d.version);

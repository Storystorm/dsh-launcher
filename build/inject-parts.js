const fs = require('fs');
const D = String.fromCharCode(92); // backslash
const B = String.fromCharCode(96); // backtick
const src = fs.readFileSync('/tmp/dsh-build/launcher-server.js', 'utf8');
const parts = {
  PAGE_CSS: fs.readFileSync('/tmp/dsh-build/part-css.txt', 'utf8').trim(),
  PAGE_HTML: fs.readFileSync('/tmp/dsh-build/part-html.txt', 'utf8').trim(),
  PAGE_JS: fs.readFileSync('/tmp/dsh-build/part-js.txt', 'utf8').trim(),
};
function esc(s) {
  return s.split(D).join(D + D).split(B).join(D + B);
}
let out = src;
for (const [name, content] of Object.entries(parts)) {
  const re = new RegExp('(const ' + name + ' = ' + B + ')[^]*?(' + B + ';)');
  if (!re.test(out)) throw new Error('not found: ' + name);
  out = out.replace(re, function (m, p1, p2) { return p1 + esc(content) + p2; });
}
fs.writeFileSync('/tmp/dsh-build/launcher-server.js', out);
console.log('injected parts into launcher-server.js, size', out.length);

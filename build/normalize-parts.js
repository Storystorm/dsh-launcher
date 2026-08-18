const fs = require('fs');
const D = String.fromCharCode(92);
for (const f of ['part-css.txt', 'part-html.txt', 'part-js.txt']) {
  const p = '/tmp/dsh-build/' + f;
  let s = fs.readFileSync(p, 'utf8');
  const before = (s.match(/\\\\/g) || []).length;
  s = s.split(D + D).join(D);
  fs.writeFileSync(p, s);
  console.log(f, 'halved', before, 'pairs');
}

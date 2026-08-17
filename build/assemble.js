const fs = require('fs');
const parts = {
  '__PART_CSS__': fs.readFileSync('/tmp/dsh-build/part-css.txt', 'utf8').trim(),
  '__PART_HTML__': fs.readFileSync('/tmp/dsh-build/part-html.txt', 'utf8').trim(),
  '__PART_JS__': fs.readFileSync('/tmp/dsh-build/part-js.txt', 'utf8').trim(),
};
const svg = fs.readFileSync('/Users/kisawork/.local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/favicon.svg', 'utf8');
const whale = svg.match(/<path[^>]*\sd="([^"]+)"/)[1];
let src = fs.readFileSync('/tmp/dsh-build/launcher-server.js', 'utf8');
let n = 0;
// 顺序很重要:先插入 UI 部件,最后全局替换鲸鱼路径(包括部件内的占位符)
for (const [k, v] of Object.entries(parts)) {
  n += src.split(k).length - 1;
  src = src.replaceAll(k, v);
}
n += src.split('__WHALE_PATH__').length - 1;
src = src.replaceAll('__WHALE_PATH__', whale);
fs.writeFileSync('/tmp/dsh-build/launcher-server.js', src);
console.log('replaced markers:', n, '| final size:', src.length, 'bytes');

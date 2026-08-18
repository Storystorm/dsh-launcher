const fs = require('fs');
const src = fs.readFileSync('/tmp/dsh-build/launcher-server.js', 'utf8');
const m = src.match(/const PAGE_JS = `([^]*?)`;/);
if (!m) throw new Error('PAGE_JS not found');
const servedJs = (new Function('return `' + m[1] + '`'))();
fs.writeFileSync('/tmp/dsh-build/served-js.js', servedJs);
const m2 = src.match(/const PAGE_HTML = `([^]*?)`;/);
const servedHtml = (new Function('return `' + m2[1] + '`'))();
fs.writeFileSync('/tmp/dsh-build/served-html.html', servedHtml);
const nav = (servedHtml.match(/data-view="[^"]+"/g) || []).map(s => s.replace('data-view="', '').replace('"', ''));
console.log('nav items:', JSON.stringify(nav));
const must = ['view-xt', 'installArea', 'dshLatestLine', 'btnReinstall', '遥控台', 'relayDot', 'relayUrl', 'btnRelayConnect', 'relayPairCode', 'relayQr', 'btnRelayDisconnect', 'loadRelay', 'btnRelayConnect', 'authWechat', 'btnWxUnbind', 'view-tools', 'btnToolsStartAll', 'btnToolsStopAll', 'btnToolsReload', 'mcpBar', 'toolsList', 'toolLogModal', 'loadTools'];
const mustBackend = ['relayCmdLoop', 'relayPairLoop', 'relayExec', '/api/relay/connect', '/api/relay/disconnect', '/api/relay/poll', 'yamlMini', 'syncMcpPatch', 'mcpListToolsHttp', 'mcpListToolsStdio', 'probeMcpForTool', '/api/tools', 'toolsWatchLoop', 'assignPort', 'killTree', 'reconcilePids', 'TOOLS_TEMPLATE'];
const gone = ['view-discover', 'view-market', 'view-skills', 'view-ui', 'view-install', 'trendingList', 'monVersion'];
let bad = 0;
for (const x of must) { const ok = servedHtml.includes(x) || servedJs.includes(x); if (!ok) { bad++; console.log('MISSING: ' + x); } }
for (const x of mustBackend) { if (!src.includes(x)) { bad++; console.log('MISSING-BACKEND: ' + x); } }
for (const x of gone) { const present = servedHtml.includes(x) || servedJs.includes(x); if (present) { bad++; console.log('SHOULD-BE-GONE: ' + x); } }
console.log(bad ? ('FAILED checks: ' + bad) : 'STRUCTURE OK');

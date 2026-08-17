#!/usr/bin/env node
'use strict';
/* DeepSeek Harness 启动器 v3 — 跨平台安装 + 启动面板
 * 双击运行:打开本地设置面板(默认 http://127.0.0.1:8788)。
 * 功能:环境检测、一键安装 Node.js(便携版)与 DSH、启动/停止 dsh web、日志。
 * 零外部依赖,可被 pkg 打包为 Win/macOS/Linux 单文件程序。
 */
const http = require('node:http');
const https = require('node:https');
const { spawn, execFile, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const { URL } = require('node:url');

const VERSION = '0.1.0';
const NODE_VERSION = '24.19.0';
const DSH_PACKAGE = '@deepseek-ai/dsh@0.1.0-rc.6';

// ---- CLI 参数 ----
const args = process.argv.slice(2);
const NO_OPEN = args.includes('--no-open');
let argPort = null;
const pIdx = args.indexOf('--port');
if (pIdx >= 0 && args[pIdx + 1]) argPort = Number(args[pIdx + 1]);

const UI_PORT = Number(process.env.DSH_LAUNCHER_UI_PORT || argPort || 8788);
const UI_HOST = '127.0.0.1';
const HOME = os.homedir();

function defaultDataDir() {
  if (process.env.DSH_LAUNCHER_DATA_DIR) return process.env.DSH_LAUNCHER_DATA_DIR;
  if (process.platform === 'darwin') return path.join(HOME, 'Library', 'Application Support', 'dsh-launcher');
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local'), 'dsh-launcher');
  return path.join(process.env.XDG_DATA_HOME || path.join(HOME, '.local', 'share'), 'dsh-launcher');
}
const DATA_DIR = defaultDataDir();
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const STATE_PATH = path.join(DATA_DIR, 'state.json');
const INSTALL_PATH = path.join(DATA_DIR, 'install.json');
const NODE_DIR = path.join(DATA_DIR, 'node');
const DSH_PREFIX = path.join(DATA_DIR, 'dsh');
const LOG_PATH = path.join(DATA_DIR, 'dsh-web.log');
const DSH_HOME_DIR = process.env.DSH_HOME || path.join(HOME, '.dsh');
const DEFAULTS = { host: '127.0.0.1', port: 8787, autoOpen: true, update: { owner: 'Storystorm', repo: 'dsh-launcher', intervalHours: 6 } };

const IS_WIN = process.platform === 'win32';

// ---- 官方 favicon 的鲸鱼路径(构建时由组装脚本替换,包括 UI 占位符) ----
const WHALE_PATH = "M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z";

function loadJSON(file, fallback) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Object.assign({}, fallback, v);
  } catch (e) { return Object.assign({}, fallback); }
}
function saveJSON(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

let config = loadJSON(CONFIG_PATH, DEFAULTS);
let state = loadJSON(STATE_PATH, {});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function openCmd() {
  if (process.platform === 'darwin') return '/usr/bin/open';
  if (IS_WIN) return 'cmd';
  return 'xdg-open';
}
function openUrl(url) {
  try {
    if (IS_WIN) execFile('cmd', ['/c', 'start', '', url]);
    else execFile(openCmd(), [url]);
  } catch (e) {}
}
const PANEL_URL = () => 'http://' + UI_HOST + ':' + UI_PORT;

// ================================================================ 环境检测
function which(name) {
  try {
    const cmd = IS_WIN ? 'where' : 'which';
    const r = spawnSync(cmd, [name], { encoding: 'utf8', timeout: 10000 });
    if (r.status === 0) {
      const lines = String(r.stdout).split(/\r?\n/).filter(Boolean);
      if (lines.length) return lines[0];
    }
  } catch (e) {}
  return null;
}
function candidateDirs() {
  if (process.platform === 'darwin') return ['/opt/homebrew/bin', '/usr/local/bin', path.join(HOME, '.local/bin'), '/usr/bin'];
  if (IS_WIN) {
    return [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs'),
      path.join(process.env.APPDATA || '', 'npm'),
    ];
  }
  return ['/usr/local/bin', '/usr/bin', '/bin', path.join(HOME, '.local/bin')];
}
function findSystemNode() {
  const p = which('node');
  if (p && fs.existsSync(p)) return p;
  const name = IS_WIN ? 'node.exe' : 'node';
  for (const dir of candidateDirs()) {
    const cand = path.join(dir, name);
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}
function nodeVersion(nodePath) {
  if (!nodePath) return null;
  try {
    const r = spawnSync(nodePath, ['--version'], { encoding: 'utf8', timeout: 15000 });
    if (r.status === 0) return String(r.stdout).trim().replace(/^v/, '');
  } catch (e) {}
  return null;
}
function findNpmCli(nodePath) {
  if (!nodePath) return null;
  let real = nodePath;
  try { real = fs.realpathSync(nodePath); } catch (e) {}
  const dirs = [path.dirname(nodePath), path.dirname(real)];
  for (const dir of dirs) {
    const cands = [
      path.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      path.join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      path.join(dir, 'npm-cli.js'),
    ];
    for (const c of cands) if (fs.existsSync(c)) return c;
  }
  return null;
}
// 若启动器本身运行在便携版 Node 发行版上(非 pkg 打包),返回其发行版根目录,安装时可复用
function bundledNodeRoot() {
  if (process.pkg) return null;
  try {
    const npm = findNpmCli(process.execPath);
    if (!npm) return null;
    const root = IS_WIN
      ? path.resolve(path.dirname(npm), '..')
      : path.resolve(path.dirname(npm), '..', '..', '..');
    const probe = IS_WIN ? path.join(root, 'node.exe') : path.join(root, 'bin', 'node');
    if (fs.existsSync(probe)) return root;
  } catch (e) {}
  return null;
}
function portableNodePath() {
  const p = IS_WIN ? path.join(NODE_DIR, 'node.exe') : path.join(NODE_DIR, 'bin', 'node');
  return fs.existsSync(p) ? p : null;
}
function installedDsh() {
  try {
    const info = JSON.parse(fs.readFileSync(INSTALL_PATH, 'utf8'));
    if (info && info.dshBin && fs.existsSync(info.dshBin)) return info;
  } catch (e) {}
  return null;
}
function systemDsh() {
  const names = IS_WIN ? ['dsh.cmd', 'dsh.exe', 'dsh'] : ['dsh'];
  for (const n of names) {
    const p = which(n);
    if (p && fs.existsSync(p)) return p;
  }
  const cands = IS_WIN
    ? [path.join(process.env.APPDATA || '', 'npm', 'dsh.cmd')]
    : [path.join(HOME, '.local', 'bin', 'dsh'), '/usr/local/bin/dsh', '/opt/homebrew/bin/dsh'];
  for (const p of cands) if (fs.existsSync(p)) return p;
  return null;
}
function dshVersion(node, bin) {
  if (!node || !bin) return null;
  try {
    const r = spawnSync(node, [bin, '--version'], {
      encoding: 'utf8', timeout: 20000,
      env: Object.assign({}, process.env, { DSH_HOME: DSH_HOME_DIR }),
    });
    if (r.status === 0) return String(r.stdout).trim().split(/\r?\n/)[0];
  } catch (e) {}
  return null;
}
async function getEnv() {
  const sysNode = findSystemNode();
  const sysNodeVer = sysNode ? nodeVersion(sysNode) : null;
  const pNode = portableNodePath();
  const pNodeVer = pNode ? nodeVersion(pNode) : null;
  const inst = installedDsh();
  const sysDsh = systemDsh();
  let dsh = null;
  if (inst) {
    dsh = { source: 'installed', bin: inst.dshBin, version: inst.version || dshVersion(inst.nodePath, inst.dshBin), node: inst.nodePath };
  } else if (sysDsh) {
    const node = sysNode || pNode;
    dsh = { source: 'system', bin: sysDsh, version: dshVersion(node, sysDsh), node: node };
  }
  return {
    platform: process.platform,
    arch: process.arch,
    os: os.type() + ' ' + os.release(),
    nodeSystem: sysNode ? { path: sysNode, version: sysNodeVer } : null,
    nodePortable: pNode ? { path: pNode, version: pNodeVer } : null,
    npmSystem: sysNode ? findNpmCli(sysNode) : null,
    dsh: dsh,
    paths: { dataDir: DATA_DIR, config: CONFIG_PATH, log: LOG_PATH, dshPrefix: DSH_PREFIX },
    version: VERSION,
  };
}

// ================================================================ DSH 运行
function resolveRun() {
  const inst = installedDsh();
  if (inst && inst.nodePath && fs.existsSync(inst.nodePath)) {
    return { node: inst.nodePath, bin: inst.dshBin, source: 'installed' };
  }
  const pNode = portableNodePath();
  const pBin = path.join(DSH_PREFIX, 'lib', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
  if (pNode && fs.existsSync(pBin)) return { node: pNode, bin: pBin, source: 'portable' };
  const sysDsh = systemDsh();
  const sysNode = findSystemNode();
  if (sysDsh && sysNode) return { node: sysNode, bin: sysDsh, source: 'system' };
  if (sysDsh && pNode) return { node: pNode, bin: sysDsh, source: 'system' };
  return null;
}

function checkUrl() {
  const h = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  return 'http://' + h + ':' + config.port;
}
function httpUp(url, timeoutMs) {
  timeoutMs = timeoutMs || 1500;
  return new Promise(resolve => {
    const req = http.get(url, { timeout: timeoutMs }, res => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

async function getStatus() {
  const url = checkUrl();
  const running = await httpUp(url);
  let pid = null, owned = false;
  if (running && state.pid) {
    try {
      const out = await new Promise((resolve, reject) => {
        execFile('/bin/ps', ['-p', String(state.pid), '-o', 'command='], (err, stdout) =>
          err ? reject(err) : resolve(String(stdout)));
      });
      if (/dsh/.test(out) && /web/.test(out)) { pid = state.pid; owned = true; }
    } catch (e) {}
  }
  return {
    running: running, owned: owned, pid: pid,
    host: config.host, port: config.port, url: url,
    startedAt: owned ? (state.startedAt || null) : null,
  };
}

async function startDsh() {
  const st = await getStatus();
  if (st.running) return Object.assign({ ok: true, alreadyRunning: true }, st);
  const run = resolveRun();
  if (!run) return { ok: false, error: '尚未安装 DeepSeek Harness,请先到「安装」页完成安装' };
  const url = checkUrl();
  let logFd;
  try { logFd = fs.openSync(LOG_PATH, 'a'); } catch (e) { logFd = 'ignore'; }
  let child;
  try {
    child = spawn(run.node, [run.bin, 'web', '--host', config.host, '--port', String(config.port)], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: Object.assign({}, process.env, { DSH_HOME: DSH_HOME_DIR }),
      cwd: HOME,
    });
  } catch (e) {
    return { ok: false, error: '无法启动 dsh: ' + e.message };
  }
  child.unref();
  if (typeof logFd === 'number') fs.closeSync(logFd);
  state = { pid: child.pid, port: config.port, host: config.host, startedAt: Date.now() };
  saveJSON(STATE_PATH, state);
  for (let i = 0; i < 100; i++) {
    await sleep(400);
    if (await httpUp(url, 1000)) {
      if (config.autoOpen) openUrl(url);
      const final = await getStatus();
      return Object.assign({ ok: true }, final);
    }
    let alive = true;
    try { process.kill(child.pid, 0); } catch (e) { alive = false; }
    if (!alive) {
      state = {};
      saveJSON(STATE_PATH, state);
      return { ok: false, error: 'dsh 启动后立即退出,请查看日志' };
    }
  }
  return { ok: false, error: '等待服务就绪超时(40s),请查看日志' };
}

async function stopDsh() {
  const st = await getStatus();
  if (!st.running) return { ok: true, message: '服务未在运行' };
  if (!st.owned) return { ok: false, error: '该实例不是本启动器启动的,不能停止(避免误杀)' };
  try { process.kill(st.pid, 'SIGTERM'); } catch (e) {}
  state = {};
  saveJSON(STATE_PATH, state);
  return { ok: true };
}

function setConfig(body) {
  const next = Object.assign({}, config);
  if (typeof body.port === 'number' && Number.isInteger(body.port) && body.port >= 1 && body.port <= 65535) {
    next.port = body.port;
  } else if (typeof body.port === 'string' && /^\d{1,5}$/.test(body.port)) {
    const p = Number(body.port);
    if (p >= 1 && p <= 65535) next.port = p;
  }
  if (typeof body.host === 'string' && /^[A-Za-z0-9.\-]{1,253}$/.test(body.host.trim())) {
    next.host = body.host.trim();
  }
  if (typeof body.autoOpen === 'boolean') next.autoOpen = body.autoOpen;
  if (body.update && typeof body.update === 'object') {
    const u = body.update;
    next.update = Object.assign({}, config.update || {});
    if (typeof u.owner === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(u.owner.trim())) next.update.owner = u.owner.trim();
    if (typeof u.repo === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(u.repo.trim())) next.update.repo = u.repo.trim();
    if (typeof u.intervalHours === 'number' && u.intervalHours >= 1 && u.intervalHours <= 168) next.update.intervalHours = u.intervalHours;
  }
  config = next;
  saveJSON(CONFIG_PATH, config);
  return config;
}

function tailLog(maxLines, maxBytes) {
  maxLines = maxLines || 200;
  maxBytes = maxBytes || 262144;
  try {
    const size = fs.statSync(LOG_PATH).size;
    if (size === 0) return '';
    const len = Math.min(size, maxBytes);
    const buf = Buffer.alloc(len);
    const fd = fs.openSync(LOG_PATH, 'r');
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split(/\r?\n/);
    return lines.slice(-maxLines).join('\n');
  } catch (e) { return ''; }
}

// ================================================================ 安装流程
let installJob = null;
let installChild = null;

function jobLog(msg) {
  if (!installJob) return;
  installJob.log.push(msg);
  if (installJob.log.length > 400) installJob.log.shift();
}

function nodeDistInfo() {
  let platName, ext;
  if (IS_WIN) { platName = 'win'; ext = 'zip'; }
  else if (process.platform === 'darwin') { platName = 'darwin'; ext = 'tar.gz'; }
  else { platName = 'linux'; ext = 'tar.gz'; }
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const base = 'node-v' + NODE_VERSION + '-' + platName + '-' + arch;
  return {
    url: 'https://nodejs.org/dist/v' + NODE_VERSION + '/' + base + '.' + ext,
    file: path.join(DATA_DIR, base + '.' + ext),
    ext: ext,
  };
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(u, { headers: { 'User-Agent': 'dsh-launcher/' + VERSION } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, u).toString();
        return downloadFile(next, dest, onProgress).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('下载失败 HTTP ' + res.statusCode));
      }
      const total = Number(res.headers['content-length']) || 0;
      const tmp = dest + '.part';
      const out = fs.createWriteStream(tmp);
      let got = 0;
      res.on('data', c => {
        got += c.length;
        if (onProgress && total) onProgress(Math.min(1, got / total));
      });
      res.pipe(out);
      out.on('finish', () => out.close(() => { fs.renameSync(tmp, dest); resolve(); }));
      res.on('error', reject);
      out.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('下载超时')));
  });
}

function extractTarGz(file, dest) {
  const data = zlib.gunzipSync(fs.readFileSync(file));
  let off = 0;
  fs.mkdirSync(dest, { recursive: true });
  const root = path.resolve(dest);
  while (off + 512 <= data.length) {
    const name = data.toString('utf8', off, off + 100).replace(/\0.*$/, '');
    const sizeStr = data.toString('utf8', off + 124, off + 136).replace(/\0.*$/, '').trim();
    const size = (sizeStr ? parseInt(sizeStr, 8) : 0) || 0;
    const type = String.fromCharCode(data[off + 156]);
    const prefix = data.toString('utf8', off + 345, off + 500).replace(/\0.*$/, '');
    if (!name) break;
    const fullName = prefix ? prefix + '/' + name : name;
    const target = path.resolve(root, fullName);
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error('tar 路径越界: ' + fullName);
    const headerEnd = off + 512;
    if (type === '5') {
      fs.mkdirSync(target, { recursive: true });
    } else if (type === '2' || type === '1') {
      const link = data.toString('utf8', off + 157, off + 257).replace(/\0.*$/, '');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      try { fs.symlinkSync(link, target); } catch (e) {}
    } else {
      const modeStr = data.toString('utf8', off + 100, off + 108).trim();
      const mode = (modeStr ? parseInt(modeStr, 8) : 0) || 0o755;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data.subarray(headerEnd, headerEnd + size));
      try { fs.chmodSync(target, mode & 0o777); } catch (e) {}
    }
    off = headerEnd + Math.ceil(size / 512) * 512;
  }
}

function extractZip(file, dest) {
  const data = fs.readFileSync(file);
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 65536); i--) {
    if (data.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('无效的 zip 文件');
  const count = data.readUInt16LE(eocd + 10);
  const cdStart = data.readUInt32LE(eocd + 16);
  fs.mkdirSync(dest, { recursive: true });
  const root = path.resolve(dest);
  let off = cdStart;
  for (let i = 0; i < count; i++) {
    if (data.readUInt32LE(off) !== 0x02014b50) throw new Error('zip 中央目录损坏');
    const method = data.readUInt16LE(off + 10);
    const compSize = data.readUInt32LE(off + 20);
    const nameLen = data.readUInt16LE(off + 28);
    const extraLen = data.readUInt16LE(off + 30);
    const commentLen = data.readUInt16LE(off + 32);
    const localOff = data.readUInt32LE(off + 42);
    const name = data.toString('utf8', off + 46, off + 46 + nameLen);
    if (data.readUInt32LE(localOff) !== 0x04034b50) throw new Error('zip 本地头损坏: ' + name);
    const lNameLen = data.readUInt16LE(localOff + 26);
    const lExtraLen = data.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const target = path.resolve(root, name);
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error('zip 路径越界: ' + name);
    if (name.endsWith('/')) {
      fs.mkdirSync(target, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const raw = data.subarray(dataStart, dataStart + compSize);
      const out = method === 0 ? raw : zlib.inflateRawSync(raw);
      fs.writeFileSync(target, out);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
}

function extractArchive(file, dest) {
  if (file.endsWith('.zip')) extractZip(file, dest);
  else extractTarGz(file, dest);
}

// 发行版压缩包内含唯一顶层目录(node-vX.Y.Z-platform-arch/),提升为 dest
function extractArchiveToDir(file, dest) {
  const tmp = dest + '.extract-tmp';
  fs.rmSync(tmp, { recursive: true, force: true });
  extractArchive(file, tmp);
  let entries = [];
  try { entries = fs.readdirSync(tmp).filter(n => !n.startsWith('.')); } catch (e) {}
  if (entries.length === 1 && fs.statSync(path.join(tmp, entries[0])).isDirectory()) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(path.join(tmp, entries[0]), dest);
    fs.rmSync(tmp, { recursive: true, force: true });
  } else {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(tmp, dest);
  }
  return dest;
}

function npmInstall(node, npmCli) {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, {
      PATH: path.dirname(node) + (IS_WIN ? ';' : ':') + (process.env.PATH || ''),
      npm_config_loglevel: 'error',
      npm_config_no_audit: 'true',
      npm_config_no_fund: 'true',
      npm_config_fetch_retries: '2',
    });
    installChild = spawn(node, [npmCli, 'install', '-g', '--prefix', DSH_PREFIX, '--no-audit', '--no-fund', DSH_PACKAGE], {
      env: env, cwd: HOME, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buf = '';
    const pump = (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) if (line.trim()) jobLog(line.trim());
    };
    installChild.stdout.on('data', pump);
    installChild.stderr.on('data', pump);
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { installChild.kill('SIGKILL'); } catch (e) {}
        reject(new Error('npm 安装超时(15 分钟)'));
      }
    }, 15 * 60 * 1000);
    installChild.on('close', code => {
      installChild = null;
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error('npm install 退出码 ' + code));
    });
  });
}

function tryAddToPath(node) {
  if (IS_WIN) return;
  if (process.env.DSH_LAUNCHER_DATA_DIR) {
    jobLog('(测试模式:DSH_LAUNCHER_DATA_DIR 已设置,跳过 PATH 配置)');
    return;
  }
  try {
    const binDir = path.join(HOME, '.local', 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    const linkNode = path.join(binDir, 'node');
    if (!fs.existsSync(linkNode)) {
      try { fs.symlinkSync(node, linkNode); } catch (e) {}
    }
    const dshBin = path.join(DSH_PREFIX, 'lib', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
    if (fs.existsSync(dshBin)) {
      const linkDsh = path.join(binDir, 'dsh');
      try { fs.unlinkSync(linkDsh); } catch (e) {}
      try { fs.symlinkSync(dshBin, linkDsh); jobLog('已把 dsh / node 加入 ~/.local/bin(重启终端后可直接使用命令)'); } catch (e) {}
    }
  } catch (e) {
    jobLog('跳过 PATH 配置: ' + e.message);
  }
}

async function runInstall(opts) {
  if (installJob && installJob.running) return;
  const job = {
    running: true, phase: 'init', message: '准备安装…', percent: 0,
    log: [], error: null, done: false, canceled: false,
  };
  installJob = job;
  try {
    const forcePortable = !!(opts && opts.portable);
    let node = null, npmCli = null;
    if (!forcePortable) {
      const sn = findSystemNode();
      const sv = nodeVersion(sn);
      if (sn && sv && parseInt(sv.split('.')[0], 10) >= 18) {
        const nc = findNpmCli(sn);
        if (nc) { node = sn; npmCli = nc; }
      }
    }
    if (node) {
      job.percent = 40;
      job.message = '使用系统 Node.js 安装 DSH…';
      jobLog('检测到系统 Node.js: ' + node + ' (v' + nodeVersion(node) + ')');
    } else {
      job.phase = 'node-download';
      job.message = '下载便携版 Node.js v' + NODE_VERSION;
      jobLog('未检测到可用的系统 Node.js,开始下载便携版 Node.js v' + NODE_VERSION + '…');
      const bundled = bundledNodeRoot();
      if (bundled) {
        job.phase = 'node-copy';
        job.message = '复用内置 Node.js…';
        job.percent = 45;
        jobLog('复用启动器内置的 Node.js 运行时(' + bundled + ')');
        fs.rmSync(NODE_DIR, { recursive: true, force: true });
        fs.cpSync(bundled, NODE_DIR, { recursive: true });
      } else {
        const dist = nodeDistInfo();
        let existed = false;
        try { existed = fs.existsSync(dist.file) && fs.statSync(dist.file).size > 1000000; } catch (e) {}
        if (existed) jobLog('复用已下载的安装包: ' + path.basename(dist.file));
        else await downloadFile(dist.url, dist.file, p => {
          if (job.canceled) return;
          job.percent = Math.round(p * 40);
        });
        if (job.canceled) throw new Error('已取消');
        job.phase = 'node-extract';
        job.message = '解压 Node.js…';
        job.percent = 45;
        jobLog('解压 ' + path.basename(dist.file) + ' …');
        extractArchiveToDir(dist.file, NODE_DIR);
      }
      node = portableNodePath();
      npmCli = findNpmCli(node);
      if (!node || !npmCli) throw new Error('便携版 Node.js 安装失败(未找到 node/npm)');
      job.percent = 60;
      jobLog('便携版 Node.js 就绪: v' + nodeVersion(node));
    }
    if (job.canceled) throw new Error('已取消');
    job.phase = 'dsh-install';
    job.message = '安装 DeepSeek Harness…';
    jobLog('npm install -g ' + DSH_PACKAGE + ' --prefix ' + DSH_PREFIX);
    await npmInstall(node, npmCli);
    if (job.canceled) throw new Error('已取消');
    job.percent = 92;
    job.phase = 'verify';
    job.message = '验证安装…';
    const dshBin = path.join(DSH_PREFIX, 'lib', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
    if (!fs.existsSync(dshBin)) throw new Error('未找到 dsh 可执行文件: ' + dshBin);
    const ver = dshVersion(node, dshBin);
    jobLog('dsh 版本: ' + (ver || '未知'));
    fs.writeFileSync(INSTALL_PATH, JSON.stringify({
      nodePath: node, dshBin: dshBin, version: ver,
      at: new Date().toISOString(),
      portable: node.indexOf(DATA_DIR) === 0,
    }, null, 2));
    tryAddToPath(node);
    job.percent = 100;
    job.phase = 'done';
    job.message = '安装完成';
    jobLog('✓ DeepSeek Harness 安装完成,前往「状态」页启动');
  } catch (e) {
    job.phase = job.canceled ? 'canceled' : 'error';
    job.message = String(e && e.message || e);
    job.error = job.canceled ? null : job.message;
    jobLog((job.canceled ? '已取消: ' : '✗ 安装失败: ') + job.message);
  }
  job.running = false;
  job.done = job.phase === 'done';
}

function cancelInstall() {
  if (!installJob || !installJob.running) return { ok: false, error: '没有进行中的安装' };
  installJob.canceled = true;
  if (installChild) {
    try { installChild.kill('SIGKILL'); } catch (e) {}
    installChild = null;
  }
  return { ok: true };
}

function installSnapshot() {
  if (!installJob) return { running: false, done: false, log: [] };
  return {
    running: installJob.running,
    phase: installJob.phase,
    message: installJob.message,
    percent: installJob.percent,
    error: installJob.error,
    done: installJob.done,
    canceled: installJob.canceled,
    log: installJob.log.slice(-120),
  };
}

// ================================================================ 更新检查
let updateCache = { checkedAt: 0, latest: null, hasUpdate: false, url: null, error: null };

function parseVer(v) {
  return String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
}
function isNewer(a, b) {
  const A = parseVer(a), B = parseVer(b);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const x = A[i] || 0, y = B[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}
function updateSource() {
  const u = (config && config.update) || {};
  return {
    owner: String(u.owner || 'Storystorm').trim(),
    repo: String(u.repo || 'dsh-launcher').trim(),
  };
}
async function checkUpdate(force) {
  const now = Date.now();
  if (!force && updateCache.checkedAt && now - updateCache.checkedAt < 30 * 60 * 1000) return updateCache;
  const { owner, repo } = updateSource();
  const apiUrl = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/releases/latest';
  const fresh = {
    checkedAt: now, latest: null, hasUpdate: false,
    url: 'https://github.com/' + owner + '/' + repo + '/releases/latest',
    error: null,
  };
  try {
    const data = await new Promise((resolve, reject) => {
      https.get(apiUrl, { headers: { 'User-Agent': 'dsh-launcher/' + VERSION, 'Accept': 'application/vnd.github+json' } }, res => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
    if (data && data.tag_name && !data.prerelease) {
      fresh.latest = String(data.tag_name).replace(/^v/i, '');
      fresh.hasUpdate = isNewer(fresh.latest, VERSION);
    }
  } catch (e) {
    fresh.error = String(e && e.message || e);
  }
  updateCache = fresh;
  return updateCache;
}

// 定时检查:启动 30 秒后检查一次,之后每小时醒来判断是否到间隔
setTimeout(() => { checkUpdate(true).catch(() => {}); }, 30 * 1000);
setInterval(() => {
  const u = (config && config.update) || {};
  const hours = Math.max(1, Math.min(168, Number(u.intervalHours) || 6));
  if (Date.now() - (updateCache.checkedAt || 0) >= hours * 3600 * 1000) {
    checkUpdate(true).catch(() => {});
  }
}, 60 * 60 * 1000);

// ================================================================ UI
const FAVICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><path d="' + WHALE_PATH + '" fill="#0f1115"/></svg>';

const PAGE_CSS = `:root{
  --bg-base:#f9fafb;
  --bg-layer-1:#ffffff;
  --bg-layer-2:#f5f6f7;
  --bg-hover:rgba(38,49,72,.06);
  --label-primary:#0f1115;
  --label-secondary:#61666b;
  --label-tertiary:#81858c;
  --border-l1:rgba(0,0,0,.04);
  --border-l2:rgba(0,0,0,.10);
  --brand:#5686fe;
  --brand-strong:#4176e6;
  --brand-soft:#e4edfd;
  --success:#22c55e;
  --error:#ef4444;
  --warn:#f59e0b;
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Segoe UI","Microsoft YaHei",sans-serif;
  --font-code:"SF Mono","JetBrains Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --shadow-lv1:0 2px 4px 0 rgba(0,0,0,.05);
  --shadow-lv2:0 4px 12px 0 rgba(0,0,0,.02),0 2px 8px 0 rgba(0,0,0,.04);
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;font-family:var(--font);background:var(--bg-base);color:var(--label-primary);font-size:14px;line-height:22px;-webkit-font-smoothing:antialiased}
.app{display:flex;height:100vh}
.sidebar{flex:none;width:224px;display:flex;flex-direction:column;background:var(--bg-layer-1);border-right:1px solid var(--border-l1);padding:12px 10px}
.brand{display:flex;align-items:center;gap:10px;padding:6px 8px 16px}
.brand-logo{width:32px;height:32px;border-radius:9px;background:var(--bg-layer-2);display:flex;align-items:center;justify-content:center;color:var(--label-primary);flex:none}
.brand-logo svg{width:21px;height:21px}
.brand-title{font-size:14px;font-weight:600;letter-spacing:.02em}
.brand-sub{font-size:11px;color:var(--label-tertiary);margin-top:1px}
.nav{display:flex;flex-direction:column;gap:2px}
.nav-item{display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:8px;color:var(--label-secondary);cursor:pointer;user-select:none;border:none;background:none;font:inherit;text-align:left}
.nav-item:hover{background:var(--bg-hover)}
.nav-item.active{background:var(--brand-soft);color:var(--brand-strong);font-weight:500}
.nav-item .ico{width:16px;height:16px;flex:none;display:inline-flex}
.sidebar-foot{margin-top:auto;padding:10px 12px;font-size:11px;color:var(--label-tertiary)}
.main{flex:1;min-width:0;overflow-y:auto;padding:28px 36px}
.view{max-width:820px}
.view[hidden]{display:none}
.title{font-size:16px;font-weight:600;margin:0 0 16px}
.card{background:var(--bg-layer-1);border:1px solid var(--border-l1);border-radius:12px;padding:18px 20px;box-shadow:var(--shadow-lv1);margin-bottom:16px}
.row{display:flex;align-items:center;gap:10px}
.spread{justify-content:space-between}
.muted{color:var(--label-tertiary)}
.dot{position:relative;display:inline-block;flex:none;width:12px;height:12px;color:var(--label-tertiary)}
.dot::before{content:"";position:absolute;top:0;right:0;bottom:0;left:0;border-radius:50%;background:currentColor;opacity:.15}
.dot::after{content:"";position:absolute;top:20%;right:20%;bottom:20%;left:20%;border-radius:50%;background:currentColor}
.dot.running{color:var(--success)}
.dot.starting{color:var(--warn)}
.dot.stopped{color:var(--label-tertiary)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:36px;padding:0 16px;border:none;border-radius:18px;cursor:pointer;font-size:14px;line-height:22px;font-family:inherit;background:transparent;color:var(--label-primary)}
.btn:disabled{cursor:not-allowed;opacity:.4}
.btn.primary{background:var(--label-primary);color:#fff}
.btn.primary:hover:not(:disabled){background:#2a2d33}
.btn.ghost:hover:not(:disabled){background:var(--bg-hover)}
.btn.outline{border:1px solid var(--border-l2)}
.btn.outline:hover:not(:disabled){background:var(--bg-hover)}
.btn.danger{color:var(--error)}
.btn.danger:hover:not(:disabled){background:rgba(239,68,68,.08)}
.btn.sm{height:28px;padding:0 10px;border-radius:14px;font-size:12px;line-height:18px}
.field{margin-bottom:16px}
.field label.block{display:block;font-size:12px;color:var(--label-secondary);margin-bottom:6px}
.input-wrap{display:flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:1px solid var(--border-l2);border-radius:8px;background:var(--bg-layer-1);max-width:300px;transition:border-color .12s ease}
.input-wrap:focus-within{border-color:var(--brand)}
.input-wrap input{flex:1;min-width:0;border:none;outline:none;background:transparent;font-size:14px;line-height:22px;color:var(--label-primary);font-family:inherit}
.checkbox-row{display:flex;align-items:center;gap:8px;cursor:pointer;color:var(--label-primary)}
.checkbox-row input{accent-color:var(--brand-strong);width:15px;height:15px;margin:0}
.hint{font-size:12px;color:var(--label-tertiary);margin-top:6px}
.log-box{background:#0f1115;color:#c9d1d9;font-family:var(--font-code);font-size:12px;line-height:18px;border-radius:12px;padding:14px 16px;height:440px;overflow-y:auto;white-space:pre-wrap;word-break:break-all}
.log-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
#toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(16px);background:#0f1115;color:#fff;padding:8px 16px;border-radius:16px;font-size:13px;opacity:0;transition:all .18s ease;pointer-events:none;box-shadow:var(--shadow-lv2);z-index:100}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
a{color:var(--brand-strong);text-decoration:none}
a:hover{text-decoration:underline}
.env-table{display:flex;flex-direction:column}
.env-row{display:flex;align-items:flex-start;gap:12px;padding:10px 2px;border-bottom:1px solid var(--border-l1)}
.env-row:last-child{border-bottom:none}
.env-name{flex:none;width:132px;color:var(--label-secondary);font-size:13px;padding-top:1px}
.env-val{flex:1;min-width:0;font-size:13px;word-break:break-all}
.pill{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:11px;font-size:12px;line-height:18px;flex:none}
.pill.ok{color:#1a7f37;background:#e6f6ec}
.pill.bad{color:#b42318;background:#fee4e2}
.pill.info{color:var(--brand-strong);background:var(--brand-soft)}
.pill.idle{color:var(--label-secondary);background:var(--bg-layer-2)}
.progress{height:6px;border-radius:3px;background:var(--bg-layer-2);overflow:hidden;margin-top:12px}
.progress-bar{height:100%;width:0;border-radius:3px;background:var(--brand);transition:width .25s ease}
.install-log{height:200px;margin-top:12px}
.card-title{font-size:13px;font-weight:600;margin:0 0 10px;color:var(--label-secondary)}`;
const PAGE_HTML = `<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-logo"><svg viewBox="0 0 50 50" fill="currentColor"><path d="M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z"/></svg></div>
      <div>
        <div class="brand-title">DeepSeek Harness</div>
        <div class="brand-sub">启动器 · 安装与启动</div>
      </div>
    </div>
    <nav class="nav">
      <button class="nav-item" data-view="install"><span class="ico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1.5v8M4.8 5.7L8 9l3.2-3.3"/><path d="M2.5 11.5v1.5a1 1 0 001 1h9a1 1 0 001-1v-1.5"/></svg></span>安装</button>
      <button class="nav-item active" data-view="status"><span class="ico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/></svg></span>状态</button>
      <button class="nav-item" data-view="settings"><span class="ico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 4.5h12M2 8h12M2 11.5h12"/><circle cx="5.5" cy="4.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="10.5" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="7.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/></svg></span>设置</button>
      <button class="nav-item" data-view="log"><span class="ico"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><path d="M4.5 6l2.2 2L4.5 10M8.5 10.5h3"/></svg></span>日志</button>
    </nav>
    <div class="sidebar-foot" id="sidebarFoot">控制面板 v0.1.0</div>
  </aside>
  <main class="main">
    <section class="view" id="view-install" hidden>
      <h2 class="title">安装 DeepSeek Harness</h2>
      <div class="card">
        <div class="env-table" id="envTable"><span class="muted">正在检测环境…</span></div>
        <div class="row" style="margin-top:14px;flex-wrap:wrap">
          <button class="btn primary" id="btnInstall">一键安装</button>
          <button class="btn outline" id="btnRecheck">重新检测</button>
          <label class="checkbox-row" style="font-size:12px;margin-left:8px"><input id="forcePortable" type="checkbox">强制使用便携版 Node.js</label>
        </div>
        <div class="hint" id="installHint"></div>
      </div>
      <div class="card" id="installProgressCard" hidden>
        <div class="row spread">
          <div id="installMessage" style="font-weight:600">安装中…</div>
          <span class="muted" id="installPercent" style="font-size:12px">0%</span>
        </div>
        <div class="progress"><div class="progress-bar" id="progressBar"></div></div>
        <div class="log-box install-log" id="installLog"></div>
        <div class="row" style="margin-top:10px">
          <button class="btn outline sm" id="btnCancelInstall">取消</button>
        </div>
      </div>
    </section>
    <section class="view" id="view-status">
      <h2 class="title">服务状态</h2>
      <div class="card">
        <div class="row spread">
          <div class="row">
            <span class="dot stopped" id="statusDot"></span>
            <div>
              <div id="statusText" style="font-weight:600">正在检测…</div>
              <div class="muted" id="statusDetail" style="font-size:12px"></div>
            </div>
          </div>
          <div class="row">
            <button class="btn outline sm" id="btnOpen" disabled>打开界面</button>
            <button class="btn primary" id="btnStart">启动</button>
            <button class="btn danger sm" id="btnStop" disabled>停止</button>
          </div>
        </div>
        <div class="hint" id="statusNeedInstall" hidden style="margin-top:10px;color:var(--warn)">尚未安装 DeepSeek Harness,请先到「安装」页完成安装</div>
        <div class="row" id="updateBanner" hidden style="margin-top:10px">
          <span class="pill" style="background:#fff7e6;color:#b45309">发现新版本 <span id="updateLatest"></span></span>
          <a id="updateLink" href="#" target="_blank" style="font-size:12px">前往下载</a>
        </div>
      </div>
      <div class="card">
        <div class="muted" style="font-size:12px">访问地址</div>
        <div style="margin-top:4px;font-size:14px"><a id="statusUrl" href="#" target="_blank">—</a></div>
      </div>
    </section>
    <section class="view" id="view-settings" hidden>
      <h2 class="title">启动设置</h2>
      <div class="card">
        <div class="field">
          <label class="block" for="port">服务端口</label>
          <div class="input-wrap"><input id="port" type="number" min="1" max="65535" placeholder="8787"></div>
          <div class="hint">DSH Web UI 监听的端口,默认 8787</div>
        </div>
        <div class="field">
          <label class="block" for="host">绑定地址</label>
          <div class="input-wrap"><input id="host" type="text" placeholder="127.0.0.1"></div>
          <div class="hint">默认 127.0.0.1 仅本机可访问;设为 0.0.0.0 可让局域网访问</div>
        </div>
        <div class="field">
          <label class="checkbox-row"><input id="autoOpen" type="checkbox">启动完成后自动打开界面</label>
        </div>
        <div class="row">
          <button class="btn primary" id="btnSave">保存设置</button>
          <span class="muted" style="font-size:12px" id="saveHint"></span>
        </div>
        <div class="hint" style="margin-top:14px" id="cfgPaths"></div>
      </div>
      <div class="card">
        <div class="card-title">更新检查</div>
        <div class="row spread">
          <span class="muted" id="updateCurrent" style="font-size:12px">当前版本 —</span>
          <button class="btn outline sm" id="btnCheckUpdate">立即检查</button>
        </div>
        <div class="hint" id="updateResult" style="margin-top:8px">启动后每 6 小时自动检查一次</div>
        <div class="field" style="margin-top:12px;margin-bottom:0">
          <label class="block">更新源(GitHub 仓库)</label>
          <div class="row">
            <div class="input-wrap" style="max-width:180px"><input id="updateOwner" type="text" placeholder="Storystorm"></div>
            <span class="muted">/</span>
            <div class="input-wrap" style="max-width:180px"><input id="updateRepo" type="text" placeholder="dsh-launcher"></div>
          </div>
          <div class="hint">用于检查新版本的仓库地址,留空使用默认值</div>
        </div>
      </div>
    </section>
    <section class="view" id="view-log" hidden>
      <h2 class="title">运行日志</h2>
      <div class="log-toolbar">
        <button class="btn outline sm" id="btnRefreshLog">刷新</button>
        <button class="btn outline sm" id="btnClearLog">清空</button>
        <label class="checkbox-row" style="font-size:12px"><input id="autoScroll" type="checkbox" checked>自动滚动</label>
        <span class="muted" id="logPath" style="font-size:12px"></span>
      </div>
      <div class="log-box" id="logBox">加载中…</div>
    </section>
  </main>
</div>`;
const PAGE_JS = `(function () {
  var $ = function (s) { return document.querySelector(s); };
  var views = ['install', 'status', 'settings', 'log'];
  var busy = false;
  var status = null;
  var toastTimer = null;
  var pollTimer = null;

  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function api(pathname, opts) {
    return fetch(pathname, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
        return data;
      });
    });
  }
  function switchView(name) {
    views.forEach(function (v) { $('#view-' + v).hidden = v !== name; });
    document.querySelectorAll('.nav-item').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === name);
    });
  }
  document.querySelectorAll('.nav-item').forEach(function (b) {
    b.addEventListener('click', function () { switchView(b.dataset.view); });
  });

  // ---- 状态 ----
  function renderStatus(st) {
    st = st || { running: false, owned: false, url: '' };
    status = st;
    var dot = $('#statusDot');
    dot.className = 'dot ' + (st.running ? 'running' : busy ? 'starting' : 'stopped');
    $('#statusText').textContent = st.running ? '运行中' : busy ? '正在启动…' : '未运行';
    $('#statusDetail').textContent = st.running
      ? (st.owned ? ('PID ' + st.pid + ' · 由本启动器启动') : '非本启动器启动的实例(不可停止)')
      : '点击「启动」开始服务';
    $('#statusUrl').textContent = st.url || '—';
    $('#statusUrl').href = st.url || '#';
    $('#btnOpen').disabled = !st.running;
    $('#btnStart').disabled = st.running || busy;
    $('#btnStop').disabled = !(st.running && st.owned) || busy;
  }
  function refresh() {
    return api('/api/status').then(renderStatus).catch(function () {
      $('#statusText').textContent = '无法连接控制服务';
    });
  }

  // ---- 设置 ----
  function loadConfig() {
    return api('/api/config').then(function (info) {
      $('#port').value = info.config.port;
      $('#host').value = info.config.host;
      $('#autoOpen').checked = !!info.config.autoOpen;
      if (info.config.update) {
        $('#updateOwner').value = info.config.update.owner || '';
        $('#updateRepo').value = info.config.update.repo || '';
      }
      $('#cfgPaths').textContent = '数据目录: ' + info.paths.dataDir + ' · 日志: ' + info.paths.log;
      $('#logPath').textContent = info.paths.log;
      $('#sidebarFoot').innerHTML = '控制面板 v' + info.version + '<br>仅本机可访问';
    }).catch(function () {});
  }

  // ---- 更新检查 ----
  function renderUpdate(u) {
    if (!u) return;
    $('#updateCurrent').textContent = '当前版本 v' + u.current;
    var banner = $('#updateBanner');
    if (u.hasUpdate) {
      banner.hidden = false;
      $('#updateLatest').textContent = 'v' + u.latest;
      $('#updateLink').href = u.url || '#';
      $('#updateResult').textContent = '发现新版本 v' + u.latest + ',点击「前往下载」获取';
    } else {
      banner.hidden = true;
      $('#updateResult').textContent = u.error
        ? ('检查失败: ' + u.error + '(自动重试中)')
        : ('已是最新版本 (v' + u.current + '),每 6 小时自动检查一次');
    }
  }
  function loadUpdate() {
    return api('/api/update').then(renderUpdate).catch(function () {});
  }

  // ---- 日志 ----
  function loadLog() {
    return api('/api/log?lines=300').then(function (r) {
      var box = $('#logBox');
      var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      box.textContent = r.log || '(暂无日志)';
      if ($('#autoScroll').checked || atBottom) box.scrollTop = box.scrollHeight;
    }).catch(function () {});
  }

  // ---- 安装 ----
  function pill(cls, text) {
    return '<span class="pill ' + cls + '">' + text + '</span>';
  }
  function envRow(name, val, pillHtml) {
    return '<div class="env-row"><div class="env-name">' + name + '</div>' +
      '<div class="env-val">' + val + '</div>' + (pillHtml || '') + '</div>';
  }
  function loadEnv() {
    return api('/api/env').then(function (env) {
      var rows = [];
      rows.push(envRow('系统', env.os + ' · ' + env.arch, pill('info', env.platform)));
      var nodeText, nodePill;
      if (env.nodeSystem) {
        nodeText = '系统 Node.js v' + env.nodeSystem.version;
        nodePill = pill('ok', '可用');
      } else if (env.nodePortable) {
        nodeText = '便携版 Node.js v' + env.nodePortable.version + '(本启动器安装)';
        nodePill = pill('ok', '可用');
      } else {
        nodeText = '未检测到 Node.js,一键安装将自动下载便携版';
        nodePill = pill('bad', '缺失');
      }
      rows.push(envRow('Node.js', nodeText, nodePill));
      rows.push(envRow('npm', env.npmSystem ? '随系统 Node.js 提供' : (env.nodePortable ? '随便携版 Node.js 提供' : '未检测到(随便携版自动安装)'), env.nodeSystem ? pill('ok', '可用') : (env.nodePortable ? pill('ok', '可用') : pill('idle', '待装'))));
      if (env.dsh) {
        rows.push(envRow('DeepSeek Harness', (env.dsh.version || '已安装') + ' · ' + (env.dsh.source === 'system' ? '系统已存在' : '本启动器安装'), pill('ok', '已安装')));
      } else {
        rows.push(envRow('DeepSeek Harness', '未安装,点击「一键安装」', pill('bad', '未安装')));
      }
      rows.push(envRow('安装位置', env.paths.dataDir, null));
      $('#envTable').innerHTML = rows.join('');
      $('#statusNeedInstall').hidden = !!env.dsh;
      $('#installHint').textContent = env.dsh
        ? '已检测到 DeepSeek Harness,可直接到「状态」页启动;「一键安装」将(重新)安装到本启动器目录。'
        : '将自动下载 Node.js(如需要)并通过 npm 安装 DeepSeek Harness,全程无需命令行。';
    }).catch(function () {
      $('#envTable').innerHTML = '<span class="muted">环境检测失败</span>';
    });
  }

  function renderInstall(snap) {
    snap = snap || {};
    $('#installProgressCard').hidden = false;
    $('#installMessage').textContent = snap.message || '';
    $('#installPercent').textContent = (snap.percent || 0) + '%';
    $('#progressBar').style.width = (snap.percent || 0) + '%';
    var box = $('#installLog');
    box.textContent = (snap.log || []).join('\\n');
    box.scrollTop = box.scrollHeight;
    $('#btnInstall').disabled = !!snap.running;
    $('#btnCancelInstall').disabled = !snap.running;
    if (!snap.running) {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      if (snap.done) { toast('安装完成,前往「状态」页启动'); loadEnv(); }
      else if (snap.canceled) { toast('已取消安装'); loadEnv(); }
      else if (snap.error) { toast('安装失败: ' + snap.error); }
      else { $('#installProgressCard').hidden = true; }
    }
  }

  // ---- 事件 ----
  $('#btnStart').addEventListener('click', function () {
    busy = true;
    renderStatus(status);
    api('/api/start', { method: 'POST' }).then(function (r) {
      if (r.ok) toast(r.alreadyRunning ? '服务已在运行' : '服务已启动');
      else {
        toast('启动失败: ' + (r.error || '未知错误'));
        if (String(r.error).indexOf('尚未安装') >= 0) switchView('install');
      }
    }).catch(function (e) {
      toast('启动失败: ' + e.message);
    }).then(function () {
      busy = false;
      refresh();
    });
  });
  $('#btnStop').addEventListener('click', function () {
    busy = true;
    api('/api/stop', { method: 'POST' }).then(function (r) {
      toast(r.ok ? '已停止' : (r.error || '停止失败'));
    }).catch(function (e) {
      toast(e.message);
    }).then(function () {
      busy = false;
      refresh();
    });
  });
  $('#btnOpen').addEventListener('click', function () {
    if (status && status.running) window.open(status.url, '_blank');
  });
  $('#btnSave').addEventListener('click', function () {
    var body = {
      port: Number($('#port').value),
      host: $('#host').value.trim(),
      autoOpen: $('#autoOpen').checked,
      update: {
        owner: $('#updateOwner').value.trim(),
        repo: $('#updateRepo').value.trim(),
        intervalHours: 6,
      },
    };
    api('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function () {
      $('#saveHint').textContent = '已保存';
      toast('设置已保存');
      refresh();
    }).catch(function (e) {
      toast('保存失败: ' + e.message);
    });
  });
  $('#btnCheckUpdate').addEventListener('click', function () {
    $('#updateResult').textContent = '正在检查…';
    api('/api/update/check', { method: 'POST' }).then(function (u) {
      renderUpdate(u);
      toast(u.hasUpdate ? ('发现新版本 v' + u.latest) : (u.error ? '检查失败' : '已是最新版本'));
    }).catch(function (e) {
      $('#updateResult').textContent = '检查失败: ' + e.message;
      toast('检查失败: ' + e.message);
    });
  });
  $('#btnRefreshLog').addEventListener('click', loadLog);
  $('#btnClearLog').addEventListener('click', function () {
    api('/api/log-clear', { method: 'POST' }).then(loadLog);
  });
  $('#btnRecheck').addEventListener('click', function () {
    loadEnv().then(function () { toast('检测完成'); });
  });
  $('#btnInstall').addEventListener('click', function () {
    api('/api/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portable: $('#forcePortable').checked }),
    }).then(function () {
      toast('开始安装…');
      pollTimer = setInterval(function () {
        api('/api/install/status').then(renderInstall).catch(function () {});
      }, 800);
    }).catch(function (e) {
      toast(e.message);
    });
  });
  $('#btnCancelInstall').addEventListener('click', function () {
    api('/api/install/cancel', { method: 'POST' }).then(function () {
      toast('正在取消…');
    });
  });

  refresh();
  loadConfig();
  loadLog();
  loadEnv();
  loadUpdate();
  api('/api/install/status').then(function (snap) {
    if (snap.running) {
      renderInstall(snap);
      pollTimer = setInterval(function () {
        api('/api/install/status').then(renderInstall).catch(function () {});
      }, 800);
    }
  });
  setInterval(refresh, 2000);
  setInterval(function () { if (!$('#view-log').hidden) loadLog(); }, 3000);
  setInterval(loadUpdate, 3600 * 1000);
})();`;

const PAGE = [
  '<!doctype html><html lang="zh-CN"><head>',
  '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>DeepSeek Harness 启动器</title>',
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
  '<style>', PAGE_CSS, '</style></head><body>',
  PAGE_HTML,
  '<div id="toast"></div>',
  '<script>', PAGE_JS, '</script>',
  '</body></html>',
].join('\n');

// ---- 调试命令: --extract <archive> <dest> ----
const exIdx = args.indexOf('--extract');
if (exIdx >= 0 && args[exIdx + 1] && args[exIdx + 2]) {
  extractArchive(args[exIdx + 1], args[exIdx + 2]);
  console.log('extracted to ' + args[exIdx + 2]);
  process.exit(0);
}

// ================================================================ HTTP
function send(res, code, body, contentType) {
  const buf = Buffer.from(body);
  res.writeHead(code, {
    'Content-Type': contentType || 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
  });
  res.end(buf);
}
function sendJSON(res, code, obj) { send(res, code, JSON.stringify(obj)); }

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > (limit || 65536)) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://' + (req.headers.host || '127.0.0.1'));
    const p = u.pathname;
    const m = req.method;

    if (p === '/favicon.svg') return send(res, 200, FAVICON, 'image/svg+xml');
    if (p === '/' && m === 'GET') {
      return send(res, 200, PAGE, 'text/html; charset=utf-8');
    }
    if (p === '/api/status' && m === 'GET') return sendJSON(res, 200, await getStatus());
    if (p === '/api/env' && m === 'GET') return sendJSON(res, 200, await getEnv());
    if (p === '/api/config' && m === 'GET') {
      return sendJSON(res, 200, {
        config: config,
        paths: { dataDir: DATA_DIR, config: CONFIG_PATH, state: STATE_PATH, log: LOG_PATH },
        version: VERSION,
      });
    }
    if (p === '/api/config' && m === 'POST') {
      const body = JSON.parse(await readBody(req) || '{}');
      return sendJSON(res, 200, { ok: true, config: setConfig(body) });
    }
    if (p === '/api/update' && m === 'GET') {
      const fresh = await checkUpdate(updateCache.checkedAt === 0);
      return sendJSON(res, 200, Object.assign({ current: VERSION, source: updateSource() }, fresh));
    }
    if (p === '/api/update/check' && m === 'POST') {
      const fresh = await checkUpdate(true);
      return sendJSON(res, 200, Object.assign({ current: VERSION, source: updateSource() }, fresh));
    }
    if (p === '/api/start' && m === 'POST') return sendJSON(res, 200, await startDsh());
    if (p === '/api/stop' && m === 'POST') return sendJSON(res, 200, await stopDsh());
    if (p === '/api/log' && m === 'GET') {
      const lines = Math.min(Number(u.searchParams.get('lines')) || 200, 1000);
      return sendJSON(res, 200, { log: tailLog(lines), path: LOG_PATH });
    }
    if (p === '/api/log-clear' && m === 'POST') {
      fs.writeFileSync(LOG_PATH, '');
      return sendJSON(res, 200, { ok: true });
    }
    if (p === '/api/install' && m === 'POST') {
      if (installJob && installJob.running) return sendJSON(res, 409, { error: '安装已在进行中' });
      const body = JSON.parse(await readBody(req) || '{}');
      runInstall(body);
      return sendJSON(res, 200, { ok: true });
    }
    if (p === '/api/install/status' && m === 'GET') return sendJSON(res, 200, installSnapshot());
    if (p === '/api/install/cancel' && m === 'POST') return sendJSON(res, 200, cancelInstall());
    sendJSON(res, 404, { error: 'not found' });
  } catch (e) {
    sendJSON(res, 500, { error: String(e && e.message || e) });
  }
});

server.listen(UI_PORT, UI_HOST, () => {
  console.log('dsh-launcher v' + VERSION + ' listening on http://' + UI_HOST + ':' + UI_PORT);
  if (!NO_OPEN) {
    setTimeout(() => openUrl(PANEL_URL()), 600);
  }
});
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    if (!NO_OPEN) openUrl(PANEL_URL());
    process.exit(0);
  }
  console.error('failed to listen:', err.message);
  process.exit(1);
});

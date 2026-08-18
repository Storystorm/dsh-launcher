#!/usr/bin/env node
'use strict';
/* 黑鲸启动器 · 遥控中继服务(零依赖)
 * 职责:微信小程序 wx.login 换 openid、配对码绑定启动器、遥控命令转发
 * 运行: WX_APPID=xxx WX_SECRET=xxx PORT=8790 node relay-server.js
 * 开发模式: 不配 WX_APPID 时,/api/wx/login 直接把 code 当 openid 用(dev_<code>)
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.HOST || '0.0.0.0';
const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET = process.env.WX_SECRET || '';
const DATA_FILE = process.env.RELAY_DATA || path.join(__dirname, 'relay-data.json');
const PAIR_TTL_MS = 10 * 60 * 1000;
const POLL_MAX_MS = 25000;
const CMD_WAIT_MS = 15000;

function loadJSON(file, fallback) {
  try { return Object.assign({}, fallback, JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch (e) { return Object.assign({}, fallback); }
}
function saveJSON(file, obj) {
  try { fs.writeFileSync(file, JSON.stringify(obj, null, 2)); } catch (e) {}
}
// users: { openid: { token, nickname, avatar, launchers: [launcherId], at } }
// launchers: { id: { name, token, boundTo, online, lastSeen, boundAt } }
const db = loadJSON(DATA_FILE, { users: {}, launchers: {} });
// 仅内存:配对码与待执行命令
const pairs = {};    // code -> { pairToken, launcherId, exp }
const pairIdx = {};  // pairToken -> code
const queues = {};   // launcherId -> [{id, method, payload}]
const pending = {};  // cmdId -> { resolve, timer }
const waits = {};    // launcherId -> [res] 长轮询挂起

const rid = (n) => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();

function send(res, code, obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(buf);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(b));
    req.on('error', reject);
  });
}
function authUser(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  for (const openid of Object.keys(db.users)) {
    if (db.users[openid].token === t) return { openid: openid, user: db.users[openid] };
  }
  return null;
}
function wxCode2Session(code) {
  return new Promise((resolve, reject) => {
    if (!WX_APPID || !WX_SECRET) {
      return resolve({ openid: 'dev_' + String(code).slice(0, 24) });
    }
    const u = 'https://api.weixin.qq.com/sns/jscode2session?appid=' + WX_APPID +
      '&secret=' + WX_SECRET + '&js_code=' + encodeURIComponent(code) + '&grant_type=authorization_code';
    https.get(u, { timeout: 8000 }, res => {
      let b = '';
      res.on('data', c => { b += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(b);
          if (j.openid) resolve(j);
          else reject(new Error(j.errmsg || ('微信登录失败 ' + (j.errcode || '未知'))));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}
function findLauncherByToken(t) {
  for (const id of Object.keys(db.launchers)) {
    if (db.launchers[id].token === t) return { id: id, l: db.launchers[id] };
  }
  return null;
}
function flushWaiter(launcherId) {
  const list = waits[launcherId];
  if (!list || !list.length) return;
  const q = queues[launcherId] || [];
  while (list.length) {
    const res = list.shift();
    send(res, 200, { commands: q.splice(0, q.length) });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    const m = req.method;
    if (m === 'OPTIONS') return send(res, 204, {});
    if (p === '/api/health') return send(res, 200, { ok: true, launchers: Object.keys(db.launchers).length, users: Object.keys(db.users).length });

    // ---- 小程序:微信登录 ----
    if (p === '/api/wx/login' && m === 'POST') {
      const body = JSON.parse(await readBody(req) || '{}');
      if (!body.code) return send(res, 400, { error: '缺少 code' });
      const j = await wxCode2Session(String(body.code));
      const openid = j.openid;
      const user = db.users[openid] || { nickname: '微信用户', avatar: '', launchers: [], at: now() };
      user.token = rid(24);
      db.users[openid] = user;
      saveJSON(DATA_FILE, db);
      return send(res, 200, { token: user.token, openid: openid, nickname: user.nickname, avatar: user.avatar });
    }
    if (p === '/api/wx/profile' && m === 'POST') {
      const a = authUser(req);
      if (!a) return send(res, 401, { error: '未登录' });
      const body = JSON.parse(await readBody(req) || '{}');
      if (body.nickname) a.user.nickname = String(body.nickname).slice(0, 32);
      if (body.avatar) a.user.avatar = String(body.avatar).slice(0, 300);
      saveJSON(DATA_FILE, db);
      return send(res, 200, { ok: true });
    }

    // ---- 启动器:配对 ----
    if (p === '/api/pair/create' && m === 'POST') {
      for (const c of Object.keys(pairs)) {
        if (pairs[c].exp < now()) { delete pairIdx[pairs[c].pairToken]; delete pairs[c]; }
      }
      const body = JSON.parse(await readBody(req) || '{}');
      const code = String(crypto.randomInt(100000, 999999));
      const pairToken = rid(16);
      const launcherId = 'L' + rid(8);
      pairs[code] = { pairToken: pairToken, launcherId: launcherId, name: String(body.name || '黑鲸启动器'), exp: now() + PAIR_TTL_MS };
      pairIdx[pairToken] = code;
      return send(res, 200, { pairCode: code, pairToken: pairToken, expiresIn: PAIR_TTL_MS / 1000 });
    }
    if (p === '/api/pair/status' && m === 'GET') {
      const code = pairIdx[String(u.searchParams.get('pairToken') || '')];
      const rec = code && pairs[code];
      if (!rec) return send(res, 200, { paired: false, expired: true });
      const l = db.launchers[rec.launcherId];
      if (l && l.boundTo) {
        const usr = db.users[l.boundTo] || {};
        return send(res, 200, { paired: true, launcherToken: l.token, launcherId: rec.launcherId, user: { openid: l.boundTo, nickname: usr.nickname || '微信用户', avatar: usr.avatar || '' } });
      }
      if (rec.exp < now()) return send(res, 200, { paired: false, expired: true });
      return send(res, 200, { paired: false });
    }

    // ---- 小程序:扫码绑定 ----
    if (p === '/api/pair/bind' && m === 'POST') {
      const a = authUser(req);
      if (!a) return send(res, 401, { error: '未登录' });
      const body = JSON.parse(await readBody(req) || '{}');
      const rec = pairs[String(body.pairCode || '')];
      if (!rec || rec.consumed || rec.exp < now()) return send(res, 400, { error: '配对码无效或已过期' });
      const launcherId = rec.launcherId;
      const l = db.launchers[launcherId] || { name: rec.name, online: false, lastSeen: 0 };
      l.name = rec.name;
      l.token = rid(24);
      l.boundTo = a.openid;
      l.boundAt = now();
      db.launchers[launcherId] = l;
      if (a.user.launchers.indexOf(launcherId) < 0) a.user.launchers.push(launcherId);
      rec.consumed = true;
      rec.exp = now() + 60000;
      saveJSON(DATA_FILE, db);
      return send(res, 200, { ok: true, launcherId: launcherId, launcherName: l.name });
    }

    // ---- 小程序:我的启动器 ----
    if (p === '/api/relay/status' && m === 'GET') {
      const a = authUser(req);
      if (!a) return send(res, 401, { error: '未登录' });
      const list = (a.user.launchers || []).map(id => {
        const l = db.launchers[id];
        return l ? { id: id, name: l.name, online: l.online && (now() - l.lastSeen < 60000), boundAt: l.boundAt || 0 } : null;
      }).filter(Boolean);
      return send(res, 200, { launchers: list, user: { openid: a.openid, nickname: a.user.nickname, avatar: a.user.avatar } });
    }
    if (p === '/api/relay/unbind' && m === 'POST') {
      const a = authUser(req);
      if (!a) return send(res, 401, { error: '未登录' });
      const body = JSON.parse(await readBody(req) || '{}');
      const id = String(body.launcherId || '');
      if (db.launchers[id] && db.launchers[id].boundTo === a.openid) {
        delete db.launchers[id];
        a.user.launchers = (a.user.launchers || []).filter(x => x !== id);
        saveJSON(DATA_FILE, db);
      }
      return send(res, 200, { ok: true });
    }

    // ---- 小程序:下发命令(同步等待结果) ----
    if (p === '/api/relay/cmd' && m === 'POST') {
      const a = authUser(req);
      if (!a) return send(res, 401, { error: '未登录' });
      const body = JSON.parse(await readBody(req) || '{}');
      const id = String(body.launcherId || (a.user.launchers || [])[0] || '');
      const l = db.launchers[id];
      if (!l || l.boundTo !== a.openid) return send(res, 404, { error: '启动器不存在或未绑定' });
      if (!l.online || now() - l.lastSeen > 60000) return send(res, 503, { error: '启动器不在线(请在电脑上打开黑鲸启动器并连接远程遥控)' });
      const cmdId = rid(12);
      const cmd = { id: cmdId, method: String(body.method || ''), payload: body.payload || {} };
      queues[id] = queues[id] || [];
      queues[id].push(cmd);
      flushWaiter(id);
      const timeout = Math.min(Number(body.waitMs) || CMD_WAIT_MS, 30000);
      const result = await new Promise(resolve => {
        pending[cmdId] = { resolve: resolve };
        pending[cmdId].timer = setTimeout(() => {
          delete pending[cmdId];
          resolve({ ok: false, error: '等待启动器响应超时' });
        }, timeout + 1000);
      });
      return send(res, result.ok ? 200 : 504, result);
    }

    // ---- 启动器:长轮询取命令 ----
    if (p === '/api/relay/poll' && m === 'GET') {
      const f = findLauncherByToken(String(u.searchParams.get('launcherToken') || ''));
      if (!f) return send(res, 401, { error: 'launcherToken 无效' });
      f.l.online = true;
      f.l.lastSeen = now();
      const q = queues[f.id] || [];
      if (q.length) return send(res, 200, { commands: q.splice(0, q.length) });
      waits[f.id] = waits[f.id] || [];
      waits[f.id].push(res);
      req.on('close', () => {
        const i = (waits[f.id] || []).indexOf(res);
        if (i >= 0) waits[f.id].splice(i, 1);
      });
      setTimeout(() => {
        const i = (waits[f.id] || []).indexOf(res);
        if (i >= 0) {
          waits[f.id].splice(i, 1);
          send(res, 200, { commands: [] });
        }
      }, POLL_MAX_MS);
      return;
    }
    // ---- 启动器:回传结果 ----
    if (p === '/api/relay/result' && m === 'POST') {
      const body = JSON.parse(await readBody(req) || '{}');
      const f = findLauncherByToken(String(body.launcherToken || ''));
      if (!f) return send(res, 401, { error: 'launcherToken 无效' });
      f.l.online = true;
      f.l.lastSeen = now();
      for (const r of (body.results || [])) {
        const pend = pending[r.id];
        if (pend) {
          clearTimeout(pend.timer);
          delete pending[r.id];
          pend.resolve(r);
        }
      }
      return send(res, 200, { ok: true });
    }
    // ---- 启动器:主动解绑 ----
    if (p === '/api/relay/launcher-unbind' && m === 'POST') {
      const body = JSON.parse(await readBody(req) || '{}');
      const f = findLauncherByToken(String(body.launcherToken || ''));
      if (!f) return send(res, 401, { error: 'launcherToken 无效' });
      const usr = db.users[f.l.boundTo];
      if (usr) usr.launchers = (usr.launchers || []).filter(x => x !== f.id);
      delete db.launchers[f.id];
      saveJSON(DATA_FILE, db);
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 500, { error: String(e && e.message || e) });
  }
});
server.listen(PORT, HOST, () => {
  console.log('dsh-relay listening on http://' + HOST + ':' + PORT + (WX_APPID ? ' (微信登录已配置)' : ' (开发模式:无 WX_APPID)'));
});

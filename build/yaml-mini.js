'use strict';
// 极简 YAML 子集解析器(零依赖):
// 支持 注释(#)、嵌套 map(缩进)、列表(-)、单/双引号字符串、数字/布尔/null、行内数组 [a, b] 与行内 map {k: v}
// 不支持:锚点/别名、多行字符串(| 与 >)、!!js 等类型标签(遇到会原样保留为字符串)
const yamlMini = (() => {
  function splitComment(line) {
    let q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '\\') { i++; continue; }
        if (c === q) q = null;
        continue;
      }
      if (c === "'" || c === '"') { q = c; continue; }
      if (c === '#') return line.slice(0, i);
    }
    return line;
  }
  function parseScalar(s) {
    s = String(s).trim();
    if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
    if (s === 'true' || s === 'True' || s === 'TRUE') return true;
    if (s === 'false' || s === 'False' || s === 'FALSE') return false;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    if (s[0] === "'" && s[s.length - 1] === "'") return s.slice(1, -1).replace(/''/g, "'");
    if (s[0] === '"' && s[s.length - 1] === '"') {
      return s.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    if (s[0] === '[' && s[s.length - 1] === ']') {
      const inner = s.slice(1, -1).trim();
      if (!inner) return [];
      return splitTop(inner).map(parseScalar);
    }
    if (s[0] === '{' && s[s.length - 1] === '}') {
      const inner = s.slice(1, -1).trim();
      const out = {};
      if (!inner) return out;
      for (const part of splitTop(inner)) {
        const kv = splitKey(part);
        if (kv) out[kv[0]] = parseScalar(kv[1]);
      }
      return out;
    }
    if (/^!!\w+\b/.test(s)) return s;  // 类型标签原样保留(如 !!js ...)
    return s;
  }
  function splitTop(s) {
    const parts = [];
    let depth = 0, q = null, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === '\\') { cur += c + (s[i + 1] || ''); i++; continue; }
        if (c === q) q = null;
        cur += c;
        continue;
      }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === '[' || c === '{') depth++;
      if (c === ']' || c === '}') depth--;
      if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }
  function splitKey(s) {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === '\\') { i++; continue; }
        if (c === q) q = null;
        continue;
      }
      if (c === "'" || c === '"') { q = c; continue; }
      if (c === ':' && (i === s.length - 1 || s[i + 1] === ' ' || s[i + 1] === '\t')) {
        const key = s.slice(0, i).trim().replace(/^['"]|['"]$/g, '');
        const val = s.slice(i + 1).trim();
        return [key, val];
      }
    }
    return null;
  }
  function parse(text) {
    const lines = [];
    for (const raw of String(text).split(/\r?\n/)) {
      const noComment = splitComment(raw);
      if (!noComment.trim()) continue;
      const m = noComment.match(/^(\s*)(.*)$/);
      lines.push({ indent: m[1].length, content: m[2].trim() });
    }
    const root = {};
    // frame = {indent, container, key}: key 非空表示 container[key] 是待填充的占位
    const stack = [{ indent: -1, container: root, key: null }];
    const cur = () => {
      const f = stack[stack.length - 1];
      if (f.key === null) return f.container;
      if (f.container[f.key] === null || f.container[f.key] === undefined) f.container[f.key] = {};
      return f.container[f.key];
    };
    for (const line of lines) {
      while (stack.length > 1 && line.indent <= stack[stack.length - 1].indent) stack.pop();
      const top = stack[stack.length - 1];
      if (line.content.startsWith('- ')) {
        const holder = top.key === null ? top.container : (() => {
          if (top.container[top.key] === null || top.container[top.key] === undefined) top.container[top.key] = [];
          return top.container[top.key];
        })();
        if (!Array.isArray(holder)) throw new Error('列表项出现在非列表位置: ' + line.content);
        const itemText = line.content.slice(2).trim();
        const kv = splitKey(itemText);
        if (itemText === '') {
          const obj = {};
          holder.push(obj);
          stack.push({ indent: line.indent, container: obj, key: null });
        } else if (kv && kv[1] === '') {
          const obj = {};
          holder.push(obj);
          obj[kv[0]] = null;
          stack.push({ indent: line.indent, container: obj, key: kv[0] });
        } else if (kv) {
          const obj = {};
          obj[kv[0]] = parseScalar(kv[1]);
          holder.push(obj);
          stack.push({ indent: line.indent, container: obj, key: null });
        } else {
          holder.push(parseScalar(itemText));
          stack.push({ indent: line.indent, container: holder, key: null });
        }
        continue;
      }
      const kv = splitKey(line.content);
      if (!kv) throw new Error('无法解析行: ' + line.content);
      const container = cur();
      if (kv[1] === '') {
        container[kv[0]] = null;
        stack.push({ indent: line.indent, container: container, key: kv[0] });
      } else {
        container[kv[0]] = parseScalar(kv[1]);
        stack.push({ indent: line.indent, container: container, key: kv[0] });
      }
    }
    return root;
  }
  return { parse: parse, parseScalar: parseScalar };
})();
module.exports = yamlMini;

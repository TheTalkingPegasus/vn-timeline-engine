// Formeln und Code (0.9.16): kleine, sichere Rechensprache für Bedingungen („Nur wenn …“) und die Code-Spur.
//   Bedingung:  gold >= 10 and not tür_offen        [Kapitel 2 fertig] == wahr        item("Schlüssel") > 0
//   Code:       gold += 5          mut = mut * 2 + 1          if gold > 100: [Reich] = wahr
//               give("Schlüssel")  take("Heiltrank", 2)       earn("Gold", 10)   spend("Gold", 3)   goto("Hub")
// Variablen über ihren Namen (Groß/klein egal, Leerzeichen = _) oder in eckigen Klammern: [Name mit Leerzeichen].
// Kein JavaScript – nur Zahlen, Text, wahr/falsch, Rechnen, Vergleichen und die Funktionen unten.
(function () {
  // Fehlermeldung in der Sprache der Oberfläche
  const Er = (msg, x) => new Error(VN.tf ? VN.tf(msg, { x: x == null ? '' : String(x) }) : msg.replace('{x}', x));
  const ID0 = /[\p{L}_]/u, IDN = /[\p{L}\p{N}_]/u; // alle Buchstaben (auch ñ, é, 日本語)
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '_');

  function lex(src) {
    const out = [];
    let i = 0;
    const s = String(src);
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '#') { while (i < s.length && s[i] !== '\n') i++; continue; } // Kommentar
      if (c === '\n' || c === ';') { out.push({ t: 'end' }); i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1]))) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; out.push({ t: 'num', v: Number(s.slice(i, j)) }); i = j; continue; }
      if (c === '"' || c === "'" || c === '„' || c === '“') {
        const close = c === '„' ? '“' : c; let j = i + 1, v = '';
        while (j < s.length && s[j] !== close && !(c === '“' && s[j] === '”')) { v += s[j]; j++; }
        if (j >= s.length) throw Er('Text ohne schließendes Anführungszeichen');
        out.push({ t: 'str', v }); i = j + 1; continue;
      }
      if (c === '[') { const j = s.indexOf(']', i); if (j < 0) throw Er('„[“ ohne „]“'); out.push({ t: 'id', v: s.slice(i + 1, j), br: true }); i = j + 1; continue; }
      if (ID0.test(c)) { let j = i; while (j < s.length && IDN.test(s[j])) j++; const w = s.slice(i, j); const lw = w.toLowerCase(); i = j;
        if (lw === 'and' || lw === 'und') out.push({ t: 'op', v: '&&' }); else if (lw === 'or' || lw === 'oder') out.push({ t: 'op', v: '||' }); else if (lw === 'not' || lw === 'nicht') out.push({ t: 'op', v: '!' });
        else if (lw === 'if' || lw === 'wenn') out.push({ t: 'if' });
        else out.push({ t: 'id', v: w });
        continue; }
      const two = s.slice(i, i + 2), three = s.slice(i, i + 3);
      if (three === '**=') { out.push({ t: 'op', v: '**=' }); i += 3; continue; }
      if (['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '**'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
      if ('+-*/%<>!=(),:'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
      if (c === '$') { i++; continue; } // Ren'Py-Gewohnheit: „$ gold += 5“
      throw Er('Unbekanntes Zeichen „{x}“', c);
    }
    out.push({ t: 'end' });
    return out;
  }

  // Ausdruck → Baum (Vorrang wie gewohnt)
  const PREC = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '**': 7 };
  function parser(toks) {
    let p = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const expect = (v) => { const t = next(); if (!t || t.v !== v) throw Er('„{x}“ erwartet', v); };
    const primary = () => {
      const t = next();
      if (!t || t.t === 'end') throw Er('Ausdruck unvollständig');
      if (t.t === 'num') return { k: 'lit', v: t.v };
      if (t.t === 'str') return { k: 'lit', v: t.v };
      if (t.t === 'op' && t.v === '(') { const e = expr(0); expect(')'); return e; }
      if (t.t === 'op' && (t.v === '-' || t.v === '+')) return { k: 'un', op: t.v, a: unary() };
      if (t.t === 'op' && t.v === '!') return { k: 'un', op: '!', a: unary() };
      if (t.t === 'id') {
        const lw = t.v.toLowerCase();
        if (!t.br && (lw === 'true' || lw === 'wahr' || lw === 'ja')) return { k: 'lit', v: true };
        if (!t.br && (lw === 'false' || lw === 'falsch' || lw === 'nein')) return { k: 'lit', v: false };
        if (!t.br && peek() && peek().v === '(') {
          next(); const args = [];
          if (peek().v !== ')') { args.push(expr(0)); while (peek().v === ',') { next(); args.push(expr(0)); } }
          expect(')');
          return { k: 'call', f: lw, args };
        }
        return { k: 'var', name: t.v };
      }
      throw Er('Unerwartet: „{x}“', t.v != null ? t.v : t.t);
    };
    const unary = () => primary();
    const expr = (min) => {
      let a = unary();
      for (;;) {
        const t = peek();
        if (!t || t.t !== 'op' || PREC[t.v] == null || PREC[t.v] < min) return a;
        next();
        const b = expr(t.v === '**' ? PREC[t.v] : PREC[t.v] + 1);
        a = { k: 'bin', op: t.v, a, b };
      }
    };
    // Anweisung: Zuweisung, Funktionsaufruf, „if Bedingung: Anweisung“
    const stmt = () => {
      const t = peek();
      if (t.t === 'if') { next(); const c = expr(0); expect(':'); return { k: 'if', c, s: stmt() }; }
      if (t.t === 'id' && toks[p + 1] && toks[p + 1].t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '**='].includes(toks[p + 1].v)) {
        next(); const op = next().v; return { k: 'set', name: t.v, op, e: expr(0) };
      }
      return { k: 'do', e: expr(0) };
    };
    return { expr, stmt, peek, next, at: () => p };
  }

  // ---------- Auswerten ----------
  const P = () => VN.project;
  const findVar = (name) => { const n = norm(name); return (P().vars || []).find((v) => norm(v.name) === n || v.id === name) || null; };
  const byName = (list, name) => { const n = norm(name); return (list || []).find((x) => norm(x.name) === n || x.id === name) || null; };
  const num = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0);
  const FUNCS = {
    min: (a, ...r) => Math.min(num(a), ...r.map(num)), max: (a, ...r) => Math.max(num(a), ...r.map(num)),
    round: (a) => Math.round(num(a)), floor: (a) => Math.floor(num(a)), ceil: (a) => Math.ceil(num(a)), abs: (a) => Math.abs(num(a)),
    random: (a, b) => { const lo = Math.ceil(num(a)), hi = Math.floor(num(b)); return lo + Math.floor(Math.random() * (hi - lo + 1)); },
    chance: (pct) => Math.random() * 100 < num(pct),
    item: (name, rs) => { const it = byName(P().items, name); if (!it) throw Er('Gegenstand „{x}“ gibt es nicht', name); return (rs.inv || {})[it.id] || 0; },
    money: (name, rs) => { const c = name ? byName(P().currencies, name) : (P().currencies || [])[0]; if (!c) throw Er('Währung „{x}“ gibt es nicht', name || ''); return (rs.money || {})[c.id] || 0; },
    seen: (name, rs) => { const s = byName(P().scenes, name); if (!s) throw Er('Szene „{x}“ gibt es nicht', name); return !!(rs.seen || {})[s.id]; }
  };
  const ACTS = ['give', 'take', 'earn', 'spend', 'goto'];
  function ev(n, rs, ctx) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'var': {
        const v = findVar(n.name);
        if (!v) throw Er('Variable „{x}“ gibt es nicht', n.name);
        const cur = (rs.vars || {})[v.id];
        return v.type === 'flag' ? !!cur : cur == null ? (v.start != null ? v.start : 0) : cur;
      }
      case 'un': { const a = ev(n.a, rs, ctx); return n.op === '!' ? !a : n.op === '-' ? -num(a) : num(a); }
      case 'bin': {
        if (n.op === '&&') return !!ev(n.a, rs, ctx) && !!ev(n.b, rs, ctx);
        if (n.op === '||') return !!ev(n.a, rs, ctx) || !!ev(n.b, rs, ctx);
        const a = ev(n.a, rs, ctx), b = ev(n.b, rs, ctx);
        switch (n.op) {
          case '+': return typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : num(a) + num(b);
          case '-': return num(a) - num(b); case '*': return num(a) * num(b);
          case '/': return num(b) === 0 ? 0 : num(a) / num(b); case '%': return num(b) === 0 ? 0 : num(a) % num(b);
          case '**': return Math.pow(num(a), num(b));
          case '==': return typeof a === 'boolean' || typeof b === 'boolean' ? !!a === !!b : (typeof a === 'string' || typeof b === 'string' ? String(a) === String(b) : num(a) === num(b));
          case '!=': return !ev({ k: 'bin', op: '==', a: { k: 'lit', v: a }, b: { k: 'lit', v: b } }, rs, ctx);
          case '<': return num(a) < num(b); case '<=': return num(a) <= num(b); case '>': return num(a) > num(b); case '>=': return num(a) >= num(b);
        }
        throw Er('Unbekannter Operator {x}', n.op);
      }
      case 'call': {
        const args = n.args.map((x) => ev(x, rs, ctx));
        if (FUNCS[n.f]) return ['item', 'money', 'seen'].includes(n.f) ? FUNCS[n.f](args[0], rs) : FUNCS[n.f](...args);
        if (ACTS.includes(n.f)) { if (!ctx || !ctx.act) throw Er('„{x}“ geht nur im Code, nicht in einer Bedingung', n.f); return ctx.act(n.f, args); }
        throw Er('Unbekannte Funktion „{x}()“', n.f);
      }
    }
    throw Er('Kaputter Ausdruck');
  }

  const F = (VN.Formula = {
    FUNCS: Object.keys(FUNCS).concat(ACTS),
    // Bedingung prüfen → true/false (Fehler = nicht erfüllt)
    check(src, rs) { try { return !!F.eval(src, rs); } catch (e) { return false; } },
    eval(src, rs) {
      const toks = lex(src), ps = parser(toks);
      const e = ps.expr(0);
      while (ps.peek() && ps.peek().t === 'end' && ps.at() < toks.length - 1) ps.next();
      if (ps.peek() && ps.peek().t !== 'end') throw Er('Unerwartet: „{x}“', ps.peek().v);
      return ev(e, rs || {}, null);
    },
    // Was an einer Formel kaputt ist (Syntax, unbekannte Variablen …) – mit einem Probe-Spielstand
    problem(src, code) {
      if (!String(src || '').trim()) return 'Leer';
      try {
        const rs = F.probeRs();
        if (code) F.run(src, rs, { dry: true }); else F.eval(src, rs);
        return null;
      } catch (e) { return e.message; }
    },
    probeRs() {
      const p = P(), rs = { vars: {}, inv: {}, money: {}, seen: {} };
      for (const v of p.vars || []) rs.vars[v.id] = v.start != null ? v.start : (v.type === 'flag' ? false : 0);
      return rs;
    },
    // Code ausführen (Zeile für Zeile); out: Meldungen für die Fundmeldung (Gegenstände, Geld)
    run(src, rs, o = {}) {
      const lines = String(src || '').split('\n');
      const gains = [];
      const act = (f, args) => {
        if (f === 'goto') { const s = byName(P().scenes, args[0]); if (!s) throw Er('Szene „{x}“ gibt es nicht', args[0]); if (!o.dry && VN.ext.actions.goto) VN.ext.actions.goto.apply({ scene: s.id }, rs); return true; }
        if (f === 'give' || f === 'take') { const it = byName(P().items, args[0]); if (!it) throw Er('Gegenstand „{x}“ gibt es nicht', args[0]); const n = args.length > 1 ? Math.round(num(args[1])) : 1; rs.inv = rs.inv || {}; if (f === 'give' && VN.giveItem && !o.dry) VN.giveItem(rs, it.id, n); else { rs.inv[it.id] = Math.max(0, (rs.inv[it.id] || 0) + (f === 'give' ? n : -n)); if (!rs.inv[it.id]) delete rs.inv[it.id]; } if (f === 'give' && n > 0) gains.push({ kind: 'item', id: it.id, count: n }); return true; }
        if (f === 'earn' || f === 'spend') { const c = byName(P().currencies, args[0]); if (!c) throw Er('Währung „{x}“ gibt es nicht', args[0]); const n = Math.round(num(args[1])); rs.money = rs.money || {}; rs.money[c.id] = Math.max(0, (rs.money[c.id] || 0) + (f === 'earn' ? n : -n)); if (f === 'earn' && n > 0) gains.push({ kind: 'money', id: c.id, count: n }); return true; }
        return false;
      };
      lines.forEach((line, li) => {
        if (!line.replace(/#.*/, '').trim()) return;
        try {
          const toks = lex(line), ps = parser(toks);
          const exec = (st) => {
            if (st.k === 'if') { if (ev(st.c, rs, { act })) exec(st.s); return; }
            if (st.k === 'do') { ev(st.e, rs, { act }); return; }
            const v = findVar(st.name);
            if (!v) throw Er('Variable „{x}“ gibt es nicht', st.name);
            rs.vars = rs.vars || {};
            const cur = v.type === 'flag' ? !!rs.vars[v.id] : rs.vars[v.id] == null ? 0 : rs.vars[v.id];
            let val = ev(st.e, rs, { act });
            if (st.op !== '=') { const o2 = st.op.slice(0, -1); val = ev({ k: 'bin', op: o2, a: { k: 'lit', v: cur }, b: { k: 'lit', v: val } }, rs, { act }); }
            if (v.type === 'flag') val = !!val;
            else if (v.type !== 'text' && typeof val !== 'string') { val = num(val); if (v.min != null && v.min !== '') val = Math.max(Number(v.min), val); if (v.max != null && v.max !== '') val = Math.min(Number(v.max), val); }
            rs.vars[v.id] = val;
          };
          while (ps.peek() && ps.peek().t !== 'end') {
            exec(ps.stmt());
            if (ps.peek() && ps.peek().t !== 'end') throw Er('Nach der Anweisung steht noch etwas: „{x}“', ps.peek().v);
          }
        } catch (e) { const er = new Error(VN.tf('Zeile {n}', { n: li + 1 }) + ': ' + e.message); er.line = li + 1; throw er; }
      });
      return gains;
    },
    // Variablennamen, die eine Formel benutzt und die es nicht gibt (für „anlegen“-Knöpfe)
    missingVars(src) {
      const out = new Set();
      try { for (const t of lex(src)) if (t.t === 'id' && !findVar(t.v) && !FUNCS[t.v.toLowerCase()] && !ACTS.includes(t.v.toLowerCase()) && !['true', 'false', 'wahr', 'falsch', 'ja', 'nein'].includes(t.v.toLowerCase())) out.add(t.v); } catch (e) { /* Syntaxfehler zeigt problem() */ }
      return [...out];
    }
  });

  // ---------- Bedingung „Formel“ ----------
  const editor = (o, key, code, rows) => {
    const { el } = VN;
    const msg = el('div', { class: 'muted small fx-msg' });
    const upd = (v) => {
      const pr = F.problem(v, code);
      msg.textContent = pr ? '⚠ ' + pr : '✓ ' + VN.t('in Ordnung');
      msg.className = 'small fx-msg ' + (pr ? 'bad' : 'ok');
      msg.querySelectorAll('button').forEach((b) => b.remove());
      for (const name of F.missingVars(v)) msg.appendChild(el('button', { class: 'btn tiny', title: VN.t('Als Zahl-Variable anlegen (Start 0)'), onclick: () => VN.mutate(() => { P().vars.push({ id: VN.uid('v'), name: name.replace(/_/g, ' '), type: 'number', start: 0, note: '' }); }) }, '+ ' + name));
    };
    const ta = el(rows > 1 ? 'textarea' : 'input', Object.assign({ class: 'small-input code-input', spellcheck: false, value: o[key] || '', placeholder: VN.t(code ? 'gold += 5\nif gold > 100: [Reich] = wahr\ngive("Schlüssel")' : 'gold >= 10 and not tür_offen'), oninput: (e) => upd(e.target.value), onchange: (e) => VN.mutate(() => { o[key] = e.target.value; }) }, rows > 1 ? { rows } : { type: 'text' }));
    if (rows > 1) ta.value = o[key] || '';
    upd(o[key] || '');
    return [ta, msg];
  };
  F.editor = editor;
  VN.registerCond('formula', {
    label: '🧮 Formel',
    make: () => ({ expr: '' }),
    check: (c, rs) => F.check(c.expr, rs),
    text: (c) => '🧮 ' + (c.expr || '?'),
    problem: (c) => { const pr = F.problem(c.expr, false); return pr ? 'Formel: ' + pr : null; },
    row: (row, c) => { const [ta, msg] = editor(c, 'expr', false, 1); ta.style.flex = '1'; ta.style.minWidth = '220px'; row.append(ta, msg); }
  });
  // ---------- Aktion „Code“ (in Dialogen, Antworten, Hub-Objekten) ----------
  VN.registerAction('code', {
    label: '🧮 Rechnen / Code',
    make: () => ({ code: '' }),
    apply: (a, rs, gains) => { try { const g = F.run(a.code, rs); if (gains && g.length) gains.push(...g); } catch (e) { console.error('Code', e); if (window.Player && Player.running && VN.toast) VN.toast('⚠ ' + e.message); } },
    text: (a) => '🧮 ' + String(a.code || '').split('\n')[0].slice(0, 40),
    problem: (a) => { const pr = F.problem(a.code, true); return pr ? 'Code: ' + pr : null; },
    row: (row, a) => { const [ta, msg] = editor(a, 'code', true, 3); ta.style.width = '100%'; row.append(el2('div', { style: { width: '100%' } }, ta, msg)); }
  });
  const el2 = (...x) => VN.el(...x);
})();

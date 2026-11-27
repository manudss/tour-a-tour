/* Logique pure de l'application Tour de parole : testable sans interface. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TPLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return 'p' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }

  /* ---------- Session ---------- */
  function newSession(people, durationMs, now) {
    var s = {
      id: 's' + now.toString(36), startedAt: now, durationMs: durationMs,
      people: people.map(function (p) { return { id: p.id, name: p.name, avatar: p.avatar, guest: !!p.guest }; }),
      totals: {}, counts: {}, lastEnd: {}, current: null, round: 1, passed: [], skip: 0
    };
    s.people.forEach(function (p) { s.totals[p.id] = 0; s.counts[p.id] = 0; });
    return s;
  }

  function elapsedCurrent(s, now) {
    if (!s.current) return 0;
    return s.current.acc + (s.current.resumedAt != null ? Math.max(0, now - s.current.resumedAt) : 0);
  }
  function totalMs(s, pid, now) {
    return (s.totals[pid] || 0) + (s.current && s.current.pid === pid ? elapsedCurrent(s, now) : 0);
  }
  function isRunning(s) { return !!(s.current && s.current.resumedAt != null); }

  function commitCurrent(s, now) {
    if (!s.current) return;
    var pid = s.current.pid, ms = elapsedCurrent(s, now);
    s.totals[pid] = (s.totals[pid] || 0) + ms;
    if (ms >= 1000) s.counts[pid] = (s.counts[pid] || 0) + 1;
    s.lastEnd[pid] = now;
    s.last = pid;
    s.current = null;
  }

  /* Classement des personnes proposées par « Personne suivante ».
     Règle : on parle par tours. Dans un tour, chacun passe une fois. On propose d'abord
     ceux qui ne sont pas encore passés dans ce tour, le moins de temps cumulé en premier
     (jamais parlé = 0). Égalité : celui qui attend depuis le plus longtemps.
     Quand tout le monde est passé, un nouveau tour commence : tout le monde est reproposé. */
  function rank(s, now) {
    var cur = s.current ? s.current.pid : null;
    var lastSpeaker = cur || s.last || null;
    var present = s.people.map(function (p) { return p.id; });
    var eligible = present.filter(function (id) { return s.passed.indexOf(id) < 0 && id !== cur; });
    var newRound = false;
    if (!eligible.length) {
      newRound = true;
      eligible = present.filter(function (id) { return id !== lastSpeaker; });
      if (!eligible.length) eligible = present.slice();
    }
    var name = {};
    s.people.forEach(function (p) { name[p.id] = p.name; });
    eligible.sort(function (a, b) {
      var ta = totalMs(s, a, now), tb = totalMs(s, b, now);
      if (ta !== tb) return ta - tb;
      var la = s.lastEnd[a] == null ? -Infinity : s.lastEnd[a];
      var lb = s.lastEnd[b] == null ? -Infinity : s.lastEnd[b];
      if (la !== lb) return la < lb ? -1 : 1;
      return String(name[a]).localeCompare(String(name[b]), 'fr');
    });
    return { order: eligible, newRound: newRound };
  }
  function suggestion(s, now) {
    var r = rank(s, now);
    if (!r.order.length) return null;
    return r.order[s.skip % r.order.length];
  }

  /* Démarre la prise de parole de pid. Retourne un nouvel état. */
  function startTurn(s0, pid, now) {
    var s = clone(s0);
    commitCurrent(s, now);
    var allPassed = s.people.every(function (p) { return s.passed.indexOf(p.id) >= 0; });
    if (allPassed) { s.passed = []; s.round += 1; }
    if (s.passed.indexOf(pid) < 0) s.passed.push(pid);
    s.current = { pid: pid, acc: 0, resumedAt: now };
    s.skip = 0;
    return s;
  }
  function nextPerson(s, now) {
    var pid = suggestion(s, now);
    return pid ? startTurn(s, pid, now) : s;
  }
  function skipSuggestion(s0) { var s = clone(s0); s.skip += 1; return s; }
  function pause(s0, now) {
    var s = clone(s0);
    if (s.current && s.current.resumedAt != null) { s.current.acc = elapsedCurrent(s, now); s.current.resumedAt = null; }
    return s;
  }
  function resume(s0, now) {
    var s = clone(s0);
    if (s.current && s.current.resumedAt == null) s.current.resumedAt = now;
    return s;
  }
  function stopTurn(s0, now) { var s = clone(s0); commitCurrent(s, now); s.skip = 0; return s; }
  function addPerson(s0, p) {
    var s = clone(s0);
    if (s.people.some(function (q) { return q.id === p.id; })) return s;
    s.people.push({ id: p.id, name: p.name, avatar: p.avatar, guest: !!p.guest });
    s.totals[p.id] = 0; s.counts[p.id] = 0;
    return s;
  }
  function finish(s0, now) {
    var s = clone(s0);
    commitCurrent(s, now);
    return {
      id: s.id, startedAt: s.startedAt, endedAt: now, durationMs: s.durationMs, rounds: s.round,
      people: s.people.map(function (p) {
        return { id: p.id, name: p.name, avatar: p.avatar, guest: p.guest, ms: s.totals[p.id] || 0, turns: s.counts[p.id] || 0 };
      })
    };
  }

  /* ---------- Formats ---------- */
  function mmss(ms) {
    var t = Math.round(Math.abs(ms) / 1000), m = Math.floor(t / 60), s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function hm(ms) {
    var t = Math.round(ms / 60000), h = Math.floor(t / 60), m = t % 60;
    return h + ' h ' + (m < 10 ? '0' : '') + m;
  }

  /* ---------- Statistiques (tableau de bord) ---------- */
  var PERIOD_MS = { week: 7 * 86400000, month: 30 * 86400000, all: Infinity };
  function aggregate(sessions, people, opts, now) {
    var limit = PERIOD_MS[opts.period] == null ? Infinity : PERIOD_MS[opts.period];
    var inPeriod = sessions.filter(function (x) { return now - x.startedAt <= limit; });
    var shown = people.filter(function (p) { return opts.onlyFavorites ? p.fav : true; });
    var rows = shown.map(function (p) {
      var ms = 0, turns = 0, n = 0;
      inPeriod.forEach(function (x) {
        x.people.forEach(function (q) {
          if (q.id === p.id) { ms += q.ms; turns += q.turns; if (q.ms > 0 || q.turns > 0) n += 1; }
        });
      });
      return { id: p.id, name: p.name, avatar: p.avatar, fav: !!p.fav, ms: ms, turns: turns, sessions: n, avgMs: turns ? ms / turns : 0 };
    });
    var totalMsAll = rows.reduce(function (a, r) { return a + r.ms; }, 0);
    var totalTurns = rows.reduce(function (a, r) { return a + r.turns; }, 0);
    return {
      rows: rows, sessions: inPeriod.length, totalMs: totalMsAll, totalTurns: totalTurns,
      avgMs: totalTurns ? totalMsAll / totalTurns : 0
    };
  }

  /* ---------- Disposition des bulles ---------- */
  /* items: [{id, r, first?}]. Renvoie {pos:{id:{x,y}}, height}. x,y = centre. */
  function packBubbles(items, W, H, gap) {
    gap = gap == null ? 6 : gap;
    var placed = [], pos = {};
    var list = items.slice().sort(function (a, b) {
      if (a.first && !b.first) return -1;
      if (b.first && !a.first) return 1;
      return b.r - a.r;
    });
    function fits(x, y, r) {
      if (x - r < 0 || x + r > W || y - r < 0) return false;
      for (var i = 0; i < placed.length; i++) {
        var q = placed[i], dx = x - q.x, dy = y - q.y, d = r + q.r + gap;
        if (dx * dx + dy * dy < d * d) return false;
      }
      return true;
    }
    var cx = W / 2, cy = Math.min(H / 2, Math.max(list.length ? list[0].r + 8 : 0, H * 0.42));
    list.forEach(function (it, idx) {
      var best = null;
      if (idx === 0) {
        var x0 = cx, y0 = Math.max(it.r, cy);
        best = { x: x0, y: y0 };
      } else {
        for (var rad = 0; rad < 4000 && !best; rad += 4) {
          var steps = Math.max(8, Math.round(rad * 0.5));
          for (var k = 0; k < steps; k++) {
            var a = (k / steps) * Math.PI * 2 + rad * 0.37;
            var x = cx + rad * Math.cos(a) * 1.0, y = cy + rad * Math.sin(a) * 1.0;
            if (fits(x, y, it.r)) { best = { x: x, y: y }; break; }
          }
        }
        if (!best) best = { x: cx, y: H };
      }
      placed.push({ x: best.x, y: best.y, r: it.r });
      pos[it.id] = best;
    });
    var bottom = placed.reduce(function (m, q) { return Math.max(m, q.y + q.r); }, 0);
    return { pos: pos, height: Math.max(H, bottom + 8) };
  }

  /* Rayons des bulles : la surface suit (en gros) le temps de parole.
     Tout reste touchable : rayon minimum, même à 0:00. */
  function bubbleRadii(totalsById, activeId, W, H) {
    var ids = Object.keys(totalsById), n = Math.max(1, ids.length);
    var rmin = Math.max(26, Math.min(46, Math.sqrt((W * H * 0.42) / (n * Math.PI)) * 0.55));
    var rmax = Math.max(rmin + 8, Math.min(W * 0.28, 92));
    var tmax = Math.max(120000, Math.max.apply(null, ids.map(function (i) { return totalsById[i]; }).concat([0])));
    var out = {};
    ids.forEach(function (id) {
      var f = Math.sqrt(totalsById[id] / tmax);
      out[id] = rmin + (rmax - rmin) * Math.min(1, f);
    });
    if (activeId && out[activeId] != null) out[activeId] = Math.max(out[activeId], Math.min(W * 0.27, 90));
    return out;
  }

  return {
    clone: clone, uid: uid, newSession: newSession, elapsedCurrent: elapsedCurrent, totalMs: totalMs,
    isRunning: isRunning, rank: rank, suggestion: suggestion, startTurn: startTurn, nextPerson: nextPerson,
    skipSuggestion: skipSuggestion, pause: pause, resume: resume, stopTurn: stopTurn, addPerson: addPerson,
    finish: finish, mmss: mmss, hm: hm, aggregate: aggregate, packBubbles: packBubbles, bubbleRadii: bubbleRadii
  };
});

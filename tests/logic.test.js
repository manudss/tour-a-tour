const test = require('node:test');
const assert = require('node:assert');
const L = require('../app/src/main/assets/logic.js');

const people = ['Tom', 'Léa', 'Papa', 'Maman', 'Jules', 'Mamie'].map((n, i) => ({ id: 'p' + i, name: n, avatar: {} }));
const T0 = 1_000_000;

function speak(s, pid, from, ms) { s = L.startTurn(s, pid, from); return L.stopTurn(s, from + ms); }

test('la personne qui n a jamais parlé est proposée en premier', () => {
  let s = L.newSession(people, 120000, T0);
  s = speak(s, 'p0', T0, 60000);
  assert.notStrictEqual(L.suggestion(s, T0 + 60000), 'p0');
  assert.strictEqual(L.rank(s, T0 + 60000).order.length, 5);
});

test('au sein d un tour, le moins de temps cumulé passe en premier', () => {
  let s = L.newSession(people, 120000, T0);
  s = speak(s, 'p0', T0, 70000);
  s = speak(s, 'p1', T0 + 70000, 50000);
  s = speak(s, 'p2', T0 + 120000, 40000);
  s = speak(s, 'p3', T0 + 160000, 30000);
  // restent Jules (p4) et Mamie (p5), tous deux à 0 : égalité, ordre par nom puis attente
  const r = L.rank(s, T0 + 190000).order;
  assert.deepStrictEqual(r.sort(), ['p4', 'p5']);
});

test('chacun revient : un nouveau tour recommence quand tous sont passés', () => {
  let s = L.newSession(people.slice(0, 3), 120000, T0);
  let t = T0;
  const seen = [];
  for (let i = 0; i < 7; i++) {
    const pid = L.suggestion(s, t);
    seen.push(pid);
    s = speak(s, pid, t, 30000 + i * 1000);
    t += 40000;
  }
  // 3 personnes : chaque tour de 3 contient chacun une fois
  assert.strictEqual(new Set(seen.slice(0, 3)).size, 3);
  assert.strictEqual(new Set(seen.slice(3, 6)).size, 3);
  assert.strictEqual(s.round, 3);
});

test('celui qui a le plus parlé est reproposé dans le tour suivant', () => {
  let s = L.newSession(people.slice(0, 2), 120000, T0);
  s = speak(s, 'p0', T0, 300000);
  s = speak(s, 'p1', T0 + 300000, 10000);
  const sug = L.suggestion(s, T0 + 320000);
  assert.strictEqual(sug, 'p0'); // seul candidat du nouveau tour hors personne qui vient de parler
});

test('toucher quelqu un à la main compte comme son passage dans le tour', () => {
  let s = L.newSession(people.slice(0, 3), 120000, T0);
  s = speak(s, 'p2', T0, 20000);
  assert.ok(s.passed.indexOf('p2') >= 0);
  const r = L.rank(s, T0 + 30000).order;
  assert.ok(r.indexOf('p2') < 0);
});

test('Passer propose la suivante sans la compter', () => {
  let s = L.newSession(people.slice(0, 3), 120000, T0);
  const first = L.suggestion(s, T0);
  s = L.skipSuggestion(s);
  const second = L.suggestion(s, T0);
  assert.notStrictEqual(first, second);
  assert.deepStrictEqual(s.passed, []);
});

test('un invité ajouté en cours entre à 0:00 et est proposé vite', () => {
  let s = L.newSession(people.slice(0, 3), 120000, T0);
  s = speak(s, 'p0', T0, 50000);
  s = speak(s, 'p1', T0 + 50000, 50000);
  s = L.addPerson(s, { id: 'g1', name: 'Hugo', avatar: {}, guest: true });
  assert.strictEqual(L.suggestion(s, T0 + 100000), 'g1');
});

test('pause et reprise cumulent le temps correctement', () => {
  let s = L.newSession(people, 120000, T0);
  s = L.startTurn(s, 'p0', T0);
  s = L.pause(s, T0 + 10000);
  assert.strictEqual(L.elapsedCurrent(s, T0 + 99000), 10000);
  s = L.resume(s, T0 + 100000);
  assert.strictEqual(L.elapsedCurrent(s, T0 + 105000), 15000);
  const sum = L.finish(s, T0 + 105000);
  assert.strictEqual(sum.people[0].ms, 15000);
  assert.strictEqual(sum.people[0].turns, 1);
});

test('agrégats : moyennes calculées depuis les secondes et les prises', () => {
  const sess = [{ startedAt: T0, people: [
    { id: 'a', ms: 5400000, turns: 41 }, { id: 'b', ms: 4320000, turns: 35 }, { id: 'c', ms: 1320000, turns: 10 } ] }];
  const ppl = [{ id: 'a', name: 'Tom', fav: true }, { id: 'b', name: 'Léa', fav: true }, { id: 'c', name: 'Camille', fav: false }];
  const fav = L.aggregate(sess, ppl, { onlyFavorites: true, period: 'all' }, T0 + 1000);
  assert.strictEqual(fav.rows.length, 2);
  assert.strictEqual(L.mmss(fav.rows[0].avgMs), '2:12');
  assert.strictEqual(L.mmss(fav.rows[1].avgMs), '2:03');
  const all = L.aggregate(sess, ppl, { onlyFavorites: false, period: 'all' }, T0 + 1000);
  assert.strictEqual(all.rows.length, 3);
  assert.strictEqual(L.hm(all.totalMs), '3 h 04');
  assert.strictEqual(L.mmss(all.avgMs), L.mmss(all.totalMs / all.totalTurns));
});

test('période : une session vieille de 40 jours sort de la vue 30 jours', () => {
  const sess = [{ startedAt: T0 - 40 * 86400000, people: [{ id: 'a', ms: 60000, turns: 1 }] }];
  const r = L.aggregate(sess, [{ id: 'a', name: 'Tom', fav: true }], { onlyFavorites: false, period: 'month' }, T0);
  assert.strictEqual(r.sessions, 0);
  assert.strictEqual(r.rows[0].ms, 0);
});

test('bulles : aucune superposition, tout reste touchable, même à 14 personnes', () => {
  const totals = {}; for (let i = 0; i < 14; i++) totals['x' + i] = i === 0 ? 600000 : i * 20000;
  const W = 358, H = 420;
  const radii = L.bubbleRadii(totals, 'x0', W, H);
  const items = Object.keys(radii).map((id) => ({ id, r: radii[id], first: id === 'x0' }));
  const { pos } = L.packBubbles(items, W, H);
  items.forEach((a, i) => {
    assert.ok(a.r * 2 >= 48, 'taille minimale 48 px');
    items.slice(i + 1).forEach((b) => {
      const d = Math.hypot(pos[a.id].x - pos[b.id].x, pos[a.id].y - pos[b.id].y);
      assert.ok(d >= a.r + b.r, 'pas de chevauchement');
    });
  });
});

test('une personne à 0:00 a une bulle plus petite que celle qui a parlé', () => {
  const radii = L.bubbleRadii({ a: 0, b: 300000 }, null, 358, 420);
  assert.ok(radii.a < radii.b);
});

/* Test de l'interface dans Chrome, écran de téléphone, horloge simulée. */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const OUT = process.env.SHOTS || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.resolve(__dirname, '../app/src/main/assets/index.html');
let step = 0;

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  const [VW, VH, VS] = (process.env.VIEW || '390x844x2').split('x').map(Number);
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: VS, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.evaluateOnNewDocument(() => {
    let off = 0; const real = Date.now.bind(Date);
    Date.now = () => real() + off; window.__advance = ms => { off += ms; };
  });
  await page.goto(URL);
  const shot = async name => { step++; const f = `${OUT}/${String(step).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: f }); return f; };
  const click = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('introuvable: ' + s); e.click(); }, sel);
  const text = () => page.evaluate(() => document.body.innerText);
  const adv = async ms => { await page.evaluate(m => window.__advance(m), ms); await new Promise(r => setTimeout(r, 700)); };
  const type = async (sel, v) => { await page.focus(sel); await page.keyboard.type(v); };

  // 1. accueil vide
  assert((await text()).includes('Personne pour l'), 'accueil vide');
  await shot('accueil-vide');

  // 2. créer une famille de 7 personnes (dont 2 non favoris)
  const fam = [['Emma', 'enfant', 0, true], ['Léo', 'enfant', 1, true], ['Zoé', 'ado', 1, true], ['Papa', 'adulte', 0, true], ['Maman', 'adulte', 1, true], ['Mamie', 'aine', 0, false], ['Papi', 'aine', 1, false]];
  for (const [n, cat, i, fav] of fam) {
    await click('[data-act=newp]');
    await type('#nm', n);
    await click(`[data-act=cat][data-c=${cat}]`);
    const ids = await page.evaluate(() => [...document.querySelectorAll('[data-act=preset]')].map(b => b.dataset.id));
    await click(`[data-act=preset][data-id=${ids[i]}]`);
    if (n === 'Maman') {
      await shot('editeur');
      const sels = await page.evaluate(() => document.querySelectorAll('.pgrid .sel').length);
      assert(sels === 1, 'une seule case sélectionnée dans la grille, trouvé ' + sels);
      await click('[data-act=cat][data-c=all]');
      const rend = await page.evaluate(() => [...document.querySelectorAll('[data-act=preset]')].map(b => b.innerHTML));
      assert(rend.length >= 32 && new Set(rend).size === rend.length, 'tous les modèles sont différents à l\'écran');
      const sels2 = await page.evaluate(() => document.querySelectorAll('.pgrid .sel').length);
      assert(sels2 === 1, 'une seule case sélectionnée (Tous), trouvé ' + sels2);
      await shot('editeur-tous');
      const sw = await page.evaluate(async () => {
        const all = [...document.querySelectorAll('.sw[data-key=shirt]')];
        const last = all[all.length - 1]; last.scrollIntoView({ block: 'center' });
        await new Promise(r => setTimeout(r, 300));
        const rr = last.getBoundingClientRect(), top = document.elementFromPoint(rr.x + rr.width / 2, rr.y + rr.height / 2);
        const ft = document.querySelector('.footer, .foot, #foot, [data-act=savep]');
        return { n: all.length, reachable: top === last, bottom: rr.bottom, vh: innerHeight, footTop: ft ? ft.getBoundingClientRect().top : null };
      });
      assert(sw.n >= 12 && sw.reachable, 'les 12 couleurs de tee-shirt sont atteignables en défilant: ' + JSON.stringify(sw));
      await shot('editeur-couleurs-defilement');
    }
    if (!fav) await click('[data-act=togfav]');
    await click('[data-act=savep]');
  }
  let t = await text();
  assert(fam.every(f => t.includes(f[0])), 'personnes créées');
  await shot('accueil-famille');

  // 3. préparation : favoris précochés
  await click('[data-act=newsession]');
  const sel = await page.evaluate(() => document.querySelectorAll('.pcard.on:not(.guest)').length);
  assert.strictEqual(sel, 5, 'favoris précochés');
  await click('[data-act=tog][data-id]:not(.on)');  // coche Mamie
  await click('[data-act=addguest]');
  await type('#gname', 'Tonton Jo');
  await click('[data-act=gok]');
  t = await text(); assert(t.includes('Tonton Jo') && t.includes('invité'), 'invité ajouté');
  await shot('preparation');
  await click('[data-act=launch]');
  await new Promise(r => setTimeout(r, 900));
  await shot('live-depart');

  // 4. suggérée = jamais parlé, tape sur un orateur, avance 1 min
  const first = await page.evaluate(() => document.querySelector('.bubble.sug .bn').textContent);
  await click('.bubble[data-act=speak]:not(.sug)');
  await adv(60000);
  await shot('live-parole-1min');
  t = await text(); assert(/1:\d\d/.test(t), 'compte à rebours');
  const geo = () => page.evaluate(() => { const g = c => { const e = document.querySelector('.bubble.active svg.ring .' + c); return e ? { r: +e.getAttribute('r'), w: +getComputedStyle(e).strokeWidth.replace('px', ''), da: e.getAttribute('stroke-dasharray') } : null; }; const b = document.querySelector('.bubble.active svg.ring').getBoundingClientRect(); return { prog: g('prog'), prog2: g('prog2'), track: g('track'), w: b.width, h: b.height }; });
  let gm = await geo();
  assert(gm.prog && !gm.prog2, 'avant dépassement: un seul arc (orange)');
  assert(gm.prog.r + gm.prog.w / 2 <= 50, 'anneau entièrement dans sa boîte (pas rogné): ' + JSON.stringify(gm));

  // 5. dépassement doux
  await adv(80000);
  t = await text(); assert(t.includes('+0:'), 'dépassement affiché');
  await shot('live-depassement');
  gm = await geo();
  assert(gm.prog.da.startsWith('100') && gm.prog2, 'après dépassement: orange complet + arc rouge par-dessus');
  const f2 = parseFloat(gm.prog2.da);
  assert(f2 > 10 && f2 < 25, 'arc rouge ≈ 17% (20 s de dépassement sur 120 s): ' + gm.prog2.da);
  assert(gm.prog2.r + gm.prog2.w / 2 <= 50, 'arc rouge non rogné');
  await adv(60000);
  gm = await geo(); assert(parseFloat(gm.prog2.da) > 60 && parseFloat(gm.prog2.da) < 72, 'l\'arc rouge continue: ' + gm.prog2.da);
  await shot('live-depassement-plus-tard');

  // 6. suivante x3 avec temps différents
  for (let i = 0; i < 3; i++) { await click('[data-act=next]'); await adv(30000 + i * 20000); }
  await shot('live-apres-suivantes');
  const spoken = await page.evaluate(() => { const s = window.__tp.store.live; return Object.keys(s.passed).length; });
  assert(spoken >= 3, 'tour en cours');

  // 7. fin de prise + annulation
  await click('[data-act=stopturn]');
  await shot('live-toast-annuler');
  await click('[data-act=undo]');
  assert(await page.evaluate(() => !!window.__tp.store.live.current), 'annulation rétablit la prise');

  // 8. pause / reprise
  await click('#pz'); await adv(20000);
  const pb = await page.evaluate(() => [...document.querySelectorAll('#panel .row .btn')].map(b => b.textContent.trim()));
  assert(pb.some(x => x.includes('Reprendre')) && pb.some(x => x.includes('Fin')), 'en pause: Reprendre et Fin visibles: ' + pb.join('|'));
  await shot('pause-reprendre-fin');
  const hit = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.bubble').forEach(b => {
      ['.tbadge', '.bn'].forEach(sel => {
        const e = b.querySelector(sel); if (!e) return;
        const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        out.push({ sel, name: b.querySelector('.bn').textContent, ok: !!top && b.contains(top) });
      });
      const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      out.push({ sel: 'centre', name: b.querySelector('.bn').textContent, ok: !!top && b.contains(top) });
    });
    return out;
  });
  if (!process.env.VIEW) assert(hit.length && hit.every(h => h.ok), 'badge, nom et centre de chaque bulle visibles et touchables: ' + JSON.stringify(hit.filter(h => !h.ok)));
  await page.evaluate(() => { const L = window.TPLogic, st = window.__tp.store, ids = st.live.people.map(p => p.id); st.live.counts[ids[0]] = 7; st.live.counts[ids[1]] = 4; st.live.counts[ids[2]] = 2; ids.slice(3).forEach(i => { st.live.counts[i] = 1; }); window.__tp.save(); window.__tp.render(); });
  await new Promise(r => setTimeout(r, 800));
  const hues = await page.evaluate(() => [...document.querySelectorAll('.bubble')].map(b => ({ n: b.querySelector('.bn').textContent, c: +b.querySelector('.tbadge').textContent, bg: b.querySelector('.tbadge').style.background })));
  console.log(JSON.stringify(hues));
  await shot('badges-desequilibre');
  await page.evaluate(() => { const st = window.__tp.store; st.live.counts = JSON.parse(JSON.stringify(st.live.counts)); });
  await click('#panel [data-act=endask]');
  assert((await text()).includes('Terminer la session ?'), 'Fin en pause propose de terminer');
  await click('[data-act=dlgbtn][data-i="1"]');
  assert(await page.evaluate(() => !!window.__tp.store.live), 'Continuer garde la session');
  const before = await page.evaluate(() => window.__tp.store.live.current.acc);
  await adv(20000);
  assert.strictEqual(await page.evaluate(() => window.__tp.store.live.current.acc), before, 'pause fige le temps');
  await click('#pz');

  // 9. personne ajoutée en cours
  await click('[data-act=menu]'); await shot('menu');
  await click('[data-act=addlive]');
  await type('#gname', 'Julie'); await click('[data-act=gok]');
  await new Promise(r => setTimeout(r, 700));
  assert((await text()).includes('Julie'), 'ajout en cours de session');

  // 10. rechargement : la session reprend
  await page.reload();
  await click('[data-act=resume]');
  await new Promise(r => setTimeout(r, 800));
  assert((await text()).includes('Julie'), 'session sauvegardée');

  // 11. fin + bilan
  const nSess = await page.evaluate(() => window.__tp.store.sessions.length);
  await shot('live-avec-fin');
  await click('#panel [data-act=endask]'); await shot('fin-confirmation');
  await click('[data-act=dlgbtn][data-i="0"]');
  await new Promise(r => setTimeout(r, 500));
  t = await text(); assert(t.includes('Bilan') && !t.toLowerCase().includes('équilibre'), 'Fin termine la session et affiche le bilan sans score');
  await shot('bilan');
  assert.strictEqual(await page.evaluate(() => window.__tp.store.sessions.length), nSess + 1, 'la session terminée est ajoutée à l\'historique');
  assert(await page.evaluate(() => window.__tp.store.live === null), 'plus de session en cours');
  await page.reload(); await new Promise(r => setTimeout(r, 600));
  const persisted = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('tp:data')); return { n: d.sessions.length, live: !!d.live }; });
  assert(persisted.n === nSess + 1 && !persisted.live, 'historique conservé après rechargement: ' + JSON.stringify(persisted));

  // 12. tableau de bord, filtres
  await click('[data-act=dash]');
  await new Promise(r => setTimeout(r, 500));
  await shot('dashboard-favoris');
  const rowsFav = await page.evaluate(() => document.querySelectorAll('.tr').length);
  await click('[data-act=dfav][data-v="0"]');
  const rowsAll = await page.evaluate(() => document.querySelectorAll('.tr').length);
  assert(rowsAll > rowsFav, 'Tous affiche plus de personnes que Favoris');
  await click('[data-act=dper][data-v=week]');
  await shot('dashboard-tous-semaine');
  await click('[data-act=back]');

  // 12b. historique des sessions : rouvrir un bilan, supprimer avec confirmation, stats recalculées
  await page.evaluate(() => { const S = window.__tp.store; const c = JSON.parse(JSON.stringify(S.sessions[S.sessions.length - 1])); c.id = 'ancienne-test'; c.startedAt -= 3 * 86400000; c.endedAt -= 3 * 86400000; S.sessions.push(c); window.__tp.save(); });
  await page.reload(); await new Promise(r => setTimeout(r, 600));
  await click('[data-act=dash]'); await click('[data-act=dfav][data-v="0"]'); await click('[data-act=dper][data-v=all]');
  const statNums = () => page.evaluate(() => [...document.querySelectorAll('.stats .stat b')].map(b => b.textContent));
  const nBefore = await page.evaluate(() => window.__tp.store.sessions.length);
  const stBefore = await statNums();
  assert(+stBefore[0] === nBefore, 'stats: nombre de sessions = ' + nBefore + ' (obtenu ' + stBefore[0] + ')');
  const listRows = await page.evaluate(() => document.querySelectorAll('.sessrow').length);
  assert.strictEqual(listRows, nBefore, 'toutes les sessions sont listées');
  await shot('dashboard-historique');
  await click('.sessrow[data-id=ancienne-test]');
  t = await text(); assert(t.includes('Bilan') && t.includes('Supprimer') && t.includes('Retour'), 'bilan de la session rouvert');
  await shot('historique-bilan');
  await click('[data-act=delsess]'); await shot('historique-suppression');
  await click('[data-act=dlgbtn][data-i="1"]');
  assert.strictEqual(await page.evaluate(() => window.__tp.store.sessions.length), nBefore, 'Garder ne supprime pas');
  await click('[data-act=delsess]'); await click('[data-act=dlgbtn][data-i="0"]');
  assert.strictEqual(await page.evaluate(() => window.__tp.store.sessions.length), nBefore - 1, 'session supprimée');
  const stAfter = await statNums();
  assert(+stAfter[0] === nBefore - 1 && stAfter[1] !== stBefore[1], 'stats agrégées recalculées: ' + stBefore.join('/') + ' -> ' + stAfter.join('/'));
  assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.sessrow').length), nBefore - 1, 'liste mise à jour');
  await page.reload(); await new Promise(r => setTimeout(r, 600));
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('tp:data')).sessions.length), nBefore - 1, 'suppression conservée après rechargement');
  await click('[data-act=dash]'); await click('[data-act=back]');

  // 13. 14 personnes dans une session
  await page.evaluate(() => {
    const L = window.TPLogic, st = window.__tp.store;
    for (let i = 0; i < 14; i++) st.people.push({ id: 'x' + i, name: 'Pers' + (i + 1), fav: true, avatar: { style: ['short', 'long', 'curly', 'bun', 'pony', 'pig'][i % 6], skin: i % 6, hair: i % 5, shirt: i % 6, child: i % 4 === 0 } });
    window.__tp.save(); window.__tp.render();
  });
  await click('[data-act=newsession]');
  await click('[data-act=launch]');
  await new Promise(r => setTimeout(r, 1800));
  const overlap = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.bubble')].map(e => { const r = e.offsetWidth / 2; return { x: e.offsetLeft + r, y: e.offsetTop + r, r }; });
    let bad = 0; for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y) < b[i].r + b[j].r - 1) bad++;
    return { n: b.length, bad, minr: Math.min(...b.map(x => x.r)) };
  });
  await shot('live-14-personnes');
  assert(overlap.n >= 14 && overlap.bad === 0 && overlap.minr >= 20, 'bulles sans chevauchement et touchables: ' + JSON.stringify(overlap));
  await shot('live-14-personnes');

  assert.deepStrictEqual(errors, [], 'erreurs JS: ' + errors.join(' | '));
  await browser.close();
  console.log('UI OK, captures dans ' + OUT);
})().catch(e => { console.error('ECHEC UI:', e.message); process.exit(1); });

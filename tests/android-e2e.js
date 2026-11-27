/* Test de bout en bout sur émulateur Android : vraie WebView, vrai arrêt complet de l'application. */
const { execSync } = require('child_process');
const fs = require('fs'); fs.mkdirSync('e2e-out', { recursive: true });
const sh = c => execSync(c, { encoding: 'utf8', timeout: 60000, shell: '/bin/bash' }).trim();
const diag = () => { try { fs.writeFileSync('e2e-out/diag.txt', sh('adb shell cat /proc/net/unix | grep -i devtools; adb logcat -d | tail -80 || true')); } catch (e) { /* diag best effort */ } };
setTimeout(() => { console.log('WATCHDOG: test trop long'); diag(); process.exit(2); }, 8 * 60 * 1000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const APK = 'build/tour-de-parole.apk', PKG = 'app.tourdeparole';
const results = [];
function check(name, ok, extra) { results.push({ name, ok: !!ok, extra: extra || '' }); console.log((ok ? 'OK   ' : 'ECHEC'), name, extra || ''); if (!ok) { fs.writeFileSync('e2e-out/results.json', JSON.stringify(results, null, 1)); process.exit(1); } }

const WebSocket = require('ws');
const http = require('http');
const getJson = url => new Promise((res, rej) => { http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej).setTimeout(5000, function () { this.destroy(new Error('http timeout')); }); });
function cdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl); let id = 0; const pend = {};
    ws.on('message', m => { const d = JSON.parse(m); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } });
    ws.on('error', reject);
    ws.on('open', () => resolve({
      eval: expr => new Promise((rs, rj) => { const i = ++id; pend[i] = d => d.error ? rj(new Error(JSON.stringify(d.error))) : (d.result.exceptionDetails ? rj(new Error(JSON.stringify(d.result.exceptionDetails))) : rs(d.result.result.value)); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } })); }),
      close: () => ws.close()
    }));
  });
}
async function connect() {
  for (let i = 0; i < 30; i++) {
    const sock = sh("adb shell cat /proc/net/unix | grep webview_devtools_remote | head -1 | awk '{print $NF}' | tr -d '@\\r'");
    console.log('socket devtools:', sock || '(aucun)');
    if (sock) { sh(`adb forward tcp:9222 localabstract:${sock}`); break; }
    await sleep(1000);
  }
  for (let i = 0; i < 20; i++) {
    try {
      const list = await getJson('http://127.0.0.1:9222/json/list');
      const t = list.find(x => (x.url || '').includes('android_asset') && x.webSocketDebuggerUrl);
      if (t) { const c = await cdp(t.webSocketDebuggerUrl); const p = { evaluate: (fn, ...args) => c.eval('(' + fn.toString() + ').apply(null,' + JSON.stringify(args) + ')'), type: async (sel, v) => c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.focus();e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`) }; for (let k = 0; k < 30; k++) { try { if (await c.eval('document.readyState==="complete" && !!window.TPLogic && !!document.querySelector("#app h1, #app .screen")')) break; } catch (e) { /* page pas prête */ } await sleep(1000); }
        return { b: { disconnect: async () => c.close() }, p }; }
      console.log('cibles:', JSON.stringify(list.map(x => x.url)));
    } catch (e) { console.log('connexion WebView:', e.message); }
    await sleep(1000);
  }
  diag(); throw new Error('WebView injoignable');
}
const launch = () => sh(`adb shell am start -n ${PKG}/.MainActivity --ez devtools true`);
const shot = n => { sh(`adb exec-out screencap -p > e2e-out/${n}.png`); };

(async () => {
  sh('adb wait-for-device'); sh('adb shell pm uninstall ' + PKG + ' || true');
  if (fs.existsSync('build/prev.apk')) {
    // Mise à jour par-dessus la version précédente : mêmes données, même signature.
    console.log(sh('adb install -r build/prev.apk'));
    launch(); await sleep(3000);
    let c0 = await connect();
    await c0.p.evaluate(() => { document.querySelector('[data-act=newp]').click(); });
    await c0.p.type('#nm', 'Ancien'); await c0.p.evaluate(() => document.querySelector('[data-act=savep]').click());
    const avant = await c0.p.evaluate(() => JSON.parse(localStorage.getItem('tp:data')).people.map(x => x.name));
    check('version précédente installée avec une personne créée', avant.includes('Ancien'), JSON.stringify(avant));
    await sleep(5000); // laisse la WebView écrire son stockage local avant l'arrêt forcé
    await c0.b.disconnect(); sh(`adb shell am force-stop ${PKG}`); await sleep(1500);
    let upd = ''; try { upd = sh(`adb install -r ${APK} 2>&1`); } catch (e) { upd = String(e.stdout || e.message); }
    console.log(upd);
    check('installation par-dessus la précédente (même signature)', /Success/.test(upd), upd.slice(0, 160));
    const vc = sh(`adb shell dumpsys package ${PKG} | grep -E "versionCode|versionName" | head -2`);
    check('nouvelle version en place', new RegExp('versionCode=' + (process.env.EXPECT_CODE || '100000')).test(vc), vc);
    launch(); await sleep(3000);
    c0 = await connect();
    const apres = await c0.p.evaluate(() => JSON.parse(localStorage.getItem('tp:data')).people.map(x => x.name));
    check('données conservées après la mise à jour', apres.includes('Ancien'), JSON.stringify(apres));
    await c0.p.evaluate(() => { document.querySelector('[data-act=newp]').click(); });
    const g = await c0.p.evaluate(() => { const r = [...document.querySelectorAll('[data-act=preset]')].map(b => b.innerHTML); return { n: r.length, uniq: new Set(r).size, sel: document.querySelectorAll('.pgrid .sel').length }; });
    check('éditeur : modèles tous différents et une seule case sélectionnée', g.n >= 16 && g.uniq === g.n && g.sel === 1, JSON.stringify(g));
    shot('00-editeur-apres-mise-a-jour');
    await c0.b.disconnect(); sh(`adb shell am force-stop ${PKG}`); sh('adb shell pm uninstall ' + PKG + ' || true');
  }
  console.log(sh(`adb install -r ${APK}`));
  launch(); await sleep(3000);
  let { b, p } = await connect();
  const boot = await p.evaluate(() => ({ logic: !!window.TPLogic, avatar: !!window.TPAvatar, text: document.body.innerText.slice(0, 80), ua: navigator.userAgent.slice(0, 60) }));
  console.log('boot', JSON.stringify(boot));
  check('l\'application démarre et charge les assets locaux', boot.logic && boot.avatar && boot.text.includes('Tour à tour'), JSON.stringify(boot));
  check('pont Android présent', await p.evaluate(() => typeof window.Android !== 'undefined'));
  await p.evaluate(() => { document.querySelector('[data-act=newp]').click(); });
  await p.type('#nm', 'Emma'); await p.evaluate(() => document.querySelector('[data-act=savep]').click());
  await p.evaluate(() => { document.querySelector('[data-act=newp]').click(); });
  await p.type('#nm', 'Léo'); await p.evaluate(() => document.querySelector('[data-act=savep]').click());
  await p.evaluate(() => document.querySelector('[data-act=newsession]').click());
  await p.evaluate(() => document.querySelector('[data-act=launch]').click());
  await sleep(1500);
  const flags = sh('adb shell dumpsys window | grep -iE "keepScreenOn|mHoldScreen|FLAG_KEEP_SCREEN_ON" | head -8') + sh('adb shell dumpsys power | grep -iE "SCREEN_BRIGHT|SCREEN_DIM|WakeLocks" | head -5');
  console.log('flags', flags);
  check('écran gardé allumé pendant la session', new RegExp('keepScreenOn=true|mHoldScreenWindow=Window\\{[^}]*' + PKG + '|SCREEN_(BRIGHT|DIM)_WAKE_LOCK[^\\n]*' + PKG + '|mHoldScreen=Window[^\\n]*' + PKG).test(flags), flags.slice(0, 200));
  await p.evaluate(() => document.querySelector('[data-act=next]').click()); await sleep(1500);
  shot('01-session-en-direct');
  await b.disconnect();
  sh(`adb shell am force-stop ${PKG}`); await sleep(1500);
  launch(); await sleep(3000);
  ({ b, p } = await connect());
  const st = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('tp:data')); return { people: d.people.map(x => x.name), live: !!d.live }; });
  check('données conservées après arrêt complet', st.people.includes('Emma') && st.people.includes('Léo'), JSON.stringify(st));
  check('session en cours reprenable après arrêt complet', st.live);
  await p.evaluate(() => document.querySelector('[data-act=resume]').click()); await sleep(1500);
  shot('02-session-reprise');
  const back = await p.evaluate(() => { window.__back(); return document.body.innerText.includes('Terminer la session'); });
  check('bouton retour géré par l\'application', back);
  fs.writeFileSync('e2e-out/results.json', JSON.stringify(results, null, 1));
  await b.disconnect(); fs.writeFileSync('e2e-out/results.json', JSON.stringify(results, null, 1)); console.log('E2E ANDROID OK'); process.exit(0);
})().catch(e => { console.error('ECHEC E2E', e); process.exit(1); });

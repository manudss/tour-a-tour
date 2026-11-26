/* Test de bout en bout sur émulateur Android : vraie WebView, vrai arrêt complet de l'application. */
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const fs = require('fs'); fs.mkdirSync('e2e-out', { recursive: true });
const sh = c => execSync(c, { encoding: 'utf8' }).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const APK = 'build/tour-de-parole.apk', PKG = 'app.tourdeparole';
const results = [];
function check(name, ok, extra) { results.push({ name, ok: !!ok, extra: extra || '' }); console.log((ok ? 'OK   ' : 'ECHEC'), name, extra || ''); if (!ok) { fs.writeFileSync('e2e-out/results.json', JSON.stringify(results, null, 1)); process.exit(1); } }

async function connect() {
  for (let i = 0; i < 30; i++) {
    const sock = sh("adb shell cat /proc/net/unix | grep webview_devtools_remote | head -1 | awk '{print $NF}' | tr -d '@\\r'");
    if (sock) { sh(`adb forward tcp:9222 localabstract:${sock}`); break; }
    await sleep(1000);
  }
  for (let i = 0; i < 20; i++) {
    try {
      const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
      const pages = await b.pages(); const p = pages.find(x => x.url().includes('android_asset'));
      if (p) return { b, p };
    } catch (e) { /* pas prêt */ }
    await sleep(1000);
  }
  throw new Error('WebView injoignable');
}
const launch = () => sh(`adb shell am start -n ${PKG}/.MainActivity --ez devtools true`);
const shot = n => { sh(`adb exec-out screencap -p > e2e-out/${n}.png`); };

(async () => {
  sh('adb wait-for-device'); sh('adb shell pm uninstall ' + PKG + ' || true');
  console.log(sh(`adb install -r ${APK}`));
  launch(); await sleep(3000);
  let { b, p } = await connect();
  check('l\'application démarre et charge les assets locaux', await p.evaluate(() => !!window.TPLogic && !!window.TPAvatar && document.body.innerText.includes('Tour de parole')));
  check('pont Android présent', await p.evaluate(() => typeof window.Android !== 'undefined'));
  await p.evaluate(() => { document.querySelector('[data-act=newp]').click(); });
  await p.type('#nm', 'Emma'); await p.evaluate(() => document.querySelector('[data-act=savep]').click());
  await p.evaluate(() => { document.querySelector('[data-act=newp]').click(); });
  await p.type('#nm', 'Léo'); await p.evaluate(() => document.querySelector('[data-act=savep]').click());
  await p.evaluate(() => document.querySelector('[data-act=newsession]').click());
  await p.evaluate(() => document.querySelector('[data-act=launch]').click());
  await sleep(1500);
  const flags = sh('adb shell dumpsys window windows | grep -iE "keepScreenOn|mHoldScreen|FLAG_KEEP_SCREEN_ON" | head -3');
  check('écran gardé allumé pendant la session', /keepScreenOn=true|FLAG_KEEP_SCREEN_ON|mHoldScreen=Window/.test(flags), flags.slice(0, 120));
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
  await b.disconnect(); console.log('E2E ANDROID OK');
})().catch(e => { console.error('ECHEC E2E', e); process.exit(1); });

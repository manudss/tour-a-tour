/* Génère l'icône 512x512 et le graphique de présentation 1024x500 pour Google Play (Chrome headless). */
const puppeteer = require('puppeteer-core');
const path = require('path');
const A = require('../app/src/main/assets/avatar.js');
const av = (o, s) => (A.TPAvatar || A).svg(o, s);
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  const out = f => path.resolve(__dirname, '../docs/play-store/' + f);
  await p.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
  await p.setContent(`<body style="margin:0;background:#FFC44D"><div style="width:512px;height:512px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;background:#FFC44D;box-sizing:border-box">${av({ style: "bun", skin: 1, hair: 5, shirt: 0 }, 470)}</div></body>`);
  await p.screenshot({ path: out('icone-512.png') });
  await p.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  const styles = [[{ style: 'pig', child: true, skin: 2, hair: 1, shirt: 1 }, 150], [{ style: 'curly', skin: 3, hair: 0, shirt: 3 }, 190], [{ style: 'bun', glasses: true, skin: 1, hair: 4, shirt: 5 }, 210], [{ style: 'short', beard: true, glasses: true, skin: 4, hair: 0, shirt: 4 }, 190], [{ style: 'afro', skin: 5, hair: 0, shirt: 2 }, 150]];
  const bubbles = styles.map(([o, s], i) => `<div style="width:${s}px;height:${s}px;border-radius:50%;background:#fff;border:6px solid ${['#FF7A8A', '#8E7CE8', '#FFB44D', '#4CC49A', '#5AA9F0'][i]};display:flex;align-items:flex-end;justify-content:center;overflow:hidden;margin:0 -8px">${av(o, s * 0.8)}</div>`).join('');
  await p.setContent(`<body style="margin:0;width:1024px;height:500px;background:#FFF3E2;font-family:DejaVu Sans,Arial,sans-serif;text-align:center;overflow:hidden"><div style="padding-top:62px;font-size:84px;font-weight:900;color:#2B2833">Tour à tour</div><div style="font-size:34px;color:#6B6573;margin-top:6px">Chacun sa bulle de parole. À qui le tour ?</div><div style="display:flex;justify-content:center;align-items:flex-end;margin-top:34px">${bubbles}</div></body>`);
  await p.screenshot({ path: out('presentation-1024x500.png') });
  await b.close();
})();

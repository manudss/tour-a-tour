/* Génère les icônes du lanceur depuis l'avatar SVG (Chrome headless). */
const puppeteer = require('puppeteer-core');
const fs = require('fs'); const path = require('path');
const A = require('../app/src/main/assets/avatar.js');
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  for (const [dir, size] of [['mipmap-mdpi', 96], ['mipmap-xxxhdpi', 192]]) {
    await p.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    const avatar = A.TPAvatar ? A.TPAvatar.svg({ style: 'bun', skin: 1, hair: 5, shirt: 0 }, size * 0.78) : '';
    await p.setContent(`<body style="margin:0"><div style="width:${size}px;height:${size}px;border-radius:50%;background:#FFC44D;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;border:${Math.round(size/16)}px solid #FF8A00;box-sizing:border-box">${avatar}</div></body>`);
    const out = path.resolve(__dirname, `../app/src/main/res/${dir}/ic_launcher.png`);
    await p.screenshot({ path: out, omitBackground: true });
  }
  await b.close();
})();

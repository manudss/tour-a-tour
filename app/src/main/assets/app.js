/* Tour de parole : interface. Tout est local, rien ne quitte le téléphone. */
(function () {
  'use strict';
  var L = window.TPLogic, A = window.TPAvatar;
  var $app = document.getElementById('app');
  function now() { return Date.now(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- Stockage ---------- */
  var KEY = 'tp:data';
  var store = { people: [], sessions: [], settings: { minutes: 2, keepAwake: true }, live: null, undo: null, seeded: false };
  try { var raw = localStorage.getItem(KEY); if (raw) { var d = JSON.parse(raw); for (var k in d) store[k] = d[k]; } } catch (e) { /* données illisibles : on repart de zéro */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* stockage plein */ } }
  function bridge(on) { try { if (window.Android && window.Android.keepAwake) window.Android.keepAwake(!!on); } catch (e) { /* pas Android */ } }

  var ui = { screen: 'home', edit: null, setup: null, dash: { fav: true, period: 'month' }, menu: false, dlg: null, toast: null, summary: null, from: 'home' };
  var timer = null;

  function person(id) { return store.people.filter(function (p) { return p.id === id; })[0]; }
  function avatarHtml(av, size, speaking) { return A.svg(av, size, speaking); }
  function bgFor(av) { var o = A.norm(av); return o.shirt + '33'; }
  function bdFor(av) { return A.norm(av).shirt; }

  /* ---------- Navigation ---------- */
  function go(screen) { ui.screen = screen; ui.menu = false; render(); }
  window.__back = function () {
    if (ui.dlg) { ui.dlg = null; render(); return true; }
    if (ui.menu) { ui.menu = false; render(); return true; }
    if (ui.screen === 'home') return false;
    if (ui.screen === 'live') { ui.menu = true; render(); return true; }
    if (ui.screen === 'summary') { go(ui.summaryFrom === 'dash' ? 'dash' : 'home'); return true; }
    if (ui.screen === 'editor') { go(ui.from === 'setup' ? 'setup' : 'home'); return true; }
    go('home'); return true;
  };

  function dialog(title, msg, buttons) { ui.dlg = { title: title, msg: msg, buttons: buttons }; render(); }
  function closeDlg() { ui.dlg = null; render(); }

  /* ---------- Rendu général ---------- */
  function render() {
    stopTick();
    var h = '';
    switch (ui.screen) {
      case 'home': h = home(); break;
      case 'editor': h = editor(); break;
      case 'setup': h = setup(); break;
      case 'live': h = liveShell(); break;
      case 'summary': h = summary(); break;
      case 'dash': h = dash(); break;
      case 'settings': h = settings(); break;
    }
    $app.innerHTML = h + overlay();
    if (ui.screen === 'live') { liveFrame(); startTick(); }
    if (ui.screen === 'dash') dashCluster();
    if (ui.screen === 'summary') summaryCluster();
  }

  function overlay() {
    var h = '';
    if (ui.menu) {
      h += '<div class="dlgback" data-act="closemenu" style="background:transparent;align-items:flex-start;justify-content:flex-end"><div class="menu" style="position:static;margin-top:52px">' +
        '<button data-act="undo"' + (store.undo ? '' : ' disabled style="opacity:.4"') + '>↶ Annuler la dernière prise</button>' +
        '<button data-act="addlive">＋ Ajouter une personne</button>' +
        '<button data-act="endask">■ Terminer la session</button></div></div>';
    }
    if (ui.dlg) {
      h += '<div class="dlgback"><div class="dlg"><h3>' + esc(ui.dlg.title) + '</h3><p>' + esc(ui.dlg.msg) + '</p>' +
        ui.dlg.buttons.map(function (b, i) { return '<button class="btn ' + (b.cls || '') + '" data-act="dlgbtn" data-i="' + i + '">' + esc(b.label) + '</button>'; }).join('') + '</div></div>';
    }
    if (ui.toast) {
      h += '<div class="toast"><span>' + esc(ui.toast.text) + '</span>' + (ui.toast.undo ? '<button data-act="undo">Annuler</button>' : '') + '</div>';
    }
    return h;
  }

  /* ---------- Accueil ---------- */
  function home() {
    var h = '<div class="screen"><div class="topbar"><div><h1>Tour à tour</h1><div class="sub">Chacun sa bulle de parole. À qui le tour ?</div></div>' +
      '<button class="iconbtn" data-act="settings" aria-label="Réglages">⚙</button></div><div class="scroll">';
    if (store.live) h += '<div class="notice">Une session est en cours. <button class="btn small accent" data-act="resume" style="margin-top:8px">Reprendre la session</button></div>';
    h += '<h2>Mes personnes (' + store.people.length + ')</h2>';
    if (!store.people.length) h += '<div class="empty">Personne pour l\'instant.<br>Ajoute les gens autour de la table avec le bouton ci-dessous.</div>';
    h += '<div class="grid">' + store.people.map(function (p) {
      return '<div class="pcard" data-act="editp" data-id="' + p.id + '">' + (p.fav ? '<span class="fav">★</span>' : '') + avatarHtml(p.avatar, 58) + '<div class="nm">' + esc(p.name) + '</div></div>';
    }).join('') + '<div class="pcard" data-act="newp" style="display:flex;flex-direction:column;align-items:center;justify-content:center;border-style:dashed"><div style="font-size:30px;font-weight:900">+</div><div class="nm" style="white-space:normal;line-height:1.1">Nouvelle personne</div></div></div>';
    h += '</div><div class="footer"><button class="btn" data-act="dash">Tableau de bord</button><button class="btn accent" data-act="newsession">Nouvelle session</button></div></div>';
    return h;
  }

  /* ---------- Éditeur de personne ---------- */
  function swatchRow(label, arr, key, cur) {
    return '<div class="swatches"><span class="lab">' + label + '</span>' + arr.map(function (c, i) {
      return '<button class="sw' + (cur === i ? ' sel' : '') + '" style="background:' + c + '" data-act="sw" data-key="' + key + '" data-i="' + i + '" aria-label="' + label + ' ' + (i + 1) + '"></button>';
    }).join('') + '</div>';
  }
  function editor() {
    var e = ui.edit, a = e.avatar;
    var h = '<div class="screen"><div class="topbar"><button class="iconbtn" data-act="back" aria-label="Retour">‹</button><h1>' + (e.isNew ? 'Nouvelle personne' : 'Modifier') + '</h1><span style="width:44px"></span></div><div class="scroll">';
    h += '<div class="preview">' + avatarHtml(a, 104) + '</div>';
    h += '<input class="field" id="nm" placeholder="Prénom" maxlength="20" value="' + esc(e.name) + '" autocomplete="off">';
    h += '<div class="chips">' + A.CATS.map(function (c) { return '<button class="chip warm' + (e.cat === c[0] ? ' sel' : '') + '" data-act="cat" data-c="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="pgrid">' + A.PRESETS.filter(function (p) { return e.cat === 'all' || p.cat === e.cat; }).map(function (p) {
      var cur = A.shapeKey(a) === A.shapeKey(p);
      return '<button class="' + (cur ? 'sel' : '') + '" data-act="preset" data-id="' + p.id + '" aria-label="Modèle">' + avatarHtml({ style: p.style, child: p.child, glasses: p.glasses, beard: p.beard, skin: a.skin, hair: a.hair, shirt: a.shirt }, 54) + '</button>';
    }).join('') + '</div>';
    h += swatchRow('Peau', A.SKIN, 'skin', a.skin) + swatchRow('Cheveux', A.HAIR, 'hair', a.hair) + swatchRow('T-shirt', A.SHIRT, 'shirt', a.shirt);
    h += '<div class="card kv" style="margin-top:8px"><span>★ Favori (précoché à chaque session)</span><button class="chip ' + (e.fav ? 'sel' : '') + '" data-act="togfav">' + (e.fav ? 'Oui' : 'Non') + '</button></div>';
    if (!e.isNew) h += '<button class="btn" data-act="delp" style="margin-top:8px;color:#b3261e;border-color:#b3261e">Supprimer cette personne</button>';
    h += '</div><div class="footer"><button class="btn primary" data-act="savep">Enregistrer</button></div></div>';
    return h;
  }
  function startEdit(p, from) {
    var cats = { enfant: 'enfant', ado: 'ado', adulte: 'adulte', aine: 'aine' };
    ui.from = from || 'home';
    ui.edit = p ? { id: p.id, name: p.name, avatar: L.clone(p.avatar), fav: !!p.fav, isNew: false, cat: 'all' } :
      { id: null, name: '', avatar: { style: 'short', skin: 1, hair: 0, shirt: store.people.length % A.SHIRT.length }, fav: true, isNew: true, cat: 'all' };
    void cats; go('editor');
  }
  function saveEdit() {
    var e = ui.edit, nmEl = document.getElementById('nm');
    if (nmEl) e.name = nmEl.value;
    var name = e.name.trim();
    if (!name) { dialog('Il manque un prénom', 'Écris un prénom pour enregistrer cette personne.', [{ label: 'OK', cls: 'primary' }]); return; }
    var id;
    if (e.isNew) { id = L.uid(); store.people.push({ id: id, name: name, avatar: e.avatar, fav: e.fav }); }
    else { var p = person(e.id); id = p.id; p.name = name; p.avatar = e.avatar; p.fav = e.fav; }
    save();
    if (ui.from === 'setup' && ui.setup) { ui.setup.sel[id] = true; go('setup'); } else go('home');
  }

  /* ---------- Préparation de session ---------- */
  function startSetup() {
    var sel = {};
    store.people.forEach(function (p) { if (p.fav) sel[p.id] = true; });
    ui.setup = { sel: sel, guests: [], minutes: store.settings.minutes, keepAwake: store.settings.keepAwake };
    go('setup');
  }
  function setup() {
    var s = ui.setup, n = Object.keys(s.sel).filter(function (k) { return s.sel[k]; }).length + s.guests.length;
    var h = '<div class="screen"><div class="topbar"><button class="iconbtn" data-act="back" aria-label="Retour">‹</button><h1>Nouvelle session</h1><span style="width:44px"></span></div><div class="scroll">';
    h += '<div class="sub">Les favoris sont précochés. Touche une personne pour la décocher.</div><h2>Mes personnes</h2><div class="grid">';
    h += store.people.map(function (p) {
      var on = !!s.sel[p.id];
      return '<div class="pcard ' + (on ? 'on' : 'off') + '" data-act="tog" data-id="' + p.id + '"><span class="chk">' + (on ? '✓' : '') + '</span>' + avatarHtml(p.avatar, 54) + '<div class="nm">' + esc(p.name) + '</div></div>';
    }).join('');
    h += s.guests.map(function (g) {
      return '<div class="pcard on guest" data-act="rmguest" data-id="' + g.id + '"><span class="chk">✓</span>' + avatarHtml(g.avatar, 54) + '<div class="nm">' + esc(g.name) + '</div><span class="tag">invité</span></div>';
    }).join('');
    h += '</div><div class="row" style="margin-top:10px"><button class="btn small grow" data-act="newfromsetup">+ Nouvelle personne</button><button class="btn small grow" data-act="addguest">+ Invité éphémère</button></div>';
    h += '<h2>Durée d\'une prise de parole</h2><div class="card"><div class="stepper"><button class="iconbtn" data-act="dur" data-d="-1">−</button><div class="val">' + s.minutes + ' min</div><button class="iconbtn" data-act="dur" data-d="1">+</button></div>' +
      '<div class="sub" style="text-align:center">Le compte à rebours est doux : on peut dépasser sans alarme.</div></div>';
    h += '<div class="card kv"><span>Garder l\'écran allumé</span><button class="chip ' + (s.keepAwake ? 'sel' : '') + '" data-act="togawake">' + (s.keepAwake ? 'Oui' : 'Non') + '</button></div>';
    h += '</div><div class="footer"><button class="btn accent" data-act="launch"' + (n < 1 ? ' disabled' : '') + '>Lancer la session (' + n + ')</button></div></div>';
    return h;
  }
  function launch() {
    var s = ui.setup, ppl = store.people.filter(function (p) { return s.sel[p.id]; }).concat(s.guests);
    if (!ppl.length) return;
    store.settings.minutes = s.minutes; store.settings.keepAwake = s.keepAwake;
    store.live = L.newSession(ppl, s.minutes * 60000, now()); store.undo = null;
    save(); bridge(s.keepAwake); ui.toast = null; go('live');
  }

  /* ---------- Session en direct ---------- */
  var lastPanel = '', domBubbles = {};
  function liveShell() {
    lastPanel = ''; domBubbles = {};
    return '<div class="screen live"><div class="topbar"><button class="iconbtn" data-act="menu" aria-label="Menu">⋯</button><div style="text-align:center"><div style="font-weight:900;font-size:16px" id="lt"></div><div class="sub" id="ls"></div></div><button class="iconbtn" data-act="pausetog" id="pz" aria-label="Pause">❚❚</button></div>' +
      '<div class="stage" id="stage"><div class="stage-inner" id="inner"></div></div><div class="panel" id="panel"></div></div>';
  }
  function liveFrame() { lastPanel = ''; domBubbles = {}; updateLive(); updateLive(); }
  function startTick() { timer = setInterval(updateLive, 500); }
  function stopTick() { if (timer) { clearInterval(timer); timer = null; } }

  function updateLive() {
    var s = store.live; if (!s) return;
    var t = now(), stage = document.getElementById('stage'), inner = document.getElementById('inner');
    if (!stage) return;
    var W = stage.clientWidth, H = stage.clientHeight;
    var cur = s.current ? s.current.pid : null, sug = L.suggestion(s, t), running = L.isRunning(s);
    var totals = {}; s.people.forEach(function (p) { totals[p.id] = L.totalMs(s, p.id, t); });
    var radii = L.bubbleRadii(totals, cur, W, H);
    var items = s.people.map(function (p) { return { id: p.id, r: radii[p.id], first: p.id === (cur || sug) }; });
    var pk = L.packBubbles(items, W, H, 8);
    /* Écran court: si les bulles débordent sous la zone visible, on les réduit (rayon mini 22 px, touchable)
       jusqu'à tout faire tenir sans défiler. Au-delà (beaucoup de monde), la zone reste défilante. */
    for (var it2 = 0; it2 < 10 && pk.height > H + 1; it2++) {
      var minR = Math.min.apply(null, items.map(function (x) { return x.r; }));
      if (minR <= 22) break;
      var k = Math.max(22 / minR, Math.min(0.96, (H - 10) / pk.height));
      items = items.map(function (x) { return { id: x.id, r: Math.max(22, x.r * k), first: x.first }; });
      items.forEach(function (x) { radii[x.id] = x.r; });
      pk = L.packBubbles(items, W, H, 8);
    }
    inner.style.height = pk.height + 'px';
    var total = s.people.reduce(function (a, p) { return a + totals[p.id]; }, 0);
    document.getElementById('lt').textContent = 'Table de ' + s.people.length;
    document.getElementById('ls').textContent = 'Parole cumulée ' + L.mmss(total);
    document.getElementById('pz').textContent = running ? '❚❚' : (cur ? '▶' : '❚❚');
    document.getElementById('pz').style.visibility = cur ? 'visible' : 'hidden';
    s.people.forEach(function (p) {
      var el = domBubbles[p.id], r = radii[p.id], c = pk.pos[p.id];
      if (!el) {
        el = document.createElement('div'); el.className = 'bubble'; el.setAttribute('data-act', 'speak'); el.setAttribute('data-id', p.id);
        inner.appendChild(el); domBubbles[p.id] = el; el.__r = -1;
      }
      var isCur = p.id === cur, isSug = p.id === sug && !isCur;
      var fresh = el.__r === -1; el.__r = 0;
      el.className = 'bubble' + (fresh ? ' nt' : '') + (isCur ? ' active' + (running ? ' running' : ' paused') : '') + (isSug ? ' sug' : '');
      el.style.width = el.style.height = (r * 2) + 'px';
      el.style.left = (c.x - r) + 'px'; el.style.top = (c.y - r) + 'px';
      el.style.background = isCur ? '#fff' : bgFor(p.avatar); el.style.borderColor = bdFor(p.avatar);
      var asz = Math.round(r * (isCur ? 1.05 : 1.0)), fs = Math.max(11, Math.min(16, Math.round(r / 4.4)));
      var inside = '';
      if (isCur) {
        var el0 = L.elapsedCurrent(s, t), over = el0 > s.durationMs, prog = Math.min(1, el0 / s.durationMs) * 100;
        var x2 = (el0 - s.durationMs) / s.durationMs, f2 = x2 <= 0 ? 0 : (x2 % 1 === 0 ? 1 : x2 % 1), prog2 = f2 * 100;
        inside += '<svg class="ring" viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="46" pathLength="100"/><circle class="prog" cx="50" cy="50" r="46" pathLength="100" stroke-dasharray="' + (over ? 100 : prog.toFixed(1)) + ' 100"/>' +
          (over ? '<circle class="prog2" cx="50" cy="50" r="46" pathLength="100" stroke-dasharray="' + Math.max(0.6, prog2).toFixed(1) + ' 100"/>' : '') + '</svg>';
      }
      inside += '<div class="av" style="width:' + asz + 'px;height:' + asz + 'px;margin-top:' + Math.round(r * 0.04) + 'px">' + avatarHtml(p.avatar, asz, isCur && running) + '</div>';
      inside += '<div class="bn" style="font-size:' + fs + 'px">' + esc(p.name) + '</div><div class="bt" style="font-size:' + (fs - 1) + 'px">' + L.mmss(totals[p.id]) + '</div>';
      var tc = L.turnCount(s, p.id, t), th = L.turnHue(s, p.id, t);
      inside += '<span class="tbadge" style="background:hsl(' + th + ',60%,42%)" aria-label="' + tc + ' tours de parole">' + tc + '</span>';
      if (isSug) inside += '<span class="star">★</span>';
      if (fresh) { void el.offsetWidth; }
      var sig = inside;
      if (el.__sig !== sig) { el.innerHTML = inside; el.__sig = sig; }
      if (fresh) { (function (e) { requestAnimationFrame(function () { requestAnimationFrame(function () { e.classList.remove('nt'); }); }); })(el); }
    });
    /* panneau du bas */
    var panel = '', el1 = cur ? L.elapsedCurrent(s, t) : 0, left = s.durationMs - el1;
    var sp = sug ? s.people.filter(function (p) { return p.id === sug; })[0] : null;
    var rk = L.rank(s, t);
    var timerHtml;
    if (cur) {
      var cp = s.people.filter(function (p) { return p.id === cur; })[0];
      timerHtml = '<div class="timer"><div class="big' + (left < 0 ? ' over' : '') + '" id="big">' + (left < 0 ? '+' + L.mmss(-left) : L.mmss(left)) + '</div><div class="txt"><b>' + esc(cp.name) + '</b> ' + (running ? 'parle' : 'est en pause') + '<br><span>' + (left < 0 ? 'Dépassement, tranquille. Pas d\'alarme.' : 'Compte à rebours de ' + L.mmss(s.durationMs)) + '</span></div></div>';
    } else {
      timerHtml = '<div class="timer"><div class="txt"><b>Personne ne parle.</b><br><span>Touche une bulle, ou « Personne suivante ».</span></div></div>';
    }
    var sugHtml = sp ? '<div class="suggest"><div class="sa">' + avatarHtml(sp.avatar, 40) + '</div><div class="st"><b>' + esc(sp.name) + '</b> ' + (totals[sp.id] === 0 && !s.counts[sp.id] ? 'n\'a pas encore parlé' : 'a parlé ' + L.mmss(totals[sp.id])) + (rk.newRound ? '<br>Nouveau tour : tout le monde est reproposé' : '') + '</div>' +
      (rk.order.length > 1 ? '<button class="pass" data-act="skip">Passer</button>' : '') + '</div>' : '';
    var main = (cur && !running) ?
      '<button class="btn accent" data-act="pausetog" style="flex:1">▶ Reprendre</button>' :
      '<button class="btn accent" data-act="next" style="flex:1">Personne suivante ›</button>';
    panel = sugHtml + '<div class="row">' + main + (cur && running ? '<button class="btn" data-act="stopturn" style="width:auto;padding:14px 12px;font-size:15px">Silence</button>' : '') + '<button class="btn" data-act="endask" style="width:auto;padding:14px 16px">■ Fin</button></div>';
    var sigP = sugHtml + panel + (cur ? (running ? 'c' : 'p') : 'n');
    var holder = document.getElementById('panel');
    if (sigP !== lastPanel) { holder.innerHTML = '<div id="tm"></div>' + panel; lastPanel = sigP; }
    document.getElementById('tm').innerHTML = timerHtml;
  }

  /* ---------- Actions de session ---------- */
  function mutate(fn) {
    var s0 = store.live; if (!s0) return;
    store.undo = L.clone(s0);
    store.live = fn(s0); save(); updateLive();
  }
  function showToast(text, undo) {
    ui.toast = { text: text, undo: undo }; render();
    setTimeout(function () { if (ui.toast && ui.toast.text === text) { ui.toast = null; render(); } }, 5000);
  }
  function doUndo() {
    if (!store.undo) return;
    store.live = store.undo; store.undo = null; ui.toast = null; ui.menu = false; save(); render();
  }
  function endSession() {
    var res = L.finish(store.live, now());
    store.sessions.push(res); store.live = null; store.undo = null; save(); bridge(false);
    ui.summary = res; ui.summaryFrom = null; ui.menu = false; go('summary');
  }

  /* ---------- Bilan ---------- */
  function summary() {
    var r = ui.summary, ppl = r.people.slice().sort(function (a, b) { return b.ms - a.ms; });
    var total = r.people.reduce(function (a, p) { return a + p.ms; }, 0), mx = Math.max.apply(null, ppl.map(function (p) { return p.ms; }).concat([1]));
    var h = '<div class="screen"><div class="topbar"><span style="width:44px"></span><h1>Bilan</h1><span style="width:44px"></span></div><div class="scroll">';
    if (ui.summaryFrom === 'dash') h += '<div class="sub" style="text-align:center;font-weight:800">' + esc(fmtDate(r.startedAt)) + '</div>';
    h += '<div class="sub" style="text-align:center">Session de ' + L.mmss(r.endedAt - r.startedAt) + ' · ' + r.people.length + ' personnes</div>';
    h += '<div class="stats"><div class="stat"><b>' + L.mmss(total) + '</b><span>parole cumulée</span></div><div class="stat"><b>' + r.people.reduce(function (a, p) { return a + p.turns; }, 0) + '</b><span>prises</span></div><div class="stat"><b>' + (r.rounds || 1) + '</b><span>tour(s)</span></div></div>';
    h += '<div class="cluster" id="scl" style="height:230px"></div><div class="table"><div class="th"><span style="flex:1">Qui</span><span class="c1">Temps</span><span class="c3">Prises</span></div>';
    h += ppl.map(function (p) {
      return '<div class="tr"><div style="width:34px">' + avatarHtml(p.avatar, 32) + '</div><div class="n">' + esc(p.name) + (p.guest ? ' <i style="font-weight:600">(invité)</i>' : '') + '<div class="bar" style="width:' + Math.round(p.ms / mx * 100) + '%;background:' + bdFor(p.avatar) + ';margin-top:2px;min-width:3px"></div></div><div class="c1">' + L.mmss(p.ms) + '</div><div class="c3">' + p.turns + '</div></div>';
    }).join('') + '</div></div>' + (ui.summaryFrom === 'dash' ?
      '<div class="footer"><div class="row"><button class="btn" data-act="delsess" style="color:#b3261e;border-color:#b3261e">Supprimer</button><button class="btn primary" data-act="back">‹ Retour</button></div></div></div>' :
      '<div class="footer"><button class="btn primary" data-act="home">Terminer</button></div></div>');
    return h;
  }
  function clusterInto(id, list, tkey) {
    var el = document.getElementById(id); if (!el) return;
    var W = el.clientWidth, H = el.clientHeight, tot = {};
    list.forEach(function (p) { tot[p.id] = p[tkey]; });
    var radii = L.bubbleRadii(tot, null, W, H);
    Object.keys(radii).forEach(function (k) { radii[k] = Math.min(radii[k], 64); });
    var pk = L.packBubbles(list.map(function (p) { return { id: p.id, r: radii[p.id] }; }), W, H, 5);
    el.style.height = pk.height + 'px';
    el.innerHTML = list.map(function (p) {
      var r = radii[p.id], c = pk.pos[p.id], a = Math.round(r * 1.05);
      return '<div class="bubble" style="width:' + 2 * r + 'px;height:' + 2 * r + 'px;left:' + (c.x - r) + 'px;top:' + (c.y - r) + 'px;background:' + bgFor(p.avatar) + ';border-color:' + bdFor(p.avatar) + '"><div class="av" style="width:' + a + 'px;height:' + a + 'px">' + avatarHtml(p.avatar, a) + '</div><div class="bn" style="font-size:' + Math.max(8, Math.min(16, Math.round(r / 4.4))) + 'px">' + esc(p.name) + '</div></div>';
    }).join('');
  }
  function summaryCluster() { clusterInto('scl', ui.summary.people, 'ms'); }

  function fmtDate(t) {
    try { return new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  function sessKey(x) { return x.id || String(x.startedAt); }
  function sessionList() {
    var list = store.sessions.slice().sort(function (a, b) { return b.startedAt - a.startedAt; });
    var h = '<h2 style="margin-top:18px">Toutes les sessions (' + list.length + ')</h2>';
    if (!list.length) return h + '<div class="empty" style="padding:10px">Aucune session enregistrée.</div>';
    return h + list.map(function (x) {
      var tot = x.people.reduce(function (a, p) { return a + p.ms; }, 0);
      return '<button class="sessrow" data-act="opensess" data-id="' + esc(sessKey(x)) + '"><span class="sd">' + esc(fmtDate(x.startedAt)) + '</span><span class="ss">' + x.people.length + ' pers. · parole ' + fmtTot(tot) + ' · durée ' + fmtTot(x.endedAt - x.startedAt) + '</span><span class="sg">›</span></button>';
    }).join('');
  }
  function fmtTot(ms) { return ms >= 3600000 ? L.hm(ms) : L.mmss(ms); }
  /* ---------- Tableau de bord ---------- */
  function dash() {
    var d = ui.dash, ag = L.aggregate(store.sessions, store.people, { onlyFavorites: d.fav, period: d.period }, now());
    var h = '<div class="screen"><div class="topbar"><button class="iconbtn" data-act="back" aria-label="Retour">‹</button><h1>Tableau de bord</h1><span style="width:44px"></span></div><div class="scroll">';
    h += '<div class="chips"><button class="chip ' + (d.fav ? 'sel' : '') + '" data-act="dfav" data-v="1">★ Favoris</button><button class="chip ' + (!d.fav ? 'sel' : '') + '" data-act="dfav" data-v="0">Tous</button></div>';
    h += '<div class="chips">' + [['week', 'Semaine'], ['month', 'Mois'], ['all', 'Tout']].map(function (x) { return '<button class="chip warm ' + (d.period === x[0] ? 'sel' : '') + '" data-act="dper" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    h += '<div class="stats"><div class="stat"><b>' + ag.sessions + '</b><span>sessions</span></div><div class="stat"><b>' + fmtTot(ag.totalMs) + '</b><span>parole totale</span></div><div class="stat"><b>' + L.mmss(ag.avgMs) + '</b><span>moyenne / prise</span></div></div>';
    if (!ag.rows.length) h += '<div class="empty">Aucune personne à afficher.<br>Ajoute des personnes, ou choisis « Tous ».</div>';
    else if (!ag.sessions) h += '<div class="empty">Pas encore de session sur cette période.<br>Lance une session pour remplir ce tableau.</div>';
    else {
      h += '<div class="cluster" id="dcl" style="height:240px"></div><div class="table"><div class="th"><span style="flex:1">Qui</span><span class="c1">Total</span><span class="c2">Moy.</span><span class="c3">Prises</span></div>';
      h += ag.rows.slice().sort(function (a, b) { return b.ms - a.ms; }).map(function (p) {
        return '<div class="tr"><div style="width:34px">' + avatarHtml(p.avatar, 32) + '</div><div class="n">' + esc(p.name) + '</div><div class="c1">' + fmtTot(p.ms) + '</div><div class="c2">' + (p.turns ? L.mmss(p.avgMs) : '–') + '</div><div class="c3">' + p.turns + '</div></div>';
      }).join('') + '</div>';
    }
    h += sessionList();
    h += '</div></div>';
    return h;
  }
  function dashCluster() {
    var d = ui.dash, ag = L.aggregate(store.sessions, store.people, { onlyFavorites: d.fav, period: d.period }, now());
    if (ag.sessions && ag.rows.length) clusterInto('dcl', ag.rows, 'ms');
  }

  /* ---------- Réglages ---------- */
  function settings() {
    var st = store.settings;
    return '<div class="screen"><div class="topbar"><button class="iconbtn" data-act="back" aria-label="Retour">‹</button><h1>Réglages</h1><span style="width:44px"></span></div><div class="scroll">' +
      '<h2>Durée par défaut</h2><div class="card"><div class="stepper"><button class="iconbtn" data-act="sdur" data-d="-1">−</button><div class="val">' + st.minutes + ' min</div><button class="iconbtn" data-act="sdur" data-d="1">+</button></div></div>' +
      '<div class="card kv"><span>Garder l\'écran allumé</span><button class="chip ' + (st.keepAwake ? 'sel' : '') + '" data-act="sawake">' + (st.keepAwake ? 'Oui' : 'Non') + '</button></div>' +
      '<h2>Données</h2><div class="card"><div class="sub" style="margin-bottom:8px">Tout reste sur ce téléphone : ' + store.people.length + ' personnes, ' + store.sessions.length + ' sessions.</div><button class="btn" data-act="wipe" style="color:#b3261e;border-color:#b3261e">Effacer l\'historique des sessions</button></div>' +
      '<div class="sub" style="text-align:center;margin-top:14px">Tour à tour · version 1.0</div></div></div>';
  }

  /* ---------- Événements ---------- */
  function guestDialog(cb) {
    ui.dlg = { title: 'Invité éphémère', msg: 'Il compte pour cette session seulement et n\'est pas enregistré.', buttons: [], input: true };
    $app.insertAdjacentHTML('beforeend', '<div class="dlgback" id="gd"><div class="dlg"><h3>Invité éphémère</h3><p>Il compte pour cette session seulement et n\'est pas enregistré.</p><input class="field" id="gname" placeholder="Prénom" maxlength="20" autocomplete="off"><button class="btn primary" data-act="gok">Ajouter</button><button class="btn" data-act="gno">Annuler</button></div></div>');
    ui.dlg = null; guestCb = cb;
  }
  var guestCb = null;

  function sampleGuest(name) {
    var n = Math.floor(Math.random() * 6);
    var styles = ['short', 'long', 'pony', 'curly', 'bun', 'short'];
    return { id: L.uid(), name: name, guest: true, avatar: { style: styles[n], skin: Math.floor(Math.random() * 6), hair: Math.floor(Math.random() * 5), shirt: n } };
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act]'); if (!t) return;
    var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
    var s = store.live, e = ui.edit;
    switch (act) {
      case 'closemenu': if (ev.target === t) { ui.menu = false; render(); } break;
      case 'dlgbtn': var b = ui.dlg.buttons[+t.getAttribute('data-i')]; closeDlg(); if (b.fn) b.fn(); break;
      case 'opensess':
        var ss = store.sessions.filter(function (x) { return sessKey(x) === id; })[0];
        if (ss) { ui.summary = ss; ui.summaryFrom = 'dash'; go('summary'); } break;
      case 'delsess':
        var sk = ui.summary && sessKey(ui.summary);
        dialog('Supprimer cette session ?', 'Elle disparaît de la liste et ses temps sont retirés des statistiques. Cette action est définitive.', [
          { label: 'Supprimer', cls: 'primary', fn: function () { store.sessions = store.sessions.filter(function (x) { return sessKey(x) !== sk; }); save(); ui.summary = null; ui.summaryFrom = null; go('dash'); } }, { label: 'Garder' }]);
        break;
      case 'back': window.__back(); break;
      case 'home': go('home'); break;
      case 'settings': go('settings'); break;
      case 'dash': go('dash'); break;
      case 'newp': startEdit(null, 'home'); break;
      case 'editp': startEdit(person(id), 'home'); break;
      case 'newfromsetup': startEdit(null, 'setup'); break;
      case 'cat': e.name = document.getElementById('nm').value; e.cat = t.getAttribute('data-c'); render(); break;
      case 'preset':
        e.name = document.getElementById('nm').value;
        var pr = A.PRESETS.filter(function (x) { return x.id === id; })[0];
        e.avatar.style = pr.style; e.avatar.child = !!pr.child; e.avatar.glasses = !!pr.glasses; e.avatar.beard = !!pr.beard; render(); break;
      case 'sw': e.name = document.getElementById('nm').value; e.avatar[t.getAttribute('data-key')] = +t.getAttribute('data-i'); render(); break;
      case 'togfav': e.name = document.getElementById('nm').value; e.fav = !e.fav; render(); break;
      case 'savep': saveEdit(); break;
      case 'delp':
        dialog('Supprimer ' + e.name + ' ?', 'La personne disparaît de la liste. Ses temps passés restent dans l\'historique.', [
          { label: 'Supprimer', cls: 'primary', fn: function () { store.people = store.people.filter(function (p) { return p.id !== e.id; }); save(); go('home'); } }, { label: 'Garder' }]);
        break;
      case 'newsession': startSetup(); break;
      case 'tog': ui.setup.sel[id] = !ui.setup.sel[id]; render(); break;
      case 'rmguest': ui.setup.guests = ui.setup.guests.filter(function (g) { return g.id !== id; }); render(); break;
      case 'addguest': guestDialog(function (nm) { ui.setup.guests.push(sampleGuest(nm)); render(); }); break;
      case 'addlive': ui.menu = false; render(); guestDialog(function (nm) { mutate(function (x) { return L.addPerson(x, sampleGuest(nm)); }); }); break;
      case 'gok': var v = document.getElementById('gname').value.trim(); if (v) { var cb = guestCb; var gd = document.getElementById('gd'); gd.parentNode.removeChild(gd); cb(v); } break;
      case 'gno': var g2 = document.getElementById('gd'); g2.parentNode.removeChild(g2); break;
      case 'dur': ui.setup.minutes = Math.max(1, Math.min(30, ui.setup.minutes + +t.getAttribute('data-d'))); render(); break;
      case 'togawake': ui.setup.keepAwake = !ui.setup.keepAwake; render(); break;
      case 'launch': launch(); break;
      case 'resume': ui.screen = 'live'; bridge(store.settings.keepAwake); render(); break;
      case 'menu': ui.menu = true; render(); break;
      case 'speak': mutate(function (x) { return L.startTurn(x, id, now()); }); break;
      case 'next': mutate(function (x) { return L.nextPerson(x, now()); }); break;
      case 'skip': store.live = L.skipSuggestion(s); save(); updateLive(); break;
      case 'stopturn': mutate(function (x) { return L.stopTurn(x, now()); }); showToast('Plus personne ne parle', true); break;
      case 'pausetog': mutate(function (x) { return L.isRunning(x) ? L.pause(x, now()) : L.resume(x, now()); }); break;
      case 'undo': doUndo(); break;
      case 'endask': ui.menu = false;
        dialog('Terminer la session ?', 'Le bilan s\'affiche et les temps sont gardés dans le tableau de bord.', [{ label: 'Terminer', cls: 'primary', fn: endSession }, { label: 'Continuer' }]); break;
      case 'dfav': ui.dash.fav = t.getAttribute('data-v') === '1'; render(); break;
      case 'dper': ui.dash.period = t.getAttribute('data-v'); render(); break;
      case 'sdur': store.settings.minutes = Math.max(1, Math.min(30, store.settings.minutes + +t.getAttribute('data-d'))); save(); render(); break;
      case 'sawake': store.settings.keepAwake = !store.settings.keepAwake; save(); render(); break;
      case 'wipe': dialog('Effacer l\'historique ?', 'Les sessions passées sont supprimées. Les personnes restent.', [{ label: 'Effacer', cls: 'primary', fn: function () { store.sessions = []; save(); render(); } }, { label: 'Garder' }]); break;
    }
  });

  /* Données de départ : aucune, l'utilisateur crée ses personnes. Hook de test. */
  window.__tp = { store: store, render: render, save: save, go: go, ui: ui };
  if (store.live) { /* reprise proposée depuis l'accueil */ }
  render();
})();

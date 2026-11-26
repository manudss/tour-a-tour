/* Avatars de personnes dessinés en SVG : enfants, ados, adultes, aînés. */
(function (root) {
  'use strict';
  var SKIN = ['#F6D5B8', '#E9B98F', '#C98B5E', '#A66E4A', '#7A4B2E', '#5A3523'];
  var HAIR = ['#2B1B14', '#6B4429', '#B5732E', '#E3B85C', '#C4C4C8', '#C23B3B'];
  var SHIRT = ['#FFB44D', '#FF7A8A', '#F28A4B', '#8E7CE8', '#4CC49A', '#5AA9F0'];
  var CATS = [['all', 'Tous'], ['enfant', 'Enfants'], ['ado', 'Ados'], ['adulte', 'Adultes'], ['aine', 'Aînés']];
  var PRESETS = [
    { id: 'e1', cat: 'enfant', style: 'pig', child: true, skin: 0, hair: 2, shirt: 1 },
    { id: 'e2', cat: 'enfant', style: 'curly', child: true, skin: 3, hair: 0, shirt: 4 },
    { id: 'e3', cat: 'enfant', style: 'pony', child: true, skin: 1, hair: 1, shirt: 3 },
    { id: 'a1', cat: 'ado', style: 'short', skin: 4, hair: 0, shirt: 0 },
    { id: 'a2', cat: 'ado', style: 'long', skin: 2, hair: 0, shirt: 5 },
    { id: 'a3', cat: 'ado', style: 'curly', skin: 5, hair: 0, shirt: 2 },
    { id: 'd1', cat: 'adulte', style: 'short', skin: 1, hair: 0, shirt: 2 },
    { id: 'd2', cat: 'adulte', style: 'bun', glasses: true, skin: 0, hair: 5, shirt: 3 },
    { id: 'd3', cat: 'adulte', style: 'long', skin: 0, hair: 1, shirt: 4 },
    { id: 'o1', cat: 'aine', style: 'bun', glasses: true, skin: 0, hair: 4, shirt: 3 },
    { id: 'o2', cat: 'aine', style: 'bald', glasses: true, skin: 2, hair: 4, shirt: 5 },
    { id: 'o3', cat: 'aine', style: 'short', glasses: true, skin: 3, hair: 4, shirt: 1 }
  ];

  function norm(a) {
    a = a || {};
    return {
      style: a.style || 'short', child: !!a.child, glasses: !!a.glasses,
      skin: SKIN[a.skin != null ? a.skin : 1] || a.skinHex || SKIN[1],
      hair: HAIR[a.hair != null ? a.hair : 0] || a.hairHex || HAIR[0],
      shirt: SHIRT[a.shirt != null ? a.shirt : 0] || SHIRT[0]
    };
  }

  function svg(avatar, size, speaking) {
    var o = norm(avatar), sk = o.skin, hc = o.hair, sh = o.shirt, ch = o.child, st = o.style;
    var cy = ch ? 52 : 48, rx = ch ? 27 : 25, ry = ch ? 27 : 28;
    var back = '', front = '';
    var top = '<path d="M' + (50 - rx) + ' ' + (cy - 2) + ' Q' + (50 - rx - 1) + ' ' + (cy - ry - 8) + ' 50 ' + (cy - ry - 6) +
      ' Q' + (50 + rx + 1) + ' ' + (cy - ry - 8) + ' ' + (50 + rx) + ' ' + (cy - 2) + ' Q' + (50 + rx - 8) + ' ' + (cy - 16) +
      ' 50 ' + (cy - 16) + ' Q' + (50 - rx + 8) + ' ' + (cy - 16) + ' ' + (50 - rx) + ' ' + (cy - 2) + 'Z" fill="' + hc + '"/>';
    if (st === 'short') front = top;
    else if (st === 'long') {
      back = '<path d="M' + (50 - rx - 3) + ' ' + cy + ' Q' + (50 - rx - 4) + ' ' + (cy - ry - 10) + ' 50 ' + (cy - ry - 8) + ' Q' +
        (50 + rx + 4) + ' ' + (cy - ry - 10) + ' ' + (50 + rx + 3) + ' ' + cy + ' L' + (50 + rx + 5) + ' ' + (cy + 34) + ' L' + (50 - rx - 5) + ' ' + (cy + 34) + 'Z" fill="' + hc + '"/>';
      front = top;
    } else if (st === 'pony') { back = '<ellipse cx="' + (50 + rx + 3) + '" cy="' + (cy + 8) + '" rx="7" ry="16" fill="' + hc + '"/>'; front = top; }
    else if (st === 'pig') { back = '<circle cx="' + (50 - rx - 5) + '" cy="' + (cy + 8) + '" r="9" fill="' + hc + '"/><circle cx="' + (50 + rx + 5) + '" cy="' + (cy + 8) + '" r="9" fill="' + hc + '"/>'; front = top; }
    else if (st === 'bun') { back = '<circle cx="50" cy="' + (cy - ry - 6) + '" r="10" fill="' + hc + '"/>'; front = top; }
    else if (st === 'curly') {
      var c = '';
      for (var a = 190; a < 360; a += 28) {
        c += '<circle cx="' + (50 + 26 * Math.cos(a * Math.PI / 180)).toFixed(1) + '" cy="' + (cy - 8 + 23.4 * Math.sin(a * Math.PI / 180)).toFixed(1) + '" r="9" fill="' + hc + '"/>';
      }
      front = c + top;
    }
    var gl = o.glasses ? '<g fill="none" stroke="#2B2A33" stroke-width="2.2"><circle cx="39" cy="' + (cy + 2) + '" r="8"/><circle cx="61" cy="' + (cy + 2) + '" r="8"/><path d="M47 ' + (cy + 2) + ' H53"/></g>' : '';
    var er = ch ? 4.2 : 3.4, eyes = '';
    [39, 61].forEach(function (x) {
      eyes += '<circle cx="' + x + '" cy="' + (cy + 2) + '" r="' + er + '" fill="#2B2A33"/><circle cx="' + (x + 1.3) + '" cy="' + (cy + 0.5) + '" r="1.3" fill="#fff"/>';
    });
    var mouth = speaking ?
      '<ellipse cx="50" cy="' + (cy + 18) + '" rx="6" ry="6.5" fill="#7A2B3A"/>' :
      '<path d="M42 ' + (cy + 15) + ' Q50 ' + (cy + 23) + ' 58 ' + (cy + 15) + '" stroke="#2B2A33" stroke-width="3" fill="none" stroke-linecap="round"/>';
    return '<svg class="avatar" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" aria-hidden="true">' + back +
      '<path d="M14 100 Q16 ' + (cy + 30) + ' 50 ' + (cy + 30) + ' Q84 ' + (cy + 30) + ' 86 100Z" fill="' + sh + '"/>' +
      '<rect x="43" y="' + (cy + 22) + '" width="14" height="12" fill="' + sk + '"/>' +
      '<ellipse cx="' + (50 - rx) + '" cy="' + (cy + 4) + '" rx="4" ry="6" fill="' + sk + '"/><ellipse cx="' + (50 + rx) + '" cy="' + (cy + 4) + '" rx="4" ry="6" fill="' + sk + '"/>' +
      '<ellipse cx="50" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + sk + '"/>' + front +
      '<ellipse cx="31" cy="' + (cy + 12) + '" rx="5" ry="3.2" fill="#FF6F7F" opacity=".35"/><ellipse cx="69" cy="' + (cy + 12) + '" rx="5" ry="3.2" fill="#FF6F7F" opacity=".35"/>' +
      eyes + gl + mouth + '</svg>';
  }

  root.TPAvatar = { SKIN: SKIN, HAIR: HAIR, SHIRT: SHIRT, CATS: CATS, PRESETS: PRESETS, svg: svg, norm: norm };
})(typeof self !== 'undefined' ? self : this);

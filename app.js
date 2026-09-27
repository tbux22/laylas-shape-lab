/* Layla's Shape Lab — no external requests, progress saved in localStorage */
'use strict';
const $ = s => document.querySelector(s);
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => String(Math.round(n * 100) / 100);
const U = ['cm', 'm', 'in', 'ft', 'yd'];
const VW = 320, VH = 210;
let TOKEN = 0; // cancels running animations when screen changes
const later = (ms, fn) => { const t = TOKEN; setTimeout(() => { if (t === TOKEN) fn(); }, ms); };

/* ---------- storage ---------- */
const KEY = 'laylaShapeLab.v1';
let S; try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
S.stars = S.stars || {}; S.best = S.best || 0;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const total = () => Object.values(S.stars).reduce((a, b) => a + b, 0);
const starsOf = m => S.stars[m] || 0;
const level = m => { const s = starsOf(m); return s < 4 ? 1 : s < 10 ? 2 : 3; };
function refreshStars() { $('#starNum').textContent = total(); }
const RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const BF = (cls = '', st = '') => `<svg class="bf ${cls}" style="${st}" aria-hidden="true"><use href="#bf"/></svg>`;
const BFCOL = [['#e98aab', '#f7c3d3'], ['#b9a3dd', '#dccff0'], ['#6cc7bb', '#bfe9e3'], ['#f2a36b', '#f9d3b5']];
function flutter(fb) { // butterflies fly across the feedback strip only (never over shapes/inputs)
  if (!fb) return;
  if (RM) { fb.insertAdjacentHTML('beforeend', BF()); return; }
  const w = fb.clientWidth;
  for (let i = 0; i < 3; i++) {
    const c = BFCOL[i % BFCOL.length], el = document.createElement('div');
    el.innerHTML = `<span class="fly">${BF('flap', `--bf1:${c[0]};--bf2:${c[1]}`)}</span>`; const b = el.firstChild; fb.appendChild(b);
    const a = b.animate([{ transform: 'translate(-40px,6px)' }, { transform: `translate(${w * .33}px,-4px)` }, { transform: `translate(${w * .66}px,8px)` }, { transform: `translate(${w + 40}px,-2px)` }], { duration: 1900, delay: i * 260, easing: 'ease-in-out', fill: 'both' });
    a.onfinish = () => b.remove();
  }
}
function skyButterflies(n = 8) { // result screen only (no shapes or inputs there)
  if (RM) return;
  for (let i = 0; i < n; i++) {
    const c = BFCOL[i % BFCOL.length], el = document.createElement('div');
    el.innerHTML = `<span class="skyfly" style="left:${10 + Math.random() * 80}vw;top:100vh">${BF('flap', `--bf1:${c[0]};--bf2:${c[1]}`)}</span>`; const b = el.firstChild; document.body.appendChild(b);
    const sway = (Math.random() - .5) * 120;
    b.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${sway}px,-45vh) rotate(${sway / 8}deg)` }, { transform: `translate(${-sway / 2}px,-115vh)` }], { duration: 3200 + Math.random() * 1200, delay: i * 180, easing: 'ease-out', fill: 'both' }).onfinish = () => b.remove();
  }
}

/* ---------- svg helpers ---------- */
function mapper(pts, m = 36, W = VW, H = VH) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const s = Math.min((W - 2 * m) / ((maxx - minx) || 1), (H - 2 * m) / ((maxy - miny) || 1));
  const ox = (W - (maxx - minx) * s) / 2 - minx * s, oy = (H - (maxy - miny) * s) / 2 - miny * s;
  const X = x => ox + x * s, Y = y => oy + y * s;
  return { s, X, Y, P: p => [X(p[0]), Y(p[1])] };
}
const ptsStr = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
const txt = (x, y, t, cls = '') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="lbl ${cls}" text-anchor="middle" dominant-baseline="middle" style="paint-order:stroke;stroke:${/\bw\b/.test(cls) ? '#c2416e' : '#fff'};stroke-width:${/\bw\b/.test(cls) ? 2 : 5}px;stroke-linejoin:round">${t}</text>`;
function segLbl(a, b, t, cls, c, off) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
  if ((mx - c[0]) * nx + (my - c[1]) * ny < 0) { nx = -nx; ny = -ny; }
  const o = off || (14 + Math.abs(nx) * t.length * 3.6);
  return txt(mx + nx * o, my + ny * o, t, cls);
}
const cen = a => [a.reduce((s, p) => s + p[0], 0) / a.length, a.reduce((s, p) => s + p[1], 0) / a.length];
function raMark(f, dx, up = -1) { const k = 10; return `<path class="ra" d="M${f[0] + dx * k},${f[1]} L${f[0] + dx * k},${f[1] + up * k} L${f[0]},${f[1] + up * k}"/>`; }
const svgWrap = inner => `<svg class="stage" viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
function trace(el) { // animate teal perimeter line
  el.querySelectorAll('.perim.anim').forEach(p => { p.style.transition = 'none'; p.style.strokeDasharray = '100'; p.style.strokeDashoffset = '100'; p.getBoundingClientRect(); p.style.transition = ''; p.classList.add('tr'); requestAnimationFrame(() => p.style.strokeDashoffset = '0'); });
}

/* ---------- shape builders: return {svg, hint(el), extra} ---------- */
function drawPara(b, h, o, u, opt = {}) {
  const shape = [[o, 0], [o + b, 0], [b, h], [0, h]];
  const M = mapper(shape.concat([[o + b + (opt.room ? 0.01 : 0), 0]])), P = shape.map(M.P), c = cen(P);
  const top = M.P([o, 0]), foot = M.P([o, h]);
  const piece = [[0, h], [o, h], [o, 0]].map(M.P);
  const rest = [[o, 0], [o + b, 0], [b, h], [o, h]].map(M.P), rect = [[o, 0], [o + b, 0], [o + b, h], [o, h]].map(M.P);
  let s = `<polygon class="fillA" points="${ptsStr(rest)}"/>`;
  s += `<polygon class="rectg fade hide" points="${ptsStr(rect)}" fill="none" stroke="#c2416e" stroke-width="3" stroke-dasharray="7 5"/>`;
  s += `<g class="slide" data-dx="${(b * M.s).toFixed(1)}"><polygon points="${ptsStr(piece)}" fill="#f6a9c4"/></g>`;
  s += `<polygon class="pedge ${opt.perim ? 'perim anim' : 'edge'}" pathLength="100" points="${ptsStr(P)}" style="transition:opacity .6s"/>`;
  if (!opt.noH) s += `<line class="hline" x1="${top[0]}" y1="${top[1]}" x2="${foot[0]}" y2="${foot[1]}"/>` + raMark(foot, 1) + txt(top[0] + 22 + String(h).length * 3, (top[1] + foot[1]) / 2, `${fmt(h)} ${u}`, 'h');
  s += segLbl(P[2], P[3], `${fmt(b)} ${u}`, '', c);
  if (opt.slant) s += segLbl(P[3], P[0], `${fmt(opt.slant)} ${u}`, 's', c);
  if (opt.showTop) s += segLbl(P[0], P[1], `${fmt(b)} ${u}`, opt.perim ? 'p' : '', c);
  if (opt.showRight && opt.slant) s += segLbl(P[1], P[2], `${fmt(opt.slant)} ${u}`, 's', c);
  return {
    svg: svgWrap(s),
    hint(el) { const g = el.querySelector('.slide'); g.style.transform = 'translate(0px,0px)'; g.getBoundingClientRect(); later(250, () => { g.style.transform = `translate(${g.dataset.dx}px,0px)`; el.querySelector('.pedge').style.opacity = '.25'; }); later(1500, () => el.querySelector('.rectg').classList.remove('hide')); }
  };
}
function drawTri(b, h, a, u, opt = {}) {
  const shape = [[a, 0], [b, h], [0, h]];
  const copy = shape.map(p => [a + b - p[0], h - p[1]]);
  const M = mapper(opt.noCopy ? shape.concat([[Math.min(0, a), h]]) : shape.concat(copy));
  const P = shape.map(M.P), C = copy.map(M.P), c = cen(P);
  const top = M.P([a, 0]), foot = M.P([a, h]);
  const mid = M.P([(a + b) / 2, h / 2]);
  let s = '';
  s += `<g class="copy fade hide" style="transform-box:view-box;transform-origin:${mid[0].toFixed(1)}px ${mid[1].toFixed(1)}px;transform:rotate(-180deg);transition:transform 1.3s ease, opacity .5s"><polygon points="${ptsStr(C)}" fill="#fdeef3" stroke="#f6a9c4" stroke-width="2.5" stroke-dasharray="6 5"/></g>`;
  s += `<polygon class="fillA" points="${ptsStr(P)}"/>`;
  s += `<polygon class="${opt.perim ? 'perim anim' : 'edge'}" pathLength="100" points="${ptsStr(P)}"/>`;
  if (a < 0) s += `<line class="ext" x1="${foot[0]}" y1="${foot[1]}" x2="${P[2][0]}" y2="${P[2][1]}"/>`;
  if (a > b) s += `<line class="ext" x1="${P[1][0]}" y1="${P[1][1]}" x2="${foot[0]}" y2="${foot[1]}"/>`;
  if (!opt.noH) { s += `<line class="hline" x1="${top[0]}" y1="${top[1]}" x2="${foot[0]}" y2="${foot[1]}"/>` + raMark(foot, a >= b ? -1 : 1);
    const hx = (a <= 0 || a >= b) ? (a >= b ? top[0] + 26 : top[0] - 26) : top[0] + 24; s += txt(hx, (top[1] + foot[1]) / 2, `${fmt(h)} ${u}`, 'h'); }
  s += segLbl(P[1], P[2], `${fmt(b)} ${u}`, '', c, 16);
  if (opt.sL) s += segLbl(P[2], P[0], `${fmt(opt.sL)} ${u}`, 's', c);
  if (opt.sR) s += segLbl(P[0], P[1], `${fmt(opt.sR)} ${u}`, 's', c);
  return { svg: svgWrap(s), hint(el) { const g = el.querySelector('.copy'); later(200, () => { g.classList.remove('hide'); g.style.transform = 'rotate(0deg)'; }); } };
}
function drawTrap(b1, b2, h, x, u, opt = {}) {
  const shape = [[x, 0], [x + b2, 0], [b1, h], [0, h]];
  const copy = shape.map(p => [x + b2 + b1 - p[0], h - p[1]]);
  const M = mapper(opt.noCopy ? shape : shape.concat(copy));
  const P = shape.map(M.P), C = copy.map(M.P), c = cen(P);
  const top = M.P([x, 0]), foot = M.P([x, h]), mid = M.P([(x + b2 + b1) / 2, h / 2]);
  let s = `<g class="copy fade hide" style="transform-box:view-box;transform-origin:${mid[0].toFixed(1)}px ${mid[1].toFixed(1)}px;transform:rotate(-180deg);transition:transform 1.3s ease, opacity .5s"><polygon points="${ptsStr(C)}" fill="#fdeef3" stroke="#f6a9c4" stroke-width="2.5" stroke-dasharray="6 5"/>${segLbl(C[0], C[1], fmt(b2), 's', cen(C), 14)}</g>`;
  s += `<polygon class="fillA" points="${ptsStr(P)}"/>`;
  s += `<polygon class="${opt.perim ? 'perim anim' : 'edge'}" pathLength="100" points="${ptsStr(P)}"/>`;
  if (!opt.noH) s += `<line class="hline" x1="${top[0]}" y1="${top[1]}" x2="${foot[0]}" y2="${foot[1]}"/>` + raMark(foot, 1) + txt(top[0] + 24, (top[1] + foot[1]) / 2, `${fmt(h)} ${u}`, 'h');
  s += segLbl(P[2], P[3], `${fmt(b1)} ${u}`, '', c, 16);
  s += segLbl(P[0], P[1], `${fmt(b2)} ${u}`, '', c, 14);
  if (opt.l1) s += segLbl(P[3], P[0], `${fmt(opt.l1)} ${u}`, 's', c);
  if (opt.l2) s += segLbl(P[1], P[2], `${fmt(opt.l2)} ${u}`, 's', c);
  return { svg: svgWrap(s), hint(el) { const g = el.querySelector('.copy'); later(200, () => { g.classList.remove('hide'); g.style.transform = 'rotate(0deg)'; }); } };
}
// L-shape: W x H with notch cw x ch removed from top-right
function drawL(W, H, cw, ch, u, opt = {}) {
  const sh = [[0, 0], [W - cw, 0], [W - cw, ch], [W, ch], [W, H], [0, H]];
  const M = mapper(sh), P = sh.map(M.P), c = cen(P);
  const A1 = [[0, 0], [W - cw, 0], [W - cw, H], [0, H]].map(M.P), A2 = [[W - cw, ch], [W, ch], [W, H], [W - cw, H]].map(M.P);
  const notch = [[W - cw, 0], [W, 0], [W, ch], [W - cw, ch]].map(M.P);
  let s = `<polygon class="fillA" points="${ptsStr(P)}"/>`;
  s += `<g class="pieces fade hide"><polygon points="${ptsStr(A1)}" fill="#f6a9c4"/><polygon points="${ptsStr(A2)}" fill="#fcdbe6" stroke="#c2416e" stroke-width="2" stroke-dasharray="5 4"/>${txt(cen(A1)[0], cen(A1)[1], fmt((W - cw) * H), 'big')}${txt(cen(A2)[0], cen(A2)[1], fmt(cw * (H - ch)), 'big')}</g>`;
  if (opt.showNotch) s += `<polygon class="nb fade hide" points="${ptsStr(notch)}" fill="none" stroke="#bba" stroke-width="2" stroke-dasharray="5 5"/>`;
  s += `<polygon class="${opt.perim ? 'perim anim' : 'edge'}" pathLength="100" points="${ptsStr(P)}"/>`;
  const L = opt.labels || { 0: W - cw, 3: H - ch, 4: W, 5: H };
  // side i goes P[i] -> P[i+1]
  const names = opt.names || {};
  Object.keys(L).forEach(i => { i = +i; const t = L[i] === '?' ? '?' : `${fmt(L[i])} ${u}`; s += segLbl(P[i], P[(i + 1) % 6], t, L[i] === '?' ? 'h big' : (names[i] || ''), c); });
  if (opt.missing) opt.missing.forEach(([i, v]) => { s += `<g class="miss fade hide">${segLbl(P[i], P[(i + 1) % 6], fmt(v), 'p', c)}</g>`; });
  return { svg: svgWrap(s), hint(el) { later(200, () => el.querySelectorAll('.pieces,.miss,.nb').forEach(g => g.classList.remove('hide'))); if (opt.perim) trace(el); } };
}
// U-shape: W x H with notch of width q, depth d cut from top middle
function drawU(W, H, q, d, u) {
  const p = Math.round((W - q) / 2 * 10) / 10;
  const sh = [[0, 0], [p, 0], [p, d], [p + q, d], [p + q, 0], [W, 0], [W, H], [0, H]];
  const M = mapper([[0, 0], [W, H]]), P = sh.map(M.P), c = cen([[0, 0], [W, 0], [W, H], [0, H]].map(M.P));
  const big = [[0, 0], [W, 0], [W, H], [0, H]].map(M.P), cut = [[p, 0], [p + q, 0], [p + q, d], [p, d]].map(M.P);
  let s = `<g class="bigr fade hide"><polygon points="${ptsStr(big)}" fill="#fdeef3"/></g><polygon class="fillA" points="${ptsStr(P)}"/>`;
  s += `<g class="cut fade hide"><polygon points="${ptsStr(cut)}" fill="#fff" stroke="#e11d48" stroke-width="2.5" stroke-dasharray="6 4"/>${txt(cen(cut)[0], cen(cut)[1], '−' + fmt(q * d), 'big')}</g>`;
  s += `<polygon class="edge" points="${ptsStr(P)}"/>`;
  s += segLbl(P[6], P[7], `${fmt(W)} ${u}`, '', c, 16) + segLbl(P[7], P[0], `${fmt(H)} ${u}`, '', c) + txt((cut[0][0] + cut[1][0]) / 2, cut[0][1] - 13, `${fmt(q)}`, '') + txt(cut[1][0] + 16, (cut[1][1] + cut[2][1]) / 2, fmt(d), 'h');
  s += `<g class="bigl fade hide">${txt(c[0], c[1] + 18, fmt(W * H), 'big')}</g>`;
  return { svg: svgWrap(s), hint(el) { later(150, () => el.querySelector('.bigr').classList.remove('hide')); later(900, () => { el.querySelector('.bigl').classList.remove('hide'); el.querySelector('.cut').classList.remove('hide'); }); } };
}
// house: rectangle W x H + triangle roof height r
function drawHouse(W, H, r, u) {
  const sh = [[0, r], [W / 2, 0], [W, r], [W, r + H], [0, r + H]];
  const M = mapper(sh), P = sh.map(M.P), c = cen(P);
  const rect = [[0, r], [W, r], [W, r + H], [0, r + H]].map(M.P), tri = [[0, r], [W / 2, 0], [W, r]].map(M.P);
  const apex = M.P([W / 2, 0]), foot = M.P([W / 2, r]);
  let s = `<polygon class="fillA" points="${ptsStr(P)}"/>`;
  s += `<g class="pieces fade hide"><polygon points="${ptsStr(rect)}" fill="#f6a9c4"/><polygon points="${ptsStr(tri)}" fill="#fcdbe6"/>${txt(cen(rect)[0], cen(rect)[1] + 6, fmt(W * H), 'big')}</g>`;
  s += `<polygon class="edge" points="${ptsStr(P)}"/>`;
  s += `<line class="hline" x1="${apex[0]}" y1="${apex[1]}" x2="${foot[0]}" y2="${foot[1]}"/>` + raMark(foot, 1) + txt(apex[0] + 16, (apex[1] + foot[1]) / 2 + 2, fmt(r), 'h');
  s += `<line x1="${rect[0][0]}" y1="${rect[0][1]}" x2="${rect[1][0]}" y2="${rect[1][1]}" stroke="#d99aae" stroke-width="2" stroke-dasharray="4 4"/>`;
  s += segLbl(P[3], P[4], `${fmt(W)} ${u}`, '', c, 16) + segLbl(P[4], P[0], `${fmt(H)} ${u}`, '', c);
  s += `<g class="pieces2 fade hide">${txt(cen(tri)[0] - Math.max(24, (tri[2][0] - tri[0][0]) / 5), cen(tri)[1] + 6, fmt(W * r / 2), '')}</g>`;
  return { svg: svgWrap(s), hint(el) { later(200, () => el.querySelector('.pieces').classList.remove('hide')); later(900, () => el.querySelector('.pieces2').classList.remove('hide')); } };
}
// grid rectangle for warm-up with counting
function drawGrid(w, h, mode) {
  const M = mapper([[0, 0], [w, h]], 30);
  let s = '';
  for (let i = 0; i <= w; i++) s += `<line x1="${M.X(i)}" y1="${M.Y(0)}" x2="${M.X(i)}" y2="${M.Y(h)}" stroke="#efdcd6" stroke-width="1.5"/>`;
  for (let j = 0; j <= h; j++) s += `<line x1="${M.X(0)}" y1="${M.Y(j)}" x2="${M.X(w)}" y2="${M.Y(j)}" stroke="#efdcd6" stroke-width="1.5"/>`;
  s += `<g class="tiles"></g><rect x="${M.X(0)}" y="${M.Y(0)}" width="${w * M.s}" height="${h * M.s}" class="${mode === 'P' ? 'perim anim' : 'edge'}" pathLength="100"/><g class="cnt"></g>`;
  return {
    svg: svgWrap(s),
    hint(el) {
      const g = el.querySelector(mode === 'P' ? '.cnt' : '.tiles'); g.innerHTML = '';
      if (mode === 'A') { let k = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = ++k; later(n * 110, () => { g.insertAdjacentHTML('beforeend', `<g class="pop" style="transform-box:fill-box;transform-origin:center"><rect class="tileSq" x="${M.X(i)}" y="${M.Y(j)}" width="${M.s}" height="${M.s}"/>${txt(M.X(i + .5), M.Y(j + .5), n, 'w')}</g>`); }); } }
      else { trace(el); const segs = []; for (let i = 0; i < w; i++) segs.push([M.X(i + .5), M.Y(0) - 14]); for (let j = 0; j < h; j++) segs.push([M.X(w) + 15, M.Y(j + .5)]); for (let i = w - 1; i >= 0; i--) segs.push([M.X(i + .5), M.Y(h) + 15]); for (let j = h - 1; j >= 0; j--) segs.push([M.X(0) - 15, M.Y(j + .5)]);
        segs.forEach((p, k) => later(150 + k * (2400 / segs.length), () => g.insertAdjacentHTML('beforeend', `<g class="pop">${txt(p[0], p[1], k + 1, 'p')}</g>`))); }
    }
  };
}
// coordinate plane polygon (6.G.A.3)
function drawCoord(pts, labels) {
  const n = Math.max(6, ...pts.flat()) + 1, m = 26, s = Math.min((VW - 2 * m) / n, (VH - 2 * m) / n);
  const ox = (VW - n * s) / 2, oy = VH - (VH - n * s) / 2;
  const X = x => ox + x * s, Y = y => oy - y * s;
  let g = '';
  for (let i = 0; i <= n; i++) { g += `<line x1="${X(i)}" y1="${Y(0)}" x2="${X(i)}" y2="${Y(n)}" stroke="${i ? '#f1e4e0' : '#7a5f6b'}" stroke-width="${i ? 1 : 2}"/><line x1="${X(0)}" y1="${Y(i)}" x2="${X(n)}" y2="${Y(i)}" stroke="${i ? '#f1e4e0' : '#7a5f6b'}" stroke-width="${i ? 1 : 2}"/>`; if (n <= 8 || i % 2 === 0) g += `<text x="${X(i)}" y="${Y(0) + 12}" font-size="10" text-anchor="middle" fill="#7a5f6b">${i}</text><text x="${X(0) - 8}" y="${Y(i) + 3}" font-size="10" text-anchor="middle" fill="#7a5f6b">${i}</text>`; }
  const P = pts.map(p => [X(p[0]), Y(p[1])]);
  g += `<polygon class="fillA" points="${ptsStr(P)}" opacity=".85"/><polygon class="edge" points="${ptsStr(P)}"/>`;
  P.forEach((p, i) => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#c2416e"/>`; const c = cen(P); const dx = p[0] < c[0] ? -1 : 1, dy = p[1] < c[1] ? -1 : 1; g += txt(p[0] + dx * 26, p[1] + dy * 10, `(${pts[i][0]},${pts[i][1]})`, ''); });
  g += `<g class="lens fade hide">${labels.map(l => txt(l[0], l[1], l[2], 'p big')).join('')}</g>`;
  return { svg: svgWrap(g.replace(/class="lbl "/g, 'class="lbl" font-size="13"')), X, Y, hint(el) { later(200, () => el.querySelector('.lens').classList.remove('hide')); } };
}

/* ---------- problem generators ---------- */
const TRI_SETS = [ // a, b, h, left side, right side (exact whole-number sides)
  [3, 6, 4, 5, 5], [5, 14, 12, 13, 15], [9, 14, 12, 15, 13], [6, 12, 8, 10, 10], [5, 21, 12, 13, 20], [9, 25, 12, 15, 20],
  [-5, 4, 12, 13, 15], [-9, 7, 12, 15, 20], [-3, 3, 4, 5, 7.21], [8, 16, 6, 10, 10]
].filter(t => Number.isInteger(t[4]));
const TRIPLES = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [9, 12, 15]]; // [offset, height, slant]

function wr(lines) { return lines.join('<br>'); }
const GEN = {
  warm(lv) {
    const w = R(2, lv > 1 ? 7 : 5), h = R(2, lv > 1 ? 5 : 4), mode = Math.random() < .5 ? 'A' : 'P';
    const d = drawGrid(w, h, mode);
    return mode === 'A'
      ? { d, ask: 'A = ?', sub: 'count the squares', ans: w * h, unit: 'units²', formula: wr(['<b>A</b> = rows × columns', `<b>A</b> = __ × __ = __ units²`]), sol: `A = ${h} × ${w} = ${w * h} units²` }
      : { d, ask: 'P = ?', sub: 'count the edges', ans: 2 * (w + h), unit: 'units', formula: wr(['<span class="p">P</span> = side + side + side + side', `<span class="p">P</span> = __ + __ + __ + __ = __ units`]), sol: `P = ${w} + ${h} + ${w} + ${h} = ${2 * (w + h)} units` };
  },
  para(lv) {
    const u = pick(U), t = pick(TRIPLES);
    const k = lv >= 2 && Math.random() < .4 ? 1 : 1;
    let b = R(Math.max(t[0] + 2, 4), Math.max(t[0] + 6, lv > 1 ? 14 : 10)), h = t[1], o = t[0], sl = t[2];
    if (lv === 3 && Math.random() < .35) b = b + 0.5;
    const d = drawPara(b, h, o, u, { slant: sl });
    return { d, ask: 'A = ?', ans: b * h, unit: u + '²', formula: wr(['<b>A</b> = b × h', '<b>A</b> = __ × __', '<b>A</b> = ____ ' + u + '²', '⚠️ h = dashed ⊾, not the slant']), sol: `A = ${fmt(b)} × ${h} = ${fmt(b * h)} ${u}²  (not × ${sl})` };
  },
  tri(lv) {
    const u = pick(U); let b, h, a, sL = 0, sR = 0, kind;
    if (Math.random() < .5) { const t = pick(TRI_SETS); [a, b, h, sL, sR] = t; kind = a < 0 ? 'obtuse' : 'acute'; }
    else { kind = pick(['right', 'acute', 'obtuse']); b = R(3, lv > 1 ? 14 : 10); h = R(2, lv > 1 ? 12 : 8);
      if (lv < 3 && (b * h) % 2) b++;
      a = kind === 'right' ? 0 : kind === 'acute' ? R(1, b - 1) : (Math.random() < .5 ? -R(2, 3) : b + R(2, 3)); }
    const d = drawTri(b, h, a, u, { sL, sR });
    return { d, ask: 'A = ?', sub: kind === 'obtuse' ? 'h is outside!' : '', ans: b * h / 2, unit: u + '²', formula: wr(['<b>A</b> = ½ × b × h', '<b>A</b> = ½ × __ × __', '<b>A</b> = ____ ' + u + '²', '(or b × h ÷ 2)']), sol: `A = ½ × ${fmt(b)} × ${h} = ${fmt(b * h)} ÷ 2 = ${fmt(b * h / 2)} ${u}²` };
  },
  trap(lv) {
    const u = pick(U); let b1, b2, h, x, l1 = 0, l2 = 0;
    if (Math.random() < .5) { const L = pick([[3, 4, 3, 5, 5], [5, 12, 9, 13, 15], [6, 8, 6, 10, 10], [3, 4, 0, 5, 4], [9, 12, 5, 15, 13]]); x = L[0]; h = L[1]; b2 = R(3, 9); b1 = x + b2 + L[2]; l1 = L[3]; l2 = L[4]; if (L[2] === 0) l2 = 0; }
    else { h = R(2, lv > 1 ? 10 : 6); b2 = R(2, 8); b1 = b2 + R(2, 8); x = R(0, b1 - b2); if (lv < 3 && ((b1 + b2) * h) % 2) b1++; }
    const d = drawTrap(b1, b2, h, x, u, { l1, l2 });
    return { d, ask: 'A = ?', ans: (b1 + b2) * h / 2, unit: u + '²', formula: wr(['<b>A</b> = ½ × (b₁ + b₂) × h', '<b>A</b> = ½ × (__ + __) × __', '<b>A</b> = ____ ' + u + '²']), sol: `A = ½ × (${b1} + ${b2}) × ${h} = ½ × ${b1 + b2} × ${h} = ${fmt((b1 + b2) * h / 2)} ${u}²` };
  },
  comp(lv) {
    const u = pick(U), kind = pick(['L', 'L', 'U', 'house']);
    if (kind === 'L') { const W = R(5, lv > 1 ? 14 : 10), H = R(4, lv > 1 ? 12 : 9), cw = R(2, W - 2), ch = R(2, H - 2);
      const d = drawL(W, H, cw, ch, u); const a1 = (W - cw) * H, a2 = cw * (H - ch);
      return { d, ask: 'A = ?', sub: 'split it ✂️', ans: W * H - cw * ch, unit: u + '²', formula: wr(['Split into 2 rectangles', '<b>A₁</b> = __ × __', '<b>A₂</b> = __ × __', '<b>A</b> = A₁ + A₂ = ____ ' + u + '²']), sol: `A = ${W - cw}×${H} + ${cw}×${H - ch} = ${a1} + ${a2} = ${a1 + a2} ${u}²` }; }
    if (kind === 'U') { const W = R(6, 14), H = R(4, 10), q = R(2, W - 4), dd = R(1, H - 2); const d = drawU(W, H, q, dd, u);
      return { d, ask: 'A = ?', sub: 'big − cut-out ➖', ans: W * H - q * dd, unit: u + '²', formula: wr(['Big rectangle − cut-out', '<b>A</b> = (__ × __) − (__ × __)', '<b>A</b> = ____ ' + u + '²']), sol: `A = ${W}×${H} − ${q}×${dd} = ${W * H} − ${q * dd} = ${W * H - q * dd} ${u}²` }; }
    const W = 2 * R(3, 7), H = R(3, 7), r = R(2, 5); const d = drawHouse(W, H, r, u);
    return { d, ask: 'A = ?', sub: 'rectangle + triangle', ans: W * H + W * r / 2, unit: u + '²', formula: wr(['<b>A</b> = rectangle + triangle', '<b>A</b> = (__ × __) + (½ × __ × __)', '<b>A</b> = ____ ' + u + '²']), sol: `A = ${W}×${H} + ½×${W}×${r} = ${W * H} + ${W * r / 2} = ${W * H + W * r / 2} ${u}²` };
  },
  perim(lv) {
    const u = pick(U), kind = pick(['L', 'L', 'Lmiss', 'para', 'tri', 'trap']);
    if (kind === 'L' || kind === 'Lmiss') { const W = R(5, 14), H = R(4, 12), cw = R(2, W - 2), ch = R(2, H - 2);
      if (kind === 'Lmiss') { const which = pick([1, 2]); // ask missing side 1 (notch depth, vertical) or 2 (notch width, horizontal)
        const labels = { 0: W - cw, 3: H - ch, 4: W, 5: H }; labels[which] = '?'; const ans = which === 1 ? ch : cw;
        const d = drawL(W, H, cw, ch, u, { labels, showNotch: true });
        return { d, ask: '? = ', sub: 'missing side', ans, unit: u, formula: wr(which === 1 ? ['Left side = right pieces', '? = __ − __'] : ['Bottom = top pieces', '? = __ − __']), sol: which === 1 ? `? = ${H} − ${H - ch} = ${ch} ${u}` : `? = ${W} − ${W - cw} = ${cw} ${u}` }; }
      const d = drawL(W, H, cw, ch, u, { perim: true, missing: [[1, ch], [2, cw]] });
      return { d, ask: 'P = ?', sub: 'find missing sides first', ans: 2 * (W + H), unit: u, formula: wr(['1) find the 2 missing sides', '<span class="p">P</span> = add ALL 6 sides', '<span class="p">P</span> = ____ ' + u]), sol: `P = ${W - cw} + ${ch} + ${cw} + ${H - ch} + ${W} + ${H} = ${2 * (W + H)} ${u}` }; }
    if (kind === 'para') { const t = pick(TRIPLES), b = R(t[0] + 2, t[0] + 9); const d = drawPara(b, t[1], t[0], u, { slant: t[2], perim: true, showTop: false });
      return { tr: true, d, ask: 'P = ?', sub: 'height is NOT a side', ans: 2 * (b + t[2]), unit: u, formula: wr(['<span class="p">P</span> = b + s + b + s', '<span class="p">P</span> = __ + __ + __ + __', '<span class="p">P</span> = ____ ' + u, '(skip the dashed h)']), sol: `P = ${b} + ${t[2]} + ${b} + ${t[2]} = ${2 * (b + t[2])} ${u}  (not ${t[1]})` }; }
    if (kind === 'tri') { const t = pick(TRI_SETS); const d = drawTri(t[1], t[2], t[0], u, { sL: t[3], sR: t[4], perim: true, noCopy: true });
      return { tr: true, d, ask: 'P = ?', sub: 'height is NOT a side', ans: t[1] + t[3] + t[4], unit: u, formula: wr(['<span class="p">P</span> = side + side + side', '<span class="p">P</span> = __ + __ + __ = ____ ' + u]), sol: `P = ${t[1]} + ${t[3]} + ${t[4]} = ${t[1] + t[3] + t[4]} ${u}` }; }
    const L = pick([[3, 4, 3, 5, 5], [5, 12, 9, 13, 15], [6, 8, 6, 10, 10]]); const b2 = R(3, 9), b1 = L[0] + b2 + L[2];
    const d = drawTrap(b1, b2, L[1], L[0], u, { l1: L[3], l2: L[4], perim: true, noCopy: true });
    return { tr: true, d, ask: 'P = ?', sub: 'height is NOT a side', ans: b1 + b2 + L[3] + L[4], unit: u, formula: wr(['<span class="p">P</span> = all 4 outside sides', '<span class="p">P</span> = __ + __ + __ + __ = ____ ' + u]), sol: `P = ${b1} + ${b2} + ${L[3]} + ${L[4]} = ${b1 + b2 + L[3] + L[4]} ${u}` };
  },
  rev(lv) {
    const u = pick(U), kind = pick(['para', 'tri', 'rect', 'rectP']);
    if (kind === 'para') { const t = pick(TRIPLES), b = R(t[0] + 2, t[0] + 8); const d = drawPara(b, t[1], t[0], u, { noH: false });
      const s = d.svg.replace(`>${t[1]} ${u}</text>`, `>h = ?</text>`); d.svg = s;
      return { d, ask: 'h = ?', sub: `A = ${b * t[1]} ${u}²`, ans: t[1], unit: u, formula: wr(['<b>A</b> = b × h', '__ = __ × h', 'h = __ ÷ __ = ____ ' + u]), sol: `${b * t[1]} = ${b} × h → h = ${b * t[1]} ÷ ${b} = ${t[1]} ${u}` }; }
    if (kind === 'tri') { const b = 2 * R(2, 7), h = R(2, 10); const d = drawTri(b, h, R(1, b - 1), u); d.svg = d.svg.replace(`>${h} ${u}</text>`, '>h = ?</text>');
      return { d, ask: 'h = ?', sub: `A = ${b * h / 2} ${u}²`, ans: h, unit: u, formula: wr(['<b>A</b> = ½ × b × h', '__ = ½ × __ × h', 'h = __ × 2 ÷ __ = ____ ' + u]), sol: `${b * h / 2} = ½ × ${b} × h → h = ${b * h / 2} × 2 ÷ ${b} = ${h} ${u}` }; }
    const l = R(3, 12), w = R(2, 9); const M = mapper([[0, 0], [l, w]]); const P = [[0, 0], [l, 0], [l, w], [0, w]].map(M.P), c = cen(P);
    let s = `<polygon class="fillA" points="${ptsStr(P)}"/><polygon class="${kind === 'rectP' ? 'perim' : 'edge'}" points="${ptsStr(P)}"/>` + segLbl(P[2], P[3], `${l} ${u}`, '', c, 16) + segLbl(P[3], P[0], '?', 'h big', c);
    const d = { svg: svgWrap(s), hint() {} };
    if (kind === 'rect') return { d, ask: '? = ', sub: `A = ${l * w} ${u}²`, ans: w, unit: u, formula: wr(['<b>A</b> = l × w', '__ = __ × ?', '? = __ ÷ __ = ____ ' + u]), sol: `${l * w} ÷ ${l} = ${w} ${u}` };
    return { d, ask: '? = ', sub: `P = ${2 * (l + w)} ${u}`, ans: w, unit: u, formula: wr(['<span class="p">P</span> = l + w + l + w', '__ − __ − __ = 2 × ?', '? = ____ ' + u]), sol: `${2 * (l + w)} − ${l} − ${l} = ${2 * w} → ? = ${2 * w} ÷ 2 = ${w} ${u}` };
  },
  word(lv) {
    const dec = lv >= 2 && Math.random() < .5;
    const T = [
      () => { const l = R(4, 12) + (dec ? .5 : 0), w = R(3, 9); return ['🌷', `Garden ${fmt(l)} ft by ${w} ft. How much <u>fence</u> goes around?`, 2 * (l + w), 'ft', ['ft', 'ft²'], `P = ${fmt(l)} + ${w} + ${fmt(l)} + ${w} = ${fmt(2 * (l + w))} ft`]; },
      () => { const l = R(4, 12) + (dec ? .5 : 0), w = R(3, 9); return ['🌱', `Lawn ${fmt(l)} m by ${w} m. How much <u>grass</u> covers it?`, l * w, 'm²', ['m', 'm²'], `A = ${fmt(l)} × ${w} = ${fmt(l * w)} m²`]; },
      () => { const b = R(6, 20), h = R(4, 14); return ['🚩', `Triangle flag: base ${b} in, height ${h} in. How much <u>fabric</u>?`, b * h / 2, 'in²', ['in', 'in²'], `A = ½ × ${b} × ${h} = ${fmt(b * h / 2)} in²`]; },
      () => { const b1 = R(8, 16), b2 = R(3, 7), h = 2 * R(2, 5); return ['🪟', `Trapezoid window: bases ${b1} ft & ${b2} ft, height ${h} ft. How much <u>glass</u>?`, (b1 + b2) * h / 2, 'ft²', ['ft', 'ft²'], `A = ½ × (${b1} + ${b2}) × ${h} = ${fmt((b1 + b2) * h / 2)} ft²`]; },
      () => { const b = R(6, 12) + (dec ? .5 : 0), s = R(4, 8); return ['🎀', `Parallelogram card: sides ${fmt(b)} cm & ${s} cm. How much <u>ribbon</u> goes around the edge?`, 2 * (b + s), 'cm', ['cm', 'cm²'], `P = ${fmt(b)} + ${s} + ${fmt(b)} + ${s} = ${fmt(2 * (b + s))} cm`]; },
      () => { const b = R(6, 14), h = R(3, 9), s = h + R(1, 3); return ['🧱', `Parallelogram patio: base ${b} yd, height ${h} yd, slanted side ${s} yd. <u>Area</u>?`, b * h, 'yd²', ['yd', 'yd²'], `A = ${b} × ${h} = ${b * h} yd² (slant ${s} not used)`]; },
      () => { const W = R(10, 16), H = R(8, 12), cw = R(3, 5), ch = R(3, 5); return ['🛋️', `L-shaped room: ${W}×${H} ft with a ${cw}×${ch} ft corner cut out. <u>Carpet</u> needed?`, W * H - cw * ch, 'ft²', ['ft', 'ft²'], `A = ${W}×${H} − ${cw}×${ch} = ${W * H} − ${cw * ch} = ${W * H - cw * ch} ft²`]; },
      () => { const s = R(3, 9) + (dec ? .25 : 0); return ['🖼️', `Square frame, each side ${fmt(s)} in. <u>Border</u> length?`, 4 * s, 'in', ['in', 'in²'], `P = 4 × ${fmt(s)} = ${fmt(4 * s)} in`]; },
    ];
    const [e, t, ans, unit, units, sol] = pick(T)();
    return { word: true, scene: e, text: t, ask: '', ans, unit, units, formula: wr(['Around → <span class="p">P</span> (units)', 'Cover / inside → <b>A</b> (units²)', 'Write: formula → numbers → answer + unit']), sol, d: null };
  },
  coord(lv) {
    const kind = pick(['rect', 'rect', 'tri']);
    if (kind === 'rect') { const x1 = R(0, 4), y1 = R(0, 4), x2 = x1 + R(2, 6), y2 = y1 + R(2, 5), ask = pick(['A', 'P']);
      const tmp = drawCoord([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], []);
      const lab = [[(tmp.X(x1) + tmp.X(x2)) / 2, tmp.Y(y1) + 14, `${x2 - x1}`], [tmp.X(x2) + 14, (tmp.Y(y1) + tmp.Y(y2)) / 2, `${y2 - y1}`]];
      const d = drawCoord([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], lab); const w = x2 - x1, h = y2 - y1;
      return ask === 'A' ? { d, ask: 'A = ?', sub: 'subtract to get lengths', ans: w * h, unit: 'units²', formula: wr(['length = big x − small x', 'height = big y − small y', '<b>A</b> = __ × __ = ____ units²']), sol: `${x2}−${x1} = ${w}, ${y2}−${y1} = ${h} → A = ${w * h} units²` }
        : { d, ask: 'P = ?', sub: 'subtract to get lengths', ans: 2 * (w + h), unit: 'units', formula: wr(['length = big x − small x', 'height = big y − small y', '<span class="p">P</span> = __ + __ + __ + __ = ____ units']), sol: `${w} + ${h} + ${w} + ${h} = ${2 * (w + h)} units` }; }
    const x1 = R(0, 3), y1 = R(0, 3), x2 = x1 + R(2, 7), y3 = y1 + R(2, 6); const w = x2 - x1, h = y3 - y1;
    const tmp = drawCoord([[x1, y1], [x2, y1], [x1, y3]], []);
    const d = drawCoord([[x1, y1], [x2, y1], [x1, y3]], [[(tmp.X(x1) + tmp.X(x2)) / 2, tmp.Y(y1) + 14, `${w}`], [tmp.X(x1) - 14, (tmp.Y(y1) + tmp.Y(y3)) / 2, `${h}`]]);
    return { d, ask: 'A = ?', sub: 'right triangle', ans: w * h / 2, unit: 'units²', formula: wr(['b = big x − small x', 'h = big y − small y', '<b>A</b> = ½ × __ × __ = ____ units²']), sol: `b = ${w}, h = ${h} → A = ½ × ${w} × ${h} = ${fmt(w * h / 2)} units²` };
  },
  sort() {
    const SC = [['🏡', 'fence the yard', 'P'], ['🧶', 'carpet the floor', 'A'], ['🖼️', 'frame border', 'P'], ['🎨', 'paint a wall', 'A'], ['🌱', 'grass seed for lawn', 'A'], ['🎀', 'ribbon around a card', 'P'], ['🏊', 'cover the pool', 'A'], ['🏃‍♀️', 'one lap around the track', 'P'], ['🍕', 'crust around the edge', 'P'], ['📱', 'screen protector', 'A'], ['🧁', 'frosting on top', 'A'], ['💡', 'lights along the roof edge', 'P'], ['🟫', 'tiles for the floor', 'A'], ['🧵', 'lace along a pillow edge', 'P'],
      ['📏', '24 ft', 'P'], ['🟪', '24 ft²', 'A'], ['📏', '9 cm', 'P'], ['🟪', '9 cm²', 'A'], ['⬛', 'square units', 'A'], ['➖', 'plain units', 'P'], ['⊾', 'height × base', 'A'], ['↗️', 'add the slanted side', 'P']];
    const [e, t, a] = pick(SC); return { sort: true, scene: e, text: t, ans: a };
  }
};
const MODES = [
  { id: 'sort', name: 'Area or Perimeter?', ico: '🤔', gen: 'sort' },
  { id: 'warm', name: 'Warm-up grid', ico: '🔲', gen: 'warm' },
  { id: 'para', name: 'Parallelogram', ico: 'para', gen: 'para' },
  { id: 'tri', name: 'Triangle', ico: 'tri', gen: 'tri' },
  { id: 'trap', name: 'Trapezoid', ico: 'trap', gen: 'trap' },
  { id: 'comp', name: 'Weird shapes', ico: 'comp', gen: 'comp' },
  { id: 'perim', name: 'Perimeter + missing sides', ico: 'perim', gen: 'perim' },
  { id: 'rev', name: 'Backwards (find h)', ico: '🔄', gen: 'rev' },
  { id: 'word', name: 'Word problems', ico: '📝', gen: 'word' },
  { id: 'coord', name: 'Coordinate grid', ico: '📍', gen: 'coord' },
];
const MINI = {
  para: '<svg viewBox="0 0 70 48"><polygon points="18,8 64,8 52,40 6,40" fill="#fcdbe6" stroke="#d99aae" stroke-width="2"/><line x1="18" y1="8" x2="18" y2="40" stroke="#6d28d9" stroke-width="2" stroke-dasharray="4 3"/></svg>',
  tri: '<svg viewBox="0 0 70 48"><polygon points="24,6 62,42 8,42" fill="#fcdbe6" stroke="#d99aae" stroke-width="2"/><line x1="24" y1="6" x2="24" y2="42" stroke="#6d28d9" stroke-width="2" stroke-dasharray="4 3"/></svg>',
  trap: '<svg viewBox="0 0 70 48"><polygon points="20,8 46,8 64,42 6,42" fill="#fcdbe6" stroke="#d99aae" stroke-width="2"/><line x1="20" y1="8" x2="20" y2="42" stroke="#6d28d9" stroke-width="2" stroke-dasharray="4 3"/></svg>',
  comp: '<svg viewBox="0 0 70 48"><polygon points="8,6 34,6 34,22 62,22 62,42 8,42" fill="#fcdbe6" stroke="#d99aae" stroke-width="2"/><line x1="34" y1="22" x2="34" y2="42" stroke="#c2416e" stroke-width="2" stroke-dasharray="3 3"/></svg>',
  perim: '<svg viewBox="0 0 70 48"><polygon points="8,6 34,6 34,22 62,22 62,42 8,42" fill="#fff" stroke="#14a89c" stroke-width="5" stroke-linejoin="round"/></svg>',
};

/* ---------- screens ---------- */
const app = $('#app');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
function go(fn, ...a) { TOKEN++; window.scrollTo(0, 0); refreshStars(); fn(...a); requestAnimationFrame(() => window.scrollTo(0, 0)); }
$('#homeBtn').onclick = () => go(home);

function home() {
  refreshStars();
  const tile = m => { const n = starsOf(m.id); const pct = Math.min(100, n * 10);
    const ico = MINI[m.ico] || `<span class="ico">${m.ico}</span>`;
    return `<button class="tile" data-m="${m.id}"><span class="st">${n >= 10 ? '🏅' : ''}${BF()}${n}</span>${ico}<span>${m.name}</span><span class="bar"><i style="width:${pct}%"></i></span></button>`; };
  app.innerHTML = `
    <div class="grid">
      <button class="tile wide hero" id="learn"><span class="play">▶</span><span style="font-size:20px">Learn it<br><small style="font-weight:600">7 quick animations</small></span></button>
    </div>
    <div class="legend" style="margin-top:12px"><span><i class="sw" style="background:#14a89c"></i>Perimeter = fence</span><span><i class="sw" style="background:#f6a9c4"></i>Area = carpet</span></div>
    <div class="sec">${BF()}Practice</div>
    <div class="grid">${MODES.map(tile).join('')}
      <button class="tile wide test" id="test"><span class="ico">🎯</span><span style="font-size:19px">Test Mode · 10 mixed<br><small style="font-weight:600">best: ${S.best}/10</small></span></button>
    </div>
    <div class="sec">${BF('', '--bf1:#b9a3dd;--bf2:#dccff0')}Help</div>
    <div class="grid">
      <button class="tile" id="cheat"><span class="ico">🧠</span>Cheat sheet</button>
      <button class="tile" id="vids"><span class="ico">🎬</span>Videos</button>
      <a class="tile" href="worksheet.pdf" style="text-decoration:none"><span class="ico">🖨️</span>Worksheet</a>
      <button class="tile" id="reset"><span class="ico">↺</span>Reset stars</button>
    </div>`;
  app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => go(practice, b.dataset.m));
  $('#learn').onclick = () => go(learn, 0);
  $('#test').onclick = () => go(practice, 'test');
  $('#cheat').onclick = () => go(cheat);
  $('#vids').onclick = () => go(videos);
  $('#reset').onclick = () => { if (confirm('Reset all stars?')) { S = { stars: {}, best: 0 }; save(); go(home); } };
}

/* ----- Learn ----- */
const LESSONS = [
  { t: 'Fence vs Carpet', f: '<span class="formula p" style="font-size:22px">P = around (ft)</span> · <span style="font-size:22px">A = inside (ft²)</span>', make() { return drawGrid(5, 3, 'P'); }, play(el, d) { d.hint(el); later(3000, () => { const g = drawGrid(5, 3, 'A'); const tmp = document.createElement('div'); tmp.innerHTML = g.svg; el.querySelector('.tiles').replaceWith(tmp.querySelector('.tiles')); g.hint(el); }); } },
  { t: 'Slide the slice ✂️', f: 'A = b × h', make() { return drawPara(8, 4, 3, 'cm', { slant: 5 }); }, play(el, d) { d.hint(el); } },
  { t: 'Height stands up ⊾', f: 'h = dashed. Slant = fence only.', make() { const d = drawPara(8, 4, 3, 'cm', { slant: 5 }); d.svg = d.svg.replace('</svg>', `<g class="xx fade hide">${txt(40, 60, '✗ area', 's')}${txt(40, 80, '✓ perimeter', 'p')}</g></svg>`); return d; }, play(el) { later(300, () => el.querySelector('.xx').classList.remove('hide')); } },
  { t: 'Triangle = ½ parallelogram', f: 'A = ½ × b × h', make() { return drawTri(8, 5, 3, 'm'); }, play(el, d) { d.hint(el); } },
  { t: 'Height can be outside', f: 'still A = ½ × b × h', make() { return drawTri(4, 5, -3, 'm', { noCopy: true }); }, play(el) { const h = el.querySelector('.hline'); h.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: .2 }, { opacity: 1 }], { duration: 1600 }); } },
  { t: 'Trapezoid: 2 copies', f: 'A = ½ × (b₁ + b₂) × h', make() { return drawTrap(9, 4, 4, 2, 'in', { noCopy: false }); }, play(el, d) { d.hint(el); } },
  { t: 'Split it ➕ or cut it ➖', f: 'add pieces · or big − cut-out', make() { return drawL(8, 6, 4, 3, 'ft'); }, play(el, d) { d.hint(el); } },
];
function learn(i) {
  const L = LESSONS[i], d = L.make();
  app.innerHTML = `<div class="lh">${L.t}</div><div class="card"><div id="stg">${d.svg}</div></div>
    <div class="formula ${i === 0 ? '' : ''}">${L.f}</div>
    <div class="dots">${LESSONS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
    <div class="nav"><button class="btn" id="prev" ${i ? '' : 'disabled style="opacity:.4"'}>◀</button><button class="btn teal" id="again">↻ Replay</button><button class="btn pink" id="next">${i < LESSONS.length - 1 ? '▶' : '✓ Practice'}</button></div>`;
  const el = $('#stg'); later(400, () => L.play(el, d));
  $('#again').onclick = () => go(learn, i);
  $('#prev').onclick = () => i && go(learn, i - 1);
  $('#next').onclick = () => i < LESSONS.length - 1 ? go(learn, i + 1) : go(home);
}

/* ----- Practice ----- */
function practice(mode) {
  const isTest = mode === 'test', N = isTest ? 10 : 8; let q = 0, score = 0; const res = [];
  const testPool = ['para', 'tri', 'trap', 'comp', 'perim', 'rev', 'word', 'sort', 'coord', 'tri', 'para', 'comp'];
  const order = isTest ? testPool.sort(() => Math.random() - .5).slice(0, N) : null;
  function next() {
    TOKEN++;
    if (q >= N) return done();
    const m = isTest ? order[q] : mode; const p = GEN[MODES.find(x => x.id === m).gen](level(m)); p.m = m; show(p);
  }
  function pips() { return `<div class="pips">${Array.from({ length: N }, (_, k) => `<i class="${k < res.length ? (res[k] ? 'on' : 'x') : ''}"></i>`).join('')}</div>`; }
  function show(p) {
    window.__p = p; // (used by automated tests only)
    let tries = 0, val = '', unitSel = null, finished = false;
    const head = isTest ? '🎯 Test' : MODES.find(x => x.id === mode).name;
    let body = `<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#c2416e">${head}</b><span style="font-weight:800">${q + 1}/${N}</span></div>${pips()}`;
    if (p.sort) {
      body += `<div class="card"><div class="scene">${p.scene}</div><div class="scenetxt">${p.text}</div></div>
      <div class="choices"><button class="btn big teal" data-c="P">⟲ Perimeter<br><small>fence</small></button><button class="btn big pink" data-c="A">▦ Area<br><small>carpet</small></button></div>
      <div class="fb" id="fb"></div><div class="row"><button class="btn" id="nextq" style="display:none">Next ▶</button></div>`;
      app.innerHTML = body;
      app.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { if (finished) return; finished = true; const ok = b.dataset.c === p.ans; grade(ok, true);
        $('#fb').innerHTML = ok ? '<span>Yes!</span>' : (p.ans === 'P' ? '⟲ Perimeter — it goes AROUND' : '▦ Area — it COVERS inside'); $('#fb').className = 'fb ' + (ok ? 'ok' : 'bad'); if (ok) flutter($('#fb'));
        $('#nextq').style.display = ''; $('#nextq').onclick = () => { q++; next(); }; if (ok) later(900, () => { q++; next(); }); });
      return;
    }
    if (p.word) body += `<div class="card"><div class="scene">${p.scene}</div><div class="scenetxt" style="font-size:18px">${p.text}</div></div>`;
    else body += `<div class="card"><div id="stg">${p.d.svg}</div></div>`;
    body += `<div class="q">${p.word ? '' : p.ask}${p.sub ? `<small>${p.sub}</small>` : ''}</div>
      <div class="ans"><div class="box" id="box">&nbsp;</div>${p.word ? p.units.map(u => `<button class="btn" data-u="${u}" style="min-width:64px;flex:0">${u}</button>`).join('') : `<span class="unit">${p.unit}</span>`}</div>
      <div class="fb" id="fb"></div>
      <div id="padwrap"><div class="keypad">${['7', '8', '9', '⌫', '4', '5', '6', '.', '1', '2', '3', '0'].map(k => `<button data-k="${k}" class="${k === '⌫' ? 'del' : ''}">${k}</button>`).join('')}<button class="go" data-k="ok" style="grid-column:span 4">✓ Check</button></div></div>
      <div class="row"><button class="btn" id="wbtn">✏️ Write it</button><button class="btn pink" id="nextq" style="display:none">Next ▶</button></div>
      <div class="write" id="write" style="display:none">✏️ On paper:<br>${p.formula}</div>`;
    app.innerHTML = body;
    const box = $('#box'), fb = $('#fb'), el = $('#stg');
    const paint = () => box.innerHTML = val || '&nbsp;';
    app.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { unitSel = b.dataset.u; app.querySelectorAll('[data-u]').forEach(x => x.classList.toggle('sel', x === b)); });
    $('#wbtn').onclick = () => { const w = $('#write'); w.style.display = w.style.display === 'none' ? '' : 'none'; if (w.style.display === '') w.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      if (finished) return; const k = b.dataset.k;
      if (k === '⌫') val = val.slice(0, -1); else if (k === '.') { if (!val.includes('.')) val += val ? '.' : '0.'; }
      else if (k === 'ok') return check(); else if (val.length < 7) val += k;
      paint();
    });
    function check() {
      if (!val) { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); return; }
      if (p.word && !unitSel) { fb.className = 'fb bad'; fb.textContent = 'Pick a unit 👆'; return; }
      const numOk = Math.abs(parseFloat(val) - p.ans) < 0.011, unitOk = !p.word || unitSel === p.unit;
      tries++;
      if (numOk && unitOk) {
        finished = true; fb.className = 'fb ok'; fb.innerHTML = tries === 1 ? '<span>Yes!</span>' : '<span>✓ Got it!</span>'; grade(tries === 1); flutter(fb);
        if (p.d && el) { p.tr ? trace(el) : p.d.hint(el); }
        showSol(); return;
      }
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      if (tries === 1) {
        fb.className = 'fb bad'; fb.innerHTML = (numOk && !unitOk) ? 'Number ✓ — check the unit! (around = ft, inside = ft²)' : 'Not yet — watch 👀';
        if (p.d && el) { el.innerHTML = p.d.svg; p.tr ? trace(el) : p.d.hint(el); }
        $('#write').style.display = ''; val = ''; paint();
      } else { finished = true; fb.className = 'fb bad'; fb.innerHTML = `Answer: ${fmt(p.ans)} ${p.unit}`; grade(false); showSol(); }
    }
    function showSol() {
      const w = $('#write'); w.style.display = ''; w.innerHTML = `✏️ <b>${p.sol}</b><br><span style="font-size:14px;opacity:.8">${p.formula}</span>`;
      $('#padwrap').style.display = 'none'; const n = $('#nextq'); n.style.display = ''; n.onclick = () => { q++; next(); };
    }
  }
  function grade(firstTry, sortMode) {
    res.push(firstTry); if (firstTry) { score++; const m = isTest ? null : mode; if (m) { S.stars[m] = starsOf(m) + 1; save(); } else { S.stars.test = starsOf('test') + 1; save(); } refreshStars(); }
  }
  function done() {
    if (isTest && score > S.best) { S.best = score; save(); }
    const msg = score === N ? 'Perfect! 🏆' : score >= N * .7 ? 'Awesome! 💖' : 'Keep going! 💪';
    app.innerHTML = `<div class="card result"><div class="big">${score}/${N}</div><div class="lh">${msg}</div>${pips()}
      <p style="font-size:16px;font-weight:600">✏️ Did you write your steps on paper?</p></div>
      <div class="row"><button class="btn" id="h">⌂ Home</button><button class="btn pink" id="a">↻ Again</button></div>`;
    if (score >= N * .7) { confetti(); skyButterflies(); }
    $('#h').onclick = () => go(home); $('#a').onclick = () => go(practice, mode);
  }
  next();
}

/* ----- Cheat sheet & videos ----- */
function cheat() {
  const it = (svg, h) => `<div class="item">${svg}<div>${h}</div></div>`;
  app.innerHTML = `<div class="lh">🧠 Cheat Sheet</div><div class="card sheet">
    ${it('<svg viewBox="0 0 110 76"><rect x="10" y="12" width="90" height="52" fill="#fcdbe6" stroke="#14a89c" stroke-width="6"/></svg>', '<span style="color:#0a7d74">P = fence around → ft</span><br><b>A = carpet inside → ft²</b>')}
    ${it(MINI.para.replace('0 0 70 48', '0 0 70 48" width="110" height="76'), '<b>A = b × h</b><br>slide the slice → rectangle')}
    ${it(MINI.tri.replace('0 0 70 48', '0 0 70 48" width="110" height="76'), '<b>A = ½ × b × h</b><br>half a parallelogram')}
    ${it(MINI.trap.replace('0 0 70 48', '0 0 70 48" width="110" height="76'), '<b>A = ½ (b₁ + b₂) h</b><br>add the parallels')}
    ${it(MINI.comp.replace('0 0 70 48', '0 0 70 48" width="110" height="76'), '<b>Split ➕ or cut ➖</b><br>add pieces or big − hole')}
    ${it('<svg viewBox="0 0 110 76"><polygon points="34,10 100,10 76,66 10,66" fill="#fcdbe6" stroke="#d99aae" stroke-width="2"/><line x1="34" y1="10" x2="34" y2="66" stroke="#6d28d9" stroke-width="3" stroke-dasharray="6 4"/><path d="M34,56 h10 v10" fill="none" stroke="#6d28d9" stroke-width="2"/></svg>', 'Height stands up ⊾ (dashed)<br><span style="color:#7d6b75">slant side → perimeter only</span>')}
    ${it('<svg viewBox="0 0 110 76"><text x="55" y="45" font-size="26" text-anchor="middle" fill="#c2416e">12 ft²</text></svg>', 'Answer = number + unit<br>area gets the little ²')}
  </div>`;
}
function videos() {
  const V = [
    ['uj6k22WubCk', 'Area of Parallelograms', 'Math with Mr. J · 4:30'],
    ['pvMuDPVOm7Y', 'How to Find the Area of a Triangle', 'Math with Mr. J'],
    ['-_SIZw5H4dA', 'Area of a Trapezoid', 'Math with Mr. J · 6:13'],
    ['hm17lVaor0Q', 'Area of parallelograms intuition', 'Khan Academy'],
    ['loAA3TCNAvU', 'Finding area by breaking up the shape', 'Khan Academy · 5:15'],
  ];
  app.innerHTML = `<div class="lh">🎬 Watch</div>${V.map((v, i) => `<a class="vid" href="https://www.youtube.com/watch?v=${v[0]}" target="_blank" rel="noopener"><span class="n">${i + 1}</span><span><b>${v[1]}</b><small>${v[2]}</small></span></a>`).join('')}
  <div class="sec">Extra</div>
  <a class="vid" href="https://www.youtube.com/watch?v=xCdxURXMdFY" target="_blank" rel="noopener"><span class="n">★</span><span><b>Math Antics – Area</b><small>square units + triangles</small></span></a>
  <a class="vid" href="https://www.youtube.com/watch?v=AAY1bsazcgM" target="_blank" rel="noopener"><span class="n">★</span><span><b>Math Antics – Perimeter</b><small>missing sides</small></span></a>`;
}

/* ---------- confetti ---------- */
const cv = $('#confetti'), cx = cv.getContext('2d'); let parts = [], raf = 0;
function confetti(big) {
  if (RM) return;
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  const cols = ['#c2416e', '#f6a9c4', '#b9a3dd', '#6cc7bb', '#f2c46b'];
  for (let i = 0; i < (big ? 90 : 50); i++) parts.push({ x: innerWidth / 2, y: innerHeight * .35, vx: (Math.random() - .5) * 12, vy: -Math.random() * 11 - 3, s: Math.random() * 7 + 4, c: pick(cols), r: Math.random() * 6, life: 70 + Math.random() * 30, star: false });
  if (!raf) tick();
}
function tick() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.r += .15; p.life--; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; if (p.star) { cx.font = p.s * 3 + 'px sans-serif'; cx.fillText('⭐', 0, 0); } else cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore(); });
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
  raf = parts.length ? requestAnimationFrame(tick) : (cx.clearRect(0, 0, innerWidth, innerHeight), 0);
}

/* ---------- start ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
const hs = location.hash.slice(1);
if (hs.startsWith('learn')) go(learn, +(hs.split('-')[1] || 0));
else if (hs.startsWith('p-')) go(practice, hs.slice(2));
else if (hs === 'cheat') go(cheat); else if (hs === 'videos') go(videos);
else go(home);

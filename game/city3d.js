/* Город Сбера — 3D-город на чистом WebGL 1 (без библиотек).
   Низкополигональные острова-отделы вокруг главного здания Сбера.
   Геометрия строится кодом, поэтому весит килобайты, а не мегабайты. */
(function (root) {
  'use strict';

  /* ---------- математика ---------- */
  function m4() { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function persp(fovy, asp, n, f) {
    var t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
    return m;
  }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function lookAt(e, t, u) {
    var z = norm(sub(e, t)), x = norm(cross(u, z)), y = cross(z, x), m = new Float32Array(16);
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
    m[12] = -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]);
    m[13] = -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]);
    m[14] = -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]);
    m[15] = 1;
    return m;
  }
  function trs(x, y, z, ry, s, sy) {
    var m = m4(), c = Math.cos(ry || 0), si = Math.sin(ry || 0);
    s = s == null ? 1 : s; sy = sy == null ? s : sy;
    m[0] = c * s; m[2] = -si * s; m[5] = sy; m[8] = si * s; m[10] = c * s;
    m[12] = x; m[13] = y; m[14] = z;
    return m;
  }
  function hex(h) { h = parseInt(h.slice(1), 16); return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]; }
  function shade(c, k) { return [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)]; }
  function grey(c, k) { var g = (c[0] + c[1] + c[2]) / 3; return [c[0] + (g - c[0]) * k, c[1] + (g - c[1]) * k, c[2] + (g - c[2]) * k]; }
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  /* ---------- построитель геометрии ---------- */
  function Mesh() { this.d = []; this.st = [m4()]; }
  Mesh.prototype.top = function () { return this.st[this.st.length - 1]; };
  Mesh.prototype.push = function (m) { this.st.push(mul(this.top(), m)); return this; };
  Mesh.prototype.pop = function () { this.st.pop(); return this; };
  Mesh.prototype.T = function (x, y, z) { var m = m4(); m[12] = x; m[13] = y; m[14] = z; return this.push(m); };
  Mesh.prototype.RY = function (a) { return this.push(trs(0, 0, 0, a)); };
  Mesh.prototype.RX = function (a) { var m = m4(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return this.push(m); };
  Mesh.prototype.RZ = function (a) { var m = m4(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return this.push(m); };
  Mesh.prototype.S = function (x, y, z) { var m = m4(); m[0] = x; m[5] = y; m[10] = z; return this.push(m); };
  Mesh.prototype.xf = function (p) {
    var m = this.top();
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  };
  Mesh.prototype.tri = function (a, b, c, col) {
    a = this.xf(a); b = this.xf(b); c = this.xf(c);
    var n = norm(cross(sub(b, a), sub(c, a)));
    this.d.push(a[0], a[1], a[2], n[0], n[1], n[2], col[0], col[1], col[2],
      b[0], b[1], b[2], n[0], n[1], n[2], col[0], col[1], col[2],
      c[0], c[1], c[2], n[0], n[1], n[2], col[0], col[1], col[2]);
  };
  Mesh.prototype.quad = function (a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); };
  // коробка: x,z — центр, y — низ
  Mesh.prototype.box = function (x, y, z, w, h, d, col, colTop) {
    var X0 = x - w / 2, X1 = x + w / 2, Y0 = y, Y1 = y + h, Z0 = z - d / 2, Z1 = z + d / 2;
    var ct = colTop || shade(col, 1.06), cs = col;
    this.quad([X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0], [X0, Y1, Z0], ct);
    this.quad([X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1], cs);
    this.quad([X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0], cs);
    this.quad([X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1], cs);
    this.quad([X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0], cs);
    this.quad([X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1], shade(col, 0.7));
    return this;
  };
  // цилиндр/конус: x,z — центр, y — низ
  Mesh.prototype.cyl = function (x, y, z, r0, r1, h, seg, col, colTop, noBottom) {
    var ct = colTop || shade(col, 1.05);
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var p0 = [x + c0 * r0, y, z + s0 * r0], p1 = [x + c1 * r0, y, z + s1 * r0];
      var q0 = [x + c0 * r1, y + h, z + s0 * r1], q1 = [x + c1 * r1, y + h, z + s1 * r1];
      if (r1 > 0.0001) this.quad(p0, q0, q1, p1, col); else this.tri(p0, q0, p1, col);
      if (r1 > 0.0001) this.tri([x, y + h, z], q1, q0, ct);
      if (!noBottom) this.tri([x, y, z], p0, p1, shade(col, 0.7));
    }
    return this;
  };
  // плоское кольцо (дорожки)
  Mesh.prototype.ring = function (x, y, z, r0, r1, seg, col, a0, a1) {
    a0 = a0 || 0; a1 = a1 == null ? Math.PI * 2 : a1;
    for (var i = 0; i < seg; i++) {
      var t0 = a0 + (a1 - a0) * i / seg, t1 = a0 + (a1 - a0) * (i + 1) / seg;
      this.quad([x + Math.cos(t0) * r0, y, z + Math.sin(t0) * r0], [x + Math.cos(t0) * r1, y, z + Math.sin(t0) * r1],
        [x + Math.cos(t1) * r1, y, z + Math.sin(t1) * r1], [x + Math.cos(t1) * r0, y, z + Math.sin(t1) * r0], col);
    }
    return this;
  };
  // сфера / полусфера
  Mesh.prototype.sph = function (x, y, z, r, col, seg, rings, sy, hemi, jitter) {
    seg = seg || 8; rings = rings || 6; sy = sy || 1;
    var rr = hemi ? rings : rings, top = Math.PI / 2, bot = hemi ? 0 : -Math.PI / 2;
    function P(i, j) {
      var la = bot + (top - bot) * j / rr, lo = i / seg * Math.PI * 2;
      return [x + Math.cos(la) * Math.cos(lo) * r, y + Math.sin(la) * r * sy, z + Math.cos(la) * Math.sin(lo) * r];
    }
    for (var j = 0; j < rr; j++) for (var i = 0; i < seg; i++) {
      var c = jitter ? shade(col, 0.92 + jitter() * 0.16) : col;
      var a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1);
      if (j === rr - 1) this.tri(a, d, b, c); else if (!hemi && j === 0) this.tri(a, cc, b, c);
      else this.quad(a, d, cc, b, c);
    }
    return this;
  };
  Mesh.prototype.torus = function (x, y, z, R, r, seg, col) {
    var sides = 6;
    for (var i = 0; i < seg; i++) for (var j = 0; j < sides; j++) {
      var P = function (ii, jj) {
        var u = ii / seg * Math.PI * 2, v = jj / sides * Math.PI * 2, rr = R + Math.cos(v) * r;
        return [x + Math.cos(u) * rr, y + Math.sin(v) * r, z + Math.sin(u) * rr];
      };
      this.quad(P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j), col);
    }
    return this;
  };

  /* ---------- палитра ---------- */
  var COL = {
    water: hex('#3FB8E8'), water2: hex('#5CCBF0'), sand: hex('#F2DDA4'), dirt: hex('#9C7A55'), grass: hex('#7ED957'),
    grass2: hex('#69C94A'), path: hex('#EFE6D2'), stone: hex('#E6E1D6'), cream: hex('#F7EEDB'), white: hex('#FFFFFF'),
    green: hex('#21A038'), green2: hex('#1A8A30'), glass: hex('#2E9C6A'), glassB: hex('#3E7FB8'), gold: hex('#FFC531'),
    gold2: hex('#F2A900'), yellow: hex('#FFD54A'), teal: hex('#2FC6A0'), slate: hex('#4A5160'), slate2: hex('#3A404D'),
    slate3: hex('#5D6575'), screen: hex('#2B3D59'), trunk: hex('#8A5A3B'), leaf: [hex('#5DC23C'), hex('#4FB233'), hex('#7AD34A'), hex('#3FA02E'), hex('#8BDB57')],
    orange: hex('#FF8A3D'), red: hex('#F25C54'), cyan: hex('#5BE7C4'), roof: hex('#DCE7E0')
  };

  /* ---------- сцена ---------- */
  function buildTree(m, x, y, z, R) {
    var t = R(), lc = COL.leaf[Math.floor(R() * COL.leaf.length)], s = 0.75 + R() * 0.55;
    if (t < 0.55) {
      m.cyl(x, y, z, 0.16 * s, 0.12 * s, 0.9 * s, 5, COL.trunk);
      m.sph(x, y + 1.25 * s, z, 0.75 * s, lc, 7, 4, 1, false, R);
      if (R() < 0.4) m.sph(x + 0.35 * s, y + 1.7 * s, z - 0.15 * s, 0.45 * s, shade(lc, 1.08), 6, 3);
    } else {
      m.cyl(x, y, z, 0.13 * s, 0.1 * s, 0.5 * s, 5, COL.trunk);
      m.cyl(x, y + 0.4 * s, z, 0.7 * s, 0, 1.3 * s, 7, shade(lc, 0.88));
      m.cyl(x, y + 1.1 * s, z, 0.5 * s, 0, 1.1 * s, 7, lc);
    }
  }

  function buildIsland(m, isl, R, bridgeAngles) {
    var x = isl.x, z = isl.z, r = isl.r, top = 0.8;
    m.cyl(x, -2.2, z, r + 0.9, r + 0.7, 2.25, 28, COL.sand, COL.sand, true);
    m.cyl(x, -1.6, z, r, r, 2.4, 28, COL.dirt, isl.center ? COL.grass2 : COL.grass, true);
    // дорожки
    m.ring(x, top + 0.02, z, r * 0.56, r * 0.68, 28, COL.path);
    bridgeAngles.forEach(function (a) {
      m.push(trs(x, 0, z, -a)).box(r * 0.62 + (r * 0.4) / 2, top + 0.005, 0, r * 0.45, 0.03, 1.5, COL.path).pop();
    });
    // деревья по краю
    var n = Math.round(r * 2.4), tries = 0, placed = 0;
    while (placed < n && tries++ < n * 6) {
      var a = R() * Math.PI * 2, rr = r * (0.74 + R() * 0.2), ok = true;
      for (var k = 0; k < bridgeAngles.length; k++) {
        var da = Math.atan2(Math.sin(a - bridgeAngles[k]), Math.cos(a - bridgeAngles[k]));
        if (Math.abs(da) < 0.28) ok = false;
      }
      if (!ok) continue;
      buildTree(m, x + Math.cos(a) * rr, top, z + Math.sin(a) * rr, R); placed++;
    }
    // кусты внутри кольца
    for (var i = 0; i < 6; i++) {
      var b = R() * Math.PI * 2, br = r * (0.46 + R() * 0.06);
      if (isl.center) continue;
      m.sph(x + Math.cos(b) * br, top, z + Math.sin(b) * br, 0.45, COL.leaf[i % 5], 6, 3, 0.8, true);
    }
  }

  function buildBridge(m, a, r0, r1) {
    var len = r1 - r0, cx = (r0 + r1) / 2;
    m.push(trs(0, 0, 0, -a));
    m.T(cx, 0, 0);
    for (var i = 0; i < 5; i++) {
      var t = (i + 0.5) / 5 - 0.5, h = 0.55 + Math.cos(t * Math.PI) * 0.45;
      m.box(t * len, h - 0.25, 0, len / 5 + 0.05, 0.25, 2.2, COL.stone);
      m.box(t * len, h, 1.05, len / 5 + 0.05, 0.35, 0.12, COL.white);
      m.box(t * len, h, -1.05, len / 5 + 0.05, 0.35, 0.12, COL.white);
    }
    m.box(-len / 2 + 0.3, -1, 0, 0.6, 1.5, 1.6, shade(COL.stone, 0.9));
    m.box(len / 2 - 0.3, -1, 0, 0.6, 1.5, 1.6, shade(COL.stone, 0.9));
    m.box(0, -1.2, 0, 0.8, 1.9, 1.4, shade(COL.stone, 0.85));
    m.pop().pop();
  }

  // ---- здания отделов (локально, центр в 0, низ на земле)
  function bGold(m) {
    m.box(0, 0, 0, 7, 0.5, 6, COL.cream);
    m.box(0, 0.5, 0, 6, 3.4, 5, COL.gold, shade(COL.gold, 1.1));
    // синие полосы целиком ниже карниза (верх 3.8 < 3.9): раньше последняя доходила до 4.25 и мерцала на крыше (z-fighting)
    [0.9, 1.9, 2.8].forEach(function (y) { m.box(0, 0.5 + y, 0, 6.08, 0.5, 5.08, COL.glassB); });
    m.box(0, 3.9, 0, 6.4, 0.35, 5.4, COL.cream);
    m.box(-0.6, 4.25, 0, 3.8, 1.3, 3.6, COL.gold2);
    m.box(-0.6, 4.25, 1.82, 3.4, 0.9, 0.06, COL.glassB);
    // слитки на крыше
    var bars = [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1], [1, 2]];
    bars.forEach(function (b) {
      m.push(trs(-1.4 + b[0] * 0.95, 5.55 + b[1] * 0.42, -0.1, 0.2));
      m.cyl(0, 0, 0, 0.62, 0.45, 0.42, 4, COL.yellow, hex('#FFE27A'));
      m.pop();
    });
    m.box(2.6, 4.25, 0.8, 1.2, 1.8, 1.2, COL.cream).box(2.6, 6.05, 0.8, 1.4, 0.3, 1.4, COL.gold2);
    m.box(0, 0.5, 2.6, 1.6, 1.6, 0.1, COL.cream).box(0, 0.5, 2.62, 1.2, 1.3, 0.1, COL.glassB);
    m.box(-4.4, 0, 2.2, 1.6, 0.15, 1.6, COL.cream).box(-4.4, 0.12, 2.2, 1.3, 0.06, 1.3, COL.water2);
  }
  function bCredit(m) {
    m.box(0, 0, 0, 7, 0.4, 6, COL.cream);
    m.box(-1.5, 0.4, 0, 3.2, 6.2, 3.4, COL.teal).box(-1.5, 6.6, 0, 3.6, 0.35, 3.8, COL.white);
    for (var y = 1.2; y < 6.4; y += 1.3) m.box(-1.5, y, 0, 3.28, 0.18, 3.48, COL.white);
    m.box(1.9, 0.4, 0.4, 3, 4.2, 3, hex('#45D3B0')).box(1.9, 4.6, 0.4, 3.3, 0.3, 3.3, COL.white);
    for (var y2 = 1.2; y2 < 4.4; y2 += 1.3) m.box(1.9, y2, 0.4, 3.08, 0.18, 3.08, COL.white);
    m.box(0.2, 3.0, 0.2, 1.6, 0.8, 1.6, COL.white);
    m.sph(1.9, 4.9, 0.4, 1.1, COL.leaf[0], 7, 3, 0.7, true);
    // стопка монет
    for (var i = 0; i < 4; i++) m.cyl(-1.5, 6.95 + i * 0.32, 0, 1.0 - i * 0.05, 1.0 - i * 0.05, 0.3, 14, COL.gold2, COL.yellow);
  }
  function bDark(m, kind) {
    m.box(0, 0, 0, 6.8, 0.4, 6, COL.slate3);
    m.box(0, 0.4, 0, 5.8, 3.2, 5, COL.slate, shade(COL.slate, 1.15));
    m.box(0, 3.6, 0, 4.8, 1.6, 4.2, COL.slate2, shade(COL.slate2, 1.2));
    m.box(0, 4.0, 2.12, 2.6, 1.0, 0.1, COL.screen);
    m.box(0, 0.4, 2.52, 1.4, 1.6, 0.1, COL.screen);
    m.box(-2.95, 0.4, 0, 0.3, 3.0, 5.1, COL.slate3).box(2.95, 0.4, 0, 0.3, 3.0, 5.1, COL.slate3);
    if (kind === 'chart') { [1.0, 1.7, 2.6].forEach(function (h, i) { m.box(-1.2 + i * 1.2, 5.2, -0.4, 0.8, h, 0.8, COL.slate3); }); }
    if (kind === 'globe') { m.cyl(0, 5.2, 0, 0.3, 0.3, 0.5, 6, COL.slate3); m.sph(0, 6.6, 0, 1.25, COL.slate3, 10, 6); m.torus(0, 6.6, 0, 1.4, 0.08, 18, COL.slate2); }
    if (kind === 'coins') { for (var i = 0; i < 3; i++) m.cyl(-0.8 + i * 0.8, 5.2, 0, 0.6, 0.6, 0.4 + i * 0.35, 12, COL.slate3); }
    if (kind === 'wallet') { m.box(0, 5.2, 0, 2.8, 1.4, 1.4, COL.slate3).box(0.9, 5.7, 0.75, 1.2, 0.6, 0.15, COL.slate2); }
  }

  // ---- главное здание: три состояния
  function sberBase(m, colStone) {
    m.cyl(0, 0, 0, 8.2, 8.2, 0.25, 32, colStone);
    m.cyl(0, 0.25, 0, 7.4, 7.4, 0.3, 32, colStone);
    m.cyl(0, 0.55, 0, 6.6, 6.6, 0.3, 32, colStone);
    return 0.85;
  }
  function sberLogo(m, ringCol, bg) {
    m.RX(Math.PI / 2);
    m.cyl(0, 0, 0, 1.3, 1.3, 0.12, 20, bg || COL.white);
    m.T(0, 0.13, 0).RY(0);
    // галочка в круге
    m.torus(0, 0, 0, 0.92, 0.12, 20, ringCol);
    m.push(trs(-0.22, 0.02, 0.1, 0.0)).RY(-0.8).box(0, 0, 0, 0.7, 0.08, 0.24, ringCol).pop();
    m.push(trs(0.25, 0.02, -0.05, 0)).RY(0.75).box(0, 0, 0, 1.2, 0.08, 0.24, ringCol).pop();
    m.pop().pop();
  }
  function bSberClassic(m) {
    var y = sberBase(m, COL.stone);
    m.cyl(0, y, 0, 4.5, 4.5, 4.2, 24, COL.glass);
    for (var k = 0; k < 4; k++) m.cyl(0, y + 0.9 + k * 0.95, 0, 4.56, 4.56, 0.12, 24, shade(COL.glass, 1.25));
    for (var i = 0; i < 16; i++) {
      var a = i / 16 * Math.PI * 2;
      m.cyl(Math.cos(a) * 5.4, y, Math.sin(a) * 5.4, 0.36, 0.32, 4.2, 8, COL.cream);
      m.box(Math.cos(a) * 5.4, y, Math.sin(a) * 5.4, 0.9, 0.25, 0.9, COL.white);
    }
    m.cyl(0, y + 4.2, 0, 6.0, 6.0, 0.7, 32, COL.white);
    m.cyl(0, y + 4.9, 0, 5.6, 5.4, 0.35, 32, COL.green);
    m.cyl(0, y + 5.25, 0, 4.9, 4.9, 0.8, 28, COL.cream);
    m.sph(0, y + 6.05, 0, 4.7, COL.green, 20, 7, 0.82, true);
    for (var r = 0; r < 12; r++) { m.push(trs(0, y + 6.05, 0, r / 12 * Math.PI * 2)); m.RZ(0); m.pop(); }
    m.cyl(0, y + 9.7, 0, 0.8, 0.7, 0.6, 12, COL.white).sph(0, y + 10.3, 0, 0.55, COL.green, 10, 4, 1, true);
    // логотип на куполе спереди
    m.push(trs(0, y + 6.05, 0, 0)).RX(-0.62).T(0, 0, 4.0 * 0.86).S(1.15, 1.15, 1.15);
    sberLogo(m, COL.green);
    m.pop();
    // крыльцо
    m.box(0, 0.85, 6.2, 3.4, 0.3, 1.6, COL.white);
  }
  function bSberRepair(m) {
    var stone = grey(COL.stone, 0.5), g = grey(COL.green, 0.55);
    var y = sberBase(m, shade(stone, 0.95));
    m.cyl(0, y, 0, 4.5, 4.5, 4.2, 24, grey(COL.glass, 0.6));
    for (var i = 0; i < 16; i++) {
      var a = i / 16 * Math.PI * 2, h = i % 3 === 1 ? 2.2 : i % 5 === 0 ? 3.1 : 4.2;
      m.cyl(Math.cos(a) * 5.4, y, Math.sin(a) * 5.4, 0.36, 0.32, h, 8, grey(COL.cream, 0.5));
    }
    m.cyl(0, y + 4.2, 0, 5.2, 5.2, 0.6, 28, grey(COL.white, 0.3));
    m.sph(0, y + 4.8, 0, 4.4, g, 16, 4, 0.6, true);
    // леса вокруг
    for (var s = 0; s < 10; s++) {
      var b = s / 10 * Math.PI * 2, x = Math.cos(b) * 6.6, z = Math.sin(b) * 6.6;
      m.box(x, y, z, 0.16, 7.2, 0.16, COL.orange);
    }
    for (var lv = 1; lv <= 3; lv++) m.torus(0, y + lv * 2.3, 0, 6.6, 0.1, 20, hex('#FFB13D'));
    for (var lv2 = 1; lv2 <= 3; lv2++) m.ring(0, y + lv2 * 2.3 - 0.05, 0, 6.2, 7.0, 20, hex('#D9B48A'));
    // кран
    m.box(9.5, 0.8, -3, 1.2, 0.6, 1.2, COL.yellow);
    m.box(9.5, 1.4, -3, 0.5, 13, 0.5, COL.yellow);
    m.push(trs(9.5, 14.4, -3, 0.5)).box(-3.5, 0, 0, 11, 0.45, 0.45, COL.yellow).box(1.8, -0.6, 0, 1.2, 0.9, 1, COL.slate).pop();
    // конусы
    for (var c = 0; c < 5; c++) {
      var ca = 1.2 + c * 0.35, cx = Math.cos(ca) * 7.6, cz = Math.sin(ca) * 7.6;
      m.cyl(cx, 0.85, cz, 0.35, 0.05, 0.9, 8, COL.orange);
      m.cyl(cx, 1.15, cz, 0.25, 0.22, 0.18, 8, COL.white);
    }
    m.push(trs(0, y + 2.4, 5.6, 0)).box(0, 0, 0, 3.8, 1.2, 0.15, COL.yellow).box(0, 0.25, 0.09, 3.2, 0.25, 0.05, COL.slate).box(0, 0.7, 0.09, 3.2, 0.25, 0.05, COL.slate).pop();
  }
  function bSberFuture(m) {
    var y = sberBase(m, COL.white);
    m.cyl(0, y, 0, 5.2, 4.6, 3.0, 28, COL.white);
    m.cyl(0, y + 0.2, 0, 5.25, 4.65, 2.4, 28, hex('#2FD08A'));
    m.cyl(0, y + 3.0, 0, 3.9, 3.4, 8.5, 24, hex('#36C98F'));
    for (var k = 0; k < 6; k++) m.cyl(0, y + 3.6 + k * 1.35, 0, 3.95 - k * 0.07, 3.9 - k * 0.07, 0.14, 24, COL.white);
    m.cyl(0, y + 11.5, 0, 3.4, 2.4, 1.0, 24, COL.white);
    m.cyl(0, y + 12.5, 0, 2.4, 1.6, 3.2, 20, COL.cyan);
    m.cyl(0, y + 15.7, 0, 1.6, 0, 3.2, 16, COL.white);
    m.sph(0, y + 18.9, 0, 0.45, COL.cyan, 8, 4);
    // боковые капсулы
    for (var i = 0; i < 4; i++) {
      var a = i / 4 * Math.PI * 2 + 0.4;
      m.cyl(Math.cos(a) * 5.0, y + 3.0, Math.sin(a) * 5.0, 1.1, 1.1, 3.5, 12, hex('#45D9A3'));
      m.sph(Math.cos(a) * 5.0, y + 6.5, Math.sin(a) * 5.0, 1.1, COL.white, 12, 4, 0.7, true);
    }
    m.push(trs(0, y + 8.0, 0, 0)).T(0, 0, 3.75).RX(-0.05).S(1.2, 1.2, 1.2);
    sberLogo(m, COL.green);
    m.pop();
    m.box(0, 0.85, 6.2, 3.4, 0.3, 1.6, COL.white);
  }
  function halo(m) { m.torus(0, 0, 0, 6.2, 0.22, 40, COL.cyan); m.torus(0, 0, 0, 7.2, 0.1, 40, COL.white); }
  function pin(m) { m.sph(0, 0, 0, 0.9, COL.green, 4, 2, 1.6); m.sph(0, 0, 0, 0.55, COL.white, 4, 2, 1.6); }
  function boat(m) {
    m.box(0, 0, 0, 3.2, 0.6, 1.3, COL.white).box(-0.2, 0.6, 0, 1.4, 0.6, 1.0, COL.white).box(-0.15, 0.75, 0, 1.45, 0.25, 1.05, COL.glassB);
    m.box(1.7, 0.05, 0, 0.5, 0.45, 0.8, COL.white);
  }
  function sail(m) { m.box(0, 0, 0, 2.2, 0.5, 0.9, COL.white); m.box(0, 0.5, 0, 0.1, 2.6, 0.1, COL.slate); m.push(trs(0.05, 0.7, 0, 0)).quad([0, 0, 0], [1.1, 0, 0], [0, 2.2, 0], [0, 2.2, 0], COL.white); m.tri([0, 0, 0], [0, 2.2, 0], [1.1, 0, 0], COL.white); m.pop(); }
  function cloud(m, R) {
    for (var i = 0; i < 5; i++) m.sph((R() - 0.5) * 5, (R() - 0.3) * 1.2, (R() - 0.5) * 2.4, 1.2 + R() * 1.1, COL.white, 7, 4, 0.75);
  }
  function lock(m) {
    m.box(0, 0, 0, 1.4, 1.1, 0.5, COL.white);
    m.push(trs(0, 1.1, 0, 0)).RX(Math.PI / 2).torus(0, 0, 0, 0.45, 0.12, 12, COL.white).pop();
  }
  function cube(m) { m.box(0, -0.5, 0, 1, 1, 1, COL.white); }
  function water(m) {
    var N = 44, S = 260, c1 = COL.water, c2 = COL.water2;
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
      var x0 = -S / 2 + S * i / N, x1 = -S / 2 + S * (i + 1) / N, z0 = -S / 2 + S * j / N, z1 = -S / 2 + S * (j + 1) / N;
      var c = c1;
      m.quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], c);
    }
  }

  /* ---------- шейдеры ---------- */
  var VS = [
    'attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;',
    'uniform mat4 uVP;uniform mat4 uM;uniform float uT;uniform float uWave;uniform vec3 uEye;',
    'varying vec3 vC;varying vec3 vN;varying float vD;varying float vH;',
    'void main(){vec4 p=uM*vec4(aP,1.0);',
    'if(uWave>0.0){p.y+=sin(p.x*0.22+uT*1.3)*0.16+cos(p.z*0.19+uT*1.1)*0.16;}',
    'vN=normalize(mat3(uM)*aN);vC=aC;vD=distance(p.xyz,uEye);vH=p.y;gl_Position=uVP*p;}'
  ].join('\n');
  var FS = [
    'precision mediump float;',
    'uniform vec3 uTint;uniform vec3 uGlow;uniform vec3 uFog;uniform vec2 uFogR;uniform float uWaveF;',
    'varying vec3 vC;varying vec3 vN;varying float vD;varying float vH;',
    'void main(){vec3 n=normalize(vN);vec3 L=normalize(vec3(0.45,1.0,0.6));',
    'float dif=max(dot(n,L),0.0);vec3 amb=mix(vec3(0.62,0.6,0.58),vec3(0.82,0.9,1.0),n.y*0.5+0.5);',
    'vec3 c=vC*uTint*(amb*0.62+dif*0.55)+uGlow;',
    'if(uWaveF>0.0){c+=vec3(0.08)*pow(max(dot(reflect(-L,n),vec3(0.0,1.0,0.0)),0.0),8.0);}',
    'float f=smoothstep(uFogR.x,uFogR.y,vD);gl_FragColor=vec4(mix(c,uFog,f),1.0);}'
  ].join('\n');

  /* ---------- сам город ---------- */
  function City(canvas, islands, opts) {
    opts = opts || {};
    var gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'default', preserveDrawingBuffer: false }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('no webgl');
    this.gl = gl; this.canvas = canvas; this.islands = islands;
    this.fog = hex('#CDEBFA');
    this.t = 0; this.handlers = {};
    this.cam = { yaw: 0.72, pitch: 0.92, dist: 80, tx: 0, ty: 0, tz: 0 };
    this.goal = null; this.auto = 0.04; this.shiftY = 0; this.shiftX = 0; this.fitR = 36;
    this.focusId = null; this.sberState = 'classic'; this.sberAnim = null; this.parts = [];
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); this.frames = []; this.paused = false;
    this.init();
    this.layout();
    this.build();
    this.bindInput();
    this.resize();
  }
  var P = City.prototype;

  P.init = function () {
    var gl = this.gl;
    function sh(t, src) { var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    this.prog = p;
    var u = this.u = {};
    ['uVP', 'uM', 'uT', 'uWave', 'uWaveF', 'uEye', 'uTint', 'uGlow', 'uFog', 'uFogR'].forEach(function (n) { u[n] = gl.getUniformLocation(p, n); });
    this.aP = gl.getAttribLocation(p, 'aP'); this.aN = gl.getAttribLocation(p, 'aN'); this.aC = gl.getAttribLocation(p, 'aC');
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  };

  P.layout = function () {
    var n = 0, list = this.islands;
    this.center = { id: 'sber', x: 0, z: 0, r: 11.5, center: true };
    var ring = list.length, R0 = 27;
    list.forEach(function (isl, i) {
      var a = -Math.PI / 2 + Math.PI / ring + i / ring * Math.PI * 2;
      isl.a = a; isl.x = Math.cos(a) * R0; isl.z = Math.sin(a) * R0; isl.r = 7.6; isl.h = 6; n++;
    });
  };

  P.upload = function (m) {
    var gl = this.gl, b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.d), gl.STATIC_DRAW);
    return { b: b, n: m.d.length / 9 };
  };

  P.build = function () {
    var R = rnd(7), self = this, st = new Mesh();
    var bridges = this.islands.map(function (i) { return i.a; });
    buildIsland(st, this.center, R, bridges);
    // площадь и фонтан перед Сбером
    st.ring(0, 0.83, 0, 8.3, 9.3, 32, COL.path);
    st.cyl(0, 0.8, 10.2, 1.5, 1.6, 0.5, 16, COL.stone).cyl(0, 1.2, 10.2, 1.2, 1.2, 0.12, 16, COL.water2).cyl(0, 1.2, 10.2, 0.25, 0.2, 1.1, 8, COL.stone).sph(0, 2.3, 10.2, 0.4, COL.water2, 8, 4);
    this.islands.forEach(function (isl) {
      buildIsland(st, isl, R, [isl.a + Math.PI]);
      buildBridge(st, isl.a, self.center.r - 0.4, 27 - isl.r + 0.4);
      st.push(trs(isl.x, 0.8, isl.z, -isl.a - Math.PI / 2 + Math.PI));
      st.cyl(0, 0.01, 0, 4.9, 4.9, 0.02, 20, shade(COL.grass, 0.85));
      if (isl.icon === 'gold') bGold(st);
      else if (isl.icon === 'handshake') bCredit(st);
      else bDark(st, isl.icon);
      st.pop();
    });
    this.sStatic = this.upload(st);
    var w = new Mesh(); water(w); this.sWater = this.upload(w);
    var mk = function (fn) { var m = new Mesh(); fn(m); return self.upload(m); };
    this.sSber = { classic: mk(bSberClassic), repair: mk(bSberRepair), future: mk(bSberFuture) };
    this.sHalo = mk(halo); this.sPin = mk(pin); this.sBoat = mk(boat); this.sSail = mk(sail); this.sLock = mk(lock); this.sCube = mk(cube);
    var Rc = rnd(3);
    this.sCloud = [mk(function (m) { cloud(m, Rc); }), mk(function (m) { cloud(m, Rc); })];
  };

  P.draw = function (o, M, tint, glow, wave) {
    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, o.b);
    gl.vertexAttribPointer(this.aP, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(this.aN, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(this.aC, 3, gl.FLOAT, false, 36, 24);
    gl.uniformMatrix4fv(this.u.uM, false, M || m4());
    gl.uniform3fv(this.u.uTint, tint || [1, 1, 1]);
    gl.uniform3fv(this.u.uGlow, glow || [0, 0, 0]);
    gl.uniform1f(this.u.uWave, wave ? 1 : 0); gl.uniform1f(this.u.uWaveF, wave ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, o.n);
  };

  P.resize = function () {
    var c = this.canvas, w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    c.width = Math.round(w * this.dpr); c.height = Math.round(h * this.dpr);
    this.w = w; this.h = h;
    this.gl.viewport(0, 0, c.width, c.height);
  };

  P.fitDist = function (R) {
    var fovy = 0.62, asp = this.w / this.h, fovx = 2 * Math.atan(Math.tan(fovy / 2) * asp);
    var f = Math.min(fovy, fovx);
    return R / Math.sin(f / 2);
  };

  P.matrices = function () {
    var c = this.cam, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    var eye = [c.tx + Math.sin(c.yaw) * cp * c.dist, c.ty + sp * c.dist, c.tz + Math.cos(c.yaw) * cp * c.dist];
    var proj = persp(0.62, this.w / this.h, 1, 600);
    proj[9] = -this.shiftY; proj[8] = -this.shiftX;
    var view = lookAt(eye, [c.tx, c.ty, c.tz], [0, 1, 0]);
    this.vp = mul(proj, view); this.eye = eye;
    return this.vp;
  };

  P.project = function (x, y, z) {
    var m = this.vp; if (!m) return null;
    var cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.01) return null;
    return { x: (cx / cw * 0.5 + 0.5) * this.w, y: (1 - (cy / cw * 0.5 + 0.5)) * this.h, w: cw };
  };

  /* ---------- управление ---------- */
  P.on = function (n, f) { this.handlers[n] = f; };
  P.emit = function (n, a) { if (this.handlers[n]) this.handlers[n](a); };

  P.bindInput = function () {
    var self = this, c = this.canvas, pts = {}, start = null, vy = 0, lastPinch = 0;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      try { c.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      var ids = Object.keys(pts);
      if (ids.length === 1) start = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
      else { start = null; lastPinch = 0; }
      self.userTouch = performance.now(); self.velYaw = 0;
    });
    c.addEventListener('pointermove', function (e) {
      var p = pts[e.pointerId]; if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      var ids = Object.keys(pts);
      if (ids.length === 1) {
        if (start) start.moved += Math.abs(dx) + Math.abs(dy);
        if (start && start.moved < 6) return;
        self.cam.yaw -= dx * 0.0065; self.velYaw = -dx * 0.0065;
        self.cam.pitch = Math.max(0.55, Math.min(1.3, self.cam.pitch + dy * 0.004));
        self.goal = self.goal && self.goal.keepYaw ? self.goal : (self.goal ? Object.assign(self.goal, { yaw: null, pitch: null }) : null);
      } else if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastPinch) { self.zoom *= lastPinch / d; self.zoom = Math.max(0.5, Math.min(1.6, self.zoom)); }
        lastPinch = d;
      }
      self.userTouch = performance.now();
    });
    function up(e) {
      if (start && Object.keys(pts).length === 1 && start.moved < 10 && performance.now() - start.t < 450) self.tap(e.clientX, e.clientY);
      delete pts[e.pointerId]; start = null; lastPinch = 0;
    }
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', function (e) { delete pts[e.pointerId]; start = null; });
    c.addEventListener('wheel', function (e) { e.preventDefault(); self.zoom = Math.max(0.5, Math.min(1.6, self.zoom * (1 + e.deltaY * 0.001))); }, { passive: false });
    this.zoom = 1;
  };

  P.tap = function (x, y) {
    var r = this.canvas.getBoundingClientRect(); x -= r.left; y -= r.top;
    var best = null, bd = 1e9, self = this;
    var cands = this.islands.concat([this.center]);
    cands.forEach(function (isl) {
      var p = self.project(isl.x, 3, isl.z); if (!p) return;
      var rad = isl.r * (self.h / 2) / Math.tan(0.31) / p.w * 0.95;
      var d = Math.hypot(p.x - x, p.y - y);
      if (d < rad && d / rad < bd) { bd = d / rad; best = isl; }
    });
    if (best) this.emit('pick', best.id);
  };

  /* ---------- камера ---------- */
  P.home = function (instant) {
    this.focusId = null;
    this.goal = { tx: 0, ty: 0, tz: 0, R: this.homeR || 31, pitch: 0.92 };
    if (instant) { this.cam.dist = this.fitDist(this.homeR || 31); }
  };
  P.focus = function (id, R) {
    var isl = id === 'sber' ? this.center : this.islands.filter(function (i) { return i.id === id; })[0];
    if (!isl) return;
    this.focusId = id;
    var yaw = Math.atan2(isl.x, isl.z) || this.cam.yaw;
    // смотрим на остров «из центра города», чтобы фасад был виден
    if (id !== 'sber') yaw = Math.atan2(isl.x, isl.z);
    this.goal = { tx: isl.x, ty: id === 'sber' ? 5 : 2.5, tz: isl.z, R: R || (id === 'sber' ? 15 : 10.5), pitch: id === 'sber' ? 0.6 : 0.78, yaw: yaw };
  };
  P.setShift = function (x, y) { this.shiftTarget = [x, y]; };

  P.setSber = function (state, animate) {
    if (state === this.sberState) return;
    if (!animate) { this.sberState = state; return; }
    this.sberAnim = { from: this.sberState, to: state, t: 0 };
    var col = state === 'future' ? [hex('#FFC531'), COL.cyan, COL.green] : state === 'repair' ? [COL.orange, hex('#B8C0C8'), COL.yellow] : [COL.green, COL.white, COL.gold];
    var R = Math.random;
    for (var i = 0; i < 46; i++) {
      var a = R() * Math.PI * 2, sp = 4 + R() * 7;
      this.parts.push({ x: 0, y: 6, z: 0, vx: Math.cos(a) * sp * 0.6, vy: 6 + R() * 9, vz: Math.sin(a) * sp * 0.6, s: 0.35 + R() * 0.4, c: col[i % 3], life: 1.6 + R() * 0.8, r: R() * 6 });
    }
  };

  /* ---------- кадр ---------- */
  P.frame = function (dt) {
    var c = this.cam, g = this.goal;
    this.t += dt;
    // авто-вращение, если не трогали
    var idle = performance.now() - (this.userTouch || 0) > 2500;
    if (Math.abs(this.velYaw || 0) > 0.0001 && !idle) { c.yaw += this.velYaw; this.velYaw *= 0.92; }
    if (idle && this.auto) c.yaw += this.auto * dt;
    if (g) {
      var k = 1 - Math.pow(0.0025, dt);
      c.tx += (g.tx - c.tx) * k; c.ty += (g.ty - c.ty) * k; c.tz += (g.tz - c.tz) * k;
      var want = this.fitDist(g.R) * this.zoom;
      c.dist += (want - c.dist) * k;
      if (g.pitch != null) c.pitch += (g.pitch - c.pitch) * k * 0.8;
      if (g.yaw != null) {
        var dy = Math.atan2(Math.sin(g.yaw - c.yaw), Math.cos(g.yaw - c.yaw));
        c.yaw += dy * k;
        if (Math.abs(dy) < 0.01) g.yaw = null;
      }
    }
    if (this.shiftTarget) {
      var ks = 1 - Math.pow(0.004, dt);
      this.shiftX += (this.shiftTarget[0] - this.shiftX) * ks; this.shiftY += (this.shiftTarget[1] - this.shiftY) * ks;
    }
    this.render();
  };

  P.render = function () {
    var gl = this.gl, u = this.u, t = this.t, self = this;
    gl.clearColor(this.fog[0], this.fog[1], this.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.enableVertexAttribArray(this.aP); gl.enableVertexAttribArray(this.aN); gl.enableVertexAttribArray(this.aC);
    gl.uniformMatrix4fv(u.uVP, false, this.matrices());
    gl.uniform1f(u.uT, t);
    gl.uniform3fv(u.uEye, this.eye);
    gl.uniform3fv(u.uFog, this.fog);
    gl.uniform2fv(u.uFogR, [this.cam.dist * 1.15 + 20, this.cam.dist * 2.3 + 160]);

    this.draw(this.sWater, null, null, null, true);
    var focus = this.focusId;
    this.draw(this.sStatic);

    // главное здание
    var a = this.sberAnim, sx = 1;
    if (a) {
      a.t += 1 / 60;
      var t1 = Math.min(1, a.t / 0.45), t2 = Math.max(0, Math.min(1, (a.t - 0.45) / 0.9));
      if (t2 <= 0) this.draw(this.sSber[a.from], trs(0, 0.8, 0, 0, 1, Math.max(0.02, 1 - t1 * t1)));
      else {
        var e = 1 + Math.sin(t2 * Math.PI) * 0.18 * (1 - t2); var sy = t2 < 1 ? (1 - Math.pow(1 - t2, 3)) * e : 1;
        this.draw(this.sSber[a.to], trs(0, 0.8, 0, 0, 1, Math.max(0.02, sy)));
        if (t2 >= 1) { this.sberState = a.to; this.sberAnim = null; }
      }
    } else this.draw(this.sSber[this.sberState], trs(0, 0.8, 0, 0, sx));
    if ((a ? a.to : this.sberState) === 'future') {
      var hy = this.sberState === 'future' && !a ? 1 : 0.0;
      if (hy) { this.draw(this.sHalo, trs(0, 13.5 + Math.sin(t * 1.5) * 0.4, 0, t * 0.6, 1), null, [0.12, 0.2, 0.16]); }
    }

    // маркеры над играбельными отделами и замки над закрытыми
    this.islands.forEach(function (isl) {
      if (isl.playable) {
        var bob = Math.sin(t * 2.2 + isl.a * 3) * 0.45, hot = focus === isl.id;
        self.draw(self.sPin, trs(isl.x, 11.2 + bob, isl.z, t * 1.6, hot ? 1.25 : 1), isl.icon === 'gold' ? [1.3, 1.1, 0.2] : [1, 1, 1], hot ? [0.05, 0.12, 0.05] : null);
      } else {
        self.draw(self.sLock, trs(isl.x, 9.2 + Math.sin(t * 1.4 + isl.a) * 0.2, isl.z, -isl.a - Math.PI / 2, 0.9), [0.95, 0.97, 1]);
      }
    });
    // лодки
    for (var i = 0; i < 4; i++) {
      var r = 44 + i * 6, sp = (0.05 + i * 0.012) * (i % 2 ? -1 : 1), ang = t * sp + i * 1.7;
      var bx = Math.cos(ang) * r, bz = Math.sin(ang) * r, yaw = -ang + (sp > 0 ? -Math.PI / 2 : Math.PI / 2);
      this.draw(i % 2 ? this.sSail : this.sBoat, trs(bx, 0.1 + Math.sin(t * 2 + i) * 0.12, bz, yaw + Math.PI / 2, 1));
    }
    // облака
    for (var k = 0; k < 6; k++) {
      var ca = k / 6 * Math.PI * 2 + t * 0.012, cr = 58 + (k % 3) * 9;
      this.draw(this.sCloud[k % 2], trs(Math.cos(ca) * cr, 20 + (k % 3) * 3, Math.sin(ca) * cr, k, 1.6));
    }
    // частицы преображения
    if (this.parts.length) {
      var dt = 1 / 60;
      this.parts = this.parts.filter(function (p) {
        p.life -= dt; p.vy -= 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.r += dt * 5;
        if (p.y < 1) { p.y = 1; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
        var s = p.s * Math.min(1, p.life * 2);
        self.draw(self.sCube, trs(p.x, p.y, p.z, p.r, s), p.c, [0.08, 0.08, 0.08]);
        return p.life > 0;
      });
    }
  };

  P.snapshot = function () { this.render(); try { return this.canvas.toDataURL('image/jpeg', 0.85); } catch (e) { return null; } };

  P.start = function () {
    var self = this, last = performance.now();
    function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!self.paused && !document.hidden) {
        self.frame(dt);
        self.emit('frame', dt);
        // адаптивное разрешение для слабых телефонов
        self.frames.push(dt);
        if (self.frames.length >= 90) {
          var avg = self.frames.reduce(function (a, b) { return a + b; }, 0) / self.frames.length;
          self.frames = [];
          if (avg > 0.024 && self.dpr > 1) { self.dpr = Math.max(1, self.dpr - 0.5); self.resize(); }
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  };

  root.City3D = City;
})(this);

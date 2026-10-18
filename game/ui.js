/* Город Сбера — интерфейс: экраны, карточки со свайпом, связь с приложением. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  function appW() { return $('app').clientWidth || window.innerWidth; }
  function appH() { return $('app').clientHeight || window.innerHeight; }
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ic = function (id, cls) { return '<svg class="' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; };
  var MINUS = '−';
  var sgn = function (n) { return n > 0 ? '+' + n : n < 0 ? MINUS + Math.abs(n) : '0'; };
  var pl = function (n, a, b, c) { n = Math.abs(n) % 100; var d = n % 10; if (n > 10 && n < 20) return c; if (d > 1 && d < 5) return b; if (d === 1) return a; return c; };
  var W = {
    coins: function (n) { return pl(n, 'монета', 'монеты', 'монет'); },
    shields: function (n) { return pl(n, 'щит', 'щита', 'щитов'); },
    hearts: function (n) { return pl(n, 'сердце', 'сердца', 'сердец'); }
  };
  var ICON = { coins: 'i-coin', shields: 'i-shield', hearts: 'i-heart' };
  var ISL_ICON = { gold: 'i-gold', handshake: 'i-handshake', wallet: 'i-wallet', chart: 'i-chart', coins: 'i-coins', globe: 'i-globe' };
  var STYLE = {
    balanced: { name: 'Взвешенный банкир', text: 'Рисковал, когда новости были за тебя, и защищался, когда против.' },
    risky: { name: 'Азартный банкир', text: 'Часто рисковал без подсказки новостей. Смело — но банку нужна осторожность.' },
    cautious: { name: 'Осторожный банкир', text: 'Берёг банк, но упускал выгодные сделки, о которых говорили новости.' }
  };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- связь с приложением (контракт песочницы) ---------- */
  var Bridge = {
    completed: false,
    send: function (type, extra) {
      var msg = { type: type };
      if (extra) for (var k in extra) msg[k] = extra[k];
      try { window.postMessage(msg, '*'); } catch (e) { /* вне приложения просто молчим */ }
    },
    vibrate: function () { this.send('VIBRATION_EVENT'); },
    complete: function () { if (!this.completed) { this.completed = true; this.send('COMPLETED_EVENT'); } }
  };

  /* ---------- контент: встроенный + с сервера/CDN ---------- */
  var CONTENT = window.SBER_CITY_CONTENT;
  function validDeck(d) {
    return d && Array.isArray(d.events) && d.events.length >= 5 && d.events.every(function (e) { return e && e.text && e.explain; }) &&
      Array.isArray(d.choices) && d.choices.length >= 4 && d.choices.every(function (c) { return c && c.title && c.text && c.options && c.options.right && c.options.left && c.options.right.label && c.options.left.label; }) &&
      Array.isArray(d.facts) && d.facts.length > 0;
  }
  function validConfig(c) { return c && Array.isArray(c.islands) && c.islands.length && c.start && typeof c.start.coins === 'number' && c.months >= 3 && c.months <= 10; }
  function getJSON(url, ms) {
    return new Promise(function (res) {
      var done = false, t = setTimeout(function () { done = true; res(null); }, ms);
      try {
        fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (!done) { clearTimeout(t); res(j); } })
          .catch(function () { if (!done) { clearTimeout(t); res(null); } });
      } catch (e) { clearTimeout(t); res(null); }
    });
  }
  function loadRemote() {
    var meta = document.querySelector('meta[name="content-base"]');
    var base = (meta && meta.content) || 'content/';
    getJSON(base + 'config.json', 2500).then(function (cfg) {
      if (!validConfig(cfg)) return;
      var decks = {}, jobs = cfg.islands.filter(function (i) { return i.playable && i.deck; }).map(function (i) {
        return getJSON(base + i.deck, 2500).then(function (d) { if (validDeck(d)) decks[i.id] = d; });
      });
      Promise.all(jobs).then(function () {
        // острова в 3D остаются прежними — меняются тексты, колоды, факты и вероятности
        var known = CONTENT.config.islands.map(function (i) { return i.id; });
        cfg.islands = cfg.islands.filter(function (i) { return known.indexOf(i.id) >= 0; });
        if (!cfg.islands.length) return;
        CONTENT.config = cfg;
        for (var k in decks) CONTENT.decks[k] = decks[k];
        CONTENT.remote = true;
        refreshLabels();
      });
    });
  }
  function island(id) { return CONTENT.config.islands.filter(function (i) { return i.id === id; })[0]; }

  /* ---------- 3D-город ---------- */
  var city = null, labels = {}, S = { screen: 'title', run: null, isl: null, cards: 0 };
  var islandsFor3D = CONTENT.config.islands.map(function (i) { return { id: i.id, icon: i.icon, playable: !!i.playable }; });
  try {
    city = new window.City3D($('city'), islandsFor3D);
    city.home(true);
    city.on('pick', onPick);
    city.on('frame', placeLabels);
    city.start();
  } catch (e) {
    city = null;
    $('city').style.display = 'none';
  }

  function buildLabels() {
    var box = $('labels'); box.innerHTML = '';
    var list = CONTENT.config.islands.concat([{ id: 'sber', short: 'Сбер', sber: true }]);
    list.forEach(function (i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lbl ' + (i.sber ? 'sber' : i.playable ? 'play' : 'locked');
      b.innerHTML = (i.sber ? ic('i-sber') : ic(ISL_ICON[i.icon] || 'i-gold')) + (i.playable || i.sber ? '' : ic('i-lock', 'lk')) + '<span>' + esc(i.short || i.name) + '</span>';
      b.setAttribute('aria-label', i.sber ? 'Главное здание Сбера' : (i.name + (i.playable ? '' : ', скоро')));
      b.addEventListener('click', function () { onPick(i.id); });
      box.appendChild(b);
      labels[i.id] = b;
    });
  }
  function refreshLabels() { buildLabels(); }
  function placeLabels() {
    if (!city) return;
    var hide = $('labels').classList.contains('hide');
    if (hide) return;
    city.islands.concat([city.center]).forEach(function (isl) {
      var el = labels[isl.id]; if (!el) return;
      var y = isl.id === 'sber' ? (city.sberState === 'future' ? 22 : 14) : isl.playable ? 13.6 : 11;
      var p = city.project(isl.x, y, isl.z);
      if (!p || p.x < -60 || p.x > city.w + 60 || p.y < 96 || p.y > city.h) { el.style.opacity = 0; el.style.pointerEvents = 'none'; return; }
      el.style.pointerEvents = '';
      el.style.opacity = '';
      el.style.transform = 'translate(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px) translate(-50%,-100%)';
    });
  }

  /* Камера: держим нужный остров в видимой части экрана между HUD и панелью */
  function frameCamera() {
    if (!city) return;
    var w = appW(), h = appH(), land = w > h && h < 560;
    var hud = $('hud'), panel = $('panel').firstElementChild;
    var top = !hud.hidden ? hud.getBoundingClientRect().bottom : 56;
    var R, id = S.camTarget || null;
    if (land) {
      var pl = panel ? $('panel').getBoundingClientRect().left : w;
      city.setShift(2 * (pl / 2) / w - 1, 1 - 2 * ((top + h) / 2) / h);
      var f = Math.min(pl / w, (h - top) / h);
      R = (S.camR || 10.5) / Math.max(0.35, f);
    } else {
      var pt = panel ? panel.getBoundingClientRect().top : h;
      var zone = Math.max(80, pt - top);
      city.setShift(0, 1 - 2 * ((top + pt) / 2) / h);
      R = (S.camR || 10.5) * Math.min(3.2, h / zone) * (id ? 0.8 : 0.82);
    }
    if (id) city.focus(id, R);
    else { city.homeR = R; city.home(); }
  }
  window.addEventListener('resize', function () { if (city) city.resize(); setTimeout(frameCamera, 50); });

  /* ---------- общие элементы ---------- */
  var toastT = null;
  function toast(t) {
    var el = $('toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }
  /* ---------- выход: из любого экрана ---------- */
  function closeModal() { var m = $('modal'); m.hidden = true; m.innerHTML = ''; }
  function leaveRun() {
    closeModal();
    resetSber();
    S.run = null; $('hud').hidden = true; setLabels(true);
    showMap();
  }
  function resetSber() { if (city && city.sberState !== 'classic') city.setSber('classic', true); }
  // пауза внутри партии: продолжить или вернуться в город (закрывает игру само приложение)
  function openMenu() {
    var m = $('modal');
    window.Sound.play('tap');
    m.innerHTML = '<section class="sheet" role="dialog" aria-modal="true">' +
      '<h2>Пауза</h2>' +
      '<p class="muted">Эта партия не сохранится: игра ничего не запоминает между запусками.</p>' +
      '<button class="btn" id="m-stay" type="button">Продолжить</button>' +
      '<button class="btn ghost" id="m-city" type="button">' + ic('i-map') + 'В город (партия сбросится)</button></section>';
    m.hidden = false;
    on('#m-stay', 'click', closeModal);
    on('#m-city', 'click', leaveRun);
    m.addEventListener('click', function h(e) { if (e.target === m) { closeModal(); m.removeEventListener('click', h); } });
  }
  function panel(html) {
    var p = $('panel'); p.innerHTML = html;
    var first = p.querySelector('h1,h2');
    requestAnimationFrame(frameCamera);
    return p;
  }
  function on(sel, ev, fn) { var el = document.querySelector(sel); if (el) el.addEventListener(ev, fn); }
  function setLabels(show) { $('labels').classList.toggle('hide', !show); document.body.classList.toggle('playing', !show); }

  // WebView песочницы может отдать странице «высоту» больше видимой области (панель уезжает за экран):
  // жёстко задаём высоту приложения по меньшему из доступных значений и пересчитываем при изменении размера
  function fitApp() {
    var a = $('app'), vv = window.visualViewport, hs = [window.innerHeight, document.documentElement.clientHeight, vv && vv.height].filter(function (x) { return x > 200; });
    if (!hs.length) return;
    var h = Math.min.apply(null, hs), w = a.clientWidth || window.innerWidth;
    a.style.bottom = 'auto'; a.style.height = h + 'px';
    var rs = document.documentElement.style;
    rs.setProperty('--vh', (h / 100) + 'px'); rs.setProperty('--app-h', h + 'px');
    document.body.classList.toggle('land', w > h && h < 560);
    document.body.classList.toggle('short', h <= 700);
    if (city) { try { frameCamera(); } catch (e) { /* ignore */ } }
  }
  window.addEventListener('resize', fitApp);
  window.addEventListener('orientationchange', function () { setTimeout(fitApp, 250); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitApp);
  fitApp(); setTimeout(fitApp, 400); setTimeout(fitApp, 1500);

  // звук
  function soundUI() {
    var b = $('sound'), onNow = window.Sound.on;
    b.setAttribute('aria-pressed', onNow ? 'true' : 'false');
    b.setAttribute('aria-label', onNow ? 'Звук включён' : 'Звук выключен');
    b.innerHTML = ic(onNow ? 'i-sound' : 'i-mute');
  }
  $('menu').addEventListener('click', openMenu);
  $('sound').addEventListener('click', function () { window.Sound.toggle(); soundUI(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) window.Sound.pause(); else window.Sound.resume(); });

  /* ---------- экраны города ---------- */
  function showTitle() {
    S.screen = 'title'; S.camTarget = null; S.camR = 31;
    $('hud').hidden = true; setLabels(true);
    if (city) { city.auto = 0.05; city.setSber('classic', false); }
    panel('<section class="sheet">' +
      '<div class="kicker">Игра СберKids · финансовая грамотность</div>' +
      '<h1>Город Сбера</h1>' +
      '<p>Ты — глава банка на полгода. Выбери отдел: читай новости, принимай решения — и посмотри, каким станет главное здание.</p>' +
      '<button class="btn" id="go" type="button">' + ic('i-map') + 'Выбрать отдел</button>' +
      '</section>');
    on('#go', 'click', function () { window.Sound.play('tap'); showMap(); });
  }
  function showMap() {
    S.screen = 'map'; S.camTarget = null; S.camR = 31;
    $('hud').hidden = true; setLabels(true);
    if (city) city.auto = 0.04;
    panel('<div class="hint">Покрути город пальцем и нажми на отдел</div>');
    if (!city) showFallbackMap();
  }
  function showFallbackMap() {
    var fm = $('fallback-map'); fm.hidden = false;
    fm.innerHTML = '<h2>Отделы Сбера</h2>' + CONTENT.config.islands.map(function (i) {
      return '<button type="button" data-id="' + i.id + '">' + esc(i.name) + (i.playable ? '' : ' · скоро') + '</button>';
    }).join('');
    fm.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { fm.hidden = true; onPick(b.dataset.id); }); });
  }

  function onPick(id) {
    if (S.screen !== 'map' && S.screen !== 'title' && S.screen !== 'island') return;
    if (id === 'sber') { toast('Это главное здание. Каким оно станет — решаешь ты!'); window.Sound.play('tap'); return; }
    var i = island(id); if (!i) return;
    if (!i.playable) {
      toast('Отдел «' + i.short + '» скоро откроется');
      window.Sound.play('soft'); Bridge.vibrate();
      var l = labels[id]; if (l) { l.classList.remove('shake'); void l.offsetWidth; l.classList.add('shake'); }
      return;
    }
    window.Sound.play('tap');
    showIsland(i);
  }

  function showIsland(i) {
    S.screen = 'island'; S.isl = i; S.camTarget = i.id; S.camR = 10.5;
    $('hud').hidden = true; setLabels(true);
    if (city) city.auto = 0.06;
    panel('<section class="sheet">' +
      '<div class="isl-head"><div class="isl-ico" style="background:' + esc(i.color) + '33">' + ic(ISL_ICON[i.icon]) + '</div>' +
      '<div><div class="kicker">Отдел банка</div><h2>' + esc(i.name) + '</h2></div></div>' +
      '<p>' + esc(i.pitch) + '</p>' +
      '<div class="meta"><span class="tag">' + CONTENT.config.months + ' месяцев</span><span class="tag">≈ 4 минуты</span><span class="tag">свайпы</span></div>' +
      '<div class="row"><button class="btn ghost" id="back" type="button">' + ic('i-map') + 'Город</button>' +
      '<button class="btn" id="play" type="button">Играть</button></div>' +
      '</section>');
    on('#back', 'click', function () { window.Sound.play('tap'); showMap(); });
    on('#play', 'click', function () { startRun(i); });
  }

  /* ---------- партия ---------- */
  function startRun(i) {
    var deck = CONTENT.decks[i.id];
    S.run = window.Engine.newRun(CONTENT.config, i, deck, Math.random);
    S.isl = i; S.screen = 'play'; S.camTarget = i.id; S.camR = 8.5; S.prev = { coins: S.run.coins, shields: S.run.shields, hearts: S.run.hearts };
    setLabels(false);
    $('hud').hidden = false;
    if (city) city.auto = 0.03;
    window.Sound.play('tap');
    renderHUD();
    showIntro();
  }

  function renderHUD() {
    var r = S.run; if (!r) return;
    ['coins', 'shields', 'hearts'].forEach(function (k) {
      var v = r[k], el = $('v-' + k);
      el.textContent = k === 'coins' ? (v < 0 ? MINUS + Math.abs(v) : v) : v + '/10';
      var m = el.closest('.meter');
      if (S.prev && S.prev[k] !== v && !reduceMotion) { m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); }
    });
    var cm = Math.min(r.month, r.months), dots = '';
    for (var i = 1; i <= r.months; i++) dots += '<i class="' + (i < cm || r.over ? 'done' : i === cm ? 'now' : '') + '"></i>';
    $('months').innerHTML = '<span>' + (r.over ? 'Итог' : '<span class="mt">Месяц </span>' + cm + ' из ' + r.months) + '</span><span class="mdots">' + dots + '</span>';
  }
  function floatDeltas(d) {
    if (!d) return;
    ['coins', 'shields', 'hearts'].forEach(function (k) {
      if (!d[k]) return;
      var m = document.querySelector('.meter[data-k="' + k + '"]'), r = m.getBoundingClientRect(), ar = $('app').getBoundingClientRect();
      var c = document.createElement('div');
      c.className = 'float-chip ' + (d[k] > 0 ? 'pos' : 'neg');
      c.textContent = sgn(d[k]);
      c.style.left = (r.left - ar.left + r.width / 2) + 'px'; c.style.top = (r.bottom - ar.top + 2) + 'px';
      $('app').appendChild(c);
      setTimeout(function () { c.remove(); }, 1400);
      m.classList.add(d[k] > 0 ? 'up' : 'down');
      setTimeout(function () { m.classList.remove('up', 'down'); }, 900);
    });
    if (d.coins > 0) window.Sound.play('coin');
  }
  function syncHUD(d) { renderHUD(); floatDeltas(d); var r = S.run; S.prev = { coins: r.coins, shields: r.shields, hearts: r.hearts }; }

  function tickerHTML() {
    var r = S.run, isl = S.isl, pos = r.positions.map(function (p) {
      var cls = p.pnl > 0 ? 'plus' : p.pnl < 0 ? 'minus' : '';
      return '<span class="pchip ' + cls + (p.insured ? ' ins' : '') + '" title="' + esc(p.name) + '">' + ic(p.dir === 'up' ? 'i-up' : 'i-down') + esc(p.name) + ' ' + sgn(p.pnl) + '</span>';
    }).join('');
    var last = r.priceHist[r.priceHist.length - 1];
    return '<div class="ticker"><canvas id="spark" width="184" height="60" aria-hidden="true"></canvas>' +
      '<div><div class="tl">' + esc(isl.ticker) + '</div><div class="tv">' + last + '</div></div>' +
      '<div class="pos">' + (pos || '<span class="pchip">Сделок пока нет</span>') + '</div></div>';
  }
  function drawSpark() {
    var c = $('spark'); if (!c) return;
    var g = c.getContext('2d'), h = S.run.priceHist, W2 = c.width, H = c.height;
    g.clearRect(0, 0, W2, H);
    var mn = Math.min.apply(null, h.concat([90])), mx = Math.max.apply(null, h.concat([110]));
    var X = function (i) { return 6 + (W2 - 12) * (h.length < 2 ? 1 : i / (Math.max(h.length - 1, 1))); };
    var Y = function (v) { return H - 6 - (H - 12) * (v - mn) / (mx - mn || 1); };
    g.strokeStyle = '#D5E2DA'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(4, Y(100)); g.lineTo(W2 - 4, Y(100)); g.stroke(); g.setLineDash([]);
    var up = h[h.length - 1] >= 100;
    g.strokeStyle = up ? '#21A038' : '#E5483D'; g.lineWidth = 4; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    h.forEach(function (v, i) { if (!i) g.moveTo(X(i), Y(v)); else { var px = X(i - 1), py = Y(h[i - 1]), cx = (px + X(i)) / 2; g.bezierCurveTo(cx, py, cx, Y(v), X(i), Y(v)); } });
    g.stroke();
    g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(X(h.length - 1), Y(h[h.length - 1]), 5, 0, 7); g.fill();
  }

  function deckShell(cardHTML, opts) {
    var p = panel('<section class="deck">' + tickerHTML() + '<div class="stage" id="stage">' + cardHTML + '</div>' + (opts || '') + '</section>');
    drawSpark();
    return p;
  }

  function showIntro() {
    var r = S.run, i = S.isl;
    deckShell('<article class="card enter">' +
      '<div class="kicker">' + esc(i.name) + ' · экскурс</div>' +
      '<h2>А ты знал?</h2>' +
      '<div class="body"><p>' + esc(r.fact) + '</p>' +
      '<div class="why intro-why"><b>Как играть</b>Каждый месяц — новость и решение. Угадай, куда новость двинет ' + (i.id === 'metals' ? 'цену золота' : 'дела у бизнеса') + ', и реши, рисковать или защищаться.</div>' +
      '<div class="icons-row"><div>' + ic('i-news') + 'Угадай, что будет с ценой</div><div>' + ic('i-coin') + 'Сделка стоит монеты. Угадал — вернёшь с прибылью</div><div>' + ic('i-shield') + 'Ошибся — потеряешь щиты, не деньги</div></div></div>' +
      '<button class="btn" id="begin" type="button">Начать полгода</button>' +
      '<div class="row quiet"><button class="btn ghost" id="intro-back" type="button">' + ic('i-map') + 'В город</button></div>' +
      '</article>');
    on('#begin', 'click', function () { window.Sound.play('tap'); nextCard(); });
    on('#intro-back', 'click', function () { window.Sound.play('tap'); leaveRun(); });
  }

  function nextCard() {
    var cur = window.Engine.next(S.run);
    renderHUD();
    if (cur.kind === 'final') return showSettle();
    S.cards++;
    if (cur.kind === 'event') return renderEvent(cur);
    return renderChoice(cur);
  }

  /* ---------- свайп-карточка ---------- */
  function swipe(card, sides, preview, commit) {
    var st = null, locked = false;
    function side(dx, dy) {
      if (Math.abs(dx) > 36 && Math.abs(dx) >= dy) return dx > 0 ? 'right' : 'left';
      if (dy > 36 && sides.down) return 'down';
      return null;
    }
    card.addEventListener('pointerdown', function (e) {
      if (locked || e.target.closest('button')) return;
      st = { x: e.clientX, y: e.clientY, id: e.pointerId };
      card.style.transition = 'none';
      try { card.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    });
    card.addEventListener('pointermove', function (e) {
      if (!st || e.pointerId !== st.id) return;
      var dx = e.clientX - st.x, dy = Math.max(0, e.clientY - st.y);
      if (!sides.down) dy *= 0.25;
      card.style.transform = 'translate(' + dx + 'px,' + dy * 0.8 + 'px) rotate(' + dx * 0.05 + 'deg)';
      var s = side(dx, dy); preview(s && sides[s] ? s : null);
    });
    function end(e) {
      if (!st || (e && e.pointerId !== st.id)) return;
      var dx = (e ? e.clientX : st.x) - st.x, dy = Math.max(0, (e ? e.clientY : st.y) - st.y);
      st = null;
      var s = (Math.abs(dx) > 90 && Math.abs(dx) >= dy) ? (dx > 0 ? 'right' : 'left') : (dy > 90 && sides.down ? 'down' : null);
      if (s && sides[s]) fly(s); else { card.style.transition = 'transform .25s cubic-bezier(.2,.9,.3,1.3)'; card.style.transform = ''; preview(null); }
    }
    card.addEventListener('pointerup', end);
    var wsum = 0, wt = 0;
    card.addEventListener('wheel', function (e) {
      if (locked || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      var now = Date.now(); if (now - wt > 300) wsum = 0; wt = now;
      wsum += e.deltaX;
      var s = wsum < 0 ? 'right' : 'left';
      if (Math.abs(wsum) > 120 && sides[s]) { wsum = 0; fly(s); }
    }, { passive: false });
    card.addEventListener('pointercancel', function () { st = null; card.style.transition = 'transform .25s'; card.style.transform = ''; preview(null); });
    function fly(s) {
      if (locked) return; locked = true;
      preview(s);
      var w = appW();
      card.style.transition = 'transform .28s ease-in, opacity .28s';
      card.style.transform = s === 'down' ? 'translate(0,' + appH() * 0.7 + 'px)' : 'translate(' + (s === 'right' ? w : -w) * 1.2 + 'px,40px) rotate(' + (s === 'right' ? 18 : -18) + 'deg)';
      card.style.opacity = '0.2';
      window.Sound.play('swipe'); Bridge.vibrate();
      setTimeout(function () { preview(null); commit(s); }, reduceMotion ? 30 : 270);
    }
    return fly;
  }
  // мелкие значки прямо на кнопке: что получишь и чем рискуешь — без чтения
  function optFx(o) {
    var fx = fxOf(o), out = '';
    ['coins', 'shields', 'hearts'].forEach(function (k) { if (fx[k]) out += '<i>' + ic(ICON[k]) + sgn(fx[k]) + '</i>'; });
    if (o.position) out += '<i>' + ic(o.position.dir === 'up' ? 'i-up' : 'i-down') + (o.position.hedge ? 'страховка' : 'сделка') + '</i>';
    if (o.insure) out += '<i>' + ic('i-shield') + 'защита</i>';
    return out;
  }
  function optsHTML(o, kind) {
    var b = function (s, icon, cls) {
      if (!o[s]) return '<button class="opt ' + cls + ' none" type="button" tabindex="-1" aria-hidden="true">' + ic(icon) + '</button>';
      return '<button class="opt ' + cls + '" type="button" data-side="' + s + '"><span class="ot">' + (s === 'left' ? ic(icon) : '') + (s === 'down' ? ic(icon) : '') + '<span>' + esc(o[s].label) + '</span>' + (s === 'right' ? ic(icon) : '') + '</span>' +
        (kind === 'choice' ? '<span class="ofx">' + optFx(o[s]) + '</span>' : '') + '</button>';
    };
    return '<div class="opts">' + b('left', kind === 'event' ? 'i-down' : 'i-left', 'left') + b('down', kind === 'event' ? 'i-flat' : (o.down && o.down.retry ? 'i-wait' : 'i-down'), 'down') + b('right', kind === 'event' ? 'i-up' : 'i-right', 'right') + '</div>' +
      '<div class="swipe-tip">или свайпни карточку: ← · ↓ · →</div>';
  }
  function bindOpts(fly) {
    document.querySelectorAll('.opt[data-side]').forEach(function (b) {
      b.addEventListener('click', function () { fly(b.dataset.side); });
    });
  }
  function meterDots(fx) {
    ['coins', 'shields', 'hearts'].forEach(function (k) {
      var d = document.querySelector('.meter[data-k="' + k + '"] .dot');
      var v = fx ? Math.abs(fx[k] || 0) : 0;
      d.classList.toggle('on', v > 0); d.classList.toggle('big', v > 1);
    });
  }

  // подсказка: кнопка с лампочкой, текст раскрывается по нажатию; в первой карточке партии открыта сразу
  function hintHTML(inner, open) {
    return '<button class="hintbtn" id="hbtn" type="button">' + ic('i-bulb') + 'Подсказка</button><div class="hintbox" id="hbox"' + (open ? '' : ' hidden') + '>' + inner + '</div>';
  }
  function bindHint() {
    var b = $('hbtn'), x = $('hbox'); if (!b || !x) return;
    b.addEventListener('click', function () { window.Sound.play('tap'); x.hidden = !x.hidden; });
  }
  function newsHistory(title) {
    var seen = S.run.seen; if (!seen.length) return '';
    var i = S.isl;
    return '<div class="hist"><b>' + esc(title) + '</b>' + seen.slice(-3).map(function (ev) {
      var w = ev.dir === 'up' ? i.dirUp : ev.dir === 'down' ? i.dirDown : 'не влияет';
      return '<span class="hchip ' + (ev.dir === 'up' ? 'up-c' : ev.dir === 'down' ? 'dn-c' : 'flat-c') + '">' + ic(ev.dir === 'up' ? 'i-up' : ev.dir === 'down' ? 'i-down' : 'i-flat') + '<span>' + esc(ev.text) + ' <em>· ' + esc(i.asset) + ' ' + esc(w) + '</em></span></span>';
    }).join('') + '</div>';
  }

  /* ---------- новость ---------- */
  function renderEvent(cur) {
    var ev = cur.card, i = S.isl, r = S.run;
    var opts = { right: { label: i.predict.right }, left: { label: i.predict.left }, down: { label: i.predict.down } };
    deckShell('<article class="card enter" id="card"><div class="choice-hint" id="hint"></div>' +
      '<div class="who"><div class="ava news">' + ic('i-news') + '</div><div class="wtxt"><div class="kicker">Новости · месяц ' + r.month + '</div><div class="wname">Как думаешь, что будет?</div></div></div>' +
      '<div class="body"><h2>' + esc(ev.text) + '</h2>' +
      '<p class="q">' + (i.id === 'metals' ? 'Что станет с ценой золота?' : 'Что станет с делами у бизнеса?') + '</p>' +
      hintHTML('<div class="hq">' + esc(ev.hint || i.think || '') + '</div>', r.seen.length === 0 && appH() > 700) + newsHistory('Прошлые новости') + '</div>' +
      '</article>', optsHTML(opts, 'event'));
    window.Sound.play('news');
    bindHint();
    var hint = $('hint');
    var fly = swipe($('card'), opts, function (s) {
      hint.className = 'choice-hint' + (s ? ' show ' + s : '');
      hint.innerHTML = s ? esc(opts[s].label) : '';
    }, function (s) {
      var res = window.Engine.answer(S.run, s);
      renderEventFeedback(res);
    });
    bindOpts(fly);
  }
  function renderEventFeedback(res) {
    var ev = res.event, i = S.isl, r = S.run;
    var dirTxt = ev.dir === 'up' ? i.dirUp : ev.dir === 'down' ? i.dirDown : 'почти не изменится';
    var subj = i.id === 'metals' ? 'Золото' : 'Дела у бизнеса';
    var ok = res.correct;
    var moves = res.moves.map(function (m) {
      var p = r.positions.filter(function (x) { return x.id === m.id; })[0] || {};
      var win = m.delta > 0, my = p.dir === 'up' ? i.dirUp : i.dirDown;
      var why = win
        ? (m.hedge ? 'Страховка сработала: ' + subj.toLowerCase() + ' ' + dirTxt + '.' : 'Твоя сделка выигрывает: ' + subj.toLowerCase() + ' ' + dirTxt + '.')
        : 'Сделка ждала «' + my + '», а вышло наоборот.';
      return '<div class="mvr ' + (win ? 'plus' : 'minus') + '"><span class="mn">' + sgn(m.delta) + '</span><div>' + esc(m.name) + '<small>' + esc(why) + '</small></div></div>';
    }).join('');
    var extras = res.extras.map(function (x) { return '<p class="small"><b>' + esc(x.text) + '</b></p>'; }).join('');
    var h = r.priceHist, from = h[h.length - 2], to = h[h.length - 1];
    var cls = ev.dir === 'up' ? 'up' : ev.dir === 'down' ? 'down' : 'flat';
    deckShell('<article class="card enter">' +
      '<div class="verdict ' + (ok ? 'ok' : 'no') + '"><span class="vb">' + ic(ok ? 'i-check' : 'i-wait') + '</span>' + (ok ? 'Верно!' : 'Почти!') + '</div>' +
      '<div class="body">' +
      (ok ? '' : '<p class="small muted">Ты думал: ' + esc((res.guess === 'up' ? i.predict.right : res.guess === 'down' ? i.predict.left : i.predict.down).toLowerCase()) + '</p>') +
      '<div class="dirline ' + cls + '">' + ic(ev.dir === 'up' ? 'i-up' : ev.dir === 'down' ? 'i-down' : 'i-flat') + '<span>' + esc(subj) + ': ' + esc(dirTxt) + ' · ' + from + ' → ' + to + '</span></div>' +
      '<div class="shortline">' + esc(ev.short || ev.explain) + '</div>' +
      '<details class="more"><summary>Почему так?</summary><div class="mtxt">' + esc(ev.explain) + '</div></details>' +
      (moves ? '<p class="small muted" style="margin:6px 0 0">Твои сделки:</p><div class="mvs">' + moves + '</div>' : '') + extras +
      '</div>' +
      '<button class="btn" id="nx" type="button">Дальше</button></article>');
    window.Sound.play(ok ? 'good' : 'soft');
    syncHUD(res.extras.length ? res.extras.reduce(function (a, x) { a.coins += x.d.coins; a.shields += x.d.shields; a.hearts += x.d.hearts; return a; }, { coins: 0, shields: 0, hearts: 0 }) : null);
    on('#nx', 'click', function () { window.Sound.play('tap'); nextCard(); });
  }

  /* ---------- решение ---------- */
  function fxOf(o, card) {
    var fx = { coins: o.coins || 0, shields: o.shields || 0, hearts: o.hearts || 0 };
    if (o.insure) fx.coins -= window.Engine.insuranceCost(S.run);
    return fx;
  }
  function fxChips(fx, o) {
    var out = '';
    ['coins', 'shields', 'hearts'].forEach(function (k) { if (fx[k]) out += '<span class="fxc">' + ic(ICON[k]) + sgn(fx[k]) + '</span>'; });
    if (o.position) out += '<span class="fxc">' + ic('i-deal') + (o.position.hedge ? 'страховка: ' : 'сделка: ') + 'выигрыш, если ' + esc(o.position.dir === 'up' ? S.isl.dirUp : S.isl.dirDown) + (o.position.size === 'large' ? ' · крупная' : '') + (o.position.maxShields ? ' · риск до −' + o.position.maxShields + ' ' + W.shields(o.position.maxShields) : '') + '</span>';
    if (o.insure) out += '<span class="fxc">' + ic('i-shield') + 'сделки под защитой</span>';
    if (o.retry && !S.run.current) out += '';
    return out;
  }
  // подсказка к решению: «новости» и «сделка» рядом + значок, совпало или нет
  function choiceHint(c) {
    var a = window.Engine.advice(S.run, c), i = S.isl;
    if (a.kind !== 'signal') return '<div class="sigtxt">' + esc(c.explain) + '</div>';
    var newsPill = a.news
      ? '<div class="pill ' + a.news + '"><b>' + ic(a.news === 'up' ? 'i-up' : 'i-down') + '</b>Новости: ' + esc(a.news === 'up' ? i.dirUp : i.dirDown) + '</div>'
      : '<div class="pill q"><b>' + ic('i-q') + '</b>Новости: неясно</div>';
    var dealPill = '<div class="pill ' + a.deal + '"><b>' + ic(a.deal === 'up' ? 'i-up' : 'i-down') + '</b>' + (a.hedge ? 'Страховка' : 'Сделка') + ' выигрывает, если ' + esc(a.deal === 'up' ? i.dirUp : i.dirDown) + '</div>';
    var eq = a.match === null ? '<div class="eq unk">' + ic('i-q') + '</div>' : a.match ? '<div class="eq yes">' + ic('i-check') + '</div>' : '<div class="eq no">' + ic('i-exit') + '</div>';
    var line = a.match === null ? 'Новостей мало — можно подождать месяц.'
      : a.match ? 'Совпало: сделка по новостям.'
      : 'Не совпало: это риск.';
    if (a.hedge) line = 'Страховка нужна, если есть сделки в другую сторону.';
    return '<div class="sig">' + newsPill + eq + dealPill + '</div><div class="sigtxt">' + esc(line) + '</div>' +
      '<div class="sigtxt muted small" style="margin-top:4px">' + ic('i-coin', 'inl') + 'Монеты за сделку уходят сразу, а выигрыш придёт в конце полугода.</div>';
  }
  function renderChoice(cur) {
    var c = cur.card, r = S.run;
    var o = {};
    ['left', 'right', 'down'].forEach(function (s) { if (c.options[s] && !(s === 'down' && c._waited)) o[s] = c.options[s]; });
    var cost = c.insurance ? '<div class="cost">' + ic('i-coin') + 'Стоимость: ' + window.Engine.insuranceCost(r) + ' ' + W.coins(window.Engine.insuranceCost(r)) + '</div>' : '';
    deckShell('<article class="card enter" id="card"><div class="choice-hint" id="hint"></div>' +
      '<div class="who"><div class="ava">' + ic('i-' + (c.icon === 'shield' ? 'shield-big' : c.icon)) + '</div><div class="wtxt"><div class="kicker">Решение · месяц ' + r.month + (c._waited ? ' · вернулись' : '') + '</div><div class="wname">' + esc(c.who) + '</div><h2>' + esc(c.title) + '</h2></div></div>' +
      '<div class="body">' + cost + '<p>' + esc(c.text) + '</p>' + (c._waited ? '<p class="small muted">Ты уже откладывал это решение. Второй раз ждать нельзя.</p>' : '') +
      hintHTML(choiceHint(c), r.decisions.length === 0 && appH() > 700) + (r.seen.length ? newsHistory('Что говорили новости') : '') + '</div>' +
      '</article>', optsHTML(o, 'choice'));
    bindHint();
    var hint = $('hint');
    var fly = swipe($('card'), o, function (s) {
      if (!s) { hint.className = 'choice-hint'; meterDots(null); return; }
      var opt = o[s], fx = fxOf(opt, c);
      hint.className = 'choice-hint show ' + s;
      hint.innerHTML = esc(opt.label) + (opt.note ? '<span class="n">' + esc(opt.note) + '</span>' : '') + '<span class="fx">' + fxChips(fx, opt) + (opt.retry ? '<span class="fxc">' + ic('i-wait') + 'вернёмся через месяц</span>' : '') + '</span>';
      meterDots(fx);
    }, function (s) {
      var res = window.Engine.answer(S.run, s);
      meterDots(null);
      syncHUD(res.d);
      if (res.rec.wait) toast('Отложили. Карточка вернётся через месяц');
      else if (res.rec.position) toast('Сделка заключена: ' + res.rec.position.name);
      else if (res.rec.insured) toast('Сделки застрахованы');
      setTimeout(nextCard, 120);
    });
    bindOpts(fly);
  }

  /* ---------- итог полугода ---------- */
  function showSettle() {
    var r = S.run, i = S.isl, d = r.price - 100;
    var head = i.id === 'metals'
      ? (d > 0 ? 'Золото подорожало на ' + d + '%' : d < 0 ? 'Золото подешевело на ' + Math.abs(d) + '%' : 'Цена золота почти не изменилась')
      : (d > 0 ? 'Дела у бизнеса пошли лучше' : d < 0 ? 'Дела у бизнеса пошли хуже' : 'Дела у бизнеса почти не изменились');
    var subjL = i.id === 'metals' ? 'золото' : 'дела у бизнеса';
    var rows = r.settle.map(function (s) {
      var w = s.dir === 'up' ? i.dirUp : i.dirDown, v, sub;
      if (s.coins) { v = '<span class="big up-c">+' + s.coins + ' ' + W.coins(s.coins) + '</span>'; sub = s.hedge ? 'Страховка сработала: ' + subjL + ' ' + w + '. Ты на это и рассчитывал!' : 'Ты ждал «' + w + '» — так и вышло!'; }
      else if (s.saved) { v = '<span class="big" style="color:#1F5FAE">без потерь</span>'; sub = 'Сделка пошла не так, но страховка спасла.'; }
      else if (s.shields) { v = '<span class="big down-c">' + sgn(s.shields) + ' ' + W.shields(s.shields) + '</span>'; sub = s.hedge ? 'Страховка не пригодилась: цена пошла в другую сторону.' : 'Ты ждал «' + w + '», а вышло наоборот.'; }
      else { v = '<span class="big flat-c">в ноль</span>'; sub = 'Почти ничего не изменилось.'; }
      return '<li><div>' + esc(s.name) + '<small>' + esc(sub) + '</small></div>' + v + '</li>';
    }).join('');
    var notes = r.log.filter(function (l) { return l.kind === 'res' && !/: прибыль|: убыток|: в ноль|страховка спасла/.test(l.text); })
      .map(function (l) { return '<li><span>' + esc(l.text) + '</span><span>' + deltaTxt(l.d) + '</span></li>'; }).join('');
    S.prev = S.prev || {};
    renderHUD();
    deckShell('<article class="card enter">' +
      '<div class="kicker">Итог полугода</div><h2>' + esc(head) + '</h2>' +
      '<div class="body">' + (rows ? '<ul class="settle">' + rows + notes + '</ul>' : '<p>Банк не заключал сделок — ничем не рисковал и ничего не заработал на них.</p>' + (notes ? '<ul class="settle">' + notes + '</ul>' : '')) +
      (r.cbr ? '<div class="why"><b>Ой</b>Щитов почти не осталось — в работу банка вмешался Центральный банк. Он следит, чтобы банки не рисковали деньгами людей.</div>' : '') +
      '</div><button class="btn gold" id="reveal" type="button">' + ic('i-sber') + 'Каким стал Сбер?</button></article>');
    syncHUD(diffPrev());
    on('#reveal', 'click', reveal);
  }
  function deltaTxt(d) {
    if (!d) return '';
    var out = [];
    ['coins', 'shields', 'hearts'].forEach(function (k) { if (d[k]) out.push(sgn(d[k]) + ' ' + W[k](d[k])); });
    return out.join(', ');
  }
  function diffPrev() { var r = S.run, p = S.prev || r.start; return { coins: r.coins - p.coins, shields: r.shields - p.shields, hearts: r.hearts - p.hearts }; }

  function reveal() {
    var r = S.run;
    S.screen = 'reveal';
    $('panel').innerHTML = '';
    S.camTarget = 'sber'; S.camR = 13;
    if (city) { city.auto = 0.08; frameCamera(); }
    window.Sound.play('tap');
    setTimeout(function () {
      if (city) city.setSber(r.bank, true);
      window.Sound.play(r.bank === 'future' ? 'win' : 'build'); Bridge.vibrate();
      if (!city) showResult();
    }, city ? 1100 : 0);
    if (city) setTimeout(showResult, 3300);
    Bridge.send('FINISH_EVENT');
    Bridge.complete();
  }

  // заглушка «смотри видео в разделе Контент»: без внешних ссылок, название берётся из config.json
  function videoHTML() {
    var v = S.isl.video || (CONTENT.config.video || null);
    if (!v) return '';
    return '<button class="video" id="video" type="button"><span class="vthumb"><span class="vplay">' + ic('i-play') + '</span><span class="vlen">' + esc(v.length || '2:30') + '</span></span>' +
      '<span class="vtxt"><b>' + esc(v.title) + '</b><span>' + esc(v.sub || 'Видео в разделе «Контент» СберKids') + '</span></span></button>';
  }
  function showResult() {
    var r = S.run, e = r.eval, i = S.isl, deck = CONTENT.decks[i.id], B = CONTENT.config.sber[r.bank];
    S.screen = 'result';
    S.camTarget = 'sber'; S.camR = 12;
    var cell = function (k, label) {
      var a = r.start[k], b = r[k], d = b - a;
      if (k === 'coins') return '<div class="rc">' + ic(ICON[k]) + '<div class="rn ' + (d > 0 ? 'up-c' : d < 0 ? 'down-c' : '') + '">' + sgn(d) + '</div><div class="rl">' + label + '</div></div>';
      return '<div class="rc">' + ic(ICON[k]) + '<div class="rn">' + (b < 0 ? MINUS + Math.abs(b) : b) + '</div><div class="rl">' + label + ' ' + (d ? '<span class="' + (d > 0 ? 'up-c' : 'down-c') + '">' + sgn(d) + '</span>' : '') + '</div></div>';
    };
    var flags = e.flags.map(function (f) {
      var head = '<span class="fd ' + f.tone + '"></span><div class="ft">' + esc(f.text) + '</div>';
      return '<li>' + (f.why ? '<details><summary>' + head + '</summary><div class="fw">' + esc(f.why) + '</div></details>' : '<div style="display:flex;gap:10px">' + head.replace(' ▾', '') + '</div>') + '</li>';
    }).join('');
    var nextGoal = r.bank === 'future' ? 'Получилось! Попробуй другой отдел — там свои новости и сделки.' : 'Сыграй ещё раз: новости и исход будут другими. Сможешь построить Сбер будущего?';
    var other = CONTENT.config.islands.filter(function (x) { return x.playable && x.id !== i.id; })[0];
    // карточка компактная, чтобы над ней было видно Сбер: главное сверху, разбор — по нажатию
    panel('<section class="sheet result">' +
      '<div class="kicker">' + esc(i.name) + ' · итог</div>' +
      '<h1>' + esc(B.title) + '</h1><p class="rtext">' + esc(B.text) + '</p>' +
      '<div class="res3">' + cell('coins', 'Прибыль') + cell('shields', 'Надёжность') + cell('hearts', 'Доверие') + '</div>' +
      '<div class="rchips"><span class="stat"><span class="sn">' + e.newsOk + '/' + e.newsTotal + '</span><span>новостей верно</span></span>' +
      '<span class="badge ' + e.style + '">' + esc(STYLE[e.style].name) + '</span></div>' +
      '<button class="btn gold" id="share" type="button">' + ic('i-share') + 'Поделиться моим Сбером</button>' +
      '<div class="row r3"><button class="btn" id="again" type="button">' + ic('i-replay') + 'Ещё раз</button>' +
      (other ? '<button class="btn ghost" id="other" type="button">' + ic(ISL_ICON[other.icon]) + esc(other.short) + '</button>' : '') +
      '<button class="btn ghost" id="tocity" type="button">' + ic('i-map') + 'В город</button></div>' +
      '<details class="rmore"><summary>Разбор решений и совет банкира</summary>' +
      '<p class="small muted rtext-d">' + esc(B.text) + '</p>' +
      '<p class="small muted">' + esc(STYLE[e.style].text) + ' Оценка решений не зависит от удачи.</p>' +
      '<h2>Твои решения</h2><p class="small muted" style="margin:0">Нажми на решение, чтобы узнать почему.</p><ul class="flags">' + flags + '</ul>' +
      '<div class="tip"><b>Совет банкира</b>' + esc(deck.tips[e.style]) + '</div>' +
      '<p class="small"><b>Главное:</b> ' + esc(deck.lesson) + '</p>' +
      '<p class="small muted">' + esc(nextGoal) + '</p>' +
      videoHTML() + '</details>' +
      '</section>');
    $('hud').hidden = true;
    on('#share', 'click', share);
    on('#video', 'click', function () { window.Sound.play('tap'); Bridge.vibrate(); toast('Видео откроется в разделе «Контент» приложения СберKids'); });
    on('#again', 'click', function () { resetSber(); startRun(i); });
    on('#other', 'click', function () { resetSber(); startRun(other); });
    on('#tocity', 'click', function () { resetSber(); S.run = null; showMap(); });
    // открыли разбор — карточка может занять больше места, камера пересчитывается
    on('.rmore', 'toggle', function () {
      var sh = document.querySelector('.sheet.result'); if (sh) sh.classList.toggle('expanded', this.open);
      S.camTarget = 'sber'; requestAnimationFrame(frameCamera);
    });
  }

  /* ---------- шеринг: картинка рисуется на устройстве, ничего не уходит наружу ---------- */
  function share() {
    var r = S.run, B = CONTENT.config.sber[r.bank], e = r.eval;
    var cv = document.createElement('canvas'); cv.width = 720; cv.height = 960;
    var g = cv.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, 960); grd.addColorStop(0, '#CDEBFA'); grd.addColorStop(1, '#E8F7EC');
    g.fillStyle = grd; g.fillRect(0, 0, 720, 960);
    var snap = city && city.snapshot();
    var finish = function () {
      g.fillStyle = '#fff'; roundRect(g, 32, 600, 656, 328, 36); g.fill();
      g.fillStyle = '#138A2C'; g.font = '800 26px -apple-system, Roboto, Arial, sans-serif'; g.fillText('МОЙ СБЕР В ИГРЕ «ГОРОД СБЕРА»', 64, 656);
      g.fillStyle = '#15211B'; g.font = '900 56px -apple-system, Roboto, Arial, sans-serif'; g.fillText(B.title, 64, 726);
      g.font = '700 30px -apple-system, Roboto, Arial, sans-serif'; g.fillStyle = '#5B6B63';
      g.fillText(STYLE[e.style].name + ' · новости: ' + e.newsOk + ' из ' + e.newsTotal, 64, 780);
      g.fillText('Прибыль ' + sgn(r.coins - r.start.coins) + ' · Надёжность ' + r.shields + '/10 · Доверие ' + r.hearts + '/10', 64, 828);
      g.fillStyle = '#21A038'; g.font = '800 30px -apple-system, Roboto, Arial, sans-serif'; g.fillText('А каким станет твой Сбер?', 64, 892);
      var img = null; try { img = cv.toDataURL('image/jpeg', 0.86); } catch (er) { img = null; }
      var text = 'Я полгода руководил банком в игре «Город Сбера», и мой Сбер стал таким: «' + B.title + '»! Я — ' + STYLE[e.style].name.toLowerCase() + '. А каким станет твой?';
      Bridge.send('SHARING_EVENT', img ? { text: text, image: img } : { text: text });
      toast('Открываем «Поделиться»');
    };
    if (snap) {
      var im = new Image();
      im.onload = function () {
        var s = Math.max(720 / im.width, 640 / im.height), w = im.width * s, h = im.height * s;
        g.save(); roundRect(g, 0, 0, 720, 640, 0); g.clip(); g.drawImage(im, (720 - w) / 2, (600 - h) / 2 - 20, w, h); g.restore();
        finish();
      };
      im.onerror = finish; im.src = snap;
    } else finish();
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  /* ---------- старт ---------- */
  buildLabels();
  soundUI();
  showTitle();
  loadRemote();
  window.__game = { S: S, city: city, Bridge: Bridge, CONTENT: CONTENT };
})();

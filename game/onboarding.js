/* Обучение при входе: 5 коротких экранов с анимацией, свайп пальцем или кнопка «Дальше».
   Игра ничего не хранит между запусками (ограничение трека), поэтому обучение показывается при каждом открытии
   один раз и всегда пропускается; позже его можно открыть кнопкой «Как играть» на карте города. */
(function (root) {
  'use strict';
  var ic = function (id) { return '<svg aria-hidden="true"><use href="#' + id + '"/></svg>'; };

  /* ---------- иллюстрации ---------- */
  function bSvg(kind) {
    if (kind === 'future') {
      return '<svg viewBox="0 0 64 80" aria-hidden="true"><rect x="4" y="46" width="14" height="30" rx="2" fill="#9CCFB0"/><rect x="46" y="38" width="14" height="38" rx="2" fill="#9CCFB0"/>' +
        '<rect x="20" y="10" width="24" height="66" rx="3" fill="#21A038"/><path d="M32 2v10" stroke="#15211B" stroke-width="2.5" stroke-linecap="round"/>' +
        '<g fill="#CFF5D8"><rect x="24" y="16" width="6" height="5" rx="1"/><rect x="34" y="16" width="6" height="5" rx="1"/><rect x="24" y="26" width="6" height="5" rx="1"/><rect x="34" y="26" width="6" height="5" rx="1"/>' +
        '<rect x="24" y="36" width="6" height="5" rx="1"/><rect x="34" y="36" width="6" height="5" rx="1"/><rect x="24" y="46" width="6" height="5" rx="1"/><rect x="34" y="46" width="6" height="5" rx="1"/><rect x="24" y="56" width="6" height="5" rx="1"/><rect x="34" y="56" width="6" height="5" rx="1"/></g></svg>';
    }
    if (kind === 'classic') {
      return '<svg viewBox="0 0 64 80" aria-hidden="true"><path d="M12 38a20 20 0 0 1 40 0z" fill="#21A038"/><rect x="8" y="38" width="48" height="6" rx="2" fill="#EAF0EC" stroke="#15211B" stroke-width="2"/>' +
        '<g fill="#EAF0EC" stroke="#15211B" stroke-width="2"><rect x="13" y="44" width="6" height="22"/><rect x="24" y="44" width="6" height="22"/><rect x="34" y="44" width="6" height="22"/><rect x="45" y="44" width="6" height="22"/></g>' +
        '<rect x="6" y="66" width="52" height="8" rx="2" fill="#EAF0EC" stroke="#15211B" stroke-width="2"/><circle cx="32" cy="14" r="2.5" fill="#15211B"/></svg>';
    }
    return '<svg viewBox="0 0 64 80" aria-hidden="true"><path d="M12 38a20 20 0 0 1 40 0z" fill="#6E8A78"/><rect x="8" y="38" width="48" height="6" rx="2" fill="#C9D3CD"/>' +
      '<g fill="#C9D3CD"><rect x="13" y="44" width="6" height="22"/><rect x="24" y="44" width="6" height="22"/><rect x="34" y="44" width="6" height="22"/><rect x="45" y="44" width="6" height="22"/></g>' +
      '<rect x="6" y="66" width="52" height="8" rx="2" fill="#C9D3CD"/><path d="M8 74V30M8 30h40M48 30v10" fill="none" stroke="#FFB020" stroke-width="3.2" stroke-linecap="round"/>' +
      '<path d="M8 40l18-10M8 52l30-22" stroke="#FFB020" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  var SLIDES = [
    {
      key: 'city', title: 'Ты — глава отдела Сбера', text: 'Полгода рулишь банком. Каждый месяц: новость и твоё решение.',
      art: '<div class="oa-city"><svg viewBox="0 0 220 130" aria-hidden="true">' +
        '<ellipse cx="110" cy="104" rx="92" ry="22" fill="#2E9E4B"/><ellipse cx="110" cy="98" rx="92" ry="22" fill="#6DCB55"/>' +
        '<ellipse cx="110" cy="96" rx="52" ry="12" fill="#E9F0EB"/>' +
        '<g fill="#EAF0EC" stroke="#15211B" stroke-width="2"><rect x="78" y="62" width="9" height="28"/><rect x="95" y="62" width="9" height="28"/><rect x="112" y="62" width="9" height="28"/><rect x="129" y="62" width="9" height="28"/></g>' +
        '<rect x="72" y="56" width="72" height="8" rx="2" fill="#EAF0EC" stroke="#15211B" stroke-width="2"/>' +
        '<path d="M80 56a30 30 0 0 1 56 0z" fill="#21A038" stroke="#15211B" stroke-width="2"/><circle cx="108" cy="27" r="3" fill="#15211B"/>' +
        '<g class="oa-tree"><path d="M28 98l8-24 8 24z" fill="#2E9E4B" stroke="#15211B" stroke-width="2" stroke-linejoin="round"/><path d="M176 100l8-24 8 24z" fill="#2E9E4B" stroke="#15211B" stroke-width="2" stroke-linejoin="round"/></g></svg>' +
        '<div class="oa-months">' + [1, 2, 3, 4, 5, 6].map(function (n) { return '<i style="animation-delay:' + (n * 0.35) + 's"></i>'; }).join('') + '<span>6 месяцев</span></div></div>'
    },
    {
      key: 'news', title: 'Сначала — новость', text: 'Угадай, что будет с ценой: вырастет, упадёт или не изменится.',
      art: '<div class="oa-news"><div class="on-card"><div class="on-head">' + ic('i-news') + '<span>Новость · месяц 1</span></div>' +
        '<b>В Южной Америке нашли залежи золота</b></div>' +
        '<div class="on-q">Что станет с ценой золота?</div>' +
        '<div class="on-chips"><span class="on-chip">' + ic('i-down') + 'Подешевеет</span><span class="on-chip dim">' + ic('i-flat') + 'Не изменится</span><span class="on-chip dim">' + ic('i-up') + 'Подорожает</span></div>' +
        '<div class="on-why">' + ic('i-bulb') + 'Золота больше — оно дешевеет</div></div>'
    },
    {
      key: 'swipe', title: 'Потом — свайп', text: 'Вправо — да, влево — нет, вниз — подождать. Можно жать кнопки.',
      art: '<div class="oa-swipe"><span class="os-l">' + ic('i-left') + 'Нет</span><span class="os-r">Да' + ic('i-right') + '</span><span class="os-d">' + ic('i-wait') + 'Подождать</span>' +
        '<div class="os-card"><div class="os-ava">' + ic('i-miner') + '</div><b>Золото со скидкой</b><em>Купить?</em><i class="os-touch"></i></div></div>'
    },
    {
      key: 'meters', title: 'Следи за шкалами', text: 'Рискуешь — щиты уходят. Не рискуешь — упускаешь выгоду.',
      art: '<div class="oa-meters">' +
        '<div class="om"><div class="om-i">' + ic('i-coin') + '</div><b>Деньги</b><span>сколько заработал</span></div>' +
        '<div class="om hot"><div class="om-i">' + ic('i-shield') + '</div><b>Надёжность</b><span>прочность банка</span><i class="om-fly">−2</i></div>' +
        '<div class="om"><div class="om-i">' + ic('i-heart') + '</div><b>Доверие</b><span>верят ли клиенты</span></div></div>'
    },
    {
      key: 'final', title: 'Каким станет Сбер?', text: 'Смотрим на решения, а не на везение. Читай новости — и построишь башню!',
      art: '<div class="oa-final">' +
        '<div class="of best"><div class="of-b">' + bSvg('future') + '</div><span>Сбер будущего</span></div>' +
        '<div class="of"><div class="of-b">' + bSvg('classic') + '</div><span>Крепкий Сбер</span></div>' +
        '<div class="of"><div class="of-b">' + bSvg('repair') + '</div><span>На ремонте</span></div></div>'
    }
  ];

  var el = null, cur = 0, onDone = null, tap = function () {};

  function close(finished) {
    if (!el) return;
    el.classList.add('out');
    var n = el; el = null;
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 260);
    document.removeEventListener('keydown', onKey);
    var cb = onDone; onDone = null;
    if (cb) cb(!!finished);
  }
  function onKey(e) {
    if (e.key === 'ArrowRight') go(cur + 1);
    else if (e.key === 'ArrowLeft') go(cur - 1);
    else if (e.key === 'Escape') close(false);
  }
  function go(n) {
    if (!el) return;
    if (n >= SLIDES.length) { tap('tap'); close(true); return; }
    if (n < 0) return;
    cur = n;
    el.querySelector('.onb-track').style.transform = 'translateX(' + (-100 * cur) + '%)';
    var slides = el.querySelectorAll('.onb-slide');
    for (var i = 0; i < slides.length; i++) {
      slides[i].classList.toggle('on', i === cur);
      slides[i].setAttribute('aria-hidden', i === cur ? 'false' : 'true');
    }
    var dots = el.querySelectorAll('.onb-dots button');
    for (var j = 0; j < dots.length; j++) dots[j].classList.toggle('on', j === cur);
    var last = cur === SLIDES.length - 1;
    el.querySelector('.onb-next span').textContent = last ? 'Поехали!' : 'Дальше';
    el.querySelector('.onb-skip').hidden = last;
    el.querySelector('.onb-card').setAttribute('data-step', SLIDES[cur].key);
    if (n !== 0 || arguments[1]) tap('tap');
  }

  function show(opts) {
    opts = opts || {};
    if (el) return;
    tap = opts.sound || tap; onDone = opts.done || null; cur = 0;
    var host = document.getElementById('app') || document.body;
    el = document.createElement('div');
    el.id = 'onb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Как играть');
    el.innerHTML = '<button class="onb-skip" type="button">Пропустить</button>' +
      '<div class="onb-card" data-step="city">' +
      '<div class="onb-view"><div class="onb-track">' + SLIDES.map(function (s, i) {
        return '<section class="onb-slide' + (i === 0 ? ' on' : '') + '" data-k="' + s.key + '"><div class="onb-art">' + s.art + '</div><h2>' + s.title + '</h2><p>' + s.text + '</p></section>';
      }).join('') + '</div></div>' +
      '<div class="onb-foot"><div class="onb-dots">' + SLIDES.map(function (s, i) { return '<button type="button" aria-label="Шаг ' + (i + 1) + '"' + (i === 0 ? ' class="on"' : '') + '></button>'; }).join('') + '</div>' +
      '<button class="btn onb-next" type="button"><span>Дальше</span>' + ic('i-right') + '</button></div></div>';
    host.appendChild(el);

    el.querySelector('.onb-next').addEventListener('click', function () { go(cur + 1); });
    el.querySelector('.onb-skip').addEventListener('click', function () { tap('tap'); close(false); });
    var dots = el.querySelectorAll('.onb-dots button');
    for (var i = 0; i < dots.length; i++) (function (k) { dots[k].addEventListener('click', function () { go(k); }); })(i);

    // свайп по слайдам пальцем или мышью
    var view = el.querySelector('.onb-view'), x0 = null, y0 = 0, moved = false;
    view.addEventListener('pointerdown', function (e) { x0 = e.clientX; y0 = e.clientY; moved = false; });
    view.addEventListener('pointermove', function (e) { if (x0 !== null && Math.abs(e.clientX - x0) > 12) moved = true; });
    var end = function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.3) go(cur + (dx < 0 ? 1 : -1));
    };
    view.addEventListener('pointerup', end); view.addEventListener('pointercancel', function () { x0 = null; });
    document.addEventListener('keydown', onKey);
    go(0);
    requestAnimationFrame(function () { if (el) el.classList.add('in'); });
  }

  root.Onboarding = { show: show, isOpen: function () { return !!el; } };
})(window);

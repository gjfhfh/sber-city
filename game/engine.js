/* Город Сбера — игровой движок.
   Чистая логика без DOM: её же гоняет симуляция баланса (tools/sim.js).
   Решения оцениваются по тому, что ребёнок ЗНАЛ в момент выбора, а не по тому, как выпали события. */
(function (root) {
  'use strict';

  var SIZE = { small: { mult: 1, cap: 3 }, large: { mult: 2, cap: 5 } };
  var CLEAR = 2; // с какой суммы «очков новостей» сигнал считается понятным

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sgn(d) { return d === 'up' ? 1 : d === 'down' ? -1 : 0; }

  function pickWeighted(list, w, rng) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += Math.max(0, w(list[i]));
    var r = rng() * total;
    for (i = 0; i < list.length; i++) { r -= Math.max(0, w(list[i])); if (r < 0) return i; }
    return list.length - 1;
  }
  function shuffle(a, rng) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // перемешивание с весами: карточки с большим weight чаще оказываются раньше
  function wshuffle(a, rng) {
    return a.map(function (c) { return { c: c, k: Math.pow(rng(), 1 / Math.max(0.1, c.weight || 1)) }; })
      .sort(function (x, y) { return y.k - x.k; }).map(function (x) { return x.c; });
  }
  // «отказ» по умолчанию, если карточку не успели решить: вариант без сделки и без плюсов
  function refusal(c) {
    var order = ['left', 'down', 'right'];
    for (var i = 0; i < order.length; i++) {
      var o = c.options[order[i]];
      if (o && !o.retry && !o.position && !o.insure && !(o.coins > 0) && !(o.hearts > 0) && !(o.shields > 0)) return o;
    }
    return {};
  }

  /* ---------- создание партии ---------- */
  function newRun(config, island, deck, rng) {
    rng = rng || Math.random;
    var trend = rng() < 0.5 ? 'up' : 'down';
    var choices = JSON.parse(JSON.stringify(deck.choices)); // своя копия на партию
    var core = wshuffle(choices.filter(function (c) { return c.core; }), rng);
    var fillers = wshuffle(choices.filter(function (c) { return !c.core && !c.insurance; }), rng);
    var insurance = choices.filter(function (c) { return c.insurance; })[0] || null;
    var s = {
      island: island, deck: deck, months: config.months || 6,
      month: 1, step: 'choice',
      coins: config.start.coins, shields: config.start.shields, hearts: config.start.hearts,
      start: { coins: config.start.coins, shields: config.start.shields, hearts: config.start.hearts },
      trend: trend, price: 100, priceHist: [100],
      events: deck.events.slice(), seen: [], evidence: 0,
      core: core, fillers: fillers, insurance: insurance, insuranceShown: false, insExtra: 0,
      pending: [], positions: [], flags: {}, decisions: [], predictions: [], log: [],
      fact: deck.facts[Math.floor(rng() * deck.facts.length)],
      current: null, over: false, rng: rng
    };
    return s;
  }

  function openPositions(s) { return s.positions.filter(function (p) { return !p.insured; }); }
  function insuranceCost(s) {
    var n = 0;
    openPositions(s).forEach(function (p) { n += p.size === 'large' ? 2 : 1; });
    return Math.min(1 + Math.floor(n / 2) + s.insExtra, 4);
  }

  /* ---------- какая карта следующая ---------- */
  function pickChoice(s) {
    var i;
    for (i = 0; i < s.pending.length; i++) {
      if (s.pending[i].due <= s.month) return s.pending.splice(i, 1)[0].card;
    }
    if (s.month <= 2 && s.core.length) return s.core.shift();
    if (s.insurance && !s.insuranceShown && s.month >= 4 && s.month < s.months + 1 && openPositions(s).length) {
      s.insuranceShown = true; return s.insurance;
    }
    if (s.fillers.length) return s.fillers.shift();
    if (s.core.length) return s.core.shift();
    if (s.insurance && !s.insuranceShown && openPositions(s).length) { s.insuranceShown = true; return s.insurance; }
    return null;
  }
  function pickEvent(s) {
    if (!s.events.length) return null;
    var i = pickWeighted(s.events, function (e) { return e.weight ? e.weight[s.trend] : 1; }, s.rng);
    return s.events.splice(i, 1)[0];
  }

  /* Возвращает следующую карту: {kind:'event'|'choice'|'final', card} */
  function next(s) {
    if (s.over) return { kind: 'final' };
    while (true) {
      if (s.month > s.months) { finish(s); return { kind: 'final' }; }
      if (s.step === 'event') {
        s.step = 'choice';
        var ev = pickEvent(s);
        if (ev) { s.current = { kind: 'event', card: ev }; return s.current; }
      }
      if (s.step === 'choice') {
        var ch = pickChoice(s);
        if (ch) {
          s.current = { kind: 'choice', card: ch, waited: !!ch._waited, evidence: s.evidence, seen: s.seen.length };
          return s.current;
        }
        s.month++; s.step = 'event';
      }
    }
  }

  function effect(s, o, note, kind) {
    var b = { coins: s.coins, shields: s.shields, hearts: s.hearts };
    s.coins += o.coins || 0;
    s.shields = clamp(s.shields + (o.shields || 0), 0, 10);
    s.hearts = clamp(s.hearts + (o.hearts || 0), 0, 10);
    var d = { coins: s.coins - b.coins, shields: s.shields - b.shields, hearts: s.hearts - b.hearts };
    if (note) s.log.push({ month: Math.min(s.month, s.months), text: note, d: d, kind: kind || 'act' });
    return d;
  }

  function movePositions(s, dir, points, why) {
    var out = [];
    if (!dir || !points) return out;
    s.positions.forEach(function (p) {
      var delta = (p.dir === dir ? 1 : -1) * points * SIZE[p.size].mult;
      p.pnl += delta;
      out.push({ id: p.id, name: p.name, delta: delta, pnl: p.pnl, dir: p.dir, hedge: !!p.hedge });
    });
    return out;
  }

  /* ---------- ответ на карту ---------- */
  // side: 'right' | 'left' | 'down'
  function answer(s, side) {
    var cur = s.current;
    if (!cur) return null;
    s.current = null;
    if (cur.kind === 'event') return answerEvent(s, cur.card, side);
    return answerChoice(s, cur, side);
  }

  function answerEvent(s, ev, side) {
    var guess = side === 'right' ? 'up' : side === 'left' ? 'down' : null;
    var correct = guess === ev.dir;
    s.predictions.push({ id: ev.id, guess: guess, dir: ev.dir, correct: correct });
    s.seen.push(ev);
    s.evidence += sgn(ev.dir) * (ev.points || 0);
    s.price = Math.round(s.price * (1 + sgn(ev.dir) * (ev.points || 0) * 0.04));
    s.priceHist.push(s.price);
    var moves = movePositions(s, ev.dir, ev.points);
    s.log.push({ month: s.month, text: ev.text, d: null, kind: 'news' });
    var extras = [];
    (ev.extra || []).forEach(function (x) {
      if (x.if && x.if.flag && !s.flags[x.if.flag]) return;
      if (x.island && x.island !== s.island.id) return;
      extras.push({ text: x.text, d: effect(s, x, x.text, 'event') });
    });
    return { kind: 'event', correct: correct, guess: guess, event: ev, moves: moves, extras: extras };
  }

  function answerChoice(s, cur, side) {
    var card = cur.card, o = card.options[side];
    if (!o) return null;
    var rec = { card: card, side: side, month: s.month, evidence: s.evidence, seen: s.seen.length, waited: !!card._waited, option: o };
    var d, note = card.title + ': «' + o.label + '»';
    if (o.retry && !card._waited) {
      d = effect(s, o, card.title + ': решил подождать', 'act');
      card._waited = true; card._waitEvidence = s.evidence; card._waitSeen = s.seen.length;
      s.pending.push({ due: s.month + 1, card: card });
      if (card.insurance) s.insExtra += 1;
      rec.wait = true;
    } else {
      var cost = 0;
      if (o.insure) {
        cost = insuranceCost(s);
        s.positions.forEach(function (p) { p.insured = true; });
        rec.insured = s.positions.length;
      }
      d = effect(s, { coins: (o.coins || 0) - cost, shields: o.shields, hearts: o.hearts }, note, 'act');
      if (o.flag) s.flags[o.flag] = true;
      if (o.position) {
        var p = { id: o.position.id, name: o.position.name, dir: o.position.dir, size: o.position.size || 'small',
          maxShields: o.position.maxShields, hedge: !!o.position.hedge,
          pnl: 0, insured: false, month: s.month, evidence: s.evidence, seen: s.seen.length };
        s.positions.push(p);
        rec.position = p;
      }
    }
    s.decisions.push(rec);
    s.month++; s.step = 'event';
    if (s.month > s.months) finish(s);
    return { kind: 'choice', d: d, rec: rec };
  }

  /* ---------- итог полугода ---------- */
  function finish(s) {
    if (s.over) return;
    s.month = s.months;
    // нерешённые карты: «не успел»
    s.pending.forEach(function (pp) {
      var c = pp.card, o = refusal(c);
      var d = effect(s, o, c.title + ': не успел ответить', 'res');
      s.decisions.push({ card: c, side: 'timeout', month: s.months, evidence: s.evidence, seen: s.seen.length, waited: true, option: o, d: d });
    });
    s.pending = [];
    // финальное движение по тренду
    var fin = { dir: s.trend, points: 3 };
    s.price = Math.round(s.price * (1 + sgn(fin.dir) * fin.points * 0.04));
    s.priceHist.push(s.price);
    movePositions(s, fin.dir, fin.points);
    s.finalMove = s.price - 100;
    var lost = 0, won = 0;
    s.settle = s.positions.map(function (p) {
      var r = { name: p.name, dir: p.dir, size: p.size, hedge: !!p.hedge, pnl: p.pnl, insured: p.insured, coins: 0, shields: 0 };
      if (p.pnl > 0) { r.coins = p.pnl; won += p.pnl; }
      else if (p.pnl < 0) {
        if (p.insured) r.saved = true;
        else { r.shields = -Math.min(-p.pnl, p.maxShields != null ? p.maxShields : SIZE[p.size].cap); lost += -r.shields; }
      }
      effect(s, { coins: r.coins, shields: r.shields }, p.name + (r.coins ? ': прибыль' : r.saved ? ': страховка спасла' : r.shields ? ': убыток' : ': в ноль'), 'res');
      return r;
    });
    s.flagsEnd = {};
    if (lost > 0 && s.shields <= 6) { effect(s, { hearts: -1 }, 'Клиенты узнали об убытках и насторожились', 'res'); s.flagsEnd.worried = true; }
    if (won >= 4) { effect(s, { hearts: 1 }, 'О прибыльном банке пишут в новостях', 'res'); s.flagsEnd.famous = true; }
    s.cbr = s.shields <= 3;
    s.over = true;
    s.eval = evaluate(s);
    s.bank = bankState(s);
  }

  /* Здание Сбера отражает, НАСКОЛЬКО РАЗУМНО ребёнок вёл банк (качество решений),
     а щиты и сердца — чем это обернулось. Повезло без причины — башни не будет. */
  function bankState(s) {
    var e = s.eval, q = e.judged ? e.good / e.judged : 0.5;
    s.quality = q;
    s.score = s.coins + (s.shields - s.start.shields) + (s.hearts - s.start.hearts);
    if (s.shields <= 4 || q < 0.35) return 'repair';
    if (q >= 0.65 && e.style === 'balanced' && s.shields >= 7 && s.hearts >= 5) return 'future';
    return 'classic';
  }

  /* ---------- оценка решений ---------- */
  function evaluate(s) {
    var isl = s.island, F = [], risk = 0, caution = 0, judged = 0, good = 0;
    var asset = isl.asset || 'цена';
    function trendWord(e) { return e > 0 ? (isl.dirUp || 'вверх') : (isl.dirDown || 'вниз'); }
    function add(tone, text, why, kind, w) {
      F.push({ tone: tone, text: text, why: why || '' });
      if (tone !== 'info') { judged++; if (tone === 'good') good++; }
      if (kind === 'risk') risk += (w || 1);
      if (kind === 'caution') caution += (w || 1);
    }
    var insuredLater = s.positions.some(function (p) { return p.insured; });

    s.decisions.forEach(function (r) {
      var c = r.card, o = r.option || {};
      if (r.wait) {
        var clearAtWait = Math.abs(r.evidence) >= CLEAR;
        if (!clearAtWait) add('good', c.title + ': дождался новостей', 'Ждать полезно, когда новостей ещё мало. Но ожидание стоит денег или терпения клиентов.');
        else add('meh', c.title + ': ждал, хотя новости уже были понятны', 'Новости уже подсказывали, что ' + asset + ' ' + trendWord(r.evidence) + '. Ожидание просто стоило денег.', 'caution', 0.5);
        return;
      }
      if (r.side === 'timeout') { add('bad', c.title + ': не успел ответить', 'Полгода закончились, а решение так и не принято. Отложенные дела тоже нужно доделывать.', 'caution', 0.5); return; }
      if (o.verdict) { add(o.verdict === 'good' ? 'good' : 'bad', c.title + ': «' + o.label + '»', c.explain, o.verdict === 'bad' ? 'risk' : null); return; }
      if (c.insurance) {
        var atRisk = s.positions.filter(function (p) {
          return p.month < r.month && (Math.abs(p.evidence) < CLEAR || sgn(p.dir) * p.evidence < 0 || sgn(p.dir) * r.evidence < 0);
        });
        if (o.insure) {
          if (atRisk.length) add('good', 'Застраховал рискованные сделки', 'Часть сделок шла против новостей или была заключена вслепую — страховка от этого и нужна.');
          else add('meh', 'Застраховал сделки, которые и так шли по новостям', 'Надёжно, но дорого: новости были на твоей стороне.', 'caution', 0.5);
        } else {
          if (atRisk.length) add('bad', 'Оставил без защиты рискованные сделки', 'Сделка «' + atRisk[0].name + '» шла против новостей или была заключена вслепую.', 'risk');
          else add('good', 'Не переплатил за страховку', 'Сделки шли туда же, куда указывали новости.');
        }
        return;
      }
      var posOpts = ['right', 'left', 'down'].map(function (k) { return c.options[k]; }).filter(function (x) { return x && x.position; });
      var sameDir = posOpts.length && posOpts.every(function (x) { return x.position.dir === posOpts[0].position.dir; });
      if (posOpts.length && sameDir) {
        var ref = (r.position ? o.position : posOpts[0].position), dir = ref.dir, e = r.evidence, clear = Math.abs(e) >= CLEAR, match = sgn(dir) * e > 0;
        var dirWord = dir === 'up' ? (isl.dirUp || 'вверх') : (isl.dirDown || 'вниз');
        if (ref.hedge) {
          // контракт-страховка: хорош, если есть что страховать (сделки в обратную сторону)
          var covered = s.positions.some(function (p) { return !p.hedge && p.dir !== dir && p.month <= r.month; });
          if (r.position) {
            if (covered) add('good', c.title + ': защитил свои сделки', 'Этот контракт выигрывает в обратную сторону — он смягчает потери по другим сделкам.');
            else add('meh', c.title + ': страховать было нечего', 'Контракт защищает другие сделки, а таких у банка ещё не было. Он просто стоил денег.', 'caution', 0.5);
          } else {
            if (covered) add('meh', c.title + ': не защитил свои сделки', 'У банка уже были сделки, которые пострадали бы, если ' + asset + ' пойдёт против них.', 'caution', 0.5);
            else add('good', c.title + ': не переплатил', 'Защищать было нечего.');
          }
          return;
        }
        var exp = function (x) { return x.maxShields != null ? x.maxShields : SIZE[x.size || 'small'].cap; };
        var maxExp = Math.max.apply(null, posOpts.map(function (x) { return exp(x.position); }));
        if (r.position) {
          var pos = r.position, soft = !pos.insured && posOpts.length > 1 && exp(pos) < maxExp;
          if (clear && match) add('good', c.title + ': «' + o.label + '»' + ' — по новостям', 'Новости говорили, что ' + asset + ' ' + dirWord + ' — и сделка выигрывала именно тогда.');
          else if (clear && !match) {
            if (pos.insured) add('meh', c.title + ': против новостей, но со страховкой', 'Сделка выигрывала, только если ' + asset + ' ' + dirWord + ', а новости говорили обратное. Хорошо, что застраховал.', 'risk', 0.3);
            else if (soft) add('meh', c.title + ': против новостей, но осторожным вариантом', 'Сделка выигрывала, только если ' + asset + ' ' + dirWord + ', а новости говорили обратное. Хорошо, что риск был меньше.', 'risk', 0.4);
            else add('bad', c.title + ': сделка против новостей', 'Сделка выигрывала, только если ' + asset + ' ' + dirWord + ', а новости говорили обратное. Без страховки это ставка на удачу.', 'risk');
          } else {
            if (pos.insured) add('good', c.title + ': вслепую, но со страховкой', 'Новостей было мало, и ты защитился страховкой. Разумно.');
            else if (soft) add('good', c.title + ': вслепую, но осторожно', 'Новостей было мало, и ты выбрал вариант с меньшим риском. Не клади все яйца в одну корзину.');
            else add('meh', c.title + ': рискнул вслепую', 'Новостей ещё почти не было. В такой ситуации лучше дождаться новостей или застраховаться.', 'risk', pos.size === 'large' ? 1 : 0.5);
          }
        } else {
          if (clear && match) add('meh', c.title + ': упустил выгодную сделку', 'Новости говорили, что ' + asset + ' ' + dirWord + ' — сделка была на твоей стороне.', 'caution');
          else if (clear && !match) add('good', c.title + ': отказался — новости были против', 'Сделка выиграла бы, только если ' + asset + ' ' + dirWord + ', а новости говорили обратное.');
          else add('meh', c.title + ': отказался, не дождавшись новостей', 'Можно было подождать месяц и узнать больше.', 'caution', 0.5);
        }
        return;
      }
      add('info', c.title + ': «' + o.label + '»', c.explain);
    });

    var style;
    var took = s.positions.length;
    if (!took && caution >= 1) style = 'cautious';
    else if (risk >= 1 && risk >= caution) style = 'risky';
    else if (caution >= 1) style = 'cautious';
    else style = 'balanced';
    var newsOk = s.predictions.filter(function (p) { return p.correct; }).length;
    return { flags: F, style: style, risk: risk, caution: caution, judged: judged, good: good,
      newsOk: newsOk, newsTotal: s.predictions.length,
      learned: newsOk >= Math.ceil(s.predictions.length * 0.6) && style === 'balanced',
      lucky: insuredLater };
  }

  /* Подсказка к карточке решения: что говорят новости и когда выигрывает сделка (без готового ответа «жми вправо»). */
  function advice(s, c) {
    var posOpts = ['right', 'left', 'down'].map(function (k) { return c.options[k]; }).filter(function (x) { return x && x.position; });
    var isl = s.island;
    if (!posOpts.length || !posOpts.every(function (x) { return x.position.dir === posOpts[0].position.dir; })) return { kind: 'text', text: c.explain };
    var dir = posOpts[0].position.dir, e = s.evidence, clear = Math.abs(e) >= CLEAR;
    return {
      kind: 'signal', hedge: !!posOpts[0].position.hedge, deal: dir,
      news: clear ? (e > 0 ? 'up' : 'down') : null, // что говорят новости
      match: clear ? sgn(dir) * e > 0 : null,
      text: c.explain
    };
  }

  var api = { advice: advice, newRun: newRun, next: next, answer: answer, finish: finish, insuranceCost: insuranceCost, sgn: sgn, CLEAR: CLEAR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(this);

// Симуляция баланса: node tools/sim.js
const E = require('../game/engine.js');
const fs = require('fs'), path = require('path');
const C = p => JSON.parse(fs.readFileSync(path.join(__dirname, '../game/content', p), 'utf8'));
const config = C('config.json');
const sgn = E.sgn;
const posOpts = c => ['right', 'left', 'down'].filter(k => c.options[k] && c.options[k].position);
const exposure = o => o.position.maxShields != null ? o.position.maxShields : 3;
const refuseSide = c => ['left', 'down', 'right'].find(k => c.options[k] && !c.options[k].retry && !c.options[k].position && !c.options[k].insure && !(c.options[k].coins > 0) && !(c.options[k].hearts > 0)) || 'left';
const BOTS = {
  'Читает новости': (s, cur) => {
    if (cur.kind === 'event') return cur.card.dir === 'up' ? 'right' : cur.card.dir === 'down' ? 'left' : 'down';
    const c = cur.card, o = c.options;
    if (c.insurance) { const risky = s.positions.some(p => Math.abs(p.evidence) < 2 || sgn(p.dir) * s.evidence < 0); return risky ? 'right' : 'left'; }
    const ps = posOpts(c);
    if (ps.length) {
      const hedge = o[ps[0]].position.hedge, dir = o[ps[0]].position.dir;
      if (hedge) return s.positions.some(p => !p.hedge && p.dir !== dir) ? ps[0] : refuseSide(c);
      if (Math.abs(s.evidence) < 2) {
        if (o.down && o.down.retry && !c._waited) return 'down';
        return ps.slice().sort((a, b) => exposure(o[a]) - exposure(o[b]))[0]; // вслепую — самый осторожный вариант
      }
      return sgn(dir) * s.evidence > 0 ? ps.slice().sort((a, b) => exposure(o[b]) - exposure(o[a]))[0] : refuseSide(c);
    }
    return 'right';
  },
  'Берёт всё без страховки': (s, cur) => cur.kind === 'event' ? 'right' : (cur.card.insurance ? 'left' : (posOpts(cur.card).length ? posOpts(cur.card).sort((a, b) => exposure(cur.card.options[b]) - exposure(cur.card.options[a]))[0] : 'right')),
  'Берёт всё + страховка': (s, cur) => 'right',
  'Отказывается от всего': (s, cur) => cur.kind === 'event' ? 'left' : refuseSide(cur.card),
  'Ждёт везде': (s, cur) => cur.kind === 'event' ? 'down' : (cur.card.options.down && !cur.card._waited ? 'down' : 'right'),
  'Случайный': (s, cur) => { const k = Object.keys(cur.kind === 'event' ? { right: 1, left: 1, down: 1 } : cur.card.options); return k[Math.floor(Math.random() * k.length)]; }
};
for (const isl of config.islands.filter(i => i.playable)) {
  const deck = C(isl.deck);
  console.log('\n=== ' + isl.name);
  for (const [name, bot] of Object.entries(BOTS)) {
    const N = 4000; let a = { coins: 0, shields: 0, hearts: 0, cards: 0, q: 0 }; const st = {}, bank = {};
    for (let i = 0; i < N; i++) {
      const s = E.newRun(config, isl, deck, Math.random); let cards = 0;
      while (true) { const cur = E.next(s); if (cur.kind === 'final') break; cards++; E.answer(s, bot(s, cur)); }
      a.coins += s.coins; a.shields += s.shields; a.hearts += s.hearts; a.cards += cards; a.q += s.quality;
      st[s.eval.style] = (st[s.eval.style] || 0) + 1; bank[s.bank] = (bank[s.bank] || 0) + 1;
    }
    const f = x => (x / N).toFixed(1), pc = o => Object.entries(o).map(([k, v]) => k + ' ' + Math.round(v / N * 100) + '%').join(', ');
    console.log(name.padEnd(24), 'монеты', f(a.coins), 'щиты', f(a.shields), 'сердца', f(a.hearts), 'карт', f(a.cards), 'качество', (a.q/N).toFixed(2), '| стиль:', pc(st), '| банк:', pc(bank));
  }
}

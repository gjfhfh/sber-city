// Импорт карточек команды: node tools/import-cards.js [tools/cards.json]
// cards.json (events + choices с полем dept) -> game/content/metals.json и credit.json.
// Сохраняются: факты, советы, итог и карточка-страховка отдела (их нет в cards.json).
// Оформление (короткий заголовок, «кто просит», иконка) берётся из tools/card-meta.json.
// Дальше запустите node tools/build.js (встроенная копия + проверка) и node tools/sim.js (баланс).
const fs = require('fs'), path = require('path');
const T = __dirname, C = path.join(T, '..', 'game', 'content');
const src = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || path.join(T, 'cards.json')), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(T, 'card-meta.json'), 'utf8'));
const DEPT = { metals: 'metals.json', credit: 'credit.json' };
const evMeta = JSON.parse(fs.readFileSync(path.join(T, 'event-meta.json'), 'utf8')); // id -> [вопрос-подсказка, коротко «что → итог», (свой разбор)]
const SIDES = ['right', 'left', 'down'];
// какие прежние новости (id) остаются; остальные — дубли смысла новых карточек
const KEEP = { metals: ['c4_goldless_electronics', 'c5_refinery_accident', 'c7_ruble_stronger', 'c8_ruble_weaker', 'c9_fast_trains', 'c10_miners_bankrupt'], credit: [] };
const norm = t => t.toLowerCase().replace(/[^а-яa-z0-9]+/g, ' ').trim();

for (const [dept, file] of Object.entries(DEPT)) {
  const old = JSON.parse(fs.readFileSync(path.join(C, file), 'utf8'));
  const events = src.events.filter(e => e.dept === dept).map(e => { const x = Object.assign({}, e); delete x.dept; return x; });
  // старые новости отдела, которых нет в новом файле, остаются: без них у «Золота» всего 6 новостей на 6 месяцев,
  // и вероятности по тренду перестают работать (в каждой партии выпадают все новости)
  const have = new Set(events.map(e => norm(e.text)));
  const keep = (old.events || []).filter(e => KEEP[dept].includes(e.id) && !have.has(norm(e.text))).map(e => { const x = Object.assign({}, e); delete x.extra; return x; }); // extra зависел от решений, которых больше нет
  // подсказки к новостям: короткий вопрос (hint) и «что → итог» (short), чтобы не заставлять детей читать
  events.concat(keep).forEach(e => { const m = evMeta[e.id]; if (m) { e.hint = m[0]; e.short = m[1]; if (m[2]) e.explain = m[2]; } });
  const choices = [];
  for (const c of src.choices.filter(c => c.dept === dept && !(meta._skip || []).includes(c.id))) {
    const m = meta[c.id] || [];
    const title = m[0] || c.text.split(/[.,?!]/)[0].slice(0, 36);
    const withPos = c.options.filter(o => o.position).length;
    const out = { id: c.id, type: 'choice', core: (c.weight || 1) >= 3, icon: m[2] || 'case', who: m[1] || 'Банк', title,
      text: c.text, explain: (meta._explain || {})[c.id] || c.explain, weight: c.weight || 1, options: {} };
    c.options.forEach((o, i) => {
      const x = Object.assign({}, o);
      if (x.position) {
        x.position = Object.assign({ name: withPos > 1 ? title + ': ' + o.label.toLowerCase() : title }, x.position);
        if (m[3] === 'hedge') x.position.hedge = true;
      }
      out.options[SIDES[i]] = x;
    });
    choices.push(out);
  }
  // карточки-страховки (insurance:true) нет в cards.json — переносим из прежней колоды
  (old.choices || []).filter(c => c.insurance).forEach(c => choices.push(c));
  const deck = { facts: old.facts, events: events.concat(keep), choices, tips: old.tips, lesson: old.lesson };
  fs.writeFileSync(path.join(C, file), JSON.stringify(deck, null, 2) + '\n');
  console.log(file + ': новостей ' + deck.events.length + ' (из cards.json ' + events.length + ', прежних сохранено ' + keep.length + '), решений ' + choices.length);
}

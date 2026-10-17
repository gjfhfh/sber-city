// Сборка и проверка: node tools/build.js
// 1) кладёт JSON-контент внутрь content/fallback.js — игра работает, даже если JSON не загрузился или битый;
// 2) проверяет бюджет веса (≤ 5 МБ) и изоляцию (ни одного обращения во внешний мир).
const fs = require('fs'), path = require('path');
const G = path.join(__dirname, '..', 'game'), C = path.join(G, 'content');
const read = f => JSON.parse(fs.readFileSync(path.join(C, f), 'utf8'));
const config = read('config.json');
const decks = {};
for (const i of config.islands) if (i.playable && i.deck) decks[i.id] = read(i.deck);
fs.writeFileSync(path.join(C, 'fallback.js'),
  '/* Сгенерировано tools/build.js из JSON в этой папке. Не правьте руками. */\nwindow.SBER_CITY_CONTENT = ' + JSON.stringify({ config, decks }) + ';\n');

let total = 0, problems = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (f.startsWith('_')) continue; // служебные тестовые файлы не публикуются
    total += st.size;
    if (/\.(html|css|js|json)$/.test(f)) {
      const t = fs.readFileSync(p, 'utf8');
      const urls = t.match(/(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"')]*/gi) || [];
      urls.filter(u => !/^\/\/\s/.test(u)).forEach(u => problems.push(path.relative(G, p) + ': внешний адрес ' + u));
      if (/@import|fonts\.googleapis|<iframe|window\.open|localStorage|document\.cookie/.test(t)) problems.push(path.relative(G, p) + ': запрещённый приём');
    }
  }
})(G);
console.log('Вес игры: ' + (total / 1024).toFixed(1) + ' КБ из 5120 КБ бюджета');
if (total > 5 * 1024 * 1024) problems.push('Превышен бюджет 5 МБ');
if (problems.length) { console.log('Проблемы:\n' + problems.join('\n')); process.exit(1); }
console.log('Изоляция: ок — ни CDN, ни шрифтов, ни аналитики, ни ссылок наружу');

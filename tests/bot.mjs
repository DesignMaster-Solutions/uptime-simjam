// Balance probe: a simple sensible player. Run: node tests/bot.mjs
import * as m from '../sim.js';
export function play(seed) {
  const g = m.newGame(seed); let n = 0;
  while (!g.over && n < 24 * 61) {
    for (const s of g.servers) if (s.down > 0 && !s.fixing) m.repair(g, s.id);
    if (g.room > 29) m.addCooling(g);
    const ups = g.servers.filter(s => s.down <= 0);
    const ls = ups.map(s => [s.id, m.load(g, s.id)]).sort((a, b) => b[1] - a[1]);
    g.price = g.servers.length >= 8 && ls.length && ls[0][1] > 0.7 ? "high" : "mid";
    if (ls.length && ls[0][1] > 0.85 && g.cash > m.COST.server + 20 && !m.addServer(g)) m.upgrade(g, ls[0][0]);
    if (ls.length > 1 && ls[0][1] > 1) { const site = g.sites.find(x => x.server === ls[0][0]); if (site) m.move(g, site.id, ls.at(-1)[0]); }
    for (const site of g.sites) if (!ups.find(s => s.id === site.server) && ls.length) m.move(g, site.id, ls.at(-1)[0]);
    m.tick(g); n++;
  }
  return g;
}
if (process.argv[1].endsWith('bot.mjs')) for (const seed of [1, 2, 3, 4, 5, 6]) {
  const g = play(seed); console.log(seed, g.over, g.day, g.cash.toFixed(0), g.rep.toFixed(0), g.sites.length, g.servers.length, g.cooling, m.score(g));
}

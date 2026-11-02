// Uptime: pure simulation core (no DOM) so it can be tested with node --test.
export const PRICES = { low: { day: 2, pull: 1.6 }, mid: { day: 3, pull: 1 }, high: { day: 5, pull: 0.55 } };
export const COST = { server: 60, cooling: 45, repair: 40, upgrade: 120, serverDay: 1.5, coolingDay: 2 };
export const CAP = 100, DAYS = 60;
const NAMES = ['Bakery', 'Dentist', 'Bike Shop', 'Law Firm', 'Florist', 'Gym', 'Pet Groomer', 'Plumber', 'Book Club',
  'Taco Truck', 'Yoga Studio', 'Barber', 'Wedding Blog', 'Bookstore', 'Roofer', 'Vet Clinic', 'Tattoo Shop', 'Tutor',
  'Bridal Shop', 'Coffee Bar', 'Indie Band', 'Ceramics', 'Locksmith', 'Choir', 'Food Bank', 'Podcast', 'Landscaper'];

export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function newGame(seed = Date.now()) {
  const g = { rand: rng(seed), seed, hour: 8, day: 1, cash: 150, rep: 50, price: 'mid', nextId: 1, outside: 22, room: 24,
    heatWave: 0, servers: [], cooling: 1, sites: [], log: [], over: null, served: 0, siteHours: 0, upHours: 0 };
  addServer(g, true); addSite(g); addSite(g);
  return g;
}

export function addServer(g, free = false) {
  if (!free) { if (g.cash < COST.server || g.servers.length >= 8) return false; g.cash -= COST.server; }
  g.servers.push({ id: g.nextId++, down: 0, tier: 1 });
  return true;
}
export function addCooling(g) {
  if (g.cash < COST.cooling || g.cooling >= 6) return false;
  g.cash -= COST.cooling; g.cooling++; return true;
}
export function upgrade(g, sid) {
  const s = g.servers.find(x => x.id === sid);
  if (!s || s.tier >= 3 || g.cash < COST.upgrade * s.tier) return false;
  g.cash -= COST.upgrade * s.tier; s.tier++; return true;
}
export function repair(g, sid) {
  const s = g.servers.find(x => x.id === sid);
  if (!s || s.down <= 0 || s.fixing || g.cash < COST.repair) return false;
  g.cash -= COST.repair; s.fixing = true; s.down = 6; return true;
}
// Drop a site's traffic at the edge while it is under attack: its neighbours stay fast, it goes dark.
export function nullRoute(g, siteId) {
  const site = g.sites.find(x => x.id === siteId);
  if (!site || site.ddos <= 0 || site.nulled) return false;
  site.nulled = true; say(g, `${site.name} null-routed until the attack ends`, 'warn'); return true;
}
export function move(g, siteId, sid) {
  const site = g.sites.find(x => x.id === siteId), s = g.servers.find(x => x.id === sid);
  if (!site || !s || site.server === sid) return false;
  site.server = sid; site.mood = Math.max(0, site.mood - 3); // migration blip
  return true;
}

export function traffic(g, site) {
  if (site.nulled) return 0;
  const diurnal = 0.55 + 0.45 * Math.sin(((g.hour - 8) / 24) * Math.PI * 2);
  return site.base * diurnal * (site.viral > 0 ? 3 : 1) * (site.ddos > 0 ? 8 : 1);
}
export const capOf = s => CAP * s.tier;
export function load(g, sid) {
  const s = g.servers.find(x => x.id === sid);
  return g.sites.filter(x => x.server === sid).reduce((a, x) => a + traffic(g, x), 0) / (s ? capOf(s) : CAP);
}
const up = g => g.servers.filter(s => s.down <= 0);

export function addSite(g) {
  const pool = up(g); if (!pool.length) return null;
  const target = pool.reduce((a, b) => (load(g, a.id) <= load(g, b.id) ? a : b));
  if (load(g, target.id) > 0.9) { say(g, 'Lead lost: no room in the rack', 'warn'); return null; }
  const site = { id: g.nextId++, name: NAMES[Math.floor(g.rand() * NAMES.length)], base: 6 + g.rand() * 14,
    server: target.id, mood: 80, viral: 0, ddos: 0 };
  g.sites.push(site); say(g, `${site.name} signed up`, 'good');
  return site;
}
// A big client: a heavy site that pays two slots of your price. Your call: the money, or the headroom.
const BIG = ['Ticket Shop', 'Online Store', 'Radio Station', 'City Council', 'Arena', 'Newspaper'];
export function acceptOffer(g) {
  const o = g.offer, pool = up(g); if (!o || !pool.length) return false;
  const target = pool.reduce((a, b) => (load(g, a.id) <= load(g, b.id) ? a : b));
  g.sites.push({ id: g.nextId++, name: o.name, base: o.base, pay: 2, server: target.id, mood: 80, viral: 0, ddos: 0 });
  g.offer = null; say(g, `${o.name} signed up at double price`, 'good'); return true;
}
export function declineOffer(g) { if (!g.offer) return false; say(g, `${g.offer.name} went elsewhere`, ''); g.offer = null; return true; }
const tag = (g, s) => `SRV-${g.servers.indexOf(s) + 1}`; // the rack slot the player sees, not the internal id
function say(g, text, kind = '') { g.log.unshift({ t: `D${g.day} ${String(g.hour).padStart(2, '0')}h`, text, kind }); g.log.length = Math.min(g.log.length, 40); }

export function tick(g) {
  if (g.over) return;
  const r = g.rand;
  // events
  if (r() < 0.012 && g.sites.length) { const s = g.sites[Math.floor(r() * g.sites.length)]; s.ddos = 4; say(g, `DDoS on ${s.name}!`, 'bad'); }
  if (r() < 0.01 && g.sites.length) { const s = g.sites[Math.floor(r() * g.sites.length)]; s.viral = 12; s.viralUp = 0; say(g, `${s.name} went viral`, 'warn'); }
  if (g.hour === 6 && !g.heatWave && r() < 0.12) { g.heatWave = 24; say(g, 'Heat wave: outside +7°C', 'warn'); }
  g.outside = 22 + 4 * Math.sin(((g.hour - 9) / 24) * Math.PI * 2) + (g.heatWave > 0 ? 7 : 0);
  // arrivals
  if (!g.offer && g.hour === 10 && g.day > 3 && r() < 0.3) { g.offer = { name: BIG[Math.floor(r() * BIG.length)], base: 24 + r() * 10 }; say(g, `Big client: ${g.offer.name} wants in at double price`, 'warn'); }
  if (r() < 0.11 * (g.rep / 50) * PRICES[g.price].pull) addSite(g);
  // servers: heat and failures
  let heat = 0;
  for (const s of g.servers) {
    if (s.down > 0) { if (s.fixing && --s.down === 0) { s.fixing = false; say(g, `${tag(g, s)} back online`, 'good'); } continue; }
    const l = load(g, s.id); heat += s.tier * (0.8 + 2 * Math.min(l, 1.6));
    if (g.room > 31 && r() < (g.room - 31) * 0.006 * (1 + l)) { s.down = 1; s.fixing = false; say(g, `${tag(g, s)} overheated and died`, 'bad'); }
  }
  const target = g.outside + heat * 1.1 - g.cooling * 4.5;
  g.room += (Math.max(target, 16) - g.room) * 0.25;
  // sites: mood and churn
  for (const site of [...g.sites]) {
    const s = g.servers.find(x => x.id === site.server);
    const l = load(g, site.server);
    const dark = !s || s.down > 0 || site.nulled;
    g.siteHours++; if (!dark) g.upHours++;
    if (site.nulled) site.mood -= 5;
    else if (dark) site.mood -= 9;
    else if (l > 1) site.mood -= 6 * (l - 1) + 2;
    else { site.mood = Math.min(100, site.mood + 1.2); g.served += traffic(g, site); }
    site.mood -= PRICES[g.price].day > 3 ? 0.3 : 0;
    if (site.viral > 0) { if (!dark && l <= 1) site.viralUp++; if (--site.viral === 0) viralEnd(g, site); }
    if (site.ddos > 0 && --site.ddos === 0) site.nulled = false;
    if (site.mood < 25 && r() < 0.15) {
      g.sites.splice(g.sites.indexOf(site), 1); g.rep = Math.max(0, g.rep - 3); say(g, `${site.name} cancelled`, 'bad');
    }
  }
  if (++g.hour === 24) endOfDay(g);
}

// A viral spike is a test in public: served well for most of it, its fans follow; crashed, everyone saw.
function viralEnd(g, site) {
  if (site.viralUp >= 9) { g.cash += 25; say(g, `${site.name} stayed fast while viral: +$25 thank-you bonus`, 'good'); }
  else if (site.viralUp < 6) { g.rep = Math.max(0, g.rep - 2); say(g, `${site.name}'s big moment crashed: reputation hit`, 'bad'); }
}

function endOfDay(g) {
  g.hour = 0;
  const income = g.sites.reduce((a, s) => a + (s.pay || 1), 0) * PRICES[g.price].day, costs = g.servers.reduce((a, s) => a + s.tier, 0) * COST.serverDay + g.cooling * COST.coolingDay;
  g.cash += income - costs;
  const avg = g.sites.length ? g.sites.reduce((a, s) => a + s.mood, 0) / g.sites.length : 40;
  g.rep = Math.max(0, Math.min(100, g.rep + (avg - 60) / 10));
  if (g.heatWave > 0) g.heatWave = 0;
  say(g, `Day ${g.day} closed: +$${income.toFixed(0)} −$${costs.toFixed(0)}`, income >= costs ? 'good' : 'warn');
  if (g.cash < -100) g.over = 'bankrupt';
  else if (g.rep <= 0) g.over = 'reputation';
  else if (g.day >= DAYS) g.over = 'survived';
  g.day++;
}
export const score = g => Math.round(g.cash + g.sites.length * 20 + g.rep * 5);
export const uptime = g => (g.siteHours ? g.upHours / g.siteHours : 1);
// One rack per UTC day: everyone who opens the shop today plays the same sixty days.
export const dailySeed = (d = new Date()) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

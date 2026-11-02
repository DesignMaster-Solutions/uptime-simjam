import * as S from './sim.js';
import { mountScene, drawScene, toast, jolt } from './scene.js';

let g, speed = 0, sel = null, acc = 0, last = 0, alarmAt = 0;
const $ = id => document.getElementById(id);
let ac;
function beep(f, d = 0.12, type = 'sine', v = 0.05) {
  try {
    ac ||= new AudioContext();
    const o = ac.createOscillator(), a = ac.createGain();
    o.type = type; o.frequency.value = f; a.gain.setValueAtTime(v, ac.currentTime);
    a.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
    o.connect(a).connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
  } catch { /* audio is optional */ }
}
const SOUND = { good: () => (beep(880), setTimeout(() => beep(1320), 90)), bad: () => beep(140, 0.35, 'square', 0.04), warn: () => beep(520, 0.2, 'triangle') };

// Coach: each tip shows once per browser, the first time its situation happens, and pauses until read.
let tipsSeen; try { tipsSeen = new Set(JSON.parse(localStorage.getItem('uptime.tips') || '[]')); } catch { tipsSeen = new Set(); }
let resumeTo = 1;
const TIPS = {
  death: n => `<b>${n} died.</b> Every site on it is down and its customers are counting the hours. Click <b>Repair</b> ($${S.COST.repair}, back in 6 h), or move its sites to a live server now.`,
  ddos: n => `<b>DDoS on ${n}:</b> eight times the traffic for 4 hours, and its neighbours drown with it. <b>Null-route</b> it from its server card (only ${n} goes dark), move it to an empty server, or ride it out.`,
  viral: n => `<b>${n} went viral:</b> triple traffic for 12 hours. Keep it fast (its server under 100%) for most of that and it pays a $25 thank-you. Let it crash and your reputation takes the hit.`,
  heat: () => `<b>The room is past 29°C.</b> At 31°C servers start dying, faster the busier they are. Add a cooling unit, or move sites off the hottest servers.`,
  overload: n => `<b>${n} is over 100%.</b> Its sites get slow and their owners get unhappy (chips turn amber, then red). Click a site, then a quieter server, to move it. Or rack a new server.`,
  lead: () => `<b>A customer walked away:</b> no server had room. Rack another server or upgrade one (T2 doubles capacity, and heat).`,
  day: () => `<b>Day 1 closed.</b> Every night each site pays your price and every server and cooling unit costs its rent. Cash below −$100 or reputation at zero ends the run.`,
};
function coach(key, ...args) {
  if (tipsSeen.has(key) || !$('tip').classList.contains('hide')) return false;
  tipsSeen.add(key); try { localStorage.setItem('uptime.tips', JSON.stringify([...tipsSeen])); } catch { /* private mode */ }
  resumeTo = speed || 1; setSpeed(0);
  $('tipText').innerHTML = TIPS[key](...args); $('tip').classList.remove('hide'); $('tipOk').focus();
  return true;
}
function closeTip(all) {
  if (all) { Object.keys(TIPS).forEach(k => tipsSeen.add(k)); try { localStorage.setItem('uptime.tips', JSON.stringify([...tipsSeen])); } catch { /* ignore */ } }
  $('tip').classList.add('hide'); if (g && !g.over) setSpeed(resumeTo);
}
$('tipOk').onclick = () => closeTip(false);
$('tipOff').onclick = () => closeTip(true);
const label = id => `SRV-${g.servers.findIndex(s => s.id === id) + 1}`;

const today = () => new Date().toISOString().slice(0, 10);
function start(seed, label) { g = S.newGame(seed); g.label = label; sel = null; mountScene($('scene')); setSpeed(1); $('overlay').classList.add('hide'); render(); }
function setSpeed(s) { speed = s; for (const b of $('speed').children) b.classList.toggle('on', +b.dataset.s === s); }

function step() {
  const seen = g.log[0];
  S.tick(g);
  const fresh = []; for (const e of g.log) { if (e === seen) break; fresh.push(e); SOUND[e.kind]?.(); }
  if (g.room > 31 && performance.now() - alarmAt > 2500) { alarmAt = performance.now(); beep(980, 0.08, 'square', 0.03); }
  for (const e of fresh) {
    const day = e.text.match(/^Day \d+ closed: (.*)$/);
    if (day) toast($('scene'), day[1], e.kind);
    if (/overheated and died/.test(e.text)) jolt($('scene'));
  }
  if (g.over) return end();
  react(fresh);
}

function react(fresh) {
  const has = re => fresh.find(e => re.test(e.text));
  const dead = g.servers.find(s => s.down > 0 && !s.fixing), over = g.servers.find(s => s.down <= 0 && S.load(g, s.id) > 1);
  const ddos = g.sites.find(x => x.ddos > 0 && !x.nulled), viral = g.sites.find(x => x.viral > 0);
  if (dead && coach('death', label(dead.id))) return;
  if (ddos && has(/^DDoS on/) && coach('ddos', ddos.name)) return;
  if (viral && has(/went viral$/) && coach('viral', viral.name)) return;
  if (g.room > 29 && coach('heat')) return;
  if (over && coach('overload', label(over.id))) return;
  if (has(/^Lead lost/) && coach('lead')) return;
  if (has(/^Day 1 closed/)) coach('day');
}

function end() {
  setSpeed(0);
  const why = { survived: 'You kept the lights on for 60 days.', bankrupt: 'The bank closed the shop.', reputation: 'Nobody trusts your servers anymore.' }[g.over];
  const day = Math.min(g.day - 1, S.DAYS), up = (S.uptime(g) * 100).toFixed(1);
  const result = `Uptime, ${g.label}: day ${day} · ${up}% uptime · $${g.cash.toFixed(0)} · ${g.sites.length} sites · score ${S.score(g)} · designmastersolutions.itch.io/uptime`;
  $('overlay').innerHTML = `<div class="card"><h1>${g.over === 'survived' ? 'Sixty days up' : 'Shop closed'}</h1>
    <p class="lead">${why}</p><p class="small">${g.label}</p>
    <p>Day ${day} · <b>${up}% uptime</b> · ${g.sites.length} sites · $${g.cash.toFixed(0)} · reputation ${g.rep.toFixed(0)}</p>
    <p><b>Score ${S.score(g)}</b> <span class="small">(cash + 20 per site + 5 per reputation point)</span></p>
    <p class="row"><input id="result" readonly value="${result.replace(/"/g, '&quot;')}"><button id="copy" class="ghost">Copy result</button></p>
    <p class="row"><button id="again">Same rack again</button><button id="random" class="ghost">Random rack</button></p></div>`;
  $('overlay').classList.remove('hide');
  $('again').onclick = () => start(g.seed, g.label);
  $('random').onclick = () => start(Date.now(), 'Random rack');
  $('copy').onclick = () => { // itch embeds may deny the clipboard API: the legacy command works on a selected input
    $('result').select(); const done = () => { $('copy').textContent = 'Copied'; };
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* fall through */ }
    if (ok) done(); else navigator.clipboard?.writeText(result).then(done, () => { $('copy').textContent = 'Selected: press Ctrl+C'; });
  };
}

function render() {
  $('day').textContent = `Day ${Math.min(g.day, S.DAYS)}/${S.DAYS}`;
  $('clock').textContent = `${String(g.hour).padStart(2, '0')}:00`;
  $('cash').textContent = `$${g.cash.toFixed(0)}`; $('cash').style.color = g.cash < 0 ? 'var(--bad)' : '';
  const rep = $('rep'); rep.style.width = `${g.rep}%`; rep.style.background = g.rep < 25 ? 'var(--bad)' : g.rep < 50 ? 'var(--warn)' : 'var(--ok)';
  $('up').textContent = `${(S.uptime(g) * 100).toFixed(1)}%`; $('up').style.color = S.uptime(g) < 0.95 ? 'var(--bad)' : '';
  $('room').textContent = `${g.room.toFixed(1)}°C`; $('room').classList.toggle('hot', g.room > 31);
  $('outside').textContent = `out ${g.outside.toFixed(0)}°C${g.heatWave > 0 ? ' heat wave' : ''}`;
  for (const b of $('price').children) b.classList.toggle('on', b.dataset.p === g.price);
  $('buyServer').disabled = g.cash < S.COST.server || g.servers.length >= 8;
  $('buyCool').disabled = g.cash < S.COST.cooling || g.cooling >= 6;
  $('buyCool').firstChild.textContent = `Add cooling unit (${g.cooling}/6) `;
  $('buyServer').firstChild.textContent = `Rack a server (${g.servers.length}/8) `;
  $('rack').innerHTML = g.servers.map((s, i) => {
    const l = S.load(g, s.id), down = s.down > 0, pct = Math.round(l * 100);
    const leds = Array.from({ length: 6 }, (_, i) => `<i class="${!down && Math.random() < Math.min(1, l) + 0.1 * (i === 0) ? 'on' : ''}"></i>`).join('');
    const chips = g.sites.filter(x => x.server === s.id).map(x =>
      `<span class="chip ${x.mood < 40 ? 'sad' : x.mood < 65 ? 'meh' : ''} ${x.viral ? 'viral' : ''} ${x.ddos ? 'ddos' : ''} ${x.nulled ? 'dark' : ''} ${sel === x.id ? 'sel' : ''}" data-site="${x.id}" title="mood ${x.mood.toFixed(0)}${x.viral ? ` · viral ${x.viral}h` : ''}${x.ddos ? ` · attack ${x.ddos}h` : ''}">${x.name}</span>`).join('');
    const hit = g.sites.find(x => x.server === s.id && x.ddos > 0 && !x.nulled);
    const act = down ? `<button data-repair="${s.id}">${s.fixing ? `Repairing ${s.down}h` : `Repair $${S.COST.repair}`}</button>`
      : (hit ? `<button class="danger" data-null="${hit.id}">Null-route ${hit.name}</button>` : '')
      + (s.tier < 3 ? `<button data-up="${s.id}">Upgrade to T${s.tier + 1} $${S.COST.upgrade * s.tier}</button>` : '');
    return `<div class="srv ${down ? 'down' : ''} ${l > 1 ? 'over' : l > 0.8 ? 'hot' : ''} ${sel ? 'target' : ''}" data-srv="${s.id}">
      <header><span>SRV-${i + 1} · T${s.tier} · ${down ? 'DOWN' : pct + '%'}</span><span class="leds">${leds}</span></header>
      <div class="load"><i style="width:${Math.min(100, pct)}%;background:${l > 1 ? 'var(--bad)' : l > 0.8 ? 'var(--warn)' : 'var(--ok)'}"></i></div>
      <div class="chips">${chips || '<span class="small">empty</span>'}</div><div class="act">${act}</div></div>`;
  }).join('');
  drawScene($('scene'), g);
  $('log').innerHTML = g.log.map(e => `<li class="${e.kind}">${e.t} <em>${e.text}</em></li>`).join('');
  $('hint').textContent = sel ? `Moving ${g.sites.find(x => x.id === sel)?.name}: click a server.` : 'Click a site, then click a server to move it.';
}

$('rack').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.repair) { S.repair(g, +t.dataset.repair); return render(); }
  if (t.dataset.null) { S.nullRoute(g, +t.dataset.null) && beep(240, 0.18, 'sawtooth', 0.03); return render(); }
  if (t.dataset.up) { S.upgrade(g, +t.dataset.up); return render(); }
  if (t.dataset.site) { sel = sel === +t.dataset.site ? null : +t.dataset.site; return render(); }
  const srv = t.closest('.srv');
  if (srv && sel) { S.move(g, sel, +srv.dataset.srv); sel = null; beep(660, 0.06); render(); }
});
$('buyServer').onclick = () => { S.addServer(g) && beep(440, 0.1); render(); };
$('buyCool').onclick = () => { S.addCooling(g) && beep(330, 0.15, 'triangle'); render(); };
$('price').onclick = e => { if (e.target.dataset.p) { g.price = e.target.dataset.p; render(); } };
$('speed').onclick = e => { if (e.target.dataset.s) setSpeed(+e.target.dataset.s); };
addEventListener('keydown', e => {
  if (!$('tip').classList.contains('hide')) { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); closeTip(false); } return; }
  if (e.code === 'Space' && g && !g.over) { e.preventDefault(); setSpeed(speed ? 0 : 1); }
});
$('daily').textContent = `Today's rack (${today()}): everyone who opens the shop today gets the same sixty days. Same rack, your calls. Compare results in the comments.`;
$('start').onclick = () => start(S.dailySeed(), `Daily rack ${today()}`);
// ?ff=N skips N days (and &h=H hours) with the balance bot playing, for screenshots; ?ff=0 just opens today's rack.
// &quiet hides the tips.
const qs = new URLSearchParams(location.search), ff = Math.min(+qs.get('ff') || 0, S.DAYS - 1), hh = +qs.get('h') || 0;
if (qs.has('quiet')) Object.keys(TIPS).forEach(k => tipsSeen.add(k));
if (qs.has('ff')) {
  const { decide } = await import('./tests/bot.mjs');
  start(S.dailySeed(), ff ? `Daily rack ${today()} (skipped to day ${ff + 1})` : `Daily rack ${today()}`);
  while (!g.over && (g.day <= ff || (ff && g.hour < hh))) { decide(g); S.tick(g); }
  render();
}
$('random').onclick = () => start(Date.now(), 'Random rack');

function loop(t) {
  if (g && speed && !g.over) { acc += (t - last) * speed; let n = 0; while (acc > 1000 && speed) { acc -= 1000; step(); n++; } if (n) render(); }
  else acc = 0;
  last = t; requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

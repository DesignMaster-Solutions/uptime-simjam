import * as S from './sim.js';

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

function start(seed) { g = S.newGame(seed); sel = null; setSpeed(1); $('overlay').classList.add('hide'); render(); }
function setSpeed(s) { speed = s; for (const b of $('speed').children) b.classList.toggle('on', +b.dataset.s === s); }

function step() {
  const seen = g.log[0];
  S.tick(g);
  for (const e of g.log) { if (e === seen) break; SOUND[e.kind]?.(); }
  if (g.room > 31 && performance.now() - alarmAt > 2500) { alarmAt = performance.now(); beep(980, 0.08, 'square', 0.03); }
  if (g.over) end();
}

function end() {
  setSpeed(0);
  const why = { survived: 'You kept the lights on for 60 days.', bankrupt: 'The bank closed the shop.', reputation: 'Nobody trusts your servers anymore.' }[g.over];
  $('overlay').innerHTML = `<div class="card"><h1>${g.over === 'survived' ? 'Sixty days up' : 'Shop closed'}</h1>
    <p class="lead">${why}</p><p>Day ${Math.min(g.day - 1, S.DAYS)} · ${g.sites.length} sites · $${g.cash.toFixed(0)} · reputation ${g.rep.toFixed(0)}</p>
    <p><b>Score ${S.score(g)}</b> <span class="small">(cash + 20 per site + 5 per reputation point)</span></p>
    <button id="again">Run it again</button></div>`;
  $('overlay').classList.remove('hide');
  $('again').onclick = () => start(Date.now());
}

function render() {
  $('day').textContent = `Day ${Math.min(g.day, S.DAYS)}/${S.DAYS}`;
  $('clock').textContent = `${String(g.hour).padStart(2, '0')}:00`;
  $('cash').textContent = `$${g.cash.toFixed(0)}`; $('cash').style.color = g.cash < 0 ? 'var(--bad)' : '';
  const rep = $('rep'); rep.style.width = `${g.rep}%`; rep.style.background = g.rep < 25 ? 'var(--bad)' : g.rep < 50 ? 'var(--warn)' : 'var(--ok)';
  $('room').textContent = `${g.room.toFixed(1)}°C`; $('room').classList.toggle('hot', g.room > 31);
  $('outside').textContent = `out ${g.outside.toFixed(0)}°C${g.heatWave > 0 ? ' heat wave' : ''}`;
  for (const b of $('price').children) b.classList.toggle('on', b.dataset.p === g.price);
  $('buyServer').disabled = g.cash < S.COST.server || g.servers.length >= 8;
  $('buyCool').disabled = g.cash < S.COST.cooling || g.cooling >= 6;
  $('buyCool').firstChild.textContent = `Add cooling unit (${g.cooling}/6) `;
  $('buyServer').firstChild.textContent = `Rack a server (${g.servers.length}/8) `;
  $('rack').innerHTML = g.servers.map(s => {
    const l = S.load(g, s.id), down = s.down > 0, pct = Math.round(l * 100);
    const leds = Array.from({ length: 6 }, (_, i) => `<i class="${!down && Math.random() < Math.min(1, l) + 0.1 * (i === 0) ? 'on' : ''}"></i>`).join('');
    const chips = g.sites.filter(x => x.server === s.id).map(x =>
      `<span class="chip ${x.mood < 40 ? 'sad' : x.mood < 65 ? 'meh' : ''} ${x.viral ? 'viral' : ''} ${x.ddos ? 'ddos' : ''} ${sel === x.id ? 'sel' : ''}" data-site="${x.id}" title="mood ${x.mood.toFixed(0)}">${x.name}</span>`).join('');
    const act = down ? `<button data-repair="${s.id}">${s.fixing ? `Repairing ${s.down}h` : `Repair $${S.COST.repair}`}</button>`
      : s.tier < 3 ? `<button data-up="${s.id}">Upgrade to T${s.tier + 1} $${S.COST.upgrade * s.tier}</button>` : '';
    return `<div class="srv ${down ? 'down' : ''} ${l > 1 ? 'over' : l > 0.8 ? 'hot' : ''} ${sel ? 'target' : ''}" data-srv="${s.id}">
      <header><span>SRV-${i + 1} · T${s.tier} · ${down ? 'DOWN' : pct + '%'}</span><span class="leds">${leds}</span></header>
      <div class="load"><i style="width:${Math.min(100, pct)}%;background:${l > 1 ? 'var(--bad)' : l > 0.8 ? 'var(--warn)' : 'var(--ok)'}"></i></div>
      <div class="chips">${chips || '<span class="small">empty</span>'}</div><div class="act">${act}</div></div>`;
  }).join('');
  $('log').innerHTML = g.log.map(e => `<li class="${e.kind}">${e.t} <em>${e.text}</em></li>`).join('');
  $('hint').textContent = sel ? `Moving ${g.sites.find(x => x.id === sel)?.name}: click a server.` : 'Click a site, then click a server to move it.';
}

$('rack').addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.repair) { S.repair(g, +t.dataset.repair); return render(); }
  if (t.dataset.up) { S.upgrade(g, +t.dataset.up); return render(); }
  if (t.dataset.site) { sel = sel === +t.dataset.site ? null : +t.dataset.site; return render(); }
  const srv = t.closest('.srv');
  if (srv && sel) { S.move(g, sel, +srv.dataset.srv); sel = null; beep(660, 0.06); render(); }
});
$('buyServer').onclick = () => { S.addServer(g) && beep(440, 0.1); render(); };
$('buyCool').onclick = () => { S.addCooling(g) && beep(330, 0.15, 'triangle'); render(); };
$('price').onclick = e => { if (e.target.dataset.p) { g.price = e.target.dataset.p; render(); } };
$('speed').onclick = e => { if (e.target.dataset.s) setSpeed(+e.target.dataset.s); };
addEventListener('keydown', e => { if (e.code === 'Space' && g && !g.over) { e.preventDefault(); setSpeed(speed ? 0 : 1); } });
$('start').onclick = () => start(Date.now());

function loop(t) {
  if (g && speed && !g.over) { acc += (t - last) * speed; let n = 0; while (acc > 1000) { acc -= 1000; step(); n++; } if (n) render(); }
  else acc = 0;
  last = t; requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

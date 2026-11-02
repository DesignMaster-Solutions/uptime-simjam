// The back room, drawn from the same state the cards show: window (hour, heat wave), rack (load, failures),
// cooling units and the thermometer. Built once per structure change so the CSS animations keep running.
import { load, DAYS } from './sim.js';

const SKY = [[0, '#0b1630'], [5, '#18234a'], [6.5, '#e08a5a'], [8, '#7fb4dd'], [12, '#8cc8f0'], [17, '#7fb4dd'],
  [18.5, '#e07a4a'], [20, '#2a2350'], [24, '#0b1630']];
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t)).join(',')})`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function skyAt(h) {
  const i = SKY.findIndex(([k]) => k > h);
  const [h0, c0] = SKY[i - 1], [h1, c1] = SKY[i];
  return mix(c0, c1, (h - h0) / (h1 - h0));
}
const TOP = 34, BOTTOM = 168; // thermometer tube, 16°C at the bottom, 40°C at the top
const tempY = t => BOTTOM - ((clamp(t, 16, 40) - 16) / 24) * (BOTTOM - TOP);

export function mountScene(el) {
  el.innerHTML = `<svg viewBox="0 0 960 200" role="img" aria-label="The back room: window, rack, cooling units and thermometer">
  <rect id="wall" width="960" height="200"/>
  <rect y="182" width="960" height="18" fill="#070d10"/>
  <g transform="translate(26 26)">
    <rect id="sky" width="160" height="112" rx="3"/>
    <g id="stars" fill="#dfe8ff"><circle cx="20" cy="18" r="1.2"/><circle cx="60" cy="10" r="1"/><circle cx="104" cy="24" r="1.3"/>
      <circle cx="140" cy="12" r="1"/><circle cx="36" cy="44" r="1"/><circle cx="122" cy="52" r="1.1"/></g>
    <circle id="sun" r="11"/>
    <rect id="haze" width="160" height="112" rx="3" fill="#ff7a2a"/>
    <path d="M0 78 L22 64 L40 72 L64 52 L88 70 L110 60 L134 74 L160 62 L160 112 L0 112Z" fill="#0d1a20" opacity=".85"/>
    <rect width="160" height="112" rx="3" fill="none" stroke="#2c4954" stroke-width="5"/>
    <path d="M80 0 V112 M0 56 H160" stroke="#2c4954" stroke-width="3"/>
    <text id="waveTxt" x="80" y="104" text-anchor="middle" class="tag hot">HEAT WAVE</text>
  </g>
  <g transform="translate(236 10)">
    <rect width="296" height="172" rx="6" fill="#0a1114" stroke="#28414b" stroke-width="3"/>
    <text x="148" y="-1" text-anchor="middle" class="tag">RACK · 8U</text>
    <g id="units" transform="translate(10 10)"></g>
  </g>
  <g id="shimmer" transform="translate(236 0)"><path d="M30 46 q12 -9 24 0 t24 0 t24 0 t24 0"/>
    <path d="M150 96 q12 -9 24 0 t24 0 t24 0 t24 0"/><path d="M60 146 q12 -9 24 0 t24 0 t24 0 t24 0"/></g>
  <g id="coolers" transform="translate(560 30)"></g>
  <g transform="translate(838 0)">
    <rect x="-1" y="${TOP - 6}" width="18" height="${BOTTOM - TOP + 12}" rx="9" fill="#0a1114" stroke="#2c4954" stroke-width="2"/>
    <rect id="merc" x="4" width="8" rx="4"/>
    <circle cx="8" cy="${BOTTOM + 9}" r="10" id="bulb"/>
    <path d="M-6 ${tempY(31)} H22" stroke="#ff5d5d" stroke-width="2" stroke-dasharray="3 2"/>
    <text x="26" y="${tempY(31) + 4}" class="tag hot">31°</text>
    <text id="temp" x="8" y="${TOP - 12}" text-anchor="middle" class="big"></text>
  </g>
  <g transform="translate(888 64)"><rect width="56" height="62" rx="4" fill="#efe3a8"/>
    <text x="28" y="22" text-anchor="middle" class="note">DAY</text><text id="noteDay" x="28" y="46" text-anchor="middle" class="note big"></text></g>
  </svg><div id="toast"></div>`;
  el.dataset.key = '';
}

function units(g) {
  return Array.from({ length: 8 }, (_, i) => {
    const s = g.servers[i], y = i * 19.5;
    if (!s) return `<g transform="translate(0 ${y})"><rect width="276" height="16" rx="2" fill="#141c20"/>
      <circle cx="7" cy="8" r="1.6" fill="#2a363b"/><circle cx="269" cy="8" r="1.6" fill="#2a363b"/></g>`;
    const down = s.down > 0, leds = Array.from({ length: 2 + 2 * s.tier }, (_, k) =>
      `<rect class="led" data-u="${i}" x="${232 - k * 7}" y="5" width="4" height="6" rx="1" style="animation-delay:-${(k * 0.37) % 1}s"/>`).join('');
    return `<g transform="translate(0 ${y})" class="unit ${down ? 'down' : ''}" data-u="${i}">
      <rect width="276" height="16" rx="2" class="face"/>
      <text x="8" y="12" class="lbl">SRV-${i + 1}</text><text x="52" y="12" class="lbl dim">T${s.tier}</text>
      <rect x="72" y="6" width="96" height="4" rx="2" fill="#071014"/><rect class="bar" x="72" y="6" height="4" rx="2"/>
      ${down ? `<text x="200" y="12" class="lbl bad" text-anchor="middle">${s.fixing ? 'REPAIRING' : 'DOWN'}</text>
        <g class="smoke"><circle cx="250" cy="0" r="5"/><circle cx="258" cy="-4" r="4"/><circle cx="244" cy="-6" r="3.5"/></g>` : leds}
    </g>`;
  }).join('');
}

function coolers(g) {
  return Array.from({ length: g.cooling }, (_, k) => `<g transform="translate(${(k % 3) * 82} ${Math.floor(k / 3) * 70})">
    <rect width="70" height="56" rx="5" fill="#cfd8d6"/><rect x="4" y="4" width="62" height="48" rx="4" fill="#9fb0ad"/>
    <circle cx="35" cy="28" r="20" fill="#24343a"/>
    <g class="fan" transform="translate(35 28)"><path d="M0 0 L4 -17 L-4 -17Z M0 0 L16 9 L11 15Z M0 0 L-16 9 L-11 15Z" fill="#8aa4a0"/>
      <circle r="3.5" fill="#cfd8d6"/></g></g>`).join('');
}

export function drawScene(el, g) {
  const key = g.servers.map(s => `${s.tier}${s.down > 0 ? (s.fixing ? 'f' : 'd') : 'u'}`).join('') + '|' + g.cooling;
  if (el.dataset.key !== key) {
    el.querySelector('#units').innerHTML = units(g);
    el.querySelector('#coolers').innerHTML = coolers(g);
    el.dataset.key = key;
  }
  const hot = clamp((g.room - 24) / 10, 0, 1), h = g.hour;
  el.querySelector('#wall').setAttribute('fill', mix('#13232b', '#3b1714', hot));
  el.querySelector('#sky').setAttribute('fill', skyAt(h));
  el.querySelector('#stars').setAttribute('opacity', h < 5 || h > 20 ? 1 : 0);
  const day = h >= 6 && h <= 19, p = day ? (h - 6) / 13 : ((h + 4) % 24) / 9; // sun 06-19h, moon 20-05h
  const sun = el.querySelector('#sun');
  sun.setAttribute('cx', 18 + 124 * p);
  sun.setAttribute('cy', 70 - 52 * Math.sin(p * Math.PI));
  sun.setAttribute('fill', day ? '#ffd76b' : '#e8eefc');
  el.querySelector('#haze').setAttribute('opacity', g.heatWave > 0 && day ? 0.28 : 0);
  el.querySelector('#waveTxt').setAttribute('opacity', g.heatWave > 0 ? 1 : 0);
  el.querySelector('#shimmer').setAttribute('opacity', clamp((g.room - 28) / 4, 0, 1));
  const color = g.room > 31 ? '#ff5d5d' : g.room > 28 ? '#ffb547' : '#3ddc97', y = tempY(g.room);
  const merc = el.querySelector('#merc'); merc.setAttribute('y', y); merc.setAttribute('height', BOTTOM + 4 - y); merc.setAttribute('fill', color);
  el.querySelector('#bulb').setAttribute('fill', color);
  el.querySelector('#temp').textContent = `${g.room.toFixed(1)}°C`;
  el.querySelector('#noteDay').textContent = `${Math.min(g.day, DAYS)}`;
  g.servers.forEach((s, i) => {
    if (s.down > 0) return;
    const l = load(g, s.id), c = l > 1 ? '#ff5d5d' : l > 0.8 ? '#ffb547' : '#3ddc97';
    const bar = el.querySelector(`.unit[data-u="${i}"] .bar`);
    if (bar) { bar.setAttribute('width', 96 * clamp(l, 0, 1)); bar.setAttribute('fill', c); }
    for (const led of el.querySelectorAll(`.led[data-u="${i}"]`)) {
      led.style.fill = c; led.style.animationDuration = `${clamp(1.6 - l, 0.12, 1.6).toFixed(2)}s`;
    }
  });
  const fanSpin = `${clamp(1.2 - (g.room - 22) / 12, 0.18, 1.2).toFixed(2)}s`;
  for (const f of el.querySelectorAll('.fan')) f.style.animationDuration = fanSpin;
}

// Short-lived feedback over the room: money at the end of the day, a jolt when a server dies.
export function toast(el, text, kind) {
  const t = el.querySelector('#toast'); t.textContent = text; t.className = '';
  void t.offsetWidth; t.className = `show ${kind}`;
}
export function jolt(el) { el.classList.remove('jolt'); void el.offsetWidth; el.classList.add('jolt'); }

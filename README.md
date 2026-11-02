# Uptime: one rack, sixty days

A small management sim made for the Game Gauntlet SIM Jam 2026 (theme: SIMULATION).

You run a tiny web host out of one rack in a back room. Small businesses pay by the day to keep their sites up.
Traffic follows the day, busy servers heat the room, hot rooms kill servers, dead servers take sites down,
unhappy sites cancel, cancellations cost reputation, and reputation is what brings new sign-ups. Survive 60 days.

The top of the screen is the back room itself, drawn from the same numbers: the window follows the hour and the heat wave,
each server's lights blink faster as it fills, a dead one smokes, the cooling fans spin up as the room warms and the
thermometer has the 31°C line where servers start to die.

![Day 30, heat wave: the room at 41.9°C, two servers repairing, six cooling units flat out](docs/s4.png)

![A DDoS on the Choir site: its server at 113%, the tip explains the null-route button](docs/s5.png)

**Play:** https://designmaster-solutions.github.io/uptime-simjam/ (browser, no install)

## Controls
- Click a site chip, then click a server to move it.
- Rack a server ($60), upgrade it (T2/T3: double/triple capacity, more heat), add cooling ($45), repair a dead server ($40, 6 h).
- Price per site per day: $2 grows fast, $5 grows slow and wears patience. Space pauses.
- **Viral**: a site gets triple traffic for 12 hours. Keep its server under 100% for most of it and the owner pays a $25 thank-you; let it crash and reputation drops.
- **DDoS**: eight times the traffic for 4 hours. **Null-route** it from its server card: its neighbours stay fast and only that site goes dark until the attack ends.
- A tip pops up (and pauses) the first time each situation happens; "No more tips" turns them off.
- **Uptime** in the top bar is the share of site-hours spent on a running server; the end screen shows it with the score.
- **Today's rack**: everyone who opens the shop on the same UTC day gets the same sixty days (same seed, same events), so results are comparable. **Copy result** puts a one-line summary on the clipboard; **Random rack** starts a fresh seed.
- `?ff=12` skips to day 13 with the balance bot at the controls (`&quiet` hides the tips).

## How it is built
Plain HTML/CSS/JS, no engine. `sim.js` is the whole model with no DOM, so it is tested with `npm test`
and balanced with `node tests/bot.mjs` (a simple sensible player survives most seeds; an idle player does not).

## AI disclosure
Code and text were written with AI assistance (Claude) and reviewed by me. No AI-generated art, music or voice:
the look is CSS and the sounds are synthesized with the Web Audio API at runtime.

MIT License · Design Master Solutions

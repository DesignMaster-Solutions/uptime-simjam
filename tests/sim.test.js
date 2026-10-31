import test from 'node:test'; import assert from 'node:assert/strict';
import { newGame, tick, addServer, load, move, CAP } from '../sim.js';

test('overloaded server makes sites unhappy, rebalancing fixes it', () => {
  const g = newGame(7); g.rand = () => 0.99; // no events, no arrivals, no failures
  for (const s of g.sites) s.base = CAP; // two huge sites on one server
  tick(g); const sad = g.sites[0].mood; assert.ok(sad < 80, 'mood should drop under overload');
  g.cash = 999; addServer(g); move(g, g.sites[1].id, g.servers[1].id);
  for (const s of g.sites) s.base = 40;
  assert.ok(load(g, g.servers[0].id) <= 1 && load(g, g.servers[1].id) <= 1);
  tick(g); assert.ok(g.sites[0].mood > sad - 3);
});

test('a day closes with income minus costs, and bankruptcy ends the game', () => {
  const g = newGame(3); g.rand = () => 0.99; const cash = g.cash;
  for (let i = 0; i < 16; i++) tick(g);
  assert.equal(g.day, 2); assert.equal(g.cash, cash + 2 * 3 - 1.5 - 2);
  g.cash = -500; for (let i = 0; i < 24; i++) tick(g);
  assert.equal(g.over, 'bankrupt');
});

test('hot room kills servers', () => {
  const g = newGame(5); g.rand = () => 0.0001; g.room = 45; g.cooling = 0;
  tick(g); assert.ok(g.servers[0].down > 0);
});

import { uptime, dailySeed } from '../sim.js';

test('uptime is the share of site-hours spent on a running server', () => {
  const g = newGame(11); g.rand = () => 0.99;
  tick(g); assert.equal(uptime(g), 1);
  g.servers[0].down = 5; g.servers[0].fixing = false; tick(g);
  assert.equal(uptime(g), 0.5);
});

test('daily seed is one number per UTC day', () => {
  assert.equal(dailySeed(new Date('2026-10-31T03:00:00Z')), 20261031);
  assert.equal(dailySeed(new Date('2026-10-31T23:59:59Z')), 20261031);
  assert.equal(dailySeed(new Date('2026-11-01T00:00:00Z')), 20261101);
});

test('the same seed replays the same days when the player does the same thing', () => {
  const a = newGame(20261031), b = newGame(20261031);
  for (let i = 0; i < 24 * 10; i++) { tick(a); tick(b); }
  assert.deepEqual(a.log, b.log); assert.equal(a.cash, b.cash); assert.equal(a.seed, 20261031);
});

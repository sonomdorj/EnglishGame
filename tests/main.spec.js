// End-to-end tests for main.js: keys, interaction, Family Book, save, letters, lost things, day/night.
import { test, expect } from '@playwright/test';
import { openGame, drain, faceNpc, sleep } from './helpers.js';

// Opens the game with no case running, so nothing else talks.
async function quietGame(page, opts) {
  const problems = await openGame(page, opts);
  await page.evaluate(() => { game.dialog.clear(); game.state.introDone = true; game.quest.stage = 'done'; game.dayNight.t = 60; });
  return problems;
}

// Stand `dist` meters from a point (on the side toward `from`) and look at it.
async function lookAtPoint(page, p, from, dist = 1.2) {
  await page.evaluate(({ p, from, dist }) => {
    const dx = from.x - p.x, dz = from.z - p.z, len = Math.hypot(dx, dz) || 1;
    const x = p.x + dx / len * dist, z = p.z + dz / len * dist;
    game.teleportPlayer({ x, y: 0, z, yaw: Math.atan2(-(p.x - x), -(p.z - z)) });
    game.pitch = Math.atan2(p.y - 1.6, dist);
  }, { p, from, dist });
}

async function key(page, code) {
  await page.keyboard.press(code);
  await sleep(80);
}

test('talking to a villager: introduction first, then "hello again"', async ({ page }) => {
  const problems = await quietGame(page);
  await faceNpc(page, 'oyunaa');
  await key(page, 'KeyE');
  const intro = await page.evaluate(() => game.villagerData.oyunaa.lines.intro.map(l => l.text));
  expect(await page.evaluate(() => game.dialog.current.text)).toBe(intro[0]);
  expect(await page.evaluate(() => game.state.met)).toEqual(['oyunaa']);
  expect(await page.textContent('#dialog .d-name')).toBe(await page.evaluate(() => game.villagerData.oyunaa.name));
  await drain(page);
  await faceNpc(page, 'oyunaa');
  await key(page, 'KeyE');
  const again = await page.evaluate(() => game.villagerData.oyunaa.lines.again[0].text);
  expect(await page.evaluate(() => game.dialog.current.text)).toBe(again);
  await drain(page);
  expect(problems).toEqual([]);
});

test('hint text tells what E does', async ({ page }) => {
  const problems = await quietGame(page);
  await faceNpc(page, 'batbayar');
  await page.waitForFunction(() => !document.getElementById('hint').hidden);
  expect(await page.textContent('#hint')).toBe('E to talk');
  await page.evaluate(() => game.teleportPlayer({ x: 30, y: 0, z: 0, yaw: 0 }));
  await page.waitForFunction(() => document.getElementById('hint').hidden);
  expect(problems).toEqual([]);
});

test('Family Book: B opens it, B and Esc close it, the player cannot walk while it is open', async ({ page }) => {
  const problems = await quietGame(page);
  await key(page, 'KeyB');
  expect(await page.isVisible('#book')).toBe(true);
  expect(await page.textContent('#book')).toContain('You have not met anyone yet');
  // Frozen: W does not move the player.
  const z0 = await page.evaluate(() => game.player.pos.z);
  await page.keyboard.down('KeyW'); await sleep(600); await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => game.player.pos.z)).toBe(z0);
  await key(page, 'KeyB');
  expect(await page.isVisible('#book')).toBe(false);
  // Meet someone, then the book lists them.
  await faceNpc(page, 'tsetseg');
  await key(page, 'KeyE');
  await drain(page);
  await key(page, 'KeyB');
  const name = await page.evaluate(() => game.villagerData.tsetseg.name);
  expect(await page.textContent('#book .pname')).toBe(name);
  expect(await page.textContent('#book')).toContain('Not met yet: 5 people.');
  await key(page, 'Escape');
  expect(await page.isVisible('#book')).toBe(false);
  expect(problems).toEqual([]);
});

test('W walks forward, Shift runs faster; nothing moves while a dialog is open', async ({ page }) => {
  const problems = await quietGame(page);
  // Meters per game second while the key is held (the test browser has a low frame rate). Forward = -z.
  const walk = async (ms, shift) => {
    if (shift) await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => game.player.vel.z < -1);
    const start = await page.evaluate(() => ({ z: game.player.pos.z, c: game.clock }));
    await sleep(ms);
    const end = await page.evaluate(() => ({ z: game.player.pos.z, c: game.clock }));
    await page.keyboard.up('KeyW');
    if (shift) await page.keyboard.up('ShiftLeft');
    await page.waitForFunction(() => game.player.vel.z === 0);
    return (start.z - end.z) / (end.c - start.c);
  };
  const walkSpeed = await walk(1000, false);
  const runSpeed = await walk(1000, true);
  console.log(`walk ${walkSpeed.toFixed(2)} m/s, run ${runSpeed.toFixed(2)} m/s`);
  expect(walkSpeed).toBeCloseTo(4.0, 0);
  expect(runSpeed).toBeCloseTo(7.0, 0);
  await page.evaluate(() => game.dialog.say([game.buuLines.wait]));
  const z0 = await page.evaluate(() => game.player.pos.z);
  await page.keyboard.down('KeyW'); await sleep(500); await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => game.player.pos.z)).toBe(z0);
  // Space goes to the next line (and does not jump).
  await key(page, 'Space');
  expect(await page.evaluate(() => game.dialog.open)).toBe(false);
  expect(problems).toEqual([]);
});

test('Space jumps', async ({ page }) => {
  const problems = await quietGame(page);
  // Record the highest point often, so a slow frame rate cannot hide the jump.
  await page.evaluate(() => { game.maxY = 0; setInterval(() => { game.maxY = Math.max(game.maxY, game.player.pos.y); }, 5); });
  await page.waitForFunction(() => game.player.onGround);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => game.maxY > 0.3, null, { timeout: 20000 });
  await page.waitForFunction(() => game.player.onGround && game.player.pos.y === 0, null, { timeout: 20000 });
  const top = await page.evaluate(() => game.maxY);
  expect(top).toBeLessThan(0.9); // jumpSpeed 5.5, gravity 18: peak 0.84 m
  expect(problems).toEqual([]);
});

test('lost thing: E picks it up, Buu names it, it is counted and saved', async ({ page }) => {
  const problems = await quietGame(page);
  const p = await page.evaluate(() => { const it = game.world.items.find(i => i.name === 'key'); const v = it.group.position; return { x: v.x, y: v.y + 0.1, z: v.z }; });
  await lookAtPoint(page, p, { x: p.x, z: p.z + 5 }, 1.3);
  await page.waitForFunction(() => game.lookingAt?.kind === 'item' && game.lookingAt.name === 'key', null, { timeout: 20000 });
  expect(await page.textContent('#hint')).toBe('E to pick up');
  await key(page, 'KeyE');
  expect(await page.evaluate(() => game.dialog.current.text)).toBe(await page.evaluate(() => game.buuLines.lost.key.text));
  await key(page, 'Space');
  expect(await page.evaluate(() => game.dialog.current.text)).toBe('You have 1 of 12 things.');
  await drain(page);
  expect(await page.evaluate(() => game.state.found)).toEqual(['key']);
  expect(await page.evaluate(() => game.world.items.find(i => i.name === 'key').group.visible)).toBe(false);
  // Reload: still found and still hidden.
  await page.reload();
  await page.waitForFunction(() => window.game && window.game.ready, null, { timeout: 60000 });
  expect(await page.evaluate(() => game.state.found)).toEqual(['key']);
  expect(await page.evaluate(() => game.world.items.find(i => i.name === 'key').group.visible)).toBe(false);
  expect(problems).toEqual([]);
});

test('letters: "read it at night" in the day; read at night and counted', async ({ page }) => {
  const problems = await quietGame(page);
  const target = await page.evaluate(() => {
    const l = game.world.letters.find(x => x.houseId === 'h1');
    const v = l.mesh.position, h = game.houseById.h1;
    return { p: { x: v.x, y: v.y, z: v.z }, from: { x: h.door.x, z: h.door.z } };
  });
  await lookAtPoint(page, target.p, target.from, 1.1);
  await page.waitForFunction(() => game.lookingAt?.kind === 'letter', null, { timeout: 20000 });
  expect(await page.textContent('#hint')).toBe('E to read');
  await key(page, 'KeyE');
  expect(await page.evaluate(() => game.dialog.current.text)).toBe('Read it at night. Not now.');
  await drain(page);
  expect(await page.evaluate(() => game.state.lettersRead)).toEqual([]);
  // Night.
  await page.evaluate(() => { game.dayNight.t = 260; });
  await page.waitForFunction(() => game.dialog.open && game.dialog.current.text === game.buuLines.night.text, null, { timeout: 10000 });
  await drain(page);
  await lookAtPoint(page, target.p, target.from, 1.1);
  await page.waitForFunction(() => game.lookingAt?.kind === 'letter', null, { timeout: 20000 });
  await key(page, 'KeyE');
  const lines = await page.evaluate(() => game.letters.h1.map(l => l.text));
  expect(await page.evaluate(() => game.dialog.current.text)).toBe(lines[0]);
  expect(await page.textContent('#dialog .d-name')).toBe('Letter');
  await drain(page);
  expect(await page.evaluate(() => game.state.lettersRead)).toEqual(['h1']);
  expect(problems).toEqual([]);
});

test('Buu says when night starts and when morning comes', async ({ page }) => {
  const problems = await quietGame(page);
  await page.evaluate(() => { game.dayNight.t = 239.9; });
  await page.waitForFunction(() => game.dialog.open, null, { timeout: 10000 });
  expect(await page.evaluate(() => game.dialog.current.text)).toBe('It is night now. Be quiet.');
  await drain(page);
  // Move the player away from the headmaster's road, then end the night.
  await page.evaluate(() => { game.teleportPlayer({ x: -40, y: 0, z: 40, yaw: 0 }); game.dayNight.t = 359.9; });
  await page.waitForFunction(() => game.dialog.open && !game.dayNight.isNight, null, { timeout: 10000 });
  expect(await page.evaluate(() => game.dialog.current.text)).toBe('Morning. The headmaster is home now.');
  await drain(page);
  expect(problems).toEqual([]);
});

test('F (trap): Buu said a wrong weekday; the right answer catches him', async ({ page }) => {
  const problems = await openGame(page);
  await page.evaluate(() => { game.state.introDone = true; game.dialog.clear(); game.quest.stage = 'idle'; game.quest.timer = 0; });
  await page.waitForFunction(() => game.quest.stage === 'toA');
  await drain(page);
  const trap = await page.evaluate(() => game.quest.q.trap);
  await key(page, 'KeyF');
  expect(await page.isVisible('#picker')).toBe(true);
  expect(await page.textContent('#picker .p-title')).toBe(trap.date);
  // Number keys pick an answer: 1 = Monday ... 7 = Sunday.
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const wrong = days.find(d => d !== trap.weekday);
  await key(page, String(days.indexOf(wrong) + 1));
  expect(await page.evaluate(() => game.dialog.current.text)).toBe('No.');
  await key(page, String(days.indexOf(trap.weekday) + 1));
  expect(await page.evaluate(() => game.dialog.current.text)).toBe('You are right. I am a silly panda.');
  expect(await page.isVisible('#picker')).toBe(false);
  await drain(page);
  await key(page, 'KeyF');
  expect(await page.evaluate(() => game.dialog.current.text)).toBe(await page.evaluate(() => game.buuLines.caughtAlready.text));
  await drain(page);
  expect(problems).toEqual([]);
});

test('Esc closes the weekday panel; E on Buu opens it again', async ({ page }) => {
  const problems = await openGame(page);
  const { waitStage, faceBuu } = await import('./helpers.js');
  await page.evaluate(() => { game.dayNight.t = 60; });
  await waitStage(page, 'toA');
  const q = await page.evaluate(() => game.quest.q);
  await faceNpc(page, q.a); await key(page, 'KeyE'); await waitStage(page, 'toB');
  await faceNpc(page, q.b); await key(page, 'KeyE'); await drain(page);
  await page.waitForFunction(() => game.picker.isOpen);
  await key(page, 'Escape');
  expect(await page.evaluate(() => game.picker.isOpen)).toBe(false);
  await faceBuu(page);
  await key(page, 'KeyE');
  await drain(page);
  await page.waitForFunction(() => game.picker.isOpen, null, { timeout: 10000 });
  expect(await page.evaluate(() => game.quest.stage)).toBe('ask');
  expect(problems).toEqual([]);
});

test('a warm light turns on inside a house', async ({ page }) => {
  const problems = await quietGame(page);
  expect(await page.evaluate(() => game.roomLight.intensity)).toBe(0);
  await page.evaluate(() => { const h = game.houseById.h4; game.teleportPlayer({ x: h.x, y: 0, z: h.z + 2, yaw: 0 }); });
  await page.waitForFunction(() => game.roomLight.intensity > 0);
  expect(await page.evaluate(() => game.roomLight.intensity)).toBeGreaterThanOrEqual(3);
  expect(problems).toEqual([]);
});

test('progress is saved and restored after a reload', async ({ page }) => {
  const problems = await quietGame(page);
  await faceNpc(page, 'ganbold');
  await key(page, 'KeyE');
  await drain(page);
  await page.evaluate(() => { game.state.questsDone = 3; game.persist(); });
  await page.reload();
  await page.waitForFunction(() => window.game && window.game.ready, null, { timeout: 60000 });
  const s = await page.evaluate(() => game.state);
  expect(s.met).toEqual(['ganbold']);
  expect(s.questsDone).toBe(3);
  expect(s.introDone).toBe(true);
  expect(problems).toEqual([]);
});

test('a panel closed before the mouse unlock event arrives does not pause the game', async ({ page }) => {
  const problems = await quietGame(page);
  await page.waitForFunction(() => !!document.pointerLockElement, null, { timeout: 10000 });
  // Open and close in one step: the pointerlockchange event comes after the panel is closed.
  await page.evaluate(() => { game.openPanel(() => game.picker.open({ title: 't', options: ['a'] })); game.picker.close(); });
  await page.waitForFunction(() => !document.pointerLockElement);
  await sleep(300);
  expect(await page.evaluate(() => game.paused)).toBe(false);
  expect(await page.isVisible('#start')).toBe(false);
  // Esc (the browser frees the mouse, not the game) still pauses.
  await page.mouse.click(400, 225);
  await page.waitForFunction(() => !!document.pointerLockElement, null, { timeout: 10000 });
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => game.paused === true, null, { timeout: 5000 });
  expect(await page.isVisible('#start')).toBe(true);
  expect(problems).toEqual([]);
});

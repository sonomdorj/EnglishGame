# PLAN.md — "The Name Keeper" (English learning game, personal use)

## Rules for the agent
- Never ask the user a question. Decide yourself. Log every decision in DECISIONS.md.
- Work top to bottom. Change `[ ]` to `[x]` when an item is done and tested.
- After each item: run `npx serve . -l 3010`, open http://localhost:3010 in the browser tool, play 1 minute, fix bugs, then continue. Port 3000 is taken. Never use it.
- Stop only when every box is ticked.
- Stack: Three.js (CDN), plain JS modules, no framework, no backend, no build step.
- All in-game text is English only. Never show Mongolian or any translation.
- Every spoken line uses `window.speechSynthesis`, voice en-US, rate 0.85.
- Player: 10 years old, introvert. No timers, no fail screens, no scores shown, no cute praise. Buu the panda is dry: "Correct. Next."

## Day 1 — World
- [x] `index.html` + `main.js`. Three.js scene, sky, flat voxel ground 64x64, blocky trees, dirt path.
- [x] First-person player: WASD + mouse look (pointer lock), jump, collision with houses.
- [x] 6 voxel houses, each a different roof color. Sign on each door with the owner's full name from `villagers.json`.
- [x] Panda NPC "Buu": black-and-white voxel panda, follows 3 blocks behind the player, idles when close.
- [x] Crosshair + "E to talk" hint when facing a villager or Buu.

## Day 2 — People and dialog
- [x] `villagers.json`: 6 villagers, each with: id, full name, house id, job, birthday (day-month-year), father, mother, children (ids). Use real Mongolian names, e.g. Batbayar Sonomdorj (blacksmith), Dulamsuren Tsogt (baker), Oyunaa Batbayar (Batbayar's daughter), Enkhjargal Dorj (farmer), Tsetseg Nyamdorj (teacher), Ganbold Erdene (fisherman). Give each a father and mother name too.
- [x] Villager NPCs: simple voxel humans standing near their house, name floating above head.
- [x] Dialog box at bottom of screen: big text, one sentence at a time, Space = next. Every line spoken by TTS when shown.
- [x] Buu dialog: dry, short. Max 8 words per line.

## Day 3 — Date engine and Judge quests
- [x] `dates.js`: weekday for any date 1 Jan 1900 – 31 Dec 2099. Unit test 20 known dates in `test_dates.html`. Must be 100% correct.
- [x] `quests.json`: 15 Judge quests. Format per quest: villager A claim, villager B claim, the real date, the correct weekday, the lie-teller, penalty item, 3–5 new English words. Example: Dulamsuren says "Batbayar paid me on Friday, 17 November 2017." Batbayar says "No. I paid on Thursday." Real: Friday. Liar: Batbayar. Penalty: 10 iron.
- [x] Quest flow: Buu announces → walk to villager A → hear claim → walk to villager B → hear claim → Buu asks "Which day was 17 November 2017?" → player clicks one of 7 weekday buttons → Buu says verdict → player takes penalty item from the liar (press E) → Buu: "Correct. Next."
- [x] Wrong weekday click: Buu says "No. Look again." Player clicks again. No limit, no penalty.
- [x] Buu "date trap": in every quest Buu states one date with the WRONG weekday on purpose. Player can press F to correct Buu. If correct, Buu says "You are right. I am a silly panda."

## Day 4 — Learning engine and save
- [x] Word list `words.json`: 300 words grouped by level 1–10. Each quest's new words come from the current level.
- [x] Adaptive rules in `learn.js`: 5 correct in a row → level +1. 2 wrong in a row → level -1 (min 1) and next quest reuses only known words. Never show the level to the player.
- [x] Family Book screen (key B): list of villagers met, their father, mother, children, birthday with weekday. Fills in as the player meets people.
- [x] Save in localStorage: quests done, level, villagers met. Wrap all reads/writes in try/catch.
- [x] Settings in `config.js`: TTS rate, mouse sensitivity, Buu follow distance.

## Day 5 — Polish and stealth (only if Days 1–4 are ticked)
- [x] Play all 15 quests start to finish in the browser tool. Fix every bug found.
- [x] Headmaster NPC "Batsaikhan Erdene": patrols 3 houses at night. If he sees the player, says one English line and teleports the player to the village gate. No death screen.
- [x] Night cycle: 4 minutes day, 2 minutes night. Letters inside houses can only be read at night.
- [x] Headmaster adaptive rules: caught 3+ times in 5 min → walks slower, sees shorter. 0 catches in 10 min → patrols one more house.
- [x] Write README.md: how to run (`npx serve . -l 3010`), controls, how to add a quest.

## Day 6 — 3D upgrade and bigger village (user request)
- [ ] Smooth 3D style: textured walls, floors, roofs, windows. Real sun shadows, sky, sun, moon. Textures drawn in code.
- [ ] People with faces and joints (walk, blink, breathe, look at player, mouth moves when talking). Round panda Buu.
- [ ] Houses with 2 rooms: kitchen (table, chairs, cabinets, stove, fridge, wall calendar) and bedroom (bed, wardrobe, desk).
- [ ] Bigger village: school, market, well, lake with dock, farm, barn, forge, oven, street lamps, fence, forest, mountains.
- [ ] 12 lost things to find (E). Buu says the English name. Family Book counts them.
- [ ] Shift to run. Wall calendar opens the calendar.
- [ ] Play all 15 quests again in the new world. No console errors.

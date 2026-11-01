# The Name Keeper

A 3D village game for learning English.
You are the judge. Villagers argue about dates. You find the true weekday.
Buu the panda follows you and helps (a little).

## How to run

You need Node.js. In this folder run:

```bash
npx serve . -l 3010
```

Open http://localhost:3010 in Chrome, Safari or Edge.
The page loads Three.js from the internet (jsDelivr CDN), so you need a network connection.
Use a recent Chrome. The game uses real shadows, so an old computer may be slow.

Date engine tests: open http://localhost:3010/test_dates.html

## Voices

Voices are mp3 files made once with OpenAI text-to-speech:

```bash
npm install
OPENAI_API_KEY=your-key node scripts/make_audio.js
```

Run it again after you change any line. It only downloads new lines.

## Tests

```bash
npm install
npx playwright test
```

## Controls

| Key | Action |
| --- | --- |
| W A S D or arrows | Walk |
| Shift | Run |
| Mouse | Look (click the game first) |
| Space | Jump. Next line when a dialog is open |
| R | Replay the last line |
| E | Talk, read a letter, take an item, pick up a thing, give a thing to Buu |
| F | Buu said a wrong weekday. Correct him |
| B | Family Book |
| 1–7 | Pick an answer in an open panel |
| Esc | Close a panel, or free the mouse |

## How a case works

1. Buu says "New case" and names villager A.
2. Talk to A (E). Hear the claim and new words.
3. Talk to villager B. Hear the other claim.
4. Buu asks which weekday the date was. Click one of 7 weekdays.
5. Walk to the liar and press E to take the penalty item.
6. Buu says "Bring me the X". Find the thing on the plaza (E), then give it to Buu (E).
7. Buu: "Correct. Next."

Night comes after 4 minutes and lasts 2 minutes.
At night you can read the letters inside the houses.
The headmaster patrols at night. If he sees you, he sends you back to the gate.

12 lost things are hidden in the village. Find them all. Buu tells you the English name of each one.

## Quests

50 quests in 5 arcs: The Baker's Lie, The Fake Birthday, The Headmaster's Diary, The Wedding War, Buu's Betrayal.
Lines get longer arc by arc (max 3, 5, 7, 10, 12 words).

```bash
node scripts/build_quests.js
node scripts/nicknames.js
node scripts/make_audio.js --ids-only
node scripts/check_quests.js
```

## Report

At the end of every quest the game writes a report entry to the browser's localStorage under the key `report.json`.
To save it as a file, open the browser console on the game page and run:

```js
copy(localStorage.getItem('report.json'))
```

## How to add or change a quest

Do not edit quests.json by hand. Edit the story tables in `scripts/build_quests.js` (ARC1, ARC2_ITEMS, ...), then run the 4 commands in "Quests" above.
`scripts/check_quests.js` must print `OK: all quest rules hold.`

## Files

| File | What it does |
| --- | --- |
| `index.html`, `style.css` | Page and UI |
| `main.js` | Scene, player, Buu, input, game loop |
| `world.js` | Ground, houses with rooms, school, lake, farm, market, trees, collision, lost things |
| `textures.js` | Textures drawn in code (grass, wood, wallpaper, roof tiles) |
| `npc.js` | People with faces and joints, and Buu the panda |
| `dialog.js`, `audio.js`, `audioid.js` | Dialog box and voice files (text appears 1.5 s after the voice) |
| `buu.json` | Every Buu line that is not part of a quest |
| `scripts/make_audio.js` | Makes audio/<id>.mp3 for every line with OpenAI TTS |
| `tests/` | Playwright tests (`npx playwright test`) |
| `quest.js` | Judge quest flow, Buu's date trap, "Bring me the X" |
| `power.js` | Catches per adult, nicknames, market visits and lockout, headmaster bow |
| `grammar.js` | Line length per arc and the grammar gate |
| `scripts/build_quests.js`, `scripts/check_quests.js` | Make and check the 50 quests |
| `dates.js` | Weekday for any date 1900–2099 |
| `learn.js` | Adaptive word level |
| `night.js` | Day/night cycle and the headmaster |
| `ui.js` | Answer panel, Family Book |
| `save.js` | localStorage save |
| `config.js` | Settings: speech rate, mouse sensitivity, Buu distance |
| `villagers.json`, `quests.json`, `words.json`, `letters.json` | Game data |

To start over, clear the site data for localhost:3010 in the browser.

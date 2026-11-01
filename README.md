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
| E | Talk, read a letter, take an item, pick up a lost thing, look at a wall calendar |
| F | Buu said a wrong weekday. Correct him |
| B | Family Book |
| C | Calendar |
| 1–7 | Pick an answer in an open panel |
| Esc | Close a panel, or free the mouse |

## How a case works

1. Buu says "New case" and names villager A.
2. Talk to A (E). Hear the claim and new words.
3. Talk to villager B. Hear the other claim.
4. Buu asks which weekday the date was. Use the calendar. Click a weekday.
5. Walk to the liar and press E to take the penalty item.
6. Word check: listen and click the word you hear.
7. Buu: "Correct. Next."

Night comes after 4 minutes and lasts 2 minutes.
At night you can read the letters inside the houses.
The headmaster patrols at night. If he sees you, he sends you back to the gate.

12 lost things are hidden in the village. Find them all. Buu tells you the English name of each one.

## How to add a quest

Add an object to `quests.json`:

```json
{
  "id": 16,
  "a": "dulamsuren",
  "b": "batbayar",
  "claimA": "Batbayar paid me on Friday, 17 November 2017.",
  "claimB": "No. I paid on Saturday.",
  "date": "17 November 2017",
  "weekday": "Friday",
  "liar": "batbayar",
  "penalty": "10 iron",
  "words": ["pay", "iron", "coin"],
  "trap": { "date": "21 June 2014", "said": "Tuesday", "weekday": "Saturday",
            "line": "Oyunaa was born on Tuesday, 21 June 2014." }
}
```

Rules:

- `a`, `b` and `liar` are villager ids from `villagers.json`.
- `date` must be "day Month year", between 1900 and 2099.
- `weekday` must be the true weekday. Check it in the calendar (C) or with `dates.js`.
- The liar's claim must use a wrong weekday. The other claim uses the true one.
- `words` has 3 to 5 items. The count sets how many new words the case teaches.
  The words themselves come from `words.json` at the player's current level.
- `trap.line` is said by Buu. It must use the wrong weekday `trap.said`. Max 8 words.

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
| `quest.js` | Judge quest flow and Buu's date trap |
| `dates.js` | Weekday for any date 1900–2099 |
| `learn.js` | Adaptive word level |
| `night.js` | Day/night cycle and the headmaster |
| `ui.js` | Calendar, answer panel, Family Book |
| `save.js` | localStorage save |
| `config.js` | Settings: speech rate, mouse sensitivity, Buu distance |
| `villagers.json`, `quests.json`, `words.json`, `letters.json` | Game data |

To start over, clear the site data for localhost:3010 in the browser.

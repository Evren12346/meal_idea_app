# Meal Idea App — Vegetarian

A vegetarian meal finder and lightweight weekly meal planner.

The app now helps with more than random inspiration:

- filter by mood, flavor, max time, and difficulty
- search by meal name or ingredient
- paste pantry ingredients and score meals by what you already have
- save favorite meals locally
- build a 7-day meal plan
- generate a shopping list from planned meals
- open recipe links quickly

How to run

- Open the file in a browser: [meal_idea_app/index.html](meal_idea_app/index.html)
- Or serve locally (recommended) from the `meal_idea_app` folder:

```bash
cd meal_idea_app
python -m http.server 8000
# then open http://localhost:8000
```

Node (API + static server)

Install dependencies and start the server which also exposes `/api/meals`:

```bash
cd meal_idea_app
npm install
npm start
# then open http://localhost:3000
```

Electron (desktop)

Run the app as a desktop application using Electron. Install dev dependencies then run the `desktop` script:

```bash
cd meal_idea_app
npm install
npm run desktop
```

Notes:
- The app will try `/api/meals` first (when running the Node server). When run as a desktop app or served statically the client will fall back to the bundled `meals.json`.
- Favorites, pantry entries, and weekly planner selections are stored locally in the browser or Electron app storage.
- If you want a single packaged desktop binary, use the included `electron-builder` setup.

Packaging (create installers)

This repository includes a basic `electron-builder` configuration and a `dist` npm script to produce installers. From the project root:

```bash
cd meal_idea_app
npm install
npm run dist
```

After the build finishes, generated artifacts will appear in the `dist/` directory. Notes and caveats:
- Building Windows `.nsis` installers or macOS `.dmg` files from Linux may require additional tooling or running the build on the target platform (macOS for `.dmg`).
- For CI packaging or cross-platform builds consider `electron-builder` docs and recommended builders.
- The `dist` script runs `electron-builder` which bundles the app using the `build` section in `package.json`.

Files
- `index.html` — main UI
- `app.js` — planner state, filtering, pantry scoring, favorites, shopping list logic
- `styles.css` — styling
- `meals.json` — bundled meal dataset

You can add more meals by editing `meals.json` with additional entries using the same shape: name, tags, time, difficulty, ingredients, note, and optional recipe URL.

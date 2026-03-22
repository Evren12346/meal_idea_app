const MOODS = [
  'Comforting', 'Adventurous', 'Light', 'Cozy', 'Indulgent', 'Healthy', 'Quick'
];

const FLAVORS = ['Spicy', 'Savory', 'Sweet', 'Sour', 'Smoky', 'Herby', 'Cheesy', 'Umami'];
const PLANNER_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const STORAGE_KEYS = {
  favorites: 'mealIdea.favorites',
  planner: 'mealIdea.planner',
  pantry: 'mealIdea.pantry',
};

let MEALS = [];
const state = {
  favorites: new Set(),
  planner: {},
  activeDay: PLANNER_DAYS[0],
  lastResults: [],
};

function $(id) {
  return document.getElementById(id);
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseTimeToMinutes(value) {
  const match = String(value || '').match(/(\d+)/);
  return match ? Number(match[1]) : 999;
}

function readStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify([...state.favorites]));
  localStorage.setItem(STORAGE_KEYS.planner, JSON.stringify(state.planner));
  localStorage.setItem(STORAGE_KEYS.pantry, $('pantry').value);
}

function loadState() {
  state.favorites = new Set(readStoredJson(STORAGE_KEYS.favorites, []));
  state.planner = readStoredJson(STORAGE_KEYS.planner, {});
  $('pantry').value = localStorage.getItem(STORAGE_KEYS.pantry) || '';
}

function normalizeMeal(meal) {
  return {
    ...meal,
    id: slugify(meal.name),
    tags: Array.isArray(meal.tags) ? meal.tags : [],
    ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
    timeMinutes: parseTimeToMinutes(meal.time),
    recipe: meal.recipe || `https://www.google.com/search?q=${encodeURIComponent(`${meal.name} recipe`)}`,
  };
}

async function loadMeals() {
  try {
    const apiResponse = await fetch('/api/meals');
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      if (Array.isArray(data) && data.length) {
        MEALS = data.map(normalizeMeal);
        return;
      }
    }
  } catch (error) {
    // Ignore and fall back to bundled data.
  }

  try {
    const bundledResponse = await fetch('meals.json');
    if (bundledResponse.ok) {
      const data = await bundledResponse.json();
      if (Array.isArray(data) && data.length) {
        MEALS = data.map(normalizeMeal);
        return;
      }
    }
  } catch (error) {
    // Ignore and fall back to built-in meals.
  }

  MEALS = [
    normalizeMeal({
      name: 'Smashed Chickpea and Avocado Sandwich',
      tags: ['Quick', 'Light', 'Savory'],
      time: '10m',
      diff: 'Easy',
      ingredients: ['chickpeas', 'avocado', 'bread', 'lemon'],
      note: 'Protein-packed and fast.',
    }),
    normalizeMeal({
      name: 'Spicy Peanut Noodles',
      tags: ['Quick', 'Spicy', 'Savory'],
      time: '15m',
      diff: 'Easy',
      ingredients: ['noodles', 'peanut butter', 'soy', 'chili'],
      note: 'Garnish with peanuts.',
    }),
  ];
}

function populateSelect(id, options) {
  const select = $(id);
  select.innerHTML = '';
  const anyOption = document.createElement('option');
  anyOption.value = '';
  anyOption.textContent = 'Any';
  select.appendChild(anyOption);

  options.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function getPantryTerms() {
  return $('pantry').value
    .split(/[,\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function getFilters() {
  return {
    mood: $('mood').value,
    flavor: $('flavor').value,
    maxTime: $('max-time').value ? Number($('max-time').value) : null,
    difficulty: $('difficulty').value,
    query: $('search').value.trim().toLowerCase(),
    pantryOnly: $('pantry-only').checked,
    favoritesOnly: $('favorites-only').checked,
    pantry: getPantryTerms(),
    sortBy: $('sort-by').value,
  };
}

function difficultyRank(value) {
  return value === 'Easy' ? 0 : 1;
}

function buildMealView(meal, filters) {
  const pantryMatches = meal.ingredients.filter((ingredient) =>
    filters.pantry.some((term) => ingredient.toLowerCase().includes(term) || term.includes(ingredient.toLowerCase()))
  );

  const missingIngredients = meal.ingredients.filter((ingredient) => !pantryMatches.includes(ingredient));
  const textBlob = [meal.name, meal.note || '', meal.tags.join(' '), meal.ingredients.join(' ')].join(' ').toLowerCase();
  const queryMatch = !filters.query || textBlob.includes(filters.query);
  const moodMatch = !filters.mood || meal.tags.includes(filters.mood);
  const flavorMatch = !filters.flavor || meal.tags.includes(filters.flavor);
  const timeMatch = !filters.maxTime || meal.timeMinutes <= filters.maxTime;
  const difficultyMatch = !filters.difficulty || meal.diff === filters.difficulty;
  const favoriteMatch = !filters.favoritesOnly || state.favorites.has(meal.id);
  const pantryRatio = meal.ingredients.length ? pantryMatches.length / meal.ingredients.length : 0;
  const pantryEnough = !filters.pantryOnly || pantryRatio >= 0.45 || pantryMatches.length >= 2;

  if (!queryMatch || !moodMatch || !flavorMatch || !timeMatch || !difficultyMatch || !favoriteMatch || !pantryEnough) {
    return null;
  }

  let score = 0;
  if (moodMatch && filters.mood) score += 3;
  if (flavorMatch && filters.flavor) score += 3;
  if (queryMatch && filters.query) score += 2;
  score += pantryMatches.length * 2;
  if (state.favorites.has(meal.id)) score += 1;
  score += Math.max(0, 6 - difficultyRank(meal.diff));
  score += Math.max(0, 60 - meal.timeMinutes) / 30;

  return {
    meal,
    score,
    pantryMatches,
    missingIngredients,
  };
}

function getMealViews(filters = getFilters()) {
  let views = MEALS.map((meal) => buildMealView(meal, filters)).filter(Boolean);

  if (!views.length && (filters.mood || filters.flavor || filters.query || filters.pantryOnly || filters.favoritesOnly)) {
    const relaxedFilters = { ...filters, pantryOnly: false, favoritesOnly: false };
    views = MEALS.map((meal) => buildMealView(meal, relaxedFilters)).filter(Boolean);
  }

  const sortBy = filters.sortBy;
  views.sort((left, right) => {
    if (sortBy === 'quick') return left.meal.timeMinutes - right.meal.timeMinutes || right.score - left.score;
    if (sortBy === 'easy') return difficultyRank(left.meal.diff) - difficultyRank(right.meal.diff) || right.score - left.score;
    if (sortBy === 'name') return left.meal.name.localeCompare(right.meal.name);
    return right.score - left.score || left.meal.timeMinutes - right.meal.timeMinutes;
  });

  return views;
}

function toggleFavorite(mealId) {
  if (state.favorites.has(mealId)) {
    state.favorites.delete(mealId);
  } else {
    state.favorites.add(mealId);
  }
  saveState();
  refreshAll();
}

function assignMealToDay(day, mealId) {
  state.planner[day] = mealId;
  state.activeDay = day;
  saveState();
  refreshAll();
}

function clearDay(day) {
  delete state.planner[day];
  saveState();
  refreshAll();
}

function getMealById(mealId) {
  return MEALS.find((meal) => meal.id === mealId) || null;
}

function renderPlanner() {
  const plannerGrid = $('planner-grid');
  plannerGrid.innerHTML = '';

  PLANNER_DAYS.forEach((day) => {
    const assignedMeal = getMealById(state.planner[day]);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `planner-day${state.activeDay === day ? ' active' : ''}`;
    card.addEventListener('click', () => {
      state.activeDay = day;
      renderPlanner();
      renderResults(state.lastResults);
    });

    const title = document.createElement('strong');
    title.textContent = day;
    card.appendChild(title);

    const mealLine = document.createElement('span');
    mealLine.className = 'planner-meal';
    mealLine.textContent = assignedMeal ? assignedMeal.name : 'Choose a meal below';
    card.appendChild(mealLine);

    if (assignedMeal) {
      const clearButton = document.createElement('span');
      clearButton.className = 'planner-clear';
      clearButton.textContent = 'Clear';
      clearButton.addEventListener('click', (event) => {
        event.stopPropagation();
        clearDay(day);
      });
      card.appendChild(clearButton);
    }

    plannerGrid.appendChild(card);
  });

  const plannedCount = Object.keys(state.planner).length;
  $('planner-summary').textContent = `${plannedCount} / ${PLANNER_DAYS.length} days planned`;
  $('planned-count').textContent = String(plannedCount);
}

function renderFavorites() {
  const favoritesList = $('favorites-list');
  favoritesList.innerHTML = '';

  const favoriteMeals = [...state.favorites]
    .map((mealId) => getMealById(mealId))
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));

  if (!favoriteMeals.length) {
    favoritesList.className = 'mini-list empty-copy';
    favoritesList.textContent = 'No favorites yet.';
  } else {
    favoritesList.className = 'mini-list';
    favoriteMeals.forEach((meal) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'mini-item';
      item.innerHTML = `<strong>${meal.name}</strong><span>${meal.time} - ${meal.diff}</span>`;
      item.addEventListener('click', () => {
        $('search').value = meal.name;
        refreshResults();
      });
      favoritesList.appendChild(item);
    });
  }

  $('favorites-summary').textContent = `${favoriteMeals.length} saved`;
  $('favorite-count').textContent = String(favoriteMeals.length);
}

function renderShoppingList() {
  const shoppingList = $('shopping-list');
  const pantryTerms = getPantryTerms();
  const counts = new Map();

  Object.values(state.planner).forEach((mealId) => {
    const meal = getMealById(mealId);
    if (!meal) return;
    meal.ingredients.forEach((ingredient) => {
      const owned = pantryTerms.some((term) => ingredient.toLowerCase().includes(term) || term.includes(ingredient.toLowerCase()));
      if (owned) return;
      counts.set(ingredient, (counts.get(ingredient) || 0) + 1);
    });
  });

  if (!counts.size) {
    shoppingList.className = 'mini-list empty-copy';
    shoppingList.textContent = 'Plan meals to build a shopping list.';
    return;
  }

  shoppingList.className = 'mini-list';
  shoppingList.innerHTML = '';
  [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([ingredient, count]) => {
    const row = document.createElement('div');
    row.className = 'shopping-row';
    row.innerHTML = `<span>${ingredient}</span><strong>${count}x</strong>`;
    shoppingList.appendChild(row);
  });
}

function renderResults(views) {
  const out = $('results');
  out.innerHTML = '';
  state.lastResults = views;
  $('results-summary').textContent = `${views.length} matches`;

  if (!views.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-results';
    empty.textContent = 'No exact matches. Try relaxing pantry-only mode or broadening your search.';
    out.appendChild(empty);
    return;
  }

  views.slice(0, 12).forEach(({ meal, pantryMatches, missingIngredients, score }) => {
    const card = document.createElement('article');
    card.className = 'meal-card';

    const top = document.createElement('div');
    top.className = 'meal-top';
    top.innerHTML = `
      <div>
        <h3>${meal.name}</h3>
        <p class="meal-meta">${meal.time} - ${meal.diff} - ${meal.tags.join(', ')}</p>
      </div>
      <button type="button" class="favorite-btn${state.favorites.has(meal.id) ? ' active' : ''}" data-favorite="${meal.id}">${state.favorites.has(meal.id) ? 'Saved' : 'Save'}</button>
    `;
    card.appendChild(top);

    const badges = document.createElement('div');
    badges.className = 'badges';
    badges.innerHTML = `
      <span class="badge accent">Match ${Math.round(score)}</span>
      <span class="badge">Pantry ${pantryMatches.length}/${meal.ingredients.length}</span>
      <span class="badge">Planner day ${state.activeDay}</span>
    `;
    card.appendChild(badges);

    const ingredients = document.createElement('div');
    ingredients.className = 'ingredient-groups';
    ingredients.innerHTML = `
      <div>
        <strong>Have</strong>
        <p>${pantryMatches.length ? pantryMatches.join(', ') : 'No pantry matches yet'}</p>
      </div>
      <div>
        <strong>Need</strong>
        <p>${missingIngredients.length ? missingIngredients.join(', ') : 'Nothing extra needed'}</p>
      </div>
    `;
    card.appendChild(ingredients);

    if (meal.note) {
      const note = document.createElement('p');
      note.className = 'meal-note';
      note.textContent = meal.note;
      card.appendChild(note);
    }

    const actions = document.createElement('div');
    actions.className = 'meal-actions';
    actions.innerHTML = `
      <button type="button" class="assign-btn" data-assign="${meal.id}">Add to ${state.activeDay}</button>
      <a class="recipe-link" target="_blank" rel="noreferrer" href="${meal.recipe}">Open recipe</a>
      <a class="ghost-link" target="_blank" rel="noreferrer" href="https://www.google.com/search?q=${encodeURIComponent(meal.name + ' vegetarian recipe')}">More ideas</a>
    `;
    card.appendChild(actions);
    out.appendChild(card);
  });

  out.querySelectorAll('[data-favorite]').forEach((button) => {
    button.addEventListener('click', () => toggleFavorite(button.dataset.favorite));
  });

  out.querySelectorAll('[data-assign]').forEach((button) => {
    button.addEventListener('click', () => assignMealToDay(state.activeDay, button.dataset.assign));
  });
}

function updateStats() {
  $('meal-count').textContent = String(MEALS.length);
}

function refreshResults() {
  const views = getMealViews();
  renderResults(views);
  renderFavorites();
  renderPlanner();
  renderShoppingList();
  updateStats();
  saveState();
}

function refreshAll() {
  refreshResults();
}

function resetFilters() {
  $('mood').value = '';
  $('flavor').value = '';
  $('max-time').value = '';
  $('difficulty').value = '';
  $('search').value = '';
  $('pantry-only').checked = false;
  $('favorites-only').checked = false;
  $('sort-by').value = 'match';
  refreshResults();
}

function runSurprise() {
  $('mood').value = MOODS[Math.floor(Math.random() * MOODS.length)];
  $('flavor').value = FLAVORS[Math.floor(Math.random() * FLAVORS.length)];
  $('sort-by').value = 'match';
  refreshResults();
}

async function copyShoppingList() {
  const rows = [...$('shopping-list').querySelectorAll('.shopping-row')];
  if (!rows.length) return;
  const text = rows.map((row) => row.textContent.trim()).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    $('copy-shopping').textContent = 'Copied';
    setTimeout(() => {
      $('copy-shopping').textContent = 'Copy';
    }, 1200);
  } catch (error) {
    $('copy-shopping').textContent = 'Copy failed';
    setTimeout(() => {
      $('copy-shopping').textContent = 'Copy';
    }, 1200);
  }
}

function bindEvents() {
  $('get').addEventListener('click', refreshResults);
  $('surprise').addEventListener('click', runSurprise);
  $('reset-filters').addEventListener('click', resetFilters);
  $('copy-shopping').addEventListener('click', copyShoppingList);

  ['mood', 'flavor', 'max-time', 'difficulty', 'sort-by'].forEach((id) => {
    $(id).addEventListener('change', refreshResults);
  });

  ['search', 'pantry'].forEach((id) => {
    $(id).addEventListener('input', refreshResults);
  });

  ['pantry-only', 'favorites-only'].forEach((id) => {
    $(id).addEventListener('change', refreshResults);
  });
}

async function init() {
  await loadMeals();
  populateSelect('mood', MOODS);
  populateSelect('flavor', FLAVORS);
  loadState();
  bindEvents();
  renderPlanner();
  refreshResults();
}

window.addEventListener('DOMContentLoaded', init);

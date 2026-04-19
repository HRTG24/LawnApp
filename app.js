const DATA_FILES = {
  profile: "data/profile.json",
  seasonal: "data/seasonal-plan.json",
  inventory: "data/inventory.json",
  purchases: "data/purchase-history.json",
  equipment: "data/equipment.json",
  systems: "data/systems.json",
  zones: "data/zones.json",
  settings: "data/known-settings.json",
  tasks: "data/tasks.json",
  ui: "data/ui-config.json"
};

const state = {
  data: null,
  activeView: "home",
  activeGearCategory: "pre-emergent"
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    state.data = await loadData();
    state.activeGearCategory = state.data.inventory.categories[0]?.id || "pre-emergent";
    hydrateIcons();
    renderApp();
    bindNavigation();
    bindGearCategories();
    showView("home", { focus: false });
  } catch (error) {
    renderLoadError(error);
  }
}

async function loadData() {
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not load ${url}`);
      return [key, await response.json()];
    })
  );
  return Object.fromEntries(entries);
}

function renderApp() {
  const { profile } = state.data;
  document.title = profile.app.name;
  text("#rail-app-name", profile.app.name);
  text("#rail-app-subtitle", profile.app.subtitle);
  text("#top-context", `${profile.property.region} / ${profile.lawn.grassType}`);

  renderNavigation();
  renderHome();
  renderPlan();
  renderGearCategories();
  renderGear();
  renderProperty();
}

function renderNavigation() {
  const nav = state.data.ui.navigation;
  const desktopNav = nav.map((item) => navButton(item, item.label)).join("");
  const mobileNav = nav.map((item) => navButton(item, item.shortLabel || item.label)).join("");
  document.querySelector("#desktop-nav").innerHTML = desktopNav;
  document.querySelector("#bottom-nav").innerHTML = mobileNav;
}

function navButton(item, label) {
  return `
    <button class="nav-item" type="button" data-nav="${item.id}">
      <span class="nav-icon" aria-hidden="true">${icon(item.icon)}</span>
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

function bindNavigation() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.nav));
  });

  document.querySelectorAll("[data-nav-target]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.navTarget));
  });

  document.querySelectorAll("[data-home]").forEach((button) => {
    button.addEventListener("click", () => showView("home"));
  });
}

function bindGearCategories() {
  document.querySelector("#gear-category-strip").addEventListener("click", (event) => {
    const button = event.target.closest("[data-gear-category]");
    if (!button) return;
    state.activeGearCategory = button.dataset.gearCategory;
    renderGearCategories();
    renderGear();
  });
}

function showView(view, options = {}) {
  state.activeView = view;
  document.body.classList.toggle("is-home", view === "home");
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.dataset.view === view);
  });
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === view);
  });
  const navItem = state.data.ui.navigation.find((item) => item.id === view);
  text("#view-title", navItem ? navItem.label : "Outdoor Ops");
  if (options.focus !== false) {
    document.querySelector("#main").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function renderHome() {
  const { profile, inventory, systems } = state.data;
  const season = profile.currentSeason;
  text("#home-window", `${season.window} / ${formatDate(season.asOf)}`);
  text("#home-subtitle", profile.property.operatingGoal);
  text("#launcher-plan-note", season.label);
  text("#launcher-gear-note", `${inventory.categories.length} categories`);
  text("#launcher-property-note", `${systems.systems.length} systems`);
  text("#season-note", `${season.label}: ${concise(season.summary, 105)}`);
}

function renderPlan() {
  const { profile, tasks, seasonal } = state.data;
  const season = profile.currentSeason;
  const nowTasks = tasks.tasks.filter((task) => task.status === "now");
  const nextTasks = tasks.tasks.filter((task) => task.status === "next");
  const buyTasks = tasks.tasks.filter((task) => task.status === "buy-soon" || task.category === "prep / buying");
  const activePhase = seasonal.phases.find((phase) => phase.id === season.phaseId);

  text("#plan-phase-window", season.window);
  text("#plan-phase-title", season.label);
  text("#plan-main-recommendation", nowTasks[0]?.notes || season.summary);

  const support = uniqueById([
    ...nowTasks.slice(0, 2),
    ...buyTasks.slice(0, 1),
    ...profile.weatherAwareness.checks.slice(0, 1).map((check) => ({
      id: `weather-${check.label}`,
      title: check.label,
      timing: check.meaning,
      category: "weather"
    }))
  ]).slice(0, 4);

  document.querySelector("#plan-support-list").innerHTML = support.map((item) => `
    <div class="signal-row">
      <span>${escapeHtml(item.category || "task")}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <small>${escapeHtml(item.timing || item.leadTime || "")}</small>
    </div>
  `).join("");

  document.querySelector("#plan-lookahead-list").innerHTML = [
    ...(activePhase ? [{ title: activePhase.label, meta: activePhase.leadTime, body: activePhase.summary }] : []),
    ...nextTasks.slice(0, 3).map((task) => ({ title: task.title, meta: task.timing, body: task.leadTime }))
  ].map((item) => denseItem(item.title, item.meta, item.body)).join("");
}

function renderGearCategories() {
  const { inventory } = state.data;
  document.querySelector("#gear-category-strip").innerHTML = inventory.categories.map((category) => {
    const count = gearItems(category.id).length;
    return `
      <button class="${category.id === state.activeGearCategory ? "active" : ""}" type="button" data-gear-category="${category.id}">
        <span>${escapeHtml(category.label)}</span>
        <small>${count ? `${count} item${count === 1 ? "" : "s"}` : "empty"}</small>
      </button>
    `;
  }).join("");
}

function renderGear() {
  const { inventory, equipment, settings, purchases } = state.data;
  const category = inventory.categories.find((item) => item.id === state.activeGearCategory) || inventory.categories[0];
  const items = gearItems(category.id);

  document.querySelector("#gear-focus").innerHTML = `
    <div class="gear-head">
      <span class="label">${escapeHtml(category.storeQuestion)}</span>
      <h3>${escapeHtml(category.label)}</h3>
      <p>${escapeHtml(category.defaultTiming)}</p>
    </div>
    <div class="gear-list">
      ${items.map(gearCard).join("") || emptyGear(category)}
    </div>
  `;

  const settingMap = new Map(settings.settings.map((setting) => [setting.id, setting]));
  const equipmentItems = equipment.equipment.map((item) => {
    const linkedSettings = (item.knownSettings || []).map((id) => settingMap.get(id)).filter(Boolean);
    const settingText = linkedSettings.map((setting) => `${setting.label}: ${setting.value}`).join(" / ");
    return denseItem(item.name, item.status, settingText || item.operatingNotes);
  }).join("");

  const generalSettings = settings.settings
    .filter((setting) => !equipment.equipment.some((item) => (item.knownSettings || []).includes(setting.id)))
    .map((setting) => denseItem(setting.label, setting.confidence, setting.value))
    .join("");

  document.querySelector("#gear-equipment-settings").innerHTML = equipmentItems + generalSettings;
  document.querySelector("#gear-purchase-history").innerHTML = purchases.purchases.map((purchase) => `
    <div class="dense-item">
      <strong>${escapeHtml(purchase.vendor)} / ${formatDate(purchase.date)}</strong>
      <span>No private receipt details</span>
      <p>${purchase.items.map((item) => `${item.quantity} x ${escapeHtml(item.name)}`).join(" / ")}</p>
    </div>
  `).join("");
}

function gearCard(item) {
  return `
    <article class="gear-card">
      <header>
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.unitSize || item.coverage || item.category)}</span>
        </div>
        <em>${escapeHtml(item.preferredStatus || item.stockStatus)}</em>
      </header>
      <p>${escapeHtml(item.typicalUse || item.useTiming)}</p>
      <div class="gear-meta">
        <span><b>Last</b>${formatDate(item.lastPurchased)}</span>
        <span><b>Timing</b>${escapeHtml(item.useTiming)}</span>
        <span><b>Setting</b>${escapeHtml(item.spreaderSetting || "Not recorded")}</span>
      </div>
      <small>${escapeHtml(item.shortNote || item.notes)}</small>
    </article>
  `;
}

function emptyGear(category) {
  return `
    <article class="gear-card empty">
      <header>
        <div>
          <strong>No usual item yet</strong>
          <span>${escapeHtml(category.label)}</span>
        </div>
      </header>
      <p>Add a preferred or previously purchased item when this category becomes relevant.</p>
    </article>
  `;
}

function renderProperty() {
  const { systems, tasks, zones, settings } = state.data;
  document.querySelector("#property-systems").innerHTML = systems.systems.map((system) => {
    const linkedTasks = (system.seasonalTasks || [])
      .map((id) => tasks.tasks.find((task) => task.id === id))
      .filter(Boolean);
    return `
      <article class="property-card">
        <header>
          <div>
            <span>${escapeHtml(system.category)}</span>
            <strong>${escapeHtml(system.name)}</strong>
          </div>
          <em>${escapeHtml(system.status)}</em>
        </header>
        <p>${escapeHtml(system.notes[0] || "")}</p>
        <div class="pill-row">
          ${linkedTasks.slice(0, 3).map((task) => `<span>${escapeHtml(task.title)}</span>`).join("")}
        </div>
      </article>
    `;
  }).join("");

  document.querySelector("#property-zones").innerHTML = zones.zones
    .map((zone) => denseItem(zone.name, zone.condition, zone.strategy))
    .join("");

  document.querySelector("#property-lessons").innerHTML = settings.lessonsLearned
    .map((lesson) => `<li>${escapeHtml(lesson)}</li>`)
    .join("");

  document.querySelector("#property-sources").innerHTML = settings.sources
    .map((source) => `<a class="dense-item" href="${escapeHtml(source.url)}" rel="noreferrer"><strong>${escapeHtml(source.label)}</strong><span>Reference</span></a>`)
    .join("");
}

function gearItems(categoryId) {
  return state.data.inventory.items.filter((item) => {
    return item.primaryCategory === categoryId || (item.secondaryCategories || []).includes(categoryId);
  });
}

function denseItem(title, meta, body) {
  return `
    <div class="dense-item">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(meta || "")}</span>
      <p>${escapeHtml(concise(body || "", 130))}</p>
    </div>
  `;
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.id || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hydrateIcons() {
  document.querySelectorAll("[data-icon]").forEach((element) => {
    element.innerHTML = icon(element.dataset.icon);
  });
}

function emptyState(message) {
  return `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function renderLoadError(error) {
  document.querySelector("#main").innerHTML = `
    <section class="error-state">
      <strong>Could not load Outdoor Ops data.</strong>
      <p>${escapeHtml(error.message)}. Run a local static server or publish through GitHub Pages so JSON files can be fetched.</p>
    </section>
  `;
}

function text(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value || "";
}

function concise(value, limit) {
  const textValue = String(value || "");
  if (textValue.length <= limit) return textValue;
  return `${textValue.slice(0, limit - 1).trim()}...`;
}

function formatDate(value) {
  if (!value) return "No date";
  const [year, month, day] = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").map(Number)
    : [];
  const date = year ? new Date(year, month - 1, day) : new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function icon(name) {
  const icons = {
    mark: `<svg viewBox="0 0 24 24"><path d="M4.5 17.5h15"></path><path d="M7 17.5c1.2-5.2 3-8.9 5-12.5 2 3.6 3.8 7.3 5 12.5"></path><path d="M9.2 13.2h5.6"></path></svg>`,
    plan: `<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"></path><path d="M8 9h8M8 13h5"></path><path d="M16 16l3 3"></path></svg>`,
    gear: `<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path><path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5 6.8 15M17.2 9l2.6-1.5"></path></svg>`,
    property: `<svg viewBox="0 0 24 24"><path d="M4 6c5-2 11 2 16 0v12c-5 2-11-2-16 0V6Z"></path><path d="M8 5v12M16 7v12"></path></svg>`
  };
  return icons[name] || icons.mark;
}

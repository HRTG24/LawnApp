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
  activeProductCategory: "pre-emergent",
  activePlanFilter: "focus"
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    state.data = await loadData();
    state.activeProductCategory = state.data.inventory.categories[0]?.id || "pre-emergent";
    renderApp();
    bindNavigation();
    bindControls();
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
  text("#phase-pill", profile.currentSeason.label);

  renderNavigation();
  renderHome();
  renderPlan();
  renderProductCategories();
  renderProducts();
  renderSystems();
  renderMore();
}

function renderNavigation() {
  const nav = state.data.ui.navigation;
  const mobileNav = nav.map((item) => navButton(item, item.shortLabel || item.label)).join("");
  const desktopNav = nav.map((item) => navButton(item, item.label)).join("");
  document.querySelector("#bottom-nav").innerHTML = mobileNav;
  document.querySelector("#desktop-nav").innerHTML = desktopNav;
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
}

function bindControls() {
  document.querySelector("#product-category-strip").addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-category]");
    if (!button) return;
    state.activeProductCategory = button.dataset.productCategory;
    renderProductCategories();
    renderProducts();
  });

  document.querySelector("#plan-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-plan-filter]");
    if (!button) return;
    state.activePlanFilter = button.dataset.planFilter;
    renderPlan();
  });
}

function showView(view, options = {}) {
  state.activeView = view;
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
  const { profile, tasks, inventory } = state.data;
  const season = profile.currentSeason;
  const nowTasks = tasks.tasks.filter((task) => task.status === "now");
  const nextTasks = tasks.tasks.filter((task) => task.status === "next");
  const buyTasks = buyPrepTasks().slice(0, 3);

  text("#home-window", `${season.window} / ${formatDate(season.asOf)}`);
  text("#current-phase-title", season.label);
  text("#current-phase-copy", concise(season.summary, 112));
  text("#home-now-count", nowTasks.length);
  text("#home-next-count", nextTasks.length);
  text("#home-buy-count", inventory.items.filter((item) => item.stockStatus === "verify").length);
  text("#home-weather-count", profile.weatherAwareness.checks.length);

  document.querySelector("#home-now-list").innerHTML = nowTasks.slice(0, 2).map(taskRow).join("") || emptyState("No active tasks.");
  document.querySelector("#home-next-list").innerHTML = nextTasks.slice(0, 2).map(taskRow).join("") || emptyState("No next tasks.");
  document.querySelector("#home-buy-list").innerHTML = buyTasks.map(taskRow).join("") || emptyState("No prep reminders.");
  document.querySelector("#home-weather-strip").innerHTML = profile.weatherAwareness.checks.slice(0, 4).map((check) => `
    <span>${escapeHtml(check.label)}</span>
  `).join("");
}

function renderPlan() {
  const { seasonal, tasks } = state.data;
  document.querySelectorAll("[data-plan-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.planFilter === state.activePlanFilter);
  });

  const visiblePhases = seasonal.phases.filter((phase) => {
    if (state.activePlanFilter === "all") return true;
    if (state.activePlanFilter === "upcoming") return ["active", "next", "upcoming"].includes(phase.status);
    return ["active", "next"].includes(phase.status);
  });

  document.querySelector("#plan-list").innerHTML = visiblePhases.map((phase) => {
    const phaseTasks = tasks.tasks.filter((task) => task.phaseId === phase.id);
    return `
      <details class="plan-card" ${phase.status === "active" || phase.status === "next" ? "open" : ""}>
        <summary>
          <span>
            <small>${escapeHtml(phase.window)}</small>
            <strong>${escapeHtml(phase.label)}</strong>
          </span>
          <em>${escapeHtml(phase.status)}</em>
        </summary>
        <p>${escapeHtml(concise(phase.summary, 150))}</p>
        <div class="micro-detail"><b>Lead:</b> ${escapeHtml(phase.leadTime)}</div>
        <div class="chip-row">
          ${phaseTasks.slice(0, 4).map((task) => `<span>${escapeHtml(task.title)}</span>`).join("") || "<span>No linked tasks</span>"}
        </div>
      </details>
    `;
  }).join("");
}

function renderProductCategories() {
  const { inventory } = state.data;
  document.querySelector("#product-category-strip").innerHTML = inventory.categories.map((category) => {
    const count = categoryItems(category.id).length;
    return `
      <button class="${category.id === state.activeProductCategory ? "active" : ""}" type="button" data-product-category="${category.id}">
        <span>${escapeHtml(category.label)}</span>
        <small>${count}</small>
      </button>
    `;
  }).join("");
}

function renderProducts() {
  const { inventory, purchases } = state.data;
  const category = inventory.categories.find((item) => item.id === state.activeProductCategory) || inventory.categories[0];
  const items = categoryItems(category.id);

  document.querySelector("#product-focus").innerHTML = `
    <div class="product-category-head">
      <span class="label">${escapeHtml(category.storeQuestion)}</span>
      <h3>${escapeHtml(category.label)}</h3>
      <p>${escapeHtml(category.defaultTiming)}</p>
    </div>
    <div class="product-list">
      ${items.map(productCard).join("") || noProductCard(category)}
    </div>
  `;

  document.querySelector("#purchase-history").innerHTML = purchases.purchases.map((purchase) => `
    <div class="history-item">
      <strong>${escapeHtml(purchase.vendor)} / ${formatDate(purchase.date)}</strong>
      <span>${purchase.items.map((item) => `${item.quantity} x ${escapeHtml(item.name)}`).join(" / ")}</span>
    </div>
  `).join("");
}

function productCard(item) {
  return `
    <article class="product-card">
      <header>
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.unitSize || item.coverage || item.category)}</span>
        </div>
        <em>${escapeHtml(item.preferredStatus || item.stockStatus)}</em>
      </header>
      <p>${escapeHtml(item.typicalUse || item.useTiming)}</p>
      <dl>
        <div><dt>Last</dt><dd>${formatDate(item.lastPurchased)}</dd></div>
        <div><dt>Timing</dt><dd>${escapeHtml(item.useTiming)}</dd></div>
        <div><dt>Setting</dt><dd>${escapeHtml(item.spreaderSetting || "Not recorded")}</dd></div>
      </dl>
      <small>${escapeHtml(item.shortNote || item.notes)}</small>
    </article>
  `;
}

function noProductCard(category) {
  return `
    <article class="product-card empty">
      <header>
        <div>
          <strong>No usual product yet</strong>
          <span>${escapeHtml(category.label)}</span>
        </div>
      </header>
      <p>Add a preferred or previously purchased item to inventory when this category becomes relevant.</p>
    </article>
  `;
}

function renderSystems() {
  const { systems, tasks } = state.data;
  document.querySelector("#systems-list").innerHTML = systems.systems.map((system) => {
    const linkedTasks = system.seasonalTasks
      .map((id) => tasks.tasks.find((task) => task.id === id))
      .filter(Boolean);
    return `
      <article class="system-card">
        <header>
          <div>
            <span>${escapeHtml(system.category)}</span>
            <strong>${escapeHtml(system.name)}</strong>
          </div>
          <em>${escapeHtml(system.status)}</em>
        </header>
        <p>${escapeHtml(system.notes[0] || "")}</p>
        <div class="chip-row">
          ${linkedTasks.slice(0, 3).map((task) => `<span>${escapeHtml(task.title)}</span>`).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function renderMore() {
  const { equipment, zones, settings, profile } = state.data;
  document.querySelector("#more-equipment").innerHTML = equipment.equipment.map((item) => denseItem(item.name, item.status, item.operatingNotes)).join("");
  document.querySelector("#more-zones").innerHTML = zones.zones.map((zone) => denseItem(zone.name, zone.condition, zone.strategy)).join("");
  document.querySelector("#more-settings").innerHTML = settings.settings.map((setting) => denseItem(setting.label, setting.confidence, setting.value)).join("");
  document.querySelector("#more-lessons").innerHTML = [...settings.lessonsLearned, ...profile.lawn.defaultRules]
    .map((lesson) => `<li>${escapeHtml(lesson)}</li>`)
    .join("");
  document.querySelector("#more-sources").innerHTML = settings.sources
    .map((source) => `<a class="dense-item" href="${escapeHtml(source.url)}" rel="noreferrer"><strong>${escapeHtml(source.label)}</strong><span>Open source</span></a>`)
    .join("");
}

function categoryItems(categoryId) {
  return state.data.inventory.items.filter((item) => {
    return item.primaryCategory === categoryId || (item.secondaryCategories || []).includes(categoryId);
  });
}

function buyPrepTasks() {
  return state.data.tasks.tasks.filter((task) => task.status === "buy-soon" || task.category === "prep / buying");
}

function taskRow(task) {
  return `
    <div class="task-row">
      <strong>${escapeHtml(task.title)}</strong>
      <span>${escapeHtml(task.timing)}</span>
    </div>
  `;
}

function denseItem(title, meta, body) {
  return `
    <div class="dense-item">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(meta)}</span>
      <p>${escapeHtml(concise(body || "", 120))}</p>
    </div>
  `;
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
    home: `<svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V20H5V10.5Z"></path><path d="M10 20v-6h4v6"></path></svg>`,
    timeline: `<svg viewBox="0 0 24 24"><path d="M6 5v14"></path><path d="M6 7h11l-2 3 2 3H6"></path><path d="M6 17h9"></path></svg>`,
    box: `<svg viewBox="0 0 24 24"><path d="m4 8 8-4 8 4-8 4-8-4Z"></path><path d="M4 8v8l8 4 8-4V8"></path><path d="M12 12v8"></path></svg>`,
    system: `<svg viewBox="0 0 24 24"><path d="M12 3v5"></path><path d="M5 12h14"></path><path d="M7 12v7h10v-7"></path><path d="M9 8h6"></path></svg>`,
    book: `<svg viewBox="0 0 24 24"><path d="M5 4h10a4 4 0 0 1 4 4v12H8a3 3 0 0 0-3 3V4Z"></path><path d="M5 18h12"></path></svg>`
  };
  return icons[name] || icons.home;
}

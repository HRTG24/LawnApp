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
  activeView: "home"
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    state.data = await loadData();
    renderApp();
    bindNavigation();
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
  renderSeasonalPlan();
  renderInventory();
  renderEquipment();
  renderSystems();
  renderZones();
  renderReference();
}

function renderNavigation() {
  const mobileNav = state.data.ui.navigation.map((item) => `
    <button class="nav-item" type="button" data-nav="${item.id}">
      <span class="nav-icon" aria-hidden="true">${icon(item.icon)}</span>
      <span>${escapeHtml(item.shortLabel || item.label)}</span>
    </button>
  `).join("");

  const desktopNav = state.data.ui.navigation.map((item) => `
    <button class="nav-item" type="button" data-nav="${item.id}">
      <span class="nav-icon" aria-hidden="true">${icon(item.icon)}</span>
      <span>${escapeHtml(item.label)}</span>
    </button>
  `).join("");

  document.querySelector("#desktop-nav").innerHTML = desktopNav;
  document.querySelector("#bottom-nav").innerHTML = mobileNav;
}

function bindNavigation() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.nav));
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
  const nextTasks = tasks.tasks.filter((task) => task.status === "next").slice(0, 4);
  const buyTasks = tasks.tasks.filter((task) => task.status === "buy-soon" || task.category === "prep / buying").slice(0, 4);

  text("#home-window", `${season.window} / ${formatDate(season.asOf)}`);
  text("#home-summary", season.summary);
  text("#current-phase-title", season.label);
  text("#current-phase-copy", season.nowFocus.join(" "));

  document.querySelector("#readiness-grid").innerHTML = [
    { value: nowTasks.length, label: "active tasks" },
    { value: nextTasks.length, label: "next decisions" },
    { value: inventory.items.filter((item) => item.stockStatus === "verify").length, label: "stock checks" }
  ].map((item, index) => `
    <div class="readiness-item">
      <span class="readiness-kicker">0${index + 1}</span>
      <strong>${item.value}</strong>
      <span>${escapeHtml(item.label)}</span>
    </div>
  `).join("");

  document.querySelector("#do-now-list").innerHTML = nowTasks.map(renderPriorityTask).join("") || emptyState("No active tasks in the data model.");
  document.querySelector("#coming-next-list").innerHTML = nextTasks.map(renderCompactTask).join("") || emptyState("No upcoming tasks listed.");
  document.querySelector("#buy-prep-list").innerHTML = buyTasks.map(renderCompactTask).join("") || emptyState("No buy-ahead reminders listed.");
  text("#weather-summary", profile.weatherAwareness.summary);
  document.querySelector("#weather-grid").innerHTML = profile.weatherAwareness.checks.map((check) => `
    <div class="weather-card">
      <strong>${escapeHtml(check.label)}</strong>
      <span>${escapeHtml(check.meaning)}</span>
    </div>
  `).join("");
}

function renderSeasonalPlan() {
  const { seasonal, tasks } = state.data;
  document.querySelector("#seasonal-timeline").innerHTML = seasonal.phases.map((phase) => {
    const phaseTasks = tasks.tasks.filter((task) => task.phaseId === phase.id);
    return `
      <article class="timeline-card ${phase.status === "active" ? "active" : ""}">
        <header>
          <div>
            <span class="label">${escapeHtml(phase.window)}</span>
            <h3>${escapeHtml(phase.label)}</h3>
          </div>
          <span class="tag ${phase.status === "active" ? "warn" : "info"}">${escapeHtml(phase.status)}</span>
        </header>
        <p>${escapeHtml(phase.summary)}</p>
        <div class="detail-grid">
          <div class="detail">
            <strong>Lead time</strong>
            <span>${escapeHtml(phase.leadTime)}</span>
          </div>
        </div>
        <div class="task-strip">
          ${phaseTasks.map((task) => `<span class="task-chip">${escapeHtml(task.title)}</span>`).join("") || `<span class="task-chip">No linked tasks yet</span>`}
        </div>
      </article>
    `;
  }).join("");
}

function renderInventory() {
  const { inventory, purchases } = state.data;
  text("#inventory-policy", inventory.inventoryPolicy.stockCaution);
  document.querySelector("#inventory-grid").innerHTML = inventory.items.map((item) => `
    <article class="item-card">
      <header>
        <div>
          <span class="label">${escapeHtml(item.category)}</span>
          <h3>${escapeHtml(item.name)}</h3>
        </div>
        <span class="tag ${item.stockStatus === "verify" ? "warn" : "info"}">${escapeHtml(item.stockStatus)}</span>
      </header>
      <p>${escapeHtml(item.notes)}</p>
      <div class="detail-grid">
        ${detail("Purchased", `${item.knownPurchasedQuantity} x ${item.unitSize}`)}
        ${item.coverage ? detail("Coverage", item.coverage) : ""}
        ${detail("Use timing", item.useTiming)}
        ${detail("Reorder logic", item.reorderTiming)}
      </div>
    </article>
  `).join("");

  document.querySelector("#purchase-list").innerHTML = purchases.purchases.map((purchase) => `
    <article class="purchase-card">
      <strong>${escapeHtml(purchase.vendor)} / ${formatDate(purchase.date)}</strong>
      <span>${purchase.items.map((item) => `${escapeHtml(item.quantity)} x ${escapeHtml(item.name)}`).join(" / ")}</span>
    </article>
  `).join("");
}

function renderEquipment() {
  const { equipment, settings } = state.data;
  document.querySelector("#equipment-grid").innerHTML = equipment.equipment.map((item) => {
    const linkedSettings = item.knownSettings
      .map((id) => settings.settings.find((setting) => setting.id === id))
      .filter(Boolean);
    return `
      <article class="item-card">
        <header>
          <div>
            <span class="label">${escapeHtml(item.category)}</span>
            <h3>${escapeHtml(item.name)}</h3>
          </div>
          <span class="tag info">${escapeHtml(item.status)}</span>
        </header>
        <p>${escapeHtml(item.operatingNotes)}</p>
        <div class="detail-grid">
          ${detail("Maintenance", item.maintenance.join(" "))}
          ${linkedSettings.map((setting) => detail(setting.label, setting.value)).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function renderSystems() {
  const { systems, tasks } = state.data;
  document.querySelector("#systems-grid").innerHTML = systems.systems.map((system) => {
    const linkedTasks = system.seasonalTasks
      .map((id) => tasks.tasks.find((task) => task.id === id))
      .filter(Boolean);
    return `
      <article class="item-card">
        <header>
          <div>
            <span class="label">${escapeHtml(system.category)}</span>
            <h3>${escapeHtml(system.name)}</h3>
          </div>
          <span class="tag info">${escapeHtml(system.status)}</span>
        </header>
        <ul class="text-list">${system.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
        <div class="tag-row">
          ${linkedTasks.map((task) => `<span class="tag warn">${escapeHtml(task.title)}</span>`).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function renderZones() {
  document.querySelector("#zones-grid").innerHTML = state.data.zones.zones.map((zone) => `
    <article class="item-card">
      <header>
        <div>
          <span class="label">${escapeHtml(zone.category)}</span>
          <h3>${escapeHtml(zone.name)}</h3>
        </div>
        <span class="tag info">${escapeHtml(zone.condition)}</span>
      </header>
      <p>${escapeHtml(zone.strategy)}</p>
      <ul class="text-list">
        ${zone.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </article>
  `).join("");
}

function renderReference() {
  const { settings, profile } = state.data;
  document.querySelector("#settings-grid").innerHTML = settings.settings.map((setting) => `
    <article class="item-card">
      <header>
        <div>
          <span class="label">${escapeHtml(setting.category)}</span>
          <h3>${escapeHtml(setting.label)}</h3>
        </div>
        <span class="tag ${setting.confidence.includes("needs") ? "warn" : "ok"}">${escapeHtml(setting.confidence)}</span>
      </header>
      <p>${escapeHtml(setting.value)}</p>
      <div class="detail-grid">${detail("Notes", setting.notes)}</div>
    </article>
  `).join("");

  document.querySelector("#lessons-list").innerHTML = [
    ...settings.lessonsLearned,
    ...profile.lawn.defaultRules
  ].map((lesson) => `<li>${escapeHtml(lesson)}</li>`).join("");

  document.querySelector("#source-list").innerHTML = settings.sources.map((source) => `
    <a class="source-link" href="${escapeHtml(source.url)}" rel="noreferrer">${escapeHtml(source.label)}</a>
  `).join("");
}

function renderPriorityTask(task) {
  return `
    <article class="priority-card priority-${escapeHtml(task.priority)}">
      <header>
        <div>
          <span class="label">${escapeHtml(task.category)}</span>
          <h4>${escapeHtml(task.title)}</h4>
        </div>
        <span class="tag ${task.priority === "high" ? "warn" : "info"}">${escapeHtml(task.priority)}</span>
      </header>
      <p>${escapeHtml(task.notes)}</p>
      <div class="detail-grid">
        ${detail("Timing", task.timing)}
        ${detail("Weather", task.weatherRules.join(" ") || "No weather rule recorded.")}
        ${detail("Lead time", task.leadTime)}
      </div>
    </article>
  `;
}

function renderCompactTask(task) {
  return `
    <div class="compact-row">
      <strong>${escapeHtml(task.title)}</strong>
      <span>${escapeHtml(task.timing)} / ${escapeHtml(task.leadTime)}</span>
    </div>
  `;
}

function detail(label, value) {
  if (!value) return "";
  return `
    <div class="detail">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
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
    tool: `<svg viewBox="0 0 24 24"><path d="M14 6a4 4 0 0 0 5 5L10 20l-4-4 9-9Z"></path><path d="m7 17-3 3"></path></svg>`,
    system: `<svg viewBox="0 0 24 24"><path d="M12 3v5"></path><path d="M5 12h14"></path><path d="M7 12v7h10v-7"></path><path d="M9 8h6"></path></svg>`,
    map: `<svg viewBox="0 0 24 24"><path d="M4 5c5-2 11 2 16 0v14c-5 2-11-2-16 0V5Z"></path><path d="M8 4v14M16 6v14"></path></svg>`,
    book: `<svg viewBox="0 0 24 24"><path d="M5 4h10a4 4 0 0 1 4 4v12H8a3 3 0 0 0-3 3V4Z"></path><path d="M5 18h12"></path></svg>`
  };
  return icons[name] || icons.home;
}

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

const THEME_KEY = "outdoorOpsTheme";
const THEME_COLORS = {
  dark: "#0b0f0d",
  light: "#f1f4ed"
};

const state = {
  data: null,
  activeView: "home",
  activeGearSection: "products",
  activeProductCategory: "pre-emergent",
  activePropertySection: "overview"
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    applyTheme(readStoredTheme());
    state.data = await loadData();
    state.activeProductCategory = state.data.inventory.categories[0]?.id || "pre-emergent";
    hydrateIcons();
    renderApp();
    bindNavigation();
    bindThemeToggle();
    bindGearCategories();
    bindPropertyCategories();
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

  renderNavigation();
  renderHome();
  renderPlan();
  renderGearCategories();
  renderGear();
  renderPropertyCategories();
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
    const button = event.target.closest("[data-gear-section]");
    if (!button) return;
    state.activeGearSection = button.dataset.gearSection;
    renderGearCategories();
    renderGear();
  });

  document.querySelector("#gear-focus").addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-category]");
    if (!button) return;
    state.activeProductCategory = button.dataset.productCategory;
    renderGear();
  });
}

function bindPropertyCategories() {
  document.querySelector("#property-category-strip").addEventListener("click", (event) => {
    const button = event.target.closest("[data-property-section]");
    if (!button) return;
    state.activePropertySection = button.dataset.propertySection;
    renderPropertyCategories();
    renderProperty();
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
  const { profile, zones } = state.data;
  const season = profile.currentSeason;
  const location = profile.weatherAwareness.location?.label || profile.property.region;
  text("#home-window", `${season.label} / ${location} / ${formatDate(season.asOf)}`);
  text("#launcher-plan-note", season.label);
  text("#launcher-gear-note", "Products / equipment");
  text("#launcher-property-note", `${formatNumber(zones.propertySummary?.totalLawnAreaSqFt || profile.property.totalLawnAreaSqFt)} sq ft`);
  renderWeatherPanel();
}

function renderWeatherPanel() {
  const weather = state.data.profile.weatherAwareness;
  const forecast = weather.forecast || [];
  text("#weather-heading", `3-day outlook / ${weather.location?.label || "Weather"}`);
  document.querySelector("#weather-grid").innerHTML = forecast.slice(0, 3).map((day) => `
    <article class="weather-day" title="${escapeHtml(day.condition || "")}">
      <span>${escapeHtml(day.day)}</span>
      <i aria-hidden="true">${icon(day.icon || "cloud")}</i>
      <strong>${formatTemperature(day.high)} / ${formatTemperature(day.low)}</strong>
    </article>
  `).join("");
}

function renderPlan() {
  const { profile, tasks, seasonal } = state.data;
  const season = profile.currentSeason;
  const nowTasks = tasks.tasks.filter((task) => task.status === "now");
  const nextTasks = tasks.tasks.filter((task) => task.status === "next");
  const buyTasks = tasks.tasks.filter((task) => task.status === "buy-soon" || task.category === "prep / buying");
  const activePhase = seasonal.phases.find((phase) => phase.id === season.phaseId);

  text("#plan-phase-window", "Current phase");
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
  document.querySelector("#gear-category-strip").innerHTML = gearSections().map((category) => {
    return `
      <button class="${category.id === state.activeGearSection ? "active" : ""}" type="button" data-gear-section="${category.id}">
        <span>${escapeHtml(category.label)}</span>
        <small>${escapeHtml(category.note)}</small>
      </button>
    `;
  }).join("");
}

function renderPropertyCategories() {
  document.querySelector("#property-category-strip").innerHTML = propertySections().map((section) => `
    <button class="${section.id === state.activePropertySection ? "active" : ""}" type="button" data-property-section="${section.id}">
      <span>${escapeHtml(section.label)}</span>
      <small>${escapeHtml(section.note)}</small>
    </button>
  `).join("");
}

function renderGear() {
  if (state.activeGearSection === "tools") {
    renderPowerToolsGear();
    return;
  }

  if (state.activeGearSection === "applicators") {
    renderApplicatorsGear();
    return;
  }

  if (state.activeGearSection === "history") {
    renderPurchaseHistoryGear();
    return;
  }

  renderProductsGear();
}

function renderProductsGear() {
  const { inventory } = state.data;
  const category = inventory.categories.find((item) => item.id === state.activeProductCategory) || inventory.categories[0];
  const items = gearItems(category.id);
  document.querySelector("#gear-focus").innerHTML = `
    <div class="gear-head">
      <span class="label">Product reference</span>
      <h3>Products</h3>
      <p>Browse usual buys by category. Purchase history is separate so this stays usable in a store.</p>
    </div>
    <div class="product-filter" aria-label="Product categories">
      ${inventory.categories.map((item) => `
        <button class="${item.id === category.id ? "active" : ""}" type="button" data-product-category="${item.id}">
          ${escapeHtml(item.label)}
        </button>
      `).join("")}
    </div>
    <div class="gear-head compact">
      <span class="label">${escapeHtml(category.storeQuestion)}</span>
      <h3>${escapeHtml(category.label)}</h3>
      <p>${escapeHtml(category.defaultTiming)}</p>
    </div>
    <div class="gear-list">
      ${items.map(gearCard).join("") || emptyGear(category)}
    </div>
  `;
}

function renderPowerToolsGear() {
  const { equipment, settings, inventory } = state.data;
  const settingMap = new Map(settings.settings.map((setting) => [setting.id, setting]));
  const inventoryMap = new Map(inventory.items.map((item) => [item.id, item]));
  const equipmentMap = new Map(equipment.equipment.map((item) => [item.id, item]));
  const tools = equipment.equipment.filter((item) => item.category !== "application");
  const groups = [
    {
      title: "Cut / trim / prune",
      items: tools.filter((item) => ["mower", "cleanup", "pruning", "power head", "trimming", "hedge trimming"].includes(item.category))
    },
    {
      title: "Clean / water / measure",
      items: tools.filter((item) => ["cleaning", "water / hose", "measurement"].includes(item.category))
    }
  ].filter((group) => group.items.length);
  document.querySelector("#gear-focus").innerHTML = `
    <div class="gear-head">
      <span class="label">Owned equipment</span>
      <h3>Power Tools</h3>
      <p>Mower, Milwaukee system, cleanup tools, and support equipment without the sprayer/applicator workflow mixed in.</p>
    </div>
    ${groups.map((group) => `
      <section class="gear-group">
        <h4>${escapeHtml(group.title)}</h4>
        <div class="dense-list">
          ${group.items.map((item) => equipmentCard(item, settingMap, inventoryMap, equipmentMap)).join("")}
        </div>
      </section>
    `).join("")}
  `;
}

function renderApplicatorsGear() {
  const { equipment, settings, inventory } = state.data;
  const settingMap = new Map(settings.settings.map((setting) => [setting.id, setting]));
  const inventoryMap = new Map(inventory.items.map((item) => [item.id, item]));
  const equipmentMap = new Map(equipment.equipment.map((item) => [item.id, item]));
  const applicators = equipment.equipment.filter((item) => item.category === "application");
  document.querySelector("#gear-focus").innerHTML = `
    <div class="gear-head">
      <span class="label">Product-to-tool workflow</span>
      <h3>Applicators</h3>
      <p>Spreader, hose-end sprayer, and dedicated pump sprayers organized by what they are used for.</p>
    </div>
    <div class="dense-list">
      ${applicators.map((item) => equipmentCard(item, settingMap, inventoryMap, equipmentMap)).join("")}
    </div>
  `;
}

function renderPurchaseHistoryGear() {
  const { purchases } = state.data;
  document.querySelector("#gear-focus").innerHTML = `
    <div class="gear-head">
      <span class="label">Sanitized receipts</span>
      <h3>Purchase History</h3>
      <p>Useful product memory only. Private receipt details stay out of the UI.</p>
    </div>
    <div class="dense-list">
      ${purchases.purchases.map((purchase) => `
        <div class="dense-item">
          <strong>${escapeHtml(purchase.vendor)} / ${formatDate(purchase.date)}</strong>
          <span>No private receipt details</span>
          <p>${purchase.items.map((item) => `${item.quantity} x ${escapeHtml(item.name)}`).join(" / ")}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function gearCard(item) {
  return `
    <article class="gear-card">
      <header>
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(productSubtitle(item))}</span>
        </div>
        <em>${escapeHtml(item.preferredStatus || item.stockStatus)}</em>
      </header>
      <p>${escapeHtml(item.typicalUse || item.useTiming)}</p>
      <div class="gear-meta">
        <span><b>Coverage</b>${escapeHtml(item.coverage || item.unitSize || "Reference")}</span>
        <span><b>Tool</b>${escapeHtml(productToolLabel(item))}</span>
        <span><b>Timing</b>${escapeHtml(item.useTiming || "As needed")}</span>
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
  if (state.activePropertySection === "irrigation") {
    renderPropertyIrrigation();
    return;
  }

  if (state.activePropertySection === "areas") {
    renderPropertyAreas();
    return;
  }

  if (state.activePropertySection === "landscape") {
    renderPropertyLandscape();
    return;
  }

  renderPropertyOverview();
}

function gearItems(categoryId) {
  return state.data.inventory.items.filter((item) => {
    return item.primaryCategory === categoryId || (item.secondaryCategories || []).includes(categoryId);
  });
}

function gearSections() {
  const { inventory, equipment, purchases } = state.data;
  const usualProducts = inventory.items.filter((item) => item.referenceRole !== "historical");
  const powerTools = equipment.equipment.filter((item) => item.category !== "application");
  const applicators = equipment.equipment.filter((item) => item.category === "application");
  return [
    { id: "products", label: "Products", note: `${usualProducts.length} usual buys` },
    { id: "tools", label: "Power Tools", note: `${powerTools.length} tools` },
    { id: "applicators", label: "Applicators", note: `${applicators.length} sprayers` },
    { id: "history", label: "History", note: `${purchases.purchases.length} orders` }
  ];
}

function propertySections() {
  const { systems, zones } = state.data;
  return [
    { id: "overview", label: "Overview", note: `${formatNumber(zones.propertySummary.totalLawnAreaSqFt)} sq ft` },
    { id: "irrigation", label: "Irrigation", note: `${systems.irrigation.activeRuntimePerWateringDayMinutes} min` },
    { id: "areas", label: "Lawn Areas", note: `${zones.zones.length} areas` },
    { id: "landscape", label: "Landscape", note: `${zones.landscape.length} groups` }
  ];
}

function renderPropertyOverview() {
  const { systems, zones, settings } = state.data;
  const nonIrrigationSystems = systems.systems.filter((system) => !system.id.startsWith("irrigation"));
  const coverageNotes = zones.propertySummary.coverageNotes.join(" ");
  document.querySelector("#property-focus").innerHTML = `
    <div class="gear-head">
      <span class="label">Property snapshot</span>
      <h3>Overview</h3>
      <p>${escapeHtml(`${formatNumber(zones.propertySummary.totalLawnAreaSqFt)} sq ft of lawn across ${zones.zones.length} areas. ${coverageNotes}`)}</p>
    </div>
    <div class="metric-grid">
      <div><strong>${formatNumber(zones.propertySummary.totalLawnAreaSqFt)}</strong><span>lawn sq ft</span></div>
      <div><strong>${systems.irrigation.activeRuntimePerWateringDayMinutes}</strong><span>active min/day</span></div>
      <div><strong>${zones.zones.length}</strong><span>lawn areas</span></div>
    </div>
    <section class="gear-group">
      <h4>Systems</h4>
      <div class="system-list">
        ${nonIrrigationSystems.map((system) => propertySystemCard(system)).join("")}
      </div>
    </section>
    <section class="gear-group">
      <h4>Reference Notes</h4>
      <div class="dense-list">
        ${settings.lessonsLearned.slice(0, 3).map((lesson) => denseItem(lesson, "lesson", "")).join("")}
      </div>
    </section>
  `;
}

function renderPropertyIrrigation() {
  const { systems } = state.data;
  const irrigation = systems.irrigation;
  const activeZones = irrigation.zones.filter((zone) => zone.status === "active");
  const offZones = irrigation.zones.filter((zone) => zone.status !== "active");
  document.querySelector("#property-focus").innerHTML = `
    <div class="gear-head">
      <span class="label">Water system</span>
      <h3>Irrigation</h3>
      <p>${escapeHtml(`${irrigation.controller.name}, ${irrigation.controller.series}. Runs ${irrigation.wateringDays.join(" / ")} at ${irrigation.controller.startTime}. No rain sensor.`)}</p>
    </div>
    <div class="metric-grid">
      <div><strong>${irrigation.activeRuntimePerWateringDayMinutes}</strong><span>active minutes</span></div>
      <div><strong>${activeZones.length}</strong><span>active zones</span></div>
      <div><strong>${offZones.length}</strong><span>off zones</span></div>
    </div>
    <section class="gear-group">
      <h4>Active Zones</h4>
      <div class="dense-list">
        ${activeZones.map((zone) => denseItem(`Zone ${zone.number} - ${zone.name}`, `${zone.runtimeMinutes} min / active`, zone.area)).join("")}
      </div>
    </section>
    <section class="gear-group">
      <h4>Intentionally Off</h4>
      <div class="dense-list">
        ${offZones.map((zone) => denseItem(`Zone ${zone.number} - ${zone.name}`, zone.status, zone.notes || zone.area)).join("")}
      </div>
    </section>
  `;
}

function renderPropertyAreas() {
  const { zones } = state.data;
  document.querySelector("#property-focus").innerHTML = `
    <div class="gear-head">
      <span class="label">Turf map</span>
      <h3>Lawn Areas</h3>
      <p>${escapeHtml(zones.propertySummary.coverageNotes.join(" "))}</p>
    </div>
    <div class="dense-list">
      ${zones.zones.map((zone) => denseItem(
        zone.name,
        `${formatNumber(zone.areaSqFt)} sq ft${zone.irrigationZoneRefs?.length ? ` / Irrigation Z${zone.irrigationZoneRefs.join(", Z")}` : ""}`,
        `${zone.strategy} ${zone.recommendations?.[0] || ""}`
      )).join("")}
    </div>
  `;
}

function renderPropertyLandscape() {
  const { zones } = state.data;
  document.querySelector("#property-focus").innerHTML = `
    <div class="gear-head">
      <span class="label">Plant reference</span>
      <h3>Landscape</h3>
      <p>Plant and tree reference for the property. Exact counts are intentionally secondary.</p>
    </div>
    <div class="dense-list">
      ${zones.landscape.map((group) => denseItem(
        group.label,
        group.location,
        `${group.items.join(" / ")}${group.certaintyNotes ? ` (${group.certaintyNotes.join(" ")})` : ""}`
      )).join("")}
    </div>
  `;
}

function propertySystemCard(system) {
  return `
    <article class="property-card">
      <header>
        <div>
          <span>${escapeHtml(system.category)}</span>
          <strong>${escapeHtml(system.name)}</strong>
        </div>
        <em>${escapeHtml(system.status)}</em>
      </header>
      <p>${escapeHtml(concise((system.notes || []).join(" "), 170))}</p>
    </article>
  `;
}

function productSubtitle(item) {
  return [item.productCode ? `Code ${item.productCode}` : "", item.unitSize || item.coverage || item.category]
    .filter(Boolean)
    .join(" / ");
}

function productToolLabel(item) {
  const equipment = state.data.equipment.equipment;
  const names = (item.relatedEquipmentIds || [])
    .map((id) => equipment.find((tool) => tool.id === id)?.name)
    .filter(Boolean);
  if (names.length) return names.join(" / ");
  return item.spreaderSetting === "Not applicable." ? "No spreader" : "Label guidance";
}

function equipmentMeta(item) {
  return [
    item.status,
    item.model ? `Model ${item.model}` : "",
    item.purchased ? `Purchased ${item.purchased}` : ""
  ].filter(Boolean).join(" / ");
}

function equipmentCard(item, settingMap, inventoryMap, equipmentMap) {
  const linkedSettings = (item.knownSettings || []).map((id) => settingMap.get(id)).filter(Boolean);
  const dedicatedProducts = (item.reservedForInventoryIds || [])
    .map((id) => inventoryMap.get(id)?.name)
    .filter(Boolean);
  const childTools = (item.childEquipmentIds || [])
    .map((id) => equipmentMap.get(id)?.name)
    .filter(Boolean);
  const categoryProducts = (item.relatedProductCategories || [])
    .map((categoryId) => state.data.inventory.categories.find((category) => category.id === categoryId)?.label)
    .filter(Boolean);
  const relationshipText = [
    dedicatedProducts.length ? `Dedicated to ${dedicatedProducts.join(" / ")}` : "",
    categoryProducts.length ? `Used for ${categoryProducts.join(" / ")}` : "",
    childTools.length ? `Parent for ${childTools.join(" / ")}` : "",
    item.parentEquipmentId ? `Connects to ${equipmentMap.get(item.parentEquipmentId)?.name || item.parentEquipmentId}` : "",
    linkedSettings.map((setting) => `${setting.label}: ${setting.value}`).join(" / "),
    item.operatingNotes
  ].filter(Boolean).join(" ");
  return denseItem(item.name, equipmentMeta(item), relationshipText);
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

function bindThemeToggle() {
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      applyTheme(nextTheme);
      try {
        localStorage.setItem(THEME_KEY, nextTheme);
      } catch (error) {
        // Theme persistence is a convenience; the toggle still works without storage.
      }
    });
  });
}

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch (error) {
    return "dark";
  }
}

function applyTheme(theme) {
  const safeTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = safeTheme;
  const themeColor = document.querySelector("meta[name='theme-color']");
  if (themeColor) themeColor.setAttribute("content", THEME_COLORS[safeTheme]);
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

function formatTemperature(value) {
  if (value === null || value === undefined || value === "") return "--";
  return `${Math.round(Number(value))}°`;
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value || 0));
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
    mark: `<svg viewBox="0 0 24 24"><path d="M4.5 18.5h15"></path><path d="M7 18.5c.3-3.4 1.4-5.8 3.3-7.5"></path><path d="M11.2 18.5c-.1-4.5.5-8.5 1.8-12.3"></path><path d="M15 18.5c.2-3.8 1-6.5 2.4-8.5"></path><path d="M9.3 18.5c-.5-2.5-1.4-4.3-2.7-5.5"></path><path d="M17.2 18.5c-.2-2.5-.8-4.3-1.9-5.6"></path></svg>`,
    plan: `<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"></path><path d="M8 9h8M8 13h5"></path><path d="M16 16l3 3"></path></svg>`,
    gear: `<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path><path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5 6.8 15M17.2 9l2.6-1.5"></path></svg>`,
    property: `<svg viewBox="0 0 24 24"><path d="M4 6c5-2 11 2 16 0v12c-5 2-11-2-16 0V6Z"></path><path d="M8 5v12M16 7v12"></path></svg>`,
    sun: `<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"></path><path d="M12 3.8v2M12 18.2v2M4.8 12h2M17.2 12h2M6.9 6.9l1.4 1.4M15.7 15.7l1.4 1.4M17.1 6.9l-1.4 1.4M8.3 15.7l-1.4 1.4"></path></svg>`,
    cloud: `<svg viewBox="0 0 24 24"><path d="M7.2 17.5h9.6a3.2 3.2 0 0 0 .5-6.4 5.1 5.1 0 0 0-9.8 1.2h-.3a2.6 2.6 0 0 0 0 5.2Z"></path></svg>`,
    "partly-cloudy": `<svg viewBox="0 0 24 24"><path d="M8.2 8.2a3.4 3.4 0 0 1 5.9 2.4"></path><path d="M6.2 5.7 5 4.5M12 3v1.8M3 10.7h1.8"></path><path d="M7.3 18h9.2a3 3 0 0 0 .5-5.9 4.8 4.8 0 0 0-9.2 1.1h-.5a2.4 2.4 0 0 0 0 4.8Z"></path></svg>`,
    rain: `<svg viewBox="0 0 24 24"><path d="M7.2 14.7h9.6a3 3 0 0 0 .5-6 5.1 5.1 0 0 0-9.8 1.2h-.3a2.4 2.4 0 0 0 0 4.8Z"></path><path d="M8.5 18.1 7.8 20M12 18.1l-.7 1.9M15.5 18.1l-.7 1.9"></path></svg>`
  };
  return icons[name] || icons.mark;
}

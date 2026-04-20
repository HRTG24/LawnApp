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
  activeGearSection: "hub",
  activePropertySection: "overview"
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    applyTheme(readStoredTheme());
    state.data = await loadData();
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
    const sectionButton = event.target.closest("[data-gear-section]");
    if (sectionButton) {
      state.activeGearSection = sectionButton.dataset.gearSection;
      renderGearCategories();
      renderGear();
      return;
    }

    const backButton = event.target.closest("[data-gear-back]");
    if (backButton) {
      state.activeGearSection = "hub";
      renderGearCategories();
      renderGear();
      return;
    }
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
  const previousView = state.activeView;
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
  if (view === "gear" && previousView !== "gear") {
    state.activeGearSection = "hub";
    renderGearCategories();
    renderGear();
  }
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
  const strip = document.querySelector("#gear-category-strip");
  strip.hidden = state.activeGearSection === "hub";
  if (state.activeGearSection === "hub") {
    strip.innerHTML = "";
    return;
  }

  strip.innerHTML = gearSections().map((category) => {
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
  if (state.activeGearSection === "equipment") {
    renderEquipmentGear();
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

  if (state.activeGearSection === "products") {
    renderProductsGear();
    return;
  }

  renderGearHub();
}

function renderGearHub() {
  document.querySelector("#gear-focus").innerHTML = `
    <div class="gear-hub" aria-label="Gear categories">
      ${gearSections().map((section) => `
        <button class="gear-tile" type="button" data-gear-section="${section.id}">
          <span class="gear-tile-icon" aria-hidden="true">${icon(section.icon)}</span>
          <strong>${escapeHtml(section.label)}</strong>
          <small>${escapeHtml(section.summary)}</small>
          <em>${escapeHtml(section.note)}</em>
        </button>
      `).join("")}
    </div>
  `;
}

function gearDetailHead(sectionId, eyebrow, title, summary) {
  const section = gearSections().find((item) => item.id === sectionId);
  return `
    <div class="gear-detail-head">
      <button class="gear-back" type="button" data-gear-back aria-label="Back to Gear categories">
        ${icon("back")}
      </button>
      <div>
        <span class="label">${escapeHtml(eyebrow)}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(summary || section?.summary || "")}</p>
      </div>
    </div>
  `;
}

function renderProductsGear() {
  const productGroups = groupedProducts();
  document.querySelector("#gear-focus").innerHTML = `
    ${gearDetailHead("products", "Usual buys", "Products", "Grouped by how they are used, not by stock counts.")}
    ${productGroups.map((group) => compactSection(
      group.title,
      group.items.map(productRow).join("") || emptyCompactRow("No products recorded", group.title, "")
    )).join("")}
  `;
}

function renderEquipmentGear() {
  const groups = groupedEquipment();
  document.querySelector("#gear-focus").innerHTML = `
    ${gearDetailHead("equipment", "Owned gear", "Equipment", "Core tools grouped by how you would look them up.")}
    ${groups.map((group) => compactSection(
      group.title,
      group.items.map(equipmentRow).join("") || emptyCompactRow("No gear recorded", group.title, "")
    )).join("")}
  `;
}

function renderApplicatorsGear() {
  const applicators = state.data.equipment.equipment.filter((item) => item.category === "application");
  document.querySelector("#gear-focus").innerHTML = `
    ${gearDetailHead("applicators", "Product-to-tool map", "Applicators", "Spreader and sprayer assignments, kept explicit.")}
    <div class="compact-list applicator-map">
      ${applicators.map(applicatorRow).join("")}
    </div>
  `;
}

function renderPurchaseHistoryGear() {
  const purchases = [...state.data.purchases.purchases].sort((a, b) => new Date(b.date) - new Date(a.date));
  document.querySelector("#gear-focus").innerHTML = `
    ${gearDetailHead("history", "Historical reference", "History", "Sanitized purchase memory for planning, not live inventory.")}
    <div class="compact-list">
      ${purchases.map(purchaseRow).join("")}
    </div>
  `;
}

function compactSection(title, body) {
  return `
    <section class="compact-section">
      <h4>${escapeHtml(title)}</h4>
      <div class="compact-list">${body}</div>
    </section>
  `;
}

function productRow(item) {
  const meta = [
    categoryLabel(item.primaryCategory),
    item.coverage || item.unitSize,
    item.lastPurchased ? `Last ${formatDate(item.lastPurchased)}` : "",
    productToolLabel(item)
  ].filter(Boolean).slice(0, 4);
  return compactRow(
    item.name,
    item.shortNote || item.typicalUse,
    meta,
    item.referenceRole === "historical" ? "history" : item.preferredStatus
  );
}

function equipmentRow(item) {
  const meta = [
    item.model ? `Model ${item.model}` : "",
    item.purchased ? `Purchased ${item.purchased}` : "",
    item.status
  ].filter(Boolean);
  return compactRow(item.name, equipmentRelationship(item), meta, item.category);
}

function applicatorRow(item) {
  const meta = [
    item.model ? `Model ${item.model}` : "",
    item.purchased ? `Purchased ${item.purchased}` : "",
    item.status
  ].filter(Boolean);
  return compactRow(item.name, applicatorAssignment(item), meta, "assigned");
}

function purchaseRow(purchase) {
  return `
    <article class="history-card">
      <header>
        <strong>${escapeHtml(purchase.vendor)}</strong>
        <span>${formatDate(purchase.date)}</span>
      </header>
      <div class="history-items">
        ${purchase.items.map((item) => `
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml([item.quantity ? `${item.quantity}x` : "", item.size, item.coverage].filter(Boolean).join(" / "))}</span>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function compactRow(title, support, meta, badge) {
  return `
    <article class="compact-row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(concise(support || "", 96))}</small>
      </div>
      ${badge ? `<em>${escapeHtml(concise(badge, 22))}</em>` : ""}
      <div class="mini-meta">
        ${(meta || []).filter(Boolean).map((item) => `<span>${escapeHtml(concise(item, 34))}</span>`).join("")}
      </div>
    </article>
  `;
}

function emptyCompactRow(title, meta, support) {
  return compactRow(title, support, [meta], "");
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

function gearSections() {
  const { inventory, equipment, purchases } = state.data;
  const usualProducts = inventory.items.filter((item) => item.referenceRole !== "historical");
  const equipmentItems = equipment.equipment.filter((item) => item.category !== "application");
  const applicators = equipment.equipment.filter((item) => item.category === "application");
  return [
    {
      id: "products",
      label: "Products",
      note: `${usualProducts.length} usual buys`,
      summary: "Treatment and pest products",
      icon: "products"
    },
    {
      id: "equipment",
      label: "Equipment",
      note: `${equipmentItems.length} tools`,
      summary: "Mower, Milwaukee, support gear",
      icon: "equipment"
    },
    {
      id: "applicators",
      label: "Applicators",
      note: `${applicators.length} assigned`,
      summary: "Spreader and sprayers",
      icon: "applicators"
    },
    {
      id: "history",
      label: "History",
      note: `${purchases.purchases.length} orders`,
      summary: "Purchase reference",
      icon: "history"
    }
  ];
}

function groupedProducts() {
  const items = state.data.inventory.items.filter((item) => item.referenceRole !== "historical");
  const used = new Set();
  const take = (predicate) => items.filter((item) => {
    if (used.has(item.id) || !predicate(item)) return false;
    used.add(item.id);
    return true;
  });

  const groups = [
    {
      title: "Granular",
      items: take((item) => {
        return item.relatedEquipmentIds?.includes("scotts-elite-spreader") ||
          ["pre-emergent", "fertilizer"].includes(item.primaryCategory);
      })
    },
    {
      title: "Liquid",
      items: take((item) => {
        return item.primaryCategory === "weed-control" &&
          !item.relatedEquipmentIds?.includes("scotts-elite-spreader");
      })
    },
    {
      title: "Pest / insect",
      items: take((item) => item.primaryCategory === "pest-control")
    },
    {
      title: "Repair / beds",
      items: take(() => true)
    }
  ];

  return groups.filter((group) => group.items.length);
}

function groupedEquipment() {
  const tools = state.data.equipment.equipment.filter((item) => item.category !== "application");
  const used = new Set();
  const take = (predicate) => tools.filter((item) => {
    if (used.has(item.id) || !predicate(item)) return false;
    used.add(item.id);
    return true;
  });

  const groups = [
    {
      title: "Lawn / core gear",
      items: take((item) => item.category === "mower")
    },
    {
      title: "Milwaukee tools / attachments",
      items: take((item) => item.name.startsWith("Milwaukee"))
    },
    {
      title: "Other equipment",
      items: take(() => true)
    }
  ];

  return groups.filter((group) => group.items.length);
}

function categoryLabel(categoryId) {
  return state.data.inventory.categories.find((category) => category.id === categoryId)?.label || categoryId;
}

function equipmentRelationship(item) {
  const equipmentMap = new Map(state.data.equipment.equipment.map((tool) => [tool.id, tool]));
  const childTools = (item.childEquipmentIds || [])
    .map((id) => equipmentMap.get(id)?.name)
    .filter(Boolean);
  if (childTools.length) return `Parent for ${childTools.join(" / ")}`;
  if (item.parentEquipmentId) return `Connects to ${equipmentMap.get(item.parentEquipmentId)?.name || item.parentEquipmentId}`;
  return item.operatingNotes;
}

function applicatorAssignment(item) {
  const inventoryMap = new Map(state.data.inventory.items.map((product) => [product.id, product]));
  const productNames = (item.reservedForInventoryIds || [])
    .map((id) => inventoryMap.get(id)?.name)
    .filter(Boolean);
  if (productNames.length) return `Dedicated to ${productNames.join(" / ")}`;

  const categories = (item.relatedProductCategories || [])
    .map(categoryLabel)
    .filter(Boolean);
  if (categories.length) return `Used for ${categories.join(" / ")}`;

  return item.operatingNotes;
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

function productToolLabel(item) {
  const equipment = state.data.equipment.equipment;
  const names = (item.relatedEquipmentIds || [])
    .map((id) => equipment.find((tool) => tool.id === id)?.name)
    .filter(Boolean);
  if (names.length) return names.join(" / ");
  return item.spreaderSetting === "Not applicable." ? "No spreader" : "Label guidance";
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
    back: `<svg viewBox="0 0 24 24"><path d="M15 6 9 12l6 6"></path></svg>`,
    plan: `<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"></path><path d="M8 9h8M8 13h5"></path><path d="M16 16l3 3"></path></svg>`,
    gear: `<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path><path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5 6.8 15M17.2 9l2.6-1.5"></path></svg>`,
    products: `<svg viewBox="0 0 24 24"><path d="M7 4h10v4l-1.8 2.3V19a2 2 0 0 1-2 2H10.8a2 2 0 0 1-2-2v-8.7L7 8V4Z"></path><path d="M9 8h6M9 14h6"></path></svg>`,
    equipment: `<svg viewBox="0 0 24 24"><path d="M5 18h14"></path><path d="M7 18V9l4-3 6 4v8"></path><path d="M10 18v-5h4v5"></path><path d="M17 10l2-2"></path></svg>`,
    applicators: `<svg viewBox="0 0 24 24"><path d="M7 5h8v5H7z"></path><path d="M9 10v9M13 10v9"></path><path d="M5 19h12"></path><path d="M17 7h2v5"></path><path d="M19 12c-2 1-3.5 2.4-4.5 4"></path></svg>`,
    history: `<svg viewBox="0 0 24 24"><path d="M5 5h14v15l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L7 20V5Z"></path><path d="M8 9h8M8 12h8M8 15h5"></path></svg>`,
    property: `<svg viewBox="0 0 24 24"><path d="M4 6c5-2 11 2 16 0v12c-5 2-11-2-16 0V6Z"></path><path d="M8 5v12M16 7v12"></path></svg>`,
    sun: `<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"></path><path d="M12 3.8v2M12 18.2v2M4.8 12h2M17.2 12h2M6.9 6.9l1.4 1.4M15.7 15.7l1.4 1.4M17.1 6.9l-1.4 1.4M8.3 15.7l-1.4 1.4"></path></svg>`,
    cloud: `<svg viewBox="0 0 24 24"><path d="M7.2 17.5h9.6a3.2 3.2 0 0 0 .5-6.4 5.1 5.1 0 0 0-9.8 1.2h-.3a2.6 2.6 0 0 0 0 5.2Z"></path></svg>`,
    "partly-cloudy": `<svg viewBox="0 0 24 24"><path d="M8.2 8.2a3.4 3.4 0 0 1 5.9 2.4"></path><path d="M6.2 5.7 5 4.5M12 3v1.8M3 10.7h1.8"></path><path d="M7.3 18h9.2a3 3 0 0 0 .5-5.9 4.8 4.8 0 0 0-9.2 1.1h-.5a2.4 2.4 0 0 0 0 4.8Z"></path></svg>`,
    rain: `<svg viewBox="0 0 24 24"><path d="M7.2 14.7h9.6a3 3 0 0 0 .5-6 5.1 5.1 0 0 0-9.8 1.2h-.3a2.4 2.4 0 0 0 0 4.8Z"></path><path d="M8.5 18.1 7.8 20M12 18.1l-.7 1.9M15.5 18.1l-.7 1.9"></path></svg>`
  };
  return icons[name] || icons.mark;
}

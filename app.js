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

const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const WEATHER_CONFIG = {
  latitude: 37.8347,
  longitude: -97.3734,
  timezone: "America/Chicago",
  label: "Valley Center, KS",
  zip: "67147"
};

const state = {
  data: null,
  activeView: "home",
  activeGearSection: "hub",
  activePropertySection: "overview",
  activePlanPhaseId: null,
  activeWeatherDate: null,
  weatherForecast: null,
  activeApplicatorGroup: null
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
    bindWeather();
    bindPlanControls();
    bindGearCategories();
    bindPropertyCategories();
    showView("home", { focus: false });
    loadLiveWeather();
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

function bindWeather() {
  document.querySelector("#weather-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-weather-date]");
    if (!button) return;
    state.activeWeatherDate = button.dataset.weatherDate;
    renderWeatherPanel();
  });
}

function bindPlanControls() {
  document.querySelector("[data-plan-prev]").addEventListener("click", () => shiftPlanPhase(-1));
  document.querySelector("[data-plan-next]").addEventListener("click", () => shiftPlanPhase(1));
  document.querySelector("#plan-phase-progress").addEventListener("click", (event) => {
    const button = event.target.closest("[data-plan-phase]");
    if (!button) return;
    state.activePlanPhaseId = button.dataset.planPhase;
    renderPlan();
  });

  const planView = document.querySelector("#plan-view");
  let startX = 0;
  planView.addEventListener("touchstart", (event) => {
    startX = event.touches[0]?.clientX || 0;
  }, { passive: true });
  planView.addEventListener("touchend", (event) => {
    const endX = event.changedTouches[0]?.clientX || 0;
    const delta = endX - startX;
    if (Math.abs(delta) < 54) return;
    shiftPlanPhase(delta < 0 ? 1 : -1);
  }, { passive: true });
}

function bindGearCategories() {
  document.querySelector("#gear-category-strip").addEventListener("click", (event) => {
    const button = event.target.closest("[data-gear-section]");
    if (!button) return;
    state.activeGearSection = button.dataset.gearSection;
    state.activeApplicatorGroup = null;
    renderGearCategories();
    renderGear();
  });

  document.querySelector("#gear-focus").addEventListener("click", (event) => {
    const sectionButton = event.target.closest("[data-gear-section]");
    if (sectionButton) {
      state.activeGearSection = sectionButton.dataset.gearSection;
      state.activeApplicatorGroup = null;
      renderGearCategories();
      renderGear();
      return;
    }

    const backButton = event.target.closest("[data-gear-back]");
    if (backButton) {
      state.activeGearSection = "hub";
      state.activeApplicatorGroup = null;
      renderGearCategories();
      renderGear();
      return;
    }

    const applicatorButton = event.target.closest("[data-applicator-group]");
    if (applicatorButton) {
      state.activeApplicatorGroup = applicatorButton.dataset.applicatorGroup;
      renderApplicatorsGear();
      return;
    }

    const applicatorBack = event.target.closest("[data-applicator-back]");
    if (applicatorBack) {
      state.activeApplicatorGroup = null;
      renderApplicatorsGear();
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
  const forecast = state.weatherForecast?.daily || weather.forecast || [];
  if (!state.activeWeatherDate && forecast[0]) state.activeWeatherDate = forecast[0].date || forecast[0].day;
  text("#weather-heading", `3-day outlook / ${WEATHER_CONFIG.label}`);
  document.querySelector("#weather-grid").innerHTML = forecast.slice(0, 3).map((day) => {
    const dayKey = day.date || day.day;
    return `
      <button class="weather-day ${dayKey === state.activeWeatherDate ? "active" : ""}" type="button" data-weather-date="${escapeHtml(dayKey)}" title="${escapeHtml(day.condition || "")}">
        <span>${escapeHtml(day.day)}</span>
        <i aria-hidden="true">${icon(day.icon || "cloud")}</i>
        <strong>${formatTemperature(day.high)} / ${formatTemperature(day.low)}</strong>
      </button>
    `;
  }).join("");
  renderHourlyPanel();
}

async function loadLiveWeather() {
  try {
    const params = new URLSearchParams({
      latitude: WEATHER_CONFIG.latitude,
      longitude: WEATHER_CONFIG.longitude,
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      hourly: "temperature_2m,precipitation_probability,wind_speed_10m,weather_code",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: WEATHER_CONFIG.timezone,
      forecast_days: "3"
    });
    const response = await fetch(`${WEATHER_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
    const payload = await response.json();
    state.weatherForecast = normalizeWeather(payload);
    state.activeWeatherDate = state.weatherForecast.daily[0]?.date || state.activeWeatherDate;
    renderWeatherPanel();
  } catch (error) {
    console.warn("Using seeded weather fallback.", error);
    renderHourlyPanel("Live weather unavailable");
  }
}

function normalizeWeather(payload) {
  const daily = (payload.daily?.time || []).slice(0, 3).map((date, index) => {
    const code = payload.daily.weather_code?.[index];
    return {
      date,
      day: weatherDayLabel(date, index),
      condition: weatherCodeLabel(code),
      icon: weatherCodeIcon(code),
      high: payload.daily.temperature_2m_max?.[index],
      low: payload.daily.temperature_2m_min?.[index]
    };
  });

  const hourly = {};
  (payload.hourly?.time || []).forEach((time, index) => {
    const date = time.slice(0, 10);
    if (!hourly[date]) hourly[date] = [];
    const hour = Number(time.slice(11, 13));
    if (hour < 6 || hour > 21 || hour % 3 !== 0) return;
    hourly[date].push({
      time,
      hour: formatHour(time),
      temp: payload.hourly.temperature_2m?.[index],
      wind: payload.hourly.wind_speed_10m?.[index],
      rain: payload.hourly.precipitation_probability?.[index],
      icon: weatherCodeIcon(payload.hourly.weather_code?.[index])
    });
  });

  return { daily, hourly };
}

function renderHourlyPanel(message = "") {
  const panel = document.querySelector("#hourly-panel");
  const forecast = state.weatherForecast;
  if (!forecast) {
    panel.innerHTML = message
      ? `<p class="weather-note">${escapeHtml(message)}</p>`
      : `<p class="weather-note">Loading live hourly forecast...</p>`;
    return;
  }
  const activeDay = forecast.daily.find((day) => day.date === state.activeWeatherDate) || forecast.daily[0];
  const hours = forecast.hourly[activeDay?.date] || [];
  panel.innerHTML = `
    <div class="hourly-head">
      <strong>${escapeHtml(activeDay?.day || "Today")}</strong>
      <span>${escapeHtml(activeDay?.condition || "Forecast")}</span>
    </div>
    <div class="hourly-grid">
      ${hours.slice(0, 6).map((hour) => `
        <div class="hourly-cell">
          <span>${escapeHtml(hour.hour)}</span>
          <strong>${formatTemperature(hour.temp)}</strong>
          <small>${Math.round(Number(hour.wind || 0))} mph</small>
          <small>${hour.rain ?? "--"}% rain</small>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPlan() {
  const { profile, seasonal } = state.data;
  const phases = planPhaseOrder();
  if (!state.activePlanPhaseId) state.activePlanPhaseId = seasonal.currentPhaseId || profile.currentSeason.phaseId;
  const activePhase = phases.find((phase) => phase.id === state.activePlanPhaseId) || currentPlanPhase();
  state.activePlanPhaseId = activePhase.id;
  const phaseIndex = phases.findIndex((phase) => phase.id === activePhase.id);
  const activeItems = [...(activePhase.items || [])].sort(planPrioritySort);
  const focusItems = activeItems.filter((item) => item.type === "core" || (item.type === "conditional" && item.priority === "high")).slice(0, 3);
  const watchItems = activeItems.filter((item) => item.type === "weather" || item.trigger || item.condition).slice(0, 3);
  const prepItems = activeItems.filter((item) => item.type === "buy" || item.buyAhead || item.sequence).slice(0, 3);

  document.querySelector("[data-plan-prev]").innerHTML = icon("back");
  document.querySelector("[data-plan-next]").innerHTML = icon("next");
  document.querySelector("[data-plan-prev]").disabled = phaseIndex <= 0;
  document.querySelector("[data-plan-next]").disabled = phaseIndex >= phases.length - 1;
  document.querySelector("#plan-phase-copy").innerHTML = `
    <div>
      <span class="label">${escapeHtml(activePhase.window)}</span>
      <h3>${escapeHtml(activePhase.label)}</h3>
      <p>${escapeHtml(activePhase.mainRecommendation || activePhase.summary || profile.currentSeason.summary)}</p>
    </div>
    <div class="plan-phase-meta">
      <span>${escapeHtml(seasonal.planningModel.region)}</span>
      <span>${phaseIndex + 1} / ${phases.length}</span>
    </div>
  `;

  document.querySelector("#plan-priority-list").innerHTML = focusItems
    .map((item) => planItemRow(item, "focus"))
    .join("") || emptyState("No focus items recorded.");

  document.querySelector("#plan-trigger-list").innerHTML = watchItems
    .map((item) => planMiniItem(item, "watch"))
    .join("") || emptyState("No watch items for this phase.");

  document.querySelector("#plan-buy-list").innerHTML = prepItems
    .map((item) => planMiniItem(item, "prep"))
    .join("") || emptyState("No prep items for this phase.");

  document.querySelector("#plan-phase-progress").innerHTML = phases.map((phase, index) => `
    <button class="${phase.id === activePhase.id ? "active" : ""}" type="button" data-plan-phase="${escapeHtml(phase.id)}" aria-label="${escapeHtml(phase.label)}">
      <span>${index + 1}</span>
    </button>
  `).join("");
}

function currentPlanPhase() {
  const { profile, seasonal } = state.data;
  const preferredId = seasonal.currentPhaseId || profile.currentSeason.phaseId;
  return seasonal.phases.find((phase) => phase.id === preferredId) ||
    seasonal.phases.find((phase) => phase.status === "active") ||
    seasonal.phases[0];
}

function planPhaseOrder() {
  const { seasonal } = state.data;
  const phaseMap = new Map(seasonal.phases.map((phase) => [phase.id, phase]));
  return (seasonal.phaseOrder || seasonal.phases.map((phase) => phase.id))
    .map((id) => phaseMap.get(id))
    .filter(Boolean);
}

function shiftPlanPhase(direction) {
  const phases = planPhaseOrder();
  const currentId = state.activePlanPhaseId || currentPlanPhase().id;
  const currentIndex = phases.findIndex((phase) => phase.id === currentId);
  const nextIndex = Math.max(0, Math.min(phases.length - 1, currentIndex + direction));
  if (nextIndex === currentIndex) return;
  state.activePlanPhaseId = phases[nextIndex].id;
  renderPlan();
}

function planPrioritySort(a, b) {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const typeRank = { core: 0, weather: 1, conditional: 2, buy: 3 };
  return (priorityRank[a.priority] ?? 4) - (priorityRank[b.priority] ?? 4) ||
    (typeRank[a.type] ?? 4) - (typeRank[b.type] ?? 4);
}

function planItemRow(item, sectionType = "focus") {
  return `
    <article class="plan-item ${escapeHtml(sectionType)}">
      <span class="plan-item-icon" aria-hidden="true">${icon(planSectionIcon(sectionType))}</span>
      <div>
        <header>
          <strong>${escapeHtml(item.title)}</strong>
        </header>
        <p>${escapeHtml(item.guidance)}</p>
        <div class="mini-meta">
          <span>${escapeHtml(planLaneLabel(item.lane))}</span>
          ${item.trigger ? `<span>${escapeHtml(concise(item.trigger, 42))}</span>` : ""}
          ${item.condition ? `<span>${escapeHtml(concise(item.condition, 42))}</span>` : ""}
          ${item.sequence ? `<span>${escapeHtml(concise(item.sequence, 42))}</span>` : ""}
        </div>
      </div>
    </article>
  `;
}

function planMiniItem(item, sectionType = "watch") {
  const note = sectionType === "prep" && item.buyAhead && item.guidance
    ? `${item.buyAhead} ${item.guidance}`
    : item.buyAhead || item.trigger || item.condition || item.sequence || item.guidance;
  return `
    <article class="plan-mini-item">
      <span aria-hidden="true">${icon(planSectionIcon(sectionType))}</span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(concise(note, 88))}</small>
      </div>
    </article>
  `;
}

function planSectionIcon(type) {
  return {
    focus: "plan-core",
    watch: "plan-weather",
    prep: "plan-buy"
  }[type] || "plan-core";
}

function planLaneLabel(lane) {
  return {
    lawn: "Lawn",
    irrigation: "Irrigation",
    shrubs: "Shrubs",
    insects: "Insects",
    purchase: "Purchase"
  }[lane] || lane;
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
  const groups = applicatorGroups();
  const selected = groups.find((group) => group.id === state.activeApplicatorGroup);
  if (selected) {
    renderApplicatorDetail(selected);
    return;
  }
  document.querySelector("#gear-focus").innerHTML = `
    ${gearDetailHead("applicators", "Application settings", "Applicators", "Choose an applicator to see assignments and product-specific settings.")}
    <div class="applicator-hub">
      ${groups.map((group) => `
        <button class="applicator-tile" type="button" data-applicator-group="${escapeHtml(group.id)}">
          <span aria-hidden="true">${icon(group.icon)}</span>
          <strong>${escapeHtml(group.label)}</strong>
          <small>${escapeHtml(group.summary)}</small>
        </button>
      `).join("")}
    </div>
  `;
}

function renderApplicatorDetail(group) {
  document.querySelector("#gear-focus").innerHTML = `
    <div class="gear-detail-head">
      <button class="gear-back" type="button" data-applicator-back aria-label="Back to applicators">
        ${icon("back")}
      </button>
      <div>
        <span class="label">${escapeHtml(group.eyebrow)}</span>
        <h3>${escapeHtml(group.label)}</h3>
        <p>${escapeHtml(group.detail)}</p>
      </div>
    </div>
    <section class="compact-section">
      <h4>${escapeHtml(group.settingTitle)}</h4>
      <div class="compact-list">
        ${group.rows.map((row) => compactRow(row.title, row.support, row.meta, row.badge)).join("")}
      </div>
    </section>
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

function applicatorGroups() {
  const equipment = state.data.equipment.equipment;
  const inventory = state.data.inventory.items;
  const settings = state.data.settings.settings;
  const byEquipmentId = (id) => equipment.find((item) => item.id === id);
  const settingMap = new Map(settings.map((setting) => [setting.id, setting]));
  const productRows = (equipmentId) => inventory
    .filter((item) => (item.relatedEquipmentIds || []).includes(equipmentId))
    .map((item) => ({
      title: item.name,
      support: settingSupport(item.spreaderSetting) || settingSupport(item.notes),
      meta: [categoryLabel(item.primaryCategory), item.coverage || item.unitSize],
      badge: hasKnownSetting(item.spreaderSetting) ? "known" : "placeholder"
    }));

  const spreader = byEquipmentId("scotts-elite-spreader");
  const dial = byEquipmentId("ortho-dial-n-spray");
  const pumpSprayers = equipment.filter((item) => item.id.startsWith("hdx-pump-sprayer"));
  const pumpRows = pumpSprayers.map((sprayer) => {
    const assigned = (sprayer.reservedForInventoryIds || [])
      .map((id) => inventory.find((item) => item.id === id))
      .filter(Boolean);
    const setting = (sprayer.knownSettings || []).map((id) => settingMap.get(id)).find(Boolean);
    return {
      title: assigned[0]?.name || sprayer.name,
      support: setting?.value || sprayer.operatingNotes,
      meta: [sprayer.name, sprayer.status],
      badge: "dedicated"
    };
  });

  return [
    {
      id: "scotts-elite-spreader",
      label: "Scotts Elite Spreader",
      icon: "applicators",
      summary: "Granular product settings",
      eyebrow: "Granular tool",
      detail: spreader?.operatingNotes || "Primary granular applicator.",
      settingTitle: "Product settings",
      rows: productRows("scotts-elite-spreader")
    },
    {
      id: "ortho-dial-n-spray",
      label: "Ortho Dial N Spray",
      icon: "sprayer",
      summary: "Hose-end liquid settings",
      eyebrow: "Hose-end tool",
      detail: dial?.operatingNotes || "Hose-end liquid applicator.",
      settingTitle: "Product settings",
      rows: productRows("ortho-dial-n-spray")
    },
    {
      id: "pump-sprayer",
      label: "Pump Sprayer",
      icon: "pump",
      summary: "Dedicated sprayer assignments",
      eyebrow: "Dedicated sprayers",
      detail: "One pump sprayer family with separate dedicated assignments.",
      settingTitle: "Assignments",
      rows: pumpRows
    }
  ];
}

function settingSupport(value) {
  if (!value || value === "Not applicable.") return "Setting not needed or not recorded.";
  return value;
}

function hasKnownSetting(value) {
  return Boolean(value) && !/unknown|not recorded|label guidance/i.test(value);
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
  const { systems, zones } = state.data;
  const irrigation = systems.irrigation;
  const activeZones = irrigation.zones.filter((zone) => zone.status === "active");
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
      <h4>Lawn area breakdown</h4>
      <div class="dense-list">
        ${zones.zones.map((zone) => denseItem(zone.name, `${formatNumber(zone.areaSqFt)} sq ft`, zone.irrigationZoneRefs?.length ? `Irrigation Z${zone.irrigationZoneRefs.join(", Z")}` : "")).join("")}
      </div>
    </section>
    <section class="gear-group">
      <h4>Irrigation quick summary</h4>
      <div class="dense-list">
        ${denseItem(irrigation.controller.name, `${activeZones.length} active zones / ${irrigation.activeRuntimePerWateringDayMinutes} min`, `${irrigation.wateringDays.join(" / ")} at ${irrigation.controller.startTime}. No rain sensor.`)}
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

function formatHour(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value.slice(11, 16);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(date);
}

function weatherDayLabel(value, index) {
  if (index === 0) return "Today";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function weatherCodeLabel(code) {
  if ([0, 1].includes(code)) return "Clear";
  if ([2].includes(code)) return "Partly cloudy";
  if ([3, 45, 48].includes(code)) return "Cloudy";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storms";
  return "Forecast";
}

function weatherCodeIcon(code) {
  if ([0, 1].includes(code)) return "sun";
  if ([2].includes(code)) return "partly-cloudy";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) return "rain";
  return "cloud";
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
    next: `<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"></path></svg>`,
    plan: `<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"></path><path d="M8 9h8M8 13h5"></path><path d="M16 16l3 3"></path></svg>`,
    "plan-core": `<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7"></path><path d="M5 5h14v14H5z"></path></svg>`,
    "plan-weather": `<svg viewBox="0 0 24 24"><path d="M7.2 14.7h9.6a3 3 0 0 0 .5-6 5.1 5.1 0 0 0-9.8 1.2h-.3a2.4 2.4 0 0 0 0 4.8Z"></path><path d="M8.5 18.1 7.8 20M12 18.1l-.7 1.9M15.5 18.1l-.7 1.9"></path></svg>`,
    "plan-conditional": `<svg viewBox="0 0 24 24"><path d="M12 4v3"></path><path d="M12 17v3"></path><path d="M4 12h3"></path><path d="M17 12h3"></path><path d="M8.2 8.2l2.2 2.2"></path><path d="M15.8 8.2l-2.2 2.2"></path><path d="M12 13.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z"></path></svg>`,
    "plan-buy": `<svg viewBox="0 0 24 24"><path d="M6 7h12l-1 13H7L6 7Z"></path><path d="M9 7a3 3 0 0 1 6 0"></path><path d="M9 12h6"></path></svg>`,
    gear: `<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"></path><path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5 6.8 15M17.2 9l2.6-1.5"></path></svg>`,
    products: `<svg viewBox="0 0 24 24"><path d="M7 4h10v4l-1.8 2.3V19a2 2 0 0 1-2 2H10.8a2 2 0 0 1-2-2v-8.7L7 8V4Z"></path><path d="M9 8h6M9 14h6"></path></svg>`,
    equipment: `<svg viewBox="0 0 24 24"><path d="M5 18h14"></path><path d="M7 18V9l4-3 6 4v8"></path><path d="M10 18v-5h4v5"></path><path d="M17 10l2-2"></path></svg>`,
    applicators: `<svg viewBox="0 0 24 24"><path d="M7 5h8v5H7z"></path><path d="M9 10v9M13 10v9"></path><path d="M5 19h12"></path><path d="M17 7h2v5"></path><path d="M19 12c-2 1-3.5 2.4-4.5 4"></path></svg>`,
    sprayer: `<svg viewBox="0 0 24 24"><path d="M7 5h8v4H7z"></path><path d="M9 9v10h4V9"></path><path d="M7 19h8"></path><path d="M15 7h3l2 2"></path><path d="M20 9c-1.4.8-2.4 1.8-3 3"></path><path d="M20 13c-1.2.6-2.1 1.4-2.7 2.4"></path></svg>`,
    pump: `<svg viewBox="0 0 24 24"><path d="M8 8h8l1 11H7L8 8Z"></path><path d="M10 8V6a2 2 0 0 1 4 0v2"></path><path d="M9.5 12h5"></path><path d="M11 19v2M13 19v2"></path><path d="M17 10h2v4"></path></svg>`,
    history: `<svg viewBox="0 0 24 24"><path d="M5 5h14v15l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L7 20V5Z"></path><path d="M8 9h8M8 12h8M8 15h5"></path></svg>`,
    property: `<svg viewBox="0 0 24 24"><path d="M4 6c5-2 11 2 16 0v12c-5 2-11-2-16 0V6Z"></path><path d="M8 5v12M16 7v12"></path></svg>`,
    sun: `<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"></path><path d="M12 3.8v2M12 18.2v2M4.8 12h2M17.2 12h2M6.9 6.9l1.4 1.4M15.7 15.7l1.4 1.4M17.1 6.9l-1.4 1.4M8.3 15.7l-1.4 1.4"></path></svg>`,
    cloud: `<svg viewBox="0 0 24 24"><path d="M7.2 17.5h9.6a3.2 3.2 0 0 0 .5-6.4 5.1 5.1 0 0 0-9.8 1.2h-.3a2.6 2.6 0 0 0 0 5.2Z"></path></svg>`,
    "partly-cloudy": `<svg viewBox="0 0 24 24"><path d="M8.2 8.2a3.4 3.4 0 0 1 5.9 2.4"></path><path d="M6.2 5.7 5 4.5M12 3v1.8M3 10.7h1.8"></path><path d="M7.3 18h9.2a3 3 0 0 0 .5-5.9 4.8 4.8 0 0 0-9.2 1.1h-.5a2.4 2.4 0 0 0 0 4.8Z"></path></svg>`,
    rain: `<svg viewBox="0 0 24 24"><path d="M7.2 14.7h9.6a3 3 0 0 0 .5-6 5.1 5.1 0 0 0-9.8 1.2h-.3a2.4 2.4 0 0 0 0 4.8Z"></path><path d="M8.5 18.1 7.8 20M12 18.1l-.7 1.9M15.5 18.1l-.7 1.9"></path></svg>`
  };
  return icons[name] || icons.mark;
}

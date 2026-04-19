const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const filterButtons = document.querySelectorAll(".filter-button");
const monthCards = document.querySelectorAll(".month-card");
const journalForm = document.querySelector("#journal-form");
const entryList = document.querySelector("#entry-list");
const clearFormButton = document.querySelector("#clear-form");
const clearEntriesButton = document.querySelector("#clear-entries");
const entryDate = document.querySelector("#entry-date");
const storageKey = "lawn-dashboard-journal";

function todayIsoDate() {
  const today = new Date();
  const offsetDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function setDefaultDate() {
  if (entryDate && !entryDate.value) {
    entryDate.value = todayIsoDate();
  }
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function formatLabel(label, value) {
  if (!value) {
    return "";
  }
  return `<p><strong>${label}:</strong> ${escapeHtml(value)}</p>`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderEntries() {
  const entries = loadEntries().sort((a, b) => b.date.localeCompare(a.date));

  if (!entries.length) {
    entryList.innerHTML = '<p class="empty-state">No saved entries yet. One short note is enough.</p>';
    clearEntriesButton.hidden = true;
    return;
  }

  clearEntriesButton.hidden = false;
  entryList.innerHTML = entries
    .map((entry) => {
      return `
        <article class="entry-card">
          <h4>${escapeHtml(entry.date)}</h4>
          ${formatLabel("Weather", entry.weather)}
          ${formatLabel("Mowed", entry.mowed)}
          ${formatLabel("Water/rain", entry.water)}
          ${formatLabel("Products/work", entry.products)}
          ${formatLabel("Problems noticed", entry.problems)}
          ${formatLabel("What I did", entry.did)}
          ${formatLabel("Next thing", entry.next)}
        </article>
      `;
    })
    .join("");
}

function collectEntry(formData) {
  const randomId = globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : String(Date.now());

  return {
    id: randomId,
    date: formData.get("date"),
    weather: formData.get("weather").trim(),
    mowed: formData.get("mowed").trim(),
    water: formData.get("water").trim(),
    products: formData.get("products").trim(),
    problems: formData.get("problems").trim(),
    did: formData.get("did").trim(),
    next: formData.get("next").trim()
  };
}

function highlightCurrentMonth() {
  const currentMonth = new Date().getMonth();

  monthCards.forEach((card) => {
    const months = card.dataset.months.split(",").map(Number);
    card.classList.toggle("current", months.includes(currentMonth));
  });
}

function filterCalendar(filter) {
  monthCards.forEach((card) => {
    const shouldShow = filter === "all" || card.dataset.season === filter;
    card.hidden = !shouldShow;
  });
}

navToggle.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    document.body.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    filterCalendar(button.dataset.filter);
  });
});

journalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(journalForm);
  const entry = collectEntry(formData);
  const entries = loadEntries();

  entries.push(entry);
  saveEntries(entries);
  journalForm.reset();
  setDefaultDate();
  renderEntries();
});

clearFormButton.addEventListener("click", () => {
  journalForm.reset();
  setDefaultDate();
});

clearEntriesButton.addEventListener("click", () => {
  if (window.confirm("Clear all saved journal entries from this browser?")) {
    saveEntries([]);
    renderEntries();
  }
});

setDefaultDate();
highlightCurrentMonth();
renderEntries();

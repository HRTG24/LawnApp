# Outdoor Ops Property Field Manual

This is a compact, mobile-first, GitHub Pages friendly outdoor operations utility app for the Wichita-area property context.

The goal is not browser-side data entry. The site is a read-first source of truth that Codex updates after ChatGPT conversations summarize changed decisions, purchases, equipment notes, weather considerations, or seasonal plans.

The app is organized around three fast lookup sections:

- `Plan` - current phase, main recommendation, concise supporting items, and a restrained look-ahead drawer.
- `Gear` - products, equipment, purchase history, and known settings tied to things used or owned.
- `Property` - irrigation, backflow, mulch cycle, outdoor systems, zones, lessons, and sources.

The operating goal is a healthy, low-effort tall fescue lawn and outdoor system with practical timing, good inventory awareness, and sane decisions.

## Files

- `index.html` - the GitHub Pages friendly app shell.
- `styles.css` - mobile-first field-reference styling, bottom navigation, cards, and responsive desktop support.
- `app.js` - JSON data loader and UI renderer.
- `data/profile.json` - property-safe profile, current season, current phase, and weather-aware placeholders.
- `data/seasonal-plan.json` - phase-based seasonal plan with lead-time thinking.
- `data/tasks.json` - current, next, recurring, dependency, and buy-ahead tasks.
- `data/inventory.json` - products/reference inventory with stock-verification notes.
- `data/purchase-history.json` - sanitized purchase history with no private receipt details.
- `data/equipment.json` - mower, spreader, measurement tools, and operating notes.
- `data/systems.json` - irrigation, backflow, mulch beds, and other property systems.
- `data/zones.json` - property/lawn areas with strategies and recommendations.
- `data/known-settings.json` - known settings, lessons learned, and supporting sources.
- `data/ui-config.json` - navigation and home card configuration.
- `.nojekyll` - tells GitHub Pages to serve the static files directly.

## Local Preview

Run a small static server from this folder:

```bash
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

The app fetches local JSON files, so use a static server rather than opening `index.html` directly.

## Update Workflow

1. Discuss lawn/outdoor work, purchases, weather, equipment, or decisions in ChatGPT.
2. Ask ChatGPT to summarize what changed.
3. Ask Codex to update this repo based on the summary.
4. Prefer editing `data/*.json` first. Change UI code only when the structure or presentation needs to evolve.
5. Do not add exact address, phone number, payment details, account identifiers, or other private receipt data to published files.

## Week-To-Week Use

1. When the weekly reminder appears, reply with a rough update: mowed or not, watered or not, anything weird, and how much time you want to spend.
2. Let the advice stay small: usually one to three actions, one thing to monitor, and one thing to ignore.
3. When decisions or facts change, update the structured data files so the site remains the source of truth.
4. Use the annual planning prompt around late February or early March, then again around late August before seeding/fall fertilizer season.

## Low-Effort Rules

- Mow tall, and do not remove more than about one-third of the blade at once.
- Mulch clippings unless they are clumpy, diseased, or smothering the lawn.
- Water deeply and infrequently when the lawn actually needs it.
- Avoid heavy early spring fertilizing.
- Prioritize September and November fertilizer over trying to push growth in hot weather.
- Seed or overseed in the fall when possible.
- Treat weeds and pests only when there is a real reason.
- Follow product labels, especially for herbicides, grub products, fertilizer, pets, kids, and watering-in directions.

## Good Enough Purchases

Buy only when the plan says it is useful:

- Slow-release nitrogen fertilizer for tall fescue.
- Crabgrass pre-emergent for spring, if crabgrass has been an issue.
- Quality turf-type tall fescue seed for fall thin spots or overseeding.
- A simple rain gauge or tuna-can style sprinkler test.
- Soil test through local extension if you have not done one recently or the lawn is declining.

Skip by default:

- Multiple specialty products without a specific problem.
- Routine fungicide unless disease pressure is clear and recurring.
- Grub treatment unless you have history or confirmed damage.
- Chasing perfect color in July and August.

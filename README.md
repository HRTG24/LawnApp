# Lawn Dashboard

A simple static GitHub Pages site for a Wichita, Kansas area tall fescue lawn system.

The site is built with plain HTML, CSS, and JavaScript. It adapts the nearby `Lawn-System` notes into:

- A homepage/dashboard
- A current weekly plan
- An annual lawn calendar
- A browser-saved lawn journal

## Files

- `index.html` - page structure and lawn content
- `styles.css` - responsive visual design
- `app.js` - navigation, calendar filtering, current-month highlighting, and local journal entries
- `.nojekyll` - tells GitHub Pages to serve the static files directly

## Publish On GitHub Pages

1. Commit these files to the repository.
2. Push the branch to GitHub.
3. In GitHub, open the repository settings.
4. Go to **Pages**.
5. Set the source to the branch that contains these files and choose the repository root.
6. Save. GitHub will publish the site at the project Pages URL after the build finishes.

The site uses relative paths, so it works as a GitHub Pages project site such as `https://USERNAME.github.io/REPOSITORY/`.

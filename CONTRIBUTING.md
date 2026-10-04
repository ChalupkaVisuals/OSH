# Contributing to OSH

Thanks for helping out.

## Reporting bugs

Open an issue and include:

- what you did and what happened instead of what you expected
- your browser and version
- if it concerns a specific skin, a link to it or the smallest set of files that shows the problem
- anything printed in the browser console (F12)

## Suggesting features

Open an issue describing the problem you want solved. Missing skin elements or `skin.ini` keys are especially welcome: name the element and where it appears in game.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Run `npm start` and check your change in the browser.
3. Run `npm test`. Add tests for changes to `zip.js`, `ini.js` or `catalog.js`.
4. Keep the project dependency-free: plain ES modules, no build step.
5. Describe what changed and why in the pull request.

### Adding a skin element

Add its name to the right category in `public/js/catalog.js` (append `*` if it can be animated). If it should have a sensible generated default, add a rule in `public/js/gen.js`.

### Adding a skin.ini key

Add a `[key, type, default, description]` entry to the matching section in `public/js/ini.js`.

## Releasing (maintainers)

1. Bump `version` in `package.json`.
2. Add a `## <version>` section to `CHANGELOG.md`.
3. Merge to `main`. CI tags the commit and publishes the release.

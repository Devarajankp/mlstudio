# Contributing to Malayalam Studio

Thank you for helping Malayalam writers! 💚

## Quick start
```bash
git clone https://github.com/Devarajankp/mlstudio && cd mlstudio
npm install
npm run dev            # http://localhost:3000
npm run build          # type-check + production build
npm test               # key-engine stress test
```
Windows app: `npm run build && npm run desktop:prepare && cp -r dist desktop/web && npm run desktop:start` (Windows only).

## Rules that keep the project legally clean
1. **Original work only.** Do not copy code from other editors or keyboard apps. Never copy from AGPL/GPL code.
2. **No unlicensed assets.** Fonts, dictionaries, images and icons need a licence that allows redistribution; add them to `THIRD_PARTY_NOTICES.md`.
3. By submitting a pull request you agree that your contribution is licensed under the project's MIT licence and that you have the right to submit it.
4. Do not add tracking, ads or network calls without an opt-in setting.

## Pull requests
* One topic per PR, small and focused. Describe *what* and *why*, add a screenshot for UI changes.
* Keep `npm run build` green. Keep accessibility: every control needs a name, keyboard access and visible focus.
* Malayalam text: test with Unicode (Noto Sans Malayalam) and legacy fonts if you touch conversion code.

## Releasing (maintainers)
```bash
npm version minor            # 1.2.0 -> 1.3.0  # desktop/package.json is synced automatically
git push --follow-tags       # a tag like v1.3.0 builds the Windows installer and publishes a GitHub Release
```
Pushing to `main` redeploys the website; installed Windows apps pick up web changes automatically (Settings → Updates).

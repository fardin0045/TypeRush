# Deploy TypeRush + TypeFight

This release is a static browser game. Solo racing and fighting opponents are AI; friend matches connect two browsers directly. Solo scores and preferences are saved only in the current browser. No backend, database, login, paid API or environment variables are required. Manual-code browser-to-browser TypeFight is available at `/#/fight/friend`; see [MULTIPLAYER.md](MULTIPLAYER.md). Global leaderboards are not included.

## Prepare a release

Use Node.js 24 LTS, then in C:\projects\TypeRush:

```powershell
npm ci
npm run release
```

`release` is the Windows release command. It runs all checks, builds a new upload ZIP and writes its SHA-256 checksum. On other platforms use `npm run check` and upload the dist folder.

`check` runs 32 unit tests, creates the production build and tests the built site in Chrome with its production security policy. Install Google Chrome for local browser checks. Port 5177 must be available. CI installs Chromium automatically. The output is `dist/`; deploy its contents, not the source project or node_modules. `npm run preview` is for local verification only, not a public production server.

## Free hosting: Vercel (personal, non-commercial projects)

Vercel Hobby is free for personal, non-commercial use, subject to usage limits. For an ad-supported or commercial game, do not assume Hobby is eligible. See https://vercel.com/docs/plans/hobby. Cloudflare Pages is the alternative below.

1. Run `npm ci` and `npm run release` in `C:\projects\TypeRush`. Fix any failed checks before publishing.
2. Create a personal GitHub account/repository if needed. Using GitHub Desktop, choose **File → Add local repository** and select `C:\projects\TypeRush`. If it is not a repository, use the offered **create a repository here** option and confirm the final path is this project (not a nested empty directory).
3. Review the changes, commit, then **Publish repository** to your personal GitHub account. A private repository is fine. Include src, public, tests, scripts, package.json, package-lock.json, vite.config.js, index.html, vercel.json and the dotfiles. The supplied .gitignore excludes node_modules, build output, credentials and local screenshots.
4. Sign into https://vercel.com with GitHub. Choose **Add New → Project**, select the repository and click **Import**.
5. Select the folder containing package.json as **Root Directory** (normally leave it at repository root). Confirm **Framework: Vite**, **Node.js: 24.x**, **Install: npm ci**, **Build: npm test && npm run build**, **Output: dist**. vercel.json supplies the build settings. Leave environment variables empty.
6. Click **Deploy**. Once ready, open the production `https://your-project.vercel.app` address. Share the production domain, not a protected preview URL. Verify it opens in a signed-out/private browser.
7. Run the public-site checks below, especially two devices on different networks.

Updates: run `npm run check`, commit the changed source and push to the production branch. Vercel rebuilds automatically. Its build runs unit tests; the separate GitHub workflow also runs browser tests. GitHub Actions success does not automatically block Vercel publication, so complete local checks before pushing production changes. Use feature branches for preview testing. If a release breaks, open Vercel's Deployments page and roll back to a known-good production deployment; then fix and redeploy.

The Vercel configuration applies the same security policy as Cloudflare and immutable caching only to hashed assets. Hash routes (`/#/fight`) need no catch-all rewrite. No backend, database, payment card upgrade, paid domain or runtime environment variable is needed for this app's static deployment. Provider eligibility and free-plan quotas still apply.

Official Vite deployment reference: https://vercel.com/docs/frameworks/frontend/vite

## Free hosting: Cloudflare Pages (no GitHub required)

The simplest option is a Direct Upload project:

1. Create or sign into a free Cloudflare account.
2. Open **Workers & Pages → Create application → Get started → Drag and drop your files** in the Pages flow. Dashboard wording may vary; select Pages Direct Upload.
3. Choose a project name.
4. Upload the `dist` folder or `release/typerush-site.zip`.
5. Deploy. Cloudflare provides an HTTPS address such as `your-project.pages.dev`.
6. Open the published HTTPS address on a computer and phone. Visit `/#/games`, `/#/race`, `/#/fight`, and `/#/fight/friend`. Test sound and complete a multiplayer code exchange between the devices.
7. Share the HTTPS address with your friends. You do not need to keep your computer or a local dev server running.

To update on Windows, run `npm run release`, then open your existing Pages project → Create a new deployment → Production and upload the newly generated release/typerush-site.zip. If a release causes a problem, use the previous successful deployment’s rollback option in the Pages dashboard. A Direct Upload project cannot later be converted to Git integration; create a separate Git-integrated project if you want automatic deployments.

For automatic deployment from GitHub, create a Pages Git integration project instead. Use framework Vite, build command `npm run build`, output `dist`, and Node.js 24. Commit package-lock.json. The included GitHub Actions workflow runs the unit and production-browser checks on pushes and pull requests. It does not publish the site.

Official documentation:
- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/platform/limits/

Cloudflare Pages offers a Free plan; the supplied pages.dev subdomain avoids buying a domain. Free-plan limits and provider terms apply. No custom domain is necessary.

## Release behavior

- Hash routes work on static hosting without server rewrite rules.
- `public/_headers` adds a Content Security Policy and other security headers on Cloudflare Pages, with immutable caching for hashed bundles and revalidation for HTML. It is copied into dist during builds. `vercel.json` provides the equivalent Vercel configuration; Vercel does not apply `_headers` itself.
- The app uses local assets, including CC0 keyboard recordings. Preserve `audio/mechanical/CREDITS.md` in deployments.
- No analytics, advertising, accounts or third-party tracking are configured. Browser storage contains local results and settings; clearing site data removes them. The hosting provider processes normal web requests under its own terms.
- Keyboard audio requires user interaction and the sound toggle. Reduced motion and pause controls remain available.
- A render error displays a reload screen rather than a blank page.
- Refreshing ends the current game, preserving saved results when browser storage is available.

## Before sharing the public URL

Check the deployed HTTPS URL on a desktop and a real phone: start each game, type, toggle sound, pause/resume, refresh a route, finish a match, and confirm no missing assets. Hosted headers and device audio must be checked on the actual deployment. Keep the previous Pages deployment available for rollback.

Use one device on home Wi-Fi and another on mobile data for the multiplayer check. Exchange fresh invite/reply codes, ready/start, type on both devices, finish and rematch. Test disconnect handling. If the direct connection fails, try another network or disable a VPN; changing static hosting providers does not add a relay.

In browser developer tools → Network, inspect the main document response for Content-Security-Policy and X-Content-Type-Options. Check the Console for errors. Test audio after clicking the sound control. On Vercel, optional preview-toolbar scripts may be blocked by the strict CSP; disable the toolbar rather than weakening the game's policy.

Troubleshooting: build cannot find package.json → correct Root Directory; blank page/missing bundles → deploy dist contents on Cloudflare or the source repository on Vercel; friend sees a login page → share the public production domain and check deployment protection; old version → reload and check the deployment succeeded; failed multiplayer → see the network limitation below.

Verified locally: unit tests, production build, dependency audit, production CSP/browser flows, mobile viewport and corrupt-storage recovery. No hosting deployment has been created by this preparation task.

## Play a friend

TypeFight now supports two devices using manually exchanged WebRTC connection codes, with no application backend or database. Open **Play a friend** in TypeFight. See [MULTIPLAYER.md](MULTIPLAYER.md) for connection steps and network limitations. Solo AI modes are unchanged.

## Release limits

This is ready for a static-hosted casual game release after the local checks pass. It is not a ranked multiplayer service: the host browser is trusted, latency can favor the host, and direct WebRTC cannot connect on every network without a TURN relay. Real-device and public-URL checks remain necessary after deployment. No hosted account, domain or deployment is created by preparing this package.

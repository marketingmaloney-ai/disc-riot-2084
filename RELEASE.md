# Releasing Disc Riot 2084 to the App Store and Google Play

The game is wrapped as a native app with [Capacitor](https://capacitorjs.com): `ios/` (Xcode project) and
`android/` (Android Studio project). The whole web build is bundled inside, so the app runs offline.
Store text, rating answers and privacy answers are in `tools/store/LISTING.md`. Graphics are in `tools/store/out/`.

| Item | Value |
|---|---|
| App ID (both stores) | `com.maloneymarketing.discriot2084`, permanent after the first upload |
| Name | Disc Riot 2084 |
| Version | 1.0 (iOS build 1 / Android versionCode 1) |
| Price | Free: no ads, no purchases, no data collected |
| Orientation / devices | Landscape only; iPhone (not iPad); Android phones |

## 1. Accounts (one time)
1. **Apple Developer Program**, $99/year: enroll at https://developer.apple.com/programs/enroll/.
   - *Individual:* fastest, but your personal legal name is shown as the seller.
   - *Organization:* shows a company name, but needs a D-U-N-S number (free) and takes longer.
   - Approval usually takes 1–2 days.
2. **Google Play Console**, $25 one time: sign up at https://play.google.com/console/signup and complete identity verification.
   - New *personal* accounts must run a **closed test with at least 12 testers for 14 days** before production. Start that early.

## 2. Build on the Mac (one time setup)
- Xcode, from the Mac App Store. Android Studio, from https://developer.android.com/studio. Node 20 or later.
- Then, in the repo:
  ```
  git pull
  npm ci
  npm run app:sync        # builds the game and copies it into ios/ and android/
  ```
  Run `npm run app:sync` again after every game change, before building the apps.

## 3. Privacy policy URL
Both stores need a public privacy-policy link. It's published at https://claude.ai/artifact/SNVH5YCwZMoJvbwwtevfc2.
Open it, choose **Share → Anyone with the link**, and use that link as both the Privacy Policy URL and the Support URL.
(Source: `tools/store/privacy.html`.)

## 4. iOS: App Store
1. `npm run app:ios` opens Xcode.
2. Select the **App** target → *Signing & Capabilities* → tick *Automatically manage signing* → pick your Team.
3. Pick **Any iOS Device (arm64)** as the destination, then **Product → Archive**.
4. In the Organizer: **Distribute App → App Store Connect → Upload**.
5. In https://appstoreconnect.apple.com: **Apps → + → New App**.
   - Platform iOS, name *Disc Riot 2084*, language English, bundle ID `com.maloneymarketing.discriot2084`, SKU `discriot2084`.
6. Fill in the listing from `tools/store/LISTING.md`:
   - Subtitle, description, keywords, category and age-rating answers.
   - **App Privacy:** "Data Not Collected".
   - Screenshots: `tools/store/out/appstore/` (2868×1320, the 6.9" iPhone size).
7. When the uploaded build finishes processing (about 15–30 minutes), select it, set the price to Free, and **Submit for Review**.
   - Review usually takes 1–3 days.
   - Test on your own iPhone first through **TestFlight**: same upload, no review needed for internal testers.

## 5. Android: Google Play
1. `npm run app:android` opens Android Studio. Let Gradle finish syncing.
2. **Build → Generate Signed App Bundle / APK → Android App Bundle**.
   - Create a new upload keystore when asked.
   - **Back up the keystore file and both passwords somewhere safe** (a password manager). You need them for every future update.
3. The signed `.aab` file lands in `android/app/release/`.
4. In Play Console: **Create app** → name *Disc Riot 2084*, game, free.
5. Fill in the store listing, content rating (IARC), data safety ("no data collected"), target audience (13+) and ads ("no") from `tools/store/LISTING.md`.
   - Graphics: `tools/store/out/play-icon-512.png`, `play-feature-1024x500.png`, and the screenshots in `tools/store/out/play/`.
6. **Testing → Closed testing:** create a track, upload the `.aab`, add 12+ testers' emails, and roll out. After 14 days, apply for production.

## Updating later
- Bump the version in both places:
  - iOS: Xcode → target → General → *Version* and *Build*.
  - Android: `android/app/build.gradle` → `versionCode` (+1) and `versionName`.
- Then `npm run app:sync`, and archive/upload again as above.

## Regenerating art
- Icon, splash and Play feature graphic: `node tools/store/render.mjs`, then copy `tools/store/out/icon-1024.png` → `assets/icon-only.png` and the splash → `assets/splash.png`, then `npx capacitor-assets generate --iconBackgroundColor '#12052a' --splashBackgroundColor '#12052a'`.
- Store screenshots: capture with `node tools/store/shots_raw.mjs OUTDIR` (dev server running), pick the best into `tools/store/shots/`, then run `node tools/store/render_shots.mjs`.
- These scripts need Playwright (`npm i -D playwright`).

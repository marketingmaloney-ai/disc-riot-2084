# Store listing — Disc Riot 2084

Copy and paste into App Store Connect / Google Play Console. Character limits are noted; every field fits.
Graphics are in `tools/store/out/` (regenerate with `node tools/store/render.mjs` and `node tools/store/render_shots.mjs`).

## Shared facts
- **Price:** Free. No ads, no in-app purchases, no accounts.
- **App ID / bundle ID / package name:** `com.maloneymarketing.discriot2084` (permanent once uploaded)
- **Orientation:** landscape only. **Devices:** iPhone (not iPad), Android phones.
- **Data:** none collected. Upgrade progress is stored only on the device.
- **Privacy policy URL:** _(publish `tools/store/privacy.html`, see RELEASE.md step 3)_
- **Support URL:** same page, or any page with a contact email.
- **Copyright line:** `© 2026 [your name or company]`

---

## Apple App Store

**Name** (30): `Disc Riot 2084`

**Subtitle** (30): `Neon Arcade Disc Battles`

**Promotional text** (170, editable any time without review):
`Four fighters. Four neon arenas. One glowing disc. Curve it, bank it off the walls and blast it into the 5-point zone in fast 80s arcade duels.`

**Description** (4000):
```
Welcome to 2084, where the hottest sport on the neon coast is the disc.

DISC RIOT 2084 is a fast, two-player arcade disc battle in the spirit of the 80s and 90s arcades. Throw, curve, lob and smash a glowing disc past your opponent and into their goal. Hit the 5-point zone for a big score, and win the set before the 30-second clock runs out.

ARCADE ACTION
• Lightning-fast rallies built for touch, keyboard or controller
• Curve shots, wall banks, lobs and blocks
• Perfectly time a catch for a supersonic power shot
• Charge your super and unleash it with a full-screen cut-in
• Catch an incoming super at the last moment to fire it straight back

4 FIGHTERS, 4 SUPERS
• Vega Starr, the Miami speed-shooter, with LASER SURF
• Kaito "Riptide" Mori, the Neo-Tokyo trickster, with GLITCH STORM
• Roxy Voltage, Rio's lightning powerhouse, with THUNDER KISS
• Brick Diamond, the Gold Coast tank, with METEOR SLAM

4 NEON ARENAS
Sunset Strip, Neon Pier, Laser Lagoon and Orbital Cabana, each with its own goal zones and soundtrack.

LEVEL UP
Unlock achievements against the CPU to earn upgrade points for Speed, Power, Technique and Reflex.

PLAY YOUR WAY
• VS CPU at Easy, Normal or Hard
• 2-player versus with game controllers
• Fully offline. No ads, no in-app purchases, no account.

Music by SEVEN SPACE, The Dog Above, Electron Project, OptiKill and zero-project (CC BY 3.0). Sound effects by Kenney (CC0) and Gregor Quendel (CC BY 4.0). Full credits in the game.
```

**Keywords** (100, comma-separated, no spaces needed):
`disc,frisbee,arcade,retro,synthwave,80s,sports,versus,neon,beach,2 player,fighter,throw,classic`

**Category:** Games, with **Sports** as primary and **Arcade** as secondary.

**What's New (first release):** `First release. Welcome to the riot!`

### Age rating questionnaire (expected result: 13+)
| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | Infrequent/Mild (players get knocked down by the disc) |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Mature or Suggestive Themes | Infrequent/Mild (pin-up style swimwear characters) |
| Profanity, Horror, Alcohol/Drugs, Gambling, Contests | None |
| Unrestricted web access | No |
| User-generated content, chat, messaging | No |

### App Privacy
**Data Not Collected.** No tracking, no third-party SDKs.

### Export compliance
Already answered in the app (`ITSAppUsesNonExemptEncryption = NO`): the app uses no encryption beyond the operating system's.

### Screenshots
`tools/store/out/appstore/*.jpg`: six 2868×1320 images, the 6.9-inch iPhone landscape size. Apple scales them for smaller iPhones. Upload in file-name order.

---

## Google Play

**App name** (30): `Disc Riot 2084`

**Short description** (80): `Neon 80s arcade disc battles: curve, bank and smash your way to victory!`

**Full description** (4000): use the App Store description above.

**Category:** Game, Sports. **Tags:** Arcade, Sports, Retro, Offline.

**Graphics**
- App icon: `tools/store/out/play-icon-512.png` (512×512)
- Feature graphic: `tools/store/out/play-feature-1024x500.png`
- Phone screenshots: `tools/store/out/play/*.jpg` (six 1920×1080)

### Content rating (IARC questionnaire, expected result: Teen / PEGI 12)
Category: Game. Violence: mild cartoon/fantasy violence, no blood. Sexuality: suggestive themes (mild, swimwear). No language, controlled substances, gambling, user interaction or sharing of location or personal info.

### Data safety
- Does your app collect or share user data? **No.**
- Is data encrypted in transit? Not applicable (no data leaves the device).
- Can users request deletion? Not applicable. Deleting the app removes all saved progress.

### Target audience
Ages 13+. It is **not** designed for children, so answer "No" to "appeals to children".

### Ads
**No**, the app contains no ads.

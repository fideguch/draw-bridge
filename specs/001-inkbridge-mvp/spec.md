# Feature Specification: InkBridge MVP — Line-Drawing Physics Puzzle (Chapter 1)

**Feature Branch**: `001-inkbridge-mvp`  
**Created**: 2026-07-07  
**Status**: Draft  
**Input**: User description: "Bridge the requirements_designer output (designs/, quality score 93/92) into spec-kit format for the InkBridge MVP: a line-drawing physics puzzle where a single drawn stroke solidifies into a segmented, deformable bridge and an auto-driving car is judged by physics. Scope: Chapter 1 (15 levels + 3 bonus levels), star ratings, coins, 2-axis upgrades, full mandatory juice, in-game level editor, 4-gate CI validation pipeline, native mobile shell, and platform interfaces (no SDKs bundled)."

## User Scenarios & Testing *(mandatory)*

> All 26 functional requirements in designs/functional_requirements.md are Must priority (MVP ship conditions), so all 24 user stories below inherit Priority P1. Ordering follows the epic structure (Draw → Run & Judge → Juice → Progression → Growth → Play Anywhere → Author & Guard); User Story 1 alone is a viable demonstrable slice (draw → launch → clear).

### User Story 1 - Draw, release, and the car crosses your bridge (Priority: P1)

As a player, I drag one finger to draw a single line; the instant I release, the line becomes a bridge and the car launches on its own — no instructions needed. This is the core "create → be judged" experience of the entire game.

**Why this priority**: Sources FR-001 (one-stroke drawing), FR-003 (commit & solidify), FR-005 (auto launch & run). This is the irreducible core loop; without it nothing else has value. It is also the minimal viable slice: one level, one stroke, one run.

**Independent Test**: Can be fully tested by dragging one stroke in Level 1 and releasing: the stroke becomes a physical bridge, the car launches automatically, and Level 1 is clearable within 25 seconds with no further input.

**Acceptance Scenarios**:

1. **Given** the drawing phase, **When** the player drags on screen, **Then** the line tip follows the raw touch coordinates in the same frame (≤16.7ms at 60fps) and smoothing is applied only to past vertices.
2. **Given** a drawn line, **When** the finger is released, **Then** a confirm pop (scale 1.0→1.06→1.0 / 120ms) + confirm sound + light haptic fire, and the line is solidified into a segmented capsule-chain bridge that settles and sags slightly under its own spring behavior.
3. **Given** solidification completes, **When** the launch sequence runs, **Then** the car auto-launches after a fixed 0.3–0.5s anticipation, and no player input exists during the run (only the drawn line is judged).
4. **Given** a first-time play of Level 1, **When** the player draws a line and releases, **Then** the run completes with zero additional input and Level 1 can be cleared within 25 seconds.

---

### User Story 2 - Drawing feels alive in hand and ear (Priority: P1)

As a player, while I am drawing, the line's look, sound, and particles respond continuously to my finger, so the act of drawing itself is pleasurable and invites redrawing.

**Why this priority**: Sources FR-001 (drawing) and FR-010 (drawing juice). "Drawing the line" is the first of the three dopamine scenes that receive priority development resources per the constitution.

**Independent Test**: Can be fully tested by drawing at varying speeds and confirming the loop sound tracks drag speed (volume 0.3–1.0, pitch 1.0–1.2) and stops within 30–50ms when the finger stops.

**Acceptance Scenarios**:

1. **Given** drawing in progress, **When** drag speed changes, **Then** the pen/marker loop sound tracks speed continuously with volume 0.3–1.0 and pitch 1.0–1.2.
2. **Given** drawing in progress, **When** the finger stops, **Then** the loop sound stops with a 30–50ms fade ("motion = sound" agreement).
3. **Given** a drag, **When** vertices are added, **Then** new vertices appear at a minimum spacing of 4–8px, and the line renders at 2–3% of screen width (8–12pt at 375pt width), round caps and joints, high-contrast solid color with a 1–2px darker outer border.
4. **Given** sound is OFF in settings, **When** drawing, **Then** no audio plays but drawing remains fully functional.

---

### User Story 3 - Ink remaining is visible at a glance (Priority: P1)

As a player, I always see the remaining drawable length (ink) as a bar, so I can treat "how long and thick I dare to draw" as a strategic bet toward a 3-star rating.

**Why this priority**: Sources FR-002 (ink budget management). Ink is the game's strategic resource and the input to star ratings; its constant visibility implements trust pattern P1 (Visibility).

**Independent Test**: Can be fully tested by drawing until depletion and confirming the bar decreases in real time with the green/yellow/red color bands and fires the depletion feedback at zero.

**Acceptance Scenarios**:

1. **Given** drawing in progress, **When** the line grows, **Then** the bar decreases in the same frame, colored green above 50%, yellow at 20–50%, and red with a 300ms-period blink below 20%.
2. **Given** ink remaining is 0, **When** the player keeps dragging, **Then** no further drawing occurs and a "whiff" miss sound + horizontal bar shake of 4–6px over 150ms + warning haptic fire.
3. **Given** Ink Capacity upgrades are owned, **When** a level starts, **Then** the bar initializes to the level's ink budget with +10% per level applied as a real multiplier.

---

### User Story 4 - Instant retry, always (Priority: P1)

As a player, I can restart at any moment with one tap — while drawing, mid-run, or even mid-collapse — so rethinking my line is itself fun and frustration never accumulates.

**Why this priority**: Sources FR-004 (restart control), FR-008 (failure judgement), FR-013 (lightweight fail presentation). "Fail → retry ≤ 1s" is a tempo-contract pass/fail item and a pillar of the no-punishment design (trust pattern P2).

**Independent Test**: Can be fully tested by tapping the persistent restart button during the run phase and measuring return to the initial drawing-phase overview within 1 second without a confirmation dialog.

**Acceptance Scenarios**:

1. **Given** the drawing or run phase (including mid-collapse), **When** the persistent restart button is tapped, **Then** the level returns to its initial state (drawing-phase static overview) within 1 second, with no confirmation dialog.
2. **Given** the fail result screen, **When** Retry is tapped, **Then** play resumes within 1 second, and the fail presentation is limited to a light dim + one short sad sound.
3. **Given** a reset in progress, **When** the button is tapped repeatedly, **Then** exactly one reset executes (no multi-reset).
4. **Given** a failure or restart, **When** play resumes, **Then** zero lives, stamina, penalties, or wait timers apply.

---

### User Story 5 - Anticipation-to-launch ritual builds excitement (Priority: P1)

As a player, right after my line commits, the car "charges up and then bursts forward", so anticipation of my bridge being judged is maximized.

**Why this priority**: Sources FR-005 (auto launch) and FR-011 (launch/run juice). "The car launching" is the second dopamine scene; anticipation → release is its specified emotional shape.

**Independent Test**: Can be fully tested by committing a line and observing the fixed 0.3–0.5s anticipation (rev pitch rise, squash, wheel spin) followed by the simultaneous release burst.

**Acceptance Scenarios**:

1. **Given** a committed line, **When** the launch sequence starts, **Then** a fixed, non-skippable 0.3–0.5s anticipation plays: engine rev pitch 1.0→1.4, chassis back-tilt squash, wheel spin with rearward smoke.
2. **Given** anticipation completes, **When** release fires, **Then** 10–20 dust particles burst + chassis forward stretch (1.15 horizontal / 0.9 vertical, recovering in 100ms) + bass-heavy launch sound + medium haptic fire simultaneously.
3. **Given** the run, **When** speed changes, **Then** engine pitch tracks 1.0–1.5 with 0.25-step gear stepping, wheels rotate synchronized to true speed, and the camera follows with lerp coefficient 0.08–0.15 at 60fps plus look-ahead of 1–2 car lengths (speed-proportional), including a launch camera kick of 8–16px opposite the travel direction recovering in 0.3s.
4. **Given** Engine Speed upgrades are owned, **When** running, **Then** motor speed is multiplied by +5% per level.

---

### User Story 6 - My bridge bends, creaks, and breaks (Priority: P1)

As a player, my drawn bridge genuinely sags under the car's load, creaks near its limit, and snaps when it exceeds it, so every run carries the tension of "will it hold?" and the catharsis of barely holding — or collapsing. This is the game's single biggest differentiator.

**Why this priority**: Sources FR-006 (stress/creak/break). Every commercial competitor uses a single rigid body; this experience is unimplemented in the genre and is the product's primary differentiation.

**Independent Test**: Can be fully tested by driving a heavy load over a thin bridge and observing stress-linked creak feedback in the 0.6–1.0 band and joint breakage with partial collapse above 1.0.

**Acceptance Scenarios**:

1. **Given** the car on the bridge chain, **When** a joint's stress (smoothed by EMA with coefficients 0.85/0.15) enters the 0.6–1.0 band, **Then** creak SFX volume/pitch, segment color interpolation white→yellow→red, dust particles, and weak repeated haptics all track the stress value.
2. **Given** a joint with stress > 1.0, **When** it breaks, **Then** the joint is destroyed causing partial collapse, with crack sound + debris particles + camera trauma +0.5 + fracture highlight (the drawn path splits at the break point with a jagged edge).
3. **Given** orphaned chain fragments after a break, **When** a few seconds elapse (tuning-managed, initial 3.0s), **Then** they stop colliding with the car and fade out.
4. **Given** the single-rigid-body fallback mode is active, **When** running, **Then** no stress or break occurs and the bridge shows visual-layer-only bending.

---

### User Story 7 - Chase 3 stars by spending less ink (Priority: P1)

As a player, the less ink I spend to cross, the higher my star rating, so even after clearing I want to return and draw thinner and shorter.

**Why this priority**: Sources FR-007 (clear judgement & star rating). Star ratings driven by ink consumption create the replay motivation loop without blocking progression.

**Independent Test**: Can be fully tested by clearing the same level with different ink consumption amounts and confirming the 3-threshold star assignment.

**Acceptance Scenarios**:

1. **Given** the vehicle reference point enters the goal-flag judgement rectangle, **When** the clear confirms, **Then** stars are computed from ink consumed vs the level's two thresholds: consumption ≤ star3 threshold → 3 stars; ≤ star2 threshold → 2 stars; otherwise 1 star.
2. **Given** a 1-star clear, **When** progression updates, **Then** the next level still unlocks (zero progression blocking by stars).
3. **Given** clear and fail conditions met in the same tick, **When** judged, **Then** clear wins (player-favorable interpretation).

---

### User Story 8 - Failure cause is visible at a glance (Priority: P1)

As a player, when I fail, the game shows me exactly where the limit was exceeded, so I attribute the loss to my own line and retry with a hypothesis ("next time I'll support that spot").

**Why this priority**: Sources FR-008 (failure judgement & causality). Failure-cause legibility is the physics version of a "cause banner" and implements trust pattern P3 (failure without punishment).

**Independent Test**: Can be fully tested by causing a break-induced fall and confirming the fracture highlight stays visible on the fail result screen.

**Acceptance Scenarios**:

1. **Given** a break-caused collapse drops the car, **When** failure confirms, **Then** the broken joint position (fracture highlight) remains displayed through the fail result.
2. **Given** the car roof stays grounded continuously for 0.5s (initial value), **When** overturn is judged, **Then** the overturned chassis is highlighted and failure confirms.
3. **Given** the vehicle reference point drops below the level's kill boundary (killY), or elapsed ticks exceed the limit (initial 30s = 1800 ticks), **When** failure confirms, **Then** the fall point or a timeout cause is shown and Retry activates immediately.
4. **Given** any failure, **When** the result shows, **Then** zero point-deduction displays, taunting copy, or reward reductions appear (not punitive).

---

### User Story 9 - Collect coins rhythmically while driving (Priority: P1)

As a player, I scoop up coins mid-run in a rhythm, with the pickup sound rising as I chain them, so a good line converts directly into reward and combo pleasure.

**Why this priority**: Sources FR-009 (coin collection & rewards). Coins are the sole economy inflow and double as level path guidance; the rising-pitch combo is a mandatory juice item.

**Independent Test**: Can be fully tested by driving through an arch of coins and confirming per-pickup pop, sparkles, and +1 semitone rising pitch per consecutive pickup.

**Acceptance Scenarios**:

1. **Given** the run phase, **When** the car touches a coin, **Then** the coin is collected with a pop (scale 1.0→1.3→0 / 150ms) + 4–8 sparkle particles, and the pickup sound rises +1 semitone (×1.0595) per consecutive pickup, capped at +12 semitones, resetting after a 1–1.5s gap.
2. **Given** a clear confirms, **When** rewards are credited, **Then** the clear reward of 20–30 coins (roughly constant per level) plus in-level collected coins are added to the balance, and an earn_virtual_currency event is recorded.
3. **Given** a failure or restart, **When** the run ends, **Then** coins collected in that run are NOT credited and return to their initial placement (balance is credited only when a clear confirms).
4. **Given** a clear with zero coins collected, **When** rewards are credited, **Then** the clear reward is still paid in full (coins guide the path; they are not mandatory).

---

### User Story 10 - The 5-beat goal celebration delivers catharsis (Priority: P1)

As a player, at the goal moment time freezes, then confetti, stars, and rewards cascade in sequence, so the achievement of crossing is celebrated with my whole body and momentum carries me to the next level.

**Why this priority**: Sources FR-012 (5-beat goal celebration). "Goal" is the third dopamine scene; its 5-beat structure with concrete parameters is a requirement, not a suggestion (constitution II).

**Independent Test**: Can be fully tested by clearing any level and verifying the 5 beats play in order within a 3–4 second total, with Next tappable ≤1.0s from the clear (user directive 2026-07-08; decoupled from the afterglow, which continues behind the active panel).

**Acceptance Scenarios**:

1. **Given** goal contact, **When** the celebration plays, **Then** the 5 beats run in order: ① hit-stop 80–120ms full freeze; ② slow-motion at timeScale 0.3 held 0.3–0.5s real time then recovering to 1.0 over 0.2–0.3s (physics stepping scaled in sync; camera zooms in 15–25%); ③ two-stage confetti — two side cannons of 40–60 pieces each (angled 45–70°, 30° spread) then, 0.3s later, a top rain of 60–100 pieces over 2–3s (rotation ±720°/s, gravity 0.2–0.4×, two pop sounds offset 50ms + heavy haptic); ④ stars appearing at 200–300ms intervals, each scaling 0→1.3→1.0 over 250ms with shockwave rings, a rising do–mi–sol arpeggio, cymbal only on the third, haptics stepping light→medium→heavy; ⑤ reward count-up over 0.8–1.5s with tick sounds every 30–60ms rising in pitch 1.0→1.3, plus a coin burst of 10–30 coins flying to the counter (20–40ms stagger, 0.4–0.6s each, semitone-rising chime per arrival, counter scale punch 1.0→1.2→1.0 / 100ms) — total 3–4 seconds.
2. **Given** a clear, **When** the results panel appears (~600ms), **Then** the Next button activates 0.3s later — tappable ≤1.0s from the clear (user directive 2026-07-08, decoupled from the afterglow) — with a scale-in pop then a ±5% pulse at 0.8s period, and Replay alongside.
3. **Given** the goal instant, **When** audio mixes, **Then** background music ducks −6 to −9dB over 0.2s so effects stand out.
4. **Given** the hit-stop budget (1–2 per level, shared with the biggest crash) is exhausted, **When** beat 1 would play, **Then** beat 1 is omitted and beats 2–5 run.

---

### User Story 11 - Every celebration is skippable (Priority: P1)

As a player, any celebration is dismissed with a single tap, so replay tempo is never stolen by presentation and I can clear many levels in a short break.

**Why this priority**: Sources FR-012 and FR-013. Full skippability and the ≤40s loop are numeric tempo-contract items protecting against "juice killing tempo" (risk #10).

**Independent Test**: Can be fully tested by tapping during any celebration beat and confirming instant skip to final static values with Next/Replay immediately active and no value changes.

**Acceptance Scenarios**:

1. **Given** any beat of the goal celebration, **When** the screen is tapped, **Then** the entire celebration skips immediately, the confirmed star/coin values display statically, Next/Replay activate at once, and skipping changes zero saved values.
2. **Given** a failure, **When** the result shows, **Then** presentation is a light dim + one short sad sound only, with no confetti, slow-motion, or count-up style reward effects reused.
3. **Given** one full loop (draw → run → goal celebration → next level shown), **When** measured, **Then** it completes within 40 seconds.

---

### User Story 12 - Haptics I can feel — and switch off (Priority: P1)

As a player, line commit, launch, and star reveals come back as fingertip vibration (and on the train I can turn it all off), so I sense my actions landing without staring at the screen, and I stay in control of the experience.

**Why this priority**: Sources FR-014 (haptics integration) and FR-020 (settings). A single event→haptic mapping guarantees consistency (trust pattern P4); individual OFF is user control (P2).

**Independent Test**: Can be fully tested by firing each mapped game event and verifying the exact mapped haptic response, then disabling haptics and verifying zero firings.

**Acceptance Scenarios**:

1. **Given** the events line-commit / launch / landing / break-creak / star reveal / ink depletion, **When** each fires, **Then** haptics follow the single mapping table exactly (commit = light / tick-primitive 0.6; launch = medium / thud-primitive 0.8; landing = heavy / thud-primitive 1.0, big jumps only; break & creak = weak repeated; stars = light→medium→heavy ascending; depletion = warning), all routed through the haptics interface.
2. **Given** an Android device where the startup capability check finds any unsupported haptic primitive, **When** haptics play, **Then** an amplitude-based fallback is used so no "only some events are silent" inconsistency occurs.
3. **Given** haptics OFF in settings, **When** any event fires, **Then** zero haptic firings occur; the change applies immediately and persists.
4. **Given** touch input, **When** a haptic fires, **Then** touch→haptic latency is ≤100ms.

---

### User Story 13 - Learn everything in the first 3 levels, without reading (Priority: P1)

As a player, I learn the whole game by succeeding three times in a row across the first three levels — without reading a single word — so within the first minute I'm convinced this game is for me.

**Why this priority**: Sources FR-017 (FTUE). The target player does not read tutorials; the 60–90s / 45s / ≤25s numbers are tempo-contract pass/fail items.

**Independent Test**: Can be fully tested by a fresh install: Level 1 shows only a finger-trace guide, first success occurs within 10 seconds of first touch, and Levels 1–3 complete in 60–90 seconds total.

**Acceptance Scenarios**:

1. **Given** first launch on Level 1, **When** playing, **Then** zero tutorial text appears; only a finger-icon trace-guide animation (arcing over the valley) shows, and the first success occurs within 10 seconds of first touch (Level 1 is a narrow valley with generous ink where failure is difficult).
2. **Given** first launch, **When** 45 seconds have elapsed, **Then** the player has experienced one full pleasure loop (draw → run → 5-beat goal celebration) at least once.
3. **Given** Level 1 start, **When** playing through Level 3 clear, **Then** three consecutive successes complete in 60–90 seconds total (Level 2 teaches the ink meter and star relation; Level 3 consolidates success).
4. **Given** a line that ignores the guide, **When** playing Level 1, **Then** it is still clearable (the guide is not mandatory); after a Level 1 failure, the trace guide replays at retry start.

---

### User Story 14 - Pick levels and re-earn best stars (Priority: P1)

As a player, the chapter map shows my stars and progress at a glance and lets me replay any unlocked level, so my accumulation is always visible and 3-star completion is a self-paced pursuit.

**Why this priority**: Sources FR-015 (level load & progression) and FR-016 (level select). Progress visibility implements trust patterns P1/P6; best-star retention protects the player's record.

**Independent Test**: Can be fully tested by clearing a level with 3 stars, replaying for 1 star, and confirming the map still shows 3 stars.

**Acceptance Scenarios**:

1. **Given** the level select screen, **When** displayed, **Then** each of Chapter 1's 15 levels + 3 bonus levels shows its stars (0–3), clear state, and lock state, with bonus levels visually distinct from normal levels.
2. **Given** a replay of a cleared level scoring below the record, **When** saved, **Then** display and storage keep the best value (zero overwrites with lower results).
3. **Given** a locked level, **When** tapped, **Then** no transition occurs; the lock icon shakes and a "clear the previous level" message conveys the unlock condition.
4. **Given** the home screen, **When** launching the app, **Then** play starts within 2 taps, and the result→next-level transition completes within 1 second.

---

### User Story 15 - Earn big in bonus levels (Priority: P1)

As a player, every 5 levels a reward bonus level lets me earn a pile of coins at once, so "almost at the bonus" keeps my session going and funds my upgrades.

**Why this priority**: Sources FR-009 and FR-015. Bonus levels are the economy's pacing device and the future rewarded-ad connection point (v1.1).

**Independent Test**: Can be fully tested by clearing Level 5 and confirming a bonus level appears whose clear pays 5–10× a normal level's reward.

**Acceptance Scenarios**:

1. **Given** clearing Level 5 / 10 / 15, **When** progression updates, **Then** a bonus level appears (3 in total).
2. **Given** clearing a bonus level, **When** rewarded, **Then** the payout is 5–10× a normal level's (initial value 6× = 150 coins).
3. **Given** the level select screen, **When** bonus levels display, **Then** they are visually distinct from normal levels.

---

### User Story 16 - Upgrades genuinely change the game (Priority: P1)

As a player, I spend saved coins on ink capacity and car speed and definitely feel the difference next run, so the earn → grow → new solutions loop stays credible.

**Why this priority**: Sources FR-018 (coin economy) and FR-019 (upgrade purchase). Real physics-multiplier effects (dummy effects forbidden) are a design principle; consistent balance display implements trust pattern P1.

**Independent Test**: Can be fully tested by purchasing one Ink Capacity level and confirming the next level starts with an ink budget exactly 10% larger.

**Acceptance Scenarios**:

1. **Given** balance ≥ price, **When** Ink Capacity is purchased, **Then** the balance decreases immediately, the level increments, and from the next level played the ink budget is multiplied by +10% per level (cap 5 levels; zero dummy effects).
2. **Given** Engine Speed levels owned, **When** running, **Then** motor speed is multiplied by +5% per level (cap 5 levels), preserving the "more speed = more drawing precision demanded" risk/return.
3. **Given** the price ladder, **When** levels advance, **Then** prices follow first purchase 50–100 coins with soft-exponential growth ×1.15–1.25 per level (reference values: first 75, growth ×1.20, both axes priced identically, both axes maxed ≈ 1,120 coins).
4. **Given** any balance change, **When** home, shop, and result screens display, **Then** all three show the same value in the same format.

---

### User Story 17 - Price and effect are clear before buying (Priority: P1)

As a player, before purchasing I see exactly what it costs and what improves by how much, so I buy without regret and without a tempo-breaking confirmation dialog.

**Why this priority**: Sources FR-019. Friction is created by price visibility, not dialogs — trust pattern P5 (appropriate friction) applied to a reversible-feeling but undoable purchase.

**Independent Test**: Can be fully tested by opening the shop with insufficient balance and confirming the buy button is disabled with the shortfall displayed, and no transaction occurs on tap.

**Acceptance Scenarios**:

1. **Given** the shop screen, **When** each axis displays, **Then** current level, price (displayed large), and next-level effect are shown numerically and visually (e.g., ink bar extension preview) before purchase.
2. **Given** insufficient balance, **When** viewing the buy button, **Then** it is disabled with the shortfall amount shown, and tapping causes no transaction (the balance ≥ 0 invariant is never violated).
3. **Given** an axis at max level, **When** displayed, **Then** it shows "MAX" and the buy button is disabled.
4. **Given** rapid repeated taps on the buy button, **When** processed, **Then** exactly one purchase executes (zero double purchases).

---

### User Story 18 - Progress never disappears (Priority: P1)

As a player, my stars, coins, upgrades, and settings all survive without any action from me — even if the app is killed or the battery dies — so I play free of the fear of losing what I've built.

**Why this priority**: Sources FR-021 (progress persistence). "Progress loss" is the largest complaint against competitors; automatic atomic saving with corruption recovery is the direct answer (trust patterns P3/P6).

**Independent Test**: Can be fully tested by clearing a level, force-killing the app, relaunching, and confirming stars, coins, and unlock state are fully restored.

**Acceptance Scenarios**:

1. **Given** the events level end (clear or fail), upgrade purchase, and settings change, **When** each occurs, **Then** level progression, best stars, coin balance, upgrade levels, and settings are auto-saved atomically with a schema version attached (zero user save actions).
2. **Given** a force-killed app, **When** relaunched, **Then** state restores to the most recent level end.
3. **Given** corrupted save data (parse failure or schema mismatch), **When** loading, **Then** partial restore is attempted (recover readable items); only if that also fails is data initialized WITH a "progress could not be restored" notification (zero silent resets).
4. **Given** a write failure (storage full, I/O error), **When** saving, **Then** the last good data is retained and saving retries at the next save trigger.

---

### User Story 19 - Progress reset cannot happen by accident (Priority: P1)

As a player, only full progress erasure requires a two-stage confirmation, so a stray tap in settings can never cost me my stars and coins.

**Why this priority**: Sources FR-020 (settings). The inverse of purchase friction: strong friction exclusively on the one irreversible destructive action (trust pattern P5).

**Independent Test**: Can be fully tested by starting a progress reset and cancelling at each stage, confirming zero data changes, then completing both stages and confirming a clean initial state with settings retained.

**Acceptance Scenarios**:

1. **Given** progress reset tapped in settings, **When** both confirmation stages pass (① "Really reset?" confirm → ② "All stars and coins will be lost" warning + typed-string confirmation), **Then** initialization executes: only Level 1 unlocked, 0 coins, upgrades at level 0, with sound/haptics settings retained at current values.
2. **Given** either confirmation stage, **When** cancelled, **Then** progress data changes zero and the settings screen returns.
3. **Given** the sound/haptics toggles, **When** changed, **Then** they apply immediately and persist with no confirmation (friction is reserved for irreversible actions only).

---

### User Story 20 - Smooth 60fps on my ordinary phone (Priority: P1)

As a player on a mid-tier (not flagship) phone, the game runs smoothly, so the bridge physics and the exhilaration are never degraded by my device.

**Why this priority**: Sources FR-023 (native mobile shell). 60fps with physics step p95 ≤ 4ms on mid-tier Android is KPI-001, the foundation quality gate for all three dopamine scenes.

**Independent Test**: Can be fully tested by running the native build on a mid-tier Android device and reading the debug overlay: sustained 60fps with physics step p95 ≤ 4ms through all 18 levels.

**Acceptance Scenarios**:

1. **Given** a mid-tier Android device (Snapdragon 6xx / Helio G class) running the embedded web view, **When** playing, **Then** 60fps is sustained with physics step p95 ≤ 4ms.
2. **Given** a notched device, **When** displaying, **Then** safe-area handling and portrait orientation lock yield zero clipped or overlapped UI elements.
3. **Given** a device that cannot hold 60fps, **When** degrading, **Then** the order is ① render resolution scale 0.75, ② particle count reduction, ③ single-rigid-body physics fallback.
4. **Given** the single codebase, **When** built, **Then** it runs in web browsers, on iOS 16+, and on Android 10+ (API 29+).

---

### User Story 21 - Zero network play with ad-ready seams (Priority: P1)

As the developer, v1.0 makes zero external network calls while ads, analytics, haptics, and storage stay isolated behind interface abstractions, so v1.1 ad/analytics SDK adoption is a pure "plug-in" job and the past failure of never shipping monetization is not repeated.

**Why this priority**: Sources FR-022 (platform abstraction layer). This is a constitution-frozen decision (interface names, event vocabulary) and the answer to risk #9.

**Independent Test**: Can be fully tested by running the v1.0 build under network monitoring (zero external requests) and by static checks proving all platform access flows through the four interfaces.

**Acceptance Scenarios**:

1. **Given** a v1.0 build, **When** the network is monitored, **Then** zero external requests occur and no ad/analytics SDKs are bundled.
2. **Given** game logic, **When** any platform capability is invoked, **Then** all access goes through AdInterface / AnalyticsInterface / HapticsInterface / StorageInterface, with zero direct platform API calls.
3. **Given** the v1.0 no-op implementations, **When** a level starts/ends or coins are earned/spent, **Then** level_start / level_end / earn_virtual_currency / spend_virtual_currency events are emitted per the fixed vocabulary (nothing is transmitted).
4. **Given** rewarded-ad buttons and other ad UI entry points, **When** v1.0 runs, **Then** they are hidden behind flags, and flipping the flag alone reveals fully implemented UI.

---

### User Story 22 - Every authored level is provably solvable (Priority: P1)

As a level author, I build levels in the in-game editor and save them together with the proof I solved them (a ghost solution), so an unsolvable level reaching players is structurally impossible.

**Why this priority**: Sources FR-024 (in-game level editor) and FR-026 (validation pipeline). Ghost-solution-mandatory schema plus CI gates is the content-production quality strategy (KPI-004).

**Independent Test**: Can be fully tested by attempting to save an editor level without a successful test play (refused) and with one (ghost solution attached and Gates 0–2 pass).

**Acceptance Scenarios**:

1. **Given** the development-build editor, **When** authoring, **Then** terrain polyline vertices can be added/moved/deleted; vehicle spawn, goal-flag rectangle, coins, and gimmicks placed; ink budget, star thresholds (star2/star3), and gimmick tags (including anti-dominant) set; and level JSON exported/imported.
2. **Given** a level without a recorded solution, **When** save is attempted, **Then** saving is refused: the save button is disabled with a "record a solution via test play" message (a solution-less level cannot exist per schema).
3. **Given** a successful test play, **When** saving, **Then** the ghost solution (stroke polyline + run result) is attached to the level JSON.
4. **Given** a pull request, **When** CI runs, **Then** all bundled levels (15 + 3 bonus) must pass Gate 0 (schema), Gate 1 (static validity: goal reachable placement + ink budget > 0), and Gate 2 (headless ghost replay within tolerance: success match + final vehicle position ε = 0.05m + ticks ±30) at 100%, or the merge is blocked.

---

### User Story 23 - Tune the game feel live (Priority: P1)

As a level author (developer), I move every physics, camera, and juice parameter with sliders without stopping the game, so I escape the spring-chain tuning swamp (too stiff = dull collapse; too soft = flailing) by feel, on device, fast.

**Why this priority**: Sources FR-025 (debug tuning panel). This is the primary mitigation for risk #3 (tuning swamp) and the measurement instrument for KPI-001.

**Independent Test**: Can be fully tested by opening the dev-build panel, moving the spring-frequency slider mid-run, and observing the bridge stiffness change immediately while fps/step-time/body-count read out continuously.

**Acceptance Scenarios**:

1. **Given** the development-build debug panel, **When** sliders move, **Then** physics (spring frequency, damping ratio, break force, break torque, friction, motor speed/torque), camera (lerp coefficient, look-ahead distance, trauma amounts), and juice (hit-stop length, slow-motion scale, confetti count) change at runtime and propagate immediately to every system reading the single tuning source.
2. **Given** the panel is visible, **When** playing, **Then** fps, physics step time (for p95 judgement), and body count display continuously.
3. **Given** the panel is closed, **When** the session continues, **Then** changed values persist for the session and tuning can resume.
4. **Given** a release build, **When** launched, **Then** the panel's code is excluded from the build and no way to display it exists.

---

### User Story 24 - CI rejects the straight-line dominant strategy (Priority: P1)

As the system (validation pipeline), on every pull request I automatically prove that on anti-dominant tagged levels the "draw one straight line" solution always fails, so the genre's biggest gameplay complaint — flat levels cleared by a single straight line — can never enter this game.

**Why this priority**: Sources FR-026 (validation pipeline, Gate 3). This converts a core game-design intent into an enforced test contract, per constitution I.

**Independent Test**: Can be fully tested by running the straight-line bot headlessly against every anti-dominant tagged level and asserting 100% failure.

**Acceptance Scenarios**:

1. **Given** anti-dominant tagged levels, **When** the straight-line bot (draws one straight stroke from spawn to flag) runs on the headless engine, **Then** it always fails (Gate 3).
2. **Given** a pull request containing a Gate 3 failure, **When** CI runs (pinned runtime version), **Then** the build fails and the merge is blocked; within CI, identical inputs produce bit-identical end-state hashes for regression detection.
3. **Given** a local environment, **When** the CLI runs, **Then** the identical pipeline (Gates 0, 1, 2, 3) executes on the same pinned runtime version for pre-verification during level authoring.
4. **Given** an engine update producing differences beyond the Gate 2 tolerance band (ε = 0.05m / ±30 ticks), **When** responding, **Then** the tolerance is recalibrated via sensitivity analysis or ghost solutions are re-recorded (zero unexamined threshold loosening).

---

### Edge Cases

**Drawing**

- Ink depletes mid-stroke: vertex addition stops at that point; whiff sound + 4–6px/150ms bar shake + warning haptic fire; the drawn portion is kept, and releasing still commits it (FR-001/FR-002).
- OS interrupts the touch (incoming call, notification shade, system gesture): treated identically to finger release — the stroke proceeds to commit (FR-001).
- Stroke shorter than the minimum segment length (0.5m equivalent) or a single-point tap (fewer than 2 valid vertices): not solidified; the stroke is discarded, consumed ink refunded, and the drawing phase continues (FR-003).
- Audio system suspended at first touch (browser autoplay policy): resume runs first; silence is tolerated until resume completes and drawing is never blocked (FR-010).

**Physics & judgement**

- Physics solver divergence (NaN coordinates, penetration explosion, or speed above the divergence threshold, initial 80 m/s): failsafe resets the level to its initial state via the same ≤1s restart path (FR-003/FR-005).
- Multiple joints exceed stress > 1.0 in the same step: all of them break (chain collapse is embraced as spectacle); camera trauma clamps at 1.0 to prevent excessive shake (FR-006).
- Single-rigid-body fallback active: no stress/creak/break exists — visuals degrade to render-layer-only bending (FR-006).
- Clear and fail conditions met in the same tick: clear wins (FR-007, BR-009).
- Bridge partially collapses but the car still reaches the flag: clear, not fail — "barely made it" is the peak catharsis (FR-008).
- After failure confirms: all inputs except Retry and home navigation are disabled; pre-confirmation collapse plays out as physics spectacle (FR-008).
- Restart mashing during reset: ignored; exactly one reset (FR-004).
- Hit-stop budget (1–2 per level, goal + biggest crash shared) exceeded: goal beat 1 is omitted; a big crash may claim one hit-stop within the shared budget (FR-012/FR-013).

**Persistence & progression**

- Corrupted save (parse failure, schema mismatch): partial restore of readable items; only if that fails, initialize with an explicit "progress could not be restored" notification — silent initialization is forbidden (FR-021).
- Save write failure (storage full, I/O error): last good data retained; retry at next save trigger; no half-written state (FR-020/FR-021).
- Unknown fields encountered during save migration: preserved, not discarded (round-trips with future versions survive) (FR-021).
- Level JSON parse failure at runtime (should be unreachable — Gate 0 blocks bad levels before bundling): show an error and return to level select; silent crashes and progress corruption are forbidden (FR-015).
- Progress reset cancelled at either confirmation stage: zero data changes (FR-020).
- Locked level tapped: no transition; lock icon shake + "clear the previous level" message (FR-016).

**Economy**

- Insufficient balance at purchase: buy button disabled with shortfall displayed; taps cause no transaction; balance ≥ 0 invariant holds (FR-018/FR-019).
- Purchase button mashing: exactly one purchase processed (FR-019).
- Axis at max level: "MAX" display, purchase disabled (FR-019).
- Failure or restart with coins collected in the run: coins are not credited and return to initial placement — credit happens only on clear confirmation (FR-009, BR-003).

**Platform & tooling**

- Device without vibration hardware or unsupported browser: haptics implementation no-ops without throwing; game flow is unaffected (FR-014).
- Android device with any unsupported haptic primitive at startup check: amplitude-based fallback for all haptics (a partially-silent event set is forbidden) (FR-014).
- Platform interface internal failures (except save failures, which follow FR-021): recorded and ignored — ads/analytics problems never block gameplay (FR-022).
- Device cannot sustain 60fps: degrade in order — render resolution scale 0.75 → particle reduction → single-rigid-body physics fallback (FR-023).
- Editor save without a recorded ghost solution: refused with disabled save button and instruction message (FR-024).
- Release builds: editor and debug-panel code are excluded from the build entirely; no runtime path can reveal them (FR-024/FR-025).
- Engine/library update shifts ghost replays beyond the Gate 2 tolerance band: recalibrate tolerance via sensitivity analysis or re-record ghost solutions before merging; unexamined threshold loosening is forbidden (FR-026).

## Requirements *(mandatory)*

### Functional Requirements

> All 26 requirements are Must priority (MVP ship conditions). IDs match designs/functional_requirements.md 1:1. Actors: Player, Level Author (developer), System (physics judge / validation pipeline).

**Category A — Drawing**

- **FR-001**: System MUST let the player draw exactly one stroke per level via single-finger drag (mouse equivalent on web/desktop), adding vertices at a minimum spacing of 4–8px, rendering the line at 2–3% of screen width (8–12pt at 375pt width) with round caps/joints, high-contrast solid color, and a 1–2px darker outer border; the line tip MUST reflect raw touch coordinates in the same frame (≤16.7ms at 60fps) with smoothing applied only to past vertices; ink MUST be consumed proportionally to added line length; drawing during the run phase MUST NOT be possible; redrawing is available only via restart.
- **FR-002**: System MUST manage a per-level ink budget (> 0, guaranteed by Gate 1): initialize the bar full at level start (multiplied by +10% per owned Ink Capacity level), decrease it in the same frame as drawing, color it green above 50% / yellow at 20–50% / red with 300ms blink below 20%, stop vertex addition at 0 with a whiff sound + 4–6px/150ms bar shake + warning haptic, and record the consumed amount at commit as the star-rating input. All levels MUST remain clearable at the base (level-0) ink budget.
- **FR-003**: System MUST, on finger release, commit the stroke and solidify it into a physics bridge: simplify the polyline, resample at 0.5–0.8m segment length into N = 8–24 capsule segments (hard cap 32), connect them with spring-enabled rotational joints (spring frequency 4–8Hz, damping ratio 0.6–0.8, angle limit ±0.2–0.4 rad, self-collision disabled within a stroke); play a confirm pop (scale 1.0→1.06→1.0 / 120ms) + a 50–120ms confirm sound + light haptic; start the launch sequence in the same frame; and reconstruct the rendered line as one smooth spline from physics segment positions (physics resolution and render vertices decoupled). Strokes below the minimum length MUST be discarded with ink refunded; solver divergence MUST trigger a failsafe level reset (≤1s); a single-rigid-body fallback mode MUST be swappable at the physics layer only, leaving input and render layers unchanged.
- **FR-004**: System MUST provide a persistent restart control in both drawing and run phases (and Retry on the fail result sharing the same path) that, without any confirmation dialog, returns the level — physics world, stroke, ink, camera, and in-level coin state — to its initial drawing-phase overview within 1 second of the tap, including mid-run and mid-collapse; repeated taps during a reset MUST be ignored.

**Category B — Run & Judgement**

- **FR-005**: System MUST launch the vehicle automatically after solidification via a fixed, non-skippable 0.3–0.5s anticipation (engine rev pitch 1.0→1.4, chassis back-tilt squash of 5–8° with scale 0.92 vertical / 1.08 horizontal over 0.2s, wheel spin + rear smoke), then drive the rear wheel(s) by motor with zero player input during the run; the vehicle MUST be a chassis + 2 suspended wheels (suspension frequency ≈ 4Hz, damping ratio ≈ 0.7, tire friction 0.8–1.2, restitution 0); physics MUST advance on a fixed 1/60 timestep with an accumulator and interpolated rendering (physics stays 60Hz even on 120Hz displays); clear, fail, stress, and coin-contact conditions MUST be evaluated every tick; Engine Speed upgrades MUST multiply motor speed by +5% per level; divergence MUST trigger the failsafe reset.
- **FR-006**: System MUST compute per-joint stress every tick as raw = |force| / breakForce + |torque| / breakTorque smoothed by an exponential moving average with coefficients 0.85/0.15; in the 0.6–1.0 stress band it MUST drive creak feedback proportional to stress (creak SFX volume/pitch, segment color interpolation white→yellow→red, dust particles, weak repeated haptics); above 1.0 it MUST destroy the joint (partial collapse) with crack sound + debris particles + camera trauma +0.5 (clamped at 1.0) + a fracture highlight splitting the rendered path with a jagged edge; orphaned fragments MUST become non-colliding with the vehicle after a few seconds (initial 3.0s) and fade out; simultaneous over-threshold joints MUST all break; break thresholds start at 2–3× the vehicle's static load; in fallback mode stress/break MUST NOT occur (visual-only bending).
- **FR-007**: System MUST confirm a clear on the tick the vehicle reference point enters the goal-flag judgement rectangle, then assign stars from ink consumed vs the level's two thresholds (≤ star3 threshold → 3 stars; ≤ star2 threshold → 2 stars; otherwise 1 star), credit rewards, persist clear state and best stars, and unlock the next level; a 1-star clear MUST still progress; clear and fail in the same tick MUST resolve as clear; replays MUST retain best-star records.
- **FR-008**: System MUST confirm failure on exactly three conditions — ① fall: vehicle reference point below the level's kill boundary (killY); ② overturn: roof ground-contact sustained 0.5s (initial value); ③ timeout: elapsed ticks exceed the level limit (initial 30s = 1800 ticks) — highlight the cause location (fall point / overturned chassis / broken joint position with the fracture highlight retained), show the lightest-weight fail result with Retry immediately active (≤1s to resume), and apply zero lives, stamina, or penalties; a partial bridge collapse where the car still reaches the flag MUST count as a clear; after failure only Retry and home navigation MUST accept input.
- **FR-009**: System MUST collect coins on vehicle contact with a pop (scale 1.0→1.3→0 / 150ms) + 4–8 sparkle particles and a pickup sound rising +1 semitone (×1.0595) per consecutive pickup (cap +12, reset after a 1–1.5s gap); on clear confirmation it MUST credit the clear reward of 20–30 coins plus in-level collected coins to the balance and record an earn_virtual_currency event; bonus levels MUST pay 5–10× the normal reward; a zero-coin clear MUST still pay the full clear reward; failure or restart MUST discard run-collected coins and restore their placement (balance credit only on clear).

**Category C — Presentation (Juice)**

- **FR-010**: System MUST provide drawing feedback: a pen/marker loop sound with 30–50ms fade-in/out mapped continuously to drag speed (volume 0.3–1.0, pitch 1.0–1.2) that stops when the finger stops, per-stroke base-pitch randomization of ±5%, and (recommended) pen-tip dust particles at 2–5 per frame (speed-proportional, lifetime 0.2–0.5s, size 2–6px, line-color fading to transparent); with sound OFF, drawing MUST remain fully functional; a suspended audio system MUST be resumed on first touch without blocking drawing; audio and particles MUST NOT affect judgement or physics.
- **FR-011**: System MUST provide launch/run feedback: at release, 10–20 dust particles + chassis forward stretch (1.15 horizontal / 0.9 vertical recovering in 100ms) + bass-heavy launch sound + medium haptic; camera follow with lerp coefficient 0.08–0.15 at 60fps + speed-proportional look-ahead of 1–2 car lengths + launch kick 8–16px opposite travel recovering in 0.3s; engine sound pitch 1.0–1.5 continuously speed-mapped with 0.25-step gear stepping; wheels rotating at true speed with suspension motion reflected in the chassis rendering; recommended items (trauma-squared screen shake with max offset 16–30px / max angle 5–10° / 15–25Hz and trauma additions launch 0.15 / landing 0.2–0.3 / crash 0.5 / goal 0.4, speed-linked zoom-out +10–20%, speed lines above 60% of top speed, skid marks) added only as schedule allows; under performance pressure recommended items MUST be reduced first.
- **FR-012**: System MUST play a 5-beat goal celebration totaling 3–4 seconds from clear confirmation: ① hit-stop 80–120ms; ② slow-motion at timeScale 0.3 held 0.3–0.5s real time then recovering over 0.2–0.3s with physics stepping scaled in sync and camera zoom-in 15–25%; ③ two-stage confetti (two side cannons of 40–60 pieces each at 45–70° with 30° spread, then a 0.3s-delayed top rain of 60–100 pieces over 2–3s; pieces rotate ±720°/s with sine sway at 0.2–0.4× gravity; two pop sounds offset 50ms + heavy haptic); ④ stars appearing at 200–300ms intervals with scale 0→1.3→1.0 over 250ms + shockwave rings, a do–mi–sol rising arpeggio with cymbal only on the third, haptics light→medium→heavy; ⑤ reward count-up over 0.8–1.5s with tick sounds every 30–60ms rising pitch 1.0→1.3, plus a 10–30 coin burst flying to the counter (20–40ms stagger, 0.4–0.6s flights, semitone-rising chimes, counter punch 1.0→1.2→1.0 / 100ms). The Next button MUST become tappable ≤1.0s after the clear — decoupled from the afterglow: 0.3s after the ~600ms panel reveal (**user directive 2026-07-08**, superseding the prior 1.5–2.5s) — with a scale-in pop then a ±5% scale pulse at 0.8s period (Replay alongside), while stars/coins/confetti/sunburst play on behind the active panel; the impact beat additionally fires a cream screen flash + camera zoom-kick + center burst + a clear stinger at t=0; background music MUST duck −6 to −9dB over 0.2s at the goal instant; any tap MUST skip the entire celebration to static final values with immediate Next/Replay and zero effect on stars, coins, or saved results; hit-stop usage MUST share a 1–2 per level cap with the biggest crash, omitting beat 1 when exhausted.
- **FR-013**: System MUST keep failure presentation minimal: physics collapse/fall/overturn plays unmodified as spectacle until judgement; after confirmation only a light screen dim + one short sad sound; the failure-cause highlight persists into the fail result with Retry immediately active; a single hit-stop is permitted only for the biggest crash within the shared cap; any tap during fail presentation skips to the interactive state; confetti/count-up style reward effects and any punitive expression (score deductions, taunting copy) are forbidden.
- **FR-014**: System MUST define one central event→haptic mapping table (co-located with the tuning constants, no scattering): line commit = light / tick-primitive 0.6; launch = medium / thud-primitive 0.8; landing = heavy / thud-primitive 1.0 (big jumps only); break & creak = weak repeated; star reveals = light→medium→heavy; ink depletion = warning. All haptic firing MUST route through the haptics interface (no direct platform calls); touch→haptic latency MUST be ≤100ms (pre-prepared generators on iOS); Android MUST check primitive support at startup and fall back to amplitude-based haptics if any primitive is unsupported (no partially-silent event sets); devices without vibration MUST no-op without exceptions; haptics OFF MUST disable all firings immediately and persistently.

**Category D — Levels & Progression**

- **FR-015**: System MUST load levels as pure JSON data (no level data embedded in code) with required fields — terrain polyline, vehicle spawn position, goal-flag judgement rectangle, ink budget, star thresholds (star2/star3), kill boundary (killY), coin placements, gimmick tags, ghost solution(s) ≥ 1, schemaVersion — and sequence Chapter 1 as 15 levels plus 3 bonus levels (after L5/L10/L15) with sequential unlock on clear; level transitions MUST complete within 1 second; older schemaVersions MUST be forward-migrated; runtime parse failures MUST show an error and return to level select (no silent crash or progress damage); all bundled levels MUST have passed validation Gates 0–3 before inclusion.
- **FR-016**: System MUST present a chapter map showing every level's stars (0–3), clear state, and lock state, with bonus levels visually distinct; unlocked levels MUST be replayable with best-star retention (no overwrite by lower results); tapping a locked level MUST NOT transition and MUST shake the lock icon with a "clear the previous level" message; play MUST start within 2 taps from app launch; all touch targets MUST be ≥ 44pt.
- **FR-017**: System MUST structure the first three levels as a text-free tutorial completing 3 consecutive successes in 60–90 seconds total: Level 1 is a narrow valley with generous ink where any line succeeds, showing a finger-icon trace-guide animation (no text ever), first success within 10 seconds of first touch and clear ≤ 25 seconds; the full pleasure loop (draw → run → 5-beat goal) MUST be experienced once within 45 seconds of first launch; Level 2 tightens ink to teach the meter and star relation; Level 3 consolidates success; the guide MUST NOT be mandatory (off-guide lines still clear) and MUST replay at retry start after a Level 1 failure.

**Category E — Meta & Economy**

- **FR-018**: System MUST manage a single soft currency (coins, no premium currency) with the balance displayed identically (same value, same format) on home, shop, and clear result screens and updated immediately on change; earn paths are clear rewards (20–30, roughly flat), in-level collection, and bonus levels (5–10×); the only spend path is upgrades (MVP); every transaction MUST be recorded as earn_virtual_currency / spend_virtual_currency through the analytics interface (no-op in v1.0); operations violating the balance ≥ 0 invariant MUST be rejected (prevented up-front by disabled purchase buttons).
- **FR-019**: System MUST sell two upgrade axes — Ink Capacity (+10% per level, cap 5) and Engine Speed (+5% per level, cap 5) — showing current level, price, and next-level effect numerically and visually before purchase; prices start at 50–100 coins and grow ×1.15–1.25 per level (reference: first 75, growth ×1.20, both axes identical, both maxed ≈ 1,120 coins); purchase MUST be immediate (no undo; friction via large price display, no confirmation dialog), deduct the balance, increment the level, record spend_virtual_currency, and apply the effect as a real multiplier on the physics parameter (dummy effects forbidden); insufficient balance MUST disable the button and show the shortfall; max level MUST show "MAX" disabled; rapid taps MUST process once; all levels MUST remain clearable at level 0.
- **FR-020**: System MUST provide settings with independent sound and haptics ON/OFF toggles (immediate effect, persisted), a progress reset guarded by two-stage confirmation (① confirm dialog → ② warning "all stars and coins will be lost" + typed-string confirmation) that on completion restores the initial state (only Level 1 unlocked, 0 coins, upgrades level 0) while retaining sound/haptics settings, and credits/version display; cancelling either stage MUST leave data untouched; a failed post-reset save MUST follow the FR-021 recovery path (no half-reset state).
- **FR-021**: System MUST auto-save progress — level clears, best stars, coin balance, upgrade levels, settings — on every level end, purchase, and settings change through the storage interface, using atomic writes (complete new data written before replacement) with schemaVersion attached; startup MUST load and forward-migrate older versions, preserving unknown fields; corruption (parse failure, schema mismatch) MUST trigger partial restore of readable items, initializing with an explicit user notification only if that fails (silent initialization forbidden); write failures MUST retain the last good data and retry at the next trigger; relaunch after force-kill MUST restore to the most recent level end; there MUST be no manual save UI.

**Category F — Platform Foundation**

- **FR-022**: System MUST define four platform interfaces with no-op, web, and native-shell implementations selected by runtime environment detection at startup: AdInterface (showRewarded / showInterstitial / isReady / event callbacks + placement constants rv_coin_multiplier, rv_continue_hint, interstitial_level_complete), AnalyticsInterface (fixed event vocabulary: level_start, level_end, earn_virtual_currency, spend_virtual_currency), HapticsInterface, and StorageInterface; v1.0 MUST bundle no SDKs and make zero external network calls, injecting no-op ad/analytics implementations; ad UI entry points MUST be fully implemented but flag-hidden; placement IDs, timing, and frequency caps MUST live as remotely-configurable-ready constants in the central tuning source; web-game-portal SDK events MUST be mappable as alternative AdInterface implementations; interface-internal failures (except storage, which follows FR-021) MUST never block game progress.
- **FR-023**: System MUST package the web build in a native mobile shell for iOS 16+ and Android 10+ (API 29+) with safe-area handling, portrait orientation lock, and hardware-accelerated rendering sustaining 60fps; the native haptics capability MUST connect to the HapticsInterface; the shell MUST support on-device measurement on mid-tier Android hardware (60fps, physics step p95 ≤ 4ms) for the week-1 spike; the browser build MUST run standalone for development iteration and future web-portal distribution; devices missing 60fps MUST degrade in order — render resolution scale 0.75, particle reduction, single-rigid-body physics fallback; store submission is out of scope for this phase.

**Category G — Authoring & Quality Gates**

- **FR-024**: System MUST bundle an in-game level editor in development builds only (entirely excluded from release builds via build flags), letting the level author edit terrain polyline vertices (add/move/delete), place vehicle spawn / goal-flag rectangle / coins / gimmicks, set ink budget, star thresholds (star2/star3), and gimmick tags (including anti-dominant), test-play the level, attach the ghost solution (stroke polyline + run result) on test-play success, and export/import level JSON; saving a level without a recorded ghost solution MUST be refused (disabled save button + "record a solution via test play" message); no external standalone editor is built.
- **FR-025**: System MUST provide a development-build-only debug tuning overlay (entirely excluded from release builds) with runtime sliders for physics (spring frequency, damping ratio, break force, break torque, friction, motor speed/torque), camera (lerp coefficient, look-ahead distance, trauma amounts), and juice (hit-stop length, slow-motion scale, confetti count), plus continuous display of fps, physics step time (for p95 judgement), and body count; all changes MUST propagate immediately through the single tuning-constant source (magic numbers scattered in code are forbidden and grep-verifiable); values MUST persist for the session with the panel closed.
- **FR-026**: System MUST validate every bundled level through a 4-gate pipeline executed in CI on a pinned runtime version for every pull request and runnable locally via CLI with identical results: Gate 0 — schema validation (required fields, types, schemaVersion, ghost-solution presence); Gate 1 — static validity (goal-flag reachable placement, ink budget > 0); Gate 2 — headless ghost-solution replay succeeding within the tolerance band (success/fail match, final vehicle position ε = 0.05m, tick count ±30); Gate 3 — the straight-line bot (one straight stroke from spawn to flag) MUST fail on every anti-dominant tagged level; any gate failure MUST fail CI and block merge; within CI, identical inputs MUST produce bit-identical end-state hashes; replays MUST be position-sample playback (never input replay) recorded at base (level-0) upgrade parameters; engine updates exceeding the Gate 2 tolerance MUST trigger sensitivity-analysis recalibration or ghost re-recording, never unexamined threshold loosening.

### Key Entities

- **Stroke**: The polyline drawn by one drag (press → release) — the pre-solidification state; one stroke per level; its tip mirrors raw touch coordinates in the same frame.
- **Ink**: The strategic resource consumed proportionally to drawn length; initialized from the level's budget; the committed consumption drives the star rating; visualized as a green/yellow/red bar.
- **Solidify**: The commit-and-physicalize step on finger release — polyline simplification → resampling → bridge-chain creation — that simultaneously starts the launch sequence (zero-delay feedback); a core loop state.
- **BridgeChain**: The post-solidification bridge — N capsule segments (8–24, cap 32) linked by spring rotational joints (frequency 4–8Hz, damping 0.6–0.8, limit ±0.2–0.4 rad); strictly distinguished from the pre-physics Stroke.
- **Segment**: A single capsule rigid body in the bridge chain, 0.5–0.8m long (initial 0.65m); the unit of body-count budgeting.
- **Stress**: The per-joint load value computed every tick (raw = |force|/breakForce + |torque|/breakTorque, EMA-smoothed 0.85/0.15) driving Creak at 0.6–1.0 and Break above 1.0.
- **Creak**: The named state for the 0.6–1.0 stress band, driving stress-proportional creak sound, white→yellow→red segment color, dust particles, and weak repeated haptics — the game's signature differentiating feedback.
- **Break**: The joint-destruction event above stress 1.0 causing partial collapse — crack sound, debris, camera trauma +0.5, fracture highlight; its position feeds the failure-cause display.
- **Anticipation**: The fixed, non-skippable 0.3–0.5s launch charge-up ritual (rev pitch 1.0→1.4, chassis squash, wheel-spin smoke); a core loop state.
- **Launch**: The release event starting rear-wheel motor drive at anticipation end, with dust burst, forward stretch, bass sound, and medium haptic.
- **GoalFlag**: The clear-judgement reference: a flag with a judgement rectangle defined in level data; clear confirms on the tick the vehicle reference point enters it; same-tick clear+fail resolves as clear.
- **StarRating**: The 1–3 star clear quality score from ink consumption vs the level's two thresholds (star2/star3); fewer ink = more stars; best value is retained; never blocks progression.
- **Coin**: The single soft currency (no second currency); earned via clear rewards (20–30), in-level collection, and bonus levels (5–10×); spent only on upgrades; credited to the balance only on clear confirmation.
- **InkCapacity**: Upgrade axis 1 — a real +10%-per-level multiplier (cap 5, +50% max) on the level ink budget; level-0 ink must always suffice to clear every level.
- **EngineSpeed**: Upgrade axis 2 — a real +5%-per-level multiplier (cap 5, +25% max) on motor speed; deliberately a risk/return trade (faster = more drawing precision demanded).
- **Level**: The unit of play, defined entirely as JSON data (terrain polyline, spawn, goal rectangle, ink budget, star thresholds, killY, coins, gimmick tags, ghost solutions ≥ 1, schemaVersion); never called "stage".
- **Chapter**: A bundle of 15 levels introducing one new gimmick family; MVP ships Chapter 1 only.
- **BonusLevel**: A coin-harvest level unlocked after every 5th level (L5/L10/L15), paying 5–10× the normal reward (initial 6× = 150 coins); same failure rules as normal levels; visually distinct in the map.
- **GhostSolution**: The mandatory (≥ 1) success proof attached to every level JSON — stroke polyline + position-sample run result (never input replay) recorded at level-0 parameters; produced by editor test play; verified by Gate 2 replays.
- **StraightLineBot**: The automated "one straight stroke from spawn to flag" solver that MUST fail on every anti-dominant tagged level (Gate 3) — the executable proof against the genre's dominant-strategy complaint.
- **TempoContract**: The numeric loop-speed contract — L1 clear ≤ 25s, first 3 levels 60–90s, fail→retry ≤ 1s, full loop ≤ 40s, Next activation ≤ 1.0s (user directive 2026-07-08, was 1.5–2.5s) — enforced by automated ghost-replay and UI-transition tests.
- **HitStop**: The 80–120ms full-freeze effect at goal contact or the biggest crash, capped at 1–2 uses per level (shared budget).
- **Juice**: The development term for the feel-making effect set (sound, particles, camera, haptics, scale deformation); 100% of mandatory items is a ship condition; recommended items are best-effort.
- **TuningConstants**: The single source of all tunable numbers (physics, camera, juice, economy, haptics mapping, ad placement constants); level-specific values live in level JSON; magic numbers elsewhere are a defect; adjustable live via the debug panel.
- **VehicleReferencePoint**: The single representative point of the vehicle (chassis bounding-box center) used for clear (goal rectangle entry) and failure (fall below killY) judgement.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The game sustains 60fps with physics step time p95 ≤ 4ms on a mid-tier Android device (Snapdragon 6xx / Helio G class, embedded web view), including worst-case scenes (maximum confetti: two 40–60-piece cannons plus 60–100-piece rain; 32-segment bridge + vehicle + terrain), measured via the debug overlay across all 18 bundled levels.
- **SC-002**: Touch-to-visual response is ≤ 100ms for every interaction, and the drawn line's tip reflects the raw touch position within the same frame (≤ 16.7ms), verified by automated input-to-render measurement.
- **SC-003**: The tempo contract holds in automated tests: Level 1 clear ≤ 25 seconds; the first three levels complete as 3 consecutive successes in 60–90 seconds total; failure→retry→playable ≤ 1 second; one full loop including celebration ≤ 40 seconds; the first full pleasure loop occurs within 45 seconds of first launch.
- **SC-004**: 100% of the 18 bundled levels (15 + 3 bonus) pass all four validation gates (schema / static validity / ghost-solution replay within success match + ε = 0.05m + ±30 ticks / straight-line-bot rejection on anti-dominant levels) on every change, every level ships with at least one ghost solution, and the straight-line bot fails on every anti-dominant tagged level.
- **SC-005**: 100% of the mandatory juice checklist items (drawing sound/feedback, launch anticipation-release, run feedback, creak/break feedback, 5-beat goal celebration, haptics mapping, SFX set) are implemented and verified by checklist review plus demo capture.

## Assumptions

- **Technology stack (per research decision §7.1, verified on npm)**: TypeScript, Phaser 4.x rendering with phaser-box2d (Box2D v3, MIT), Vite build, Capacitor 8 native shells. These names are intentionally confined to this section; all functional requirements are stated capability-level so the physics/render vendor can change without spec changes.
- **Targets**: iOS 16+, Android 10+ (API 29+), and the latest two versions of Chrome and Safari (desktop + mobile); portrait orientation, one-handed play; players do not read tutorial text.
- **Architecture (constitution IV, frozen)**: the Engine layer (physics, rules) is renderer-independent and runs headless in Node — the precondition for CI gate verification; Render observes Engine and never writes back; Meta (economy/persistence) and Platform (four interfaces with Noop/Web/Capacitor implementations) are separated; all tuning values live in TuningConstants + level JSON.
- **Determinism contract is deliberately relaxed (research §7.2)**: bit-identical end-state hashes are required only inside CI (pinned Node = pinned V8, 100% match over 1,000 runs); devices and engine updates are verified against a tolerance band (success/fail match, final vehicle position ε = 0.05m, ticks ±30); replays/ghosts are position-sample playback, never input replay.
- **Physics method choice is spike-gated**: method C (segmented capsule chain) is the primary; a week-1 on-device spike (method A/B/C/D × N = 8/16/24/32; pass = p95 step ≤ 4ms at 60fps with visible sag and credible breaks) confirms it, otherwise the single-rigid-body fallback A ships with render-only bending.
- **Non-functional targets adopted as binding constraints (designs/non_functional_requirements.md)**:
  - NFR-001 60fps sustained, physics step p95 ≤ 4ms, ≤ 32 segments, physics fixed at 60Hz (Must)
  - NFR-002 touch→visual ≤ 100ms; line tip same-frame; touch→haptic ≤ 100ms (Must)
  - NFR-003 tempo contract: L1 ≤ 25s / first 3 levels 60–90s / retry ≤ 1s / loop ≤ 40s / first full loop ≤ 45s / Next ≤ 1.0s (user directive 2026-07-08, was 1.5–2.5s) (Must)
  - NFR-004 determinism: CI hash match 100% (1,000 runs); device tolerance ε = 0.05m, ±30 ticks (Must)
  - NFR-005 compatibility: iOS 16+ / Android 10+ / Chrome & Safari latest 2; portrait; safe-area overlap 0; mouse + touch (Must)
  - NFR-006 cold start ≤ 3s, web first load ≤ 5s (Slow-4G class throttling), level transition ≤ 1s (Should)
  - NFR-007 persistence: restore rate 100% incl. force-kill; corruption crashes 0; schemaVersion attach + forward migration 100% (Must)
  - NFR-008 feedback consistency 100% vs mapping table; celebration skip rate 100%; hit-stop ≤ 2/level; failure effects lightest-weight (Must)
  - NFR-009 accessibility: touch targets ≥ 44pt; stress dual-coded with ≥ 2 non-color channels; independent sound/haptics OFF; minimum text size 12pt (Must)
  - NFR-010 architecture: Engine renderer-imports 0; Render write-backs 0; magic numbers 0; files ≤ 800 lines; functions ≤ 50 lines (Must)
  - NFR-011 quality gates: Engine line coverage ≥ 80%; Gates 0–3 pass 100%; one real-touch E2E (draw and clear L1) always green; tempo tests in CI (Must)
  - NFR-012 privacy: external network requests 0; bundled ad/analytics SDKs 0; ad UI hidden by flag; Everyone-rating content (Must)
  - NFR-013 size/memory: web bundle ≤ 5MB gzip; app ≤ 50MB; runtime memory ≤ 300MB (Should)
  - NFR-014 audio: touch-SE latency ≤ 50ms (pre-decoded); same-SE polyphony ≤ 3; goal ducking −6 to −9dB in 0.2s; SE pitch randomization ±5%; audio context resumed on first touch (Must)
- **Business-rule defaults already resolved (conventions.md §4)**: pointer release = commit with zero further input (BR-001); failure is never punished (BR-002); level-collected coins credit on clear only — collected coins first clear only, clear reward every clear (BR-003, resolving the designs open item); all levels clearable at level-0 upgrades and Gates 2–3 replay at level 0 (BR-004); upgrade effects are real multipliers (BR-005); hit-stop ≤ 2/level (BR-006); every celebration tap-skippable, failure lightest (BR-007); v1.0 zero network with Noop terminations (BR-008); same-tick clear beats fail (BR-009); atomic versioned saves on every trigger (BR-010).
- **Naming boundaries (ubiquitous language)**: the competitor name "Draw Bridge" never appears in product name, code identifiers, or store metadata; the final product name is decided at store submission via ASO research; "level" (never "stage"); retry surfaces use exactly three labels — Restart (in-game HUD), Retry (fail result), Replay (clear result).
- **Economy reference values**: clear reward ≈ 25 coins/level; 5–10 placed coins per level; bonus level 150 coins (6×); Chapter 1 full run yields ≈ 935 coins vs 1,120 total upgrade sink; first upgrade affordable within 2–3 levels of the tutorial.
- **Future consideration (deferred, not in this feature)**: ad SDK integration + consent flows (v1.1); IAP ad-removal $4.99 and coin packs (v1.1); analytics/remote-config/A-B backends (store-release build); vehicle collection skins (v1.1) and physics-varying vehicles (v1.2); bridge material unlocks (v1.2); offline earnings and daily calendar (v1.3); review prompts / feedback links (v1.1); Chapter 2+ gimmicks (G3–G12) and levels beyond 15+3 (post-MVP); web portal submission and CPI tests (GTM phase); store assets and submission (store phase); UGC stages, AI scoring, realtime versus (future consideration only).

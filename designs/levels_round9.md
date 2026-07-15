# Round-9 Campaign Design — 40 Levels (single source for CS-4)

> Authority chain: designer Figma comments (2026-07-15) + 5 confirmed fun decisions > this doc > code.
> Elements: terrain (ONE concept, always line-attachable) / pit(killY) / red rect (no-draw + kill) / rock / person (touch = fail) / coins / objectives (coins | noBreak).
> BANNED: spikes/needles of any kind, no-draw roads, blocker-defense against free solutions, climb-dominated pacing (decision 1 = mix).
> Stage: portrait-first. Authoring box up to 15m wide × 24m tall; per-level bounds vary; static min-fit framing (no live camera follow).
> JUMP GATE — RESOLVED by CS-1 spike (.fable/spike-round9-jump.md, 45 configs, player-faithful): ground-level ramps add only ≤0.74m apex → **ballistic person-clearing from ground level is INFEASIBLE**. Feasible flight patterns: (a) GAP flight — distance over pits, landing equal-or-lower than takeoff; (b) **elevated-takeoff flight** — draw the ramp so its END is ≥1.9m above the ground the person stands on; the car sails over the person and lands beyond. Ramps only "jump over" obstacles ≤0.7m tall from flat ground. [JUMP?] levels below use elevated-takeoff or bridge-over variants; every flight level must prove itself with a recorded ghost. NO physics re-tuning (round-7 lesson).

## Type mix (decision 1: elevation is flavor, not formula)
Bridge/pit ~12 · flat hazard-routing ~10 · descent ~6 · climb ~9 · finale/mixed ~3. Breathers: L8, L13, L16, L24, L31, L36. Wow: L12, L20, L25, L30, L35, L40.

## Level table

| # | Type | Teaches / Demands | Layout sketch (game coords y-up) | ★2 objective | Δgoal |
|---|---|---|---|---|---|
| 1 | Bridge | release=launch; any line works | 2.5m pit between flat banks | coins | 0 |
| 2 | Bridge | sag & support | 4m pit, mid coins slightly below rim | coins | 0 |
| 3 | Climb | ramp slope | goal platform +1.5m, no pit | coins | +1.5 |
| 4 | Red | red = no-draw + death | pit with red block filling lower half; span above WITHOUT entering rect | coins | 0 |
| 5 | Bridge | mastery check 1 | pit + goal +1m, generous ink, ≥2 obvious families | coins | +1 |
| 6 | Descent | landing control | −2m drop; smooth down-ramp beats free fall | noBreak | −2 |
| 7 | Red | arc over protruding red | red rect protrudes 1.5m ABOVE road mid-route | coins | 0 |
| 8 | Breather | free shapes | rolling ground, coin trail | coins | 0 |
| 9 | Bridge | mid support reuse | two pits + small center island | noBreak | 0 |
| 10 | Red+Climb | Draft-1 archetype | mid platform → red block → goal +2m | coins | +2 |
| 11 | Rock | BridgeChain deflects rocks | rock rolls from right slope; line shields car | noBreak | 0 |
| 12 | Wow | speed → distance flight | long descent then 5m gap fly (gap jump, not height) | coins | −1 |
| 13 | Breather | consolidation | gentle terrain, coins | coins | 0 |
| 14 | Person | person = fail on touch | person on flat ground; elevated line over them | coins | 0 |
| 15 | Person | Draft-3 seed | descent approach + person; [JUMP?] launch-ramp (else bridge-over) | noBreak | −1.5 |
| 16 | Breather | combo consolidation | small pit + low red block | coins | 0 |
| 17 | Rock | route above rock path | rock crosses above a pit on its own ledge | coins | 0 |
| 18 | Climb | Draft-2 archetype | long low ground, pit, tall goal +3.2m | coins | +3.2 |
| 19 | Person+Bridge | combine | person on center island between two pits | coins | 0 |
| 20 | Wow | vertical space | +4m two-anchor ascent, tall stage box | noBreak | +4 |
| 21 | Red | corridor routing | two red rects offset → curved safe corridor | coins | 0 |
| 22 | Descent+Rock | pace control | descend while rock follows from behind | noBreak | −2.5 |
| 23 | Person×2 | one arc or two humps | two persons 4m apart on flat | coins | 0 |
| 24 | Breather | reward | coin-rich low-risk rolling ground | coins | 0 |
| 25 | Wow | [JUMP?] person launch | launch over person onto +2m shelf (else over-bridge + climb) | coins | +2 |
| 26 | Red | Draft-1 exact | red block protruding above road before goal platform | noBreak | +0.5 |
| 27 | Bridge+Climb | Draft-2 exact | pit + tall goal platform | coins | +3.2 |
| 28 | Descent+Person | Draft-3 exact | tall start −3m, person mid-ground, goal right | noBreak | −3 |
| 29 | Rock+Person | lane choice | rock lane above, person below; pick a lane | coins | 0 |
| 30 | Wow | capstone A | climb +2m, gap fly, airborne coin arc | coins | +2 |
| 31 | Breather | free-form | wide gentle bowl, many valid lines | coins | 0 |
| 32 | Red×2+Pit | full-route planning | plan around two rects and a pit | noBreak | 0 |
| 33 | Person+Pit | clear both at once | person right before a pit; one flight/bridge spans both | coins | 0 |
| 34 | Rock | deflector line | rock rolls toward raised goal approach; line as shield | noBreak | +1 |
| 35 | Wow | high climb | +5m climb, optional low coin detour | coins | +5 |
| 36 | Breather | celebration | short, precision-free, big coin payout | coins | 0 |
| 37 | Mixed | routing exam | pit + red rect + goal +1.5m | coins | +1.5 |
| 38 | Rock+Person | speed through slope | slope controls arrival speed between rock and person | noBreak | 0 |
| 39 | Climb | visible ink economy | two-stage ascent +3m, star3 ink margin visible | coins | +3 |
| 40 | Finale | synthesis | pit + red rect + rock + person + high flag +2.5m; ≥3 solution families | coins | +2.5 |

## Bonus slate (b1–b5)
Keep 5 bonus levels, regenerated as v2. B05 (spike-tip stepping stones) is REDESIGNED as flat-top stepping pillars (no spike shapes). Others: spike-style zones → plain 'zone'.

## Authoring rules (Gate policy per BR-015)
- Ghosts prove solvability only — never define acceptable shapes. Record ≥2 ghosts per level where families differ.
- Coins auto-placed on a recorded driving route (round-4 lesson) — 100% collectible gate stays BLOCKING.
- lazyLine bot = advisory telemetry only (never pass/fail). If a horizontal line clears a level, that is ACCEPTABLE unless the level's concept requires elevation — fix by geometry, not gimmicks.
- Ink budget = 2–4× minimal solution (round-4 lesson); star3 threshold from measured ghost ink + margin.
- Ramp-jump levels only within the measured feasibility envelope (spike table).

# TESTING-PLAN.md — Phase T: systematic testing & curation campaign

> **Read this file (plus `CLAUDE.md`) at the start of every testing session.**
> It is the working context for the test/curation campaign that runs BEFORE play
> mode (Phase C). It defines the strategy, the tooling, the session protocol and
> the current status. Update the [Status](#7-status--session-hand-off) section at
> the end of every session — the next session (often a different chat) resumes
> from what is written here and in the tracker files.

---

## 1. Goal & scope

Certify that the app is **usable and correct for every species, class and
subclass in the game** — selectors, inputs, previews, derivations and everything
each of them needs — and that the **Foundry export** is right for all of them.
Then repeat the process for feats, spells and items.

**Campaign order (fixed with the user, 2026-07-15):**

- **T1 — Species / classes / subclasses, builder usability.** Every species
  (incl. every lineage/`_versions` and every species sub-choice), every class,
  every subclass, all their features: the UI must offer every required selector/
  input/preview, and the derivation must be right. **← current focus.**
- **T2 — Foundry export for those same units.** Only after T1 is green.
- **T3 — Feats, spells, items** (same machinery, new units). **Explicitly out of
  scope for now** — do not drift into it beyond fixing what T1 trips over.

Testing "everything at all 20 levels" by hand is impossible. The strategy below
splits the work into three tiers so that **scripts prove what scripts can prove,
and human/Claude eyes go only where judgment is needed.**

---

## 2. The three tiers

| Tier | Who | What it proves | Coverage |
|---|---|---|---|
| **0 — Automated sweep** | scripts (`npm run sweep`) | derivation never crashes; every choice is fillable; no dead references; export is structurally valid and round-trips | **exhaustive**: every class × subclass × level 1–20, every species × lineage |
| **1 — UI verification** | Claude, in the browser preview | the interface actually renders/offers each choice well: selectors, previews, chips, popups, layout | **sampled**: decision levels only, per unit |
| **2 — Human curation** | the user | feel, copy quality, table usability, real Foundry imports | milestone spot-checks + everything Tier 1 flags `needs-user-eyes` |

Rule of thumb: **a bug a script can catch must be caught by the script** —
Tier 1 time is the scarce resource; don't spend it clicking through what the
sweep already proves.

---

## 3. Tier 0 — the automated sweep harness (build this FIRST — stage T0)

New scripts under `scripts/`, run with `vite-node` and loading the compendium
from the **local sibling snapshot** exactly like `scripts/render-pdf-preview.jsx`
does (`../DnD Source Material/5etools Source Code/data` + `buildManifest()` —
reuse that `loadDb()`; extract it to `scripts/lib/loadDb.js`). No browser, no
IndexedDB, pure Node — fast enough to run the whole matrix on every session.

### 3.1 Matrix enumeration (`scripts/lib/matrix.js`)

Data-driven, never hardcoded:

- **Classes & subclasses:** from the loaded db's class files (same source
  `deriveFromDb` uses), reprint-deduped via `latestOnly()`.
- **Species:** the species catalog, `latestOnly()`-deduped, **expanded per
  lineage** (`_versions`) — each lineage is its own matrix row; plus one row for
  the base race when it is pickable without a lineage.
- **Decision levels per class** (drives Tier 1 sampling, §4.2): the levels where
  a new choice descriptor appears — level 1, the subclass level, every level
  where `buildClassChoices` yields a new entry or grows a pick count (ASI/feat
  levels, Weapon Mastery growth, invocations…), and spell-tier bumps. Emitted
  into the coverage tracker so a UI session knows exactly which levels to visit.

### 3.2 Auto-builder (`scripts/lib/autoBuild.js`)

`autoBuild(db, { classId, subclassId, level, speciesId, lineage, seed })` →
a complete character, built the way a player would:

1. `createCharacter()` + class/subclass/level/species set directly on the schema.
2. Loop: `deriveFromDb` → collect every unfilled choice (the SAME deep
   completeness the app uses: `buildClassChoices` + `parseChoices` recursion into
   feat sub-bags + species choices + origin feat — i.e. the DDL-0018/DDL-0022
   machinery, `guidancePendencies`-style) → fill each with a **seeded-random
   legal option** (seed in the report so failures reproduce) → repeat.
3. Stop when pendencies hit zero, or **no progress** between iterations —
   "stuck" is itself a finding: a choice with no options, or a selector the
   engine expects but can't be satisfied. That is exactly the DDL-0002
   "Problem 1" class of bug, caught mechanically.

Abilities: Standard Array via the class's recommended spread (what the guided
flow does). Origin: a fixed default custom origin per run.

### 3.3 Invariants asserted per matrix row

**Builder-side (T1's automated floor):**
- `deriveFromDb` never throws, at every level 1–20 (level loop per class row).
- Auto-fill converges to **zero pendencies** (else: missing/impossible selector).
- Every choice descriptor offers ≥ 1 option, and every option resolves to an
  entity with a name and renderable entries (no dead `Name|Source` refs).
- Every granted feature/trait resolves to text (no empty previews).
- Sanity: HP > 0 and monotonic with level, proficiency bonus right, spell
  limits/slots consistent with caster progression, no `NaN`/`undefined`
  anywhere in the derived object (deep scan).

**Export-side (T2's automated floor — built into the same sweep from day one,
even though T2 curation comes later):**
- `assembleFoundryActor` never throws; the JSON deep-scans clean (no
  `undefined`/`NaN`/empty-`_id`); items carry the required per-type `system`
  fields; `advancement` is the `_id`-keyed object shape (DDL-0001).
- **Round-trip oracle:** `foundryToCharacter(assembleFoundryActor(c))` → diff
  the decisions against the original. Must be empty except for the **waiver
  list** (`scripts/lib/waivers.js` — known, documented one-way losses, e.g. the
  species size pick not back-filled per DDL-0017). A new diff = a bug in export
  or import; the round-trip is our cheapest correctness oracle.

### 3.4 Outputs (committed, in `testing/`)

- `testing/report.json` — full machine-readable result of the last sweep
  (per-row pass/fail + reasons + seed).
- `testing/COVERAGE.md` — **the tracker**, regenerated by the sweep but
  preserving the hand-maintained columns. One row per matrix unit:
  `auto` (ok/fail), `ui` (todo/ok/issues), `export` (todo/ok/issues), `notes`.
  This file is the single source of truth for "what is done".
- `testing/ISSUES.md` — the findings ledger. One numbered entry per finding
  (`TC-0001`, `TC-0002`…): unit, severity (`blocker/bug/polish`), description,
  status (`open/fixed@commit/wontfix+why`). Sessions append here; nothing is
  ever silently deleted.

`npm run sweep` runs the whole thing; `npm run sweep -- --class=wizard` (or
`--species=…`) reruns one slice while fixing.

### 3.5 T0 exit criterion

The harness exists, the full sweep runs, and every failure it finds is either
**fixed** or **logged in ISSUES.md with a decision**. Expect the first sweep to
produce a real bug backlog — that's the point; burn it down before UI sessions
start (fixes are cheapest at this tier).

---

## 4. Tier 1 — Claude UI sessions (stage T1, after T0 is green)

### 4.1 Session protocol (the ritual)

1. **Start:** read `CLAUDE.md` + this file + `testing/COVERAGE.md`. Run
   `npm run sweep` — it must be green (regressions first). Pick the next
   unclaimed batch from the coverage file and announce the scope in chat.
2. **Work the batch** (checklist in §4.3) in the browser preview.
3. **Fix small, log big:** cosmetic/one-file fixes are made in-session (with a
   test when the engine is touched); anything structural becomes a `TC-` issue
   and moves on — the session's job is COVERAGE, not rabbit holes.
4. **End:** update `COVERAGE.md` rows + `ISSUES.md`, add a CHANGELOG line under
   the campaign's section, update §7 below, run `npm run test` + `npm run lint`,
   commit.

### 4.2 Batch sizes & sampling

- **One class + all its subclasses** per session (or two small classes). Visit
  only the **decision levels** the sweep emitted for that class (§3.1) — level
  up through them with the Class tab stepper and check each unlocked choice.
  The other levels are already covered by Tier 0.
- **Species in batches of ~10–12** (they are shallower: pick, lineage,
  sub-choices, traits preview, size choice).
- Each batch: one guided pass (creation guide) for ONE representative build +
  manual-tab passes for the rest — the guide is per-step slower, so it gets
  sampled, not repeated per subclass.

### 4.3 Per-unit checklist (what "ui-ok" means)

**Class/subclass (at each decision level):**
- [ ] Every unlocked choice shows a selector (compare against the sweep's
      descriptor list for that level — nothing missing, nothing extra).
- [ ] Selector previews (DetailView) show real text/art; options filter sanely.
- [ ] Picked chips render, are clickable (detail popup, DDL-0021), removable.
- [ ] Rule links inside feature text resolve (DDL-0020); no raw `{@tag}` leaks.
- [ ] Derived numbers move as expected (HP, profs, slots, prepare limits).
- [ ] Level-up overlay (✦/stepper) surfaces exactly the new decisions.
- [ ] Spellbook tab correct for casters (origins, limits, granted spells).
- [ ] No layout breakage — check **mobile width too** (mobile-first principle).
- [ ] Feature text quality: prose renders structured, no ugly fallbacks —
      anything needing taste goes to `needs-user-eyes`.

**Species (per lineage):**
- [ ] All sub-choices render (size, skills, spells, lineage extras) and persist.
- [ ] Traits preview complete; granted spells reach the Spellbook race origin
      with honest frequencies (DDL-0011).
- [ ] Species tab + creation-guide SpeciesStep both complete (DDL-0018 flags).

### 4.4 T1 exit criterion

Every matrix row has `ui: ok` or `ui: issues` with all its `TC-` entries either
fixed or explicitly accepted. Then T2 curation starts.

---

## 5. Tier 2 — user curation & real Foundry validation

- Tier 1 flags anything subjective as `needs-user-eyes` in the coverage notes;
  the user sweeps those in batches at their own pace.
- **Milestone Foundry imports:** at the end of each class's T2 pass (and for a
  sample of species), the user imports a sweep-generated actor into the real
  Foundry (dnd5e 5.3.3+) and checks: class/level register, features present,
  tap-to-roll activities work, AC/HP derive. The structural sweep can't see
  Foundry's runtime behavior — only a real import can. Export a batch of test
  actors with a small script (`npm run sweep -- --emit-actors`) so this is one
  drag-and-drop session, not twenty.

---

## 6. Stage plan (ordered)

| Stage | What | Exit |
|---|---|---|
| **T0** | Build the harness (loadDb lib, matrix, autoBuild, invariants, round-trip, trackers, `npm run sweep`); first full sweep; burn down the backlog | sweep green or every failure logged |
| **T1a** | UI sessions: all classes + subclasses | all class rows `ui: ok` |
| **T1b** | UI sessions: all species + lineages | all species rows `ui: ok` |
| **T2** | Export curation + real-Foundry milestone imports | all rows `export: ok` |
| **T3** | Feats → spells → items, same machinery (new matrix units, same trackers) | later; re-plan then |

Notes for T0 implementation: build it as ordinary code with unit tests where the
lib logic is non-trivial (matrix enumeration, waiver diffing); the sweep itself
stays OUT of `npm run test` (it needs the local data snapshot, which only exists
on the user's machines).

---

## 7. Status & session hand-off (UPDATE EVERY SESSION)

- **2026-07-20 (3)** - **T1a session 6: FIGHTER + all 10 subclasses done** (all rows
  `ui: ok`). Sweep green before starting (274/274 strict). Rep build Eldritch Knight:
  full guided create (Human XPHB / Magic Initiate (Wizard) - the DDL-0040 "Already
  Prepared" flow verified end-to-end at the EK spell steps: Fire Bolt hidden by the
  pre-marked exclude, badge on unmark, confirm naming Magic Initiate; Magic Missile
  hidden in the level-1 picker), overlay level-ups 1→4 (subclass+2 cantrips+3 spells @3,
  feat + mastery growth @4), jump to 19 (badge **"8 choices left"** counting decisions,
  TC-0020), fixup guide filling 5 feats + Epic Boon + masteries to 6/6 + spells to 12/12
  up to 4th circle (DDL-0034 caps: ASI saturates Str at 20, Boon of Fortitude lifts to
  21; HP 234 = base 156 + Tough 38 + Boon 40; slots 4/3/3/1, DC 15). DDL-0040 feat
  categories verified on both slot kinds (ASI pre-marks General with Origin/Epic Boon
  listable - Tough picked via the Origin chip; boon slot pre-marks Epic Boon).
  Subclass swaps @19 for the other nine: Arcane Archer (spellSet + Arcana/Nature skill +
  8 Arcane Shots), Battle Master (AT tool + class-list skill + 23 maneuvers; chip popup),
  Cavalier/Samurai (`mixed` chooses, XGE pools minus owned), Champion (Additional FS @7,
  9 options, GWF excluded), Psi Warrior (Telekinesis 1/Day Uses card @18), Rune Knight
  (6 runes, Giant language grant), Echo Knight (no choices - correct), Banneret
  (Perf/Pers skill + Comprehend Languages Ritual). Mobile ok, zero console errors.
  Findings - ALL fixed in-session: **TC-0035** (orphaned spell picks after a
  casting-removing swap mislabeled "Mystic Arcanum" + counters hidden - badge now follows
  the engine's `arcanumLevels`, counters render red when count > limit even at limit 0),
  **TC-0036** (Defense fighting style never reached the LIVE AC - new curated
  `AC_BONUS_FEATURES` + `acFeatureBonuses` folded in resolve.js; AC 17 verified),
  **TC-0037** (create-guide intro said "which spells to prepare" on a non-caster - feat
  origins no longer count; plus the "- mixed" label cosmetic).
  944 tests (+4), lint, sweep 274/274 `--strict`. See CHANGELOG §51 + DDL-0043.
  **Next action: T1a session 7 - MONK + its 10 subclasses** (Kensei's `weaponProf`
  machinery is DDL-0030's - verify melee/ranged pickers @3 and the extra slots @6/11/17;
  Elements has a decision level @17; remember several monk subclasses carry curated
  SUBCLASS_GRANTS lines - check tool/language cards per subclass).

- **2026-07-20 (2)** - **TC-0034 FIXED + ledger/tracker cleanup.** The feat sub-bag spell
  pickers now get the full DDL-0040 "Already Prepared" flow: `ChoiceList` derives the
  owned-spell map itself at its single choke point (a gated `useMemo`, only when a spell
  picker is reachable) and passes it down as `spellsOwned` to `SpellChoice` and to the
  NESTED list of a feat sub-bag - so the seven call sites needed no changes at all, which
  is what had made the issue look structural. Verified live (Druid 1 + Magic Initiate:
  Speak with Animals hidden → badge → confirm naming Druid → Cancel/Add anyway both
  correct); 940 tests, lint, sweep 274/274 `--strict`. See CHANGELOG §50 + DDL-0042.
  **Ledger audit done in the same pass:** the only OPEN item in `testing/ISSUES.md` is
  now **the Rogue half of TC-0021** (its Weapon Mastery pool needs conditional filter
  semantics: "Simple, or Martial with Finesse/Light" - `weaponFilterAllows` can't express
  it yet). Stale markers cleared: `COVERAGE.md`'s Armorer/Battle Smith rows still read
  `issues (TC-0012, TC-0017)` though both were fixed 2026-07-17 → now `ok`; the
  2026-07-17 (3) entry below still called TC-0022 open though DDL-0034 resolved it the
  same day → corrected.
  **Next action: T1a session 6 - FIGHTER + its 10 subclasses** (unchanged).

- **2026-07-20** - **T1a session 5: DRUID + all 8 subclasses done** (all rows `ui: ok`).
  Sweep green before starting (274/274 strict). Full guided create (Goliath Stone Giant /
  Magic Initiate (Druid) / Circle of the Land as the rep build - the feat + class pickers
  exercised the whole DDL-0040 "Already Prepared" flow: pre-marked exclude, badge, confirm
  naming the source), overlay level-ups 1→4 (Land @3 rebuilt the step list live with the
  terrain spellSet - Temperate), fixup @19 (badge 6: Elemental Fury, 3 ASIs with the
  DDL-0034 cap saturating Wis at 20, Tough +38 HP, War Caster, Boon of Fortitude +40 HP
  and Wis 20→21; HP 214), subclass swaps @19 for the other 7 - **TC-0027's `_copy`
  resolution verified on the druid stubs** (Spores 9 + Chill Touch, Wildfire 10 circle
  spells Always Prepared; Moon/Sea/Stars grants all derive; Dreams/Shepherd correctly
  none), prepared-collapse accounting across swaps (freed slot on Moon; 22/21 red
  over-limit on Dreams - intended), chip popups, mobile, zero console errors.
  Findings: **TC-0032** (Shepherd's Speech of the Woods never granted Sylvan - one
  `SUBCLASS_GRANTS` line, fixed), **TC-0033** (kit items referencing an ITEM GROUP landed
  as "unresolved" junk - Druid/Cleric/Paladin XPHB focus/holy symbol; now a closed-pool
  kit choose on the TC-0024 machinery, fixed), **TC-0034** (polish: feat sub-bag spell
  pickers skipped the DDL-0040 Already Prepared flow - **fixed 2026-07-20 (2)**, see the
  entry above).
  940 tests, lint, sweep 274/274 `--strict`. See CHANGELOG §49 + DDL-0041.
  **Next action: T1a session 6 - FIGHTER + its 10 subclasses** (remember DDL-0033: its
  mastery pool is deliberately filter-less; Eldritch Knight is a third-caster - check its
  spell steps @3/7 carefully; TC-0033's fix also touches no Fighter kit, all concrete
  items).

- **2026-07-19** - **T1a session 4: CLERIC + all 19 subclasses done** (all rows `ui: ok`;
  largest batch, done in one sitting). Sweep green before starting (274/274 strict). Full
  guided create (Dwarf XPHB / Magic Initiate (Cleric) / Nature PHB as the rep build - the
  feat exercised the TC-0011 spellSet+spell chooses end-to-end), overlay level-ups 1→4
  (subclass @3 rebuilt the step list live with the new Nature chooses), jump to 19 (fixup
  guide: Blessed Strikes, 3 ASIs, War Caster/Durable, Epic Boon; DDL-0034 cap saturated Wis
  at 20 and Boon of Fortitude lifted it to 21; HP 214 = base + Dwarven Toughness 19 +
  Durable Con bump + Boon +40), subclass swaps @19 for the other 18 (features + granted
  spell lists + fixed grants + per-subclass chooses all verified), Spellbook checks @1/3/19,
  proficiency cards, mobile width, zero console errors.
  Findings: **TC-0027** (STRUCTURAL, the campaign's biggest so far: legacy subclasses
  adopted onto 2024 classes are `_copy` STUBS the resolver never expanded - 13 of the 19
  cleric domains had ZERO domain spells and no additionalSpells chooses; fixed via memoized
  `resolveCopies` in `resolveSubclassObj` - Bard/Barbarian had escaped by luck of stub
  shape), **TC-0028** (Thaumaturge/Magician extra cantrip never raised the cantrip limit -
  curated `CANTRIP_BONUS_FEATURES`, fixed), **TC-0030** (Knowledge (PSA) Blessings granted
  nothing - umbrella-feature registry key + key-only dedup; AND both Blessings versions now
  give the chosen skills expertise via the new `expertise: true` grant flag, fixed).
  **TC-0029 and TC-0031 were RESOLVED same day by user decision** (pre-marked removable
  filters, DDL-0026 pattern): ASI/boon pickers list all qualifying categories behind a
  pre-marked Category filter (prereq warnings unchanged), and spell pickers get an
  "Already Prepared (other origin)" exclude filter + badge + a confirm naming the source
  - a multiclass CAN prepare the same spell twice on purpose. See CHANGELOG §46 +
  DDL-0040.
  930 tests, lint, sweep 274/274 `--strict`. See CHANGELOG §45 + DDL-0039.
  **Next action: T1a session 5 - DRUID + its 8 subclasses** (Magician's +1 cantrip now
  bumps via TC-0028's registry; legacy Land/Moon/etc. domain-spell derivation newly works
  via TC-0027 - verify their circle spells and Land's terrain spellSet carefully).

- **2026-07-18/19** - **T1a session 3: BARD + all 10 subclasses done** (all rows
  `ui: ok`). Session opened with a DDL-0037 migration repair: loadDb still pointed at
  the sibling source-material path, and vitest/eslint were descending into the in-repo
  snapshot (its jest tests / its own eslint config) - all fixed before the sweep, which
  then ran green (274/274 strict). Full guided create (High Elf / Musician / College of
  Lore), overlay level-ups 1→4, jump to 19 (badge 8 → fixup guide with 2× Magical
  Discoveries, 3 ASIs, Expertise@9, Epic Boon; the TC-0022 cap saturated Cha at 20 and
  the boon lifted it to 21), subclass swaps @19 for the other nine (fixed grants on the
  card - Valor's Medium/Shields/Martial, Swords' Medium+Scimitar; Glamour/Spirits
  granted spells; Swords' FS picker restricted to Dueling/TWF), race-origin spell
  timeline (@1/@3/@5), chip popups, title links, mobile, zero console errors.
  Findings - ALL fixed in-session: **TC-0023** (countable proficiency tokens
  `{anyMusicalInstrument: 3}` never became choices - Musician's 3 instruments were
  silently skippable; multi-entry fields also corrected to ALTERNATIVES semantics),
  **TC-0024** (kit `{equipmentType}` entries dropped - the Bard kit's "Musical
  Instrument of your choice" now has a picker + deep completeness), **TC-0025**
  (sibling spell chooses accepted the same spell twice - Magical Discoveries),
  **TC-0026** (College of Spirits RHW's Guidance granted in prose but absent from
  `additionalSpells` - new curated `MISSING_ADDITIONAL_SPELLS` registry).
  920 tests, lint, sweep 274/274 `--strict`. See CHANGELOG §43 + DDL-0038.
  **Next action: T1a session 4 - CLERIC + its 19 subclasses** (largest batch; consider
  splitting XPHB vs. legacy/PSA across two sittings).

- **2026-07-17 (3)** - **T1a session 2: BARBARIAN + all 10 subclasses done** (all rows
  `ui: ok`). Sweep was green before starting (274/274 strict). Full guided create
  (Human/Tough/Skilled → Barbarian, Wild Heart as the representative build), overlay
  level-ups 1→4, jump to 19 (badge + fixup guide: Aspect/Power, 3 ASIs incl. "+1 to two"
  and Sentinel's restricted list, mastery growth, Epic Boon), subclass swaps @19 for the
  other nine, Spellbook checks (Wild Heart rituals, Giant cantrip via spellSet, Ancestral
  Guardian 1/Rest), chip popups, title links, mobile, zero console errors. Tough's HP
  bonus (DDL-0029) validated on a d12 chassis (233 @19).
  Findings - fixed in-session: **TC-0019** (Storm Aura environment choice had NO selector -
  one `CHOOSE_ONE_FEATURES` line), **TC-0020** (✦ badge counted steps, not decisions -
  "1 choice left" with 7 open), **TC-0021** (mastery pool ignored Barbarian's melee-only
  restriction - curated `MASTERY_FILTERS` + `weaponFilter` on kind `weapon`; **Rogue's
  Finesse/Light variant deferred to its session**, needs conditional filter semantics),
  plus cosmetics (SpeciesTab/ClassTab picker labels showed lowercase ids; `{@table}`
  display segment; double Ritual chip; t1-choices helper hid off-level choices).
  **TC-0022 was RESOLVED same day** (DDL-0034): feat ability increases now enforce the
  RAW score cap, data-driven from `ability[].max` (regular 20, Epic Boons 30).
  869 tests, lint, sweep 274/274 `--strict`.
  **Next action: T1a session 3 - BARD + its 10 subclasses** (extend MASTERY_FILTERS in
  the Rogue session).

- **2026-07-17 (2)** - **DDL-0029's out-of-scope leftovers closed (DDL-0030), matrix grew to
  274.** Subraces (5etools `subrace`) merge as LINEAGES (`raceLineages` everywhere: tabs,
  guide, completeness, import, matrix) → **18 new species rows** (Genasi MPMM, Human
  (Innistrad) incl. Stensia, Merfolk/Goblin/Vampire PSZ, Aven PSA, Kaladesh/Zendikar elves,
  Shifter EFA, Half-Elf/Half-Orc PHB variants), all `--strict`-green; race fixed weapon/armor
  profs now derive. Per-weapon proficiency = new `weaponProf` kind (Kensei melee+ranged@3,
  +1@6/11/17, `weaponFilter` RAW-faithful, native dnd5e weaponProf ids on export). Grants
  inside featureoption OPTIONS verified UNREACHABLE (Totem Warrior is reprint-hidden) -
  documented, not built. Known deferred backlog now lives in CLAUDE.md §4 (UUIDs, E5 polish,
  sidekicks/UA, overlay adoption, high-level create, legacy toggle). 842 tests, lint, sweep
  274/274 `--strict`, live pass (Genasi Air + Kensei pickers).
  **Next action: T1a session 2 - BARBARIAN + its 10 subclasses** (then Bard).

- **2026-07-17** - **TC-0011…TC-0018 ALL FIXED (no open TC issues)** - the whole
  T1a-session-1 backlog closed in one batch (DDL-0029, CHANGELOG §33): spell
  chooses in `additionalSpells` are real choices end-to-end (spellSet list
  selector + spell pickers, engine `grantedSpells` emits+consumes, TC-0011);
  fixed subclass proficiency grants derive via the curated
  `engine/subclassGrants.js` incl. live "if you already have…" conditionals
  (TC-0012, also closing DDL-0002's old deferred list - Monk artisan-OR-
  instrument, expertise pool with auto-granted skills, save conditionals);
  structured `resist`/`immune`/`vulnerable` chooses render as pills and derive
  into the card + `traits.dr/di/dv` via `engine/damageTraits.js` (TC-0014);
  guided kit auto-equips armor/weapons (TC-0015); featureoption collapses to
  the chosen option (TC-0017); and curated HP-max bonuses (Tough, Boon of
  Fortitude, Dwarven Toughness, Draconic Resilience) derive + export natively
  (`engine/hpBonuses.js`, TC-0018 - found in this batch's live pass). Verified
  live on a full guided Artificer→Armorer 1-19 run (desktop + mobile, zero
  console errors); 831 tests, lint clean, sweep 256/256 `--strict`.
  **Next action: T1a session 2 - BARBARIAN + its 10 subclasses** (then Bard).

- **2026-07-16 (2)** - **T1a session 1: ARTIFICER + all 6 subclasses done** (order:
  alphabetical, fixed with the user). Sweep was green before starting (256/256
  strict). Full guided create pass (Armorer), interactive level-ups 1→4 (overlay:
  spells@2, subclass+Armor Model+spells@3, feat+spells@4), jump to 19 (badge +
  fixup guide + Epic Boon picker), subclass swap checks for the other five at 19
  (features + granted-spell tables all render), Spellbook checked at 1/2/3/19,
  chip popups, choice-title links, mobile width, zero console errors.
  **New helper: `npx vite-node scripts/t1-choices.js <classId>`** dumps the
  per-level choice descriptors the session must see (promoted from this session).
  Findings: **TC-0011** (additionalSpells `{choose}` has no selector anywhere -
  Magic Initiate grants nothing, structural), **TC-0012** (fixed subclass
  proficiency grants don't derive - Armorer Heavy/Smith's, Battle Smith Martial),
  **TC-0013** (picked feat with unfilled sub-bag escapes the ✦ badge and fixup
  guide - shallow `filled` in fixupSteps.js), **TC-0014** (structured `resist`
  chooses unparsed - Boon of Energy Resistance), **TC-0015** (guided kit lands
  unequipped, AC reads unarmored - needs-user-eyes), **TC-0017** (featureoption
  chip prints all options' text - needs-user-eyes). Fixed in-session: **TC-0016**
  (guide pickers showed lowercase raw ids).
  **Next action: T1a session 2 - BARBARIAN + its 10 subclasses** (then Bard).
  **TC-0013 was fixed same day** (deep `choiceComplete` shared by creation guide,
  fixup guide, FeaturesStep and the ✦ badge - see ISSUES.md); TC-0011/0012/0014
  remain the open engine gaps to schedule.

- **2026-07-16** - **T0 backlog BURNED DOWN: TC-0001…TC-0010 all fixed** (see
  `testing/ISSUES.md` + DDL-0028 for the architecture - native Foundry encodings
  where a slot exists, `flags.builder5e.choices` on the owning Item where none
  does). The full sweep is now **256/256 with ZERO round-trip diffs in
  `--strict` mode**; `KNOWN_ISSUES`/`WAIVERS` are empty; the oracle also checks
  base-score reconstruction (`scores` in the decision summary) and the sweep
  gained the `--strict` flag (ignores the baseline - the burn-down measuring
  stick). 793 unit tests + lint clean.
  **Next action: start T1a UI sessions (§4)** - pick the first class batch from
  `testing/COVERAGE.md`.

- **2026-07-15 (2)** — **Stage T0 DONE.** Harness built (`scripts/sweep.js` +
  `scripts/lib/{loadDb,matrix,autoBuild,invariants,roundtrip,rng}.js`, 13 unit
  tests) and the first full sweep ran: **256 rows (135 class×subclass, 121
  species×lineage), all green** — 0 build failures (every choice on every unit is
  fillable to zero pendencies), 0 derivation crashes across levels 1–20, 0 export
  shape issues. All findings are EXPORT/IMPORT round-trip gaps, triaged as
  **TC-0001…TC-0010 in `testing/ISSUES.md`** and baselined in `KNOWN_ISSUES`
  (`scripts/lib/roundtrip.js`) so new regressions still fail the sweep.
  **Next action: burn down the TC backlog** — biggest first: TC-0007 (featureoption
  picks don't export as "<Feature>: <Option>" Items, 54 diffs; fixing the export
  makes the existing import work), then TC-0004/0005 (import reconstruction),
  TC-0008 (parenthesized race names), TC-0009 (species spellAbility). After the
  backlog: start T1a UI sessions (§4).
- **2026-07-15 (1)** — Plan created (this file); campaign fixed as DDL-0024.

---

## 8. Quick reference

- Engine entry points: `deriveFromDb` (`src/engine/resolve.js`), choices via
  `buildClassChoices`/`parseChoices` (`src/engine/`), pendencies:
  `components/wizard/guidancePendencies.js` (+ `createGuideContext`).
- Export: `assembleFoundryActor` (`src/engine/foundryActor.js`); import:
  `foundryToCharacter` (`src/engine/foundryImport.js`).
- Schema factories: `createCharacter`/`createClassEntry` (`src/schema/character.js`).
- Local compendium loader precedent: `scripts/render-pdf-preview.jsx`.
- Commands: `npm run sweep` (whole matrix) · `-- --class=X` / `--species=Y`
  (slice) · `-- --emit-actors` (Foundry test actors) · `npm run test` ·
  `npm run lint` · `npm run dev`.
- Trackers: `testing/COVERAGE.md` (state) · `testing/ISSUES.md` (findings) ·
  `testing/report.json` (last sweep, machine-readable).

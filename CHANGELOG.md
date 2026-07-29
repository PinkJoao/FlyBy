# Development Log

A topic-by-topic record of what has been built. Grouped by area rather than by
date; roughly follows the roadmap phases in the README. Newest work for each area
is folded into its section.

---

## 1. Foundation & data layer

- **Stack**: Vite + React 19 (React Compiler), Zustand for state, React Router,
  Vitest for tests, CSS Modules.
- **Local storage (Dexie / IndexedDB)** — database `builder5e` with three tables:
  `kv` (cache timestamp), `compendium` (one row per data file), `characters`.
- **5e.tools data pipeline** — the app downloads the JSON data files at runtime
  from the community mirror on first launch, caches them in IndexedDB, and runs
  fully offline afterwards. No game content is bundled in the repo.
- **Cache gatekeeper** — cache-first boot with graceful offline fallback and a
  manual force-update (ALT-click / long-press on the version tag). The cache is
  refetched automatically when it is stale **or incomplete** (e.g. after the app
  starts requesting new files such as class fluff), so old caches self-migrate.
- **English UI** — all UI and content standardized in English; filters separate a
  stable language-independent key from its label, so a future translator only
  swaps label maps without breaking saved state.

## 2. Character roster & storage

- Home screen: create, open, duplicate, **export** (JSON) and import characters,
  plus delete with confirmation and an empty state.
- Characters persist to IndexedDB and survive reloads; a schema-migration hook
  runs on read. **`migrate` is defensive** — it coerces any stored object into the
  builder's shape (arrays/objects filled from defaults), so a legacy/partial or
  wrong-format record never blanks the app. `totalLevel`/`classSummary` also guard
  missing `classes`.
- **Import is Foundry-format** (DDL-0005) — the roster **imports a Foundry dnd5e actor
  `.json`** and converts it back into builder decisions (`engine/foundryImport.js`,
  `foundryToCharacter`): the race item → species (base id + lineage), the background →
  custom origin (ability boosts, skill proficiencies, origin feat), each class item →
  a class entry (id, level, subclass, rolled HP, and the choice-bag reconstructed from the
  applied advancement values — starting skills, weapon mastery, fighting style, ASI/feat
  picks), and the **base ability scores are reversed** from the actor's final scores minus
  every reconstructed boost. Verified against real actors: the official **Randal** (Fighter
  17) and a hand-built **Champion** (Fighter 6) both import with derived scores, level and
  HP matching the source exactly, and render correctly in the builder. Card/builder
  **export** is the Foundry actor too, so import↔export share one format — making premades
  a ready-made comparison/test set. _Known limits (first pass): species **skill/feat
  sub-choices** aren't back-filled (they land in the derived sheet but not as bag picks
  yet); a Plutonium-style lineage name (`Elf, Drow`) resolves to the base race but doesn't
  re-map to our exact `_versions` lineage string; feat picks with a non-canonical/empty
  source may not re-resolve on a subsequent export._
- Roster cards show the character portrait (any aspect ratio, scaled to fit) or a
  name initial.
- "Create character" buttons reuse the selector's Select-button styling.

## 3. Sheet shell & derived stats

- **Pure rules engine** — the character stores only the player's decisions; a pure
  engine derives everything else (ability scores, HP, saves, proficiencies,
  proficiency bonus, per-class breakdown). Validated against real Foundry numbers.
- **Live header** — expandable Level / Hit Points / Alignment tiles plus six
  ability cards (total, modifier, and a base-score stepper). Alignment is a
  functional 9-option picker, tinted by moral axis (blue good / purple neutral /
  red evil).
- **Hit Points** — standard 2024 calculation (max die at character level 1,
  average elsewhere, + CON per level), with per-class hit dice shown and
  **Roll / Reset** buttons to toggle rolled vs. average HP. The mini-card also has
  inline **+ / −** buttons (like the predecessor dnd-sheet) for a **manual max-HP
  adjustment** (`hpBonus`) — for homebrew/custom totals; it shows as a "Manual" row
  in the breakdown and exports to Foundry as `attributes.hp.bonuses.overall` (so
  Foundry's derived max matches), round-tripping on import.
- **Proficiencies card** — a single expandable card listing Saving Throws, Skills,
  Expertise, Armor, Weapons, Tools and Languages with bonuses.
- **Portrait** — upload any image (auto-resized to WebP, stored in the character);
  displayed uncropped with a max height; tap opens a fullscreen viewer with
  Change / Download / Remove.
- Fully responsive/mobile-first; fluid font sizing keeps the expandable tiles
  readable on very narrow screens. An Export button sits opposite the back link.
- **Skills tab removed** — it was only ever a placeholder ("Skill proficiency choices
  arrive in Phase 5b/5c"); perícias belong to **play mode** (DDL-0004: tap-to-roll,
  session state), not the builder, so the tab is gone rather than eventually filled in
  here. `TABS` is now Species/Background/Class/Equipment/Spellbook.
- **HP "Reset" now actually resets to the formula max** — it previously only cleared
  the per-level rolled-HP overrides (`hitPoints: {}`), leaving the manual `±` adjustment
  (`hpBonus`) untouched, so a character with a manual bonus/penalty didn't actually
  return to the average-formula HP on Reset. `averageHp` (`Builder.jsx`) now also zeros
  `hpBonus`.
- **Alignment tile shows the full name on desktop** — the 9-option picker used to
  always show the 2-letter code (`LG`, `NE`…), cramped even where there's plenty of
  room. Above `700px` (the page caps at `760px`, so the 3-tile row has space to spare)
  each button now shows the two-word alignment name on two lines instead
  (`.alignFull`/`.alignCode`, toggled via a `min-width` media query); narrower/mobile
  viewports keep the compact code as before. Both are always in the DOM (title
  attribute unchanged) — only the CSS `display` toggles, so no extra render logic.
- **Export format chooser (Foundry Actor / PDF mockup)** — the single "Export" click
  now opens a small dropdown (`components/common/ExportMenu.jsx`) offering **Foundry
  Actor** (the existing behavior) and a **PDF Sheet** option that's visibly disabled
  ("Coming soon") — a mockup so the upcoming PDF export is discoverable without doing
  anything yet. Used identically in both places export already existed: the builder's
  top-bar button and each roster card's ↓ icon (`Home.jsx`). The menu renders through a
  `createPortal` into `document.body` rather than inline, because the roster card has
  `overflow: hidden` (for its rounded corners) which was clipping an inline dropdown;
  position is measured from the trigger's `getBoundingClientRect()` on open.
- **Portrait by web image URL** (like Foundry VTT's own image picker) — clicking the
  avatar with no portrait yet (or "Change" in the fullscreen viewer) now opens a small
  `PortraitSourceModal` (`Builder.jsx`) offering **Upload from device** (the existing
  file-picker flow, unchanged) or a **URL field** that stores the pasted address
  directly in `meta.portrait` — no fetch/re-encode, same as a local file upload just
  skips (Foundry does the same: it stores the path/URL as-is and lets the browser load
  it). `portraitFilename` (used by the viewer's Download link) now derives the file
  extension from the URL's path when the source isn't a `data:` URL, instead of always
  parsing a data-URL mime header.
- **Armor Class + basic item effects** (`engine/armorClass.js`, first slice of the
  "basic effects" layer) — a new **AC tile** joins Level / HP / Alignment in the
  StatsHeader (tiles grid now 4-up on desktop, 2×2 under 620px), expandable to a
  breakdown. `deriveArmorClass(character, inventory, mods)` computes AC from the
  **equipped** body armor (`ac` + Dex, capped by armor type — light full, medium +2,
  heavy 0), the equipped **shield** (`ac` + magic `bonusAc`), **Unarmored Defense**
  for Barbarian (+Con) / Monk (+Wis, only without a shield) when no armor is worn, and
  flat `bonusAc` from **active** accessories (Ring/Cloak of Protection — "active" =
  attuned if the item needs attunement, else equipped). `deriveSaveBonusFromItems`
  adds each active item's `bonusSavingThrow` (+1) to **every** save. Wired through
  `deriveFromDb`, so AC/saves react live to equipping/attuning (verified: attuning a
  Ring of Protection moves AC 13→14 and every save +1). 13 unit tests in
  `armorClass.test.js`. Magic-weapon attack/damage bonuses (`bonusWeapon`) and
  feature-based AC effects (Defense fighting style, natural armor) come with the
  weapon-attack / effects passes.

## 4. Selector system (SelectorPanel)

- A single generic **SelectorPanel** powers every picker (species, class, subclass,
  feat, weapon, optional features, …): search, tri-state include/exclude filters
  (drawer on mobile with an Apply button), a results grid with badges, and a rich
  detail preview.
- **DetailView / EntryContent** render the 5e.tools `entries` structure
  recursively — inline `{@tag}` markup, lists, insets, quotes, images, fluff/lore,
  and named-option items.
- **Standard table style** app-wide (`.data-table`) inside a `TableViewer` frame:
  wide tables scroll horizontally and expose a fullscreen button **only when they
  overflow**.
- **Reprints & `_copy` resolution** — only current versions are shown; the 5e.tools
  `_copy` inheritance is resolved generically (races, subclasses and their
  features) so inherited size/speed/traits and copied feature bodies render.
- **Sheet-wide de-duplication** — you can't pick the same skill/tool/language/feat
  twice (repeatable feats excepted).
- **Item info button** — a picker's selected item can be re-read via an ⓘ button
  (off for species/class/subclass, whose content shows in the tab itself).

## 5. Species tab

- Species picker with search and filters (Source, Size, Speed, Creature Type,
  Traits, and an NPC-species exclusion), plus Size/Speed/Type meta chips that
  highlight non-standard values.
- Racial sub-choices (skill/tool/language/feat) rendered above the lore, using the
  recursive choice system.
- Full lore + art from the fluff data; named trait options (e.g. Eladrin seasons,
  Aasimar revelations) render with their titles.
- **Sub-race / lineage resolution (`_versions`)** — 2024 species that split into
  lineages store them in a `_versions` field (the XPHB **Elf** → Drow / High Elf / Wood
  Elf). `expandRaceVersions` applies each version's top-level overrides (darkvision,
  speed, spells…) and its `_mod` entry edits (`replaceArr` swaps the generic "Elven
  Lineage" trait for the chosen one) into concrete variants. The base race is picked as
  usual (keeping its reference art), then the lineage is chosen in a **separate lineage
  selector** on the Species tab; `resolveRaceObj(…, lineage)` resolves the variant for
  derivation, so the lineage's traits (e.g. Drow's 120 ft Darkvision) apply. Races
  without `_versions` are unaffected. The lineage is picked through the standard
  **SelectorPanel** (search + cards + detail), like every other selector — not ad-hoc cards.

## 6. Background tab (custom origin)

- Ability Score Boosts (+2/+1 by default, or +1/+1/+1) with per-slot ability
  selects; reflects live in the header.
- Origin feat picker with recursive sub-choices, and standardized
  skills / tool / language choices via the shared choice system.

## 7. Class tab

- **Class / multiclass / subclass / level** in sub-tabs (one class at a time).
  Adding a multiclass jumps straight into the class picker; the picker's clear
  button removes the tab. Level cap 20 across classes; saving throws come from the
  original class only.
- **Class selector** shows primary-ability tags and a caster type (Caster /
  Half Caster / Martial, color-coded); the preview lists primary ability, hit die,
  saves, armor, weapons and skill options.
- **Multiclass requirements** — picking (or leaving) a class checks the ability
  prerequisites of all classes involved and warns before proceeding; swapping or
  starting a single class never warns.
- **Feature progression view** (like the 5e.tools class page): features grouped by
  level, with three display modes (default = unlocked, **Current** = current level
  only, **Full** = 1–20) and per-level collapse. Subclass features are marked with
  an accent border + tag. Long option lists start collapsed.
- **Class table** (with merged subclass columns, e.g. Eldritch Knight / Arcane
  Trickster) showing the current level's row, expandable to the full table and to
  fullscreen. Class & subclass info + art shown in previews.

## 8. Feature choices & selectors

- **Recursive choice system** (Pathbuilder-style) — any feature that grants a
  choice can grant nested choices; picks are stored in a per-source "choice bag"
  and de-duplicated sheet-wide. Renders skills, tools, languages, feats, mixed
  pools (e.g. Skilled), ability-score increases, expertise, and weapon mastery.
- **Per-level class choices** — feats / ability score increases (with the ASI
  feat's +2-to-one or +1-to-two modes), fighting styles, expertise (restricted to
  proficient skills), and weapon mastery (count from the class table).
- **Optional-feature selectors** — one data-driven system over 5e.tools'
  `optionalfeatureProgression` covers Eldritch Invocations, Metamagic, Battle
  Maneuvers, Artificer Infusions, Arcane Shots, Runes, Elemental Disciplines,
  subclass Fighting Styles and Pact Boons, with the correct per-level count and
  colored prerequisites.
- **Subclass Fighting Styles resolve to feats (2024 fix)** — legacy subclasses that
  grant a Fighting Style via `optionalfeatureProgression` (e.g. Bard **College of
  Swords**, `FS:B`) pointed at the 2014 optional features, which are `reprintedAs` 2024
  **feats** and so were filtered out — leaving an empty selector. Those `FS:*`
  progressions now surface a **Fighting Style feat** picker (category `FS`) instead; the
  feature grants the "Fighting Style" prerequisite. The picker is **restricted to the
  fighting styles that `featureType` actually allows** (College of Swords → only Dueling
  and Two-Weapon Fighting, not the full list), derived from the `FS:*` optional-feature
  names in the data.
- **Subclass features are split into separate cards** — a level-3 subclass "umbrella"
  feature (College of Swords, Battle Master…) used to inline all its sub-features into a
  single block, unlike higher levels where each feature is its own card. `subclassFeatureList`
  now separates the umbrella's direct `refSubclassFeature` children into their own features
  (recursively), so each shows as its own card. Only the ones that carry an `options` block
  (Fighting Style, Blade Flourish, Maneuver Options…) start collapsed with an "Options" badge
  — the same treatment as Metamagic / Eldritch Invocations.
- **Option blocks render as cards** — in the feature text (`EntryContent`), any
  `type:'options'` block renders each option as a distinct bordered **card** with an
  accent-colored name, instead of a flat run of prose.
- **Sub-feature options** — "choose one of the following" features rendered as
  selectable cards, from both the structured `type:'options'` blocks (Divine Order,
  Primal Order, Elemental Fury) **and** the ones 5e.tools stores only in prose. After a
  coverage audit of every class/subclass feature, a curated set flags which prose
  features are a choose-one, and the options are **extracted from the feature's own
  sub-entries** (or an explicit list for damage-type choices): Cleric Blessed Strikes,
  Ranger Hunter's Prey / Defensive Tactics, Barbarian Wild Heart (Rage/Aspect/Power of
  the Wilds), Artificer Armor Model, Champion's Additional Fighting Style (a Fighting
  Style feat), and more. Subclass features are covered too, not just class features.
- Legacy feats count as General feats (with a free +1 ability bonus); feats show
  the ability bonus they grant.
- **Fixed ability boosts from feats now apply (bug fix)** — a 2024 feat that grants a
  *fixed* ability increase (e.g. XPHB **Great Weapon Master** → `ability:[{str:1}]`)
  was silently dropped: the choice parser only handled `choose` entries, so a fixed
  grant produced no selector and never reached the score. `fixedAbilityBoosts()` now
  extracts those grants and `resolve.deriveFeatAbilityBoosts()` collects them from every
  chosen feat (origin feat + ASI/species slots), resolving the feat from the compendium.
  They're threaded through the derivation (`deriveCharacter`) so the boost flows into the
  final score, its modifier, saves, skills, HP **and the Foundry export** — GWM now
  correctly shows +1 Strength on the sheet and in the exported actor.
- **Complete choice coverage across classes and subclasses** — after a systematic
  sweep of every 5e.tools class/subclass feature, all prose-only grants that need a
  selector now surface, via a curated grants map (keyed by feature name, and by
  `subclass|feature` for subclasses):
  - **Class features:** Ranger **Deft Explorer** (1 expertise + 2 languages), Wizard
    **Scholar** (1 expertise from a restricted list), Barbarian **Primal Knowledge**
    (1 skill from the class list).
  - **Subclass features** (a whole new path — subclass grants were never surfaced
    before): Bard **College of Lore** (3 skills), Fighter **Battle Master** (an
    artisan's tool + a class skill), Ranger **Fey Wanderer** (1 of 3 skills), Cleric
    **Order** / **Peace** (1 skill from a short list).
  - **Starting tool** choices read from the structured `toolProficiencies` field
    (Artificer artisan's tool, Bard instruments), picker restricted by tool category.
  - Bard's **"any skill"** starting proficiencies (`{any:3}`) now render — previously
    only `{choose}` skill blocks did, so Bard showed no skill selector at all.
- **Dedup vs. automatic grants** — you can no longer pick a skill/tool the sheet
  already grants for free (e.g. Artificer can't "choose" Tinker's Tools). Switching or
  clearing a subclass discards that subclass's granted picks.

## 9. Prerequisites

- A generic prerequisite engine evaluates any entity with a `prerequisite` field
  (feats today, optional features included). Checkable criteria: level (total or
  per-class), ability scores, race (with racial **groups** — eladrin/shadar-kai
  count as elf, "a Small race" checks size), owned feats, spellcasting, armor &
  martial-weapon proficiency, owned optional features and pact boons.
- Prerequisites are shown on cards and in previews, **colored** green (met) / red
  (not met) / amber (unverifiable), filterable, and a confirmation is required when
  selecting something you don't meet (or can't verify — confirm with your DM).

## 10. Automatic proficiencies & feature effects

- Proficiencies granted for free are derived and shown alongside the chosen ones:
  class starting **armor / weapons / tools** and species **fixed** skill/tool
  grants (e.g. Bugbear → Stealth), with readable labels. Fixed tools are read from
  the structured `toolProficiencies` field so a "one tool of your choice" entry is
  offered as a selector instead of leaking into the granted list.
- **Feature-effect registry** — chosen features whose benefits exist only as prose
  are translated into mechanical grants via a curated map and merged into the
  derived proficiencies (e.g. Divine Order → Protector grants Martial Weapons +
  Heavy Armor; Primal Order → Warden grants Martial Weapons + Medium Armor). The
  registry is structured to grow toward full mechanical implementation of class
  features (AC/attack bonuses, resources) for the eventual play mode.

## 11. Foundry VTT export (in progress)

- The end goal is exporting a character as a **Foundry VTT dnd5e actor** `.json`.
  Approach: the Foundry actor is a shell — Foundry recomputes derived stats from the
  character's **items + Active Effects**, so the actor `system` block only carries
  base values and references.
- **Actor `system` exporter** (`engine/foundryExport.js`) — a generalized translator
  from our derived character to the Foundry `system` block: ability scores + save
  proficiency, skill proficiency levels (0/1/2), tool proficiencies, traits (size,
  languages, weapon/armor proficiency + weapon mastery), XP-by-level and HP. Uses
  standard dnd5e enumeration tables (tool→id, language→code, armor/weapon→code), so
  the translator itself is character-agnostic.
- Validated by a **closed-loop test** against a real export (`etienne.json`, the
  Fighter 6 that also backs the engine fixture): decisions → derivation → Foundry
  `system` matches Foundry's own numbers.
- **Class-item advancement generator** (`engine/foundryAdvancement.js`) — builds the
  Foundry class item's `advancement[]` recipe (the steps Foundry unfolds at import) from
  the 5e.tools structured data we already fetch, with **no dependency on Plutonium**
  (see licensing note below): HitPoints, Trait grants (saves / skill choice / weapons /
  armor / weapon mastery), AbilityScoreImprovement at each ASI + Epic Boon level, and the
  Subclass step at the native level. Validated against **both** real exports — the
  official premade (Randal, Fighter 17) and the Plutonium sheet (Étienne) — plus the MIT
  dnd5e system source. Still deferred: ItemGrant (feature items), ItemChoice (Fighting
  Style) and ScaleValue, which need compendium item references.
- **Class-item serializer** (`engine/foundryItems.js`) — assembles the Foundry `class`
  Item document: the `system` block (identifier, levels, hit die, spellcasting) + the
  generated `advancement[]` (each with a Foundry-style `_id`) + the HitPoints `value`
  filled from the character's per-level HP.
- **Feature Items + Active Effects (Phase A2)** — `buildClassFeatureItems` turns each
  class feature into a Foundry `feat` Item (subtype `class`, identifier, description
  HTML, source), excluding the steps that are advancement rather than items (ASI, Epic
  Boon, the subclass marker). A curated **Active Effects registry** (`foundryEffects.js`)
  attaches `{key, mode, value}` changes for prose-only mechanics using the dnd5e public
  AE keys (e.g. Fast Movement → +10 `system.attributes.movement.walk`). The class item
  now wires an **ItemGrant** advancement per level linking to those feature items.
  Validated on the real 5e.tools Fighter (L6 → Fighting Style, Second Wind, Weapon
  Mastery, Action Surge…, granted at levels 1/2/5).
- **Subclass Items** — `buildSubclassItem` builds the Foundry `subclass` Item
  (identifier + `classIdentifier` + ItemGrant per level), and `buildSubclassFeatureItems`
  turns the subclass's features into `feat` Items, skipping the "umbrella" container
  feature and filtering by the subclass's source so mixed editions (PHB + XPHB) don't
  duplicate. Validated on the real Champion (Improved Critical, Remarkable Athlete,
  Additional Fighting Style, Heroic Warrior, Superior Critical, Survivor). Still to fill:
  chosen Trait/ASI values, activities/uses, and the real compendium UUIDs
  (Foundry-import validation).
- **Species Items (Phase A3)** — `buildSpeciesItem` builds the Foundry `race` Item from
  a resolved 5e.tools race (identifier from the base name, creature type, `movement` from
  speed, `senses.darkvision`, a `Size` advancement, description HTML). Because the race is
  resolved first, a lineage exports correctly — e.g. **Elf; Drow Lineage** → identifier
  `elf`, Darkvision 120, the Drow trait in the description.
- **Background Item (Phase A3)** — `buildBackgroundItem` turns the custom origin into a
  Foundry `background` Item: an `AbilityScoreImprovement` advancement from the origin
  ability boosts + a `Trait` granting the origin's skill proficiencies (fixed + chosen).
  When given the origin-feat item it also emits an **ItemGrant** linking it. Still to
  fill: tool/language Traits.
- **Chosen feats as Items** — the exported actor previously carried no feat the player
  picked (origin feat, ASI-slot feats), so on import "no feat worked". Now:
  - `buildFeatItem` builds a Foundry `feat` Item from a 5e.tools feat: subtype from the
    feat category (`G`→general, `O`→origin, `FS`→fightingStyle, `EB`→epicBoon),
    identifier, description HTML, source. A feat with a **fixed** ability boost (e.g.
    **Great Weapon Master** → +1 Str) carries an embedded `AbilityScoreImprovement`
    advancement (`configuration.fixed`, `value:{type:'asi'}`) — the canonical dnd5e
    encoding, matching a real Foundry export.
  - `buildClassChosenFeats` walks a class's choice-bag: a normal feat becomes an Item and
    the class's `AbilityScoreImprovement` advancement at that level is linked via
    `value:{type:'feat', feat:{id: '.id'}}`; a raw **Ability Score Improvement** pick emits
    no Item, filling `value:{type:'asi', assignments}` from the chosen boosts instead.
  - `buildOriginFeatItem` builds the origin feat (subtype `origin`), linked from the
    background by an ItemGrant.
  - Verified end-to-end on real data (New Character, Fighter 6, Elf Drow): the actor now
    includes **Alert** (origin), **Great Weapon Master** and **Polearm Master** (general,
    with the +1 Str advancement on GWM), the class ASI steps at L4/L6 point to those feat
    items, and Str exports as 19.
- **Full actor assembly (Phase A4)** — `engine/foundryActor.js` `assembleFoundryActor`
  ties it together into a complete `Actor` (type `character`): the `system` stats block +
  `items[]` (class(es) + class features, subclass + subclass features, species,
  background) + the `details.race/background/originalClass` references (by item `_id`). A
  **"Foundry" export button** on the builder downloads it as `<name>.json`. Validated
  end-to-end on real data (Étienne Fighter 6; and a live multiclass Fighter/Artificer with
  a subclass — all item refs resolve).
- **Import-readiness pass** — diffed the generated actor against a real premade export
  (Randal) to close schema gaps: added the standard actor blocks it was missing
  (`bonuses`, `spells`, `resources`, ability check/save roll config, `attributes.death/
  inspiration/attunement`) and the item defaults (class `startingEquipment`/`wealth`/
  `primaryAbility`/`properties`; feat `uses`/`prerequisites`/`activities`/`advancement`/
  `enchant`). Fixed the **ItemGrant** links to use **relative UUIDs** (`.<itemId>`, in both
  `configuration.items` and `value.added`) pointing at the embedded feature items, and
  linked the class `Subclass` advancement to the embedded subclass — the same shape a
  working exported actor uses. Remaining diffs are optional/newer fields Foundry fills on
  import (bastion, favorites, loyalty, bio text). Next: a live import into Foundry to
  confirm, then chosen advancement values, real compendium UUIDs, and spells.
- **Structural parity with Foundry's own export** — aligned every generated Item/actor to
  the exact shape a Foundry export uses, after diffing a round-tripped actor against a
  hand-built Foundry Fighter:
  - `system.advancement` is now an **object keyed by advancement `_id`** (Foundry's
    MappingField), not an array — `keyById()` builds it for class/subclass/species/
    background/feat items.
  - every Item carries a **`_stats` block** (`compendiumSource`/`coreVersion`/`systemId`/
    `systemVersion`) and a full **`source`** (`book` + `rules: '2024'` + `revision`); class
    `spellcasting` includes `preparation`; items default `img` to the item-bag icon.
  - **class item description** is filled from the cached class fluff (`classFluffHtml`);
    subclass from `subclassFluffHtml` when the 2024 fluff carries prose (Battle Master's is
    empty upstream, so its mechanics ride on the separate feature items instead).
- **Single Foundry format** — the builder now has **one "Export" button** (the Foundry
  actor `.json`); the separate `.builder.json` export was removed. Foundry is the sole
  import/export format the app targets (see DDL-0005).
- **Premade-parity pass (class/subclass "insertion")** — compared field-by-field against
  the official premade exports (Randal, Fighter 17) after the user reported the class/
  subclass still not registering properly:
  - **Every Trait advancement now carries `value.chosen`** — the "applied" state a real
    actor has. Fixed grants (saves/weapons/armor) copy their `grants`; choices are filled
    from the character's picks: starting skills (`skills:<code>`) and Weapon Mastery
    (full `weapon:<sim|mar>:<slug>` keys, category resolved from `items-base`). An empty
    `value` makes Foundry treat the advancement as *pending*, which is the likely cause of
    the class looking "not inserted".
  - **Fighting Style is an `ItemChoice` advancement** on the class (as in premades), not
    an ASI link: the recipe step is always generated for classes with the feature
    (config: 1 choice at the FS level, restriction `feat/fightingStyle`, `allowDrops`),
    and `value.added[level]` points at the embedded chosen FS feat item. The chosen feat
    no longer dangles unlinked; both the "Fighting Style" class feature item and the
    chosen `fightingStyle`-subtype feat coexist, exactly like the premade.
  - **Official icons**: class items use `systems/dnd5e/icons/classes/<id>.webp`;
    subclasses use their own icon when SRD (champion, lore, …) else inherit the parent
    class icon (guaranteed path, no 404).
  - **`primaryAbility`** filled from the 5etools field (`[{str},{dex}]` → str OR dex,
    `all:false`; single multi-ability entry → `all:true`), and `spellcasting.preparation`
    carries `{formula: ''}` as in real exports.
- **`hp.max` exports as `null`** — every real actor (premades, Étienne, hand-built
  example) stores `attributes.hp.max: null`: dnd5e 5.x derives the max from the class's
  HitPoints advancement **only when max is null**; a stored number switches the sheet to
  manual-HP override. We were exporting the computed max (58), which silently disabled
  HP-by-advancement. `hp.value` still carries the current HP.
- **"Level 0 / no class" — SOLVED** — importing our actor showed level 0 with no class
  even though the round-tripped JSON was intact. Mechanism: the sheet reads classes from
  `actor.itemTypes.class`, which **excludes documents that fail DataModel validation at
  construction** — an invalid embedded item keeps its source (survives re-export) but
  vanishes from collections. The Foundry console confirmed the exact field:
  `SubclassValueData validation errors: uuid: Invalid document type "" which must be a
  "Item"` on the Fighter class item. Cause: we wrote the class's **Subclass advancement
  `value.uuid` as a relative UUID** (`.itemId`); that field is a
  `DocumentUUIDField({type:"Item"})`, and a relative UUID can't be typed without a parent
  context → strict validation throws → the whole class Item is invalidated → level 0.
  Fix: write only `value.document` (a `LocalDocumentField` id that resolves the embedded
  subclass) and omit `uuid` (nullable, defaults to null). Note: relative UUIDs remain
  valid in the *unvalidated* string fields (ItemGrant/ItemChoice `value.added`, ItemGrant
  `configuration.items`) — only this one field was strictly typed.
- **ScaleValue advancements** — the class item now carries the level→value tables Foundry
  uses for scaling resources (`scaleValueAdvancements`, from `classTableGroups`): it cleans
  `{@filter …}` labels, **skips** spell columns (`|spells`), invocations
  (`|optionalfeatures`) and the spell-slot group, then emits the right ScaleValue type per
  resource column — **number** (Rages, Second Wind, Channel Divinity, and `bonus` cells like
  Rage Damage), **dice** (Sneak Attack, Martial Arts → `{number,faces}`), **distance**
  (Unarmored Movement → ft) — keeping only breakpoint levels. A small curated map adds
  prose-only scalings (Fighter **Action Surge**/**Indomitable**). Verified vs. the Randal
  premade (exact) and across Rogue/Monk/Barbarian; a caster (Wizard) yields none.
- **Feature `uses` (resource tracking)** — resource features now carry `system.uses`
  (max + recovery) so Foundry tracks the pool (`foundryFeatureUses.js`, curated from the 12
  official premades). The `max` references the class's own ScaleValue
  (`@scale.<class>.<slug>`, e.g. Second Wind, Rage, Channel Divinity, Sorcery Points,
  Focus Points) or a literal formula (Bardic Inspiration `max(1, @abilities.cha.mod)`,
  Lay on Hands `5 * @classes.paladin.levels`); recovery matches the premades (long-rest
  full ± short-rest 1). Also **deduplicates feature items by name** — 5e.tools re-lists a
  feature at each level it improves (e.g. Indomitable 9/13/17), but Foundry wants one item
  per feature (the progression is the ScaleValue/uses), matching the premades' feature set.
- **Feature `activities` (tap-to-roll, first batch)** — iconic resource features now carry a
  Foundry `activity` (`foundryActivities.js`) so the sheet shows a use/roll button that
  **consumes a use** (`consumption.targets: itemUses`), paired with the `uses` above:
  **Second Wind** → a `heal` activity (Bonus Action, `1d10 + @classes.<class>.levels`);
  **Action Surge** (special), **Rage** ("Expend Rage", 10 min), **Bardic Inspiration**
  ("Inspire", 1 hr) → `utility` activities. A generic skeleton builder emits the full dnd5e
  activity shape; the registry is curated from the premades and extends per feature.
- **Feature `activities` (second batch: pools & multi-activity)** — the skeleton gained
  consumption/target overrides, covering the harder shapes: **Lay on Hands** heals by
  **pool** (consumes N uses with `mode:'amount'`, scaling capped at
  `5 × levels − spent`, healing `@scaling`, targets 1 creature) + a "Remove Poison"
  activity at a flat 5 uses; **Font of Magic** converts points⇄slots with composite
  consumption (`itemUses` + `spellSlots`, including the premades' exact formulas);
  **Monk's Focus** offers Flurry of Blows / Patient Defense (Focus Point) / Step of the
  Wind at 1 point each plus the free Patient Defense; **Channel Divinity** is per-class
  (paladin → Divine Sense; cleric's save/heal activities deferred); plus **Indomitable**
  (action), **Innate Sorcery** (bonus, 2/LR — uses added too) and **Arcane Recovery**
  ("Recover", short rest). Still pending: Wild Shape's `transform` activity (CR-profile
  config), cleric Channel Divinity activities, and weapon attacks (Phase B equipment).
- **Background tool/language Traits** — `buildBackgroundItem` now also emits `Trait`
  advancements for the origin's tool proficiencies and languages (fixed + chosen),
  matching the premade Soldier shape (`tool:game:dice`, `languages:standard:common`).
  `toolTraitKey`/`languageTraitKey` (`foundryItems.js`) resolve the Foundry key from
  the 5e.tools `items-base`/`languages` compendium (tool category, language
  standard/exotic) via the shared `toolId`/`languageCode` helpers (now exported from
  `foundryExport.js`).
- **Import: feat source re-resolution + tool/language back-fill** — `itemRef` now
  re-resolves a feat's source from `db` when the imported item carries none (Plutonium/
  homebrew actors often omit `system.source.book`), so the pick still round-trips on a
  later export. `foundryToCharacter` reverses the background's Tool/Language Trait
  advancements back into `origin.toolProficiencies`/`origin.languages`
  (`toolKeyToName`/`languageKeyToName`, matching keys against the same compendium
  tables used to generate them).
- **Species sub-choices (export + import)** — `character.species.choices` (the same
  generic choice-bag as class/origin) is now exported and reversible, closing the
  Human "Skillful"/"Versatile" and Elf "Keen Senses" gap:
  - **Export**: `buildSpeciesItem` gained `character`/`db`/`featItems` params and now
    emits, alongside the existing `Size` step: an `AbilityScoreImprovement` for legacy
    species ability boosts (2024 species normally grant none via species — the field
    exists for older rules configs), `Trait` advancements for chosen skill/tool/
    language (mirroring `buildBackgroundItem`'s pattern, e.g. Elf's skill choice), and
    an `ItemGrant` for a species-chosen feat (Human's origin-feat pick). New
    `buildSpeciesFeatItems(character, db)` builds those feat Items the same way
    `buildOriginFeatItem` does, and `foundryActor.js` wires them into `items[]`.
  - **Import**: `foundryToCharacter` walks the race item's advancement and rebuilds
    `species.choices` under the SAME ids `parseChoices(raceObj)` would generate
    (`skill-0`/`feat-0`/…, safe because no XPHB species has more than one choice per
    field) — from our own exports (`Trait` titled "Skill Proficiencies" + `ItemGrant`)
    **and** from real Foundry premades, which use flavor titles instead ("Keen
    Senses", "Skillful") and structure the Human origin-feat pick as an `ItemChoice`
    (flat `value.added`, not the per-level shape the class Fighting Style uses) plus a
    separate `ItemGrant` for non-feat structural trait items (Resourceful/Skillful/
    Versatile placeholders) — a new `isRealFeat(item, db)` guard (checks `feats.feat`)
    keeps those placeholders out of the reconstructed feat pick. Trait kind (skill vs.
    tool vs. language) is now detected from the `chosen`-key prefix, not the title, for
    the same real-premade-titles reason.
  - Verified both by unit tests (round-tripping our own export shape AND a fixture
    matching the real Human premade shape) and live in the browser: built a Human with
    a skill + origin-feat pick in the builder, exported, and confirmed the actor JSON
    carries the `Trait`/`ItemGrant` exactly as designed.
  - Also fixed two lint-breaking leftovers from the previous (undocumented) tool/
    language-Trait commit: `foundryItems.js` used `toolId`/`languageCode` without
    importing them, and `foundryImport.js` imported `expandRaceVersions` unused.
- **Lineage-name import remapping** — diffed the race item's `name` field across all
  19 real reference sheets (12 official premades + `etienne`/`lili`/`melina`/`ohma`/
  `throgan`, plus 5e.tools' own `data/races.json`) to find the actual bug: our export
  reuses 5e.tools' own variant name verbatim (`"Elf; Drow Lineage"`), which `parseSpecies`
  round-tripped fine — but the **official Foundry premades** name a lineage race
  `"Base, Keyword"` (`"Elf, High"`, `"Gnome, Rock"`, `"Tiefling, Infernal"`), which
  doesn't match any real `_versions` name 1:1, so `resolveRaceObj`'s exact-match lookup
  silently failed and the lineage's traits/spells were dropped on import. Fixed by
  giving `parseSpecies` the `db` and having it resolve the extracted "rest" fragment
  against the base race's real `_versions` (`resolveLineageName`/`findBaseRace`): exact
  match first (our own exports), else a keyword match (`versions.find(v =>
  norm(v.name).includes(norm(rest)))`) that recovers the canonical 5e.tools name from
  the premades' abbreviated form; falls back to `"Base; Rest"` when the base race or its
  versions aren't in the compendium. `system.type.subtype` and `system.identifier`
  turned out unreliable across the board (Plutonium writes the *whole* display name into
  `subtype`, and slugifies the full name into `identifier`) — the keyword match against
  real `_versions` data was the only robust signal.
- **Feature `activities` (third batch: Wild Shape + Cleric Channel Divinity)** —
  researched the exact shapes from the real SRD source (`packs/_source/classes24/
  druid/class-features/wild-shape.yml`, `cleric/class-features/channel-divinity.yml` +
  `sear-undead.yml`, `cleric/subclass-features/life-domain/preserve-life.yml`) and
  confirmed byte-identical against the real Druid (`aoth`) and Cleric/Life (`akra`)
  premade exports:
  - **Wild Shape** — a new `transform` activity type (`foundryActivities.js`): 3
    level-gated `profiles` (CR ¼/½/1 at levels 2/4/8, `movement` restriction lifted at
    CR 1) using the dnd5e system's built-in `wildshape` preset. Its resource `uses`
    was already correctly wired (pre-existing `featureUses` entry, self-consistent
    with our own class-level `ScaleValue` generation — no fix needed there).
  - **Cleric Channel Divinity** — extended the per-class dispatch with 3 activities on
    the base item: **Divine Spark: Heal** and **: Save** (creature choice, con save,
    necrotic/radiant, `(@scale.cleric.divine-spark)d8 + @abilities.wis.mod` — a new
    curated class `ScaleValue` for the die count, since attaching one to the feature
    item itself like the real premade does isn't supported by our advancement
    generator yet; referencing it from the class scale is functionally equivalent) and
    **Turn Undead** (save only, no damage — the target's frightened/incapacitated
    Active Effect from the real premade is left for later, since applying an effect TO
    A TARGET is a new pattern our AE registry doesn't cover yet, only self-buffs).
  - **Multi-item Channel Divinity, confirmed**: `Sear Undead` (base Cleric feature,
    level 5) and `Preserve Life` (Life Domain subclass feature, level 3) are each
    their own feature item (already generated for free by the existing generic
    class/subclass-feature resolution) whose activity **cross-consumes the base
    Channel Divinity item's own pool** via `consumption.targets[0].target:
    'feat:channel-divinity'` — the real mechanism behind "multi-activity Channel
    Divinity", not multiple activities bundled on one item as previously assumed.
    `consumeUses()` and `baseActivity()` gained `target`/`range` parameters to
    support this and the 30 ft range Divine Spark/Turn Undead need.
  - Added a `save` activity factory (con/wis save DC, optional damage) alongside the
    existing `heal`/`utility` ones.
  - Verified live in the browser (not just unit tests): built a level-6 Cleric with
    the Life Domain subclass and a level-8 Druid, exported both, and confirmed the
    actor JSON's activities/uses/consumption match the design exactly, with no
    console errors.
- **Turn Undead's target-facing Active Effect** — closes the gap noted above. Added a
  second kind of curated effect to `foundryEffects.js`, `FEATURE_TARGET_EFFECTS`
  (`targetEffectFor`): unlike the existing self-buff registry (`transfer: true`,
  applied to the item's owner), this is `transfer: false` — a `statuses`-only effect
  (`['frightened', 'incapacitated']`, 60s duration, no `changes`) that lives on the
  Channel Divinity item but is only *applied* when the Turn Undead activity's save
  fails, via `activity.effects: [{_id}]` pointing at it. `buildFeatureItem` now builds
  this alongside the self-buff effect and threads the generated `_id` into
  `featureActivities(name, classId, {targetEffectId})`, which the `save()` activity
  factory accepts as `effectId`. Gated to `channel-divinity|cleric` (Paladin's Channel
  Divinity feature shares the name but has no such effect).
- Not yet done: the `items[]` Active Effects for equipment/spells, and real
  compendium UUIDs.
- **Inventory → Foundry Items, both directions** (`foundryItems.buildInventoryItems`
  + `foundryImport` inventory/currency). Each `character.inventory` entry now exports
  as a physical Foundry Item, typed and shaped from the 5e.tools data:
  - **weapon** — `type.value` simpleM/simpleR/martialM/martialR, `damage.base`
    (number/denomination/type from `dmg1`+`dmgType`), `damage.versatile` (`dmg2`),
    `range`, and `properties[]` mapped 5e.tools→dnd5e codes (V→ver, H→hvy, F→fin,
    2H→two…).
  - **equipment** — armor gets `type.value` light/medium/heavy/shield + `armor.value`
    (AC) + `armor.dex` cap (null/2/0) + `strength` + `stealthDisadvantage`; rings/
    wondrous/rods/wands map to the matching misc-equipment type; `mgc` property on
    magic items.
  - **tool / consumable / loot** — tools→`art`/`music`, potions/scrolls/ammo/food→
    consumable subtypes, gear/treasure→loot; all carry price (copper→gp/sp/cp),
    weight, quantity, rarity (`very rare`→`veryRare`), attunement, equipped/attuned.
  - **Custom item images ride along**: `entry.customImg` → the Item `img`; without one
    a generic Foundry `icons/…` path is used (deliberately *not* the 5e.tools art URL,
    which is http and would be mistaken for a user image on re-import).
  - **Reverse import** maps every physical Item back to an inventory entry, re-resolving
    the 5e.tools **source by name through `latestOnly`** (the Foundry Item doesn't carry
    it, and the source must be the current one — XPHB, not a classic reprint — or the
    item won't re-resolve), preserving quantity/equipped/attuned and keeping a `data:`/
    URL `img` as `customImg`. Currency (`pp/gp/ep/sp/cp`) now round-trips too.
  - Verified live end-to-end: exported a character, re-imported the JSON, and the armor
    re-resolved, stayed equipped, and the **AC recomputed to 14** (Studded Leather 12 +
    Cloak +1 + Ring +1); 11 new tests in `foundryInventory.test.js`.
- **Exported items now actually *work* in Foundry** (activities + Active Effects, the
  piece deferred above):
  - **Weapons get a tap-to-roll attack activity** — `type: 'attack'`,
    `attack.type.value` melee/ranged (from the weapon kind), `attack.ability: ''` and
    `damage.includeBase: true` so Foundry derives hit/damage from the weapon + the
    character's stats (str/dex, finesse, proficiency), exactly like a native export. No
    formulas are stored (we still have no play mode; this is purely for Foundry).
  - **Magic weapons** set `system.magicalBonus` from 5e.tools `bonusWeapon` (+X to
    attack **and** damage, applied by Foundry).
  - **Magic items with flat bonuses** (`bonusAc`/`bonusSavingThrow` — Ring/Cloak of
    Protection, magic shields/armor) now carry a **transfer Active Effect** (`system.
    attributes.ac.bonus` / `system.bonuses.abilities.save`, mode ADD), matching the
    official Ring of Protection. Foundry suppresses it automatically until the item is
    equipped/attuned (`isSuppressed`), so the AC/save bonus is conditional for free.
  - **Feature Active Effects broadened** (`foundryEffects.js`): the registry became
    class-aware (`effectChangesFor(name, classId)`) and gained the clean flat mechanics
    it was missing — **Fighting Styles** Archery (`+2 rwak.attack`) and Defense (`+1
    ac.bonus`), and **Unarmored Defense** keyed per class (Barbarian → `ac.calc =
    unarmoredBarb`, Monk → `unarmoredMonk`, a mode-OVERRIDE that makes Foundry compute
    10+Dex+Con / 10+Dex+Wis). `buildFeatItem` now applies effects too (chosen fighting
    styles/feats previously exported with none). Conditional styles (Dueling/GWF/TWF/
    Protection) are deliberately left out — Foundry handles those via riders/enchant, a
    flat AE would over-apply.
  - Verified live: exported a character and confirmed the Shortbow's ranged attack
    activity (`includeBase`), and the Ring/Cloak of Protection transfer effects with the
    AC + save changes. 7 more tests (18 total in `foundryInventory.test.js`), 355 pass.

## 12. Testing & verification

- ~170 unit tests (Vitest) covering the engine (math, abilities, HP, proficiencies,
  choices, prerequisites, class progression, multiclass, optional features,
  feature options, Foundry export, `_copy` resolution).
- A verification harness runs the real feature-resolution pipeline over every class
  and at least one subclass per source (67 subclasses) to confirm no empty,
  unresolved or dropped features.

## 13. Inventory (Phase B1, in progress)

- **Full item data fetch** — `data/config.js` `GLOBAL_FILES` gains `items.json`
  (2428 entries — all magic items *and* generic gear/food/ammunition; confirmed the
  230-entry `items-base.json` we already fetched is mundane weapons/armor/tools
  *only*, not the full catalog) and `fluff-items.json` (art/lore, same pattern as
  `fluff-races.json`). Verified both exist on the live mirror before merging —
  `fetcher.js` fetches the whole manifest via a single `Promise.all`, so one missing
  file would have broken data loading entirely, not just items.
- **`engine/items.js`** (pure, new) — the item-side counterpart to
  `resolveRaceObj`/`findFeat`: `resolveItemObj(db, itemId, source)` looks up
  `items-base` then the general `items` catalog (both `latestOnly()`-deduped);
  `itemTypeInfo(raw)` maps every 5e.tools item type code (weapon/armor/tool/
  instrument/ammunition/gear/food/wondrous/ring/wand/rod/potion/scroll/treasure/
  other — wondrous items have no `type` field, just a `wondrous` boolean) to a
  stable group + weapon melee-or-ranged/simple-or-martial and armor light/medium/
  heavy/shield subtypes, for the inventory tab's grouping (next stage);
  `attunementInfo(raw)` reads `reqAttune` (boolean or a prose string — the latter
  can't be checked automatically, same "unknown" bucket `prereqStatus` already uses
  for feats); `carryingCapacity(str)` is the core 2024 rule (`str × 15` lb), not
  Foundry's 3-tier variant encumbrance.
- **Wired into derivation** — `resolve.js` `deriveFromDb` now also computes
  `deriveInventory(character, db)` (resolves each `character.inventory[]` entry,
  sums weight, counts attuned items) and merges `inventory`/`attunedCount`/
  `encumbrance: {totalWeight, capacity, encumbered}` onto the object `useDerived`
  returns — same plug-in point `armor`/`weapons` already use. `deriveCharacter`
  itself stays pure (character + ctx only); the db-dependent inventory resolution
  happens in `deriveFromDb`, which already has `db` in scope.
- `schema/character.js` gains `createInventoryItem(itemId, source)` (mirrors
  `createClassEntry`) — the `Currency`/`InventoryItem` typedefs and their defaults
  in `createCharacter`/`migrate` already existed but nothing populated them.
- Verified: unit tests for the new engine module (weapon/armor/wondrous/gear/ring
  fixtures, resolution fallback, weight aggregation) and live in the browser —
  confirmed `items`/`fluff-items` land in IndexedDB with the expected counts (2428
  items, 948 fluff entries) after a fresh fetch, no console errors.
- **Stage 2 — the Inventory tab itself.** The "Equipment" placeholder is gone;
  `Builder.jsx` `TABS` now has **Inventory**, rendering the new
  `components/builder/InventoryTab.jsx`:
  - **Sub-tabs by item group** — "All Items" (default) plus one pill per group
    the character actually owns (`GROUP_ORDER` from `engine/items.js`, so an
    empty group never shows an empty tab), styled identically to `ClassTab`'s
    multiclass sub-tabs (`.subTab`/`.subTabActive`, copied into
    `InventoryTab.module.css`).
  - **Search** (name substring, scoped to the active sub-tab) and a **sort
    toggle** (Name/Rarity) on All Items; a per-group **sub-grouping toggle**
    (Weapons: Simple/Martial or Melee/Ranged; Armor: Slot) using the
    `category`/`kind`/`armorSlot` fields `itemTypeInfo` already computes.
  - **Equip/Attune** as toggle buttons per row (Equip only shown for
    weapon/armor/spellcastingFocus/tool/instrument groups; Attune only for
    items with `reqAttune`). Attuning follows the **exact same warning
    pattern** `ClassTab`'s multiclass check and `ChoiceList`'s feat-prereq
    check already use — `unmetAttunement` (new `engine/attunement.js`, flat
    max of 3) returns a reason string, and the handler does
    `if (reason && !window.confirm(...)) return;` — never a hard block, just
    the same confirm-to-override UX already established elsewhere.
  - Quantity stepper (floors at 1) and a remove button per row; unresolved
    items (e.g. from a stale/imported inventory referencing something no
    longer in the compendium) show an "unresolved" tag instead of crashing.
  - Verified live in the browser: seeded a test character's inventory
    directly (no shop yet — that's the next stage) with a weapon, ranged
    weapon, armor, two attunement items, and a stack of gear; confirmed
    dynamic sub-tabs, search, both sort/sub-group toggles, equip, attune (plus
    catching a genuine `latestOnly()` dedup case — a DMG-sourced item that had
    been reprinted to XDMG correctly showed as unresolved until the source was
    corrected, proving the reprint filtering works), quantity, and remove all
    work with no console errors.
- **Stage 3 — the shop + currency.** Buying is now possible; before this,
  Stage 2's browser check had to seed `inventory[]` directly.
  - **New `selector/entities/item.js`** — same entity-config shape as
    `weapon.js` (`list`/`idOf`/`precompute`/`filters`/`meta`/`card`), sourced
    from the COMBINED `items-base` + `items` pool (`latestOnly()`-deduped),
    filtered by Type (derived from `itemTypeInfo`'s group labels — the same
    classification the Inventory tab uses), Rarity, "Requires Attunement",
    and Source. `fluff(raw, db)` reads `db['fluff-items']` for the art/lore
    the `DetailView` preview pane shows. Also excludes `age`-tagged entries
    (modern/futuristic/renaissance firearms) — the same filter `weapon.js`
    already applies for Weapon Mastery, so the default shop doesn't surface
    sci-fi guns alongside fantasy gear.
  - **New `components/builder/EquipmentShop.jsx`** — a "+ Shop" trigger that
    opens `SelectorPanel` **directly** (not through `PickerField`, which
    always closes on select) so the panel stays open across repeat
    purchases; `onSelect` just doesn't call `setOpen(false)`, no
    `SelectorPanel` changes needed at all. Buying checks the price (in
    copper, per 5e.tools' `value` field) against the wallet — insufficient
    funds or **no listed price** both surface the same non-blocking
    `window.confirm` warning used everywhere else in the app (per
    CLAUDE.md's established pattern), never a hard block.
  - **New `engine/currency.js`** (pure) — `toCopper`/`toGp` for reading the
    5-denomination wallet as one number; `fromCopper` re-splits a total back
    into pp/gp/ep/sp/cp using the largest-denomination-first "minimal coins"
    algorithm (buying **simplifies** whatever odd mix of coins the character
    was carrying into the fewest coins with the same total value).
  - **New `components/builder/CurrencyCard.jsx`** — five compact steppers
    (pp/gp/ep/sp/cp) plus the computed gp-equivalent total, at the top of the
    Inventory tab.
  - **Real bug caught during verification, not just a design risk**: the
    first working version wired the shop through two separate setters
    (`onAddItem` + `onChangeCurrency`), each independently calling `save()`.
    Live testing showed the currency correctly deducted but the purchased
    item silently vanishing — confirmed via direct IndexedDB inspection
    (not just the UI) that `characterStore.save()` **replaces the whole
    character record** from whatever `character` object is passed in; since
    both setters closed over the *same* pre-purchase `character` snapshot,
    the second `save()` call (currency) overwrote the first one's inventory
    change. Fixed by collapsing both into a single `onPurchase(item,
    currency)` → one `save({...character, inventory: [...], currency})`
    call — the general lesson (and now the pattern to follow) being that any
    single user action touching two character fields must resolve to
    exactly one `save()`, never two sequential ones built from the same
    stale closure.
  - Verified live in the browser end-to-end: bought a Potion of Healing at
    exactly 50gp against a 50gp balance (no warning, correct — not
    `price > balance`), confirmed it landed in a new "Potions" sub-tab and
    gold went to 0 via direct IndexedDB inspection (not just the rendered
    UI); separately confirmed the insufficient-funds warning fires with the
    exact expected message ("Half Plate Armor costs 750gp — your character
    only has 0 gp. Add it anyway?") and, when declined, the item is
    correctly **not** added.
- **Stage 4 — encumbrance readout (Phase B1 equipment: done).** A compact
  "X / Y lb carried" line in the Inventory tab header, sourced from Stage 1's
  `encumbrance` derivation (`totalWeight`/`capacity`/`encumbered`) — dim/muted
  when under capacity, red with an "Over Capacity" badge when not. No
  blocking (5e doesn't prevent carrying too much, it imposes a speed penalty
  the sheet doesn't model yet — just the visual cue). Verified live: a
  fresh character showed "28.5 / 210 lb carried" (STR 14 × 15) correctly
  un-flagged; bumping a stack to push total weight over capacity flipped it
  to the red "Over Capacity" state, then reverted cleanly.
- **UI/UX polish pass over the Inventory tab** (post-B1):
  - **Richer item rows** — each row gains a second meta line with a readable
    **type** ("Martial Melee Weapon", "Heavy Armor", "Wondrous Item" —
    weapon/armor labels composed from `itemTypeInfo`'s category/kind/slot,
    others singularized from the group label) and a **rarity badge** colored by
    the D&D convention (green uncommon / blue rare / purple very rare / orange
    legendary / gold artifact).
  - **Tap for item details** — the item name is now a button (with a small ⓘ
    hint) opening a fullscreen-on-mobile overlay with the standard `DetailView`
    (art, lore, full description, price/weight/attunement meta) via the
    existing `itemEntity` — same overlay pattern as `PickerField`'s info
    button. Unresolved items don't open (button disabled).
  - **Attunement counter** — an "Attuned X/3" chip next to the encumbrance
    readout (red when over `ATTUNEMENT_MAX`), so the flat limit is visible
    before the confirm-warning fires.
  - **Encumbrance progress bar** — the carried-weight line gains a thin
    accent-colored fill bar (red when over capacity), replacing text-only.
  - **Equipped/attuned rows get an accent left border** for at-a-glance state.
  - **Remove now confirms** (`window.confirm`, the app-wide pattern) — it was
    a one-tap destructive action with no undo.
  - **CurrencyCard mobile fix** — the 5-coin grid used fixed
    `repeat(5, 1fr)` columns whose steppers have a ~84px minimum width, so at
    375px the Silver/Copper columns overflowed the card; now
    `repeat(auto-fit, minmax(88px, 1fr))` wraps them into a second row.
  - Verified live at 375px and desktop widths: currency wraps, badges/type
    lines render, the detail overlay opens with art + description (Ring of
    Protection), equip/attune borders show, and no console errors; `npm run
    lint` + all 324 unit tests pass.
- **Inventory tab redesign (VTT-style, per user mockup)** — second polish pass,
  rebuilding the tab's layout around a reference mockup:
  - **"All Items" groups by TYPE by default** (canonical `GROUP_ORDER` section
    order, alphabetical within each section), switchable via a new **Group**
    dropdown (Type / Rarity / None; on the Weapons tab: Simple-Martial /
    Melee-Ranged; Armor: Slot — replacing the old toggle buttons). Rarity
    sections order artifact→mundane; items with no rarity group as "Mundane".
  - **Sort dropdown** on every tab (Name / Rarity / Weight-descending),
    applied within sections.
  - **Item thumbnails** — each row shows the real 5e.tools item art (the
    `fluff-items` image via the existing `imgUrl` helper, lazy-loaded);
    items without art (or broken loads, via an `onError` state) fall back to a
    per-group emoji glyph. The same glyphs decorate the group sub-tab pills.
  - **Weapon property meta line** — weapons read "Martial Weapon • Heavy •
    Two-Handed" (5e.tools `property` codes mapped to labels); armor reads its
    slot ("Light Armor"); rarity badge sits on its own line below (mockup
    layout). The whole thumb+text block opens the item detail overlay.
  - **Row actions consolidated** — Equip stays a visible button ("✓ Equipped"
    when active); Attune, Details and Remove move into a per-row **⋯ menu**
    (fixed-backdrop dropdown). Attuned state stays visible as a chip next to
    the rarity badge.
  - **CurrencyCard is now a horizontal wallet bar** — coin icon (CSS radial-
    gradient disc per metal) + label + directly-editable number input,
    divider-separated; steppers removed; the gp-equivalent total moved to the
    card's tooltip. Coins wrap on mobile (header stacks below 700px).
  - **Status card** (carried weight + mini progress bar, red over capacity;
    "Attuned X/3") replaces the loose status line, sitting beside the wallet.
  - Search gains a ⌕ icon; the Shop button joins the search/sort/group row.
  - Verified live at 375px and desktop: type-grouping defaults with correct
    section order, rarity grouping/sorting, art thumbnails + glyph fallbacks,
    the ⋯ menu, equip/attuned states; no console errors; lint + 324 tests pass.
- **Inventory tab, third polish pass (declutter, per user feedback)** — two
  reductions the user asked for on top of the mockup redesign:
  - **The per-row ⋯ menu is gone.** Clicking the row already opens the item
    detail overlay, so the menu's "Details" was redundant and the button ate
    horizontal space on every row. Attune / End attunement and Remove now live
    in a **fixed action footer inside the detail overlay** (Equip appears there
    too, for equippable groups). The overlay tracks the entry by `uid` against
    the freshly-derived inventory each render, so toggling equip/attune updates
    it live, and removing the item closes it automatically (the uid disappears
    from the derived list). Unresolved items (no raw match) also open the
    overlay now — they show an explanatory note plus the Remove action, which
    previously was only reachable through the menu.
  - **CurrencyCard shrunk** — the "Currency" title and the spelled-out coin
    names ("Platinum"…) are gone; each coin is now icon + small pp/gp/ep/sp/cp
    sigla + editable value (full name kept in each coin's tooltip/aria-label,
    gp-equivalent total still on the card tooltip). The bar is a single slim
    row on desktop and wraps to two rows at 375px.
  - Verified live (desktop + 375px): row click → overlay with Equip/Attune/
    Remove footer, attune toggle updates the header count live, currency wraps
    without horizontal overflow, no console errors; lint + 324 tests pass.
- **Inventory tab, fourth pass (consistency + collapsible section panels)** —
  after a multi-width review against the Foundry-VTT reference:
  - **Controls made consistent and predictable across widths**: the search bar
    and the Shop button share ONE fixed line (both 40px tall, search flexes,
    Shop never wraps); the Sort/Group dropdowns move to their own row right
    below the category sub-tabs. Previously all four shared a wrapping flex
    row with three different heights, which scrambled at intermediate widths.
  - **Sections are now collapsible PANELS** (dnd5e `items-section` style):
    bordered panel per group with an accent header (uppercase title + count
    chip + rotating chevron; `aria-expanded`), clicking toggles collapse
    (state keyed per tab+grouping). Item rows inside are **flat and compact**
    (divider-separated, 36px thumb, tighter paddings) instead of the old
    individually-bordered cards with gaps — recovering the horizontal and
    vertical space the cards wasted. Equipped/attuned rows keep an inset
    accent bar (`box-shadow`, since the rows lost their own borders).
  - **Rarity/attuned badges moved inline** with the type/properties sub-line,
    so every row is exactly two text lines tall — symmetric rows in a section.
  - **CurrencyCard is a grid of 5 real input boxes** (bordered field + coin
    icon + sigla, value right-aligned; `:focus-within` accent) so editability
    is visible, ordered by value (pp→cp); one line normally, 3+2 below 540px
    viewport. Used a viewport media query on purpose: `container-type` on the
    card (or an inner wrapper) made Chrome reserve the taller 2-row layout's
    height while rendering 1 row when the query threshold sat near the real
    width. Also fixed the stacked-header case (`.header > * { flex: none }`):
    the card's `flex: 1` acted on the VERTICAL axis once the header went
    `flex-direction: column`, inflating the card.
  - Verified live at 375 / 543 / 768 / 1280 px: coins 3+2 on mobile and single
    line elsewhere, search+Shop always one line, panels collapse/expand, rows
    uniform, no horizontal overflow, no console errors; lint + 324 tests pass.
- **Inventory tab, fifth pass (12-point UX cleanup from user feedback)**:
  - **Root-cause fix for the "big left margin" + dead vertical space**: the
    section `<ul>` never reset the browser default `padding-left` (~40px) and
    `margin` (~16px). Added `list-style/margin/padding: 0` — items now align to
    the panel edge and panels have no empty band above/below the list.
  - **Equip is a radio-style toggle** (`role="switch"`): a circle that fills
    when equipped + "Equip"/"Equipped" label, replacing the flat button.
  - **Quantity is editable** (`QtyInput`, commit on blur/Enter) for large
    counts, and the **minus is always enabled** — at qty 1 it removes the item
    (the primary delete path; still `window.confirm`-guarded).
  - **Sort/Group selects made readable**: with `background: transparent` Chrome
    on Windows drew the native control white-on-white; set explicit dark
    `background`/`color` on the select and its `option`s.
  - **Rarity/attuned badges shrunk** (8.5px, tighter padding).
  - **Category sub-tabs now span the full control width** (`flex: 1 0 auto`):
    they grow to fill when they fit and scroll when they don't — verified they
    share the exact left/right of the search and Sort/Group rows.
  - **Shop button recolored** to the SelectorPanel "Select" pattern
    (`bg-soft` + accent border + white text).
  - **Item detail panel enriched** (`item` entity `meta(r, db)` + new
    `entries(r, db)`): weapons show Type, **Damage die + type**, **Range**,
    **Properties** (Finesse/Heavy/…), **Mastery**, and full prose for each
    property + mastery resolved from `items-base.itemProperty`/`itemMastery`;
    armor shows AC, Strength req, Stealth. The detail **image is height-capped**
    (`capImage` → `max-height: 240px`, `object-fit: contain`) so tall item art
    can't blow up the panel.
  - **Derived prices for magic items** (`engine/magicItemPrice.js`). ~1,600 of the
    1,627 magic items in the 5e.tools catalog have **no listed price**, so the shop
    showed them as "no price". They now get an estimated price from three 5e.tools
    tables baked in as constants (no reason to re-read the compendium for fixed data):
    **Magic Item Crafting Time and Cost** (per rarity: Common 50 gp/1 workweek …
    Legendary 100,000 gp/50 workweeks), **Spell Scroll Costs** (per spell level, used
    for scrolls), and **Hirelings** (a skilled hireling is 2 gp/day). The formula is
    `base-item cost (if any) + table cost + skilled-hireling 2 gp/day × crafting days`
    (workweek = 5 days) — e.g. Cast-Off Plate Armor = 1,500 (Plate) + 50 + 5×2 = 1,560
    gp; Dagger of Venom = 2,000 + 50×2 + 2 (Dagger) = 2,102 gp. The base-item cost is
    resolved via the magic item's `baseItem` field. Derived prices are shown with a
    leading **~** (estimate) in the shop cards, the item detail, and the inventory
    "Value", and the shop charges/checks against them; the Foundry export uses the
    derived value too so magic items carry a price in-game. 9 tests in
    `magicItemPrice.test.js`; verified live (Uncommon → ~220 gp, Rare → ~2,100 gp).
  - **Shop reworked** (`SelectorPanel` gains optional `renderFooter` +
    `renderCardActions`, no change to other selectors): the preview footer is
    now **quantity + live total cost + Buy** (no generic "Select"), and **each
    card carries its own qty stepper + Buy**. Buying N deducts price×N in a
    single `save()` and consolidates change. Per-item qty is one shared state
    keyed by id, so the card and preview steppers stay in sync.
  - Verified live at 375 / 1000 px: alignment, radio toggle, editable qty,
    minus-to-remove, readable selects, enriched weapon/armor detail with capped
    art, and a full shop buy (3× Alchemist's Supplies → currency 147gp →
    2pp/1sp/2cp, item added at qty 3); lint clean + 324 tests pass.
- **Inventory tab, sixth pass (shopping cart + 11-point cleanup)**:
  - **Buying now merges stacks**: `purchaseItem` → `purchaseItems(items[], currency)`
    in Builder — adds each bought entry to an existing non-equipped, non-attuned
    stack of the same item (quantity += bought) instead of creating a duplicate
    row; unmatched items still append. Feeds both direct buys and cart checkout.
  - **Mobile Sort/Group fill the row** (each `flex: 1`, half-width) instead of
    hugging the left, matching the controls above (≤640px).
  - **Equip toggle is just the radio** — no label, no border/pill; a filled
    circle = equipped, a hollow one = not. Saves the horizontal space the
    "Equip/Equipped" text took (state read from the fill + `aria-label`/title).
  - **Shop button shows a 🛒 icon** instead of "+".
  - **Preview images are height-capped everywhere** in the SelectorPanel
    (`DetailView capImage` on the preview + mobile detail): fixes the huge art
    on older races/subclasses (and items) blowing up the panel — `max-height:
    240px; object-fit: contain`.
  - **Species filters reordered** so **Source is last** (longest list, least
    used) — it no longer pushes Size/Speed/Type/Traits down.
  - **Shopping cart** (the big one). Extended `SelectorPanel` with one more
    optional prop — `renderBottomBar({ setPreview })` — rendered as a bottom bar
    inside the panel; `setPreview` lets the bar open an item's preview. All cart
    logic lives in `EquipmentShop` (`cart: { id → {raw, qty} }`):
    - **Cards lost the Buy button** — they carry *only* a qty stepper, default
      **0**; raising it adds the item to the cart, zeroing removes it.
    - **Preview "Buy now"** buys that item **directly (1 unit), bypassing the
      cart, and closes the panel** (`buyNow`).
    - **Bottom bar** shows 🛒 unit count + running total + a Checkout toggle;
      only visible when the cart is non-empty. Tapping it raises a **cart sheet**
      listing each line (name, unit price, qty stepper that adjusts/removes at 0,
      line total), a grand **Total**, an **Empty cart** button, and a **Buy N
      items** that checks out all of them in one merged `purchase()`. Tapping a
      line **opens that item's preview** (closes the sheet, pins the preview /
      opens the mobile detail screen).
    - `purchase()` centralizes the money math + confirms for over-budget or
      unpriced items; direct buy and checkout both go through it.
  - Verified live (375 / 760 / 1100 px): radio-only equip, mobile Sort/Group
    widths, 🛒 button, capped race/item preview art, Source-last species
    filters, and the whole cart loop — add via card steppers, adjust/remove in
    the sheet, tap-to-preview, Buy now (direct, merges 25→26, closes), checkout
    (merges 26→28, closes), Empty cart; lint clean + 324 tests pass.
- **Inventory tab, seventh pass (four small adds)**:
  - **Shop preview gets the quantity counter**, linked to the card/cart counter
    (shared per-item state) — so opening an item from a card or the cart keeps
    its quantity. **"Buy now"** now buys `max(1, counter)` units directly (any
    quantity), removes that item from the cart, and closes the panel.
  - **Group/Sort selects swapped** — Group now sits before Sort.
  - **Item detail overlay: the Remove button became a quantity counter** ("Qty
    − n +"); decrementing to 0 (minus at qty 1) removes the item and the overlay
    auto-closes (the uid drops out of the derived list).
  - **Custom item images**: tapping the item art in the detail overlay opens an
    image source modal (Upload from device → data-URL via the shared
    `fileToPortrait`, or paste a URL — same pattern as the character portrait),
    stored as `entry.customImg`. It overrides the 5e.tools art; "Remove custom
    image" reverts to the original art (or the placeholder when the item has
    none). `DetailView` grew optional `customImg` + `onImgClick` props (image
    becomes a button with an ✎ hint); non-editable callers are unchanged.
  - Verified live: linked shop/preview counter + Buy-now-any-quantity (bought 2
    directly, merged, closed), swapped selects, overlay counter incrementing and
    removing at 0, and the full image loop (set via URL → shows → remove →
    reverts to Longsword art); lint clean + 324 tests pass.
- **Inventory tab, eighth pass (three detail-overlay tweaks)**:
  - **Custom image flows to the row thumbnail** — `thumbOf` returns
    `entry.customImg` first (works even for unresolved items), so a picture
    added in the detail overlay shows in the list too.
  - **The "Add image" box became a small button** — when an item has no art,
    the overlay shows a compact "🖼️ Add image" pill (left-aligned) instead of a
    tall dashed placeholder, since not every item wants a picture.
  - **Overlay footer mirrors the shop preview**: quantity counter on the LEFT,
    total **Value** (price × qty) + **Equip**/**Attune** on the RIGHT (no "Qty"
    label). Zeroing the counter still removes the item.
- **Reusable `Stepper` component** (`components/common/Stepper.jsx`) — one control
  with `[− value +]` in a pill (per the user mock) to replace every ad-hoc pair of
  step buttons in the app for a coherent look. Fully configurable by props: `value`/
  `onChange`/`min`/`max`/`step`, `decimals`, `maxDigits`, `editable` (input vs
  read-only), `onMinReached` (fires on − at the minimum — e.g. remove the inventory
  item — otherwise − disables at min), and style props that map to CSS custom
  properties (`bg`, `border`, `radius`, `padding`, `gap`, `numberColor`, `plusColor`,
  `minusColor`, `fontSize`, `fontWeight`, `maxWidth`, `height`, `buttonSize`,
  `numberWidth`) so each instance themes itself without new CSS. **First applied to the
  Inventory tab** (row qty, detail-overlay qty) and the **shop** (card / preview / cart
  steppers), retiring the local `QtyInput`/`QtyStepper` and their CSS.
- **Stepper — rollout + refinements.** After the checkpoint, applied it **app-wide**
  (ability-score **Base** and class **Level** steppers, plus the HP tile) and retired
  the last ad-hoc step buttons + their CSS. Four requested improvements:
  1. **Pixel-perfect alignment** — the −/number/+ now share the exact vertical centre
     (`line-height: 0` + flex-centred glyphs; number height = button size). Verified:
     all three and the container centre land on the same y.
  2. **Vertical orientation** — `orientation="vertical"` stacks + / number / − (no
     usage yet; ready for later).
  3. **Shop stepper moved INSIDE the card** — the item card became a box (`cardBox`)
     holding a borderless info button + the stepper at its base, instead of a stepper
     tacked on below the card.
  4. **HP tile mirrors ability cards** — a **Base** label over the stepper (which edits
     the base HP, stored as the `hpBonus` offset over the hit-dice total) and a new
     **Constitution** bonus row showing the CON-derived HP (feat HP like Tough/Draconic
     Resilience will slot in here once modelled). `hpBreakdown` now returns `base`/`con`
     per class to split hit-dice HP from the CON contribution.
- **Stepper — space/fit polish pass (HP tile, ability cards, shop).** A visual
  cleanup so the pill uses the space it has and never overflows its container:
  1. **Steppers now FILL their container width** in the HP tile and ability cards
     (`TILE_STEPPER` passes `style:{width:'100%'}`; `.stepperBlock` dropped its
     `align-items:center` so the pill stretches, and the number flexes in the middle).
     Fixes both the wasted horizontal space beside a centred pill on wide screens
     **and** the border getting clipped by the card's `overflow:hidden` on narrow/mobile
     widths — the pill can no longer be wider than the card. 3-digit HP now has room
     (the number flexes instead of a fixed 3ch).
  2. **Tighter top padding** above the "Base" legend (`.stepperBlock` `9px 5px` →
     `5px 10px 8px`), removing the dead band the user flagged in both the HP and ability
     cards.
  3. **Divider between the HP bonuses and the hit dice** — a `.detailRow + .breakRow`
     border separates the Constitution (bonus) row from the per-class hit-dice rows.
  4. **Shop item cards decluttered** — the **source** line is gone (`item` entity's
     `card` drops `subtitle`; `SelectorPanel` now renders `cardSub` only when present),
     `.cardBox` padding trimmed to `10px`, recovering the vertical space.
  5. **Shop card stepper fills the card width** (`.cardBuy`/`.cardActions` no longer
     centre; Stepper `style:{width:'100%'}`), giving room for 3 digits.
  6. **Preview "Buy" bar** — the quantity stepper is taller (`buttonSize 34`), a bit
     larger (`fontSize 16`), `--bg-soft`, and wide enough for 3 digits (`numberWidth
     3ch`); the button label shortened **"Buy now" → "Buy"** to reclaim width.
  7. **Checkout cart steppers** share the same `--bg-soft` + `3ch` number so 3-digit
     quantities stay consistent with the rest of the shop.
  Verified live (desktop + 375px mobile): steppers fill their cards with borders
  intact, HP/ability top spacing tightened, the Constitution↔hit-dice divider shows,
  shop cards lost the source line, and the card/preview/cart steppers all fit 3 digits;
  lint clean + 364 tests pass.
- **Shop cards & preview images — declutter pass.** Per user feedback:
  - **Type is now plain text**, not a tag — the item card drops the type *badge* and
    shows the type as text on the meta line, matching the Inventory tab
    (`typeLabel`: weapon → "Martial Weapon", armor → "Light Armor"/"Shield", else the
    singularized group). **Weight removed** from the card (rarely matters); the meta line
    is just `type · price`.
  - **Rarity stays as a badge but smaller and colored** — same compact bordered style as
    the class-type / race tags (`.rarityBadge`, 8.5px uppercase), tinted **per rarity**
    with the Inventory palette (uncommon green … artifact gold). Only real tiers get a
    badge (`RARITY_TIERS`) — `none`/`unknown`/`varies` are dropped as noise. `card` now
    returns a `{ rarity: { label, color } }` the `SelectorPanel` renders with the colour
    inline (and `cardSub`/type-badge removal keeps other selectors unchanged).
  - **Preview images lost their frame** — `DetailView`'s `.img` no longer draws a
    `border`, and `.imgCapped` no longer paints a `--bg-soft` background; the
    `border-radius` stays so corners are still rounded. This is shared, so it applies to
    **every SelectorPanel preview (item, class, subclass, race) and the Species tab's
    inline art** (which renders through the same `DetailView`). Verified via computed
    styles on a real race image (Aarakocra): `border: none`, transparent background,
    `border-radius: 10px` kept.
  - Verified live (shop cards show "Tool · 50gp" / "Martial Weapon · 10gp" with no
    weight/type-tag, coloured rarity badges at 8.5px); lint clean + 365 tests pass
    (`item.test.js` updated for the new card shape).
- **Stepper — alignment follow-ups.** Three small fixes on top of the pass above:
  the **"Base" legend is centred** in the HP tile and ability cards (`.stepLabel`
  `text-align: center`); the **shop item-card stepper is centred** (content-width, not
  full-bleed — `.cardBuy`/`.cardActions` `justify-content: center`) with the darker
  **`--bg`** fill (so it contrasts against the `--bg-soft` card) while keeping the 3ch
  number for 3 digits. Preview "Buy" bar and checkout-cart steppers keep `--bg-soft`.
  Verified live (desktop + 375px).
- **Stepper — ability-card number no longer disappears on narrow screens.** The HP
  tile and the ability cards shared ONE stepper style (`TILE_STEPPER`, `buttonSize:
  30`), but the HP tile is wide (2-up on mobile) while ability cards are **6-up on
  desktop / 3-up on mobile** — much narrower. With fixed 30px −/+ buttons and the
  number set to `flex: 1; min-width: 0`, the number got squeezed to zero and vanished
  on phones, leaving only the two buttons. Fixed by (1) a dedicated **`ABILITY_STEPPER`**
  (`buttonSize: 24`, `fontSize: 15`) for the ability cards only — the HP tile keeps its
  perfect `TILE_STEPPER` untouched; and (2) a **width floor on the shared number**
  (`.number` `min-width: var(--stp-num-min, 2.4ch)`, trimmed side padding `0 2px`→`0 1px`)
  so a 2-digit value always fits and can never collapse. Verified live at 375px (real
  phone) and the 320px edge case: the number renders fully (`− 10 +`) and the pill stays
  inside the card border at every width; lint clean + 365 tests pass.
- **Default starting gold (background + original class).** New characters now begin with the
  2024 default wealth. `createCharacter()` seeds **50 GP** (the custom-origin background), and
  when the **original class** is first chosen the class's gold alternative is added — parsed from
  the class's `startingEquipment` prose (the trailing gold-only option: Cleric 110, Fighter 155,
  Wizard 55, Rogue 100, Barbarian 75…) by `engine/startingGold.js` (`classStartingGold`,
  `seedStartingGold`). The class portion is applied at class-selection time (Builder's
  `setClasses`) and **guarded**: it only fires while the wallet is still pristine (exactly the
  50 GP seed) and the inventory is empty, so it never clobbers money the player has already
  changed, and it's idempotent (once added, the wallet is no longer pristine). Imported
  characters keep their own currency (import doesn't go through `setClasses`). This is the wealth
  side of the wizard's upcoming "starting equipment **or** gold" step (Phase D2). Verified live
  (new character → pick Cleric → **160 GP**); 7 unit tests (`startingGold.test.js`, 616 total).

- **This closes Phase B1 (equipment/inventory) end to end**: browse (grouped/
  sorted/searched), equip, attune (with limit + prerequisite warnings), buy
  (via a shop reusing `SelectorPanel`), track currency, and see carried
  weight vs. capacity. The Foundry **export side** of the inventory (inventory
  items → `weapon`/`equipment`/`tool`/`loot` Items + weapon attack activities +
  item Active Effects, both directions) is now **also done** — see §11
  ("Inventory → Foundry Items, both directions" and "Exported items now actually
  work in Foundry"). Remaining next up: Phase B2 (spellbook).

- **Custom (non-catalog) items — full snapshot round-trip.** An imported item whose name
  isn't in the 5e.tools catalog (spell material components like `Component: Diamond`, homebrew
  gear, named spell scrolls — the Foundry premades carry ~13 such on a cleric) used to survive
  only as a bare name + red "unresolved" badge, with **no weight, type, rarity or description**,
  and it fell into "Other". Now the import captures a **snapshot** of the Foundry item's own data
  (`entry.custom = {fType, typeValue, weight, price, rarity, attunement, description, img}` in
  `foundryImport.js`) whenever `resolveInventorySource` finds no catalog match. The engine
  (`items.js`) derives the row from that snapshot: `customTypeInfo()` reverse-maps the Foundry
  type back to a group (so a `loot/treasure` sorts under **Treasure**, `equipment/wondrous` under
  **Wondrous Items**…), weight/attunement/rarity come from the snapshot (Foundry rarity code →
  5e.tools word), and every entry now carries a normalized `rarity` + `isCustom` flag. The tab
  renders it as a normal row with a subtle **"Custom"** marker instead of "unresolved"; the detail
  overlay shows a title + meta line + the imported HTML description (`CustomDetail`). The export
  (`foundryItems.buildInventoryItems` → `customToFoundryItem`) re-emits a faithful Foundry item
  from the snapshot, with the *current* quantity/equipped/attuned from the sheet — so custom items
  round-trip losslessly. Truly-empty entries (no catalog match **and** no snapshot — legacy) still
  read "unresolved". Verified live (a cleric with a `Component: Diamond` treasure + a very-rare
  homebrew amulet: both grouped, weighed, rarity-chipped, attuned, with working detail overlays)
  and by 3 new unit tests (`items.test.js` custom derivation, `foundryInventory.test.js`
  import-snapshot + export round-trip). 608 tests total.

## 14. In-app dialogs (notifications, confirmations & questions)

- **Native `window.confirm`/`alert` replaced by an in-app dialog system** so every
  notification follows the app's visual identity and we control how it looks and
  behaves. Three new pieces:
  - **`store/dialogStore.js`** (Zustand) holds a stack of open dialogs, each with a
    Promise resolver. Being a singleton, it is driven from anywhere (React or not).
  - **`components/common/dialog.js`** is the imperative API: `confirm()` (→ `Promise<boolean>`),
    `alert()` (→ `Promise<void>`) and `ask()` (rich questions → `{action, values}`). A
    plain string is accepted as a shortcut for the message. `confirm` takes
    `confirmLabel`/`cancelLabel`/`danger` conveniences. Call sites became
    `if (!(await confirm(...))) return;` (the handlers turned `async`).
  - **`components/common/DialogHost.jsx`** renders the stack via a portal into
    `document.body` (mounted once in `App`). Each dialog is a card over a dimming
    overlay that **fits its content and stays responsive** (`width: fit-content`
    capped at `--dlg-max-width` and the viewport; body scrolls if tall; buttons go
    full-width under 480px). Messages honor `\n` (`white-space: pre-line`).
  - **Optional behaviors** per the spec: click-outside and **Esc** dismiss (resolving
    the `dismissValue`, i.e. cancelling the triggering action); an **X button**
    (`showClose`) for pure warnings; **Enter** fires the primary action. Focus moves
    into the dialog on open and returns to the trigger on close.
  - **Customizable**: action **tones** (`default`/`primary`/`danger`) plus per-dialog
    style props that map to CSS custom properties (`accent`, `bg`, `border`, `radius`,
    `maxWidth`, `titleColor`, `textColor`, `fontFamily`) — same theming pattern as the
    `Stepper`. Everything falls back to the app tokens (`--bg-soft`, `--accent`…).
  - **Rich questions ready** (`ask`): `fields` render as `select` (dropdown) or text
    inputs and resolve alongside the chosen action, so future "yes/no + a dropdown"
    prompts need no new component. No caller uses fields yet; today's replacements are
    all confirms/alerts.
- **Call sites migrated** (all now in-app): character **delete** + **import-failed**
  alert (`Home`), **multiclass** requirement warning (`ClassTab`), feat/optional-feature
  **prerequisite** confirmations (`ChoiceList`, via a shared `confirmPrereq`), inventory
  **remove** + **attunement** warnings (`InventoryTab`), and shop **no-price** / **not-enough-gold**
  confirmations (`EquipmentShop`).
- **Em dashes removed from notification texts** (user request): the shop and import
  messages that used `—` now use plain sentences (e.g. "costs X. Your character only
  has Y gp.").
- **Naming note**: the UI component is `DialogHost.jsx`, deliberately NOT `Dialog.jsx`
  — on a case-insensitive filesystem it would collide with `dialog.js` and an
  extensionless import could resolve to the wrong file (the API's default export is an
  object, not a component → "Element type is invalid"). Caught and fixed during live
  verification.
- Verified live (desktop + 375px mobile): the delete confirm (Cancel/Delete danger),
  click-outside + Esc cancelling without deleting, the confirm→delete path, an `alert`
  closed by its X, and the multiclass dialog rendering its bulleted multi-line message
  with the accent primary button. Lint clean + 365 tests pass.
- **No solid-accent-filled buttons (user preference).** Swept the app for the
  accent-filled button style (solid `background: var(--accent)` + white text). As a
  *button* it existed in exactly two places, both retired to the app's canonical
  **"Select" pattern** (neutral fill + accent **border** + light text + brightness on
  hover, from `SelectorPanel .selectBtn`, which the Home/Shop/Inventory primaries
  already follow): the dialog `.primary` (introduced with the dialog system above) and
  `UpdatingScreen .retry:hover`. The dialog primary now uses `background: var(--bg)`
  (darker than the `--bg-soft` card, so it still contrasts) + `border: --accent-border`
  + `color: --text-h` (theme-safe, not raw `#fff`); the `danger` tone is unchanged. The
  remaining solid-accent uses are **not buttons** and stay (filter legend dots, the
  encumbrance/progress bar fills). Verified live: the "Add anyway" primary renders with
  the accent border and no fill.

## 15. Spellbook (Phase B2, in progress)

The plan for the whole phase lives in CLAUDE.md **DDL-0008** (architecture + 5 stages,
from the user's 12 requirements). Progress by stage:

- **Stage B2.1 — data layer (done).**
  - **Spell data fetch** — `data/config.js` gains `SPELL_SOURCES` (the 17 spell books:
    aag/ai/aitfr-avt/bmt/efa/egw/ftd/frhof/ggr/idrotf/llk/phb/sato/scc/tce/xge/xphb) and
    `SPELL_FLUFF_SOURCES` (the 9 with an art/lore file). `buildManifest` now also fetches
    `spells/spells-<src>.json` (key `spells-<src>`), `spells/fluff-spells-<src>.json`
    (`fluff-spells-<src>`) and the spell→class reverse map `spells/sources.json`
    (`spell-sources`). Every path was **verified HTTP 200 on the live mirror first** (a
    single 404 would break the whole `Promise.all`, same caution the `items.json` add used),
    and only the 9 fluff files that actually exist are listed.
  - **`engine/spells.js`** (pure, new) — the spell-side counterpart to `engine/items.js`.
    `allSpells(db)` concatenates every `spells-<src>` file into one catalog and dedups
    reprints (PHB→XPHB) via `latestOnly`, exactly like items; `resolveSpellObj(db, name,
    source)` (name+source, else the current version by name). Display/classification
    helpers: `schoolName` (code→"Evocation"…), `spellLevelLabel` (0→"Cantrips", 1→"1st
    Level"…) + `ordinalLevel`, `castingTimeLabel`/`castingTimeRank`, `rangeLabel`/`rangeRank`
    (feet/touch/self + "Self (15-foot cone)" for shaped spells), `componentsText`/
    `materialText`, `saveOrAttack` (attack Ranged/Melee vs. save ability, for the Save/Attack
    group-by), `isRitual` (`meta.ritual`), `isConcentration` (`duration[].concentration`).
    **`classSpellList(db, className)`** builds the set of spell names available to a class
    from the `spell-sources` reverse map (matched by class NAME across any book — the
    reprint dedup in the catalog keeps the spell itself single) — this is the default filter
    the prepare selector will apply (R10). No storage or UI yet; those are B2.2/B2.3.
  - **Verified**: 24 unit tests (`spells.test.js`) cover dedup, resolution, every label/rank
    helper, save/attack/ritual/concentration, and the class list — all pass (full suite 389,
    was 365; lint clean). Live in the browser: a fresh load **self-migrated the cache** (the
    manifest is now "incomplete") and all **17 spell files (936 spells), 9 fluff files, and
    `spell-sources` (15 books) landed in IndexedDB**, confirmed by direct DB inspection, with
    **no console errors**.

- **Stage B2.2 — spellcasting engine + schema v2 (done).**
  - **`engine/spellcasting.js`** (pure, new) — the numeric spellcasting engine, replicating the
    **Foundry dnd5e system faithfully** (tables + algorithm copied from the system source:
    `SPELL_SLOT_TABLE`, `pactCastingProgression`, and `spellcasting-model.mjs`'s
    `computeProgression`). `slotContribution(code, level, {single})` applies the Foundry rule
    `roundUp ? ceil : floor(level/divisor)` per progression (`full` ÷1, `1/2`/`artificer` ÷2
    round-up, `1/3` ÷3), plus the **single-classed override** (a lone non-full caster rounds
    **up**) gated by the same truthiness guard Foundry uses (so an Eldritch Knight gets no
    slots at levels 1–2 but ceil-rounds from 3 on). `leveledCasterLevel` sums the multiclass
    caster level (Pact excluded); `spellSlots(casterLevel)` → `{1:4,2:3,…}`; `pactSlots(warlockLevel)`
    → `{slots, level}` (sparse table, largest key ≤ level). `casterInfo(classObj, subclassObj)`
    reads the spellcasting config from the class **or its subclass** (Eldritch Knight / Arcane
    Trickster cast via the subclass); `cantripLimit`/`prepareLimit` read `cantripProgression`/
    `preparedSpellsProgression` at the class level (2024 unified everyone — including Warlock and
    the third-casters — onto `preparedSpellsProgression`); `spellSaveDc` = 8+prof+mod,
    `spellAttackBonus` = prof+mod. **Data note:** in XPHB, Paladin & Ranger use
    `casterProgression: "artificer"` (½ round-up), the third-casters use `"1/3"`, Warlock `"pact"`.
  - **Schema v2** (`schema/character.js`) — `CHARACTER_SCHEMA_VERSION` 1→2 with a `ClassEntry.spells`
    field (the player's prepared spells + picked cantrips, `ContentRef[]`; `createClassEntry` seeds
    `[]`). `migrate` maps each class to backfill `spells: []` for v1 characters (idempotent,
    preserves any existing list); the coercion stays defensive (runs on read, doesn't rewrite disk).
  - **`deriveSpellcasting(character, db, {profBonus, modifiers})`** (`resolve.js`) — wired into
    `deriveFromDb` alongside `deriveInventory` (so `deriveCharacter` stays pure). Resolves each
    class + chosen subclass, builds one **origin per spellcasting class**
    (`{key:'class:<id>', ability, saveDc, attackBonus, casterCode, isPact, spellListClass,
    cantripLimit, prepareLimit, cantrips[], prepared[], slots, pactSlots}`), resolves the player's
    `ClassEntry.spells` into spell objects split by cantrip vs. leveled, computes the shared
    combined caster level + leveled slots and the Warlock pact slots, and derives the default
    **spell-list class** for the prepare filter (a subclass caster like Eldritch Knight reads it
    from `additionalSpells` `class=Wizard`). Granted/always-prepared spells and racial/feat origins
    are B2.3.
  - **Verified**: 45 new unit tests (`spellcasting.test.js` 29 + `deriveSpellcasting.test.js` 16;
    slot table, single/multiclass caster level, the EK truthiness guard, pact slots, DC/attack,
    caster-info, limits, and the full derive) + a schema-migration test update; **432 total pass**,
    lint clean. Live in the browser: the schema migrated a v1 character to v2 on load, `deriveFromDb`
    ran with no console errors, and reconstructing the real live compendium + the sample **Artificer
    1 / Bard 1** through `deriveFromDb` produced the correct numbers — combined caster level **2**,
    slots **{1:3}**, Artificer (int, DC 10, 2 cantrips / 2 prepared, list "Artificer") and Bard
    (cha, DC 10, 2 cantrips / 4 prepared, list "Bard").

- **Stage B2.3 — Spellbook tab, read-only (done).**
  - **`engine/grantedSpells.js`** (pure, new) — parses the 5e.tools `additionalSpells` field
    (present on race/lineage, subclass, feat, background) into the spells a character is GIVEN
    for free at the current level. The shape was surveyed across the whole dataset first:
    buckets `known`/`prepared`/`innate` grant (`expanded` only widens a class's spell list and
    is ignored); each is keyed by level (or `_` = always) and holds either a list or a
    cast-type map (`daily`/`rest`/`will`/`ritual`/`resource`, whose numeric key is the number
    of uses). Spell leaves are `"faerie fire|xphb"` with an optional `#c` (cast as a cantrip)
    or `#2` (cast at 2nd level) marker; `{choose}` leaves are a player decision (counted as
    `pendingChoices`, wired in B2.4) and `{all}` leaves only expand a list. `castTypeLabel`
    renders "1/Day", "1/Rest", "At Will"…
  - **`resolveSpellObj` is now case-insensitive** — granted spells arrive lowercase
    (`"faerie fire"`) while the catalog stores `"Faerie Fire"`.
  - **`deriveSpellcasting` extended** — beyond the class origins of B2.2 it now emits:
    class/subclass **granted spells folded into that class's origin** (R2) using the CLASS
    level; a **`race` origin** (lineage-aware, using the CHARACTER level); and one
    **`feat:<id>` origin** per feat that grants spells. Granted entries are marked
    `granted: true` and land in `alwaysPrepared`, outside the prepare counters (R12). Two
    behaviors worth naming: a spell the player prepared that is **also granted** collapses to
    the granted copy (no duplicate row, no counter hit — caught in live verification), and a
    granted origin whose ability is a `{choose}` (the elven lineages' int/wis/cha) exposes
    `abilityChoices` and reports **no save DC** rather than guessing a decision that does not
    exist yet.
  - **`selector/entities/spell.js`** (new, minimal) — fluff (art/lore, searched across the
    per-book `fluff-spells-*` files), meta chips (level/school/casting time/range/components/
    materials/duration, plus Attack or Save, Ritual, Concentration) and the body entries
    including "Using a Higher-Level Spell Slot". The selector half (list/filters/card) is B2.4.
  - **`components/builder/SpellbookTab.jsx`** (+ CSS module) — mirrors `InventoryTab.jsx`
    deliberately: **origin sub-tabs** (R1) with a per-kind icon; a header of cards showing
    **spell slots / pact slots** (R7), **save DC + attack**, and the **cantrip and prepared
    counters** (R8, turning red above the limit); **spell-level categories** with an **"All"**
    default grouped by level (R3/R4); **Group by** level/school/save-attack/casting time and
    **Sort** by name/level/casting time/range (R5) — schools and save/attack sections sort
    alphabetically, level and casting time by their natural rank; **search** (R6); collapsible
    sections; and rows that open a **DetailView overlay**. Granted spells carry an "Always
    Prepared" chip, an accent rail, their cast-type chip ("1/Day"), and a footer in the overlay
    naming the origin. The tab replaced the `Placeholder` in `Builder.jsx`.
  - **Verified**: 26 new unit tests (`grantedSpells.test.js` 18 + `deriveSpellcasting.test.js`
    8), **463 total pass**, lint clean. Live in the browser with a seeded **Cleric 5 (Life
    Domain) / Elf Drow Lineage**: the Cleric tab showed slots {1:4, 2:3, 3:2}, DC 14, +6 attack,
    2/4 cantrips and 2/9 prepared, with Bless/Aid/Lesser Restoration/Mass Healing Word/Revivify
    always-prepared from the subclass; the Drow tab showed Dancing Lights, Faerie Fire 1/Day and
    Darkness 1/Day with no DC card (ability still a choice); group-by, sort, search and the
    detail overlay (including `entriesHigherLevel`) all behaved; no console errors; mobile at
    375px stacks the cards with no horizontal overflow.

- **Stage B2.4 — prepare flow + design consistency pass (done).**
  - **Spellcasting-ability choice, generalized.** `parseChoices` now reads the `ability` of any
    entity's `additionalSpells` (race, feat, background — not just the elven lineages) and, when
    the data says `{choose: [int, wis, cha]}`, emits a `spellAbility` Choice. It renders in the
    existing `ChoiceList` (a `ClearableSelect`, no counter), so it appears in the Species tab —
    and anywhere else choices render — with no per-case code. `spellAbilityPick(bag)` reads it
    back **without recursing into sub-bags**, so an ability chosen inside a feat that the species
    grants belongs to that feat's origin, not to the racial one. `deriveSpellcasting` feeds it to
    the granted origins (fixed `ability` in the data still wins), which finally gives the Drow a
    **save DC and attack bonus**.
  - **`uses` on every origin.** Any granted spell with a cast type (`daily`/`rest`/`will`/
    `ritual`/`resource`) now surfaces as `{name, label}` on its origin. Origins without slots
    (race, feat) render a **"Uses" card** in place of the slot table ("Faerie Fire — 1/Day"); a
    class that grants an innate spell gets the same card next to its slots. Generic, not
    Drow-specific.
  - **Prepare flow (R9–R11).** A **"+ Prepare spell"** button sits next to the search box (the
    same slot the Shop button occupies in Inventory) and opens **`SelectorPanel` directly**.
    `selector/entities/spell.js` gained `list`/`filters`/`card` (filters: Level, School, Casting
    Time, Save/Attack, Tags, Source). The panel is **scoped to the origin's class spell list** by
    default via a new, additive **`scopeFilter` prop** — a toggle chip beside the search that any
    future selector can reuse; the caller does the actual filtering through the existing
    `exclude`. Turning the scope off and picking an off-list spell raises the in-app **confirm**
    (R10). Spells already prepared or granted are hidden, and a spell whose bucket is full
    (cantrips vs. leveled) is hidden too — so the button stays usable for cantrips when the
    leveled slots are full, and **disables only when both are at the limit** (R11), with a
    tooltip explaining why. Removing a prepared spell (button in the detail overlay; granted
    spells have none) frees the count and re-enables the button.
  - **Design consistency (user request).** The spell-level chips were pill-round and unlike
    anything else in the app; they now use the **exact sub-tab style of the Inventory type tabs**
    (rectangular, 10px radius, accent border when active). The page order was regrouped to follow
    the app's own rhythm: **state cards → origin sub-tabs → search (+ Prepare) → level categories
    → Group/Sort**. `Builder` gained `setClassSpells(uid, spells)`, which patches only that class.
  - **Verified**: 12 new unit tests (475 total), lint clean. Live on the seeded **Cleric 5 (Life)
    / Warlock 1 / Elf Drow**: the Drow tab now shows a Uses card (Faerie Fire 1/Day, Darkness
    1/Day) and, after picking Intelligence in Species, **DC 13 / +5**; the Warlock tab shows Pact
    (1st) ×1; the picker opened scoped to 109 Warlock spells, 554 with the scope off; an off-list
    Cure Wounds raised the confirm and persisted to IndexedDB; filling 2/2 cantrips and 2/2
    prepared disabled the button, and removing Hex re-enabled it. Granted spells show no Remove.
    No console errors; mobile at 375px has no horizontal overflow.

- **Stage B2.4b — class filter, compact header, Warlock arcanum (done).**
  - **The class scope became a real filter.** `selector/entities/spell.js` is now a factory,
    `makeSpellEntity(db)`, so `precompute` can read the spell→class reverse map
    (`spellClassIndex` in `engine/spells.js`, one sweep of `spells/sources.json`). The picker
    therefore has a **Class filter with every class as an option**; the origin's class is merely
    **pre-marked** through `SelectorPanel`'s new `initialFilterState` prop. Deliberately looking
    up a Warlock spell while preparing a Bard is now a normal filter action (the DM allowed it),
    not a scope you must switch off. The old one-off `scopeFilter` prop and its chip were removed.
    Adding a spell that is off the origin's list still raises the confirm (R10).
  - **Compact header.** The three state cards (slots / DC+attack / known+prepared) collapsed into
    **two**: a *resources* card (leveled slots or pact slots, arcanum chips, per-rest uses) and a
    *numbers* card (Save DC, Attack, Cantrips, Prepared, Arcanum). Both `flex: 1` so they fill the
    row on desktop instead of leaving dead space; on mobile they are two shallow strips instead of
    three tall cards.
  - **Warlock Mystic Arcanum (DDL-0010).** `ARCANUM_TABLE` + `arcanumLevels()` in
    `engine/spellcasting.js`; every origin now derives `maxPrepareLevel` (the pact ceiling, or the
    highest leveled slot circle). A player spell **above** that ceiling is an arcanum: it fills
    `arcana[{level, spell}]`, is listed in `arcanumSpells`, renders with **"Mystic Arcanum" +
    "1/Long Rest"** badges, and is **excluded from the prepared counter**. The picker only offers a
    high-circle spell into a **free arcanum of exactly that circle**, so an 8th-level spell stays
    hidden until level 15. No schema change — an arcanum spell is just a `ClassEntry.spells` entry.
  - **Bug caught live:** removing arcanum spells from `prepared` also removed them from the tab's
    list (they were no longer in any rendered bucket). Fixed with `origin.arcanumSpells`, plus a
    regression test.
  - **Verified**: 12 new unit tests (487 total), lint clean. Live on the seeded **Warlock 13**:
    header shows Pact (5th) ×3 plus 6th/7th "1/Long Rest" chips (the unfilled one dashed), and
    DC 14 / +6 / 1-4 cantrips / 1-12 prepared / 0-2 arcanum in one strip; the picker offers 10
    sixth-circle and 4 seventh-circle Warlock spells and **zero** of the 8th/9th; picking Arcane
    Gate filled the 6th arcanum (Arcanum 1/2) without touching the prepared count; the Class
    filter lists all 10 casting classes and switching it to Bard rescoped the results. No console
    errors; mobile at 375px has no horizontal overflow.

- **Stage B2.4c — granted-spell frequency edge cases (done, DDL-0011).**
  - **Scaled use counts.** The count key of `daily`/`rest`/`resource` is not always a number: the
    dataset also uses `'1e'` (one *each*), `'pb'` (proficiency bonus) and an **ability abbreviation**
    (`'cha'`, `'int'`) for "a number of times equal to your X modifier". `parseUsesKey` classifies
    the key; `resolveGrantedUses` turns it into a real number during derivation (where prof and
    modifiers exist), applying the rule's **minimum of 1**, and returns a `usesNote` the UI shows as
    a tooltip. Archfey Patron's Misty Step now reads **"4/Day"** on a CHA 18 Warlock, tooltip
    "Charisma modifier", instead of the old meaningless "Daily" (`Number("cha")` was `NaN`).
  - **One spell, one row.** `grantedSpells` dedups **by spell name** and merges across buckets —
    the Archfey grants Misty Step as both `prepared` (spends a Pact slot) and `innate` (free, CHA
    times a day). That is one spell with two properties, not two rows: the most "prepared" mode
    wins (`prepared` > `known` > `innate`) and the cast type/uses come from whichever bucket has
    them. The row shows *Always Prepared* + *4/Day*.
  - **Aarakocra: no invented limits.** `innate: { 3: ["gust of wind"] }` is a bare list with no
    recharge type. The rule is once per long rest, but the data does not say so and the identical
    shape means *at will* for Yuan-Ti's Animal Friendship (`foundry-races.json` has no entry
    either). Such grants are now `castType: 'innate'`, shown in the Uses card as **"No Spell Slot"**
    with a tooltip sending the player to the feature text — deliberately not a guessed "1/Day".
  - **Verified**: 21 new unit tests (508 total), lint clean. Live on a seeded **Aarakocra / Warlock
    13 (Archfey)**: the Warlock card shows Pact (5th) ×3, the 6th/7th arcanum chips and
    "Misty Step 4/Day" (tooltip "Charisma modifier"); the spell list has exactly **one** Misty Step
    row badged Always Prepared + 4/Day; the Aarakocra tab shows a Uses card with "Gust of Wind —
    No Spell Slot" and the explanatory tooltip. No console errors.

- **Stage B2.4d — curated overlay for bare `innate` grants (done, DDL-0011).**
  - **`engine/grantedSpellUses.js`** (pure, new) — `INNATE_USES` maps `"Name|SOURCE"` of an entity
    (species / class / subclass) to a per-spell `{castType, count}`, and `applyUsesOverlay` fills in
    **only** the grants whose frequency the 5e.tools data leaves unstated (`castType: 'innate'`).
    Everything the data already encodes passes through untouched. Every entry quotes the feature
    prose that justifies it.
  - **New `castType: 'restLong'`** → "1/Long Rest". `additionalSpells` has no way to distinguish a
    short rest from a long one, so only the curated overlay ever produces it.
  - **Reading the prose for all 14 reachable cases showed three different rules**, which is exactly
    why the heuristic was refused: 1/long rest (Aarakocra's Gust of Wind, Firbolg's Detect Magic and
    Disguise Self *each*, Earth Genasi, the Eberron marks, College of Glamour's Command),
    1/short-or-long rest (Ancestral Guardian's Augury/Clairvoyance, Diviner's See Invisibility), and
    **at will** (Yuan-Ti's Animal Friendship — "an unlimited number of times"; the Path of the Giant
    and Artificer EFA cantrips). **Great Old One's Hex inverts the bucket**: it sits under `innate`
    but the text says only "You always have the Hex spell prepared", so the overlay sets
    `castType: null` — always prepared, spends a spell slot, no uses chip.
  - An entity **not** in the overlay still falls back to the honest "No Spell Slot" label.
  - **Verified**: 13 new unit tests (520 total), lint clean. Live: the Aarakocra tab now reads
    "Gust of Wind — 1/Long Rest" in the Uses card and on the row badge; switching the Warlock to
    **Great Old One** shows Hex as *Always Prepared* with **no** uses chip and no Uses card entry.
    No console errors.

- **Stage B2.5 — Foundry export & import of spells (done). Phase B2 complete.**
  - **`engine/foundrySpells.js`** (pure, new) — every spell of every origin becomes a Foundry
    Item of type `spell`. Field translation from 5e.tools: `activation` (from `time`), `duration`,
    `range`, `properties` (components + concentration + ritual), `materials` (string or
    `{text, cost, consume}`), `school` (letter → dnd5e 3-letter code), `identifier`, and a
    description that includes `entriesHigherLevel`.
  - **Schema note:** dnd5e 5.3.3 replaced `preparation: {mode, prepared}` with **`method`**
    (`spell`/`pact`/`atwill`/`innate`/`ritual`) + **`prepared`** (0 unprepared, 1 prepared,
    **2 always**). The old pair is deprecated but still present in the Plutonium exports, so
    `spellPreparation()` reads **both** on import. `sourceItem: "class:<identifier>"` links a spell
    to its class.
  - **Mapping**, taken from the official Warlock 17 premade rather than invented: player picks →
    `method: 'spell'` (or `'pact'`), `prepared: 1`; granted spells that spend a slot → `prepared: 2`;
    **Mystic Arcanum → `method: 'atwill'`, `prepared: 0`, `uses: 1/long rest`** (exactly what Sefris'
    Create Undead / Forcecage / Dominate Monster / True Polymorph do); innate grants → `method:
    'innate'` with `uses`; at-will and ritual grants → their own methods.
  - **`uses.max` is exported as a FORMULA, not a baked number** (the point of DDL-0011's `scale`):
    the Archfey's Misty Step ships `@abilities.cha.mod`, a proficiency-scaled grant ships `@prof`,
    and `restLong`/`rest`/`daily` map onto `recovery: [{period: 'lr'|'sr'|'day'}]`. Foundry
    recomputes when the ability changes.
  - **Actor `system.spells`** (`spell1..9` + `pact`) now carries the derived slot counts.
  - **Import side** — `isPlayerChosenSpell` returns only the player's own decisions: `prepared: 2`
    (always prepared), `innate` and `ritual` are grants the derivation recreates, so they are
    dropped. `atwill` is ambiguous (a racial at-will spell *and* Mystic Arcanum both use it) and is
    disambiguated by the presence of `uses.max` — the arcanum. Spells are grouped by `sourceItem`
    into `ClassEntry.spells`; ones without an owner (older exports) go to the original class.
  - **Pre-existing importer bug, found by the round-trip:** `subclassId` was taken from the Foundry
    Item's *name* ("Archfey Patron") while the builder stores the 5e.tools **shortName**
    ("Archfey"). `resolveSubclassObj` then found nothing, so **every subclass-granted spell and
    feature vanished on reimport**. It only worked where the two coincide (Champion). Fixed by
    translating through the class file's `subclass[]`; regression-tested.
  - **Verified**: 41 new unit tests (561 total, incl. a full character→actor→character round-trip
    and a comparison against the real Sefris premade), lint clean. Live on the seeded **Aarakocra /
    Warlock 13 (Archfey)**: the exported `.json` has 16 spell Items — Eldritch Blast and Hex as
    `pact`/prepared 1, True Seeing as `atwill` + 1/lr, the twelve subclass grants as `prepared: 2`,
    Misty Step as `innate` with `@abilities.cha.mod` per day, and the racial Gust of Wind as
    `innate` 1/lr (from the curated overlay) with no `sourceItem` — plus `spells.pact.value: 3`.
    Reimporting that file restored exactly the three player picks, the subclass grants and the
    arcanum. No console errors.
- **Import fix — an unprepared leveled spell no longer counts as prepared.** A dnd5e `spell` Item
  with `method: 'spell'` (or `'pact'`) and **`prepared: 0`** is on the sheet but *not* prepared
  (a spellbook/known entry the player left unprepared). `isPlayerChosenSpell` was keeping any
  `method: 'spell'` spell regardless of the flag, so those entries landed in `ClassEntry.spells`
  and inflated the prepared counter. Found by importing the official **Akra** premade (Cleric 17,
  Life Domain): its three `prepared: 0` Protection spells pushed the counter to **22/19** even
  though the always-prepared domain spells (`prepared: 2`) were correctly excluded. Now leveled
  `prepared: 0` spells are dropped on import (cantrips — level 0 — are kept, since they read as
  "always prepared" and sometimes carry `prepared: 0`). The domain/always-prepared handling was
  already correct (granted → `alwaysPrepared`, out of the count). +2 assertions in
  `foundrySpells.test.js`.
- **Import fix — "choose one of the following" sub-features now round-trip.** Feature-option
  choices (Cleric's **Divine Order**, **Blessed Strikes**; Ranger's Hunter's Prey; Barbarian's
  Wild Heart options…) live **outside** the class item's `advancement` — Foundry grants them as
  separate `feat` Items named `"<Feature>: <Option>"` (identifier `"<feature>-<option>"`). The
  importer only read the class advancement, so those picks were lost and the sheet showed the
  choices as unselected. `foundryImport.parseClassEntry` now rebuilds them by asking the engine
  for the class/subclass's `featureOptionChoices` + `subclassFeatureOptionChoices` and matching
  each option against the actor's granted feats (by name **or** identifier), writing the pick back
  into the `featureoption` choice-bag. Verified on the real **Akra** premade: `Divine Order →
  Protector` and `Blessed Strikes → Potent Spellcasting` both reconstruct. +1 unit test
  (`foundryImport.test.js`, 609 total).

## 17. UI pass before the wizard (back button, level controls, filter drawer)

- **One back button, everywhere** (`components/common/BackButton.jsx`). The app had three
  different ones — "← Characters", "← Back" (not-found), "← Back" (selector detail) — each as wide
  as its label. Now a single 36px icon button (inline SVG chevron, so it scales with the font and
  does not depend on a system glyph); the destination lives in `title`/`aria-label`. It renders as
  a `<Link>` when given `to`, a `<button>` when given `onClick`.
- **Level up / down in the top bar** (`components/builder/LevelControls.jsx`), next to Export:
  `−  [total level]  +`.
  - **Multiclass asks which class changes**, through the in-app `ask` dialog (DDL-0007) — a select
    listing "Warlock (level 13)", "Cleric (level 3)"… With a single class it just applies.
  - Total level caps at 20; `−` never takes a class below level 1 and only offers classes above it.
    **Removing a class stays a deliberate action in the Class tab**, not a side effect of a click.
  - Exposes `onLeveledUp(uid, newLevel)` — the hook the Phase D level-up wizard will use (DDL-0012).
- **SelectorPanel filter drawer.** With entities like Spell carrying seven filter groups, the panel
  needed work:
  - **A search for the filters themselves**, hidden behind a magnifier in the head (desktop) so it
    costs no space until wanted. It matches an option's label *or* its group header (typing
    "school" reveals the whole group), and **never hides an option that is currently active** —
    losing sight of a filter that is changing your results is worse than a long list.
  - **The filter head is now sticky**: the include/exclude legend and the Clear/Apply buttons stay
    reachable with the list scrolled.
  - **Mobile:** the panel's main search bar is **hidden while the filter drawer is open** — it does
    not filter the chips, it eats the drawer's height, and a user could reasonably mistake it for
    the filter search. With that space free, the **filter search is always visible** on mobile
    (where it helps most) and the magnifier disappears.
  - **Mobile: a drag handle** at the top of the drawer. Dragging down follows the finger and closes
    past 70px; a short drag springs back. A plain tap also closes — but a short drag must **not**
    become a tap, so the synthetic `click` that follows `pointerup` is suppressed when the pointer
    actually moved.
- Verified live at 1280px and 375px: the back icon, level up/down on a Warlock 13 / Cleric 3
  multiclass (only the chosen class moved: Cleric 3 → 4, total 16 → 17), the filter search reducing
  seven groups to two while keeping the active "Warlock" chip visible, the head pinned after
  scrolling 400px, the main search collapsing when the drawer opens, and both drag gestures. Lint
  clean, 561 tests pass.

## 18. Biography tab & roster/header polish

- **New `Biography` tab.** Free text that touches no derivation: the four roleplay traits
  (personality / ideals / bonds / flaws), appearance, and the physical descriptors (age, height,
  weight, eyes, hair, skin, gender, faith). Plain `textarea`/`input` for now — the rich editor is a
  later upgrade. `identity` gained the eight descriptor fields; no schema bump is needed because
  `migrate` already spreads the base identity, so an old character simply gains empty strings.
- **The character's story lives in the Background tab**, not in Biography: it is the prose that
  justifies the origin choices sitting right above it. On export it is written to **both** places
  Foundry expects — `details.biography.value` on the actor and the **description of the background
  Item** (our origin is custom, so there is no official text competing with the player's).
- **Foundry mapping, both directions.** `details` uses the singular and calls personality `trait`;
  `textToHtml`/`htmlToText` convert between the app's plain text and Foundry's HTML paragraphs.
  - **Fixed: alignment was never exported.** `buildDetails` read `character.alignment`, which does
    not exist — the field lives at `character.identity.alignment`, so every actor we ever produced
    had an empty alignment. It now exports the spelled-out form ("Chaotic good") like the real
    actors, and `alignmentCode()` reverses it on import.
- **Roster.** "+ New character" now sits at the left of the free space and "Import" at the right
  edge. The card's subtitle drops the per-class levels — `Level 17 · Warlock · Cleric` instead of
  `Level 17 · Warlock 13 · Cleric 4` (the total is right there; repeating each level was noise).
  The three loose buttons (duplicate / export / delete) collapsed into a **⋮ menu**, which also
  moves the destructive action a deliberate click away.
  - `ExportMenu` was generalized into **`MenuButton`** (portal + anchored positioning + Esc to
    close); `ExportMenu` is now a thin wrapper over it, and the roster menu reuses it.
- **Level controls restyled and moved.** Same visual identity as the `Stepper` pill (accent `−`/`+`,
  value centred) but a separate component, because its value is derived from the classes and a
  click can open a dialog. On desktop it sits at the right of the identity block; on mobile it is
  centred **above the portrait**.
- **Verified live** at 1100px and 375px: roster order/subtitle/menu, the level pill (accent `+`,
  right of the portrait on desktop, centred above it on mobile), typing in the Biography fields
  persisting to IndexedDB, the story reaching `biography.value` *and* the background Item, and a
  full export→import round-trip of every identity field including the fixed alignment. 576 tests,
  lint clean.

## 19. UI polish before the wizard

- **Sheet header.** The subtitle under the name drops the total level (`Warlock 13 · Cleric 4`
  instead of `… · Level 17`) — the level pill already shows it. On **mobile** the level pill moves
  up into the top bar, between Back and Export, reclaiming the empty vertical space above the
  portrait; on desktop it stays at the right of the identity block. Two mount points, one shown per
  width; the `LevelControls` component itself is now position-neutral.
- **Roster.** The `Characters` title now sits **above** the buttons on desktop too (was side by
  side), matching the mobile layout. The card's ⋮ menu gained a **disabled "Export PDF — Coming
  soon"** item, so the PDF mockup is discoverable from the roster like it already is in the builder.
- **SelectorPanel filter drawer.**
  - **Mobile grab handle is transparent and no longer sticky.** It was a solid bar pinned at the
    same `top: 0` as the (also sticky) filter head, so the two collided and the band overlapped the
    result cards behind the drawer. Now it is just the pill on the drawer's own background, scrolling
    with the content; the opaque filter head remains the sole sticky element. The drag-to-close
    gesture is unchanged (short drag springs back, long drag closes).
  - **Desktop: the filter head no longer squeezes when "Clear" appears.** The include/exclude legend
    stacks vertically (it had plenty of vertical room), freeing horizontal space, and the magnifier
    and Clear buttons are a little larger — Clear now reads as a proper accent button.
- Verified live at 1100px and 375px: the subtitle, the level pill in the mobile top bar (aligned
  with Back/Export, above the portrait) and at the right of the desktop identity, the roster title
  stacking with the disabled PDF item, the stacked legend with the enlarged Clear, and the
  transparent grab handle with its drag gesture intact. Lint clean, 579 tests pass.

## 20. Home redesign & Character Guidance preference

- **Home is now a centred roster with a brand header.** The top bar shows **FlyBy** (the eventual
  project/site name, on the home screen for now) at the left and a **hamburger settings menu** at
  the right. The content — a small centred **"Characters"** title, a controls bar, and the list —
  is vertically centred in the viewport.
- **Controls bar** (same idiom as the Inventory/Spellbook tabs): a **search** box, **Group** (None /
  Class) and **Sort** (Name / Level / Recently created / Class) selectors, and an **Add** button.
  The ordering/grouping is a pure module (`pages/roster.js` → `orderRoster`) so it is unit-tested;
  grouping by class uses the **original** class, not the first in the array.
- **Add flow.** Add asks **New character or Import**. New then respects the **Character Guidance**
  preference: `on` → straight to the wizard route, `off` → straight to the sheet, `ask` (default) →
  a prompt "guide me / just the sheet" with a **"Remember my answer"** checkbox that writes the
  preference. Guided navigates to `/build/:id/wizard` (the Phase-D entry point; Builder renders
  normally there until the wizard exists).
- **Character Guidance preference** (`store/settingsStore.js`, persisted to localStorage): `ask` /
  `on` / `off`. The hamburger menu sets it (a ✓ marks the current choice), so experienced players
  can turn the prompt off and newcomers can force it on.
- **DialogHost** gained a **`checkbox` field type** (for "Remember my answer").
- **Selector filter drawer:** the include/exclude legend is **horizontal again on mobile** (the
  vertical stack is desktop-only, where it avoided the Clear-button squeeze; on the wide mobile
  drawer the row saves vertical space).
- **Sheet header (mobile):** the level pill moved from the top bar to **below the name and class
  line**, centred; desktop keeps it at the right of the identity block.
- **Verification:** lint clean, **592 tests** (13 new for `orderRoster`), and the production build
  succeeds. Live browser verification could not run this turn — the preview/browser tooling was
  unavailable — so the click-through of the Add/guidance prompts and the responsive layout still
  needs a visual pass.

- **Home follow-up (same phase).** Removed the **Group** selector (not useful yet — `orderRoster`
  keeps the capability and its tests, but the UI only exposes Sort + search). The primary action is
  now **"New Character"**, centred on its own row **below** the search/sort line. The page is a
  fixed-height **app shell**: `App`'s `.main` became the single content scroller, so the Home page
  fills the viewport exactly and **only the character list scrolls** — no whole-page scroll even
  when empty; the Builder still scrolls normally inside `.main`. Removed the **magnifier glyph**
  from every in-app search box (Home, Inventory, Spellbook) so the typed text gets the full width.

## 21. App chrome cleanup + Character Guidance D1 (wizard shell)

- **Removed the fixed footer** (the version tag). It cost vertical space with little value; the
  `App` shell is now just the header-less scroller. The manual force-cache-update entry point
  (long-press/ALT-click the version) is gone with it — re-add later if wanted. `VersionTag` and the
  now-unused `ExportMenu` were deleted (both superseded by `MenuButton`).
- **Builder top bar: a ☰ menu replaces the Export button.** It holds Export (Foundry actor),
  Export PDF (disabled mockup) and a **Character Guidance on/off toggle** — `off` disables it,
  any other state counts as on and "Disable" always writes `off`. The full ask/on/off tri-state
  still lives in Home's settings menu.
- **Phase D1 — the wizard step engine + shell (DDL-0013).**
  - **`engine/wizardSteps.js`** (pure, new): `buildCreateSteps(character, derived)` returns the
    relevant creation steps from the character's state (spells only for casters, progression only
    once a class exists), each with a `status(character, derived) → complete | incomplete |
    optional`. `buildLevelUpSteps(character, derived, {classUid, toLevel})` returns **only the diff**
    the new level opened — subclass at its level (if unset), ASI at `{4,8,12,16,19}`, new spells for
    casters — prepended with an HP step; an **empty array** means "nothing to decide", so the `+`
    can apply immediately (the level-up flow is D3). `levelUpHasDecisions` is the convenience check.
  - **`components/wizard/Wizard.jsx`** (+ CSS): the shell — progress bar, Back / Skip / Next, and a
    **Review** screen that lists every step's status with a jump-back link (the safety net for the
    non-blocking validation; Next is never disabled). D1 renders a **placeholder** body per step; the
    custom screens are D2. `pages/WizardPage.jsx` loads the character and drives create mode on the
    existing `/build/:id/wizard` route (which no longer just renders the Builder).
  - **Verified**: 13 new unit tests for the step engine (605 total), lint clean, production build
    succeeds. Browser tooling was unavailable this turn, so the wizard's on-screen flow (progress,
    Skip/Next, Review jump-backs) and the footer/menu changes still need a visual pass.

- **Restored the force-cache-update, now in Home's ☰ menu.** Losing the footer took the only
  entry point to re-download the compendium (the old ALT-click/long-press on the version). It is
  back as an **"Update game data"** item in Home's hamburger, behind an in-app confirm — it calls
  `useDataEngine`'s existing `forceCacheUpdate()` (clears the cache + refetches, ignoring the 30-day
  rule; characters untouched, the app shows the "Updating…" screen while it downloads).
  `forceCacheUpdate` is now threaded through the `DataContext` (`App` passes it; `useData()` exposes
  it) instead of only living in the footer.
- **Import a character from either ☰ menu.** Import (a Foundry actor JSON → a new character, then
  navigate to it) moved into **both** hamburger menus — Home ("Import character") and the Builder
  ("Import character", _Opens a new character_). The shared logic lives in a new
  **`hooks/useCharacterImport.js`** (hidden file input ref + read/convert/navigate/error handler),
  used by both pages.
- **Removed the Add "new vs. import" prompt.** Creating a character no longer asks "start new or
  import a file?" first — the **+ New Character** button goes straight to the flow (respecting the
  Character Guidance preference: `ask` still shows the guided prompt). Import is a low-traffic action,
  so it belongs in the menu, not in the primary create path.
- **Verified in the browser** (the visual pass owed from D1): Home's ☰ shows Import + Update game
  data; "Update game data" confirms then runs the force-refresh cleanly (back to Home, no console
  errors); the Builder's ☰ shows Import character; and + New Character goes straight to the guidance
  prompt with no import step. 605 tests pass, lint clean, build succeeds.

- **Phase D2.0 — level-1 order, footer nav, and the Class screen (reference template).**
  - **Create catalog reordered** to the agreed level-1 flow (DDL-0013 update): class → species →
    origin feat → proficiencies → abilities → equipment → identity → class features → spells. The
    step ids changed accordingly; `buildCreateSteps` and its tests follow.
  - **Wizard footer nav** is now **Back · Next · Skip**, similar styling with Next emphasised. Back
    lives in the footer (leaves the wizard at step 0); the header keeps only the progress bar and
    the exit ✕. **Skip appears only on optional steps** — under live-save Next already advances
    without filling anything, so Skip is just an explicit "leave this" where a step is skippable.
  - **`renderStep` wired to real screens.** The Wizard passes each step body `{ character, derived,
    db, onChange }`; `WizardPage` maps a step id to its screen component (only `class` so far,
    others fall through to the placeholder). Live-save flows through the store like the Builder.
  - **`ClassStep`** (the reference template): reuses `classEntity` + `PickerField`/`SelectorPanel`
    to pick the original class and seeds the starting gold exactly as the Builder does — no new
    rules, just the guided presentation. The remaining eight screens follow this pattern, one
    sub-phase at a time.
  - **Verified**: lint clean, 616 tests (updated step-engine suite), production build succeeds.
    Browser tooling remained unavailable, so the wizard's on-screen flow (footer nav, the Class
    picker, Review) still needs a visual pass — as does the earlier backlog (Home, app shell,
    removed footer, Builder ☰ menu).

- **Phase D2.1 — the Class screen, fleshed out.** Added the PHB-2024 guidance callout ("You'll fill
  in more details about your class later. Choosing your class is the most important decision…") and,
  once a class is picked, the **same preview the selector shows** (art, name, meta cards, lore) via a
  filtered `classEntity` fed to `DetailView` — hiding the **Hit Die / Saves / Skills** cards for now
  while keeping the caster category, primary ability, armor and weapons. No new rules; reuses the
  existing entity + DetailView. **Verified live** (browser back): picking Cleric shows the callout,
  the picker, and the preview with exactly those four cards + lore; the step count went 7→9 as the
  caster's features/spells steps appeared; Skip is absent on the required Class/Species steps and
  present on the optional Origin-feat step; no console errors. 616 tests, lint clean.

- **Phase D2 — exit & resume for the create wizard.** Closing the guided creation is no longer a
  silent jump to the sheet, and an unfinished guided character can be picked up again.
  - **New `meta.creating` flag** (schema): `true` while guided creation is in progress. Set when
    Home starts a guided character (`create({ creating: true })`), **cleared on the wizard's
    Finish**. `migrate` deep-merges `meta`, so existing characters get `false` and behave as before.
  - **Resume from Home.** A roster card opens the **wizard** (`/build/:id/wizard`) when the character
    is still `creating`, otherwise the **sheet** — so an unfinished guided character reopens the
    guide. It restarts at **step 1** by design (the shell always mounts at index 0), with every
    live-saved input intact (verified: a kept Barbarian pick reappears on resume) — the first step
    doubles as a reminder of what's already chosen.
  - **Discard-or-keep on exit (level-1 create).** The wizard's ✕ (and Back from step 0) now asks
    **"Leave character creation?"** with **Discard** (deletes the character, back to Home) or
    **Keep it** (back to Home, character stays `creating` and resumable); dismissing the prompt stays
    in the guide. This is specific to level-1 creation — the future level-up guide (Phase D3) will
    treat exit differently. **Verified live** end to end (Guide me → pick Barbarian → ✕ → Keep →
    card resumes the wizard with Barbarian set → ✕ → Discard → character gone); no console errors.

- **`MenuButton` dropdown flips up near the screen bottom.** The portal menu always opened
  **downward** (`top: button.bottom`), so a card's ⋮ menu near the viewport bottom (or the Home ☰)
  spilled off-screen and was unreachable. It now measures its own height (rendered hidden first,
  via `scrollHeight`) and **opens upward when there isn't room below and there's more room above**,
  and caps `max-height` to the available space with `overflow-y: auto` for the extreme case where it
  fits neither way. `position: fixed` already used viewport coords, so the flip is a pure
  positioning change — no markup/API change, every existing menu benefits. Verified live in a short
  viewport (⋮ near the bottom flips up, fully visible) and a tall one (top card still opens down).
- **App favicon + tab title.** Replaced the placeholder `favicon.svg` with the project's own
  wing logo (`public/logo.png`, moved from the repo root) — referenced as both `icon` and
  `apple-touch-icon` in `index.html` — and set the browser-tab title to "5e Character Sheet".
  Verified live: `/logo.png` serves `200 image/png` and the tab title updated.
- **Removed Vite scaffold leftovers.** Deleted the unreferenced template assets — `src/assets/`
  (`react.svg`, `vite.svg`, `hero.png`, the whole folder) plus `public/favicon.svg` (the old
  placeholder icon, orphaned by the favicon change) and `public/icons.svg` (never referenced).
  Confirmed by grep that nothing imports from `src/assets` and no `<use>`/`<link>` points at the
  removed SVGs. `public/` now holds only `logo.png`.
- **Wizard: instructive guidance moved into each screen (no more phrase under the title).** The
  brief `help` line the shell rendered below the step title (e.g. "Your class is the heart of what
  your character can do in play.") is gone from **every** screen; the instructive text now lives
  inside each step as a guide **card** (`.callout`, as the Class screen already did). Dropped the
  now-dead `help` field from the step model (`engine/wizardSteps.js` catalog + level-up steps) and
  its render in `Wizard.jsx`; the kicker (subtitle) + title stay.
- **Phase D2.2 — the Species screen.** `components/wizard/steps/SpeciesStep.jsx` reuses the same
  atoms as `SpeciesTab` (`raceEntity` + `makeLineageEntity` via `PickerField`, `ChoiceList` for the
  species sub-choices, `DetailView` for the preview) and writes the same `character.species` shape —
  no new rules (DDL-0013 guard-rail). Adds a guide callout, the species picker, a **lineage** picker
  (only when the species has `_versions`), the species-choice list, and the full trait preview.
  New shared `.field`/`.fieldLabel` styles in `steps.module.css`. **Verified live**: picked Elf
  (XPHB) → the Lineage picker and Species-choice list appeared, the step count reacted (7→8 as Elf's
  innate cantrip surfaced the Spells step), the trait preview rendered, no console errors. 616 tests
  pass, lint clean.
- **Lineage selector now handles Dragonborn draconic ancestries (abstract `_versions`).** The
  lineage picker only ever surfaced the **concrete** `_versions` form (Elf → Drow/High/Wood);
  Dragonborn encodes its dragon ancestries in the **abstract** form — a single `{_abstract,
  _implementations}` template with `{{color}}`/`{{damageType}}` placeholders instanced per dragon
  type — which `expandRaceVersions` explicitly **skipped**, so Dragonborn showed no lineage picker
  at all. `expandRaceVersions` now expands that form too: for each implementation it builds the
  variant (base + overrides + `_mod`) and substitutes the `_variables` across the whole object
  (`substituteVars`, returns a fresh copy so the base is never mutated). Covers all four affected
  species — Dragonborn (XPHB) and FTD Chromatic/Gem/Metallic.
  - New shared **`lineageLabel(name)`** in `engine/speciesData.js` gives the short display label
    across all three name shapes (`"Elf; Drow Lineage"→"Drow Lineage"`, `"Dragonborn (Black)"→
    "Black"`, `"Dragonborn (Gem; Amethyst)"→"Amethyst"`); replaced the three divergent local
    `lineageShort` copies (`lineage.js`, `SpeciesTab.jsx`, `SpeciesStep.jsx`) with it.
  - The lineage entity's meta now shows a **Resistance** chip (the dragon's damage type — the
    defining trait of an ancestry), derived from the variant's `resist` vs. the base.
  - **Verified live** (wizard Species step, XPHB Dragonborn): the picker lists all 10 ancestries
    (Black…White) labelled by color, the detail shows "Dragonborn (Red)" with a Resistance: Fire
    chip and "Resistance to Fire damage" (placeholder substituted), and selecting Red set the
    lineage field. This is a fix to the Species selector **in general** — the shared engine +
    lineage entity feed both the builder's Species tab and the wizard. 621 tests (5 new), lint clean.
- **Phase D2.3 — the Origin feat screen.** `components/wizard/steps/OriginFeatStep.jsx` reuses the
  Background tab's origin-feat atoms (the `['O']` feat entity with prereq coloring via
  `prereqContext`, `PickerField` with the owned-feat `exclude` dedup, and `ChoiceList` for the
  feat's recursive sub-choices) and writes the same `origin.originFeat` shape — no new rules
  (DDL-0013 guard-rail). Adds a guide callout. Registered in `WizardPage` under the `originFeat`
  step id. **Verified live**: the step shows the callout + picker with **Skip** in the footer (the
  step is optional); picking Magic Initiate surfaced the ⓘ + clear controls and the "Feat choices"
  sub-choice list (Spellcasting Ability…), and Skip correctly disappeared once a feat was chosen
  (status → complete). No console errors. 621 tests pass, lint clean.
- **`buildClassChoices` extracted from ClassTab (shared with the wizard).** The class choice-bag
  assembly (starting skills, tools, per-level feat/ASI/fighting-style/expertise/weapon-mastery,
  subclass grants, sub-feature options, optional features — each with its `kind`) moved from
  `ClassTab.jsx`'s inline body into `components/builder/classChoices.js` (`buildClassChoices(db,
  cls, character)`), plus `isProficiencyChoice`/`isFeatureChoice` predicates. ClassTab now calls
  it; the wizard's steps 4 and 8 **partition the same list** by `kind` (DDL-0013). Also moved
  `ORIGIN_CHOICES` to `components/builder/originChoices.js` (a component file can't export
  constants under the fast-refresh lint rule). No behavior change — ClassTab renders identically.
- **Phase D2.4 — the Proficiencies screen.** `components/wizard/steps/ProficienciesStep.jsx`
  unifies the two proficiency sources on one screen: **From your class** (`buildClassChoices`
  filtered to `isProficiencyChoice` — skill/tool/language, written to `classes[0].choices`) and
  **From your background** (the `ORIGIN_CHOICES`, written to `origin.choices`), each via
  `ChoiceList`. Cross-source dedup comes from `ownedFromDb`, recomputed on every pick. **Verified
  live** (Ranger): the class shows 3 restricted skill picks, the background 2 skills + 1 tool + 1
  language; picking **Nature** in the class list left the background skill picker showing **17 of
  18 skills** (Nature hidden) — dedup across sources works.
- **Phase D2.5 — the Abilities screen, split into two steps.** Base **scores** and the background
  **boosts** are now separate wizard steps (`abilities` → `boosts` in the catalog), so each has room
  for its own explanatory copy. New pure helper `engine/abilityMethods.js` (+7 tests): the 5e
  point-buy cost table / 27-point budget / `canPointBuyStep`, the standard array + `assignStandardArray`
  (swap keeps a valid permutation), and `initialScores` per method.
  - **`AbilitiesStep`** (scores): **Point Buy** (steppers 8–15, "Points left", up-arrow disabled when
    the budget can't afford it), **Standard Array** (a per-ability dropdown of 15/14/13/12/10/8 that
    swaps on reassign), **Manual** (free 1–30 steppers) — the method persists in the existing
    `character.scoreMethod`; a per-method help line and a short per-ability explainer.
  - **`BoostsStep`** (background boosts): the `+2/+1` or `+1/+1/+1` spread + ability selects (reusing
    BackgroundTab's model, auto-initialised to `+2/+1`), plus a live **Result** grid showing each
    ability's base → boost badge → total → modifier from `derived`.
  - Step status now reflects state (`abilities` complete when scores are touched; `boosts` complete
    when every slot has an ability). **Verified live**: Point Buy reset to 8 / 27 points; Standard
    Array assigned + swapped; on the Boosts step assigning +2 to Strength moved its Result total
    10 → 12 with the +1 dropdown excluding Strength. 626 tests, lint clean.
- **Phase D2.6 — the Starting equipment screen.** New pure `engine/startingEquipment.js` (+7 tests)
  parses `class.startingEquipment.defaultData[0]` (the A/B/C options) into readable packages:
  each entry is `{item:"name|source", quantity?}` (resolved case-insensitively to the canonical
  compendium name/source), `{value}` copper (gold), or `{special}` (added minimally as a loose
  item). `isGoldOnlyOption`/`optionGoldGp` flag the pure-gold option; `startingKitInventory` and
  `startingKitCurrency` produce the resulting inventory + wallet (**50 GP background + the option's
  gold**, since it's equipment *or* gold). `components/wizard/steps/EquipmentStep.jsx` renders the
  options as selectable cards; picking one writes `inventory` + `currency` and marks
  `meta.startingKit` (persisted through the `meta` deep-merge in `migrate`; drives the step's
  `complete` status). **Verified live** (Fighter): Option A showed Chain Mail / Greatsword / Flail /
  Javelin ×8 / Dungeoneer's Pack + 4 GP, Option C read "Take the gold instead — 155 GP", and
  choosing A saved `currency.gp: 54` with the five canonical items (Javelin ×8) — confirmed in
  IndexedDB. 633 tests pass, lint clean.
- **Phase D2.7 — Identity split into two screens.** The old single identity step became **Name &
  portrait** (`NamePortraitStep`, id `identity`) and **Personality & story** (`PersonalityStoryStep`,
  id `story`), so the story fields get a screen to themselves.
  - `NamePortraitStep`: the name input + a portrait control (clickable preview, Upload image via
    `fileToPortrait`, paste-a-URL with a Use button, Remove) writing `meta.name`/`meta.portrait`.
  - `PersonalityStoryStep`: the four 5e roleplay traits (personality/ideals/bonds/flaws) + the
    **Story** (backstory), writing `character.identity` — the same fields as the Biography/Background
    tabs, so it round-trips to Foundry `details` unchanged. Step status is `complete` when any of
    those fields has text.
  - **Verified live**: named a character (reflected in the wizard header), set a portrait by URL
    (Remove appeared), wrote a personality trait, and the Review listed both steps as **Done**; the
    name/portrait/personality persisted in IndexedDB, no console errors.
- **Standard-array selects now match the steppers.** On the Abilities screen the per-ability
  `<select>` (Standard Array) was visibly larger than the Point Buy / Manual steppers. The ability
  control is now a fixed 96 px centered box that both the stepper (via `style: { width: '100%' }`)
  and the select fill; `.arraySelect` matches the stepper's height (32 px), border, radius, font and
  tabular numerals, centered. Verified live side-by-side.
- **Phase D2.8 — two informational screens + Story/Name order swap.**
  - **Story before Name.** Swapped the order so **Personality & story** now comes *before* **Name &
    portrait** in the create flow (and in the Review list).
  - **New `info` step status + two screens.** `IntroStep` (id `intro`, the first step) welcomes the
    player and reassures that *nothing is permanent — every choice can be changed later on the
    sheet*. `FeaturesIntroStep` (id `featuresIntro`, right before the class features/spells, shown
    only when `hasClass || isCaster`) marks that *the character is already playable* and explains the
    remaining class-feature choices, personalised with the class name. Both carry a new
    `status: () => 'info'`: the shell shows **no Skip** on them (Skip is gated to `optional`), they're
    **excluded from the Review list** (preserving each other step's real index for jump-back), and
    they don't count toward the "needs a choice" tally.
  - **Verified live** (Wizard, no class then Wizard class): the intro renders as step 1 with only
    Back/Next; the flow reached Personality & story (step 9) *before* Name & portrait (step 10); the
    features intro (step 11) showed "your **Wizard** lets you choose…"; and the Review listed all
    real steps in the new order with neither info screen present, counting 1 pending (Species). No
    console errors. 633 tests pass, lint clean.
- **Phase D2.9 — Class features + Spells screens. PHASE D2 (create flow) COMPLETE.**
  - **`FeaturesStep`** is the other half of the class choice-bag partition (DDL-0013): it renders
    `buildClassChoices` filtered by **`isFeatureChoice`** (featureoption like Divine/Primal Order,
    optionalfeature like invocations/metamagic/maneuvers, weapon mastery, expertise, level feat/ASI),
    writing the same `classes[0].choices` bag the Proficiencies step writes to — so the two screens
    split one bag with no overlap and no rules fork.
  - **`SpellsStep`** (casters only, gated by `isCaster`) reuses the **whole `SpellbookTab`** — origin
    sub-tabs, slot/pact/uses cards, DC/attack + cantrip/prepared counters, the full "Prepare spell"
    flow — wrapped in a guide callout, adapting the tab's `onChangeSpells(uid, spells)` to the
    wizard's `onChange`. No spellbook logic is duplicated.
  - **Verified live** (Cleric): the Features step showed the **Divine Order** choice (Protector /
    Thaumaturge) and picking Protector saved `featopt@Divine Order@1`; the Spells step rendered the
    slot card (1st ×2) + Wisdom DC 10 / +2 / 0/3 cantrips / 0/4 prepared, and preparing **Bless** via
    the Cleric-prefiltered picker moved the counter to 1/4 and saved `spells: ["Bless"]` — both
    confirmed in IndexedDB, no console errors. 633 tests, lint clean. **All nine create screens are
    now built** (intro → class → species → origin feat → proficiencies → abilities → boosts →
    equipment → story → name/portrait → features intro → features → spells → review).
  - **Features-intro copy is now personalised to the class.** It used to name generic examples
    ("a fighting style, an invocation, or which spells you know"), which read oddly for a class that
    has none of them (a Cleric doesn't get a fighting style). `FeaturesIntroStep` now lists the
    class's **actual** feature choices — the deduped labels from `buildClassChoices` filtered by
    `isFeatureChoice`, with the `Level N — ` prefix stripped for prose — plus "which spells to
    prepare" when the character is a caster; it falls back to "no extra choices to make right now"
    when there are none. **Verified live**: a Fighter reads "lets you choose Fighting Style and
    Weapon Mastery"; a Cleric, "Divine Order and which spells to prepare".
  - **The features step is skipped when the class has no feature choices, and shows the real feature
    texts.** Two follow-ups after live use:
    - **No empty features step.** The `features` (and `featuresIntro`) catalog `when` now require the
      class to actually have a feature choice at this level, not just *a* class. `buildCreateSteps`
      gained a `ctx` param; `WizardPage` computes `hasFeatureChoices` (`buildClassChoices(...).some(
      isFeatureChoice)` — it has the `db`) and passes it. So a Level-1 **Artificer** (a caster with no
      L1 feature choice) now runs 12 steps, not 13: the features step is gone, while `featuresIntro`
      still shows (for spells) and Spells follows it directly. Verified live; +2 step-engine tests
      (635 total).
    - **Real feature cards, not a generic callout.** `FeaturesStep` dropped its guide callout and now
      shows the actual feature descriptions. **Refined to show only the feature(s) being chosen** (not
      the whole progression): each `isFeatureChoice` choice's label is matched (after stripping the
      `Level N — ` prefix) to a class feature from `classFeatureLevels`, and only those features'
      descriptions render (`EntryContent` in an accent card), above the pickers. So a Level-1
      **Barbarian** shows just the **Weapon Mastery** card + its picker — not Rage / Unarmored Defense,
      which aren't choices. Verified live (Barbarian: one Weapon Mastery card; the earlier
      ClassProgression-of-everything is gone). No console errors, lint clean, 635 tests.

- **Phase D2.10 — the spells step redesigned for newcomers: split into Cantrips + Level-1 screens.**
  The wizard's magic step used to reuse the **whole `SpellbookTab`** (origin sub-tabs, group/sort/
  search, the full prepare flow) — powerful, but a wall of controls for a new player. It is now two
  purpose-built screens in the spirit of the class-features step: just a guide card and the pickers.
  - **Two screens from the class's own prose.** Each class describes its magic in named sub-blocks
    inside its `Spellcasting`/`Pact Magic` feature (`Cantrips`, `Spell Slots`, `Prepared Spells of
    Level 1+`, `Changing Your Prepared Spells`). New pure **`engine/spellcastingText.js`**
    (`spellcastingFeature`, `namedSubEntries`, `cantripEntries`, `spellSlotEntries`; +10 tests) pulls
    those blocks so the explanation is **authoritative and per-class**, not generic copy — e.g. only
    the **Warlock**'s Spell Slots text says "Short Rest or Long Rest", every other class says "Long
    Rest", straight from the data. **Ranger/Paladin have no `Cantrips` block**, which is exactly why
    their cantrips screen disappears.
  - **`CantripsStep`** — a short "what are cantrips" callout + the class's own Cantrips text + the
    picker (N = `cantripLimit`). **`SpellsStep`** (rewritten) — a "leveled spells vs cantrips + slots
    + preparation" callout + the class's Spell Slots / Prepared / Changing blocks + the level-1 picker
    (N = `prepareLimit`). Both reuse a new **`SpellPicker`** (chips + "+ Choose a …", counter,
    remove) that writes the **same `ClassEntry.spells`** as the SpellbookTab (no rules fork) and opens
    `SelectorPanel` **locked to that class's list and the right level** via `exclude` + a pre-marked
    `initialFilterState` — a newcomer can't wander off-list.
  - **Step engine split.** `wizardSteps.js` replaced the single `spells` step with **`cantrips`**
    (`when`: a class origin with `cantripLimit > 0`) then **`spells`** (`when`: any caster). Tests
    updated (caster fixtures now carry `kind`/`cantripLimit`; a Ranger-style no-cantrips fixture
    proves the cantrips step is skipped).
  - **Show the features table wherever the text cites it.** New reusable **`components/common/
    FeatureText.jsx`** renders a feature's `entries` and, when the prose mentions "…Features table"
    (heuristic word-boundary scan), appends the class progression table (current-level row + expand)
    via the extracted **`components/common/ClassTableView.jsx`** — `ClassProgression` was refactored to
    reuse it (no behaviour change, one source of truth). `FeaturesStep` now renders through
    `FeatureText` too, so **Eldritch Invocations, Barbarian Weapon Mastery** and any table-referencing
    feature show the table.
  - **Verified live** (Artificer 1): the Cantrips screen showed the class's Cantrips text + the
    features table + a locked picker (22 Artificer cantrips), adding one moved the counter to 1/2; the
    Level-1 screen showed Spell Slots ("Long Rest") / Prepared / Changing + the table + a picker locked
    to the 15 Artificer level-1 spells; the "Show full table" toggle expanded to all 20 rows. No console
    errors, lint clean, **656 tests** (+21).

- **Phase D2.11 — recommended ability scores per class, for every method.** The Abilities step used to
  start every method from a generic default (point-buy all 8s, manual all 10s, a fixed array order).
  Now, once a class is chosen, **all three methods start from that class's recommended spread** — the
  PHB-2024 "Standard Array by Class" table (Artificer, absent from the PHB, uses a user-defined
  14/12/13/15/10/8). Each row is a **permutation of the standard array**, so it is simultaneously a
  valid Standard Array assignment, a valid 27-point Point Buy spread, and a sensible Manual default.
  - `engine/abilityMethods.js`: added `RECOMMENDED_SCORES` (the table) + `recommendedScores`,
    `isDefaultScores`, `matchesAnyRecommendation`; `initialScores(method, abilities, classId)` now
    returns the class recommendation for any method when a `classId` is given (generic fallback
    otherwise). +5 tests assert every row is a standard-array permutation costing exactly 27 points.
  - **Seeded on class pick** (`ClassStep`, same guard pattern as starting gold): choosing a class
    writes the recommended scores, but only over the untouched all-10s default or a spread that still
    exactly matches some class's recommendation (i.e. previously auto-seeded) — never over a
    hand-typed spread. So changing class re-seeds; a customised spread is preserved.
  - **Kept on method switch** (`AbilitiesStep`): switching Point Buy / Standard Array / Manual now
    passes the `classId`, so the recommendation carries across methods instead of resetting to the
    generic default. A hint line names the class the spread is recommended for.
  - **Verified live** (Wizard): picking the class seeded `8/12/13/15/14/10`; Manual showed it + the
    hint, Point Buy showed it with **0 points left**, Standard Array showed the same permutation in the
    dropdowns. No console errors, lint clean, **650 tests**.

- **Phase D2.12 — Alignment step + a biography randomizer.**
  - **New Alignment step** (right after Personality & Story). `AlignmentStep` is a 3×3 grid of the nine
    alignments writing the code (`LG`…`CE`) to the existing `identity.alignment` (which the Foundry
    export already maps to `details.alignment`); tapping the selected cell again clears it. Added to the
    catalog with `status` complete-when-set; +2 step-engine tests, order updated.
  - **Biography randomizer.** The four roleplay fields (personality / ideals / bonds / flaws) became
    **lists of entries** (`RoleplayField`): add as many as you want, roll each independently from the
    5e "Suggested Characteristics" tables, edit and delete separately. Storage is unchanged — entries
    are the lines of the same `identity[field]` string, so the Foundry round-trip is untouched.
    - New pure `engine/suggestedCharacteristics.js` (+8 tests) merges **every** background's trait/ideal/
      bond/flaw tables into four deduped pools (~400 / 265 / 270 / 270 unique entries), resolving 5etools
      markup (`{@b Guild}` → "Guild") and, per the user's call, **stripping the alignment tag** from
      ideals ("… (Lawful)" → "…") while keeping non-alignment parentheticals (deities like "(Bontu)").
      `randomSuggestion(db, field, rng?)` draws one (RNG injectable for tests). Memoized per `db`.
    - `backgrounds.json` added to the data manifest (core 5etools file; the cache self-migrates — 161
      backgrounds now loaded). 2024 (XPHB) backgrounds carry no such tables, so the pool is all 2014
      content, exactly as intended.
  - **Verified live** (Artificer wizard): the step showed the four entry-lists; the per-row 🎲 and the
    "🎲 Random" footer each added a distinct suggestion, a rolled Ideal came through with no "(Lawful)"
    tag, ✕ removed an entry, and the Alignment grid saved `CG` (then cleared on re-tap). No console
    errors, lint clean, **659 tests**.
  - **Follow-ups (same day):**
    - **Strip the whole trailing source tag, not just alignment.** Suggestions carry a parenthetical at
      the very end naming where they came from — an alignment ("(Lawful)"), a deity ("(Bontu)"), or the
      background ("(Puzzle, Star)"). `stripAlignmentTag` (alignment-only, ideals-only) became
      `stripTrailingTag`, applied to **every** field, removing any trailing `(…)` (repeated if there are
      several). Validated against the live data: of 1284 rows, 294 ended with a parenthetical before,
      **0 after**.
    - **Entry controls reworked to match the mock.** The 🎲 now sits **inside** the textarea (bottom
      right, above the resize grip); the two footer buttons are gone. Each row carries just **✕**
      (remove) and an accent **＋** (insert another below) stacked to its right. Verified live: the die
      renders geometrically inside the textarea, ＋ inserts a row, ✕ removes one.
    - **RoleplayField shared with the builder; Alignment step redesigned.**
      - `RoleplayField` moved to `components/common/` (own CSS module) and is now used by **both** the
        wizard's Personality & Story step **and** the builder's **Biography tab** — the four roleplay
        fields there became the same entry-lists + randomizer (Appearance stays a plain textarea).
        `BiographyTab` now takes `db` (passed from `Builder`) to feed the randomizer. Verified live: a
        roll in the Biography tab filled a random, tag-free trait.
      - **AlignmentStep** dropped the 3×3 grid for **large stacked cards** in the Divine Order style:
        each option shows "**LG — Lawful Good**" (code accented) plus a one-line description of that
        alignment; tap the selected card again to clear. Verified live (saved `CG`, header reflected
        "Chaotic Good"). Production build clean.
      - **The code is tinted by the Good↔Evil axis**, matching the sheet's alignment tile: blue
        (`#5a96ff`) for good (LG/NG/CG), red (`#e05050`) for evil (LE/NE/CE), accent for neutral —
        keyed off the code's last letter (G/E). Verified live: all nine codes compute the right colour.

- **Phase D3 — the level-up guide.** Leveling a class now runs the guide as an **overlay over the
  sheet** (not a route), for the choices the new level unlocks. Decisions fixed in DDL-0014: HP is
  always the average (rolling stays on the sheet's HP card — no HP step); single-level only; exit
  offers **Undo/Keep**; and a **pendency button** flags leftover required choices.
  - **Entry & flow.** `LevelControls` applies the `+1` then calls `onLeveledUp`; `Builder` opens the
    **`LevelUpWizard`** overlay when the level opens a decision (and guidance ≠ off). Because `save` is
    async (IndexedDB), the overlay **snapshots its step list against the target level**, so a
    just-unlocked feature (e.g. the level-4 ASI) isn't dropped by the store lag. Exit asks **Undo
    level-up** (reverts the `+1`) or **Keep it**.
  - **Diff engine.** `buildLevelUpSteps` drops the HP step and is driven by `ctx` flags computed where
    the `db` lives (`components/wizard/levelUpContext.js`): `hasFeatureChoices` (a `buildClassChoices`
    entry newly at this level) and `spellsChanged` (`spellLimitsGrew` — cantrip/prepare limit grew).
    The **ASI is just a feature choice** now, so there's no separate ASI step (`ASI_LEVELS` removed).
  - **Screens** (reuse, no rules fork): **`SubclassStep`** (reuses `makeSubclassEntity`) at the
    subclass level; **`FeaturesStep`** generalized with `classUid` + `onlyLevel` to show only the
    level's new choices (ASI/feat/invocation/expertise…); **`LevelUpSpellsStep`** — cantrips + prepared
    spells up to the new max circle, via `SpellPicker` generalized to a level range (`level..maxLevel`).
  - **Pendency button (DDL-0014 #5).** A `✦` button beside the hamburger, shown while guidance is
    active. **Accent + a count badge** when the character has an unmade required choice (missing class/
    species, or a subclass past its level), **normal** otherwise. It reopens the guide
    (`/build/:id/wizard`); a new **`subclass` create step** appears there for a leveled character
    (`when` = past the subclass level), so the reopened guide can fix it. The wizard's exit is
    **non-destructive when the character is already created** (no discard prompt — just back to the
    sheet). New engine exports `pendingSubclassClass` / `guidancePendencyCount`.
  - **Verified live** end-to-end on an Artificer: level 2 → spells; level 3 → subclass (Alchemist) +
    spells; level 4 → ASI feature + spells; Undo reverted to the prior level; HP stayed the average;
    the pendency button went accent (badge 1) at level 3 with no subclass, reopened the guide to the
    Subclass step, and exited back to the sheet without discarding. 664 tests, lint clean.
  - **Follow-up polish (2026-07-13):**
    - **Icons centered.** `line-height: 1` on the guide button (`⚛`) and the Proficiencies card icon
      (`᯽`) — decorative glyphs whose line box was pushing them off-centre. Verified live: the atom now
      measures a 0px vertical offset (was ~1.6px low).
    - **Reopen resumes at the pending step.** The guide button opens the wizard at the **first
      incomplete step** (`firstIncompleteIndex` + a new `Wizard` `initialIndex` prop) instead of the
      intro — but only when the character is already created; an in-progress creation still starts at
      the beginning. Verified: an Artificer with no species jumped straight to the Species step.
    - **Spells steps hidden when there's nothing to choose.** A character whose only magic is racial/
      feat (e.g. an Aasimar Barbarian with the `Light` cantrip) no longer sees the cantrips/spells/
      features-intro steps — those gates now look at **class** spell origins only (`hasCantrips` /
      `hasClassPrepared`), not any origin. So the step is gone from the flow **and** the Review.
    - **Fewer "optional" steps.** Only the biography, alignment and name/portrait steps stay optional;
      origin feat, proficiencies, abilities, background boosts, equipment, features, cantrips and spells
      now report **incomplete** until filled, so they flag on the pendency button and in Review.
      Completeness for the db-dependent steps (proficiencies/features) is computed in a shared
      `components/wizard/createGuideContext.js` (mirrors `levelUpContext`) and threaded into the step
      `status` via `buildCreateSteps`. Tests reworked (666 total); production build clean.

- **Phase D — two guides split: full creation tutorial vs. light fixup/level-up overlay (DDL-0015).**
  The guidance had one interface reused everywhere; it's now two.
  - **Weapon-mastery dedup (#3).** A weapon TagChoice now excludes already-picked weapons from its
    selector, so the same weapon can't be chosen twice. Verified live (Greataxe/Handaxe gone from the
    picker after being chosen).
  - **Level-up detected centrally (#4).** `Builder.setClasses` spots a class's `+1` and opens the
    guide — so it now fires from the **Class tab's** level stepper too, not just the top-bar controls.
    `LevelControls` lost its `onLeveledUp` prop.
  - **The light overlay (`LevelUpWizard`) shared by the ✦ button and level-up (#1/#5/#6/#7).** It
    shows only the class decisions still to fill — **subclass → features (unfilled, ALL levels) →
    spells** — in order (`components/wizard/fixupSteps.js`, live/db-aware), with **no Review**
    (`Wizard showReview={false}`). Level-up ⇒ exit Undo/Keep; button ⇒ exit closes. The ✦ button only
    shows when there are class pendencies (`fixupPendencyCount`) and opens the first class with
    something to fill. **#2 fixed by "unfilled, all levels"**: a Barbarian leveling 3→4 now shows the
    **feat AND the 3rd Weapon Mastery slot** (the old per-level diff missed the mastery, whose feature
    is level 1 but count grows at 4). Verified live end-to-end.
  - **Creation guide blocks incomplete required steps (#8).** `Wizard blockIncomplete` disables Next
    on a required step that isn't filled (only biography/alignment/name skippable). Verified: a
    Barbarian creation stopped on the Proficiencies step with "Make this choice to continue."
  - **Restart from the hamburger.** A "Creation guide" menu item re-runs the full tutorial; its exit
    is non-destructive once the character has a class. The `subclass` create step now targets the
    class past its subclass level (fixing a blank screen when the subclass was already set).
  - Removed the now-dead engine pieces (`buildLevelUpSteps`, `levelUpHasDecisions`,
    `guidancePendencyCount`, `firstIncompleteIndex`, `levelUpContext.js`). 655 tests, lint clean,
    production build clean.
  - **Fix: narrow, off-center overlay steps.** In the light overlay (`LevelUpWizard`), some guide
    steps (feat picker at level 4, Primal Knowledge skill at Barbarian 3) rendered squished into a
    narrow column with large empty gutters, while the subclass step looked fine. Cause: the `Wizard`
    root (`.wizard`, `max-width:760px; margin:0 auto`) is a direct **flex** child of the overlay
    `.panel` (`display:flex; flex-direction:column`). A flex item with auto cross-axis margins is
    *shrink-to-fit*, so the wizard collapsed to its content's intrinsic width — wide for the
    text-heavy subclass callout, narrow for a short "+ Add skill"/"Choose feat…" body. Fixed by
    giving `.wizard` an explicit `width: 100%` so it always fills up to `max-width` (harmless in the
    full-page create flow, where it already filled its block parent). Verified live: the features
    step now measures the full 760px on desktop and 375px on mobile, centered.
- **Default "Prerequisites: Met" filter for newcomer-facing pickers.** The selectors now open with
  the prereq filter pre-marked to hide options the character isn't eligible for (the user can still
  uncheck it in the panel — it is an ordinary filter). Reuses `SelectorPanel`'s existing
  `initialFilterState` prop (the same one the Spellbook uses to pre-mark a class); `PickerField`
  now forwards it too.
  - **Eldritch Invocations: always** (Class tab *and* the guide). Scoped to `featureType` `EI` in
    `ChoiceList`'s `OptionalFeatureChoice`; other optional-feature types (metamagic, maneuvers…)
    have no prerequisites, so the filter wouldn't affect them anyway.
  - **Feats: only in the guide screens** (newcomer-focused). `ChoiceList` gained a `guided` prop
    that gates the default filter on the feat `PickerField` and propagates through its recursive
    sub-choices; `FeaturesStep` passes `guided` (it is guide-only), and `OriginFeatStep` sets the
    same initial filter on its origin-feat picker. The regular Class and Background tabs pass no
    `guided`, so feats there stay unfiltered.
  - Verified: lint clean, 657 tests pass (the `initialFilterState` → `applyFilters` path is already
    unit-tested and in production use by the Spellbook).
- **DEEP required steps in the creation guide (2026-07-14, DDL-0018).** Every non-biographical
  step is now mandatory INCLUDING its sub-choices — the size selector, lineage and racial picks,
  and feats' embedded choices; only story/alignment/name stay optional.
  - `createGuideContext` gained a recursive **`choicesComplete`** (an `ability` pool targets the
    CHOSEN alternative's count; feat picks recurse into their sub-bags with the same list
    ChoiceList renders) and two new flags: **`speciesComplete`** (species + lineage when the race
    has `_versions` + ALL species sub-choices, size included) and **`originFeatComplete`** (the
    origin feat's own sub-bag — a Magic Initiate without its spells still pends).
    `proficienciesComplete`/`featuresComplete` upgraded from shallow pick-counting to the same
    deep check.
  - `wizardSteps`' species/originFeat statuses consume the ctx flags (shallow fallback without
    ctx, for pure use); races/feats missing from the compendium count as complete (nothing to
    render — blocking would soft-lock).
  - `LEGACY_ABILITY_CHOICE` moved from ChoiceList to `engine/choices.js` (shared by renderer and
    completeness check; react-refresh lint requires component files to export only components).
  - Verified: 702 tests (10 new in `createGuideContext.test.js`), lint, and live in the guide —
    a Human's species step keeps Next blocked ("Make this choice to continue.") until size +
    skill + origin feat are all picked, re-blocks when the size is cleared, and unblocks again
    when refilled.

- **The ✦ button tracks ALL required fields + per-character guidance + Standard Array default
  (2026-07-15, DDL-0022).** Three fixes to the Character Guidance:
  - **Comprehensive pendency badge.** The ✦ button used to appear only for class decisions
    (`fixupPendencyCount`), so emptying the background ability boosts (or clearing species/class/
    proficiencies/a nested sub-choice) left it hidden. New `components/wizard/guidancePendencies.js`
    (`guidancePendencies` → `{ basic, fixup, total }`) reuses `createGuideContext`'s deep flags
    (species/originFeat/proficiencies) plus exported `scoresTouched`/`boostsComplete` and the class
    `fixupPendencyCount`. The button now shows (accent + count) while ANY required non-biographical
    field is unfilled. `basic` pendencies (species/class/origin feat/proficiencies/abilities/boosts)
    route the button to the **creation guide opened at its Review screen** (`WizardPage` reads a
    `location.state.atReview` → `initialIndex`), since the light overlay can't fill those; class-only
    pendencies still open the light fixup overlay. Starting equipment is deliberately NOT counted —
    its only signal (`meta.startingKit`) is set solely by the guided step and would nag manual builds.
  - **Per-character guidance (`meta.guided`).** Guidance is now a per-character flag, not the global
    setting: creating with **"Just the sheet" saves `guided: false`** (the ✦ button and the level-up
    overlay stay off for that character); guided creation saves `true`; legacy characters read `true`
    via the `meta` deep-merge. The Builder ☰ "Enable/Disable Character Guidance" toggles this
    per-character flag (was the global preference); the global `ask/on/off` in Home still governs the
    create prompt.
  - **Standard Array is the guided default.** Guided creation now creates with
    `scoreMethod: 'standard-array'` (was Manual); `createCharacter` takes `guided`/`scoreMethod` opts.
    The ClassStep still seeds the class's recommended spread (a valid standard-array permutation), so
    the Abilities step opens on Standard Array with that spread. "Just the sheet" stays Manual/all-10.
  - Verified: 719 tests (9 new in `guidancePendencies.test.js`), lint, and live — a "just the sheet"
    character shows no ✦ button (menu reads "Enable Character Guidance"); enabling it surfaces
    "6 choices left", which opens the creation guide at Review listing every gap; a guided Fighter's
    saved `scoreMethod` is `standard-array` with the Fighter spread (15/14/13/8/10/12).

## 22. PDF export (Phase E, in progress)

Printable character-sheet PDF — README roadmap #13. **Decision: a clean-room layout** (we draw our
own original sheet, we do NOT bundle or overlay the copyrighted official WotC sheet — the WotC PDF
is a private visual reference only; keeps DDL-0003 "ship code only" intact). **Engine:
`@react-pdf/renderer`** (declarative React → PDF), **lazy-loaded**.

**Direction (2026-07-13, fixed with the user):** build the sheet layout to be **strongly based on
the official 2024 sheet's field organization and positioning**, and get the **complete BLANK sheet**
right first — a legally-distributable form of our own — before filling in any character data. The
sheet layout (which fields, grouped into which sections, at which positions) is functional and SRD-
adjacent; what we deliberately do NOT reproduce is the copyrighted expression: the ornamental frames,
the ability-score ribbons/shield art, the paper texture, the D&D logo/wordmark, the character
illustrations, and the trademark/copyright notice.

- **E0 — pipeline scaffold.** `exportPdf.jsx` (`exportCharacterPdf` → Blob → download `<name>.pdf`),
  split from the document component so the react-refresh lint rule stays happy (both land in one
  chunk). Builder ☰ **"Export PDF"** is no longer a mockup — it `import()`s the module on click, so
  `@react-pdf/renderer` (~1.4 MB) code-splits into its own chunk and never enters the 694 KB main
  bundle (confirmed in the production build).
- **E-blank — faithful blank sheet (2026-07-13).** Reverse-engineered the official sheet's geometry
  with `pdfplumber`/`pypdfium2` (page 603 × 774 pt; every field label's `(x, y)`), then rebuilt it
  as our own drawing:
  - **`src/pdf/primitives.jsx`** — coordinate-absolute building blocks (`Frame`, `Title`, `L`,
    `Rule`, `VLine`, `Circ`, `Diamond`) at 603 × 774 so positions map 1:1 to the reference. Diamonds
    are SVG; everything else is bordered/rounded Views. `src/pdf/colors.js` holds the palette.
  - **`src/pdf/CharacterSheetDoc.jsx`** — the full **two-page blank sheet**, redrawn: page 1 =
    identity (name/background/class/species/subclass), level/XP, AC, hit points, hit dice, death
    saves, proficiency bonus, initiative/speed/size/passive perception, the six ability blocks with
    saves + skills, heroic inspiration, equipment training & proficiencies, the weapons/damage table,
    class features, species traits, feats; page 2 = spellcasting ability, spell slots (levels 1–9
    with expend pips), the cantrips & prepared-spells table (~29 ruled rows with C/R/M markers),
    appearance, backstory & personality (+ alignment), languages, equipment (+ magic-item
    attunement), and coins. No character data yet — this is the template.
  - **Verified:** rendered both pages to PNG and compared side-by-side with the original — the field
    layout and positions match; fixed an "Armor Training" label/toggle overlap. Lint + build clean,
    658 tests (a render test asserts a valid two-page `%PDF-`).
  - **Next:** overlay the character's values onto this template — E1 identity + abilities + combat,
    E2 skills/saves + attacks + profs/feats, E3 spells, E4 equipment/coins/backstory, E5 polish.
- **E-blank polish pass (2026-07-13).** Re-rendered the blank template beside the official PDF
  (`pypdfium2` at 2×) and fixed the page-1 formatting defects the side-by-side exposed:
  - **Ability blocks** — the `SCORE` box now nests against the modifier circle's right edge (as on
    the official sheet) instead of floating apart, the circle is a touch larger, and the
    `MODIFIER` / `SCORE` captions are separated onto their own rows so they no longer overprint
    into "MODIFIERSCORE". The score box gets a white (`COLORS.paper`) fill so it masks the circle
    stroke behind it. Skill rows get a slightly bigger proficiency circle and a longer write-line.
  - **Stray/duplicate rules removed** — the extra middle line in Level/XP, the second line under
    Hit Dice `MAX`, and a full-width rule crossing the Hit Points box were deleted; each field now
    has exactly one write-line.
  - **Overflow & crossings** — "Shields" no longer spills past the Equipment Training box (the four
    armor-training toggles were tightened), and the AC "SHIELD" caption/diamond were moved below the
    inner circle so they stop overlapping it.
  - **Decluttered** — dropped the fixed ruled lines under Equipment Training's WEAPONS/TOOLS (blank
    write area, like the official), and enlarged/centered the Proficiency Bonus write box to use its
    dead space.
  - Verified by re-rendering both pages and diffing against the official; render test + lint still
    pass. Layout only — no data yet (E1+ still overlays the character's values).
- **E-blank layout pass 2 (2026-07-14).** Fixed with the user: kill the redundancy and the dead
  space, and untangle the remaining overlaps. Also stood up a repeatable **visual test mode**.
  - **"Export PDF" was erroring on this machine** (`[vite:import-analysis] Failed to resolve import
    "@react-pdf/renderer"`) — not a code bug: the dependency had been installed on the other
    computer only. `npm install` fixed it; verified live (the lazy `exportPdf.jsx` +
    `@react-pdf_renderer` chunks load 200, the blank sheet downloads).
  - **Visual test mode (new dev tool).** `npm run pdf:preview` renders the sheet OUTSIDE the
    browser (`scripts/render-pdf-preview.jsx` via `vite-node`, new devDep) into
    `pdf-preview/sheet.pdf` (gitignored) and converts it to PNGs (`scripts/pdf_to_png.py`,
    `pypdfium2`; also works on the official reference PDF for side-by-sides). This is how every
    change below was inspected.
  - **Outer decorative frame REMOVED on both pages** (deliberate deviation from the official —
    redundant ink around already-framed content).
  - **Reclaimed the logo band (page 1).** The official's D&D-logo strip (~20 pt between the top
    row and the stats row) is art we don't reproduce, so the space is now content: everything
    below y≈110 moved up 14 pt and the bottom boxes grew by it — Equipment Training (+14, TOOLS
    area included), Species Traits / Feats (+14), and the Weapons table gained an 8th ruled row.
  - **Page 2 dead space.** Spellcasting Ability + Spell Slots moved up to the top margin; the
    Cantrips & Prepared Spells table grew to 31 rows (was 29) and now reaches the page bottom;
    the Coins boxes grew taller (34→56 pt) instead of floating over 30 pt of nothing.
  - **Overlap fixes.** Skill/save rows redesigned (circle · write-line · name with real gaps —
    the line used to cross the proficiency circle and touch the name; column-B ability blocks
    widened 88→96 pt to fit); the SCORE box now only tangents the modifier circle (4 pt) instead
    of sinking 9 pt into it; the spell C/R/M letters gained clearance from their diamonds and the
    marker group was re-centered in its column.
  - **Re-centered** the Death Saves pips, the Heroic Inspiration diamond, and the AC SHIELD
    caption+diamond (now a centered stack under the circle).
  - Verified: PNG side-by-side vs the official, 658 tests, lint, and a live in-app export.
- **E-blank standardization pass (2026-07-14).** With the formatting defects gone, this pass makes
  the sheet read as ONE system — an explicit grid, documented in the file header: **page margin
  10 pt on all four sides** of both pages, **6 pt gutter between every pair of cards**, **radius 6
  on cards / 3 on inner write-boxes**, section titles 4 pt from the card top (size 8; 7 on the low
  stats-row cards).
  - **Page 1.** The whole top row is now t10/h78 (Level-XP had been 72 tall, differently rounded,
    and 2 pt lower than its neighbors — its write-lines were also redistributed); the stats row
    (Initiative/Speed/Size/Passive) re-gapped to exactly 6 pt ending flush at x 593; both ability
    columns re-stacked on 6 pt gaps so column A (…Heroic Inspiration) and column B (Charisma) end
    on the same line (y 602); **Equipment Training widened to the ability columns' full span**
    (x 10..222) — it used to stop 10 pt short of the column above it.
  - **Page 2.** **Spell Slots now starts at the top margin** (the dead band above it is gone) and
    fills its own card (slot rows spread to gap 19); Appearance grew 4 pt so the whole right
    column tops/bottoms align with the left column's seams; **Coins shrank to a 64 pt card**
    (the boxes were floating in 30+ pt of nothing) and the reclaimed height went to Equipment;
    the Cantrips table re-anchored to the same margins (x 10..398, down to y 764).
  - Verified by re-rendering the PNGs (grid seams line up on both pages); 658 tests + lint clean.
- **E1–E4 — the FILLED sheet (2026-07-14).** The export now writes the character onto the
  template. Conventions fixed with the user (see DDL-0016): names-only for features/traits/feats,
  one sheet per class for multiclass, and player-owned fields left blank.
  - **`src/pdf/sheetModel.js` (new, pure)** — `buildSheetModel(character, derived, db)` translates
    the decisions+derivation into flat display values: identity line, level, AC (+shield mark),
    HP max, hit dice aggregated by die face ("6d8"), proficiency bonus, initiative/speed/size/
    passive perception, per-ability score/mod/save/skills (with proficiency flags), armor-training
    toggles, weapon/tool proficiency text, **weapon attack rows** (ability by melee/ranged/finesse,
    proficiency by category/name, `bonusWeapon`, damage `1d6+3 B`, mastery/thrown/versatile notes),
    class+subclass feature names (level-ordered), species trait names, feat names (origin + species
    + ASI-slot picks), spell block per origin (ability/mod/DC/attack), **slot totals with the pact
    slot folded into its circle's Total**, spell table rows (level, name, abbreviated casting time,
    compacted range, C/R/M marks, frequency notes like "Elf, 1/Day"), languages, equipment lines,
    attuned items (3 lines), coins, alignment/appearance/backstory.
  - **`CharacterSheetDoc`** now takes a `model`: each `sheets[]` entry renders the 2-page sheet
    with values (`Val` skips empty; `Para` wraps text; prof circles and armor/C/R/M diamonds fill
    with ink). Without a model it still renders the blank template (render test unchanged).
  - **Multiclass** = one sheet per class in the SAME file, identical except class/subclass, that
    class's feature list and that class's spellcasting block; species/feat-granted spells repeat on
    every sheet. Verified on a Cleric 5 (Life) / Warlock 1 preview: 4 pages, WIS 15/+7 vs CHA
    13/+5, Life Domain grants deduped from the prepared picks (engine R12) and listed with the
    granted group, slot Total 5 = 4 leveled + 1 pact.
  - **Blank by design** (player fills at the table): background (we use custom origins), XP,
    current/temp HP, spent hit dice, death saves, heroic inspiration, expended slot pips.
  - `scripts/render-pdf-preview.jsx` now also renders `pdf-preview/sheet-filled.pdf` from a
    fixture character, loading the compendium from the local `../DnD Source Material/5etools
    Source Code/data` snapshot (same manifest as the app).
  - Verified: PNG inspection of all 4 filled pages, 671 tests (13 new for the model), lint, and a
    live in-app export against the real IndexedDB compendium.
- **E5 pass 1 — size/alignment, player choices, granted-origin DCs, trait texts, Home export
  (2026-07-14).** Six user-requested improvements to the filled sheet (+ the species-size feature
  behind one of them, DDL-0017):
  - **Size and alignment spelled out.** SIZE prints "Medium"/"Small/Medium" (from the new
    effective-size engine below) and Alignment prints "Neutral Good" from the stored code
    (free-text values from old imports pass through).
  - **Species size selector** (`engine/speciesData.js`: `sizeCodes`/`speciesSizeChoice`/
    `sizePick`/`effectiveSizeCodes`/`sizeLabel`). Races with more than one size code (or none —
    treated as Small/Medium per the user's rule) get a **Size choice** in Species Choices, in the
    SpeciesTab AND the guide's SpeciesStep (same choice-bag, pick `{kind:'size', picks:['S']}`);
    single-size races get none; **Verdan ('V') is level-driven** — Small through level 4, Medium
    from 5 — and never a choice. ChoiceList renders the new 'size' pool with the same select used
    by 'spellAbility' (generalized into `SelectChoice`). The Foundry export (actor `traits.size` +
    the species item's `Size` advancement) now uses the effective size too.
  - **Granted-origin spellcasting modifiers on the sheet.** Spell rows from race/feat origins now
    carry that origin's own DC/attack in the notes — "Drow Lineage (DC 15/+7), 1/Day" — computed
    from the fixed or player-chosen ability exactly as the Spellbook shows; and when the sheet's
    class has no spellcasting of its own, the Spellcasting Ability block **falls back to the first
    granted origin** (a Fighter with Magic Initiate gets a DC on paper).
  - **Player choices annotated on the feature list** (`featureAnnotations` in `sheetModel`):
    Weapon Mastery weapons, Fighting Style, Eldritch Invocations / Metamagic / Maneuvers (any
    optional-feature progression, labeled from its selector), sub-feature picks (Divine/Primal
    Order, Blessed Strikes…), Expertise skills, named-grant picks (Primal Knowledge…), and the
    per-level feat slots — "Divine Order (Thaumaturge)", "Ability Score Improvement (+2 Wis)".
    Choices whose feature isn't in the printed list become their own line ("Level 4 Feat: War
    Caster"). Level-1 proficiency picks are NOT annotated (they're already in the proficiency
    areas). `NameList` in the doc now word-wraps long lines (counted against the column budget)
    instead of letting them overflow the card.
  - **Species traits now print their DESCRIPTIONS** (names only before): `sheetModel` flattens
    each trait's entries to plain text (5etools `{@tags}` stripped) and the new `FitTraits` block
    steps the font down (6.5→4 pt) until the text fits the card, truncating with an ellipsis only
    when even the smallest doesn't fit.
  - **Home roster ⋮ "Export PDF" is live** (was a disabled "Coming soon" mockup): derives via
    `deriveFromDb` and lazy-imports the same `pdf/exportPdf` chunk as the builder menu.
  - Verified: 688 tests (17 new: size engine + model annotations/DC/fallback/alignment), lint,
    PNG inspection of the 4-page preview (Drow lineage + Divine Order + invocation + War Caster
    fixture), and live in the browser (Human XPHB shows the Size select, the pick persists in the
    choice-bag).
- **E5 pass 2 — trait formatting + spell overflow pages (2026-07-14).** Two refinements asked by
  the user after seeing pass 1:
  - **Species traits are structured paragraphs, not run-on text.** `speciesTraitParagraphs`
    (replaces the flat `speciesTraitTexts`) mirrors the Species screen's structure, compacted:
    each trait is a paragraph with its name as a **bold lead**, and named sub-entries / list items
    (Aasimar's Celestial Revelation options — Heavenly Wings, Inner Radiance, Necrotic Shroud) get
    their **own line-broken paragraph with a bold lead** — no boxes, bullets or per-topic font
    sizes. Text after a nested block continues as a lead-less paragraph.
  - **The traits card now fills its whole box.** Since species traits never change or grow,
    `FitTraits` picks the LARGEST font that fits (10 → 4 pt in 0.5 steps, char-estimate +
    `overflow: hidden` + ellipsis truncation as the never-overflow backstops) instead of only
    shrinking from 6.5 — a short trait list (Human) prints big and legible.
  - **Spell overflow pages.** More prepared/granted spell rows than the page-2 table holds
    (`SPELL_ROWS_PER_PAGE` = 31) now emit EXTRA spell pages: like the multiclass convention, the
    shared blocks (spellcasting ability, slots, right column) repeat, but **page 1 does not**
    (same class, nothing new to print). Blank sheet / no spells keeps exactly one page 2.
  - Preview fixture switched Elf-Drow → **Aasimar XPHB** (the trait stress case; also exercises
    the size pick "Small" and the fixed-CHA racial DC tag); a synthetic 37-row render checked the
    continuation page visually.
  - Verified: 693 tests (5 new: trait paragraphs ×4, PDF page-count ×1 — the render test now
    counts `/Type /Page` dicts), lint, PNG inspection (Aasimar card + overflow page 3).

## 16. Reference material & licensing

- **`DnD Source Material/README.md` (new, outside the repo)** — the four reference folders
  (`5etools Source Code`, `DnD 5e System Source Code`, `Character Sheets in JSON`,
  `Plutonium Module Code`) now carry a README documenting, per folder: what it holds, its
  licence, the paths worth reading, and why a session would open it. Written so a fresh
  session gets the same orientation without re-exploring.
- **The reference folder lives at two different absolute paths** (the user works on two
  computers) but is **always a sibling of the project directory**. `CLAUDE.md` §3 now says so
  explicitly and tells sessions to resolve `../DnD Source Material` instead of hardcoding a
  drive letter.
- **Licensing correction — the `foundry-*.json` mechanics overlay is 5e.tools', not
  Plutonium's (DDL-0009).** The overlay files (`foundry-feats`, `foundry-races`,
  `foundry-items`, `foundry-optionalfeatures`, `class/foundry.json` — Active Effects,
  ScaleValue tables, special advancement configs) are **byte-for-byte identical** between the
  Plutonium module and the **MIT-licensed** 5e.tools repo; Plutonium merely bundles a copy.
  Every one of those paths was verified to return **HTTP 200 on the mirror the app already
  fetches from**, at matching byte sizes, and `foundry-feats.json` was confirmed to be the
  real overlay (51 entries; "Alert" carries the `flags.dnd5e.initiativeAlert` change seen in
  the real Foundry export).
  - So the overlay **may be fetched at runtime like any other data file**. DDL-0003's
    Plutonium prohibitions are otherwise untouched — the module stays a private reference,
    never bundled or fetched.
  - Caveats for a future consumer: the overlay's Active-Effect `mode` is a **string**
    (`"OVERRIDE"`, `"ADD"`) rather than Foundry's numeric mode; `foundry-psionics.json` is an
    empty `{}` upstream; `foundry-backgrounds.json` is **Plutonium-only** (404 on the mirror)
    and stays out of bounds; and adding paths to `buildManifest` carries the usual risk that a
    single 404 breaks the whole `Promise.all`.
  - **Impact (not yet scheduled):** `engine/foundryEffects.js`, our hand-curated Active-Effects
    registry, can be backed by — or largely replaced with — the upstream overlay, shrinking
    per-feature curation to the gaps it leaves. Additive; does not block Phase B2.

## 23. Rules glossary with inline links (v1 DONE)

- **Feasibility analysis (2026-07-14) — POSITIVE; plan fixed in `RULES-GLOSSARY-PLAN.md`
  (project root), pending the user's go-ahead (DDL-0019).** The feature: rule mentions inside
  any rendered text (Topple citing the *Prone* condition, a trait citing *Darkvision*) become
  tappable links opening a popup with the rule's full text — nested references stack.
  Findings that make it cheap: the 5etools prose already embeds machine-readable tags
  (`{@condition Prone|XPHB}`, `{@variantrule …}` — ≈3.3k glossary mentions across the content we
  display, plus 1.9k spell / 0.8k item refs for a v2); the glossary data is mostly ALREADY
  fetched (`variantrules.json` with the 114-entry XPHB Rules Glossary, `skills`, `senses`,
  `items-base` masteries/properties) with only `conditionsdiseases.json` + `actions.json` to add
  (both verified HTTP 200 on the mirror); every displayed text funnels through ONE function
  (`EntryContent.renderTag`, which already styles reference tags as inert spans); and the
  DDL-0007 dialog stack already provides stacking popups. Plan: G1 data+engine
  (`engine/glossary.js` index + tag-grammar lookup), G2 links+popup, G3 coverage sweep.
- **G1 — data + engine (2026-07-15).** `GLOBAL_FILES` += `conditionsdiseases.json` +
  `actions.json` (both re-verified 200 on the live mirror the same day; the cache self-migrated
  the two new keys into IndexedDB on next load, no schema change). New pure module
  `engine/glossary.js`:
  - `buildGlossary(db)` → `Map<'{type}:{name-lower}', entry[]>` over condition/disease/status
    (conditionsdiseases), variantrule, action, sense, skill, itemMastery and itemProperty
    (items-base). **itemProperty has no top-level `name`** — the prose references it by
    ABBREVIATION (`{@itemProperty 2H|XPHB|Two-Handed}`, sometimes lowercase `2h`) and the real
    name lives in `entries[0].name`, so it's indexed under both keys.
  - `parseTagContent` handles the pipe grammar `Name|Source|Display` (0/1/2 pipes, empty source
    as in `{@itemProperty L||light}`); `lookupRule(glossary, tag, content)` resolves
    case-insensitively (tags often use `{@status concentration}`) with source preference
    exact match → XPHB → PHB → first, and returns `{entry, display}` or null.
  - `glossaryFor(db)` memoizes the index per db object (WeakMap) — lookups at render time are
    Map hits. 13 unit tests (`glossary.test.js`): pipe grammar, source preference/reprint
    collapse, case-insensitivity, abbreviation keys, unknown term/tag → null.
- **G2 — links + popup (2026-07-15).** `EntryContent.renderTag`'s default branch now routes the
  9 glossary tags to a **`RuleLink`** component (a component, not a pure helper, so it can read
  the db via `DataContext` directly — no prop threading through the render helpers; outside the
  provider or when the term doesn't resolve it degrades to the old inert span, so a link is
  never dead). Resolved mentions render with the `.ref` base style plus a dotted-underline +
  pointer affordance (`.refLink`), keyboard-accessible (role=button, Enter/Space). Tapping calls
  **`showRulePopup(entry)`** (`components/common/RulePopup.jsx`) which **reuses the DDL-0007
  dialog stack** (`dialogStore.open` with title, type + source badges, and an
  `<EntryContent entries={rule.entries}/>` body) — so nested rule mentions inside a popup are
  links too and push another popup; X/Esc/click-outside pop only the top one. The popup body
  resets the DialogHost's `white-space: pre-line` (it's structured EntryContent, not plain
  text). Bonus fix: for UNRESOLVED glossary tags the inert span now shows the correct display
  segment (3rd pipe) — e.g. Fighter's `{@variantrule weapon mastery properties|XPHB|mastery
  properties}` (a rule name that doesn't exist in variantrules.json) used to print the raw
  first segment.
- **G3 — sweep (2026-07-15).** Verified live across surfaces (all funnel through EntryContent,
  as predicted): species selector detail + Species tab traits (Dwarf: Darkvision → popup;
  Darkvision popup's *Dim Light* → second popup → *Lightly Obscured* → third; Esc pops one at a
  time), class feature list (Second Wind's *Bonus Action*/*Hit Points*/*Short/Long Rest* all
  linked), and the item shop's weapon detail (**the plan's flagship: Battleaxe's "Mastery:
  Topple" → *Prone* popup with its own nested *crawl*/*Speed*/*Advantage* links**). PDF export
  untouched (sheetModel strips tags itself); Foundry export untouched. 715 tests + lint clean,
  zero console errors. Out of scope for v1 (unchanged): `{@spell}`/`{@item}`/`{@feat}` opening
  the app's entity detail views, a browsable glossary page, `{@quickref}` (different grammar,
  stays plain).
- **v2 — ENTITY links (2026-07-16, DDL-0025).** The v1 backlog shipped: mentions of **spells,
  items, feats, optional features, species, classes, languages, backgrounds and class/subclass
  features** inside any rendered text are now tappable links too. New pure module
  `components/common/entityLinks.js`:
  - `lookupEntityLink(db, tag, content)` resolves `{@spell}`, `{@item}`, `{@feat}`,
    `{@optfeature}`, `{@race}`, `{@class}`, `{@language}`, `{@background}`, `{@classFeature}`
    and `{@subclassFeature}` against a per-db memoized name index (WeakMap, like
    `glossaryFor`). Source preference: exact → XPHB → XDMG → PHB → DMG → first;
    lookups case-insensitive; reprints hidden via `latestOnly` (a `{@spell Fireball|PHB}` in
    legacy prose opens the current XPHB Fireball).
  - Tags with an entity config open the **existing `DetailView`** via `showDetailPopup`
    (DDL-0021) — a spell link shows the same full preview as the Spellbook picker (meta chips,
    higher-level block, fluff art), an item link the same as the shop. Types without a selector
    entity (`background`, `classFeature`, `subclassFeature`) open the **rule popup**
    (`showRulePopup`, with new type badges). Both ride the DDL-0007 dialog stack, so entity
    popups, rule popups and nested links all stack and pop independently.
  - `classFeature`/`subclassFeature` have their own pipe grammar
    (`Name|Class|ClassSource|Level|Source` / `…|ScShortName|ScSource|Level|Source`) resolved
    against the class's own db file; `entityTagDisplay` exports the per-tag display rule so
    even UNRESOLVED tags print the right segment.
  - **`{@item}` also resolves itemGroups** ("Arcane Focus", "Ioun Stone"…): the popup lists the
    member items as nested `{@item}` links (verified live: Warlock's Pact Magic → Arcane Focus
    → Crystal, three stacked popups). Groups are link-only — the shop doesn't sell categories.
  - The item index for links includes the **generated specific variants** (§28) and does NOT
    filter `age` (prose may cite firearms).
  - Rendering fixes in `renderTag` while there: `{@dc 15}` → "DC 15" and `{@hit 5}` → "+5"
    (both used to print the bare number, the dc one with a misleading link underline);
    `{@quickref …}`/`{@creature …}` now print their grammar's correct display segment (still
    inert — quickref/bestiary data isn't fetched).
  - Deliberately still inert (data not fetched, low builder value): `{@creature}`, `{@deity}`,
    `{@table}` (the referenced tables live in DMG book data/`gendata`, not `tables.json`),
    `{@quickref}`, `{@card}`/`{@deck}`, `{@hazard}`/`{@trap}`/`{@object}`/`{@vehicle}`,
    `{@subclass}` (5 mentions, no self-contained text to show). 14 unit tests
    (`entityLinks.test.js`); verified live on the Warlock class features (Eldritch Blast /
    Witch Bolt / Charm Person / Hex spell popups from Pact Magic's own text).

## 24. Clickable choice chips + full weapon-mastery preview

- **Two related gaps in the choice UI (2026-07-15).** (1) Selectors that render the picked
  options as chips (Eldritch Invocations, Metamagic and other optional features; Weapon
  Masteries; skills/tools/languages/expertise) gave no way to re-read a chosen option's
  description afterward. (2) The Weapon Mastery selector's preview showed almost nothing —
  crucially not even the mastery's own description, which is the whole point in that context —
  unlike the rich item-shop preview.
- **Clickable chips → detail popup.** New `components/common/detailPopup.jsx` exposes
  `showDetailPopup({ entity, raw, db })`, which **reuses the DDL-0007 dialog stack** to render
  the SAME `DetailView` the SelectorPanel shows (art, meta, resolved description, lore) inside a
  popup. `DetailView` gained a `hideHeader` prop so the name/source isn't duplicated (the dialog
  title carries the name). In `ChoiceList.jsx` the chip text became a button (`.tagLabel`,
  dotted-underline on hover, keyboard-focusable) in all three chip renderers — `TagChoice`
  (weapon/skill/tool/language/expertise), `OptionalFeatureChoice` (invocations/metamagic/…) and
  `MixedChoice` (Skilled) — each resolving the stored pick back to its `raw` via the entity's
  own `list(db)` (by name, `Name|Source` id, or skill code). The × remove button is unchanged;
  rule links inside the popup stack further popups (works with §23). Reaches the Class tab AND
  the wizard's FeaturesStep for free (both render `ChoiceList`).
- **Full weapon-mastery preview.** `selector/entities/weapon.js` now **delegates `meta`,
  `entries` and `fluff` to `itemEntity`** (kept its weapon-mastery-specific `list`/filters/
  `card`). The preview now matches the item shop: type/damage/range/properties/mastery in the
  meta AND the resolved **mastery + property descriptions** (and fluff art) in the body — the
  `itemEntity.entries` already appended `Mastery: <name>` blocks. Verified live: the Weapon
  Mastery selector shows "Mastery: Vex" with its text; a picked Battleaxe chip opens the full
  card (Versatile + Mastery: Topple, with §23 rule links); an Armor of Shadows invocation chip
  opens its description. 715 tests + lint clean, zero console errors.

## 25. UI polish — multiclass picker, biography buttons/backgrounds, filter search button

- **Four small UI fixes (2026-07-15).**
- **(1) "Add class" always re-opens the class picker; cancel = no-op.** The class `PickerField`'s
  one-time auto-open guard (an internal `didAuto` ref) stuck after the FIRST add because the same
  component instance was reused across multiclass slots. So a 3rd/4th multiclass, an add right
  after removing a class, and an add after cancelling the selector once all opened an empty
  "New class" tab with no picker. Fix: **key the `PickerField` by the class slot's `uid`**
  (`components/builder/ClassTab.jsx`) so every new slot mounts a fresh instance → the selector
  auto-opens every time. Cancelling the selector of a freshly-added (still empty) multiclass slot
  already discards that slot (`onClose`), so "pick nothing" cleanly cancels the add. Verified live
  in all three cases.
- **(2) Roleplay add/remove buttons are fixed squares, top-anchored.** In the Biography tab and the
  guide's Personality/Story step, the personality/ideals/bonds/flaws add(＋)/remove(×) buttons
  stretched vertically as their auto-growing textarea grew. `RoleplayField.module.css`: the row is
  `align-items: flex-start` and the buttons are a fixed **36×36** (`flex: none`), so they stay the
  same size and position in the top corner while the textarea grows downward.
- **(3) All biography inputs use `--bg-soft`.** Some biographic text inputs/areas were on `--bg`
  instead of the intended `--bg-soft`, in both the tab and the guide. `RoleplayField.module.css`
  (`.rpInput`) and the wizard `steps.module.css` (`.textArea`/`.textInput`, name/portrait) switched
  to `--bg-soft`. Verified: every biographic field reads `rgb(28,29,37)` (= `--bg-soft`); the only
  transparent one is the big character-name field in the header, which is intentional.
- **(4) Desktop filter search (🔍) button follows the Clear button's height and stays square.** In
  the SelectorPanel's filter column the 🔍 toggle had a fixed size while "Clear" auto-sized, so the
  two could mismatch. The app's line-height is an inherited absolute length (`font: 18px/145%` →
  26.1px) and `* { box-sizing: border-box }`, so both buttons are `1lh + 12px` (padding 10 + border
  2) tall. `.filterSearchBtn` is now a **`calc(1lh + 12px)` square** with `line-height: inherit`
  (without it the `<button>` UA font resets line-height to `normal` and `1lh` no longer matches
  Clear). This tracks Clear's height even when Clear is hidden, and avoids the flex quirk where
  `aspect-ratio` is ignored on a stretched item. Verified: 🔍 and Clear both 38.09 px tall, 🔍 is
  38.09×38.09 square, and it stays square/38.09 when Clear disappears.
- **(5) Roleplay field min-height matches the button pair (2026-07-15).** Personality/Ideals/
  Bonds/Flaws textareas had `min-height: 42px`, shorter than the two stacked 36px buttons beside
  them (36 + 6px gap + 36 = 78px) — the box looked shorter than its own button column at rest.
  `.rpInput` min-height raised to `78px` to match exactly. Verified: both measure 78px.
- 719 tests + lint clean.
- **Removed `RULES-GLOSSARY-PLAN.md` (2026-07-15).** Its only content still relevant after v1
  shipped (§23) — the v2 backlog (spell/item/feat links to entity detail views, ≈1.9k/0.8k/93
  mentions; a browsable glossary page; `{@creature}`/`{@deity}`/`{@filter}`/`{@quickref}`/
  `{@book}` staying plain text) — was folded into CLAUDE.md DDL-0020; the file itself (staged
  plan + feasibility tables, all executed) was deleted rather than left as a stale duplicate.

## 26. Branding: SVG logo + logo on the Home header

- **The logo is now an SVG (2026-07-15).** `public/logo.png` was replaced by
  `public/logo.svg` (the same wing mark as a vector with its gradient), and the PNG was
  deleted — the SVG scales cleanly at every size. `index.html` favicon links updated to
  `type="image/svg+xml"` / `/logo.svg` (the `apple-touch-icon` also points at the SVG; iOS
  home-screen icons technically prefer PNG, an accepted trade-off to keep a single asset).
- **Home shows the logo beside the FlyBy title.** `Home.jsx` renders
  `<img src="/logo.svg">` to the LEFT of the brand name; `.brand` became an inline-flex row
  (gap 10px) and the new **`.brandLogo`** class (`Home.module.css`) fixes the size —
  `height: 28px`, width follows (square viewBox). Adjust the height there to resize.
- Verified live: logo loads (28×28) next to "FlyBy", no console errors, favicon serves.

## 27. Phase T — testing & curation campaign (plan)

- **`TESTING-PLAN.md` created (2026-07-15)** — the working context for the systematic
  testing/curation campaign that runs BEFORE play mode (decision recorded as DDL-0024).
  Three tiers: **Tier 0** an automated sweep (`npm run sweep`, to be built first) that
  auto-builds every class × subclass × level 1–20 and every species × lineage from the
  local data snapshot, auto-fills all choices with seeded picks, and asserts derivation/
  choice-coverage/export/round-trip invariants; **Tier 1** Claude-driven UI sessions over
  the browser preview, sampled at each class's *decision levels* only; **Tier 2** user
  curation + real-Foundry milestone imports. Trackers live in `testing/`
  (`COVERAGE.md`, `ISSUES.md`, `report.json`). Scope order: species/classes/subclasses
  (T1) → their Foundry export (T2) → feats/spells/items (T3, later).
- **Stage T0 DONE (2026-07-15): the sweep harness is built and the first full sweep ran.**
  - `scripts/lib/loadDb.js` (compendium loader extracted from `render-pdf-preview.jsx`),
    `matrix.js` (data-driven rows: classes × subclasses via the selector entities,
    species × lineages via `_versions`; fixed default species Dwarf XPHB for class rows),
    `rng.js` (mulberry32 + per-row FNV seed → every failure reproducible),
    `autoBuild.js` (the auto-builder: standard-array scores, seeded boosts, fixed Alert
    origin feat, then derive→fill→repeat over the SAME machinery the UI uses —
    `parseChoices`/`buildClassChoices`/selector entities/`choicesComplete`/
    `guidancePendencies` — including feat sub-bags, mixed pools, size/spellAbility
    selects, optional features with prereq-met preference, and spells filled to the
    cantrip/prepared limits + Mystic Arcanum picks), `invariants.js` (NaN/undefined deep
    scan, prof-bonus/HP sanity, Foundry item shape), `roundtrip.js` (decision summary +
    per-index diff + WAIVERS/KNOWN_ISSUES classification). 13 unit tests
    (`scripts/lib/sweep.test.js`, 732 total).
  - `npm run sweep` (flags: `--class= --subclass= --species= --seed= --emit-actors`);
    class rows build at level 20, then derive a `cleanupClassEntry`-pruned clone at EVERY
    level 1–20 (also emits each class's **decision levels** into the tracker for Tier 1).
    Full matrix: **256 rows in ~8 s**. Slices skip the COVERAGE rewrite.
  - **First sweep result: builder-side all green** — every one of the 256 units auto-fills
    to zero pendencies, derives at all 20 levels without a crash, and exports a
    structurally clean actor. **All findings are export/import round-trip gaps**, triaged
    as `TC-0001…TC-0010` in `testing/ISSUES.md` (headline: TC-0007 — `featureoption`
    picks never export as the "<Feature>: <Option>" feat Items the import already
    understands, 54 diffs; plus import gaps for optional features, class tool/expertise
    grants, feat sub-bags, parenthesized race names, species spellAbility). Baselined in
    `KNOWN_ISSUES` so the sweep stays green while they wait — closing a TC = fix + remove
    its pattern + clean sweep. `testing/actors/` (emitted on demand) is gitignored;
    `report.json`/`COVERAGE.md`/`ISSUES.md` are committed.
- **T0 backlog BURNED DOWN (2026-07-16): TC-0001…TC-0010 all fixed — the full sweep now
  runs 256/256 with ZERO round-trip diffs in `--strict` mode** (new sweep flag that ignores
  the known-issues baseline; `KNOWN_ISSUES` and `WAIVERS` are both empty now, so ANY new
  round-trip diff fails its row again). Architecture recorded as **DDL-0028**:
  - **Native where Foundry has a slot.** `featureoption` picks now export as the premades'
    `"<Feature>: <Option>"` feat Items (`buildFeatureOptionItems`) — the existing import
    reconstructs them unchanged (TC-0007). Optional features (invocations/metamagic/
    maneuvers/arcane shots/runes/pact boons) export as feat Items with the right dnd5e
    subtype (`buildOptionalFeatureItems`) — they were entirely absent from the actor before
    (TC-0004, worse than triaged). Only the class's own `feat@<level>` slots feed the class
    ItemChoice/ASI advancement, so Champion's subclass style no longer lands on invented
    `feat@7/10` keys on import (TC-0006). `parseSpecies` resolves race-item names by EXACT
    compendium match (bases + `_versions`) before the separator heuristic — "Human (Ixalan)",
    "Dragonborn (Gem; Amethyst)" and "Variant; Gifted Aetherborn" survive (TC-0008).
    `weaponKeyToPick` returns plain names, the UI's canonical pick format (TC-0003).
    `toolId`/`languageCode` fall back to a full REVERSIBLE slug and the canonical multi-word
    names ("Dice Set" → `dice`, "Chess Set", "Playing Card Set", "Pan Flute") joined
    `TOOL_TO_FVTT` — "Hand Drum" no longer reimports as "Hand Crossbow" (TC-0001).
  - **`flags.builder5e.choices` where Foundry has no slot.** Chosen feats carry their
    sub-bag on their own Item (origin feat, class slots, species feats — TC-0002); the race
    item carries `spellAbility-N`/`size-N`/mixed pools (TC-0009 + retired the DDL-0017 size
    waiver); the class item carries the residual bag (`tool@start-*`, `expertise@*`, curated
    prose grants, subclass `sub:` grants, optional-feature picks — TC-0005). Foundry ignores
    the namespaced flag; flag-less actors (premades/Plutonium) still go through the native
    reconstruction paths, including a new name-match fallback for optional features.
  - **TC-0010 (both sides):** the species item's Trait/ASI advancements use SHALLOW picks
    only (a feat's sub-choices belong to the feat's item), and the import only back-fills a
    species skill/tool/language entry when `parseChoices(raceObj)` offers that choice.
  - **The oracle got stricter:** base `scores` joined the decision summary (validates the
    `final − boosts` reconstruction, including boosts chosen inside feat flags). Verified:
    793 tests (4 updated to the new canonical formats + 2 new: exact race names, flag
    round-trip), lint clean, sweep 256/256 strict.

### T1a session 1 — Artificer + 6 subclasses (2026-07-16)

- First Tier-1 UI session (alphabetical order): full guided create pass (Human /
  Armorer), interactive level-ups 1→4 exercising the level-up overlay (spells@2,
  subclass + Armor Model + spells@3, feat + spells@4), jump to level 19 (pendency
  badge, fixup guide, Epic Boon picker), and subclass swaps at 19 for Alchemist,
  Artillerist, Battle Smith, Cartographer and Reanimator (features, spell tables
  and granted always-prepared spells all render). Spellbook verified at 1/2/3/19
  (slots, DC/attack, counters, Tinker's Magic Mending at-will); chip popups,
  choice-title links, mobile layout and console all clean.
- **Findings logged:** TC-0011 (additionalSpells `{choose}` never surfaced — Magic
  Initiate grants nothing, structural), TC-0012 (fixed subclass proficiency grants
  don't derive — Armorer Heavy armor/Smith's Tools, Battle Smith Martial weapons),
  TC-0013 (picked feat with unfilled sub-choices escapes the ✦ badge/fixup guide —
  shallow `filled` in `fixupSteps.js`), TC-0014 (structured `resist` chooses
  unparsed — Boon of Energy Resistance), TC-0015 (guided starting kit lands
  unequipped, AC reads unarmored), TC-0017 (featureoption chip prints every
  option's full text). **Fixed in-session:** TC-0016 — ClassStep/SpeciesStep
  pickers showed raw lowercase ids ("artificer", "human"); they now use the
  resolved compendium name.
- **New helper:** `npx vite-node scripts/t1-choices.js <classId>` dumps the
  per-level choice descriptors (NEW/GROW/SPELL) a T1 session must see per
  subclass — generated from the same autoBuild/buildClassChoices machinery the
  sweep uses.
- Trackers updated: `testing/COVERAGE.md` artificer rows (4× `ui: ok`, Armorer &
  Battle Smith `ui: issues`), `testing/ISSUES.md` TC-0011…TC-0017,
  `TESTING-PLAN.md` §7 hand-off (next: Barbarian).
- **TC-0013 FIXED (follow-up, same day):** the fixup/✦ completeness is now DEEP.
  `choiceComplete` (per-choice version of the creation guide's `choicesComplete`,
  exported from `createGuideContext.js`) replaced the shallow `picks >= count`
  checks in `unfilledClassChoices` (`fixupSteps.js`) and in `FeaturesStep`'s
  `unfilledOnly` filter. A picked ASI/Epic Boon with an empty sub-bag now keeps
  the ✦ badge, stays listed in the fixup guide (rendering its embedded
  sub-choices), and blocks the level-up overlay's auto-advance until the +2/+1
  (or the boon's ability) is chosen. Bonus: ability-pool targets now respect the
  chosen alternative (+1 to two with one pick still pends). 7 regression tests
  (`fixupSteps.test.js`, 800 total); verified live on the session's Artificer 19.

## 28. Item shop: generated magic-item variants + weapon filters

- **The missing "+1 Shield" problem (2026-07-16, DDL-0025).** The shop only sold what the two
  catalog files list literally — and 5e.tools does NOT list "+1 Longsword", "+1 Shield" or any
  "Weapon of Warning": those are **specific variants** the site GENERATES at load time by
  applying the generic variants of `magicvariants.json` ("+1 Weapon", "Armor of Resistance"…)
  over every base item that matches their `requires`/`excludes` rules. Ported that expansion:
  - `GLOBAL_FILES` += `magicvariants.json` (verified 200 on the mirror; cache self-migrates).
  - New pure module **`engine/magicVariants.js`** (port of the 5etools
    `Renderer.item._createSpecificVariants` pipeline, memoized per db like `glossaryFor`):
    `requires` (OR of AND-objects, literal array/scalar matching) + `excludes` veto + the
    edition matrix (a `classic` base never takes a current variant and vice versa);
    `inherits` merge with `nameRemove`-first ordering (namePrefix/Suffix/Remove, prepended
    template entries, `conditionImmune` union, vulnerable/resist/immune uniqueness merge,
    propertyAdd/Remove, barding, weight/valueMult); **`{=prop/mods}` templates**
    (`{=bonusWeapon}`, `{=baseName/l}`, `{=dmgType}` → full damage-type name, modifiers
    l/t/u/a in 5etools order); **`[[baseItem.value]] + N` expressions** (tiny arithmetic
    evaluator — Adamantine/Silvered/Barding); and **`{#itemEntry Name|Source}` dereference**
    against `items-base.itemEntry` incl. the `{{getFullImmRes item.resist}}` function
    placeholder (Armor of X Resistance). Publication fields (`reprintedAs`, srd/page/
    lootTables) deliberately don't propagate — a leaked `reprintedAs` would make `latestOnly`
    hide the generated item.
  - **Only current variants generate** (every `edition: "classic"` variant carries an XDMG
    reprint — verified across the full dataset), over `latestOnly` base items, skipping packs
    (`packContents`) and never shadowing a REAL catalog item of the same name+source. Result
    on live data: **2701 items generated in ~80 ms**, zero name collisions, zero unapplied
    templates.
  - `resolveItemObj` falls back to the generated variants, so inventory entries, derivation,
    attunement and the **Foundry export just work** (verified: "+1 Longsword" exports as a
    weapon with `magicalBonus: 1`, "+1 Shield" as equipment with its AC Active Effect, and
    the round-trip re-imports them as catalog refs — `resolveInventorySource` in
    `foundryImport.js` also learned the variants, else they came back as custom snapshots).
    Prices derive from rarity via the existing `magicItemPrice` tables (base-item cost
    included through the inherited `baseItem` uid).
  - 19 unit tests (`magicVariants.test.js`) on fixtures mirroring the real shapes; full
    sweep still 256/256.
- **Weapon filters in the shop (same day).** The item selector gained four weapon-scoped
  filters — **Weapon Category** (Simple/Martial), **Melee / Ranged**, **Weapon Property**
  (Heavy, Light, Finesse, Two-Handed, Thrown, Firearm — the `firearm` flag folded in — etc.)
  and **Weapon Mastery** (Vex, Sap, Topple…) — so "Light weapons with the Vex mastery" is two
  clicks (filters AND across, options OR within; verified live: Handaxe / Hand Crossbow /
  Shortsword of Warning). Non-weapons carry empty values and simply drop out while a weapon
  filter is active. The Weapon Mastery picker (`weapon.js`) gained the same **Property**
  filter (it already had Category/Type/Mastery). `PROPERTY_NAMES` completed with `Vst`
  (Vestige of Divergence); property/mastery names come from the same static map the meta
  line uses (precompute has no db).

## 29. Browsable glossary page (glossary v2 — final piece)

- **The last DDL-0020 v2 backlog item (2026-07-16, DDL-0025).** The inline links let you learn a
  rule you STUMBLE INTO; the browsable glossary lets you look one up on purpose. A **"Glossary"**
  entry is now the FIRST item in the hamburger menu on BOTH the Home roster and the character
  sheet ("Search every rule, spell, item and feature"); it opens a full-screen search interface
  over EVERYTHING the app can explain.
- **Unified index** (`components/common/glossaryIndex.js`, memoized per db like the link index):
  combines the glossary rules (`engine/glossary.js` gained `glossaryEntries(db)` — one entry per
  name+type, best source — and `GLOSSARY_TYPE_LABELS`) with the entity types (reusing the now
  **exported `SIMPLE_TAGS`** from `entityLinks.js`, each given a category `label`) **plus** every
  **class and subclass feature** (walked from each `class-*.json`, since features have no flat
  pre-built list — collapsed by name+class+subclass, preferring the 2024 edition because class
  features carry no `reprintedAs` so PHB+XPHB both survive `latestOnly`). One entry shape carries
  what's needed to open the SAME preview the inline link would: `{entity, raw}` → `showDetailPopup`,
  or `{ruleEntry}` → `showRulePopup`. On live data: **~7700 entries** across 19 categories.
- **`GlossaryOverlay`** (`components/common/GlossaryOverlay.jsx` + module CSS, mounted once in
  `App` next to `DialogHost`, driven by the new `store/glossaryStore.js` Zustand singleton +
  `openGlossary()` imperative shortcut): a portal panel with a search box (autofocus), a wrap of
  category filter chips (All + each present category, single-select toggle), a live match count,
  and the results list **capped at 200 rendered rows** ("showing first N" — the full index is
  thousands; capping keeps typing instant). Tapping a row opens the entity/rule popup on the
  **DDL-0007 dialog stack**, so it layers ABOVE the glossary and the links inside it keep working
  (verified: Fireball → its own detail popup with a nested *Sphere* link; Second Wind → its rule
  popup). Mobile-first: full-screen on small widths, the row's source subtitle hides to keep the
  name + category badge clean.
- **Escape guard:** the overlay's Esc-to-close checks `dialogStore` first — with a detail/rule
  popup on top, Esc closes the POPUP (the card's own handler), not the glossary underneath.
- 9 unit tests (`glossaryIndex.test.js`: rules+entities+features in one list, background→rule,
  entity carries entity+raw, PHB/XPHB feature collapse to 2024, category order, memoization).
  774 tests + lint clean, verified live from the Home menu (desktop + mobile). This closes
  DDL-0020's v2 backlog entirely.

## 30. Glossary on the selector layout, subclasses & class progression, shop performance, spell-prepare freedom

- **Glossary UI rebuilt on the SelectorPanel (2026-07-16, DDL-0026).** The browsable glossary
  (§29) had its own one-off layout with all the category chips stacked on top. It is now a
  **`SelectorPanel` in the new `noPreview` mode**, so it inherits the exact selector UX the user
  already knows: search bar on top; on desktop a LEFT filter panel with the include/exclude
  legend, **Clear** and the **filter-search (⌕)** button; on mobile the **Filters button + the
  draggable bottom drawer** (grabber, Apply, always-visible filter search). No preview column —
  the glossary selects nothing; tapping a card calls `onSelect` directly, which opens the same
  entity/rule popup as before on the DDL-0007 dialog stack (Esc guard kept: a popup on top eats
  the Esc). **Category** (fixed options, ordered) and **Source** (derived) are ordinary panel
  filters. `GlossaryOverlay.jsx` shrank to a thin wrapper (entity config + popup routing);
  its module CSS was deleted. `SelectorPanel` gained three additive props: `noPreview`,
  `heading` (header title override) and `hint` (line under the title).
- **Subclasses joined the index.** We indexed classes, class features and subclass features but
  not the subclasses themselves. `glossaryIndex` now walks each class's `subclass` list through
  the SAME entity the subclass selector uses (`makeSubclassEntity` — dedup/latestOnly/`_copy`
  resolution included), so a "Champion" card opens the full features-by-level preview. New
  **Subclass** category (after Class); the class name is the card subtitle and is searchable.
  135 subclasses on live data (index now ~7830 entries).
- **Classes in the glossary carry the FULL progression.** A glossary-specific class entity wraps
  the selector's (`glossaryClassEntity`): the popup body appends every class feature as
  "Level N: Feature" blocks (via `engine/classProgression.classFeatureLevels`, refs resolved)
  after the class info text — like the subclass preview does. The class SELECTOR is untouched on
  purpose: newbies don't need the wall of text there; a glossary reader came exactly for it.
- **SelectorPanel performance (the shop lag).** With the generated magic variants the shop lists
  ~4300 items and the glossary ~7800 — and the panel rendered EVERY result as a DOM card at
  once, so opening, typing and every cart tap lagged. Two fixes:
  - **Chunked rendering:** results render `RENDER_CHUNK` (120) cards at a time; a 1px sentinel
    `<li>` + `IntersectionObserver` (root = the results scroller, 800px margin) loads the next
    chunk as the scroll approaches it. The chunk count resets on REFINEMENT (query/filters/
    entity/db — via render-adjust, not an effect) but deliberately NOT on `results` identity:
    the shop's `exclude` closure changes on every cart tap and would have snapped the scroll
    back to the top.
  - **Card-data cache:** `entity.card()` results are memoized in a module `WeakMap` keyed by the
    precomputed item wrapper (wrappers are rebuilt exactly when entity/db change) — the shop's
    card calls `itemValue` (derived magic-item pricing), which used to run for every item on
    every keystroke.
  - Measured live: shop open with 4264 results renders 120 cards; a search keystroke ~115 ms;
    cart stepper taps instant. The glossary gets the same cap for free.
- **Spell prepare: the class/level scoping is now FILTERS, not locks (both flows).** The
  Spellbook's "Prepare spell" hid every spell above the origin's max circle and every full
  bucket via `exclude`; the creation guide's `SpellPicker` was fully locked to the class list +
  exact level. Per the user: the DM can allow off-list or off-circle spells, so the default view
  must be achievable with REMOVABLE filters, like items/feats. Now:
  - `exclude` only dedups what's already prepared/chosen.
  - The **Level filter comes pre-marked** on the buckets with room (Cantrip when cantrips have
    space, 1..maxPrepareLevel when prepared has space, free arcanum circles) alongside the
    already-filter-based **Class** — same default view as before, but every chip can be unmarked.
  - Anything off the default **confirms on add** (single dialog listing the reasons): off-list
    (the old R10 confirm), no free cantrip/prepared slots (counts shown), no slots or free
    arcanum of that circle; the guide's picker warns off-list and off-step-range adds. The
    "Prepare spell" button still disables when every bucket is full (R11).
- Verified live end-to-end (desktop + mobile): glossary filters/drawer/chunked scroll, Champion
  & Fighter popups, shop cart + search, Wizard 3 prepare (Cantrip/1st/2nd + Wizard pre-marked;
  3rd-circle Fireball asked "no spell slots… of the 3rd level" and landed in the tab), guide
  cantrip step (Cantrip + Wizard pre-marked; 1st-level pick asked "This step picks cantrips…").
  776 tests (2 new in `glossaryIndex.test.js`), lint clean.

## 31. Glossary completeness (XDMG/gendata rules, rule-type categories, rules-first ordering) + choice titles as links

User request (2026-07-16), four parts: (1) the glossary was missing the XDMG rules; (2) make sure
reprinted 2014 rules don't show; (3) categorize rules (core/optional/variant/variant optional)
with the mini-tag treatment; (4) reorder the browsable glossary rules-first; plus (5) the Class
tab's choice selector titles should open the feature's text like any glossary link.

- **XDMG (and every other book-extracted) rule now loads.** 5etools' own Rules Glossary page
  concatenates `variantrules.json` with `data/generated/gendata-variantrules.json` — the 13
  book-extracted rules (9 XDMG: Firearms, Explosives, Alien Technology, Renown…; plus XPHB
  Multiclassing/Weapon Mastery Properties, TCE Parleying with Monsters, XScreen Death Saving
  Throws) live ONLY in the gendata file. Added it to `buildManifest` (verified 200 on the mirror;
  the cache self-migrates) and merged it into `buildGlossary`. With it, our glossary covers the
  same rule list as 5etools' Rules Glossary tab.
- **Reprint filtering fixed for RENAMED reprints.** Same-name reprints already collapsed to the
  2024 edition (pickBySource), but a rule/action reprinted under a NEW name showed both editions
  (PHB "Use an Object" → XPHB "Utilize"). `glossaryEntries` (the browsable list) now drops any
  entry with `reprintedAs` (latestOnly semantics). The lookup INDEX stays complete on purpose:
  legacy prose citing `{@action Use an Object|PHB}` still resolves (never a dead link).
  `pickBySource` also learned the XDMG/DMG rungs (xphb > xdmg > phb > dmg > first) — diseases
  exist in both DMGs.
- **Rule-type categories.** variantrule entries carry `ruleType` (C/O/V/VO); the normalized
  glossary entries keep it and `ruleCategoryLabel(entry)` (engine/glossary) maps it to Core
  Rule / Optional Rule / Variant Rule / Variant Optional Rule (absent → plain "Rule").
  The RulePopup badge and the browsable glossary's Category filter/badges both use it — one
  source for the label. Fidelity note: the labels come straight from the data; 5etools tags the
  XDMG book sections as Core (`C`), so e.g. Firearms shows "Core Rule", matching their site.
- **Rules-first ordering.** `CATEGORY_ORDER` now sorts the browsable glossary: Core Rule →
  Condition/Status/Disease/Action/Skill/Sense → Optional/Variant/Variant Optional/Rule →
  Weapon Property/Mastery → the entities (Spell, Item, Feat, …). Alphabetical within each.
- **Choice selector titles are glossary links (Class tab + wizard steps).** Choice descriptors
  now carry `feature: {name, level, subclass?}` (set by `classFeatureChoices`/`featureOptions`
  generators — ASI/Epic Boon/Fighting Style/Expertise/Weapon Mastery, curated grants, optional-
  feature progressions, sub-feature options). `buildClassChoices` resolves it to the SAME target
  an inline `{@classFeature}`/`{@subclassFeature}` link opens (via `lookupEntityLink`, exact
  level then name-only fallback) and attaches `ruleEntry`; ChoiceList renders the title as a
  link-styled button (dotted underline, like inline rule links) opening `showRulePopup`. No
  match (or no source feature — e.g. starting Skill Proficiencies) → plain text, never a dead
  link. The wizard's Features/Proficiencies steps get the links for free (same builder).
- Verified live (Barbarian: Weapon Mastery / Primal Knowledge - Skill / Level 4 - Feat titles
  all open the right feature popup with nested links; glossary shows Core Rules first, Firearms
  XDMG present, "Use an Object" gone, "Utilize" present; category filter chips in the new
  order). 786 tests (10 new: gendata merge, renamed-reprint filtering, ruleCategoryLabel,
  category order, `feature` on descriptors, ruleEntry attachment in `classChoices.test.js`),
  lint clean, sweep 256/256.

## 32. Glossary filters: intuitive rule categories + alphabetical filter list (item order unchanged)

User request (2026-07-16). Two adjustments to the browsable glossary's filter panel, on top of §31.

- **Only four rule filters, and they overlap sensibly.** The Category filter used to expose all
  five display labels (Rule / Core / Optional / Variant / Variant Optional Rule), which made the
  filters unintuitive. Now the FILTER options for rules are just **Rule, Core Rule, Variant Rule,
  Optional Rule** — no separate "Variant Optional Rule" chip. A new `ruleFilterCategories(entry)`
  (engine/glossary, beside `ruleCategoryLabel`) gives each rule its filter memberships, distinct
  from its display badge: every rule joins **"Rule"** (so that chip shows ALL rules), and a
  **Variant Optional** rule joins **both** "Variant Rule" and "Optional Rule" (deliberate double
  count). The card/popup badge still reads "Variant Optional Rule" — only the filters changed. The
  glossary entity's `filterValues.category` is now the entry's `filterCategories` array (a card can
  match several category chips), leaning on the existing OR-within-a-filter semantics.
- **Filter chips are alphabetical again.** The Category filter list is now sorted alphabetically
  (Action → Weapon Property), derived from the entries' filter categories, instead of following the
  custom rules-first order. That custom order (Core Rule → game glossary [Condition/Status/Disease/
  Action/Skill/Sense, interleaved alphabetically by name, no category grouping] → other rules →
  the rest [alphabetical by name, no grouping]) now applies ONLY to the LIST OF ITEMS in the panel,
  via a small tier function in `buildIndex` — replacing the single `CATEGORY_ORDER` rank that had
  driven both. `CATEGORY_ORDER` is retired.
- Verified live: the Category chips read alphabetically with exactly the four rule filters and no
  "Variant Optional Rule"; selecting "Optional Rule" surfaces the 16 Variant-Optional entries
  (badge intact) alongside the plain Optional ones; the item list still leads with Core Rules.
  791 tests (6 new: `ruleFilterCategories` in `glossary.test.js`; filterCategories/alphabetical-
  filters/item-tier-order in `glossaryIndex.test.js`), lint clean.

## 33. Choice-kind completeness: additionalSpells chooses, fixed subclass grants, damage-trait & HP-max effects (TC-0011…TC-0018)

**2026-07-17 — the whole T1a-session-1 backlog closed in one batch (DDL-0029).** The common
root was DDL-0002's "Problem 1/2" family: 5etools encodes a kind of choice or grant that
`parseChoices`/the derivation didn't recognize yet. Every gap below now has a selector, a
derivation, an export encoding and an import reconstruction — sweep still 256/256 `--strict`.

- **TC-0011 — spell chooses (`additionalSpells {choose}`) are real choices now.**
  `grantedSpells` emits Choice descriptors and consumes the picks from the owning bag:
  - Multiple `additionalSpells` entries are **alternatives** ("choose a list" — Magic
    Initiate's Cleric/Druid/Wizard; Path of the Giant's Druidcraft-or-Thaumaturgy). A
    `spellSet` select picks the list; only the ACTIVE group grants/generates (before, all
    groups merged — itself a latent bug). Changing the list discards the sibling spell picks.
  - Each `{choose}` leaf becomes a `spell` Choice: filter expression ("level=0|class=Cleric",
    parsed by `parseSpellChooseFilter` — level/class/school/ritual/spell-attack conditions) or
    closed `{from}` list; `spellChoosePredicate` (engine/spells) turns the pool into an
    eligibility predicate over the spell catalog. Picks are granted with the leaf's own cast
    mode/frequency (Magic Initiate: cantrips `known`, the level-1 spell innate 1/day).
  - Consumers: `parseChoices(entity, {level, bag})` (races, feats — level gates the
    `additionalSpells` level keys, e.g. Ritual Caster XPHB unlocks at 1/5/9/13/17);
    `buildClassChoices` for class/subclass grants (`class:`/`sub:` id prefixes, same class
    bag); ChoiceList's new `SpellChoice` (chips + SelectorPanel restricted to the predicate;
    chip tap opens the spell's DetailView); deep completeness (`choiceComplete` gained a
    `level` param), fixupSteps, autoBuild, and the Foundry export/import flags (species/feat
    sub-bags + `residualClassChoices` carry the new kinds automatically).
- **TC-0012 — fixed subclass proficiency grants derive.** New curated
  `engine/subclassGrants.js` (`SUBCLASS_GRANTS`, from a full class-*.json sweep):
  armor/weapons/skills/fixed-expertise/tools/languages/saves per subclass, source-
  disambiguated (Alchemist EFA×TCE, Assassin PHB×XPHB…). Wired into `deriveFromDb` (with
  `ownedFromDb` dedup so selectors don't reoffer what's granted), `deriveCharacter`
  (expertise level 2; saves join `proficientSaves`) and the actor Traits. The conditional
  halves ("if you already have this proficiency, choose another…") became LIVE choices —
  `subclassConditionalChoices` generates `sub:cond-*` descriptors against the character
  (replacement artisan tool; alternate save — new `save` kind; alternate skill). The same
  sweep completed `SUBCLASS_FEATURE_GRANTS` (Blessings of Knowledge PHB×FRHoF, Cavalier/
  Samurai skill-OR-language as a new `mixed`-kind with `fromByKind`, Kensei's closed tool
  list, Mastermind, Acolyte of Nature, Arcane Archer Lore, Bladesinger FRHoF…), and the
  subclass-version gate (`subclassSource`) stops reprinted subclasses from double-generating.
  Old DDL-0002 deferrals closed en passant: Monk's "artisan OR instrument" is ONE selector
  with merged categories (`classToolChoices` treats separate array entries as alternatives);
  the expertise pool includes AUTO-granted skills; tool selectors merge `items-base` +
  `items.json` (gaming sets and half the kits live only in the latter — toolEntity and the
  import's `toolKeyToName` both fixed).
- **TC-0014 — structured damage-trait chooses.** `parseChoices` reads
  `resist`/`immune`/`vulnerable` `{choose}` entries → list Choices rendered as toggle
  PILLS (`PillsChoice`, shared with the `save` kind). New `engine/damageTraits.js` derives
  the character's resistances/immunities/vulnerabilities from race (lineage-aware), feats
  (fixed strings + chosen picks in every bag) and equipped/attuned items (kept separate in
  `fromItems`); the Proficiencies card shows them; the actor exports character-own traits
  in `traits.dr/di/dv` while items carry their own transfer Active Effect
  (`itemBonusEffect` now emits structured item resist/immune/vulnerable). Prose-conditional
  entries (objects without `choose`) deliberately stay prose.
- **TC-0018 (new, found in this batch's live pass) — curated HP-max increases.** Tough
  (+2×character level), Boon of Fortitude (+40), Dwarven Toughness (Dwarf XPHB / Kaladesh,
  +1×level) and Draconic Resilience (+1×sorcerer level, PHB and XPHB equal) were inert.
  New `engine/hpBonuses.js` (curated, from a tag-aware dataset scan) → `deriveHpBonus`
  feeds `maxHp`; the export writes per-character-level rates into the NATIVE
  `hp.bonuses.level` (survives Foundry level-ups) and the rest (flat + per-class-level)
  into `hp.bonuses.overall`; the import subtracts the re-derivable part so `hpBonus`
  round-trips as the player's manual adjustment only.
- **TC-0015 — guided starting kit auto-equips.** `startingKitInventory(option, db)` marks
  kit armor and weapons `equipped`; the finished guided sheet reads the real AC.
- **TC-0017 — featureoption collapse.** Once complete, unchosen option cards shrink to
  name-only buttons (still tappable to swap); the chosen option keeps its full text.
- **TC-0013/0016** were fixed in the previous session (deep `choiceComplete`; picker labels).
- Verified: full guided Artificer create (Magic Initiate spells + kit equip + AC 13),
  level-ups 1→4 with the fixup overlay (Armorer conditional tool + Armor Model collapse +
  Heavy Armor/Smith's Tools on the card), Epic Boon at 19 (resistance pills → card), HP 174
  with Tough at 19, mobile width, zero console errors. 831 unit tests (hpBonuses,
  damageTraits, subclassGrants, grantedSpells chooses, startingEquipment auto-equip,
  fixupSteps), lint clean, sweep 256/256 `--strict`.

## 34. Subraces as lineages + per-weapon proficiency (Kensei) + the known deferred backlog

**2026-07-17 (2) — the rest of DDL-0029's out-of-scope list, closed or explicitly filed
(DDL-0030).**

- **Subraces (5etools `subrace` entries) merge into the app as LINEAGES.**
  `engine/speciesData.js` gained `subraceVersions(db, race)` — a faithful port of the
  5etools merge (`Renderer.race._getMergedSubrace`): merged name incl. the parenthesized-base
  join ("Human (Innistrad; Stensia)"), positional ability merge, entries append with
  `data.overwrite` replacement, traitTags/languageProficiencies concat, skillProficiencies
  merge, everything else overriding — memoized per db. `raceLineages(db, race)` (= `_versions`
  + merged subraces) replaced `expandRaceVersions` at every lineage consumer: SpeciesTab,
  SpeciesStep, createGuideContext (deep completeness demands the lineage), the lineage picker
  entity, `resolveRaceObj`, the sweep matrix and the Foundry import's exact/keyword name
  resolution. Nameless subraces (no mechanics in the dataset) and subraces carrying their own
  `reprintedAs` (ERLW dragonmarks) are skipped — the same latestOnly semantics as everywhere;
  subraces of a reprint-hidden BASE (Hill Dwarf PHB…) remain unlisted by that same policy.
  Race fixed `weaponProficiencies`/`armorProficiencies` now derive too (autoProficiencies) —
  several subraces grant them (Zendikar elves). Net: **18 new sweep rows** (Genasi MPMM ×4,
  Human (Innistrad) ×4 incl. Stensia, Merfolk ×5 / Goblin ×4 / Vampire ×2 PSZ, Aven ×2,
  Elf (Kaladesh) ×2 / (Zendikar) ×3, Shifter EFA ×4, Half-Elf/Half-Orc PHB variants),
  **274/274 `--strict`**. Verified live: Genasi picks an Air/Earth/Fire/Water lineage, the
  merged traits render (Unending Breath, Mingle with the Wind with working spell links),
  speed 35 and Lightning resistance derive to the card, and the subrace's spellcasting-ability
  choice appears via the ordinary TC-0011 machinery.
- **Per-weapon proficiency = new `weaponProf` choice kind (Kensei).** Dataset-verified as the
  ONLY reachable case (Hobgoblin VGM, Weapon Master PHB and Bladesinging TCE are all
  reprint-hidden; Bladesinger FRHoF grants a fixed blanket prof already in SUBCLASS_GRANTS).
  The Kensei registry entry emits melee+ranged choices at level 3 and one any-type at 6/11/17
  — `grantChoices` gained per-grant `level` (unlock gating), `tag` (id disambiguation) and
  `label`. Pools carry `weaponFilter` ({kind, noProps, allow}) enforced by
  `weaponFilterAllows` (engine/choices) in ChoiceList and autoBuild — RAW-faithful: simple/
  martial without Heavy/Special, Longbow explicitly allowed. Picks derive as proficient
  weapons and export natively: `KNOWN_WEAPON_NAMES` maps individual mundane weapons onto
  dnd5e `weaponProf.value` ids (this also moved fixed one-weapon grants — Bard Swords'
  Scimitar — out of `custom`). Verified live at Monk 19/Kensei: 5 selectors ordered by level,
  melee list = 21 (no Heavy, no ranged), ranged list = 9 (Longbow in, Net/Heavy Crossbow
  out), a Longsword pick lands on the Proficiencies card.
- **Grants inside featureoption OPTIONS: verified unreachable, documented instead of built.**
  The only real instance (Totem Warrior "Tiger" L6, SCAG) sits on a subclass reprint-hidden
  behind Wild Heart XPHB; every other option-with-proficiency hit in the scan is a structural
  sub-entry already covered by the registries. Filed in subclassGrants.js + DDL-0030 for the
  hypothetical legacy-toggle future.
- **Known deferred backlog** now has a single home (CLAUDE.md §4 subsection, pointed to from
  the README): compendium UUIDs (DDL-0001), E5 PDF polish, sidekick/UA classes, the optional
  foundry-*.json overlay adoption (DDL-0009), high-level-create guide ordering, and the
  legacy-content toggle idea.
- Verified: 842 unit tests (kensei grants, weaponFilterAllows, subrace merge/lineages), lint
  clean, sweep **274/274 `--strict`**, live browser pass, zero console errors.

## 35. Foundry overlay adoption: upstream Active Effects back the curated registry (DDL-0031)

**2026-07-17 (3) — known-deferred-backlog item 4 done: the 5etools `foundry-*.json` mechanics
overlay (DDL-0009, MIT) now backs `engine/foundryEffects.js` at runtime.**

- **Four overlay files join the manifest** (each verified 200 on the live mirror, byte-equal
  to the local snapshot): `foundry-feats.json`, `foundry-races.json`,
  `foundry-optionalfeatures.json` and `class/foundry.json` (key `foundry-class`).
  `foundry-backgrounds.json` stays out (404 — Plutonium-only, per DDL-0009) and
  `foundry-psionics.json` is an empty `{}` upstream. The sweep/PDF loader (`scripts/lib/
  loadDb.js`) reads the same manifest from the local snapshot, so tooling got them for free;
  the IndexedDB cache self-migrates (a cached db missing the new keys refetches).
- **New pure module `engine/foundryOverlay.js`** — per-db WeakMap index (the `glossaryFor`
  pattern) over the four files, and the overlay→dnd5e translation the raw data needs:
  string `mode` ("ADD"/"OVERRIDE"…) → Foundry numeric modes; non-string `value`
  (boolean/number/object) → string (objects as JSON); **absent `transfer` = `false`**
  (an "on-use" effect the player toggles — the Plutonium converter's semantics, NOT
  Foundry's default-true); `type:"enchantment"` effects and enchantment riders skipped;
  non-actor change keys (anything outside `system.`/`flags.`) skipped; and **changes to
  `system.attributes.hp.bonuses.*` DROPPED** — max-HP bonuses already export natively via
  `engine/hpBonuses.js` (actor `hp.bonuses.level/overall`), so an Active Effect would double
  them (Tough, Dwarven Toughness, and the HP half of Draconic Resilience — its AC half
  survives). Effects left empty by the filters are discarded whole.
- **Lookups are edition-strict** (name+source for feats/optional features; name+class[+
  subclass shortName]+source for features, exact level preferred then lowest) — a PHB overlay
  entry never decorates an XPHB feature.
- **Wire-in (`engine/foundryItems.js`), curated-first all-or-nothing:** a feature/feat with
  ANY entry in `foundryEffects.js` (changes or target effect) keeps exactly the curated
  output — the registry was validated against real premades and is what the activities
  reference; the overlay only fills features with NO curated entry. `buildFeatureItem` gained
  an optional `db` (plus `feature.subclass` routing to the subclassFeature index and
  `feature.overlayName` so a featureoption item "Divine Order: Thaumaturge" looks up
  "Thaumaturge"); `buildFeatItem` gained `opts.db`; optional-feature items look up their own
  index; and the SPECIES item now carries the overlay effects of its traits (we emit no
  per-trait items — a transfer effect on any embedded item applies to the actor), gated on
  the trait actually existing in the resolved race's entries (lineage-aware) and looked up by
  merged name first, then `_baseName`.
- **Net effect on an exported actor** (verified against the real dataset): Rage exports its
  official toggle effect (damage bonus `@scale.barbarian.rage-damage`, physical resistances,
  Str advantage riders), Danger Sense/Reckless Attack/Innate Sorcery/Misty Escape and ~130
  more class/subclass features gain effects, invocations and other optional features gain
  theirs (One with Shadows, Master of Myriad Forms…), feats like Alert/Lucky/War Caster gain
  their flags, and race items carry Halfling Luck, Goliath Powerful Build/Large Form, Dwarf
  Stonecunning etc. The import is untouched (it never reads `effects`), so the round-trip is
  unchanged.
- Verified: 860 unit tests (18 new in `foundryOverlay.test.js`: translation, filters,
  edition-strictness, precedence, race/subclass/featureoption routing), lint clean, sweep
  **274/274 `--strict`**, and a real-data spot check (Barbarian/Halfling, Sorcerer Draconic/
  Dwarf, Warlock Archfey/Goliath) confirming the effects above land on the right items.

## 36. Glossary links on choice titles everywhere (kind fallback) + Background section title

Extends DDL-0027's "choice titles are glossary links" from the Class tab to EVERY tab
(user request 2026-07-17: make the inline glossary present on the Species and Background
tabs too). See DDL-0032.

- **Kind-based rule fallback (`components/builder/choiceRules.js`)** — a choice descriptor
  whose title has no feature-specific `ruleEntry` (the DDL-0027 attachment from
  `buildClassChoices`) now falls back to the glossary rule that explains its KIND:
  `size` → Size (XPHB), `skill` → Skill (XPHB), `expertise` → Expertise (XPHB), `tool` →
  Tool Proficiencies (XGE), `save` → Saving Throw (XPHB), `resist`/`immune`/`vulnerable` →
  Resistance/Immunity/Vulnerability (XPHB). Applied at the single choke point —
  `ChoiceList`'s title render (`choice.ruleEntry ?? kindRuleEntry(db, kind)`) — so the
  Species tab, Background tab, feat sub-choices and every wizard step got the links with no
  per-site wiring. Kinds deliberately unmapped: `language` (no glossary rule exists),
  `weapon`/`weaponProf`/`feat`/`featureoption`/`optionalfeature` (always born from a
  feature, which attaches the specific link), `spellAbility`/`spellSet`/`mixed` (ambiguous).
  The feature-specific link always WINS (Fighter's Weapon Mastery still opens the class
  feature, not a generic rule); a missing rule degrades to plain text, never a dead link.
- **Background "Ability Score Boosts" title links the "Ability Score and Modifier" (XPHB)
  rule** — the section h3 (not a ChoiceList title) renders as a link-styled button via the
  new `namedRuleEntry(db, 'Name|Source')` helper + a `.titleLink` style mirroring
  ChoiceList's `.labelLink` affordance at h3 size. Degrades to plain text when the rule is
  absent from the db.
- Net effect on the two requested tabs: Species' **Size** selector title opens the XPHB Size
  rule (and "Choose any skill" opens Skill); Background's **Skill Proficiencies**, **Tool
  Proficiency** and **Ability Score Boosts** titles open Skill (XPHB), Tool Proficiencies
  (XGE) and Ability Score and Modifier (XPHB); "Language" and "Choose a feat" stay plain.
  Bonus: the Class tab's starting "Skill Proficiencies" (no granting feature, so it had no
  link before) now links the Skill rule too.
- Verified: 866 unit tests (6 new in `choiceRules.test.js`), lint clean, and a live browser
  pass (all five links above open the right popup with the Core/Optional Rule + source
  badges; Weapon Mastery precedence intact; Esc/X close as before; no console errors).

## 37. Phase T - T1a session 2: Barbarian + all 10 subclasses (TC-0019…TC-0022)

Second Tier-1 UI session (TESTING-PLAN §4): full guided create pass (Human/Tough/Skilled →
Barbarian), interactive level-ups 1→4 through the overlay (subclass@3 + Primal Knowledge +
Rage of the Wilds; ASI + mastery growth@4), jump to 19 (badge + fixup guide: Aspect@6,
ASIs@8/12/16 incl. the "+1 to two" alternative and Sentinel's restricted Str/Dex list,
Power of the Wilds@14, mastery 3→4, Epic Boon@19), subclass swaps at 19 for the other nine,
Spellbook checks (Wild Heart rituals@3+10, Giant cantrip@3, Ancestral Guardian 1/Rest@10),
chip popups, choice-title links, mobile width, zero console errors. HP math validated the
DDL-0029 hpBonuses live (Tough on a d12 chassis: 16 @1 … 233 @19). Findings, all but one
fixed in-session (see `testing/ISSUES.md`):

- **TC-0019 (bug, fixed)** - Storm Herald's **Storm Aura environment choice had NO
  selector**: its `options`+`refSubclassFeature` block was treated as the grant-all family
  (DDL-0002's Genie/Psi Warrior/Soulknife call), but the prose says "Choose desert, sea, or
  tundra". One curated line (`'storm aura'` in `CHOOSE_ONE_FEATURES`) turns it into the
  standard featureoption (Desert/Sea/Tundra cards, TC-0017 collapse, sweep autofills it).
  Storm Soul@6/Raging Storm@14 correctly FOLLOW the choice (no selectors of their own).
- **TC-0020 (bug, fixed)** - the ✦ badge counted fixup **steps** (max 3/class), not
  decisions: a Barbarian 19 with 7 open choices showed "1 choice left".
  `fixupPendencyCount` now sums unfilled choices (+1 subclass, +1 spells).
- **TC-0021 (bug, fixed for Barbarian)** - the **Weapon Mastery pool ignored per-class
  restrictions**: a Barbarian could master a Blowgun (text: "Simple or Martial MELEE
  weapons"). New curated `MASTERY_FILTERS` map feeds the existing `weaponFilter` machinery
  (DDL-0030) through ChoiceList + autoBuild; Rogue's "Martial with Finesse/Light" variant
  needs a conditional filter semantics and is deferred to its own T1 session.
- **TC-0022 (open, needs-user-eyes)** - feat ability increases **don't enforce the score
  cap 20** (GWM+Sentinel pushed Str 19→22 before the Epic Boon; RAW both cap at 20, boons
  at 30). Logged for a product decision - may be intended freedom like DDL-0026's
  over-preparing.
- Cosmetic fixes in-session: SpeciesTab/ClassTab picker labels showed the lowercase id
  ("human", "barbarian" - TC-0016's family, now the resolved/capitalized name); the inline
  `{@table}` tag now honors its 3rd-pipe display ("three skills or tools", not "three Skill
  List; Skills" - deliberately NOT generalized to `{@filter}`, whose display is the 1st
  segment); the Spellbook row no longer doubles the "Ritual" chip when the grant's cast
  type already says Ritual (Wild Heart's Animal Speaker); `scripts/t1-choices.js` no longer
  hides a choice whose declared level differs from the level it appears at (Giant's
  spellSet was invisible to the helper).
- Verified: 869 unit tests (4 new), lint clean, sweep **274/274 `--strict`**, live browser
  pass (desktop + mobile). Coverage: all 10 `class:barbarian/*` rows → `ui: ok`
  (TC-0022 noted).

## 38. Ability score cap (TC-0022) + species natural armor (Tortle/Autognome/Warforged)

Two rules-accuracy fixes (DDL-0034).

**TC-0022 CLOSED - feat ability increases respect the score cap.** RAW, a regular feat/ASI
raises a score "to a maximum of 20"; Epic Boons "to a maximum of 30". The engine summed all
boosts blindly, so GWM+Sentinel could push Str past 20. The 5etools data already encodes the
ceiling (`ability[].max` = 30 on Epic Boons, absent = 20), so:
- `engine/abilities.js` `finalScores` now applies each boost SEQUENTIALLY, lowest cap first
  (regulars before boons), never exceeding the boost's own cap and never lowering a score
  already above it (a hand-set base is preserved). So a regular feat empacado em 20 wastes
  the point while a later Epic Boon still lifts 20→21.
- The cap per boost is the 5etools `max` (`choices.parseAbilityField`/`fixedAbilityBoosts`
  carry it). For CHOSEN boosts, the pick stored is only `{ability, amount}`, so the cap is
  **injected at derive time** from the feat's own data: `resolve.withAbilityCaps` walks the
  feat sub-bags, reads each feat's `ability.max`, and back-fills `max` onto its ability picks
  on a clone (never mutating saved state). This is the SINGLE source of the cap and works for
  characters saved before the fix - no re-pick needed.
- Round-trip: the derived (now capped) final score is what the Foundry actor exports, and
  `base = final - Σamounts` stopped being reversible once capping can saturate. So the actor
  now carries `flags.builder5e.scores` (the base scores, lossless); the import reads it when
  present and falls back to the boost-subtraction for flag-less actors (premades/Plutonium).
- Verified live on the T1a Barbarian 19 (Boon of Irresistible Offense now lifts Str past the
  regular-feat cap, without editing the saved picks); 12 new tests.

**Species natural armor - three distinct patterns.** Tortle/Autognome/Warforged define AC in
prose; none derived before. New curated `engine/naturalArmor.js` (edition-strict, current
versions only): **flat** (Tortle MPMM: base AC 17, Dex ignored, shield still adds),
**unarmored** (Autognome AAG: 13 + Dex when no armor, competes with class Unarmored Defense -
the highest wins), **bonus** (Warforged EFA: +1 AC, armored or not). `deriveArmorClass` takes
the pattern (resolved in `resolve.js`) and folds it into a max-of-candidates base + shield +
item bonuses + the flat bonus. Foundry export: the same AC Active Effect the overlay uses
(`ac.calc=custom`+`ac.formula`, or `ac.bonus`), emitted from the curated registry so it works
for the current editions the overlay's `raceFeature` only has under old sources (TTP/ERLW);
the overlay's own AC change for the race is pruned to avoid doubling (Autognome AAG is covered
by both). 11 new tests; end-to-end AC 17/13/15 confirmed on the sheet + export.

- Verified: 888 unit tests (+19), lint clean, sweep **274/274 `--strict`**, live browser pass.

## 39. Guide review rows fully clickable + class removal resets the level

Two small UX/behaviour fixes.

**Review screen: the whole row is clickable, badge included.** In the creation guide's Review
screen each row jumps back to its step, but only the title/subtitle were the button — the
state badge ("Done" / "Needs a choice" / "Optional") sat outside it, so tapping the badge did
nothing (unintuitive). The badge now lives INSIDE the jump button (`Wizard.jsx` `Review`), the
row is a single full-width button (`.reviewRow` no longer flex; `.reviewJump` is the flex row
with a `.reviewText` column + the badge, plus a subtle hover background), so clicking anywhere
on the row — title, subtitle or badge — jumps to that step. Verified live: clicking the
"Needs a choice" badge on the Species row opened the Species step.

**Removing a class resets its level and everything derived from it.** Clicking × on the class
(the original slot's Clear) used to keep the entry's `level` (and `hitPoints`/`spells`), so the
character kept the old class's level and a newly-picked class inherited it (e.g. clear a
Fighter 2 → pick Wizard → "Wizard 2"). Now `clearClass` (both the Class tab and the wizard's
ClassStep) fully resets the entry — `level:1`, `subclass`, `choices`, `hitPoints`, `spells` all
back to defaults. The level is preserved ONLY on a **direct swap** (picking a different class
over an existing one via the selector — `doPickClass` is unchanged); an explicit removal keeps
nothing from the excluded class. Verified live: clear Fighter 2 → total level back to 1 → pick
Wizard → "Wizard 1".

- Verified: 892 unit tests, lint clean, live browser pass (both flows above).

## 41. Good-citizen data usage: attribution footer + incremental (SHA-diff) sync

Two changes to be gentler on the 5e.tools GitHub mirror we fetch from, and to credit it.

**Discreet attribution footer on Home.** A small muted footer (11px, `.attribution` in
`Home.module.css`) credits the data source (5e.tools) and the SRD 5.2 content licence (CC BY
4.0, © Wizards of the Coast), with an unofficial-fan-tool disclaimer. Links open in a new tab
(`noopener noreferrer`).

**Incremental sync — download only the files that actually changed.** Previously, every cache
expiry (30 days) or incompleteness re-downloaded ALL ~74 files (~16 MB) unconditionally. Now
the refresh only downloads files whose content changed on the mirror:

- **Why not HTTP conditional requests?** The ideal `ETag`/`If-None-Match` → `304` is **blocked
  by CORS** on `raw.githubusercontent.com`: it doesn't expose the ETag header to JS, and a
  custom `If-None-Match` triggers a preflight that 403s (verified empirically). So we use the
  **GitHub API** (CORS-open; 60 req/h **per user IP**, we do ~5 per 30 days).
- **`data/config.js`**: `githubRepoFromMirror` parses owner/repo/branch from the primary mirror
  (null → sync disabled, falls back to full download); `contentsApiUrl`, `dataCommitApiUrl`,
  `manifestDirs` build the API calls.
- **`data/fetcher.js` `fetchRemoteShas`**: asks the Contents API (one call per used directory:
  data, data/class, data/spells, data/generated) for each file's git blob SHA + the latest
  commit touching `data/`. `syncCompendium`: **fast-path** (same `data/` commit + complete
  cache → 0 downloads), else **per-file diff** (download only changed/missing SHAs), else
  **full-download fallback** if the API is unusable — never worse than before.
- **`data/cache.js`**: stores the blob SHA per file (a non-indexed `sha` on each compendium
  row, no schema bump) + the `data/` commit in `kv`; `readCache` returns them, `writeCache`
  persists them (the full merged set is always written — the "incremental" is only in what's
  downloaded). `forceCacheUpdate` clears these too, so a manual update re-downloads everything.
- **`hooks/useDataEngine.js`**: the boot refresh calls `syncCompendium` with the cached
  SHAs/commit; the happy path (fresh + complete cache) still does ZERO network. Legacy caches
  (no stored SHAs) do one full download, then every later refresh is incremental.

Verified: 12 new tests (`config.test.js`, `fetcher.test.js` — cold start, per-file diff,
fast-path, incomplete cache, API-failure fallback), 908 total, lint clean. **Live integration
probe against the real API + repo:** all 74 manifest SHAs resolved, real `data/` commit
resolved, and a simulated 1-stale-file diff downloaded exactly that one file (73 reused). The
app still boots to READY from the legacy (SHA-less) cache with no errors.

## 40. SRD 5.2 tables in the glossary (PHB/DMG/MM 2024 free-rules tables)

The browsable glossary now includes the reference **tables** from the 2024 free rules (SRD
5.2) — Skills, Weapons, Armor, Coin Values, Typical DCs, Travel Pace, Schools of Magic, etc.
Players can look them up alongside the conditions/actions/rules already there; many carry
useful rule descriptions and concepts.

**Which tables, and why these.** 5etools marks each free-rules table with `srd52: true` in
`generated/gendata-tables.json` — that flag IS the definition of "belongs to the free rules",
so it's the filter. Of the ~2300 book-extracted tables, exactly **49** carry it (42 XPHB, 4
XDMG, 3 XMM). `engine/glossary.js` `glossaryTables(db)` normalizes each into the same shape as
a rule (`{ type:'table', name, source, entries:[table] }`), using the table's clean `caption`
("Skills") as the display name rather than the compound gendata `name` ("Skill List; Skills").
The table itself is the popup body (`type:'table'` → `renderTable`).

**Data layer.** `generated/gendata-tables.json` added to the manifest (`data/config.js`,
verified 200 on the mirror; 2.8 MB — same order of magnitude as the already-loaded
`items.json`, cached 30 days). Only the 49 srd52 tables surface; the rest just sit in the
cache.

**Ordering (user request).** In the glossary panel's custom item order, tables sit **above**
the optional/variant/other rules but **below** the game glossary (conditions, actions, skills,
senses…) and core rules — they're more relevant than non-core rules, less than the core
glossary. New tier in `glossaryIndex.js` `itemTier` (core → game glossary → **tables** → other
rules → the rest). A new "Table" category filter appears alphabetically (between "Subclass
Feature" and "Variant Rule").

**Table rendering improved (benefits all tables app-wide).** `EntryContent` `renderTable` now
handles two fields it previously dropped: **`colLabelRows`** (multi-row headers, whose cells
can be `{type:'cellHeader', width}` objects → `colSpan`) so a table like Travel Pace renders
its "Distance Traveled Per… / Minute / Hour / Day" two-row header, and **`footnotes`** (small
italic rows under the table).

- Verified: 896 unit tests (+8), lint clean, live browser pass — Coin Values renders its
  Coin / Value-in-GP header + 5 rows in the popup; Travel Pace's two-row header renders with
  the correct colspan; the "Table" filter and category appear in the glossary.

## 42. Project migration: FlyBy repo, Firebase Hosting, in-repo source material (DDL-0037)

Infrastructure/context housekeeping, not a feature change — recorded so future sessions don't
re-derive it. See [DDL-0037](CLAUDE.md).

- **New repository.** The project moved to a fresh repo under its own name,
  **`github.com/PinkJoao/FlyBy`** (git remote `origin`), replacing the earlier one. Nothing is
  known broken by the migration; if the rename ever turns out to have broken paths/CI/deploy, it
  gets fixed when it surfaces.
- **Hosting is now Firebase Hosting** (project **`flyby-hub`**), replacing the previous
  **Cloudflare Pages** (`*.pages.dev`) deploy. Committed config: `firebase.json` (serves `dist/`,
  SPA rewrite `**` → `/index.html`) and `.firebaserc` (default project `flyby-hub`). Deploy =
  `npm run build` + `firebase deploy`, run by the **user** (like pushes/pulls). No Cloudflare/
  wrangler config remains.
- **Reference source material moved inside the repo, permanently.** `DnD Source Material/`
  (5e.tools / Foundry dnd5e system / Plutonium / real actor exports) now sits at the project root
  instead of being a sibling folder, and is **git-ignored** — never committed or redistributed
  (consistent with DDL-0003: ship code only). It stays in this **same in-repo location on every
  machine**, so it resolves as `./DnD Source Material`. CLAUDE.md §3 updated; the old two-machine
  sibling note retired.
- **CLAUDE.md and `.claude/` config are now tracked** (removed from `.gitignore`) so the shared
  working agreement and project config travel with the repo — `.claude/settings.json` and
  `launch.json` are committed. `.claude/settings.local.json` is left **untracked and not
  force-ignored** (matching the previous project, which never listed it in `.gitignore`) and its
  stale old-project paths were cleaned. Still ignored: `.agents/`, `skills-lock.json`.
- **Commit authorship.** The no-`Co-Authored-By` rule (working agreement §2 rule 3) is permanent.
  A **single, already-spent one-time exception** applied to the commit that un-ignored `CLAUDE.md`
  and `.claude` (bundled with these context updates), which was allowed to carry Claude's
  co-authorship trailer; every later commit drops it again.

## 43. Phase T - T1a session 3: Bard + all 10 subclasses (TC-0023…TC-0026)

- **Migration repair (DDL-0037 fallout), found by the session's pre-flight sweep:**
  `scripts/lib/loadDb.js` still looked for the source material as a SIBLING folder -
  now resolves the in-repo `./DnD Source Material` (render-pdf-preview comment updated
  too); vitest collected the 5etools snapshot's own jest tests (excluded via
  `vite.config.js` `test.exclude`); eslint descended into the snapshot's
  `eslint.config.mjs` (folder added to `globalIgnores`); `fetcher.test.js` used the
  node-only `global` (→ `globalThis`, the one real lint error the exclusion exposed).
- **TC-0023 - countable proficiency tokens never became choices.** `parseChoices` now
  reads `{anyMusicalInstrument: 3}`-style token entries (`PROF_COUNT_TOKENS` in
  `engine/choices.js`) into category-restricted pool choices - Musician XPHB / Harper
  Agent FRHoF (origin feats!), Artificer Initiate, Satyr, Dwarf (Kaladesh), and every
  `{anyStandard: N}` language race (Custom Lineage…). Multi-entry proficiency fields are
  now correctly ALTERNATIVES (5etools joins them with "or"): only the first entry that
  yields a choice emits one - Human (Ixalan)'s double `{anyStandard:1}` is ONE language.
- **TC-0024 - kit `{equipmentType}` entries dropped.** The Bard kit's "Musical
  Instrument of your choice" is now a kit CHOOSE: listed on the option card, picked via
  an item selector in the guided EquipmentStep (category-matched), stored in
  `meta.startingKitPicks`, added to the inventory, and gated by deep completeness
  (`kitStepComplete` ctx flag).
- **TC-0025 - sibling spell chooses could pick the same spell twice** (Lore's Magical
  Discoveries). ChoiceList now feeds each SpellChoice the sibling `spell` picks of the
  same bag; the selector and the add guard exclude them.
- **TC-0026 - prose-granted spell missing from the data** (College of Spirits RHW's
  Guidance). New curated `MISSING_ADDITIONAL_SPELLS` registry in
  `engine/grantedSpellUses.js`, merged into the first `additionalSpells` group by
  `resolveGranted` (never appended - a new group would be an alternative and spawn a
  false spellSet choice).
- **Session pass (all rows `ui: ok`):** full guided create (High Elf / Musician / Lore),
  overlay level-ups 1→4 (Expertise, subclass + Bonus Proficiencies, ASI + deep
  sub-choice gating), jump to 19 (badge 8 → fixup guide: 2× Magical Discoveries, 3 ASIs,
  Expertise@9, Epic Boon - the TC-0022 cap saturating Cha at 20 and the boon lifting it
  to 21), subclass swaps @19 for the other nine (features, fixed proficiency grants,
  granted spells incl. Glamour's Always Prepared pair and Spirits' Spirit Guardians
  1/Day, Swords' restricted FS pool via badge), chip popups, title links, race origin
  timeline (choose-a-Wizard-cantrip @1, Detect Magic @3, Misty Step @5), mobile width on
  sheet/Spellbook/Inventory, zero console errors.
- Verified: 920 tests (+12), lint clean, sweep 274/274 `--strict`.

## 44. Glossary shows only current versions (duplicate entries removed)

- **Species listed twice.** Searching "Aarakocra" in the browsable glossary returned two
  species (DMG and MPMM) plus the language. The glossary's entity lists come from
  `entityLinks`' `SIMPLE_TAGS`, whose race list is deliberately PERMISSIVE - legacy prose
  cites `{@race Aarakocra|DMG}` and a link must never die - but `latestOnly` alone does not
  hide those DMG entries: they are "NPC Species" and carry no `reprintedAs`. `SIMPLE_TAGS`
  gained an optional **`glossaryList`** (used by `glossaryIndex` in place of `list`), and
  the race config points it at the SPECIES SELECTOR's own list
  (`latestOnly ∘ resolveCopies` + no `NPC Race`) - the glossary now shows exactly what the
  rest of the app offers. Fixes Aarakocra, Goblin, Hobgoblin, Kenku, Kobold and Lizardfolk.
- **Weapon properties listed twice.** `buildGlossary` indexes an `itemProperty` under its
  ABBREVIATION and under its NAME (both appear in prose tags), pointing at the SAME entry
  object; `glossaryEntries` walked the map values and emitted it once per key. It now
  dedups by object identity - "Ammunition", "Finesse", "Heavy", "Light", "Loading",
  "Reach", "Thrown", "Two-Handed", "Versatile", "Reload", "Burst Fire" and "Vestige of
  Divergence" each appear once.
- Same-name entries that are genuinely DIFFERENT things stay (both are offered everywhere
  else in the app too): the XPHB vs. XDMG "Ammunition" properties (regular vs. firearm),
  the XPHB/XDMG "Creature Size and Space" tables (squares vs. hexes), setting variants
  (Aven PSA/PSD, Elf LFL/XPHB, Goblin MPMM/PSZ, Vedalken GGR/PSK) and the XGE/XDMG item
  pairs the dataset never marked as reprints.
- Verified: 922 tests (+2), lint clean, live glossary ("aarakocra" → 1 species + 1
  language; "ammunition" → 1 XPHB property + 1 XDMG property + the SRD table), no console
  errors.

## 45. Phase T - T1a session 4: Cleric + all 19 subclasses (TC-0027…TC-0031)

- **Session scope (TESTING-PLAN §4, 2026-07-19).** The campaign's largest batch, done in
  one sitting: full guided create (Dwarf XPHB / Magic Initiate (Cleric) as the origin feat
  / Nature Domain PHB as the representative build), overlay level-ups 1→4 (spells @2,
  subclass + Acolyte skill + druid cantrip @3, ASI @4), jump to 19 with the fixup guide
  (Blessed Strikes → Potent Spellcasting, 3 ASIs, War Caster, Durable, Epic Boon → Boon of
  Fortitude; the DDL-0034 cap saturated Wis at 20 and the boon lifted it to 21; HP 214 with
  Dwarven Toughness + Durable's Con bump + the boon's +40 all stacking), then subclass
  swaps @19 for the other 18 domains (features, granted spell lists, fixed proficiency
  grants and per-subclass chooses verified on each), Spellbook checks at 1/3/19,
  proficiency cards, chip/title popups, mobile width, zero console errors. All 19
  `class:cleric/*` rows now `ui: ok` in `testing/COVERAGE.md`.
- **TC-0027 - legacy subclass `_copy` stubs unresolved (STRUCTURAL, fixed).** Every legacy
  subclass adopted onto a 2024 class is a 5etools `_copy` STUB carrying only re-pointed
  `subclassFeatures`; `resolveSubclassObj` returned it unexpanded, so every inherited field
  - `additionalSpells` above all - vanished. 13 of the Cleric's 19 domains had ZERO domain
  spells, and the spell chooses hiding in them (Nature/Strength druid cantrip, Arcana's two
  wizard cantrips + Arcane Mastery's 6th-9th picks, Death's necromancy cantrip) never
  emitted. Bard/Barbarian escaped by stub shape (no own features → the original won the
  findLast). Fix in `engine/resolve.js`: the subclass list is now `resolveCopies`-expanded
  (memoized per db via WeakMap, the selector's shortName|source|classSource id). The sweep
  could never catch this class of bug - a grant that never derives makes no pendency and no
  round-trip diff (exactly the T1-session justification).
- **TC-0028 - Thaumaturge/Magician extra cantrip (fixed).** `CANTRIP_BONUS_FEATURES` +
  `cantripLimitBonus` in `engine/featureEffects.js`, added to the class origin's
  `cantripLimit` in resolve (base > 0 only). Guide step, fixup overlay, Spellbook and ✦
  badge all read the derived field, so one fix reaches all four. Live: 3+1 @1, 5+1 @19.
- **TC-0030 - Blessings of Knowledge (fixed).** Knowledge (PSA) granted nothing (the PSA
  domains inline their level-1 text in an umbrella feature named after the subclass - new
  registry key on the umbrella + dedup by KEY, since the umbrella exists in BOTH class
  attachments PHB@1/XPHB@3 and emitted twice under name@level dedup). And the chosen
  skills now carry EXPERTISE in both versions (PHB/PSA "proficiency bonus is doubled",
  FRHoF "you have Expertise") via the new `expertise: true` flag on skill grants → emitted
  as kind 'expertise' with `newProf` (pool = the grant's own list, not intersected with
  proficient skills); picks derive at level 2 through the existing
  `collectSkillProficiencies` path and ride the DDL-0028 export flags unchanged.
- **Open, needs-user-eyes:** **TC-0029** (ASI feat picker is category-G-only and the Epic
  Boon picker EB-only; XPHB RAW says "or another feat of your choice for which you
  qualify", which admits Origin feats - Tough, Lucky, Alert… - at ASI slots and G/O feats
  at the boon) and **TC-0031** (spell pickers offer spells already always-prepared from
  another origin; the pick is legal but silently wasted after the Spellbook collapse).
- Verified: 928 tests (+6: `_copy` regression, cantrip bonus ×3, Blessings ×2), lint
  clean, sweep 274/274 `--strict`, full live pass. See DDL-0039 and
  `testing/ISSUES.md` TC-0027…TC-0031.

## 46. TC-0029/TC-0031: filtros pré-marcados nos pickers de feat (ASI/boon) e de magia

- **Decisão do usuário (2026-07-19)**: nos dois casos, o mesmo padrão dos seletores de
  magia (DDL-0026) - a lista NÃO esconde nada por regra dura; um filtro vem pré-marcado
  no padrão e o jogador experiente (ou com permissão do mestre) o desmarca.
- **TC-0029 - ASI e Epic Boon.** O slot de ASI agora lista feats General + Origin + Epic
  Boon com o filtro **Category** pré-marcado em General; o slot de Epic Boon lista
  EB + General + Origin pré-marcado em Epic Boon (RAW: "or another feat of your choice
  for which you qualify" - Tough/Lucky/Alert são Origem no XPHB 2024 e qualificam).
  Implementação: `pool.extraCategories` (engine/classFeatureChoices.js) entra na LISTA da
  entity mas fica atrás do filtro; `makeFeatEntity` ganhou `opts.categoryFilter` (filtro +
  badge Origin/Epic Boon nos cards); o `FeatChoice` (ChoiceList) pré-marca a categoria
  padrão via `initialFilterState` (mesclando com o filtro de pré-requisito do modo
  guiado). **Avisos de pré-requisito INALTERADOS** - Not Met/Unverifiable seguem
  confirmando (um boon num ASI abaixo do 19 avisa pelo próprio prereq Level 19+). O
  autoBuild/sweep continua sorteando só de `pool.category` (o padrão) - matriz estável.
- **TC-0031 - magias de outra origem.** Um multiclasse PODE querer a mesma magia em duas
  classes (Warlock 1 / Cleric 1 preparando Toll the Dead nas duas pela diferença de
  atributo), então nada de esconder à força: `preparedElsewhere(origins, excludeKey)`
  (engine/spellcasting.js) mapeia nome→rótulo da origem; `makeSpellEntity` ganhou o
  filtro **"Already Prepared"** + badge nos cards; a SpellbookTab e o SpellPicker do guia
  (create, level-up e fixup) o pré-marcam como EXCLUDE (desmarcável) e, ao adicionar
  mesmo assim, o diálogo de confirmação existente cita a fonte: "You already have
  Guidance from Magic Initiate. Prepare it anyway?".
- Verificado ao vivo (Cleric 19 + Magic Initiate): ASI com General marcado esconde Tough;
  marcar Origin o revela com badge; boon abre só com EB e General o expande; Guidance
  some por padrão no preparar, aparece com badge ao desmarcar e confirma citando o feat.
  930 testes (+2 preparedElsewhere, +2 pools), lint, sweep 274/274 `--strict`.

## 47. Ajustes de UX nos seletores: ordem do filtro "Already Prepared" e puxador fixo da gaveta

- **"Already Prepared" logo abaixo de Class** (era o último dos 8 grupos de filtro).
  Ele vem PRÉ-MARCADO (§46/TC-0031), então precisa estar à mão para ser desmarcado -
  no fim da lista ficava fora de vista justamente para quem quer removê-lo.
- **O puxador da gaveta de filtros agora é FIXO** (mobile), em TODOS os painéis de
  seleção do app - inclusive o glossário, que reusa o mesmo `SelectorPanel`. Antes ele
  rolava junto com os chips e sumia, deixando o gesto de fechar a gaveta inacessível
  com a lista rolada (o Clear/Apply já eram fixos).
  - O comentário do CSS registrava que uma tentativa anterior tinha sido revertida
    porque puxador e cabeçalho disputavam o mesmo `top: 0` e as faixas se sobrepunham.
    Agora eles **empilham**: o puxador gruda em `top: 0` (z-index 3) e o `.filtersHead`
    em `top: var(--grab-h)` (z-index 2), com `--grab-h: 20px` declarado na gaveta -
    a altura exata do puxador (10 + 4 da barra + 6 de padding).
  - O puxador ganhou fundo opaco (`var(--bg)`) e largura cheia (margem negativa
    anulando o padding lateral do container) para os chips passarem POR BAIXO dele.
- Verificado ao vivo em 375px: com a gaveta rolada ao fim, puxador em 1px e cabeçalho
  em 21px do topo (sem sobreposição); tocar no puxador continua fechando e o painel
  reabre; mesmo comportamento no glossário; em 1280px nada muda (o puxador segue
  `display: none` e o cabeçalho em `top: -16px`). 930 testes, lint, zero erros de console.

## 48. Multiclasse: o teto de preparação de magias é o do NÍVEL INDIVIDUAL da classe

**O bug.** Um Cleric 2 / Druid 1 via o filtro de Level do picker de magias vir
pré-marcado até o **2º círculo**, nas duas origens. Errado: o multiclasse tem duas
contas distintas (PHB, "Multiclassing / Spellcasting") - os **slots** são combinados
(nível de conjurador 3 → slot de 2º), mas *"you determine what spells you know and can
prepare using the levels of your **individual classes**"*. Um Cleric 2 prepara até o 1º
círculo; um Druid 1 idem. O slot de 2º existe, mas só serve para conjurar em círculo
superior uma magia de círculo baixo.

**A causa.** `deriveSpellcasting` calculava `maxPrepareLevel` a partir dos slots JÁ
combinados (`Math.max(...Object.keys(o.slots))`), que são compartilhados por todas as
origens leveled - então toda origem herdava o teto do personagem, não o da sua classe.

**A correção.**
- Novo `maxPrepareCircle(code, classLevel)` em `engine/spellcasting.js`: o círculo
  máximo pela tabela da classe SOZINHA (`slotContribution(..., { single: true })` - o
  mesmo arredondamento que um personagem de classe única teria, então Paladin/Ranger 1
  conjuram no XPHB e EK/AT só a partir do 3).
- `resolve.js` passou a definir `maxPrepareLevel` **na criação da origem** (a partir do
  `cls.level`), não no laço que distribui os slots compartilhados depois. O pacto segue
  pelo seu próprio círculo de slot (`pactSlots(cls.level).level`), como já era.
- Os **slots continuam combinados** e idênticos em cada origem - só o teto mudou.

**Alcance.** Como tudo lê `origin.maxPrepareLevel`, a correção chega de graça aos
círculos pré-marcados do picker da SpellbookTab, à confirmação ao adicionar fora do
padrão ("You have no spell slots… of the 2nd level"), ao passo de magias do level-up
guide (`LevelUpSpellsStep`) e à fronteira do Mystic Arcanum. Fiel à DDL-0026/DDL-0040:
o recorte é **filtro pré-marcado desmarcável** - o jogador com permissão do mestre ainda
prepara o que quiser, agora confirmando.

**Verificado.** 936 testes (+6: `maxPrepareCircle` unitário e um Cleric 2 / Druid 1
derivado - slots `{1:4, 2:2}` compartilhados, `maxPrepareLevel` 1 nas duas origens),
lint, sweep 274/274 `--strict`. Ao vivo, no Cleric 2 / Druid 1 real: card de slots
"1st ×4 / 2nd ×2" e o picker abrindo com Cantrip + 1st Level + Cleric marcados e **2nd
Level desmarcado** (antes vinha marcado), sem nenhuma magia de 2º nos resultados.

## 49. Phase T - T1a session 5: Druid + all 8 subclasses (TC-0032…TC-0034)

- **Scope (TESTING-PLAN §4, 2026-07-20):** `class:druid/*` - Dreams, Shepherd (XGE),
  Spores, Wildfire (TCE), Land, Moon, Sea, Stars (XPHB). All 8 rows now `ui: ok` in
  `testing/COVERAGE.md`. Sweep was green before starting (274/274 `--strict`).
- **Representative build:** full guided create - Goliath (Stone Giant Ancestry) /
  Magic Initiate (Druid) / Circle of the Land. The feat exercised the TC-0011
  spellSet + spell chooses (Wis + Druid list → 2 cantrips + level-1 spell) and the
  DDL-0040 "Already Prepared" flow end-to-end in the CLASS pickers: guided cantrips
  step hid Guidance/Starry Wisp behind the pre-marked exclude filter, unmarking showed
  the badge, and adding confirmed with "You already have Guidance from Magic Initiate.
  Add it anyway?". TC-0028's Magician cantrip bump reached the guide (3 cantrips @1,
  5/5 @19). Kit auto-equip (TC-0015) gave AC 14 at level 1.
- **Overlay level-ups 1→4:** spells @2 (prepared 4→5); subclass @3 with the step list
  REBUILDING live (Land pick → its terrain spellSet appeared as the next step;
  Temperate chosen; Misty Step auto-excluded from the spell picker the moment it became
  granted); feat @4 (ASI +2 Wis → 19) + 4th cantrip + spells.
- **Fixup @19 (badge ✦ 6):** Elemental Fury (Potent Spellcasting), ASI @8 (+2 Wis
  SATURATED at 20 - DDL-0034 cap, the extra point wasted per RAW), Tough @12 (HP
  174 = 136 + 2×19 via hpBonuses), War Caster @16 (+1 Int → 14; picker pre-marked
  General - searching "tough" gave 0 results until the category filter was unmarked,
  then Tough appeared with its Origin badge, per DDL-0040), Boon of Fortitude @19
  (HP 214 = +40; +1 Wis LIFTED past the cap to 21, boon max 30). Badge reached zero.
- **Subclass swaps @19 (the other 7):** every feature list renders and every
  `additionalSpells` grant derives Always Prepared - the TC-0027 `_copy` resolution
  verified on the druid stubs: Spores (Chill Touch + 9 circle spells), Wildfire (10),
  Dreams/Shepherd (correctly none); Moon (6 incl. Fount of Moonlight @15), Sea (11
  incl. Ray of Frost), Stars (Guidance + Guiding Bolt). Prepared-collapse accounting
  verified across swaps: Moon freed a slot for the manually-prepared Moonbeam
  (20/21 + badge 1 → refilled), Dreams showed 22/21 in red (intended over-limit
  freedom, DDL-0026) as picks de-collapsed.
- **Bugs - fixed in-session:** **TC-0032** (Shepherd's Speech of the Woods never
  granted Sylvan - one curated `SUBCLASS_GRANTS` line + test), **TC-0033** (kit items
  referencing an ITEM GROUP landed as "unresolved" junk - `druidic focus|xphb`; also
  Cleric/Paladin XPHB `holy symbol|xphb`. `parseStartingEquipment` now emits a
  closed-pool kit choose riding the whole TC-0024 machinery; verified live with the
  3-member Druidic Focus picker and a resolved Wooden Staff in Inventory; 3+1 tests).
- **Open:** **TC-0034** (polish) - the feat sub-bag spell pickers (SpellChoice in
  ChoiceList) don't get the DDL-0040 Already Prepared flow (no filter/badge/confirm);
  needs derived origins plumbed into ChoiceList across call sites, deferred.
- Checks: chip popups (skill chip → DetailView overlay), choice-title links (Primal
  Order), Spellbook cards (DC 19 / +11 / slots 4-3-3-3-3-2-1-1-1 @19), mobile width
  (Class/Spellbook/Inventory, no horizontal scroll), zero console errors.
- Verified: 940 tests (+10), lint clean, sweep 274/274 `--strict`.

## 50. TC-0034: o fluxo "Already Prepared" chega aos pickers de magia dos talentos

**Fecha o único pendente aberto da sessão T1a Druid (DDL-0041); arquitetura em DDL-0042.**

- **O problema.** O DDL-0040 deu aos pickers de magia o recorte "liberdade com aviso" —
  filtro **Already Prepared** pré-marcado como exclude (desmarcável), badge no card e
  confirmação citando a origem. Ele valia na SpellbookTab e no SpellPicker do guia, mas
  **não** nos chooses de magia dos sub-bags de TALENTO (`SpellChoice` do ChoiceList,
  TC-0011): um Druid 1 com Magic Initiate (Druid) escolhia Speak with Animals — que ele
  já tem sempre preparada via Druidic — sem filtro, sem badge e sem aviso.
- **A correção (mais barata que o previsto).** O TC-0034 supunha encanar `origins` pelos
  **sete** call sites do ChoiceList. Em vez disso o **ChoiceList deriva o mapa ele
  mesmo** (`preparedElsewhere(deriveFromDb(character, db).spellcasting.origins)` num
  `useMemo`) e o passa adiante como `spellsOwned` — para o `SpellChoice` e para a lista
  **aninhada** do sub-bag, que por isso nunca re-deriva. **Nenhum call site mudou.**
- **Porteiro:** o memo só roda quando um picker de magia é de fato alcançável — um pool
  `spell` na lista, ou um pool `feat` (cujo sub-bag pode ter um). Listas comuns de
  proficiência/feature não pagam nada, e há **uma** derivação por tela, não uma por slot
  de talento.
- **Nenhuma origem excluída** aqui, ao contrário dos outros dois call sites: os picks da
  própria escolha e os dos irmãos já saem do seletor por `exclude` (TC-0025), e um grant
  FIXO da mesma entidade (o Prestidigitation do High Elf ao lado do cantrip choose dele)
  é exatamente a redundância que o aviso deve pegar.
- **Verificado ao vivo** (Druid 1 + Magic Initiate (Druid), picker de magia de nível 1):
  Speak with Animals escondido por padrão → desmarcar o filtro revela o card com o badge
  "Already Prepared" → selecionar abre "You already have Speak with Animals from Druid.
  Add it anyway?" → **Cancel** mantém 0/1 (e deixa o painel aberto, como no SpellPicker),
  **Add anyway** grava o pick. Zero erros de console.
- **Limpeza dos trackers na mesma passada.** Auditoria do `testing/ISSUES.md`: o único
  item **aberto** que resta é **a metade Rogue do TC-0021** (o pool de Weapon Mastery
  precisa de semântica condicional — "Simple, ou Martial com Finesse/Light" — que o
  `weaponFilterAllows` ainda não expressa), agendada para a sessão T1a do Rogue; o
  cabeçalho do TC-0021 passou a dizer PARTIAL em vez de esconder isso no texto. Marcações
  vencidas corrigidas: as linhas Armorer/Battle Smith do `COVERAGE.md` ainda diziam
  `issues (TC-0012, TC-0017)` embora ambos tenham sido resolvidos em 2026-07-17 → agora
  `ok`; a entrada de 2026-07-17 (3) do TESTING-PLAN ainda chamava o TC-0022 de aberto
  embora o DDL-0034 o tenha resolvido no mesmo dia → corrigida.
- Verificado: 940 testes, lint clean, sweep 274/274 `--strict`.

## 52. T1a sessão 7: Monk + 10 subclasses (sem achados, DDL-0044)

**Sessão de UI da campanha Phase T (TESTING-PLAN §7 2026-07-21); todas as 10 linhas
`class:monk/*` com `ui: ok` em `testing/COVERAGE.md`. NENHUM bug encontrado — zero
mudanças de código.**

- **Rep build (Kensei):** guided create completo (Elf / linhagem Wood Elf / Tough),
  exercitando o fluxo inteiro de criação incluindo o tool de classe MESCLADO
  **"Artisan's Tools or Musical Instruments"** (42 opções — o caso artesão-OU-instrumento
  do DDL-0002), as species choices do Wood Elf (linhagem + perícia Keen Senses + atributo
  de conjuração + Druidcraft/Longstrider/Pass without Trace concedidos) e o popup de regra
  "Skill" a partir do título da escolha (DDL-0032). **Derivações de nível 1: HP 11 (d8 8 +
  Con 1 + Tough 2), CA 15 = Unarmored Defense (10 + Dex 3 + Wis 2)** — ambas derivam ao
  vivo; features Martial Arts + Unarmored Defense renderizam.
- **Máquina `weaponProf` do Kensei verificada ao vivo (DDL-0030):** picker corpo-a-corpo
  @3 (21 opções, simples/marcial MELEE, sem Heavy/Special, zero à distância); picker à
  distância @3 (9 opções, **Longbow presente pela exceção `allow`**, Heavy Crossbow/Net
  ausentes, zero melee); tool @3 restrito a Calligrapher's/Painter's Supplies; picker @6
  (32 opções, **qualquer tipo** — melee E ranged — sem Heavy/Special, Longbow). @11/@17
  compartilham o filtro do @6.
- **Swaps @19:** **Elements** (featureoption Elemental Epitome @17 renderiza 5 opções
  Acid/Cold/Fire/Lightning/Thunder; cantrip Elementalism na origem Monk do Spellbook; CA
  15 intacta) e **Mercy** (grants de Implements of Mercy — Insight, Medicine e Herbalism
  Kit — todos renderizam no card de Proficiências). As outras 8 subclasses tiveram as
  derivações verificadas pelo engine (Drunken Master Performance+Brewer's; Shadow Minor
  Illusion+Darkness; Sun Soul Burning Hands; Long Death/Astral Self/Ascendant Dragon/Open
  Hand corretamente sem grants). Mobile sem overflow; zero erros de console.
- **Contagem do badge ✦ correta em toda a sessão** (10 no Kensei 19 = 4 ASI + Epic Boon +
  tool do Kensei + 3 armas @6/11/17 + 1 `basic`, a sobreposição documentada
  DDL-0033/TC-0020 para uma escolha de classe do tipo proficiência). **Nota de harness para
  sessões futuras:** a contagem do badge vive no `title`/nome acessível ("N choices left"),
  NÃO no `textContent` (que é só "⚛N") — consulte o nome acessível (read_page) ou `.title`,
  e nunca confie numa leitura do badge feita durante o boot-load do compêndio ou logo após
  uma mudança disparada por JS (ambos leem 0 transitoriamente).
- Verificado: 944 testes, lint, sweep 274/274 `--strict` (sem alterações — nenhum código
  mudou). Ver DDL-0044.

## 53. CA: Defesa sem Armadura generalizada (registro por-fórmula) + Draconic Sorcerer

**Antes da retomada da campanha Phase T, o usuário pediu para verificar/melhorar a CA das
features que definem a própria fórmula (Barbarian/Monk Unarmored Defense, armadura natural
de espécie) e adiantar a Draconic Sorcerer. Ver DDL-0045.**

- **Verificação (o que já estava certo):** Barbarian (10+Dex+Con, escudo OK), Monk
  (10+Dex+Wis, escudo INVALIDA), Monk/Barbarian escolhendo a maior respeitando o escudo, e
  a armadura natural (Tortle flat 17 / Autognome 13+Dex / Warforged +1) já competiam pela
  MAIOR CA corretamente. As lacunas: (a) **nenhuma Defesa sem Armadura de subclasse** existia
  e (b) a regra "escudo invalida" estava **hardcoded só no Monk** (`if (!shield)`), não como
  propriedade da fórmula.
- **Generalização (`engine/armorClass.js`):** as fórmulas de Defesa sem Armadura viram um
  **registro curado** `UNARMORED_DEFENSE` (por classe E subclasse, com `minLevel` e
  `allowsShield`). Cada candidato de CA-base agora carrega `allowsShield`; com escudo
  equipado os candidatos que o proíbem (Monk) são **descartados ANTES do max**, então somar
  o escudo por cima do melhor é sempre RAW. Comportamento idêntico nos casos existentes.
- **Draconic Sorcerer (XPHB nv3):** Draconic Resilience = **10 + Dex + Cha** sem armadura,
  escudo permitido, gated no nível 3 da subclasse. (A versão PHB 2014 era 13 + Dex, fora do
  latestOnly do app.) Detectado pelo `subclassId`/`level` do `ClassEntry`, sem db.
- **Export Foundry:** entrada curada `'draconic resilience'` em `foundryEffects.js`
  (`ac.calc=custom` + `formula '10 + @abilities.dex.mod + @abilities.cha.mod'`) — o calc
  `draconic` nativo do dnd5e é o 13+Dex de 2014. O curado vence o overlay (precedência
  DDL-0031). Limitação de multiclasse (um só `ac.calc` no Foundry) é a mesma já existente
  para barbarian+monk; o sheet ao vivo escolhe a maior.
- Verificado: 950 testes (+8, incl. Draconic sozinho/escudo/gating e Monk+Barb+escudo), lint,
  sweep 274/274 `--strict`, e uma passada AO VIVO no código servido (Draconic 3 = 16 / +escudo
  18 / nv2 = 12; Monk/Barb = 16 sem escudo, 15 com). Ver DDL-0045.

## 54. T1a sessão 8: Paladin + 10 subclasses (TC-0038, DDL-0046)

**Sessão de UI da campanha Phase T (TESTING-PLAN §7 2026-07-21 (2)); todas as 10 linhas
`class:paladin/*` com `ui: ok` em `testing/COVERAGE.md`. Um achado, corrigido em sessão.**

- **Rep build (Devotion):** guided create completo (**Aasimar** / Tough) exercitando a
  escolha de Size, o **kit choose de itemGroup do Holy Symbol** (Amulet/Emblem/Reliquary —
  o caso Paladin do TC-0033), a cópia da tela de features do half-caster (TC-0037: nomeia
  "Weapon Mastery and which spells to prepare" — Paladin conjura desde o nível 1 no 2024) e
  o Weapon Mastery irrestrito (40 opções, DDL-0033). Level-ups 1→3 pelo overlay: **Fighting
  Style Defense → CA 19 ao vivo** (TC-0036, Chain Mail 16 + escudo 2 + 1); subclasse @3 com
  oath spells (Protection from Evil and Good / Shield of Faith) Always Prepared + Channel
  Divinity (Divine Sense) / Sacred Weapon renderizando.
- **Jump para 19** pelo campo Level da Class tab; **fixup guide** (badge **6** = 5 slots de
  feat + spells). **Caps do DDL-0034 verificados AO VIVO:** GWM + Crusher(Str) + Slasher(Str)
  + Piercer(Str) saturam Str em **20**; **Boon of Irresistible Offense (max 30) leva a 21**.
  **HP 175** = base 137 + Tough 38 (chassi d10). **Slots 4/3/3/3/2 até o 5º círculo**
  (half-caster), Prepared 15, Channel Divinity 3 na tabela. O picker de feat lista as
  categorias atrás do filtro pré-marcado (DDL-0040/TC-0029); o de spell até o 5º círculo.
- **Swaps @19:** **Oathbreaker** (DMG `_copy`: Hellish Rebuke/Inflict Wounds → Contagion/
  Dominate Person, todas Always Prepared — TC-0027 confirmado no chassi Paladin) e **Noble
  Genies** (FRHoF: o choose de skill **Genie's Splendor @3** renderiza; oath spells incl. o
  **cantrip Elementalism** e Contact Other Plane com chip Ritual, todas Always Prepared). As
  outras 7 (Crown/Conquest/Redemption/Watchers legacy + Glory/Ancients/Vengeance XPHB)
  tiveram as oath spells verificadas pelo engine. Mobile ok, zero erros de console (após a
  correção).
- **Achado — corrigido em sessão: TC-0038.** O picker "+ Choose a spell" do GUIA oferecia as
  magias que a PRÓPRIA origem já concede sempre (oath / Paladin's Smite → Divine Smite /
  Faithful Steed → Find Steed) e deixava adicioná-las como prepared redundantes — Aid entrou
  duas vezes, virando duas linhas "Aid" no Spellbook + erro de key do React, e linha órfã ao
  trocar o oath. Causa: `SpellPicker.jsx` montava `exclude` só a partir de `picks` (as
  escolhidas), não de `origin.alwaysPrepared` — enquanto a SpellbookTab monta o dele de `all`
  (prepared + arcanum + **alwaysPrepared**). O duplo surgiu porque uma magia que é escolhida
  E sempre-preparada COLAPSA na cópia concedida (B2.3), então `current` nunca refletia o Aid
  recém-adicionado. **Fix:** `ownedNames` agora inclui `origin.alwaysPrepared` (espelha a
  SpellbookTab); os três callers (SpellsStep/CantripsStep/LevelUpSpellsStep) já passam a
  `origin` com `alwaysPrepared`, então nada mais mudou. Verificado ao vivo (Oathbreaker @19:
  buscar "Hellish Rebuke" no picker do guia = 0 resultados; magias normais seguem listando).
- Verificado: **950 testes**, lint, sweep **274/274 `--strict`**. Ver DDL-0046.

## 51. T1a sessão 6: Fighter + 10 subclasses (TC-0035..TC-0037, DDL-0043)

**Sessão de UI da campanha Phase T (TESTING-PLAN §7 2026-07-20 (3)); todas as 10 linhas
`class:fighter/*` com `ui: ok` em `testing/COVERAGE.md`.**

- **Rep build (Eldritch Knight):** guided create completo (Human XPHB / Magic Initiate
  (Wizard) / kit A com Chain Mail auto-equipada, AC 16), level-ups interativos 1→4 pelo
  overlay (subclasse + 2 cantrips + 3 preparadas @3 com o fluxo DDL-0040 verificado de
  ponta a ponta — Fire Bolt oculto pelo exclude pré-marcado, badge ao desmarcar, confirm
  "You already have Fire Bolt from Magic Initiate"; feat + mastery 3→4 @4), salto a 19
  com o badge ✦ **"8 choices left"** (decisões, TC-0020) e o fixup guide preenchendo
  5 feats + Epic Boon + 2 masteries + 1 cantrip + 8 magias até o 4º círculo. Caps
  DDL-0034 exercitados: ASI +2 satura Str em 20, Boon of Fortitude eleva a 21; HP 234 =
  156 base + 38 (Tough) + 40 (Boon). Spellbook @19: slots 4/3/3/1, DC 15, +7, 3/3 e
  12/12. Categoria de feat DDL-0040 verificada nos dois slots (ASI lista G+O+EB com
  General pré-marcado — Tough (Origin) escolhido ao incluir a categoria; Epic Boon
  pré-marca EB).
- **Swaps @19 das outras nove:** Arcane Archer (spellSet Prestidigitation/Druidcraft +
  skill Arcana/Nature + 8 Arcane Shots), Battle Master (tool AT + skill da lista da
  classe + 23 manobras; popup de chip ok), Cavalier/Samurai (choose `mixed`
  skill-ou-language com pools XGE menos as possuídas), Champion (Additional FS @7 com
  9 opções, GWF excluído), Psi Warrior (Telekinesis 1/Day no card Uses @18), Rune Knight
  (6 runas, Hill/Storm gated 7+; idioma Giant no card), Echo Knight (features EGW, sem
  choices — correto), Banneret (skill Perf/Pers + Comprehend Languages Ritual no Uses).
  Mobile sem overflow; zero erros de console.
- **TC-0035 (bug, corrigido):** picks órfãos de magia após um swap que remove o casting
  (EK → Arcane Archer) apareciam com badge "Mystic Arcanum / 1/Long Rest" e SEM
  contadores. O badge da linha agora exige `origin.arcanumLevels.includes(level)` (a
  classificação do próprio engine, [] para não-pact) e os cards Cantrips/Prepared também
  renderizam quando a CONTAGEM > 0 — "3/0"/"12/0" em vermelho (a liberdade DDL-0026
  sinalizada). Sem grants na subclasse (Champion) a origem não existe e os órfãos ficam
  dormentes — intencional (DDL-0041), registrado no ledger.
- **TC-0036 (bug, corrigido):** o Defense fighting style nunca chegava à CA do sheet ao
  vivo (o export já levava o Active Effect). Novo registro curado `AC_BONUS_FEATURES` +
  `acFeatureBonuses(character)` em `engine/featureEffects.js` (o slot que o header do
  módulo sempre reservou), dobrado sobre `deriveArmorClass` no resolve.js honrando
  `requiresArmor`/`hasArmor`. Champion + Defense + Chain Mail = **AC 17** ao vivo.
- **TC-0037 (polish, corrigido):** a tela "Your character is ready" do guia contava
  QUALQUER origem de spellcasting como "caster" — um Fighter 1 com Magic Initiate lia
  "and which spells to prepare" sem passo de magia à frente. Agora exige a origem da
  própria classe com limite real. De carona: o choose `mixed` do Cavalier/Samurai
  titulava "Bonus Proficiency - mixed" (nome interno do kind) → "Bonus Proficiency -
  Skill or Language".
- Verificado: **944 testes (+4)**, lint, sweep **274/274 `--strict`**, passada live
  completa (fixes verificados no browser após reinício do dev server).

## 55. T1a sessão 9: Ranger + 10 subclasses (sem achados, DDL-0047)

**Sessão de UI da campanha Phase T (TESTING-PLAN §7 2026-07-21 (3)); todas as 10 linhas
`class:ranger/*` com `ui: ok` em `testing/COVERAGE.md`. NENHUM bug encontrado — zero
mudanças de código.** Terceiro half-caster da campanha, após o Paladin.

- **Rep build (Gloom Stalker):** guided create completo (Elf / linhagem Wood Elf / Tough),
  exercitando todo o fluxo — species choices do Wood Elf (linhagem + perícia Keen Senses +
  atributo de conjuração Wisdom + Druidcraft concedido), o popup de regra "Skill" a partir
  do título (DDL-0032), Weapon Mastery **irrestrito** (DDL-0033), e os dois passos de magia
  do half-caster (sem cantrips — Ranger não tem; só prepared). **Nível 1: HP 13 (d10 10 +
  Con 1 + Tough 2), AC 15 (Studded Leather 12 + Dex 3); DC 12 / atk +4 / slots 1×2.**
  Overlay level-ups 1→3 (Deft Explorer Expertise + 2 idiomas, Fighting Style, subclasse @3);
  jump a 19 pelo campo de Level da Class tab (**HP 175 = base 137 + Tough 38; slots
  4/3/3/3/2 até o 5º círculo; PB +6; Favored Enemy 6; Prepared 15**).
- **Hunter's Mark (feature de classe 2024) e Disguise Self (Gloom Stalker @3) renderizam
  como ALWAYS PREPARED**, fora do contador de preparadas; **Longstrider/Pass without Trace
  (Wood Elf @3/@5) como 1/Day Always Prepared**. O botão "+ Prepare spell" vira "Remove a
  spell to prepare another one." ao atingir o limite (R11).
- **TC-0038 (fix do Paladin) confirmado no Ranger:** o picker "+ Choose a spell" do guia
  exclui as always-prepared da **mesma origem** por `exclude` duro (buscar "Hunter's Mark"
  ou "Disguise Self" retorna 0 resultados), e as de **outra origem** (Longstrider via Wood
  Elf) ficam ocultas pelo filtro "Already Prepared" pré-marcado e removível (fluxo
  DDL-0040/TC-0031) — sem duplicatas nem colisão de key.
- **Iron Mind (Gloom Stalker @7) verificado pelo engine:** concede proficiência em save de
  **Wisdom** de forma PLANA (o Ranger base tem só Str/Dex, então a condicional Int/Cha não
  dispara) — `proficientSaves` = str/dex no L1, **str/dex/wis a partir do L7**. É a linha
  `ranger|gloom stalker` do `subclassGrants.js` (DDL-0029).
- **Magias concedidas das 10 subclasses verificadas** (engine, @19): os `_copy` legados
  derivam via TC-0027 — **Horizon Walker** (Prot from Evil/Misty Step/Haste/Banishment/
  Teleportation Circle), **Monster Slayer** (Prot from Evil/Zone of Truth/Magic Circle/
  Banishment/Hold Monster), **Swarmkeeper** (Mage Hand/Faerie Fire/Web/Gaseous Form/Arcane
  Eye/Insect Plague), **Drakewarden** (Thaumaturgy) —; e os XPHB/novos **Fey Wanderer**,
  **Gloom Stalker**, **Winter Walker** (FRHoF), **Hollow Warden** (RHW). **Beast Master** e
  **Hunter** corretamente sem magias (só o Hunter's Mark de classe).
- **Swaps @19 na UI:** **Fey Wanderer** (choose de perícia Otherworldly Glamour @3
  renderiza), **Hunter** (os 3 featureoptions renderizam com opções selecionáveis — Hunter's
  Prey: Colossus Slayer/Horde Breaker; Defensive Tactics; Superior Hunter's Defense),
  **Beast Master** (Primal Companion renderiza como PROSA — "Choose Beast of the Land/Sea/
  Sky", stat block de companheiro não modelado; sem selector por design, sem vazamento de
  `{@tag}`). Mobile (375px) sem overflow horizontal na Class tab e no Spellbook; zero erros
  de console.
- **Nota (não é bug):** na tela de Species, definir o *atributo de conjuração* da linhagem
  ANTES de escolher a própria linhagem reseta o atributo (ele pertence à linhagem, então
  re-deriva quando ela muda). No fluxo normal (linhagem primeiro) não ocorre; auto-corrigível.
- Verificado: 950 testes, lint, sweep 274/274 `--strict` (sem alterações — nenhum código
  mudou). Ver DDL-0047.

## 56. QoL: sugestão de magia obtida em duplicidade no guia + lock do preview do seletor

Dois ajustes pequenos de qualidade de vida (DDL-0048).

- **Sugestão de duplicidade de magia no guia (Task 1).** As telas de magia do guia (Cantrips,
  Spells, e o level-up) agora exibem uma FAIXA de sugestão (âmbar, `.suggestion`) quando o
  personagem tem uma magia SEMPRE-preparada por uma origem (subclasse/talento/raça) e TAMBÉM a
  obtém por outra via — preparada à mão numa outra classe (multiclasse) ou concedida por outra
  fonte (Magic Initiate). É só um AVISO (nunca bloqueia nem remove): preparar a mesma magia por
  múltiplas vias é permitido e às vezes desejado, mas incomum, e o guia é para novatos. Novo
  helper puro `redundantPreparations(origins)` em `engine/spellcasting.js` (só aponta quando ≥1
  origem CONCEDE a magia e ela aparece em ≥2 origens distintas; magia meramente preparada à mão
  em duas classes NÃO conta) + componente `SpellRedundancyNotice.jsx` (filtra por círculo:
  cantrip / leveled / all). Complementa o fluxo "Already Prepared" (DDL-0040) e o `exclude` da
  mesma origem (DDL-0046) — que atuam no momento de ADICIONAR; esta faixa chama atenção a uma
  duplicidade JÁ existente.
- **Lock do preview ao reabrir o seletor (Task 2).** No `SelectorPanel`, ao reabrir o painel
  para SUBSTITUIR algo já escolhido (`currentId`), o preview agora se FIXA no item selecionado e
  VOLTA a ele quando o mouse sai de um card — antes ficava preso no último item que passou pelo
  hover (ou no 1º da lista). Novo `selectedRaw` (memo sobre `items` + `currentId`) inserido na
  cadeia do preview: `hovered ?? detailItem ?? selectedRaw ?? lastHovered ?? results[0]`. Vale
  para todo picker com valor único (espécie/linhagem/background/subclasse/feat via `PickerField`);
  na 1ª escolha (`currentId` null) o comportamento antigo (último hover) segue igual.
- Verificado: 954 testes (+4), lint, e passada ao vivo no seletor de espécie (preview trava no
  selecionado ao abrir, segue o hover, e retorna ao selecionado ao sair). Ver DDL-0048.

## 57. Level-down reconcilia as magias preparadas (subclasse removida + poda por prioridade)

Corrige o bug em que magias preparadas sobreviviam a um level-down (DDL-0049).

- **Sintoma (relatado):** Paladin 2 com "Protection from Evil and Good" preparada → sobe pro 3
  e pega Devotion (que a concede sempre-preparada), liberando um slot para outra magia →
  level-down. A magia concedida RESSURGIA (a cópia manual que havia COLAPSADO na concessão,
  DDL-0008), duplicando com o substituto, e nada era podado quando o limite encolhia.
- **`reconcileClassSpells(oldCls, newCls, db)`** (novo, `engine/resolve.js`, puro) roda no
  `Builder.setClasses` para toda entrada de classe, DEPOIS do `cleanupClassEntry`:
  1. **Subclasse trocada/removida** → remove de `spells` toda magia que a subclasse ANTIGA
     concedia como sempre-preparada (usa a mesma resolução da derivação, incluindo escolhas do
     bag). Mata a ressurgência; o substituto permanece.
  2. **Level-down** → poda por prioridade até caber nos limites do novo nível: (a) magias cujo
     CÍRCULO o novo nível não alcança mais (Wizard 5→4 perde as de 3º), incondicionalmente;
     (b) depois, as PREPARADAS/cantrips MAIS RECENTES (a ordem do array `spells` é a ordem de
     aprendizado — adicionadas ao fim), até a contagem ≤ o limite. Concessões da classe/subclasse
     ATUAL colapsam mas não contam nem são podadas; arcanum válido do Warlock é preservado.
- Sem mudança de nível nem de subclasse, devolve o MESMO array (sem escrita).
- Verificado: 961 testes (+7, `reconcileClassSpells.test.js`), lint. Ver DDL-0049.

## 58. T1a sessão 10: Rogue + 10 subclasses (TC-0021 fechado, DDL-0050)

Fecha o ÚNICO item aberto do ledger de testes: a semântica condicional do Weapon Mastery do
Rogue (TC-0021), pendente desde a sessão do Barbarian.

- **`weaponFilterAllows` (`engine/choices.js`) ganhou `martialRequiresAnyProp`**: armas SIMPLE
  passam sem restrição; armas MARTIAL só passam se tiverem ao menos uma das propriedades listadas
  (F = Finesse, L = Light). Expressa o RAW do Rogue XPHB ("Simple weapons and Martial weapons that
  have the Finesse or Light property") - a condicional que o filtro plano (kind/noProps/allow) do
  Kensei/Barbarian não conseguia.
- **`MASTERY_FILTERS.rogue = { martialRequiresAnyProp: ['F', 'L'] }`** (`classFeatureChoices.js`).
  Flui de graça pelos dois consumidores que já roteavam por `weaponFilterAllows` (ChoiceList kind
  `weapon` + autoBuild do sweep). Barbarian permanece `{ kind: 'melee' }`; Fighter/Paladin/Ranger
  sem entrada (irrestritos).
- **Verificado ao vivo (Rogue):** o seletor de Weapon Mastery lista 21 armas - todas SIMPLE +
  as MARTIAL com F/L (Rapier F, Scimitar F/L, Shortsword F/L, Hand Crossbow L, Whip F); "Longsword"
  = 0 resultados (martial só Versatile, corretamente barrada). Rapier selecionável, chip renderiza.
  Weapon Mastery mantém count 2 em todos os níveis (Rogue não escala). "Staff"/"Wooden Staff"
  aparecem por serem armas SIMPLE (Versatile + Topple), não é regressão.
- **Sessão T1a completa** (as 10 linhas `class:rogue/*` → `ui: ok`): Arcane Trickster (third-caster
  INT verificado - slots 1st×2, DC 10, cantrips 0/2, prepared 0/3 @3; picker pré-filtrado à lista
  Wizard, 60 resultados); Mastermind (grants curados Master of Intrigue - Tool restrito a 4 Gaming
  Sets + 2 Languages); @19 todos os slots de Feat/Expertise/Epic Boon renderizam (Sneak Attack 10d6,
  PB +6). Mobile 375px sem overflow horizontal; zero erros de console.
- Verificado: 962 testes (+1, `choices.test.js`), lint, sweep 274/274 `--strict`. Ver DDL-0050.

## 59. T1a sessão 11: Sorcerer + 10 subclasses (TC-0039/TC-0040, DDL-0051)

Primeiro full caster da campanha (Artificer/EK/AT eram parciais). Dois achados, ambos corrigidos
em sessão.

- **TC-0039 - Storm Sorcery não concedia Primordial.** Wind Speaker (@3, prosa: "You can speak,
  read, and write Primordial") não tem campo estruturado, e o registro curado não tinha linha para
  sorcerer. `'sorcerer|storm': [{ level: 3, feature: 'Wind Speaker', languages: ['Primordial'] }]`
  em `engine/subclassGrants.js` - mesma família do Sylvan do Shepherd (TC-0032/DDL-0041). Nível 3
  porque no chassi 2024 a umbrella "Storm Sorcery" é reapontada para o nível 3 (o `_copy` XPHB) e a
  subclasse não é escolhível antes disso. Verificado ao vivo: card LANGUAGES = Common, **Primordial**,
  Aarakocra.
- **TC-0040 - `text-transform: capitalize` do PickerField quebrava nomes próprios.** O DOM já
  carregava o nome certo ("Boon of Fortitude"), mas a regra `.name` renderizava "Boon Of Fortitude"
  (e quebraria "Pass without Trace", "Circle of the Land"…). Removida: desde o TC-0016 todo caller
  passa o nome REAL da entidade ou um id já capitalizado, então a muleta de CSS só fazia mal.
- **Sessão T1a completa** (as 10 linhas `class:sorcerer/*` → `ui: ok`). Rep build **Draconic**:
  guided create completo (Dragonborn Red / Magic Initiate (Wizard) / Standard Array com o spread
  recomendado do Sorcerer), overlay de level-up 1→3 e jump a 19 pelo campo Level da aba Class.
  - **Derivações:** L1 HP 8 (d6 + Con 2), AC 11; L3 **AC 14 = Draconic Resilience** (10 + Dex 1 +
    Cha 3, com o rótulo na quebra do card - DDL-0045) e HP 23 (inclui os +3/+1-por-nível da
    Resilience); L19 HP 213 (135 base+Resilience, +38 Tough, +40 Boon of Fortitude), slots
    **4/3/3/3/3/2/1/1/1**, DC 19, ataque +11, PB +6, prepared 21 / cantrips 6.
  - **Caps DDL-0034 ao vivo:** dois ASIs +2 em Cha saturam em **20** e o Epic Boon leva a **21**.
  - **Metamagic:** 10 opções XPHB no seletor, 2 @2 → 4 @10 → **6 @17** (chips + preview corretos);
    coluna **Sorcery Points** da tabela de classe presente (ScaleValue).
  - **DDL-0040 verificado no chassi Sorcerer:** o picker do guia esconde Prestidigitation/Fire Bolt/
    Magic Missile (Magic Initiate, origem CRUZADA) pelo filtro "Already Prepared" pré-marcado; o
    slot de ASI pré-marca General (Tough só aparece ao limpar o filtro, com badge Origin) e o slot
    de Epic Boon pré-marca Epic Boon (29 boons).
  - **Subclasses:** todas as 10 listadas; swaps @19 verificados - **Divine Soul** (spellSet
    Good/Evil/Law/Chaos/Neutrality → Cure Wounds Always Prepared), **Shadow** (11 magias concedidas +
    Summon Beast com badge "3 Charges" e entrada no card de Uses - frequência honesta, DDL-0011),
    **Wild Magic** (tabela d100 do Surge renderiza), Draconic/Storm/Lunar/Aberrant/Clockwork/
    Spellfire/Pyromancer sem `{@tag}` vazando. A reconciliação DDL-0049 removeu corretamente as
    magias concedidas pela subclasse ANTERIOR a cada troca.
  - Mobile 375px sem overflow (Class/Spellbook/Inventory); zero erros de console.
- Verificado: 963 testes (+2 em `subclassGrants.test.js`), lint, sweep 274/274 `--strict`.
  Ver DDL-0051.

## 60. T1a sessão 12: Warlock + 9 subclasses (TC-0041/TC-0042, TC-0043 aberto, DDL-0052)

Pact Magic de ponta a ponta. Dois achados corrigidos em sessão e um aberto para decisão do usuário.

- **TC-0041 - pré-requisito de MAGIA imprimia só "Spell".** `engine/prereq.js` não tinha renderer
  para a chave `spell`, então o seletor de invocações mostrava "Spell" no lugar do requisito real.
  Novo `spellText`, portado do `Parser.prereqSpellToFull` + `_getHtml_spell` do 5etools: string sem
  sufixo → nome; `#c` → "<Magia> cantrip"; `#x` → "Hex spell or a warlock feature that curses";
  objeto `{choose, entry, entrySummary}` (XPHB) → `entrySummary`. Ao vivo: "Grasp of Hadar …
  Eldritch Blast cantrip", "Agonizing Blast … Warlock Cantrip That Deals Damage, Warlock level 2+".
- **TC-0042 - Resilient não concedia a proficiência em salvaguarda.** O campo
  `savingThrowProficiencies` dos talentos não era lido por ninguém (Resilient é o único caso do
  dataset). Novo `deriveFeatSaveProficiencies(character, db)` (`engine/resolve.js`) dobrado em
  `ctx.proficientSaves`. Sem segunda escolha: o RAW amarra a salvaguarda ao MESMO atributo do +1,
  então lemos os picks `ability` do sub-bag do próprio talento (entradas fixas seriam concedidas
  direto). Ao vivo: apontar o +1 do Resilient para Dex adiciona Dexterity ao card SAVING THROWS.
- **TC-0040 completado.** A sessão anterior removeu o `text-transform: capitalize` do PickerField;
  os CHIPS tinham a mesma regra (`ChoiceList.module.css` e `BackgroundTab.module.css`) e mostravam
  "Pact Of The Blade". Removidas também - os rótulos já chegam com a grafia certa. As regras de
  `ClassTab .subTab` e `Home .sub` FICAM (ali o texto é um id minúsculo e o capitalize ajuda).
- **TC-0043 (aberto, needs-user-eyes):** as listas EXPANDIDAS de subclasse legada (Hexblade/Genie/
  Fathomless/Undying, e por tabela todo domínio/círculo pré-2024) não contam como "lista da classe"
  no seletor, então preparar Fireball num Genie avisa "not on the Warlock spell list". Não é
  bloqueio (DDL-0026), mas o aviso está errado. Três saídas registradas no ledger.
- **Sessão T1a completa** (as 9 linhas `class:warlock/*` → `ui: ok`). Rep build **Hexblade**:
  guided create (Tiefling / linhagem Infernal / size Medium / Tough) → L1 HP 12, AC 13 (Leather do
  kit), pact slot **Pact (1st) ×1**, DC 13; jump a 19 (HP 174 → 214 com o boon).
  - **Pact Magic no card:** `Pact (5th) ×4` + linhas **6th/7th/8th/9th "1/Long Rest"**, contadores
    `2/4 CANTRIPS`, `2/15 PREPARED` e **`0/4 ARCANUM`** (DDL-0010). Preparar Eyebite (6º) marca
    **MYSTIC ARCANUM + 1/LONG REST** na linha e conta no arcanum, NÃO no prepared.
  - **Invocações:** 1 @1 → **10 @18** (a coluna cresce certo); 58 opções no total com os
    pré-requisitos escritos nos cards e o filtro Met/Not Met/Unverifiable; sem repetição (o
    escolhido sai do pool). Pact of the Blade escolhido no nível 1 pelo guia.
  - **Grants curados do Hexblade** (Hex Warrior) no card: Medium Armor, Shields, Martial Weapons;
    saves base Wisdom/Charisma corretos.
  - **Swaps @19:** Genie (spellSet Dao/Djinni/Efreeti/Marid), Fiend (featureoption Fiendish
    Resilience @10 com as 12 opções de dano; 11 magias concedidas), Fathomless (**Evard's Black
    Tentacles 1/Day** no card de Uses), Archfey/Celestial/Great Old One/Undead/Undying - todas sem
    `{@tag}` vazando. A reconciliação DDL-0049 retirou as magias do patrono anterior a cada troca.
  - Mobile 375px sem overflow (Class/Spellbook/Inventory/Background); zero erros de console.
- Verificado: 967 testes (+4), lint, sweep 274/274 `--strict`. Ver DDL-0052.

## 61. T1a sessão 13: Wizard + 13 subclasses (TC-0044/TC-0045, DDL-0053) - T1a CONCLUÍDA

A última classe da T1a. Dois achados, ambos corrigidos em sessão - e o TC-0045 é transversal a
TODA subclasse legada adotada num chassi 2024.

- **TC-0044 - Forest Gnome só ganhava Speak with Animals no nível 3.** A prosa do XPHB concede as
  duas magias da linhagem sem nível nenhum ("You know the Minor Illusion cantrip. You also always
  have the Speak with Animals spell prepared"), mas o `additionalSpells` põe a segunda sob
  `innate: {3: …}`. Mesma família do TC-0026 (a prosa manda), só que aqui a magia EXISTE no dado e
  está no nível errado - corrigir é MOVER, não acrescentar. Novo registro curado
  `REGRADED_ADDITIONAL_SPELLS` (`engine/grantedSpellUses.js`) com `{bucket, spell, from, to}`,
  aplicado dentro do `curatedAdditionalSpells` por um par `takeSpell`/`putSpell` que preserva o
  CAMINHO da estrutura de frequência (`{daily: {pb: […]}}` sai do nível 3 e entra igual no 1) e
  poda o nível que ficou vazio. Varredura de `races.json` confirmou que é o ÚNICO caso do dataset:
  as demais espécies com grant tardio dizem "Starting at 3rd level" na prosa (Flamekin/Rimekin LFL
  via `_copy` do Genasi). Ao vivo: Gnome/Forest Gnome nível 1 → "Speak with Animals · ALWAYS
  PREPARED · 2/DAY · RITUAL" na aba da linhagem.
- **TC-0045 - features de subclasse legada apareciam um nível cedo demais.** Uma subclasse pré-2024
  adotada numa classe 2024 é um stub `_copy` que reaponta a UMBRELLA para o nível novo (School of
  Conjuration PHB 2 → 3), mas os `refSubclassFeature` dentro dela seguem apontando as sub-features
  no nível ANTIGO - e o stub de nível 3 é ele mesmo um `_copy` do de nível 2, então herda os
  mesmos refs. Resultado: Conjuration Savant e Minor Conjuration renderizavam sob **LEVEL 2**,
  antes mesmo de a subclasse ser escolhível (nível 3). `subclassFeatureList`
  (`engine/subclassPreview.js`) passou a propagar o nível da umbrella (`emitFeature(f, atLevel)`) -
  é como o 5etools renderiza (aninhadas nela). Quando os níveis já coincidem (todo o conteúdo
  2024) o override não muda nada. Alcança o card de Features, o preview do seletor e a progressão.
  Só exibição: o gate `level <= cls.level` nunca podia conceder cedo, porque a subclasse não existe
  abaixo do nível dela.
- **Sessão T1a completa** (as 13 linhas `class:wizard/*` → `ui: ok`). Rep build **Evoker**: guided
  create (Gnome / linhagem Forest / Magic Initiate (Wizard) / Standard Array com o spread do
  Wizard) → L1 HP 8, AC 11, slots 1st×2, DC 13, atk +5, 3/3 cantrips, 4/4 prepared.
  - **Overlay 1→3:** Scholar @2 com o pool de Expertise corretamente restrito às perícias em que já
    há proficiência (Arcana/History); a lista de passos foi RECONSTRUÍDA ao vivo depois do pick.
    @3 subclasse + as duas magias do Evocation Savant (pool = Evocação, nível ≤ 2, direto da
    expressão de filtro do dado).
  - **@19:** HP 116, PB +6, slots **4/3/3/3/3/2/1/1/1**, DC 19, atk +11, 5/5 cantrips, 24/24
    prepared; badge **13** (5 slots de feat + 7 chooses do savant + magias). Caps do DDL-0034 ao
    vivo: 4 ASIs saturam Int em 20 e o Epic Boon leva a **21**.
  - **Todas as 13 subclasses** verificadas por swap @19: os 4 schools PHB, War XGE, Chronurgy/
    Graviturgy EGW, Scribes TCE, Abjurer/Diviner/Evoker/Illusionist XPHB, Bladesinger FRHoF. Zero
    `{@tag}` vazando. Os 4 XPHB emitem os 9 spell chooses (2 @3 + 1 por nível de slot novo) com o
    pool certo por nível; Diviner mostra o featureoption **The Third Eye** @10 (3 opções);
    Bladesinger traz o grant curado (Melee Martial sem Two-Handed/Heavy) + o choose de perícia
    restrito a Athletics/Performance/Persuasion (Acrobatics some por já ser proficiente).
  - Mobile 375px sem overflow; zero erros de console.
- Verificado: 972 testes (+5), lint, sweep 274/274 `--strict`. Ver DDL-0053.

## 62. Alargamento de lista de magias: `expanded` vira "on-list" (TC-0043, DDL-0054)

Fecha o último item aberto do ledger de testes, com o escopo ampliado pelo usuário: não só os
patronos de warlock, mas todo mecanismo que ACRESCENTA magias à sua lista sem concedê-las.

- **O problema.** O conjunto "on-list" do seletor era só `classSpellList(db, origin.spellListClass)`.
  Então um Warlock do Genie que preparasse Fireball - magia que a subclasse literalmente adiciona à
  lista dele - recebia "Fireball is not on the Warlock spell list", e a magia ficava escondida atrás
  do filtro Class pré-marcado. O aviso não bloqueia (DDL-0026), mas estava factualmente errado.
- **Novo módulo puro `engine/spellListWidening.js`.** `expandedSpellNames` lê o bucket `expanded`
  nas três formas que o dataset usa: **nomes soltos** com chave `sN` (= "quando você tiver espaços
  do círculo N", o Expanded Spell List dos 9 patronos legados) ou numérica (nível de classe);
  **`{all: "level=N|class=X"}`** (Divine Soul, a lista de clérigo um círculo por vez); e **`{all}`
  com LISTAS nos dois campos** (`level=1;2;3;4;5|class=Cleric;Druid;Wizard` + `s6..s9` - o Magical
  Secrets do Bardo @10). Grupos múltiplos mantêm a semântica de ALTERNATIVA do TC-0011: sem a
  afinidade/elemento escolhido, nada alarga. `originExtraSpells` junta classe + subclasse e devolve
  também de ONDE veio cada magia.
- **Derivação + UI.** A origem de classe ganhou `expandedSpells` (Set de nomes) e `expandedFrom`
  (nome → fonte). A SpellbookTab e o SpellPicker do guia unem isso ao `listNames` - o que mata o
  aviso - e passam ao `makeSpellEntity`, que injeta a classe da origem em `filterValues.class`
  dessas magias (é o que o RAW diz: "count as Warlock/Bard spells for you", então elas aparecem no
  filtro padrão) e acrescenta um badge com a fonte ("The Genie", "Divine Soul", "Magical Secrets").
  Mesmo padrão do `preparedElsewhere` (TC-0031).
- **Escopo corrigido.** O registro original do TC-0043 dizia que o problema valia "por tabela" para
  toda subclasse pré-2024. Errado: a varredura de todos os `class-*.json` mostra `expanded` com
  nomes soltos em exatamente **9 subclasses, todas de Warlock**. Domínios de clérigo e círculos de
  druida CONCEDEM (`prepared`), não alargam. E o Magical Secrets do Bardo, que parecia ser só prosa
  (`{@filter}` tags), está inteiro no dado - o registro curado que eu tinha escrito para ele foi
  REMOVIDO por ser redundante e menos preciso (liberava os círculos 6-9 cedo demais). Hoje nenhum
  alargador vive só em prosa; o cabeçalho do módulo documenta isso.
- **Não são alargamento** (verificados um a um): Lore/Magical Discoveries e Arcana/Arcane Initiate
  são escolhas CONCEDIDAS; Psionic Spells e Clockwork Magic são regra de troca restrita às magias
  daquela tabela; Lunar Boons é metamagia; Psychic Spells é tipo de dano.
- Verificado ao vivo (Genie/Efreeti 19: Fireball sem aviso, badge "The Genie", visível no filtro
  Warlock; Divine Soul 3: Guiding Bolt com badge "Divine Soul", e sem a afinidade escolhida o
  alargamento corretamente não vale) + 7 testes novos; 979 testes, lint, sweep 274/274 `--strict`.

## 63. Level-up DENTRO do Foundry: escada de ItemGrant com UUIDs de compêndio (DDL-0055)

Relato do usuário: exportar um Barbarian 1, importar no Foundry e subir para o nível 2 **não
concedia Reckless Attack nem Danger Sense**. As fichas premade de nível 1/5/11 que ele adicionou ao
material de referência foram o que fechou o diagnóstico.

- **Causa raiz.** No Foundry quem concede as features de um nível é o `advancement[]` do item de
  CLASSE: um `ItemGrant` por nível cujo `configuration.items[].uuid` aponta para o compêndio. Nos
  premades oficiais essa escada está presente **inteira (níveis 1..20) desde o nível 1** - os níveis
  ainda não alcançados trazem a receita preenchida e o `value` vazio. Nós só emitíamos ItemGrant
  para os níveis JÁ alcançados, e com uuid RELATIVO (`.${_id}`) para itens embutidos no ator. Um
  Barbarian 1 exportado, portanto, não tinha receita nenhuma para o nível 2.
- **Registro de UUIDs gerado (`npm run gen:uuids`).** `scripts/gen-compendium-uuids.js` lê o source
  do sistema dnd5e (MIT + SRD/CC-BY, git-ignored) e emite `src/engine/compendiumUuidsData.js` com
  APENAS identificadores - 159 features de classe, 12 subclasses SRD, 58 features de subclasse e 340
  magias. Nenhum texto de regra é copiado. Os ids não são deriváveis por regra (`phbDivineOrderPr`,
  `phbbrbImp2Brutal`, `phbdrdCirland000`), daí a tabela. A API de consulta é
  `src/engine/compendiumUuids.js` (puro, case-insensitive, casa subclasse por nome completo ou
  shortName).
- **As escadas.** `buildClassFutureGrants` (features de classe acima do nível atual) e
  `buildSubclassFutureGrants` (features de subclasse **e** as magias sempre-preparadas que ela
  concede por nível - o delta entre `grantedSpells(nível)` e `grantedSpells(nível-1)`, passando pelo
  registro curado do TC-0026/TC-0044) entram no advancement via a nova opção `futureGrants`. Saída
  conferida contra o premade: um Paladin 3 nosso gera exatamente os mesmos uuids do Krusk L5 nos
  níveis 7/15/20 (features) e 5/9/13/17 (magias do juramento).
- **Níveis alcançados continuam com uuid relativo**, o que preserva o suporte a TODO o conteúdo
  (inclusive não-SRD). A escada futura só existe onde o dnd5e publica: as 12 classes XPHB e uma
  subclasse por classe. Fora disso (Artificer, subclasses não-SRD) nenhum passo é emitido - melhor
  não ter escada do que apontar para um documento inexistente; ali o fluxo segue sendo subir de
  nível no app e re-exportar. O título dos ItemGrant alcançados passou de `Features` para
  `Class Features` (o dos premades).
- **Dois bugs vizinhos de Weapon Mastery, achados na investigação e corrigidos junto:**
  - `mode: 'default'` → **`mode: 'mastery'`** (era o que fazia o Foundry registrar proficiência de
    arma em vez de maestria), com pool `weapon:*` como nos premades - a restrição RAW por classe
    (DDL-0033/DDL-0050) é do lado do builder, o que vai no `chosen` já é válido.
  - A contagem **não crescia**: era lida fixa no nível 1, então um Barbarian 10 exportava `count: 2`
    com 4 maestrias escolhidas. Agora sai um Trait por breakpoint com o DELTA daquele nível (2@1,
    +1@4, +1@10), e os escolhidos são FATIADOS entre eles na ordem; um breakpoint acima do nível
    atual fica sem `chosen` (pendente no Foundry, como deve).
  - No import, o efeito colateral: ele SOBRESCREVIA `weaponMastery` a cada Trait, ficando com o
    último. Agora ACUMULA em ordem de nível. Isso conserta também a importação dos premades REAIS -
    o Randal L5 (3 maestrias @1 + 1 @4) perdia três delas silenciosamente.
- Verificado: 994 testes (+14), lint, **sweep 274/274 `--strict`**, paridade de uuid com o premade
  do Paladino, e re-importação dos premades reais Krusk L1/L5, Randal L5 e Akra L11.

## 64. Level-up no Foundry, parte 2: Traits de nível futuro, procedência e o caso "(2)" (DDL-0056)

Fecha o resto do que a §63 deixou aberto, comparando o nosso export com os premades de nível 1/5
linha a linha. Três frentes, escolhidas pelo usuário.

- **Traits de ESCOLHA no nível delas.** O premade emite um `Trait` no nível em que a feature concede
  proficiência: `Primal Knowledge @3` (Barbarian), `Expertise @1 e @6` (Rogue), `Deft Explorer @2`
  (Ranger, com um Trait de expertise e outro de idiomas), `Bonus Proficiencies @3` no item da
  SUBCLASSE (College of Lore). Nós só mandávamos isso em `flags.builder5e.choices`, que o Foundry
  ignora - então subir de nível não perguntava nada. Novo `buildChoiceTraits` (+
  `buildClassChoiceTraits` / `buildSubclassChoiceTraits`) converte os MESMOS descritores que a UI usa
  (`classLevelChoices`, `classToolChoices`, `subclassFeatureChoices`, agora até o nível 20) em Traits:
  `mode: 'expertise'` para expertise (o Foundry oferece as perícias em que você já é proficiente),
  pool restrito quando o grant restringe, `value.chosen` no que já foi escolhido e vazio no futuro
  (pendente). A flag CONTINUA sendo a fonte da verdade do re-import - o import não mudou.
- **`_stats.compendiumSource` em todo item que o dnd5e publica.** O gerador ganhou os pacotes de nome
  plano (`origins24`, `feats24`, `equipment24`) e o id do documento de cada classe; a API ganhou
  `classUuid`/`originUuid`/`featUuid`/`equipmentUuid`. Agora classe, subclasse, features, espécie,
  talentos, magias e inventário saem com procedência - 14 de 16 itens num Rogue 5 típico, e os dois
  que faltam estão certos (o background é custom por design e o talento não é SRD). A busca é por
  nome EXATO: linhagem mesclada e variante mágica gerada não casam e ficam sem procedência, em vez de
  apontar para o documento errado. Apóstrofo tipográfico é normalizado dos dois lados.
- **Feature re-listada que vira um segundo item.** O 5etools re-lista uma feature nos níveis em que
  ela melhora e nós dedupamos por nome, mas o dnd5e publica "Improved Brutal Strike (2)" para a
  melhoria do Barbarian @17 - nosso nível 17 ficava vazio. `relistedFeatureGrants` procura
  `"<Nome> (N)"` na N-ésima re-listagem. Varredura do dataset: é o **único** caso; toda outra
  re-listagem (ASI, Subclass Feature, Expertise, Metamagic, Mystic Arcanum) não tem item próprio e a
  consulta devolve null. Com isso a lista de níveis do nosso Barbarian 1 (`1,2,3,5,7,9,11,13,15,17,
  18,20`) passou a ser **idêntica à do premade Merric**.
- Verificado: 1001 testes (+7), lint, sweep 274/274 `--strict`, e conferência ao vivo dos Traits
  gerados para Barbarian/Rogue/Ranger/Bard contra os premades correspondentes.

## 65. Overlay foundry-*.json adotado por completo + os achados avulsos do level-up (DDL-0057)

Fecha o item de backlog do overlay (que o DDL-0031 tinha deixado em "effects only") e os quatro
problemas que a revisão de level-up havia listado sem corrigir.

**Overlay completo.** Além dos Active Effects, agora entram:
- **`activities`** (~500 entradas). O overlay guarda um ARRAY e o dnd5e quer um MAPA por `_id`;
  além disso as activities referenciam seus efeitos por um apelido (`effects: [{foundryId:
  'naturesVeil'}]`). `overlayMechanics` gera os `_id` dos effects primeiro e resolve os apelidos
  contra eles - link órfão é descartado, nunca emitido quebrado.
- **`system`** (uses/range/duration), que vem em DOT-PATH (`uses.max`) e é expandido; `uses` recebe
  o `spent` que o dnd5e exige e o overlay omite.
- **`advancement`**, que no overlay é só ScaleValue - exatamente o que `CURATED_SCALE_VALUES` fazia
  à mão para duas classes. Fighter e Cleric seguem curados (premade-validados; a escala do Cleric é
  referenciada por uma activity), as outras dez vêm do overlay sem repetir título que a tabela já
  produziu, e as **subclasses ganham ScaleValue pela primeira vez** (Superiority Dice do Battle
  Master, Dreadful Strike do Gloom Stalker…).
- **Traços de espécie com ação/recurso viram ITEM próprio** (`feat` + `system.type.value: 'race'`,
  ItemGrant de nível 0 no item de raça - o formato dos premades). É o que destrava as 66 activities
  de `foundry-races`: um Active Effect transferido alcança o ator de qualquer item embutido, mas
  uma AÇÃO só existe pendurada num item. Quem só tem effect continua sem item, e o item de raça
  deixa de carregar o effect do traço que ganhou item (senão sairia em dobro). Dragonborn, Aasimar,
  Dwarf e Goliath passam a exportar Draconic Flight / Celestial Revelation + Healing Hands /
  Stonecunning / Large Form como itens usáveis.
- Precedência: o curado continua vencendo, mas agora **por bloco** - effects seguem tudo-ou-nada,
  `uses` e `activities` são independentes (uma feature pode ter effect curado e nenhuma activity).
  O casamento segue edição-estrito: a mecânica de uma feature TCE não vai para a reimpressão XPHB.

**Achados avulsos, corrigidos:**
- **Import de premade recupera as escolhas de proficiência.** O importador só lia os Traits de
  perícia inicial e maestria, então um Rogue premade vinha sem NENHUMA expertise. Agora casa os
  Traits contra os mesmos descritores que o export usou, por (título, nível) + kind
  (`choiceTraitTitle` é a fonte única dos dois lados). Verificado: Riswynn volta com
  Sleight of Hand/Stealth, Beiro com Performance/Persuasion, Quillathe com o Deft Explorer,
  Merric com o Primal Knowledge. Nos NOSSOS atores a flag continua chegando depois e vencendo.
- **`classRestriction` segue o dado.** Era `'primary'` fixo em todo Trait; agora 'primary' só onde
  a multiclasse dá coisa diferente, com o par 'secondary' gerado de `multiclassing.
  proficienciesGained`, e NENHUMA restrição quando os conjuntos são iguais. A saída do Barbarian e
  do Rogue ficou idêntica à dos premades Merric e Riswynn.
- **ScaleValue "Weapon Mastery" removido**: a contagem já é modelada pelos Traits `mode: 'mastery'`
  por breakpoint, e os premades não têm o ScaleValue homônimo.
- **`autoBuild` deduplica entre escolhas irmãs** do mesmo kind: o `owned` do ctx é um retrato do
  início da passada e não via o que a irmã acabou de escolher, então um Rogue gerado repetia a
  perícia nas duas expertises - algo que a UI não permite.
- Verificado: 1017 testes (+16), lint, sweep 274/274 `--strict`, e os **48 premades** importados e
  re-exportados sem falha.

**Escopo removido do backlog (decisão do usuário, não adiamento):** criar personagem direto em
nível alto e conteúdo sidekick/UA **não serão features do FlyBy**. Ver a subseção
"Explicitly OUT OF SCOPE" no CLAUDE.md §4.

---

## 66. Sub-raças legadas voltam como linhagens curadas da espécie atual (DDL-0058 → DDL-0059)

**O problema.** A política `latestOnly` esconde uma raça reprintada, e com ela somem por
COLATERAL as SUB-RAÇAS dessa base: elas não têm `reprintedAs` próprio, mas `raceLineages` só roda
sobre as bases LISTADAS. Eram **24** entradas sem nenhum equivalente 2024 — as legacies infernais
do Tiefling, o Pallid Elf, Ghostwise/Lotusden, o Keldon.

**A curadoria (manual, olho a olho).** **15 voltam, 9 foram descartadas.** O critério do usuário:
descartável quando existe uma versão moderna AUTÔNOMA mais completa. Fora ficaram:
- `Eladrin` (Elf|PHB) → `Eladrin|MPMM` já é espécie própria.
- `Asmodeus|MTF` → a entrada não tem mecânica NENHUMA no dado; é o tiefling PHB padrão.
- `Variant; Infernal Legacy|SCAG` → Thaumaturgy/Hellish Rebuke/Darkness, idêntica à Fiendish
  Legacy (Infernal) do XPHB.
- As 4 `Variant; … Descent` do Half-Elf → a base atual delas seria o `Khoravar|EFA`.
- `Draconblood` e `Ravenite` → o Dragonborn XPHB põe a ancestralidade nas próprias `_versions`
  (as 10 cores), então como linhagens IRMÃS elas ficariam sem tipo de dano para o sopro.

A saída automática do DDL-0058 marcava `Ravenite` e os `Descent` como redundantes por
COINCIDÊNCIA DE SUBSTRING (Ravenite→"Aven|PSA", Descent→"Elf|LFL"); conferidos à mão, o Ravenite
não tinha equivalente nenhum — foi descartado por outro motivo. Não confie naquela heurística.

**Como foi feito.** Registro fechado `engine/legacySubraces.js` (`LEGACY_SUBRACES`), consumido por
`subraceVersions`: a sub-raça é fundida na base ATUAL pelo MESMO merge das sub-raças normais, então
entra como mais uma LINHAGEM e tabs, guia, completude, import, sweep e export já funcionam sobre
ela — nada de mexer no `latestOnly` ou em qualquer selector.

- **O `ability` legado (+2/+1) é IGNORADO** (decisão do usuário no DDL-0058): o FlyBy segue as
  regras 2024, onde os boosts vêm sempre da origem. O campo é descartado ANTES do merge, senão o
  merge posicional o reintroduziria numa base 2024 que não o tem.
- **`supersedes`**: uma sub-raça 2014 substituía o traço-de-linhagem 2014 (`data.overwrite:
  "Infernal Legacy"`), cujo nome mudou no chassi 2024 ("Fiendish Legacy") — o merge não achava o
  alvo e ANEXAVA, deixando a ficha com o traço 2024 pedindo para escolher uma legacy AO LADO da
  legacy escolhida. O registro declara qual traço da base a linhagem ocupa.
- **`LEGACY_PROSE_SECTIONS`**: Age/Alignment/Size/Speed/Languages eram seções de PROSA de uma raça
  2014 que o chassi 2024 expressa em campos estruturados. O Keldon traz as quatro; anexadas,
  virariam texto morto na ficha. Descartadas de toda sub-raça legada (só o texto, nunca o campo).
- **`requiresLineage(db, race)`** — só as linhagens NATIVAS obrigam a escolha (DDL-0018). Sem isso,
  ganhar Ghostwise/Keldon como OPÇÃO passaria a IMPEDIR de construir um halfling ou um humano 2024
  simples. A matriz do sweep também voltou a emitir a linha da base quando a linhagem é opcional.
- **Fix de exibição, pré-existente**: o chip de linhagem mostrava a fonte da BASE, não a da
  linhagem ("Zariel **XPHB**"). Já estava errado para Genasi/Half-Orc SCAG; agora sai "Zariel MTF".

**Limitação aceita** (DDL-0058 item 5): conteúdo legado não tem uuid de compêndio (o registro do
DDL-0055 é SRD 2024), então essas linhagens exportam sem procedência e sem escada de level-up —
degrada como o Artificer já degrada.

**Verificado:** 1026 testes (+9, `legacySubraces.test.js`), lint, **sweep 289/289 `--strict`**
(+15 linhas, exatamente as curadas, com `species:Halfling|XPHB` e `species:Human|XPHB` preservadas),
e passada ao vivo: as 14 linhagens do Tiefling com rótulo e fonte certos, Zariel derivando
Thaumaturgy por Charisma (DC 10/+2) e sem "Fiendish Legacy" órfão, Keldon sem a prosa 2014,
Halfling completo sem linhagem, mobile 375px sem overflow e zero erros de console.

---

## 67. Sub-raça legada: espécie à parte por BALANCEAMENTO; linhagem vira a exceção (DDL-0060)

**O achado do usuário.** Ghostwise e Lotusden não podiam ser linhagens do Halfling XPHB, porque são
sub-raças de uma versão DIFERENTE da base. Na revisão seguinte o critério foi generalizado: costurar
uma sub-raça 2014 num chassi 2024 quase sempre a torna **obviamente superior** às linhagens oficiais,
porque ela soma as vantagens dos dois — e no caso do Human deixa a espécie base sem propósito. O dado
confirma, base por base:

| espécie | base 2014 | base 2024 | o que empilhava | veredito |
|---|---|---|---|---|
| **Halfling** | Lucky / Brave / Nimbleness | + **Naturally Stealthy** | o traço do *Lightfoot*, de graça | **espécie** |
| **Tiefling** | Darkvision / Hellish Resistance / Infernal Legacy | Darkvision / Fiendish Legacy / **Otherworldly Presence** | Thaumaturgy de graça + resistência à ESCOLHA (uma legacy 2024 fica travada na dela) | **espécie** |
| **Human** | (só prosa) | Resourceful / Skillful / **Versatile** | um TALENTO de origem, de graça | **espécie** |
| **Elf** | Darkvision / Keen Senses / Fey Ancestry / Trance | os mesmos 4 + "Elven Lineage" (guarda-chuva) | nada — o `supersedes` remove o guarda-chuva | linhagem |

**A regra, invertida.** O campo `as` do registro continua, mas **`'species'` passou a ser o padrão
de fato (14 das 15) e `'lineage'` a exceção (1)**. Para uma entrada nova: liste os traços da base
2024 e os da 2014 — se sobrar QUALQUER coisa na 2024 além do guarda-chuva de linhagem, é
`'species'`. Uma entrada `'species'` normalmente não precisa de `supersedes`: o `data.overwrite` do
próprio dado 2014 ("Infernal Legacy") acha o alvo na base legada e troca no lugar.

**O Elf, caso a caso.** É a única base que se manteve consistente entre as edições, então o Pallid
não empilha nada: fica com a base + o pacote próprio, igual ao Drow/High/Wood. Ele troca o upgrade
de sentido/velocidade dos outros três (dv 120, 35 ft) por um traço extra (Incisive Sense) — mesma
faixa de poder. O único ganho de andar no chassi 2024 é o Keen Senses virar escolha de 3 perícias,
que as três oficiais também têm.

**Resultado.** Halfling e Human XPHB voltam a não ter linhagem nenhuma; o Tiefling XPHB volta às 3
legacies oficiais. As 14 legadas viram espécies irmãs no seletor, sobre o chassi 2014 correto:
- `Halfling (Ghostwise)` = Lucky / Brave / Nimbleness / **Silent Speech**, 25 ft — sem Naturally Stealthy;
- `Tiefling (Zariel)` = Darkvision / **Hellish Resistance** (fogo FIXO) / Legacy of Avernus — sem
  Otherworldly Presence e sem resistência à escolha;
- `Human (Keldon)` = só Natural Athlete / Keldon Resilience / Icehaven Born.

**`speciesCatalog(db)` é a lista única de espécies.** Uma espécie legada não está em
`db.races.race`, então toda resolução por nome tem de passar por ela — senão a ficha perde a
espécie ao recarregar ou ao reimportar. Migrados os três pontos: `resolveRaceObj` (engine),
`findBaseRace` e `resolveRaceByExactName` (import do Foundry); a entity do seletor concatena
`legacyStandaloneSpecies(db)`. Novos consumidores devem usar `speciesCatalog`, nunca a lista crua.

**Verificado:** 1029 testes, lint, **sweep 289/289 `--strict`** (as linhas viraram
`species:Tiefling (Zariel)|MTF` etc.; o round-trip do export segue verde), e ao vivo: os 12
tieflings + Ghostwise/Lotusden/Keldon como espécies irmãs, o Zariel derivando o pacote 2014 correto
e **sobrevivendo a um reload** (é o que prova o `speciesCatalog`), e o Tiefling 2024 de volta às 3
legacies. Mobile 375px sem overflow, zero erros de console.

## 68. Tiefling: as legacies legadas voltam REESCRITAS no formato 2024 (DDL-0061)

**A virada.** O §67 tinha empurrado as 11 legacies do Tiefling para fora da espécie 2024 porque,
penduradas nela, empilhavam vantagens: ganhavam o Thaumaturgy de graça (Otherworldly Presence) e a
resistência EM ABERTO por cima do pacote próprio de magias. O usuário propôs o contrário — em vez de
FUGIR do empilhamento, **neutralizá-lo na fonte** e devolver as legacies ao lugar delas: uma linha a
mais na tabela de Fiendish Legacies.

**Os três vazamentos, fechados.**

| vazamento | correção |
|---|---|
| resistência à escolha (poison/necrotic/fire) | **trava em fogo** — é o "Hellish Resistance" 2014, que era fogo fixo |
| Thaumaturgy de graça | a legacy cujo cantrip **era** Thaumaturgy fica **sem cantrip próprio** (Baalzebul, Dispater, Zariel, Hellfire) |
| Carisma fixo | vira o **Int/Wis/Cha à escolha** do padrão 2024, em texto **e** mecânica |

Com isso a paridade é exata: oficial = resistência (à escolha) + cantrip + magia@3 + magia@5 +
Thaumaturgy; legada = resistência (travada em fogo) + cantrip? + magia@3 + magia@5 + idem.

**As 11 (das 12; Asmodeus e "Variant; Infernal Legacy" seguem descartadas — §66).** Todas as magias
remapeadas para XPHB; o `#2` do dado (conjurar num círculo acima) foi MANTIDO, era a compensação de
2014 por listas mais fracas.

| Legacy | nível 1 (além da resistência a fogo) | nível 3 | nível 5 |
|---|---|---|---|
| Baalzebul | — | Ray of Sickness (2º) | Crown of Madness |
| Dispater | — | Disguise Self | Detect Thoughts |
| Fierna | Friends | Charm Person (2º) | Suggestion |
| Glasya | Minor Illusion | Disguise Self | Invisibility |
| Levistus | Ray of Frost | Armor of Agathys (2º) | Darkness |
| Mammon | Mage Hand | Tenser's Floating Disk | Arcane Lock |
| Mephistopheles | Mage Hand | Burning Hands (2º) | Flame Blade |
| Zariel | — | Searing Smite (2º) | **Shining Smite** |
| Devil's Tongue | Vicious Mockery | Charm Person (2º) | Enthrall |
| Hellfire | — | Burning Hands (2º) | Darkness |
| Winged | voo 30 ft (fora de armadura pesada) | — | — |

Achado do levantamento: as 23 magias envolvidas têm versão XPHB **1:1, exceto Branding Smite**, que
foi reimpressa com outro nome (`Shining Smite|XPHB`) — é a única remapagem manual. Duas
normalizações menores: o Floating Disk do Mammon recarrega em descanso **longo** como todas (o dado
2014 dizia "curto ou longo") e o "sem componente material" do Arcane Lock cai — o formato 2024 não
tem onde pendurar rider por magia.

**O texto é MONTADO do próprio dado, não escrito por nós** (DDL-0003: enviamos código, nunca
conteúdo). A versão oficial "Tiefling; Infernal Legacy" serve de **template** — a resistência dela já
é fogo, como a nossa — e só as tags `{@spell}` são trocadas; a frase do cantrip é removida quando não
há cantrip próprio; a nota de upcast é a única frase autoral. A "Appearance" das variantes SCAG e o
texto do voo do Winged são puxados da sub-raça de origem. Se o texto mudar upstream, o nosso muda
junto — e **sem o template no dado, nenhuma legacy é gerada** (melhor não oferecer do que oferecer
muda).

**Forma da implementação.** `engine/legacyFiendishLegacies.js` produz DESCRITORES no formato
`_versions`, então eles passam pelo mesmo `buildVariant` das linhagens nativas e **nada a jusante
precisa saber que são especiais** — seletor, completude, guia, sweep, export e import já trabalham
sobre linhagens. As 11 linhas saíram do `LEGACY_SUBRACES` (que segue sendo o registro das que voltam
**sem** reescrita).

**Tabela do preview.** `withLegacyTable` anexa uma linha por legacy à tabela "Fiendish Legacies" do
traço da base — o preview passa a listar as mesmas 14 opções que o seletor de linhagem oferece. É
idempotente (dedup pelo rótulo), não muda o objeto do compêndio, e numa linhagem já resolvida não
faz nada (o traço com a tabela foi substituído).

**Migração.** Uma ficha salva enquanto estas eram ESPÉCIES à parte (`Tiefling (Zariel)|MTF`,
2026-07-22 → 23) volta a ser Tiefling XPHB + linhagem no `migrate` do schema — sem isso ela perderia
a espécie ao recarregar, porque o nome antigo não existe em catálogo nenhum.

**Bug pré-existente do sweep, corrigido de passagem.** `parseExistingCoverage` cortava a linha do
COVERAGE com `split('|')`, mas o id de uma linha de ESPÉCIE **contém** um pipe
(`species:Elf|XPHB/…`): as células deslizavam e **as colunas manuais UI/Export/Notes de toda linha de
espécie se perdiam a cada varredura**. O pipe passa a ser escapado ao escrever e o corte só acontece
nos pipes não-escapados; as notas apagadas foram restauradas e a preservação verificada com duas
varreduras seguidas.

**Verificado:** 1050 testes (+24), lint, **sweep 289/289 `--strict`** (as linhas voltaram a
`species:Tiefling|XPHB/Tiefling; Zariel Legacy`), e ao vivo: o seletor de espécie mostra UM Tiefling,
o de linhagem mostra as 14 com a procedência certa (XPHB/MTF/SCAG), a tabela do preview traz as 14
linhas, o Zariel 5 deriva Thaumaturgy + Searing Smite + Shining Smite (1/Day) com DC por **Carisma**
escolhido e "DAMAGE RESISTANCES: Fire", e o Winged mostra "30 ft, fly 30 ft" + o traço Appearance.
Mobile 375px sem overflow (a tabela rola no próprio contêiner), zero erros de console.

## 69. A base que EXIGE linhagem não oferece as escolhas que a linhagem resolve (+ o voo na tabela)

Dois acertos apontados pelo usuário logo depois do §68.

**1. Escolhas fantasma na espécie base.** Ao selecionar o Tiefling sem linhagem, apareciam chips de
**Damage Resistance** e **Spell List** (e a Spellcasting Ability que serve a eles) que sumiam assim
que uma linhagem era escolhida — porque são a resistência e a lista de magias da BASE, campos que
toda linhagem sobrescreve. Eram ruído puro: o Builder zera o choice-bag ao trocar de linhagem, então
nada do que fosse marcado ali sobreviveria.

A regra nova é **derivada do dado, não curada**: numa espécie que EXIGE linhagem, um campo é adiado
quando **TODA** linhagem traz valor próprio para ele (`lineageDeferredKinds` compara o valor da
variante com o da base). Levantamento do dataset — são exatamente três espécies afetadas:

| espécie | campo adiado | escolhas escondidas | o que PERMANECE |
|---|---|---|---|
| Tiefling XPHB | `resist`, `additionalSpells` | Damage Resistance, Spell List, Spellcasting Ability | Size |
| Elf XPHB | `additionalSpells` | Spell List, Spellcasting Ability | a perícia do Keen Senses |
| Dragonborn XPHB | `resist` | Damage Resistance | (nenhuma) |

A precisão da regra é o caso do Elf: `skillProficiencies` **não** é sobrescrito por linhagem nenhuma,
então a escolha de perícia continua na base — só as duas de magia somem. Com a linhagem escolhida
nada é filtrado (as escolhas já vêm da variante). `filterLineageDeferred` é aplicado nos dois call
sites (SpeciesTab e o SpeciesStep do guia); a completude não diverge porque `speciesStepComplete` já
retorna `false` antes disso quando falta a linhagem.

**2. A tabela não anunciava o voo da Winged.** A linha dela dizia só "You have Resistance to Fire
damage". A causa era a linha ser REPROCESSADA do texto já montado (pegava só o primeiro parágrafo),
e o benefício da Winged mora no segundo. Agora o traço e a linha da tabela saem das **mesmas peças**
(`buildVersion` devolve os dois juntos), então a tabela não tem como discordar do traço: a célula de
nível 1 é tudo que a legacy dá naquele nível — resistência, cantrip e o benefício irregular.

**Verificado:** 1054 testes (+4), lint, sweep 289/289 `--strict`, e ao vivo: Tiefling base só com
Size, Elf base só com a perícia (e as duas de magia voltando ao escolher High Elf), Dragonborn base
sem escolha nenhuma, e a linha "Winged" da tabela com "…Resistance to Fire damage. You have bat-like
wings… flying speed of 30 feet…". Zero erros de console.

## 70. Custom Lineage: "Variable Trait" no lugar de linhagem, `ability` legado fora, talento de ORIGEM

Pedido do usuário: a opção **Custom Lineage** (TCE) tinha vários seletores que não correspondiam ao
que a fonte descreve — a começar por um seletor de **linhagem**, que ela não tem. O RAW dela é:
tamanho (Small/Medium), **um talento**, o **Variable Trait** — (a) visão no escuro 60 ft **ou** (b)
proficiência em uma perícia — e **um idioma** além do Common.

Cinco defeitos reais (TC-0046…TC-0050 em `testing/ISSUES.md`); **três das correções são gerais** e
consertam outras espécies junto.

**1. O seletor tira o nome do DADO (TC-0046).** O Variable Trait está codificado como `_versions`,
que é o que o app chama de linhagem — mas cada versão declara qual traço ela substitui
(`_mod.entries.replace`), e é esse o nome certo do seletor. `lineageSelectorLabel(race)` passa a
usá-lo: "Variable Trait" no Custom Lineage, e de quebra **"Kobold Legacy"**, **"Elven Lineage"**,
**"Gnomish Lineage"**, **"Giant Ancestry"**, **"Fiendish Legacy"** e **"Shifting"** nas outras. Sem
`_versions` (Genasi, cujas linhagens são sub-raças fundidas) ou com `replace` sem letra nenhuma
(Faerie/Kithkin LFL trazem `","`) segue o genérico "Lineage". Vale para o rótulo, o placeholder e o
título do painel — a entity do seletor deriva sozinha, nenhum call site mudou.

**2. Regra de REMOÇÃO: um benefício OU-EXCLUSIVO não é oferecido pela base (TC-0047).** Sem nada
escolhido, o Custom Lineage já mostrava "Choose any skill" **e** derivava Darkvision 60 — os dois
lados do "ou". A regra do §69 não pegava isso: ela exige que TODA linhagem sobrescreva o campo, e
aqui uma das versões o MANTÉM enquanto a outra o ANULA. `lineageDeferredKinds` ganhou a regra irmã:
**adia quando ALGUMA linhagem anula o campo**. Escopo medido no dataset inteiro:

| espécie | campo | efeito |
|---|---|---|
| Custom Lineage TCE | `skillProficiencies` | a perícia só aparece na opção (b) |
| Kobold MPMM | `skillProficiencies`, `additionalSpells` | perícia só no Craftiness, magia só no Draconic Sorcery |
| Goblin PSZ | `resist` | no-op (o campo não gera escolha) |

Perícia/ferramenta/idioma entram **só** por essa regra: pela regra de sobrescrita esconderiam
escolhas legítimas, porque o merge de sub-raça CONCATENA esses campos e o resultado "difere" da base
sem substituí-la.

**3. Espécie não concede aumento de atributo (TC-0048).** O DDL-0058 já tinha fixado que o `ability`
legado é ignorado, mas a limpeza só existia para as sub-raças curadas. O novo
`engine/legacySpeciesRules.js` (`normalizeLegacySpecies`) aplica a regra a QUALQUER espécie, no
`resolveRaceObj` — o único ponto por onde o app pega um objeto de espécie para trabalhar. Some o
"+2 à escolha" do Custom Lineage e também os de **Aetherborn|PSK** e **Simic Hybrid|GGR**, as
únicas outras alcançáveis com o campo.

**4. O talento é de ORIGEM (TC-0049, decisão do usuário).** "One feat of your choice for which you
qualify" era o conjunto inteiro em 2014; o equivalente 2024 de um talento que se ganha ao nascer é a
categoria ORIGIN — a mesma do Human XPHB. Uma linha curada em `FEAT_CATEGORY_OVERRIDES` reescreve
`[{any:1}]` como o `anyFromCategory` do Human. Ao vivo, o seletor passou de "tudo" para as mesmas
25 origens do Human.

**5. `speciesChoices` é a fonte ÚNICA da lista (e um bug de round-trip que ela revelou).** A mesma
expressão (tamanho + `parseChoices` + filtro da linhagem) estava copiada em quatro lugares, e só
dois aplicavam o filtro — a completude do guia e o `autoBuild` do sweep ainda enxergavam o que a
tela escondia. Agora os quatro chamam `speciesChoices({db, baseRace, raceObj, lineage, level, bag})`.
Isso deslocou o RNG do sweep e destapou o **TC-0050**: o pick de idioma `"other"` (o pseudo-idioma
que o 5etools usa para o idioma próprio do cenário — Simic Hybrid: "Elvish ou Vedalken") não tem
chave no dnd5e, então exportava um `languages:standard:other` inválido e sumia na reimportação.
Corrigido pela política do DDL-0028: só idioma REAL vira Trait, e um pick não mapeável manda a
escolha inteira para a flag do item de raça.

**Verificado:** 1071 testes (+17), lint, sweep **289/289 `--strict`**, e ao vivo — Custom Lineage
mostra "Variable Trait / Choose variable trait…" com Size + Language + Feat (sem atributo, sem
perícia); escolher "Skill Proficiency" faz a perícia aparecer; o seletor de talento lista só
origens. Mobile 375px sem overflow, zero erros de console.

---

## 71. Halfling: a linhagem que a edição 2024 não escreveu (DDL-0063)

**O problema, medido e não suposto.** Um censo das **98 sub-raças** do dataset (7 grupos fechados,
registrado em `SPECIES-FAMILIES-PLAN.md`) foi atrás do que ainda está fora do alcance. O grupo que o
DDL-0058 tinha deixado de fora POR DEFINIÇÃO — as **20 que o 5etools marca como reimpressas na
PRÓPRIA base 2024** — nunca tinha sido conferido item a item. Conferido agora, o conteúdo mecânico
realmente perdido no dataset INTEIRO são **dois traços**: *Dwarven Armor Training* (Mountain Dwarf) e
*Stout Resilience* (Stout Halfling). Todo o resto é redundante de fato (Drow/High/Wood e Forest/Rock
viraram as linhagens 2024; as 3 do Aasimar VGM viraram opções da Celestial Revelation; Shifter ERLW e
Genasi EEPC já têm substituto no seletor). A família **Elf está 100% coberta**.

**O achado que decidiu a estratégia — o PADRÃO DA ABSORÇÃO.** Cada base 2024 absorveu UMA de suas
sub-raças 2014: `Halfling|XPHB` = Halfling 2014 + o **Naturally Stealthy do Lightfoot**;
`Dwarf|XPHB` = Dwarf 2014 + o **Dwarven Toughness do Hill**; `Human|XPHB` = o **Variant Human
inteiro** + Resourceful. Elf e Gnome são a exceção limpa (não absorveram nada — as sub-raças viraram
as linhagens). É a prova de que pendurar o Stout no Halfling 2024 entregaria Lightfoot + Stout de uma
vez, e por isso nenhuma das três formas anteriores servia (DDL-0059/0060/0061).

**A quarta forma, `as: 'swap'`** (`engine/legacyHalflingLineages.js`): construir o guarda-chuva que
faltou. O traço absorvido SAI da base e vira UMA das opções, de modo que cada linhagem **TROCA** em
vez de somar:

```
Halfling Lineage  (ocupa o lugar de "Naturally Stealthy")
  ├─ Lightfoot → Naturally Stealthy   ← reproduz a base 2024 EXATAMENTE
  ├─ Stout     → Stout Resilience
  ├─ Ghostwise → Silent Speech
  └─ Lotusden  → Child of the Wood + Timberwalk + magias
```

Em 2014 essas quatro eram IRMÃS — nenhuma era "a base" — então é o livro 2014 portado para o chassi
2024. Ninguém perde nada (o halfling puro de ontem **é** o Lightfoot), ninguém empilha, e a família
caiu de 3 entradas do seletor de espécies para 1. **Ghostwise e Lotusden migraram** de espécie à
parte (DDL-0060) para opções daqui: o `swap` resolve exatamente o motivo pelo qual aquele entry as
tinha tirado de lá. O **Dwarf ficou de fora por decisão do usuário** — está na seção OUT OF SCOPE do
CLAUDE.md, não é pendência.

**Detalhes que custaram atenção.**
1. **`withLineageUmbrella` tem de rodar ANTES do `buildVariant`.** O `replaceArr` das versões procura
   o guarda-chuva; sobre a base crua ele não acha o alvo e `applyArrMods` ignora a op — o traço da
   linhagem sumiria EM SILÊNCIO. Por isso `raceLineages` monta as versões do Halfling sobre a base já
   com guarda-chuva, e `resolveRaceObj` o aplica à base. Idempotente, mesma referência quando não há
   o que mudar.
2. **O Lightfoot carrega o texto da BASE 2024, não o do `Lightfoot|PHB`** — ele tem de reproduzir a
   base exatamente, e a redação mudou de edição ("take the Hide action" × "attempt to hide").
3. **Migração DUPLA** no `migrate` do schema: espécie à parte → Halfling XPHB + linhagem (bag
   zerado); Halfling XPHB SEM linhagem → **Lightfoot**, sem perda e PRESERVANDO o bag.
4. **Nada é normalizado** (decisão do usuário): o Lotusden segue mais pesado que as irmãs e com o
   atributo de conjuração FIXO em Sabedoria, como o dado 2014 diz — mesmo tratamento do Pallid.
5. **Menos de duas opções montáveis ⇒ o módulo não faz nada.** Um seletor de uma opção só seria ruído.

**Verificado:** 1086 testes (+15), lint, sweep **290/290 `--strict`** — as 4 linhas novas com build,
export e round-trip limpos — e ao vivo: a base mostra "Halfling Lineage" com as quatro opções e sem
Naturally Stealthy solto; o seletor diz "Choose halfling lineage…"; Stout deriva **DAMAGE
RESISTANCES: Poison**; Lotusden deriva origem de magia própria (Wis, DC 10) com Druidcraft *Always
Prepared*; Lightfoot reproduz a base. Mobile 375px sem overflow de página, zero erros de console.

---

## 72. Espécies de CENÁRIO: as vazias saem, as variantes ficam atrás de um filtro (DDL-0064)

**O problema.** Buscar "Elf" no seletor de espécies devolvia 6 linhas; "Human", 6; "Dwarf", 2. A
maioria eram entradas de CENÁRIO com o nome repetido — `Elf (Zendikar)`, `Human (Kaladesh)`,
`Dwarf (Kaladesh)` — e não estava claro o que elas eram nem se valia a pena mantê-las.

**O censo (2026-07-23).** São **duas famílias diferentes**, e é isso que estava escondido:

- **Plane Shift (PSA/PSD/PSI/PSK/PSX/PSZ) — 21 das 90 espécies visíveis.** PDFs gratuitos do
  crossover com Magic: The Gathering, 2016–2018, regras 2014 (`ability` +2/+1 fixo, seções de prosa
  Age/Alignment/Size/Languages, proficiência de arma).
- **LFL = "Lorwyn: First Light" (2025-11-18) — 7 espécies.** Livro OFICIAL e ATUAL, regras 2024, já
  no formato moderno. O `Elf|LFL` é traço a traço o `Elf|XPHB` com linhagens Lorwyn/Shadowmoor no
  lugar de Drow/High/Wood, e o `Kithkin|LFL` é o Halfling XPHB + darkvision + um guarda-chuva
  "Kithkin Lineage" — **o livro oficial faz o mesmo que o DDL-0063**. Não é o problema: é espécie
  irmã como o Astral Elf, e não foi tocada.

**Achados que decidiram o corte.**
1. **Três espécies derivam ZERO** — `Human (Ixalan)|PSX`, `Human (Kaladesh)|PSK`,
   `Human (Zendikar)|PSZ`. O conteúdo INTEIRO delas era o `ability` de +1 em todos os seis
   atributos, que a regra do DDL-0058/0062 descarta. Sobram só seções de prosa. São as **únicas
   três do catálogo inteiro** nessa condição.
2. **A linhagem `Gavony` do `Human (Innistrad)` é o mesmo caso** — no dado é literalmente só o
   `ability`, sem `entries`. As irmãs (Kessig, Nephalia, Stensia) têm conteúdo real, então a
   espécie continua.
3. **As colisões vão além do que se via:** `Aven|PSA × Aven|PSD`, `Goblin|MPMM × Goblin|PSZ`,
   `Minotaur|MPMM × Minotaur (Amonkhet)|PSA`, `Vedalken|GGR × Vedalken|PSK`,
   `Orc|XPHB × Orc (Ixalan)|PSX`.
4. **Metade do Plane Shift é conteúdo ÚNICO sem colisão nenhuma** (Aetherborn, Khenra, Kor, Naga,
   Siren, e as tribos de Merfolk/Vampire/Goblin) — um corte por fonte levaria isso junto.

**O que foi feito** (`engine/settingSpecies.js`, registro curado fechado):
- **REMOÇÃO** das 3 espécies vazias + a linhagem Gavony. Sai das LISTAS (seletor, glossário, matriz
  do sweep); `speciesCatalog`/`resolveRaceObj` seguem resolvendo-as pelo nome, mesma semântica do
  `latestOnly` (DDL-0059), para uma ficha salva não perder a espécie ao recarregar.
- **FILTRO "Variant"** com a opção **"Setting Variant"**, marcando as seis fontes Plane Shift, e
  **pré-marcado como exclude**. Padrão do DDL-0026/0040: recorte de conveniência é filtro removível,
  nunca regra dura — um toque no chip (ou em Clear) traz todas de volta.
- **O padrão vive na ENTITY, não nos chamadores.** `SelectorPanel` passou a cair em
  `entity.initialFilterState` quando a prop não vem, então os dois seletores de espécie (aba e guia)
  ganharam o recorte sem fiação nenhuma. A prop, quando vem, continua tendo precedência.

**Tratamento de linhagem NÃO se aplica aqui** — e o motivo é estrutural, não de esforço. O
DDL-0059…0063 resolveu um problema de EDIÇÃO (a mesma espécie do mesmo mundo em duas edições, que
por isso cabe como opção de um guarda-chuva). Aqui o eixo é CENÁRIO: pendurar as nações de Zendikar
na "Elven Lineage" ofereceria Joraga ao lado de Drow para quem constrói em Forgotten Realms. A regra
do `as` (DDL-0060) também reprova — `Elf (Zendikar)` é subconjunto ESTRITO do `Elf|XPHB`, então a
fusão somaria Trance e a escolha de 3 perícias de graça — e sem traço absorvido identificável o
`swap` está barrado pela regra 4 do DDL-0063.

**Verificado:** 1098 testes (+12), lint, sweep **286/286 `--strict`** (290 − 4: as 3 espécies e a
linhagem removidas), e ao vivo: "Human" 6 → **1**, "Elf" 6 → **4** (LFL/AAG/MPMM ficam), "Dwarf"
2 → **1**; um clique no chip devolve todas; com o filtro DESLIGADO "Human" dá 3 (XPHB, Innistrad,
Keldon), provando que só as vazias saíram de vez. Mobile 375px sem overflow, zero erros de console.

---

## 73. Filtro de cenário so esconde o que COLIDE; Aven redundante removido; fluff resolve `_copy`

Refina o §72 (mesma sessao) com tres ajustes pedidos pelo usuario.

**1. O filtro "Setting Variant" agora esconde so as que COLIDEM de nome, nao a fonte inteira.**
O §72 marcava as seis fontes Plane Shift por igual, o que escondia por padrao especies UNICAS que
nao confundem ninguem e sao o que aqueles suplementos tem de melhor. O criterio passou a ser a
colisao de nome: uma variante e escondida so quando o nome dela (sem o parentese de cenario) e o de
outra especie visivel do catalogo. `SETTING_VARIANTS` e agora uma lista curada de 9 ids
(Dwarf (Kaladesh), Elf (Kaladesh), Elf (Zendikar), Goblin|PSZ, Human (Innistrad), Human (Keldon),
Minotaur (Amonkhet), Orc (Ixalan), Vedalken|PSK). Continuam VISIVEIS por padrao: Aetherborn, Aven,
Khenra, Kor, Merfolk, Naga, Siren, Vampire.

**2. O `Aven|PSD` foi REMOVIDO por redundancia, e a arte dele foi resgatada.** Existiam dois Aven,
de dois planos: o `Aven|PSA` (Amonkhet) tem DUAS linhagens (Hawk-Headed, Ibis-Headed); o `Aven|PSD`
(Dominaria) e base + Hawkeyed + Percepcao, ou seja exatamente o `Aven (Hawk-Headed)|PSA`, sem a
outra linhagem. O PSA e a versao mais completa e fica. Novo conceito `REDUNDANT_SPECIES`, com um
campo `imageFor` opcional: a especie sai da lista, mas a arte dela vai para a linhagem que ela
retrata. A imagem do PSD (um aven de cabeca de aguia) passa a representar a `Aven (Hawk-Headed)`, a
unica das duas linhagens SEM imagem propria no dado. Com o PSD fora, o `Aven|PSA` deixou de colidir
e por isso NAO entrou em `SETTING_VARIANTS`.

**3. Bug pre-existente corrigido: o fluff (lore + arte) nao resolvia `_copy`.** 79 das 221 entradas
de `fluff-races.json` sao stubs `_copy` que herdam o corpo da raca base e so acrescentam um paragrafo
ou uma imagem propria - TODA linhagem com lore propria (Genasi (Air), Elf (Pallid),
Aven (Ibis-Headed)...). O `raceEntity.fluff` casava o stub cru, que nao tem `entries` nem `images`, e
a linhagem aparecia SEM lore e SEM arte no DetailView. Agora passa a lista por `resolveCopies`
(memoizada por db num WeakMap), como a lista de racas ja fazia. E o resgate de imagem do item 2 entra
por aqui: a arte doada vai na FRENTE do array (o DetailView mostra a primeira).

**4. O filtro "Variant" foi movido para logo ACIMA de "Source"** no painel de filtros: os dois falam
de procedencia, nao de mecanica, entao ficam juntos no fim.

**Verificado:** 1106 testes (+8), lint, sweep **285/285 `--strict`** (era 286; o Aven|PSD saiu), e ao
vivo: "Aven" 2 -> 1 (so o PSA, VISIVEL por padrao); Aetherborn/Siren/Naga aparecem com o filtro
ativo; as variantes (Elf/Dwarf Kaladesh, Orc/Minotaur de cenario) seguem escondidas; a ordem dos
filtros e Size/Speed/Type/Traits/Variant/Source; o preview do Aven carrega arte e lore (prova o
`_copy` resolvido). Zero erros de console.

---

## 74. Inicio da exibicao das fontes + a arte propria da linhagem vem primeiro

Duas adicoes pequenas a pedido do usuario.

**1. Exibicao das fontes (inicio).** A abreviacao de fonte ("PSK", "AAG") nao diz nada a um jogador
novo. Agora:
- **hover** no card mostra o nome por extenso ("Plane Shift: Kaladesh") num tooltip nativo, via um
  campo opcional `card.subtitleFull`;
- **clique** na fonte, quando ela aparece como TEXTO no DetailView (painel de preview, tela de
  detalhe mobile, popup de chip), abre um popup com o nome por extenso. E o novo componente
  reutilizavel `SourceTag`, que no card so faz o hover (la o clique seleciona a especie).

O nome por extenso vem de `Parser.SOURCE_JSON_TO_FULL` do 5etools, extraido para um arquivo commitado
`src/engine/sourceNamesData.js` (180 fontes) por `npm run gen:sources`, no mesmo padrao do
`gen:uuids` (so rotulos de fonte, nenhum conteudo de jogo; material de referencia git-ignored,
DDL-0037). O modulo puro `engine/sourceNames.js` resolve, com fallback para a propria abreviacao. O
popup (`showSourcePopup`) empilha na fila de dialogos in-app (DDL-0007), entao abre sobre o seletor
sem fecha-lo. Por ora ligado so a especie; o `SourceTag` no DetailView ja vale para toda entidade
que passa por ele.

**2. A arte PROPRIA de uma linhagem vem primeiro no DetailView.** Completa o §73. Uma linhagem
resolvida de `_copy` que acrescenta a propria imagem (`_mod.images.appendArr`) a punha no FIM do
array, depois das imagens genericas herdadas da base, entao o DetailView (que mostra a primeira)
exibia a arte generica. Agora a imagem que a linhagem NAO herdou da base sobe a frente. Conserta o
**Aven (Ibis-Headed)** (que passa a se representar com a propria arte, pedido do usuario) e vale para
qualquer linhagem com arte propria (Elf (Pallid) etc.). A doacao do §73 (Aven (Hawk-Headed) herda a
arte do Aven|PSD removido) segue funcionando, agora na mesma funcao `withLineageImages`.

**Verificado:** 1110 testes (+4), lint, sweep 285/285 `--strict` (inalterado; e UI/fluff), e ao vivo:
hover no card mostra o nome completo; clique na fonte do preview abre o popup ("Astral Adventurer's
Guide" / badge Source / AAG) que empilha sobre o seletor e fecha deixando o seletor aberto; a
resolucao de `_copy` do fluff carrega arte e lore. Mobile 375px sem overflow, zero erros de console.

## 75. Elf e Fairy: reimpressao de cenario (LFL) fundida na especie mainstream + speed 0 corrigido (DDL-0066)

Tres pedidos do usuario, na mesma leva.

**1. Bug de speed 0 (raiz: `_copy` nao resolvido no caminho de derivacao).** Varias especies do
5etools nao repetem `size`/`speed`/tracos: herdam de um pai via `_copy` (`Elf|LFL` -> `Elf|XPHB`,
`Centaur|MOT` -> `Centaur|GGR`, e outras 14). O SELETOR ja resolvia o `_copy` (`race.js` `list`),
mas o caminho de DERIVACAO (`resolveRaceObj` -> `speciesCatalog`) lia a lista CRUA, entao a ficha
derivava deslocamento 0. Agora `speciesCatalog` resolve o `_copy` (memoizado por db) e os dois
caminhos veem o objeto completo. Corrige, ao vivo: Elf|LFL 30, Centaur|MOT 40, Triton|MOT swim 30,
Orc|EGW/Boggart|LFL/Flamekin|LFL/Kithkin|LFL 30 (todos eram 0).

**2. Os dois "Elf" (XPHB + LFL) viram um so, sem perder a lore nem a arte do LFL.** Novo modulo
curado `engine/mergedLineages.js`: uma reimpressao de cenario do LFL que so reflavoriza uma especie
mainstream tem suas `_versions` FUNDIDAS na base, e a entrada standalone some do seletor. O
`Elf|XPHB` passa a oferecer Drow/High/Wood **+ Lorwyn/Shadowmoor**; a entrada `Elf|LFL` sai. Cada
linhagem fundida carrega `source: 'LFL'`, entao resolve o fluff/arte pela fonte LFL (Elf
(Lorwyn).webp, Elf (Shadowmoor).webp) - a lore e a imagem do LFL nao se perdem. O
`withLineageImages` ganhou um passo para escolher, num fluff que empacota varias imagens de
linhagem, a que cita o termo da linhagem no nome do arquivo (Shadowmoor mostra a arte de
Shadowmoor).

**3. "Fairy" e "Faerie" viram um so.** Mesmo mecanismo: `Faerie|LFL` e o `Fairy|MPMM` +
linhagens de Lorwyn (superset), entao suas duas linhagens sao fundidas no `Fairy|MPMM` e a entrada
`Faerie|LFL` sai. Como o Fairy NAO exige linhagem nativamente, as fundidas entram como ACRESCIMOS
opcionais (marcadas `_legacy`), sem passar a obrigar uma escolha. O nome mainstream ("Fairy") fica,
por decisao do usuario. Como o LFL nomeia as linhagens "Faerie; ..." (nome proprio, != base
"Fairy"), o fluff resolve por um novo passo de prefixo-do-nome (Faerie.webp) e o import exclui as
reimpressoes fundidas do casamento por nome exato (`resolveRaceByExactName`), senao a linhagem
reimportava como "faerie" em vez de "fairy".

As entradas standalone (`Elf|LFL`, `Faerie|LFL`) continuam RESOLVIVEIS por nome (`speciesCatalog`
nao as remove), entao uma ficha antiga salva com elas nao perde a especie ao recarregar.

**Verificado:** 1117 testes (+7, `mergedLineages.test.js`), lint, sweep 285/285 `--strict`
(inalterado: -2 linhas Elf|LFL -2 Faerie|LFL +2 Elf|XPHB +2 Fairy|MPMM), e contra o compendio real:
"Elf" da uma entrada so com 5 linhagens + Pallid; "Fairy" da uma so; "Faerie" some; as artes de
Lorwyn/Shadowmoor resolvem por linhagem. A pane do browser nao compos frames neste ambiente
(limitacao de exibicao), entao a verificacao ao vivo foi pelos mesmos code paths da UI
(`raceEntity.list`/`raceLineages`/`raceEntity.fluff`/`resolveRaceObj`) + o build/export/round-trip
do sweep.

**Correcao de arte por linhagem (2026-07-24, a pedido do usuario).** Duas artes das linhagens
fundidas estavam erradas, agora curadas em `LINEAGE_IMAGE` (mergedLineages.js), aplicada no
`raceEntity.fluff` (substitui as imagens pela unica arte que retrata a linhagem, mantendo a lore):
- **Elf: os dois arquivos do LFL estao TROCADOS no dado.** Confirmado ao vivo: "Elf (Lorwyn).webp"
  retrata a cena escura de Shadowmoor (cogumelos), e "Elf (Shadowmoor).webp" retrata a de Lorwyn
  (flores). Cada linhagem passou a apontar para o arquivo que a retrata de fato.
- **Fairy: Lorwyn usa a arte ORIGINAL do Fairy (MPMM)**; a arte do Faerie (LFL, fae mais sombrio)
  fica so para Shadowmoor. Antes as duas mostravam a arte do Faerie.
Verificado ao vivo os quatro casos + 1118 testes (+1, `mergedLineages.test.js`), lint, zero erros
de console.

## 76. Toda imagem do app expande em tela cheia; carrossel para as especies com varias artes (DDL-0067)

Duas melhorias pedidas pelo usuario, num componente universal de imagem.

**1. Imagem clicavel que expande em tela cheia (lightbox), em todo o app.** No modelo do
visualizador do retrato: qualquer imagem que o usuario ve agora e clicavel e abre grande sobre um
overlay escuro. Novo `store/imageViewerStore.js` (singleton Zustand, no espirito do
glossaryStore/dialogStore) + `components/common/ImageViewer.jsx` montado UMA vez no App, acionado
pela API imperativa `showImageViewer(images, index)`. O overlay se auto-foca ao abrir e trata Esc/
setas nele mesmo com stopPropagation (mesmo padrao do DialogHost), entao convive com a pilha de
dialogos por baixo - o Esc fecha so o visualizador, nao o painel que o abriu. z-index 1200 (acima
dos dialogos, 1000). Alcanca todo lugar que passa pelo `DetailView` (previews de todos os seletores,
aba de Species, telas de item e de magia individuais, popups de chip) e as imagens inline dentro de
`EntryContent` (lore, prosa de traco).

**2. Carrossel para as especies (e qualquer entidade) com varias artes.** Muitas especies trazem
mais de uma imagem no fluff (as artes das linhagens - Elf com Drow/High/Wood etc.). Novo
`components/common/ImageCarousel.jsx`: 1 imagem = so a arte clicavel; 2+ = carrossel com pontinhos
abaixo, swipe no toque (mobile) e setas que aparecem no hover (desktop). Clicar em qualquer imagem
abre o `ImageViewer` NO indice atual com o array inteiro, entao o carrossel continua funcionando em
tela cheia. Hooks de navegacao compartilhados entre os dois em `components/common/imageNav.js`
(`useSwipe`, `useCarouselIndex`). O `DetailView` passou a coletar TODAS as imagens do fluff (antes so
a primeira) e renderiza o `ImageCarousel` no caminho nao-editavel; o caminho editavel (trocar a arte
de um item do inventario) fica intacto. Imagens que falham ao carregar somem do carrossel; se todas
falharem, nada e renderizado.

O foco pedido do carrossel eram as especies, mas por viver no `DetailView` ele vale de graca para
qualquer entidade com varias imagens (efeito colateral bem-vindo).

**Verificado:** 1117 testes (inalterados), lint limpo, e ao vivo no browser: Halfling (1 imagem, so
o botao Expandir), Elf (2 artes - carrossel com 2 pontinhos, setas, creditos por imagem "Mike Pape"/
"Jedd Chevrier"), o expandir abrindo no indice certo, a navegacao em tela cheia, e o Esc fechando so
o lightbox e deixando o carrossel por baixo no mesmo indice. Zero erros de console.

**Ajustes (mesma leva, a pedido do usuario):**

- **As setas do visualizador em tela cheia ficam FIXAS nas extremidades da tela**, nao sobre a
  imagem: sairam do `.stage` (que acompanha a imagem) para o `.overlay`, posicionadas nas bordas e
  sempre visiveis. Assim nao cobrem a arte e nao se deslocam quando a proporcao muda de uma foto
  para a outra. No desktop (>= 700px) o overlay abre calhas laterais de 76px para a imagem nunca
  encostar nas setas. **No mobile (< 700px) as setas do lightbox somem**: ali a navegacao e por
  swipe (com os pontinhos como alternativa tocavel) e, sem as calhas, elas cairiam sobre a arte. O
  carrossel INLINE nao muda - as setas dele seguem visiveis no toque.
- **A imagem de item do inventario adota o molde do retrato: Trocar / Remover.** O visualizador
  ganhou uma linha opcional de botoes (`actions` no store/`showImageViewer`). Tocar na arte de um
  item agora EXPANDE em tela cheia com "Change" (abre o escolhedor de imagem) e "Remove" (volta a
  arte original) - Remove so aparece quando ha imagem custom. Substitui o clique-para-trocar direto.
  Wiring: `onImgRemove` novo no `DetailView`, ligado ao `clearItemImg` da `InventoryTab`.

Verificado ao vivo: setas fixas com duas artes de proporcoes diferentes (Elf), e o Battleaxe do
inventario - expandir mostra so "Change" sem custom, "Change"+"Remove" com uma URL custom, Change
abrindo o modal e Remove voltando a arte do 5etools. 1117 testes, lint, zero erros de console.

- **O selo ✎ saiu da preview do item.** Ele indicava "clique para trocar", affordance que deixou de
  existir quando o clique passou a EXPANDIR: a edicao agora vive nos botoes Change/Remove do
  visualizador, exatamente como no retrato (que tambem nao tem selo). `.imgEditHint` removido do
  `DetailView` e do CSS.

## 77. Spellbook: trocar uma magia preparada direto (Change no preview + ⇄ no card)

Preparar um substituto exigia dois passos desconectados: remover a magia e depois abrir "+ Prepare
spell". Agora ha um caminho unico de TROCA, em dois pontos:

- **Botao "Change" ao lado do "Remove"** no preview da magia preparada (rodape do overlay de
  detalhe).
- **Botao ⇄ no proprio card** da magia preparada, na extremidade direita da linha - espaco que,
  diferente dos cards de inventario, nao estava sendo usado para nada (so o circulo do nivel).
  So as magias ESCOLHIDAS pelo jogador o recebem: as concedidas ("Always Prepared") nao se trocam.

**A troca e ATOMICA, e nao remove antes de escolher.** O seletor abre com o cabecalho "Replace
<magia>" e a dica "The spell you pick takes its place. Close to keep the current one."; escolher
uma magia faz sair a antiga e entrar a nova NUM SO update (`setSpells`), e fechar o painel sem
escolher mantem a original. Isso evita tanto o estado intermediario (perder a magia se desistir)
quanto a leitura defasada dos contadores - o balde da magia trocada e contado como livre
(`freeCantripsFull`/`freePreparedFull`/`freeArcanumForPick`), entao o seletor ja abre com o circulo
certo pre-marcado e o `addSpell` nao avisa "sem espaco" a toa.

**Verificado ao vivo** (Wizard 1, 4 preparadas): ⇄ no card abre "Replace Burning Hands" (com a
propria magia fora da lista, 61 → 60 resultados), escolher Charm Person troca mantendo o contador
em 1/4, "Change" no preview abre o mesmo fluxo, fechar sem escolher preserva a magia, e a concedida
Druidcraft (linhagem) nao tem o botao. Mobile 375px sem overflow. 1118 testes, lint, zero erros de
console.

## 78. Tutorial de uso (coach-marks): motor + tour do seletor (F1, DDL-0069)

Novo recurso, SEPARADO da Character Guidance (o wizard de criacao/level-up): um tutorial de USO que
destaca (spotlight) as partes do app e explica o que cada uma faz e onde fica. Esta e a **Fase 1**
(o motor + o primeiro tour, o do seletor); as fichas e as abas vem nas fases seguintes.

**Motor.** Um singleton no molde do `imageViewerStore`/`glossaryStore`:
- `store/tutorialStore.js` (Zustand + localStorage): persiste `enabled` (liga/desliga geral) e
  `seen` (mapa tourId → visto). API imperativa `maybeStartTutorial(id)` (auto/contextual: so dispara
  se ligado, nao visto e nada ativo - um por vez) e `startTutorial(id)` (replay, forca). `next`/
  `back`/`finish` navegam; `finish` marca visto. `seedTutorials(rosterCount)` roda na 1a execucao:
  usuario que ja tem personagens nasce com tudo marcado como visto (nao e interrompido), instalacao
  nova mantem os tours ligados.
- `tutorial/tours.js` + `tutorial/anchors.js`: os tours sao DADOS puros (passos com `anchor`, texto
  `body` que pode variar entre `{ desktop, mobile }`, e `only: 'mobile'|'desktop'` quando a ANCORA
  muda). As chaves `data-tour` vivem em `anchors.js` (fonte unica, compartilhada com os componentes).
- `components/common/TutorialOverlay.jsx` (montado uma vez no App): resolve o alvo por
  `[data-tour="..."]`, o ilumina com um recorte sobre um fundo escuro, e mostra um balao com Back/
  Next/Skip que se posiciona sozinho pelos lados (auto-flip nas bordas; vertical no mobile).
  Reposiciona em scroll/resize; passo sem alvo (ou alvo ausente) vira balao central. Cada passo e um
  `Spotlight` REMONTADO por passo (key = tour:index), o que evita reset-em-render e callback
  compartilhado - mantem o React Compiler feliz (sem o aviso de deps de tamanho variavel).

**Tour do seletor.** Dispara na 1a vez que um `SelectorPanel` "cheio" (com preview) abre - o
glossario/loja ficam de fora. Passos: abertura → busca → filtros → resultados → preview → Select.
As diferencas mobile×desktop sao reais: no **desktop** o passo dos filtros aponta o painel fixo a
esquerda e ha um passo de "Preview" (coluna a direita) + "Select" (6 passos); no **mobile** aponta o
botao "Filters" (a gaveta) e funde preview+select num passo "Details" (toque no card) - 5 passos.

**Verificado ao vivo** nos dois breakpoints: desktop 6 passos com o balao posicionado a direita dos
filtros / acima do Select etc.; mobile 5 passos com o botao "Filters" destacado e o balao em sheet;
o tour marca `seen.selector` ao concluir e nao reabre; sem erros novos de console. 1136 testes
(+18: `tutorialStore.test.js`, `tours.test.js`), lint limpo.

Pendente (proximas fases): tours da ficha (mini cards, proficiencias, abas) e por aba (F2/F3).

## 79. Tutorial de uso: controles de menu - replay + liga/desliga (F4, DDL-0069)

Adiantado antes da F2/F3 porque facilita testar os proximos tours. Os menus sanduiche (☰) ganharam
uma secao **Tutorials**:
- **Replay tutorial(s)**: religa o tutorial (`enabled=true`) e ZERA o `seen`, entao os tours voltam
  a auto-disparar conforme o usuario navega. Na ficha (Builder) tambem chama `startTutorial('sheet')`
  para abrir o tour da ficha na hora - no-op ate a F2 existir, ja deixando o gancho pronto.
- **Enable/Disable tutorials**: alterna `enabled` (o rotulo reflete o estado). Desligado, nenhum tour
  auto-dispara; o Replay religa.

Na **Home** e na **ficha**, via `useTutorialStore` (`enabled`/`setEnabled`/`resetSeen`). Verificado
ao vivo: Disable grava `enabled:false` e o item vira "Enable tutorials"; Replay grava
`{enabled:true, seen:{}}` e, ao reabrir um seletor, o tour re-dispara. 1136 testes, lint.

## 80. Tutorial do seletor no MOBILE: o tour dirige a gaveta e o preview (F1, DDL-0069)

No mobile o painel esconde atras de gestos o que no desktop e sempre visivel (os filtros numa gaveta,
o preview numa tela de detalhe). Agora o tour DEMONSTRA isso: cada passo mobile declara um
`mobileAction` e o `SelectorPanel` abre/fecha para acompanhar.
- Passo **Filters**: abre a gaveta de filtros e destaca-a (a ancora passou a ser o painel, nao o
  botao "Filters", que some com a gaveta aberta).
- Passo **Details**: abre a tela de detalhe do 1o resultado (arte/lore/texto + Select), com a ancora
  `sel-detail` na propria tela.
- Ao AVANCAR de passo, o painel reverte a acao (fecha a gaveta ao ir para Results, etc.); ao TERMINAR
  o tour, fecha a tela de detalhe - deixando o usuario livre para tocar num card e selecionar o que
  quiser (pedido do usuario).

Implementacao: o `SelectorPanel` le o passo atual do `tutorialStore` e reflete `mobileAction` na UI
pelo padrao de ajuste-durante-o-render (como o reset de `visibleCount`), com um efeito de cleanup
para o fechar-ao-terminar. O `TutorialOverlay` ganhou re-medicoes atrasadas (180/400 ms) para o
recorte assentar sobre a gaveta que ANIMA (transform 0.25s). Verificado ao vivo (mobile 375px): a
gaveta abre no passo 3 e fecha no 4; o detalhe abre no 5 e fecha no Done, com a lista de resultados
de volta. Desktop inalterado. 1136 testes, lint, zero erros de console.

## 81. Tutorial da FICHA (F2, DDL-0069)

Segundo tour do tutorial de uso: apresenta a ficha (Builder) na 1a vez que ela monta - o que cada
parte faz e onde fica, complementando o tour do seletor (F1). Como a F1, e SO dado + ancoras + um
disparo contextual; nenhum call site precisa saber do tutorial.
- **`tutorial/tours.js`**: novo tour `sheet` (9 passos): abertura central → retrato/nome → nivel →
  tiles (Level/HP/AC/Alignment) → mini cards de atributo → card de proficiencias → abas → botao ⚛ do
  guia → menu ☰. Os passos cujo TEXTO muda entre desktop e mobile (retrato "clicar" × "tocar"; abas
  "switch" × "tap through") usam `body: { desktop, mobile }`; as ancoras sao as mesmas nos dois.
- **`tutorial/anchors.js`**: 8 chaves `SHEET_*` novas.
- **Ancoras marcadas** nos componentes (`data-tour`): `Builder` (identity, level slot, botao do guia,
  menu, stack de proficiencias, barra de abas), `StatsHeader` (tiles, abilities) e `MenuButton`
  (ganhou uma prop `dataTour` opcional que repassa ao gatilho). Todas via as constantes `TUT`, fonte
  unica das chaves.
- **Disparo**: `maybeStartTutorial('sheet')` num `useEffect([])` do `BuilderInner` - roda no mount
  (sem atraso), entao ganha a vez sobre o timer de 250ms do seletor pela garantia "um por vez" do
  store. O item "Replay tutorial" do menu (F4) ja chamava `startTutorial('sheet')`, que deixa de ser
  no-op. (O passo do botao ⚛ ganhou tratamento proprio na §82 - ver ali.)

1136 testes (o `tours.test.js` cobre o tour novo automaticamente), lint limpo, e verificado ao vivo
(mobile): os 9 passos com as ancoras/textos corretos, marca visto (nao re-dispara), e o Replay
re-dispara.

## 82. Tutorial das ABAS (F3) + botao-demo do guia (DDL-0069)

Terceiro lote do tutorial de uso: um micro-tour para cada uma das seis abas do Builder (Species /
Background / Class / Inventory / Spellbook / Biography), mais um ajuste no passo do botao ⚛ do tour
da ficha (F2).
- **Seis tours `tab-*` em `tutorial/tours.js`** (2-5 passos cada): uma abertura + os elementos
  ESTAVEIS da aba (os que existem mesmo com a aba "vazia"); o que aparece dinamicamente e mencionado
  no texto. 14 ancoras `TAB_*` novas em `anchors.js`, marcadas nos seis componentes de aba.
- **Disparo centralizado no `Builder`** (nao em cada aba): um `useEffect([activeTab, hasSpellcasting])`
  chama `maybeStartTutorial('tab-<aba>')` ~300 ms apos a aba abrir. Central (em vez de por-mount de
  cada aba) para SEQUENCIAR com o tour da ficha: no 1o mount o tour da ficha ja esta ativo e a
  garantia "um por vez" bloqueia o da aba Species (que dispara ao ser REABERTA). O tour do Spellbook
  so dispara para conjuradores (a aba fica vazia sem magia) - gate no efeito.
- **Botao ⚛ vira DEMO durante o seu passo** (pedido do usuario): antes o passo "The guide" caia num
  balao central quando o botao estava escondido (guidance desligada nesta ficha OU nada faltando). O
  `Builder` agora le o anchor do passo atual do `tutorialStore` (`tourAnchor`) e, quando e o do guia,
  FORCA o botao a aparecer so para ilustrar aparencia e localizacao - sem badge (nada a contar) e com
  clique inerte (o tour ja bloqueia cliques). Ao avancar/terminar o passo, o botao some de novo.

1136 testes (as abas novas sao cobertas pelo `tours.test.js` automatico), lint limpo, e verificado ao
vivo (mobile): os tours de Species/Background/Class/Inventory/Biography disparando ao abrir cada aba
com as ancoras certas; o Spellbook corretamente SEM tour (Barbarian, nao-conjurador); e o botao-demo
do guia aparecendo no passo 8 do tour da ficha (ficha completa, sem badge) e sumindo depois. Zero
erros de console.

## 83. Phase T - T1b sessão 1: Bloco S-A1 (núcleo 2024 XPHB) - sem achados

Início da campanha de testes de ESPÉCIES (Tier 1b). Bloco S-A1 = as bases 2024 XPHB e os núcleos de
linhagem de Elf/Gnome: **9 linhas `ui: ok`, ZERO bugs, nenhuma mudança de código.** Sweep verde antes
(285/285 `--strict`). Passada ao vivo (mobile-first ~560/820px + spot-check 375px sem overflow):
- **Aasimar** - escolha de tamanho S/M (link glossário "Size"); Light cantrip (Cha) chega à origem de
  raça da Spellbook (DC 9); Celestial Revelation em opções estruturadas; lightbox de imagem OK.
- **Dwarf** - sem sub-escolhas; Dwarven Toughness deriva (HP 14->15 @1); 1 resultado (filtro esconde
  Kaladesh).
- **Human** - os três pickers (size, any-skill 14, Origin feat 24 categoria-correta) filtram e
  persistem; chip do feat com botão de detalhe (ℹ️, DDL-0021).
- **Orc** - Adrenaline Rush / Darkvision 120 / Relentless Endurance; sem sub-escolhas (sem Powerful
  Build, correto p/ 2024).
- **Elf** - o seletor de linhagem traz as 6 (Drow/High/Wood + Lorwyn/Shadowmoor FOLDED, DDL-0066, +
  Pallid), sem "Elf|LFL" duplicado; Drow deriva Darkvision 120 + Dancing Lights (Spellbook), High
  abre o seletor "Choose a Wizard cantrip" (24 opts pré-marcado Wizard+Cantrip), Wood deriva Speed 35
  + Druidcraft; Keen Senses fica visível e o spellcasting-ability é adiado p/ depois da linhagem
  (DDL-0061).
- **Gnome** - Forest + Rock; Gnomish Cunning; **TC-0044 CONFIRMADO ao vivo**: Forest concede Minor
  Illusion + Speak with Animals (2/Day) ambos @1.

Todos com links de glossário resolvendo, zero `{@tag}` vazado, escolhas persistindo. Suíte e lint
inalterados (sem código tocado). Ver TESTING-PLAN.md §7 e testing/COVERAGE.md.

## 84. Phase T - T1b sessão 2: Bloco S-A2 (Dragonborn/Goliath/Tiefling núcleo) - TC-0051 fixed

Segundo bloco da campanha de espécies. **19 linhas `ui: ok`** (Dragonborn|XPHB ×10, Goliath|XPHB
×6, Tiefling|XPHB núcleo Abyssal/Chthonic/Infernal ×3). Sweep verde antes (285/285 `--strict`).
- **Dragonborn** - as 10 ancestrias presentes no seletor de linhagem; preview resolve o tipo de
  dano por ancestralidade (Black->Acid, Red->Fire); selecionado Red ao vivo: "1d10 Fire damage" +
  "Resistance to Fire" na ficha, Draconic Flight @5 renderiza.
- **Goliath** - as 6 ancestralidades de gigante presentes; preview resolve só o benefício
  escolhido (Cloud's Jaunt / Stone's Endurance testados ao vivo); Large Form @5 + Powerful Build.
- **Tiefling núcleo** - as 3 legacies oficiais 2024 (Abyssal/Chthonic/Infernal) testadas ao vivo,
  cada uma com resistência+cantrip corretos e a escolha de atributo de conjuração (Int/Wis/Cha);
  Infernal com Charisma escolhida deriva DC 10 / Attack +2 na Spellbook, Fire Bolt + Thaumaturgy
  Always Prepared. Confirmado (regressão do DDL-0061 §69): SEM linhagem escolhida a ficha não
  mostra nenhum chip de resistência/spell-list, só o seletor "Choose fiendish legacy...".
- **TC-0051 (FIXED em sessão):** a legacy Abyssal exibia "120 ft / Darkvision" (preview e ficha),
  única entre as 14 legacies do dataset. Raiz: o JSON cru do 5e.tools carrega `darkvision: 120`
  no campo de topo da versão "Abyssal Legacy", sem nenhuma entry correspondente na prosa - as
  outras 13 (incl. Chthonic/Infernal oficiais) não tocam o campo. Cross-checado contra o SRD
  oficial (dnd5e system, CC-BY-4.0, `tiefling-abyssal.yml`): "Darkvision. You have Darkvision with
  a range of 60 feet." - confirma erro pontual do dado upstream, não uma regra do livro. Fix:
  `KNOWN_DATA_FIXES` em `engine/speciesData.js`, aplicado dentro de `buildVariant` por chave exata
  `Raça|Fonte/Versão` - corrige só o campo errado, sem tocar o resto da variante. 2 testes novos.

1138 testes (+2), lint, sweep 285/285 `--strict`, mobile 375px sem overflow, zero erros de
console. Ver TESTING-PLAN.md §7, testing/COVERAGE.md e testing/ISSUES.md (TC-0051).

## 85. Phase T - T1b sessão 3: Bloco S-B1 (as 11 legacies REESCRITAS do Tiefling) - TC-0052 fixed

O bloco de maior RISCO da campanha de espécies: caminho de código NOSSO (DDL-0061), não dado
upstream. **11 linhas `ui: ok`.** Cada legacy conferida ao vivo contra a especificação do
`engine/legacyFiendishLegacies.js`, e as 11 batem exatamente:
- **Resistência TRAVADA em fogo** em todas as 11 (o "Hellish Resistance" 2014), contra a escolha
  livre poison/necrotic/fire do chassi 2024 - verificado no preview e na ficha (DAMAGE
  RESISTANCES: Fire).
- **As 4 sem cantrip próprio** (Baalzebul, Dispater, Zariel, Hellfire) têm a frase do cantrip
  CORTADA do parágrafo, não uma frase vazia - elas já recebem Thaumaturgy pelo Otherworldly
  Presence. As outras 7 anunciam o cantrip certo (Friends, Minor Illusion, Ray of Frost, Mage
  Hand ×2, Vicious Mockery).
- **Os 7 upcasts `#2`** aparecem como frase própria ("When you cast X with this trait, you cast it
  as a level 2 spell") só onde o dado 2014 mandava; os 4 sem upcast não a exibem.
- **Zariel: `Shining Smite`** (a reimpressão XPHB de Branding Smite, o único remap manual do
  módulo) resolve e é concedida ao vivo - build Fighter 5 derivou Searing Smite 1/Day @3 e
  Shining Smite 1/Day @5, com o card USES e a origem "Zariel Legacy" na Spellbook.
- **Winged: voo no nível 1 e nada em 3/5** - a ficha deriva "Speed 30 ft, fly 30 ft", a Spellbook
  mostra só Thaumaturgy, e a linha da tabela traz o voo no nível 1 com "-" em 3/5.
- **Devil's Tongue / Hellfire / Winged** trazem o traço "Appearance" do SCAG anexado, e ele só
  aparece ao selecionar a linhagem.
- O atributo de conjuração é a escolha Int/Wis/Cha em todas (não o Carisma fixo de 2014);
  escolhido Wisdom, a Spellbook derivou DC 10 / Attack +2.

**TC-0052 (FIXED em sessão):** escolher uma legacy legada trocava a **LORE** da espécie para o
texto de **2014**. Raiz: uma linhagem curada carrega a fonte da sub-raça de ORIGEM (MTF/SCAG/EGW),
livros que não têm entrada de fluff da espécie, e a cadeia do `raceEntity.fluff` terminava num
`find(name === baseName)` - a PRIMEIRA entrada de mesmo nome, que é a de 2014. Não era preservação
de sabor: era ordem de array (o `Elf (Eladrin)` chegava a exibir a lore e a arte do Elf de
**Lorwyn**). Fix: `buildVariant` passou a gravar `_baseSource` ao lado do `_baseName` (a MESMA
convenção que o `mergeSubrace` já usava) e a cadeia ganhou um passo `baseName + _baseSource` antes
do fallback por nome puro. Sonda sobre o compêndio real: exatamente **14 linhas** mudaram (as 11
legacies + Halfling Ghostwise/Lotusden + Elf (Eladrin)), **zero regressões** - as linhagens
fundidas do DDL-0066 resolvem num passo anterior e seguem idênticas, incluindo a troca curada de
arte Lorwyn↔Shadowmoor.

1141 testes (+3), lint, sweep 285/285 `--strict`, mobile 375px sem overflow horizontal, zero erros
de console. Ver DDL-0071, TESTING-PLAN.md §7, testing/COVERAGE.md e testing/ISSUES.md (TC-0052).

## 86. Phase T - T1b sessão 4: Bloco S-B2 (o resto da curadoria de espécies) - sem achados

Fecha o **Bloco S-B**. 6 linhas novas `ui: ok` + 6 revalidadas, **zero bugs, nenhuma mudança de
código**. A verificação central deste bloco era a **ARTE por linhagem** (DDL-0066 amendment), que
só se confere OLHANDO a imagem - e as quatro conferem:
- **Elf; Lorwyn** → arte de flores rosas e borboletas (Lorwyn de fato), que mora no arquivo
  enganosamente chamado `Elf (Shadowmoor).webp`; **Elf; Shadowmoor** → cena escura com cogumelos,
  do arquivo `Elf (Lorwyn).webp`. Os arquivos ESTÃO trocados no dado upstream e o override curado
  os desfaz corretamente.
- **Faerie; Lorwyn** → a arte ORIGINAL do Fairy (MPMM); **Faerie; Shadowmoor** → a do Faerie
  (LFL). Distintas, como o amendment exige (antes as duas mostravam a mesma).
- **Elf (Pallid)**: sem "Elven Lineage" órfão (o `supersedes` do DDL-0059 funciona), os 4 traços da
  base 2024 + os 2 próprios, texto 2014 literal com Wisdom FIXO (é a única que volta como linhagem
  SEM reescrita, DDL-0060) e arte própria.
- **Human (Keldon)**: 0 resultados com o filtro "Setting Variant" pré-marcado e volta a **um
  clique** no chip (DDL-0064); sem seletor de linhagem, sem escolhas, **prosa 2014 removida**
  (Age/Alignment/Size/Speed/Languages) e sem "Ability Score Increase" (DDL-0060/0058).
- **Revalidadas:** Halfling ×4 (guarda-chuva "Halfling Lineage"; Lightfoot com a redação **XPHB**
  "take the Hide action"; Stout → Resistance Poison; Ghostwise → Silent Speech; Lotusden → origem
  de magia própria com **WISDOM/DC 10 sem seletor de atributo**) e Custom Lineage ×2 (rótulo
  "Variable Trait", **25** talentos de ORIGEM, perícia adiada para a opção que a concede).
- O **fix de lore do TC-0052** (§85) confirmado ao vivo também no Halfling: a lore agora é a de
  2024 ("Cherished and guided by gods who value life, home, and hearth…").

Sem código tocado → suíte (1141), lint e sweep (285/285 `--strict`) inalterados. Mobile 375px sem
overflow, zero erros de console. Ver TESTING-PLAN.md §7 e testing/COVERAGE.md.

## 87. Phase T - revisão do Bloco S-A2 (pedida pelo usuário): evidência refeita, veredito mantido

O usuário notou que a passada do S-A2 (CHANGELOG §84) rodou com o modelo Sonnet e pediu um
re-exame. **Resultado: zero bugs novos - as conclusões da 1ª passada se sustentam.** O que estava
frágil era a EVIDÊNCIA, não o veredito:
- 8 das 10 ancestralidades de Dragonborn e 4 das 6 de Goliath estavam anotadas no COVERAGE como
  "engine-verificado" **sem que nada tivesse sido executado por ancestralidade** - a 1ª passada
  só abriu o preview de Black/Red e Cloud/Stone.
- O card de **DAMAGE RESISTANCES da FICHA** nunca fora aberto para o Dragonborn (só para o
  Tiefling), então "a resistência deriva" era uma leitura do texto do preview, não da derivação.

**Como foi fechado.** Um probe descartável construiu as **19 linhas** pelo `autoBuild` (Fighter 5
+ Champion) e comparou a derivação contra um oráculo **digitado do livro** - as 10 duplas
dragão→dano, as 6 ancestralidades de gigante e as 3 legacies oficiais - checando resistência,
darkvision, deslocamento, os traços esperados e a convergência do autoBuild. Tudo verde. Ao vivo,
as duas lacunas de UI foram fechadas: **Dragonborn (Green) → DAMAGE RESISTANCES: Poison** na ficha
e **Goliath (Fire) → sem card de resistência** (correto, o Goliath dá um boon, não resistência).
O TC-0051 (darkvision da Abyssal) confirma-se também no engine.

As 19 notas do `testing/COVERAGE.md` foram **reescritas** para dizer o que foi de fato verificado.
**Regra que fica (TESTING-PLAN §4.5):** não anotar "engine-verificado" sem ter rodado algo - ou
roda um probe, ou a nota diz "inferido do padrão". Nenhum código foi tocado: suíte (1141), lint e
sweep (285/285 `--strict`) inalterados.

## 88. Phase T - T1b sessão 5: Bloco S-C (MPMM) - derivação certificada; UI parcial

Sessão de resultado MISTO, registrado como tal. **Nada de código foi tocado; nenhum bug encontrado.**

**Feito (sólido):** um probe exaustivo construiu **as 30 linhas MPMM** pelo `autoBuild` e comparou a
derivação contra o que o DADO declara - pegando a classe de bug "o dado diz X e a derivação perde
X" - além de checar convergência do autoBuild e ausência de NaN no objeto derivado. **Zero
problemas.** Destaques que o probe prova: **Tortle AC 17** (armadura natural FLAT, DDL-0034 - a
única linha fora do padrão 11-12), todas as resistências passando do dado à derivação (Duergar/
Yuan-Ti poison, Githyanki/Githzerai psychic, Sea Elf/Triton cold, Shadar-Kai necrotic, Genasi
Air/Fire/Water lightning/fire/acid e **Earth sem nenhuma**, correto para MPMM), e os deslocamentos
especiais (voo do Aarakocra, natação de Genasi Water/Lizardfolk/Sea Elf/Triton, escalada do Tabaxi,
35 do Genasi Air/Satyr, 40 do Centauro).

**Feito (UI ao vivo): as 3 linhas do Kobold**, que eram a pendência explícita do bloco. O rótulo
**"Kobold Legacy"** vem do dado (DDL-0062), as 3 opções aparecem, e o **TC-0046/0047 fica FECHADO**:
antes de escolher a legacy a aba não mostra "Species Choices" nenhuma, e o "Choose a skill 0/1"
surge **só** ao escolher Craftiness (a magia, só na Draconic Sorcery - provado pelo probe).

**NÃO feito, e por isso as outras 26 linhas seguem `ui: todo`:** a passada de UI por espécie. A aba
do browser degradou no meio da sessão (o lightbox passou a interceptar cliques, os refs derivaram e
por fim o painel parou de receber teclado), e insistir teria produzido verificação de má qualidade.
As notas do COVERAGE dizem exatamente isso - derivação certificada, UI pendente - em vez de marcar
as linhas como prontas.

Suíte (1141), lint e sweep (285/285 `--strict`) inalterados. Ver TESTING-PLAN.md §7.

## 89. Tiefling Winged: a frase do atributo muda de traço (TC-0054) + a família da armadura natural (TC-0053)

Duas correções, uma pedida pelo usuário e outra achada ao continuar o Bloco S-C.

**TC-0054 (pedido do usuário) - Tiefling; Winged Legacy.** É a única legacy que não concede magia
(dá asas e resistência), e por isso duas frases ficavam sem sentido: o traço dela terminava com
"Intelligence, Wisdom, or Charisma is your spellcasting ability for the spells you cast with this
trait" - não há magia conjurada com esse traço - e o **Otherworldly Presence** dizia que o
Thaumaturgy usa "the same spellcasting ability you use for your Fiendish Legacy Trait", apontando
para um traço que não fala de atributo. Apagar a frase não resolveria: o atributo **continua
existindo**, porque o Thaumaturgy depende dele. Então ela **muda de traço**: a legacy fica com
resistência + asas, e o Otherworldly Presence perde a referência à legacy e recebe a frase do
atributo, onde o "this trait" passa a se referir a ele mesmo - que é o traço com que o Thaumaturgy
é conjurado. Continua **sem prosa nossa**: as duas frases vêm do dado, e se o upstream mudar a
ponto de a frase não ser reconhecida o traço fica intacto. As 13 legacies COM magia não mudam
(testado).

**TC-0053 - cinco espécies declaravam a própria CA em prosa e derivavam 10+Dex.** O probe do S-C
mostrou o contraste que denunciou: Tortle derivou AC 17 e **Lizardfolk 11**, mesmo com o card
marcando "Natural Armor". A varredura de TODA espécie alcançável com esse traitTag, cruzada com o
registro `NATURAL_ARMOR` (DDL-0034), achou que ele tinha só 3 das 9. Entraram: **Lizardfolk|MPMM**
(13+Dex), **Thri-kreen|AAG** (13+Dex, "Chameleon Carapace"), **Locathah|LR** (12+Dex),
**Loxodon|GGR** (12+**Con**, o único que soma Constituição) e **Goblin|PSZ** (11+Dex, "Grit"),
mais a chave `Goblin|PSX` porque o goblin de Ixalan é sub-raça fundida do de Zendikar. **Nada da
máquina mudou** - `deriveArmorClass` já fazia tudo; era só registro, como o DDL-0034 previu. O
**Simic Hybrid** fica de fora de propósito: a CA dele vem de uma OPÇÃO escolhível.

1147 testes (+6), lint, sweep 285/285 `--strict`. Ao vivo: o texto do Winged na ficha e
**Lizardfolk com Dex 10 mostrando AC 13** (era 10). Ver DDL-0061 e DDL-0034 (emendas) e
testing/ISSUES.md.

## 90. Phase T - T1b sessão 6: Bloco S-C (MPMM) CONCLUÍDO - 27 linhas `ui: ok`

Fecha o Bloco S-C. **Nenhum bug novo; nenhum código tocado** (os dois fixes desta leva saíram em
§89). Método em duas camadas, o mesmo que a revisão do S-A2 estabeleceu:

**1. Probe de qualidade de PREVIEW (cobertura total, sem clicar).** Para as 28 unidades: todo
traço tem nome e texto (nenhum preview vazio), **todo `{@tag}` de glossário/entidade RESOLVE**
(zero link morto - a checagem que importa, já que o renderer nunca vaza a tag crua, ele degrada
para texto inerte) e **toda escolha de espécie oferece opções** (a classe de bug "Problem 1" do
DDL-0002). Zero problemas.

**2. Passada ao vivo nas 27 linhas.** Descoberto um atalho confiável para o harness: com a busca
filtrando para UM resultado, clicar o card e depois "Select" commita exatamente ela - **o clique
no card é obrigatório**, porque o "Select" sozinho recommita o item SELECIONADO (o `selectedRaw`
que trava o preview, DDL-0048). Conferidos meta (tamanho/deslocamento/tipo), as escolhas
renderizadas e a ausência de tag crua em todas; e nos casos de forma distinta: **Tortle AC 17**
e **Lizardfolk AC 13** na ficha (o fix do TC-0053 ao vivo), **Genasi (Water) com DAMAGE
RESISTANCES: Acid** e as quatro linhagens trocando com os deslocamentos certos (Air 35, Water
natação), Centauro 40 ft Fey, Satyr 35 ft Fey com escolha de Instrumento Musical, Githyanki com
as três escolhas (perícia/ferramenta/atributo), Tabaxi com escalada, Fairy base com voo e
linhagem OPCIONAL, e o Aarakocra corretamente **sem magia no nível 1** (o Wind Caller só concede
a partir do 3).

Mobile 375px sem overflow, zero erros de console. Suíte (1147), lint e sweep (285/285 `--strict`)
inalterados. **Observação de apresentação levada ao usuário** (não é bug, não foi mexido): 22 das
espécies MPMM trazem `Creature Type` / `Size` / `Speed` como traços de PROSA, duplicando os chips
de meta que a ficha já mostra - é o formato de 2022, que a edição 2024 moveu para campos
estruturados.

## 91. Phase T - T1b sessão 7: Bloco S-D (outros livros modernos) CONCLUÍDO - 32 linhas `ui: ok`

Fecha o Bloco S-D. **Nenhum bug; nenhum código tocado.** Mesmo método de duas camadas do S-C
(probe de cobertura total + passada ao vivo), agora com asserções para os itens de atenção que o
plano listava - e todos passaram:
- **Armadura natural (DDL-0034 + TC-0053), as cinco fórmulas na ficha com Dex 10:** Autognome
  **13** (unarmored 13+Dex), Warforged **11** (10+Dex **+1 de bônus**), Thri-kreen **13**,
  Locathah **12**, Loxodon **12** (o único que soma **Constituição**). As três últimas só passaram
  a derivar no TC-0053 desta leva.
- **Verdan:** o chip mostra **"Varies"** e **não existe escolha de tamanho** - o tamanho vem do
  NÍVEL (S até o 4, M do 5 em diante), asserido no probe. É exatamente o DDL-0017.
- **Dragonborn (Gem) ×5:** as cinco resistências distintas (Force/Radiant/Psychic/Thunder/
  Necrotic) e o voo no texto.
- **Simic Hybrid:** só a escolha de idioma - a CA dele vem de uma OPÇÃO escolhível, e é por isso
  que ele fica deliberadamente fora do registro de armadura natural.
- Owlin dv 120 + voo, Plasmoid tipo Ooze com Acid/Poison, Kalashtar Aberration com Psychic, Grung
  25 ft + escalada 25, Dhampir 35 ft + escalada, Shifter ×4 com size+perícia.

**Dois falsos positivos do meu probe, verificados antes de virarem bug reportado** (o mesmo
cuidado que a revisão do S-A2 fixou como regra): (a) "Khoravar: escolha sem opções" - o pool dela
é uma **expressão de filtro** (Cleric/Druid/Wizard nível 0) que resolve para **35 cantrips**, e meu
contador só sabia ler lista estática; (b) "Simic Hybrid/Vedalken sem escolhas" na leitura ao vivo -
essas espécies **não têm arte**, e meu extrator de trecho usava o crédito da arte como delimitador.
Ambos eram defeito do instrumento, não do app.

Mobile 375px sem overflow, zero erros de console. Suíte (1147), lint e sweep (285/285 `--strict`)
inalterados. **Restam 37 linhas `todo`, todas do Bloco S-E** (cenário/legado, atrás do filtro).

## 92. Phase T - T1b sessão 8: Bloco S-E CONCLUÍDO ⇒ **STAGE T1 COMPLETO** (285 unidades)

Fecha o último bloco de espécies e, com ele, a etapa T1 inteira. **Nenhum bug; nenhum código
tocado.** Passada leve, como o plano definia para este bloco (confirmar que constroem, derivam e
não vazam tag).

**Probe nas 38 unidades de cenário/legado** (LFL + Plane Shift + Half-Orc PHB): todas constroem,
derivam, o `autoBuild` converge, zero link morto, toda escolha com opções. Um detalhe confirma o
TC-0053 de passagem: os goblins derivam **AC 10 contra 9** das demais - é o Grit (11+Dex)
aplicando, **inclusive no `Goblin (Ixalan)`**, que era a chave `Goblin|PSX` que aquele fix
adicionou.

**DDL-0064 verificado ao vivo**, com o comportamento exato que o entry descreve:

| busca | filtro padrão | um clique no chip |
|---|---|---|
| Elf | 3 | 5 (+Kaladesh, +Zendikar) |
| Human | 1 | 3 (+Innistrad, +Keldon) |
| Goblin | 2 | 3 (+PSZ) |

E o ponto que mais importa: as três Humans **vazias** (Ixalan/Kaladesh/Zendikar) **não aparecem
nem com o filtro desligado** - foram removidas de vez, não filtradas. O **Aven|PSA** aparece no
filtro PADRÃO, confirmando o amendment do DDL-0064 (deixou de colidir quando o Aven|PSD saiu como
redundante).

---

### 🏁 STAGE T1 COMPLETO

Com este bloco, **as 285 unidades da matriz estão certificadas do lado do builder**: as **135
linhas `class:*`** (T1a, 13 sessões, fechada em 2026-07-22) e as **150 linhas `species:*`** (T1b,
7 sessões, fechada em 2026-07-26 nos 5 blocos do TESTING-PLAN §4.5). A T1b rendeu quatro
correções: **TC-0051** (dado upstream errado), **TC-0052** (lore da edição errada em linhagem
curada), **TC-0053** (5 espécies com armadura natural não implementada) e **TC-0054** (texto do
Tiefling Winged, pedido do usuário).

**Método que se firmou** (e que vale para a T3): um probe descartável sobre `autoBuild` + um
oráculo independente certifica a DERIVAÇÃO da família inteira em minutos, e a passada ao vivo
fica para o que exige olho - arte, layout, fluxo. Com a ressalva que a revisão do S-A2 fixou:
**verifique a suposição do probe antes de reportar** - vários "bugs" que ele acusou nesta campanha
eram defeito do instrumento (pool de magia por filtro, delimitador de texto, formato do derivado).

1147 testes, lint, sweep 285/285 `--strict`, mobile sem overflow, zero erros de console.
**Próxima etapa: T2** - curação do export + importações reais no Foundry.

---

## 93. Phase T - **abertura do STAGE T2**: oráculo de export contra as 48 fichas premade + 1º lote de correções

Com a T1 fechada (as 285 unidades `ui: ok`), começa a **T2: curação do EXPORT**. O sweep já
garantia o piso estrutural do lado Foundry, mas ele compara o nosso export com o nosso próprio
import - então tudo que **nunca foi exportado** era invisível para ele. A prova disso abre esta
seção: a **moeda do personagem saía zerada há meses** e nenhum teste percebia.

### `npm run t2` - re-exportar as fichas oficiais e diffar

Novo harness (`scripts/compare-premades.js` + `scripts/lib/premadeDiff.js`), no espírito do
sweep. Para cada uma das **48 fichas premade oficiais** (12 personagens x níveis 1/5/11/17, em
`DnD Source Material/Character Sheets in JSON/Standard Premade Characters` - documentos gerados
pelo próprio sistema dnd5e, portanto verdade de esquema):

```
P --foundryToCharacter--> C --assembleFoundryActor--> A     e diffa A x P
```

Os achados saem **agregados por CLASSE** (`cat`: `currency`, `skills`, `items.gear.type`,
`advancement.race`...), para triar uma vez por classe de problema em vez de linha a linha. Flags:
`--actor=merric`, `--level=05`, `--cat=currency`, `--verbose`, `--players`. Saída completa em
`testing/premade-report.json`.

Duas peças de projeto que valem para quem for usar:

- **A lista `DELIBERATE`** documenta o que o comparador NÃO reporta e por quê (nome do background,
  identidade de documento, prosa, estado de sessão, contêineres, sentidos derivados). Uma
  diferença sem justificativa ali é bug disfarçado, não ruído - e a lista se pagou na hora: os 48
  achados de "item faltando" eram os packs, que o nosso modelo compra como um item só.
- **`grantCounts`** compara quantos itens cada passo de `ItemGrant` concede por `título@nível`. A
  escada comparada como conjunto esconde isso, e foi só com a contagem que apareceu o TC-0071
  (`paladin Class Features@2`: 3 no premade, 2 nas nossas).

**1ª rodada: 1023 achados em 27 classes.** Todas triadas em `testing/ISSUES.md` (TC-0055…TC-0076),
cada uma com a CAUSA: nosso export, nosso import, ou diferença deliberada.

### Corrigido nesta sessão (1023 -> 745)

| TC | O que era | Onde |
|---|---|---|
| **TC-0055** | `currency` exportada como zero LITERAL - toda a carteira sumia | export |
| **TC-0056** | Traits de origem roteados pelo TÍTULO: as perícias e a ferramenta da origem se perdiam ao importar qualquer premade (129+48 achados) | import |
| **TC-0057** | Item sem `source` gravava fonte vazia; `findFeat` casa nome E fonte, então o talento de origem (e as magias do Magic Initiate) **desaparecia** no re-export, e a espécie podia resolver na EDIÇÃO errada | import |
| **TC-0058** | `sign` e `cant`: exportávamos `common-sign-language` e `thievescant`, fora do vocabulário do dnd5e | export |
| **TC-0060** | **Eldritch Knight e Arcane Trickster chegavam ao Foundry SEM conjuração**: as frações `'1/3'` do 5etools não existem no sistema, e o item de subclasse escrevia `progression: 'none'` fixo | export |

O TC-0060 é o mais severo do lote e não vem dos premades (nenhum deles é EK/AT): saiu de conferir
o vocabulário de `CONFIG.DND5E.spellcasting` contra o que o dado do 5etools escreve. `artificer`
foi **preservado** no Paladino/Ranger 2024 - é o que o dado diz, e o sistema define `artificer` e
`half` de forma idêntica (`divisor: 2`, `roundUp: true`), então a diferença com o premade é de
rótulo, não de mecânica.

O TC-0056/0057 valem também para as fichas Plutonium do usuário e para qualquer ator de fora: um
premade importado agora chega com as perícias da origem, a ferramenta, o talento de origem e a
espécie na edição certa.

### A cegueira do oráculo do sweep, fechada

`decisionSummary` (`scripts/lib/roundtrip.js`) passou a comparar **`currency`**. Era o campo que
faltava para o round-trip pegar o TC-0055 - agora uma regressão volta a falhar a linha em
`--strict`.

### Verificação

1163 testes (+16: moeda, chaves de idioma, forma dos premades no import, `fvttProgression`,
conjuração de subclasse, e o próprio comparador), lint limpo, **sweep 285/285 `--strict`**,
`npm run t2` reproduzível (745 achados, todos triados). Plano da T2 em TESTING-PLAN §5.1-5.2;
decisões em DDL-0072.

---

## 94. Phase T - T2b: **TC-0066 fechado** - o inventário deixa de virar `loot` no Foundry (288 → 0)

Primeira classe do burn-down da T2, e a maior: **288 dos 745 achados** eram itens de inventário
saindo com o tipo errado. No Foundry o tipo do Item decide o que dá para fazer com ele - um `loot`
não se equipa nem se consome -, então uma ficha importada perdia affordance real: tocha, ração,
óleo e poção viravam tesouro morto, e manto, botas e kits também.

### A raiz: a distinção não sai do dado do 5etools

Todo item de aventura carrega o mesmo código de tipo (`G`), e o nosso `GROUP_FOUNDRY` mandava o
grupo `gear` inteiro para `loot`. O SRD reparte item a item - só na pasta `adventuring-gear` são
**35 `loot`, 32 `equipment` e 22 `consumable`**. Não há regra a inferir: é classificação curada
pelo sistema, item por item.

### O fix: o SRD do dnd5e como autoridade, por um registro GERADO

Mesmo padrão do DDL-0055 (uuids de compêndio): `npm run gen:uuids` passou a emitir também
**`EQUIPMENT_TYPES`** (`nome` → `"tipo/subtipo"`, **572 itens**) a partir do pacote `equipment24`
do sistema dnd5e. Só classificação - nenhum texto de regra é copiado, como manda o DDL-0003.
`equipmentFoundryType(name)` consulta o registro e `buildInventoryItems` o adota **apenas dentro
do trio `equipment`/`consumable`/`loot`**: arma, armadura e ferramenta continuam com a nossa
classificação, que é quem carrega dano, CA e perícia.

Resultado por par (o que era e virou):

| era | virou | itens |
|---|---|---|
| `loot` | `consumable` | ball bearings, caltrops, candle, healer's kit, holy water, hunting trap, ink, oil, rations, rope, torch |
| `loot` | `equipment` | bell, costume, ink pen, lamp, net, robe, sprig of mistletoe, tinderbox |
| `equipment` | `consumable` | bead of force |

**Uma exceção deliberada:** o SRD **promove a arma** um item que o 5etools classifica como foco de
conjuração - o "Staff" (e o "Wooden Staff") tem `weaponCategory`, `dmg1` e propriedades no dado, é
só o `type` que diz `SCF`. A promoção só acontece **quando há dano no dado**, então a ficha de arma
nunca é inventada; a categoria vem do raw. Um Staff exportado agora é atacável no Foundry.

### Achado colateral: nome com caixa diferente perdia o item inteiro

A ficha da Quillathe traz **"Sprig of mistletoe"** (m minúsculo). `resolveItemObj` casava o nome
com caixa EXATA, então o item não resolvia contra o compêndio e perdia peso, preço, descrição e
tipo de uma vez - o tipo errado era só o sintoma visível. Agora há uma rede case-insensitive
**depois** do casamento exato, então o caminho normal do builder não muda em nada.

### Verificação

`items.gear.type`: **288 → 0** nas 48 fichas (`npm run t2 -- --cat=items` mostra as três classes
restantes, todas de outros TCs). 1168 testes (+5), lint limpo, sweep 285/285 `--strict`.
Total do comparativo: **745 → 457 achados**.

---

## 95. Phase T - T2b: escadas do item de classe - **TC-0062, TC-0063 e TC-0069 fechados** (457 → 395)

Segunda leva do burn-down da T2, toda no `advancement[]` do item de classe/subclasse - a "receita"
que o Foundry desdobra ao importar e ao subir de nível.

### TC-0062 - a premissa estava errada; medir mudou o alvo

Eu tinha registrado "ScaleValue com identificador VAZIO" como bug. **Não é:** o dnd5e faz fallback
para o slug do título (`configuration.identifier || formatIdentifier(this.title)`), e os próprios
premades deixam a maioria em branco. Uma sonda comparando a chave EFETIVA (`identifier ||
slug(title)`) das 12 classes contra as fichas oficiais mostrou o bug de verdade, mais estreito:

- onde o SRD usa um identificador **curto e próprio** (`points`, `focus`, `die`, `aura`, `mark`,
  `rage-damage`, `inspiration`), nós emitíamos o slug do NOSSO título - `@scale.sorcerer.sorcery-points`
  em vez de `@scale.sorcerer.points`, o que quebra qualquer fórmula do overlay que o cite;
- a causa: a entrada da TABELA vencia por título e a do overlay (que traz o identificador) era
  descartada; e o overlay era ignorado INTEIRO para uma classe com entrada curada.

A precedência passou a ser por ENTRADA - curadas → overlay → tabela -, com a tabela descartada
quando já existe entrada de mesmo título **ou de mesma escala**. Esse segundo critério importa: o
SRD às vezes nomeia diferente o mesmo recurso ("Bardic Die" × "Inspiration Die", "Martial Arts" ×
"Martial Arts Die"), e sem ele o mesmo dado saía duas vezes sob dois nomes.

Mais quatro escalas que a tabela não dá de graça, com o título e o identificador das fichas
oficiais: **Max Prepared Spells / Max Pact Magic Spells** (`max-prepared`) — junto com o
`spellcasting.preparation.formula` que a referencia, que é como o Foundry sabe quantas magias a
classe prepara —, **Cantrips Known**, **Weapon Masteries Known** (`mastery`, só onde a contagem
CRESCE: no SRD, Paladino/Ranger/Ladino, de contagem fixa, não têm a escala) e **Eldritch
Invocations Known**.

Resultado medido: **zero chave faltando** nas 12 classes; a única a mais é a `divine-spark` curada,
que é deliberada (a activity do Clérigo a referencia).

### TC-0063 - sem `ItemChoice`, subir de nível no Foundry não pergunta nada

O premade modela cada escolha de feature como um advancement `ItemChoice` com o POOL de opções e o
nível. Nós emitíamos só o item ESCOLHIDO: o passo do Fighting Style saía com **pool vazio** e as
demais escolhas (Divine Order, Blessed Strikes, Primal Order, Metamagic, Invocations) não geravam
passo nenhum - é o irmão do ItemGrant de níveis futuros do DDL-0055, e sem ele o level-up dentro do
Foundry é mudo.

`buildItemChoiceAdvancements` emite as duas metades, como o SRD: `configuration.pool` com os uuids
de todas as opções e `value.added` apontando, por nível, para o item EMBUTIDO já escolhido - senão o
passo voltaria a perguntar o que já foi decidido. Os picks são **fatiados entre os níveis na ordem**
(o choice-bag guarda uma lista só para todos os níveis), exatamente como os Traits de Weapon Mastery.

Duas armadilhas que só a sonda pegou:

- `optionalFeatureChoices` **funde** os descritores da classe e da subclasse sem marcá-los, então o
  Warlock emitia as invocações duas vezes (classe E subclasse). A diferença é o descritor que só
  aparece quando a subclasse entra.
- Uma opção sem uuid conhecido não entra no pool, e o descritor inteiro é descartado se o pool ficar
  vazio: uma escada que não oferece nada é pior que nenhuma (`allowDrops` segue permitindo arrastar).

Conferido ao vivo: Clérigo 7 (Divine Order @1, Blessed Strikes @7), Feiticeiro 10 (Metamagic 2@2 +
2@10), Warlock 5 (invocações 1@1, 2@2, 2@5, sem duplicata na subclasse), Guerreiro (pool de 4
fighting styles, que é o que o SRD publica).

### TC-0069 fechado de lambuja

No dnd5e as optional features são documentos de CLASSE, em pastas irmãs (`metamagic-options`,
`eldritch-invocation-options`) que o gerador de uuids não varria. Passou a varrer todas as pastas da
classe (159 → **197** features), e as 34 divergências de `compendiumSource` (metamagias, invocações,
pact boon) foram a zero sem tocar no export.

### Dois achados novos, registrados

- **TC-0077** (novo): o premade do Monge tem um `AbilityScoreImprovement@20` com valores fixos - é o
  **Body and Mind** (+4 Dex, +4 Wis), que nossa derivação não concede. Mesma família do TC-0059
  (Druidic/Thieves' Cant) e do TC-0075 (Slippery Mind): feature de CLASSE que concede algo em prosa.
  Vale um registro só para os três.
- O Fighting Style EXTRA do Champion @7 ainda não gera passo: vem de um descritor `feat` do
  `SUBCLASS_FEATURE_GRANTS`, fora dos dois caminhos que a nova função cobre. Anotado no TC-0063.

### Verificação

1173 testes (+10), lint limpo, sweep 285/285 `--strict`, `npm run t2` de **457 → 395** achados.

---

## 96. Phase T - T2b: grants em PROSA de feature de classe (TC-0059/0075/0077) + o balde de esperadas

Terceira leva do burn-down. Diferente das duas anteriores, esta corrige a **FICHA**, não só o
export: três TCs eram a mesma família - "uma feature de CLASSE concede algo que só existe no texto"
- e foram resolvidos por um registro só.

### A varredura veio antes do código

O hand-off pedia varrer o dataset em vez de cadastrar o caso que apareceu, e foi o que decidiu o
escopo. Dois lados, que se confirmam:

- **o SRD do dnd5e** (`packs/_source/classes24`): todo advancement `Trait`/`AbilityScoreImprovement`
  de classe fora dos iniciais e dos ASIs padrão;
- **o dado do 5etools**: toda feature de classe/subclasse de fonte atual cujo texto casa
  `{@language …}`, "proficien* in … saving throw" ou "score(s) increase by N".

Os dois convergem para **seis casos de classe** - e dois deles ninguém tinha reportado:

| feature | nível | concede |
|---|---|---|
| Druidic (Druida) | 1 | o idioma Druidic |
| Thieves' Cant (Ladino) | 1 | o idioma Thieves' Cant **+ um idioma à escolha** |
| Slippery Mind (Ladino) | 15 | salvaguarda de Sabedoria e Carisma |
| **Disciplined Survivor (Monge)** | 14 | **todas as seis** salvaguardas |
| **Body and Mind (Monge)** | 20 | +4 Destreza, +4 Sabedoria (teto 25) |
| **Primal Champion (Bárbaro)** | 20 | +4 Força, +4 Constituição (teto 25) |

Deft Explorer (Ranger), Iron Mind (Gloom Stalker) e Unfettered Mind (Knowledge) já estavam
cobertos - a varredura serviu também para confirmar isso em vez de duplicar.

### O registro

`engine/classFeatureGrants.js`, irmão do `subclassGrants.js`, com quatro campos: `languages`,
`languageChoices`, `saves`/`allSaves` e `abilityBoosts`. Consumido pela derivação (idiomas,
salvaguardas, boosts) e pelo export (um `Trait` no nível da feature para as salvaguardas, um
`AbilityScoreImprovement` de valores FIXOS para o capstone).

Três detalhes que valem registro:

- **O teto 25 dos capstones** não exigiu máquina nova: a ordenação por teto do DDL-0034 (aplica o
  menor primeiro) já faz a coisa certa - um ASI para em 20, o capstone segue até 25, um Epic Boon
  até 30. Coberto por teste.
- **O "one other language of your choice"** do Thieves' Cant virou uma Choice de kind `language`
  (`classgrant-lang@1`), então ganhou seletor na aba Class, entra na completude e é sorteada pelo
  autoBuild sem fiação nova. No export ela viaja num Trait com o idioma CONCEDIDO em `grants` e o
  ESCOLHIDO em `choices` - a forma exata do premade -, e o import passou a **ignorar o que está em
  `grants`** para não confundir concessão com escolha.
- **O sweep pegou uma regressão na hora:** um ASI de valores fixos chega com `assignments` vazio, e
  o import o tratava como decisão do jogador, inventando um pick "Ability Score Improvement" em
  toda linha de nível 20 (20 linhas vermelhas). Agora exige ao menos um aumento real.

### Divergências ESPERADAS: um balde nomeado, não um silêncio

Dois grupos de diferença que **não vão mudar** ficariam para sempre no relatório:

- o premade deixa uma proficiência concedida por feature a cargo de um **Active Effect** (Divine
  Order Protector → `mar`/`hvy`, Primal Order Warden → `med`, Disciplined Survivor →
  `flags.dnd5e.diamondSoul`), e nós a assamos no ator, que é o que a nossa derivação usa na ficha;
- o `AbilityScoreImprovement` do capstone: o próprio SRD usa **as duas formas** (no Monge está no
  item de classe, como o nosso; no Bárbaro, no item da feature).

Em vez de escondê-las na lista `DELIBERATE`, o harness ganhou `EXPECTED`: predicados com motivo
verificado que tiram o achado da contagem e o imprimem **nomeado** no resumo (`+23 expected:
baked-feature-grant, capstone-asi-on-class-item`) e por inteiro no report - mesmo espírito dos
`WAIVERS` do sweep. Contadas, nunca escondidas.

### Verificação

1184 testes (+11, `classFeatureGrants.test.js`), lint limpo, sweep 285/285 `--strict`, `npm run t2`
de **395 → 361** achados (+23 esperadas). **Ao vivo:** um Rogue 1 mostra o seletor "Language 0/1" e
o card LANGUAGES com Common · Thieves' Cant; no 15, SAVING THROWS passa a Dex/Int/**Wis/Cha**.
Decisões em DDL-0073.

---

## 97. Phase T - T2b: as magias concedidas e o pool de recurso (TC-0067/0068 fechados; 361 → 257)

Quarta leva do burn-down. Duas correções grandes vindas de medir o SRD do dnd5e, mais três alvos
baratos (tamanho, alinhamento, identificador de subclasse) e a **higiene das referências** que o
overlay nos fazia exportar quebradas.

### TC-0067 - uma magia sempre-preparada não é "inata"

Detect Magic e Misty Step (linhagem élfica), Hellish Rebuke e Darkness (legacy do Tiefling), Misty
Step do Archfey: tudo saía `method: 'innate'`, `prepared: 0`. O premade usa `method: 'spell'`,
`prepared: 2`, com o uso grátis no `uses` - e o texto do próprio SRD diz por quê:

> "You always have that spell prepared. You can cast it once without a spell slot… **You can also
> cast the spell using any spell slots you have** of the appropriate level."

Ou seja, `innate` TIRAVA do jogador a possibilidade de gastar espaço. Agora só o `innate` CRU do
5etools (aquele em que o dado não declara frequência nenhuma - DDL-0011) continua saindo `innate`,
justamente porque ali não sabemos se gasta espaço.

**Meia correção a mais, do premade do Warlock:** num Warlock PURO não existe espaço comum, então a
concessão DE CÍRCULO da linhagem Drow também tem de sair como `pact` - senão fica sem espaço algum
para gastar. O **cantrip** da mesma linhagem (Dancing Lights) fica em `spell`: cantrip não gasta
espaço. A primeira tentativa promoveu os dois e o comparador acusou na hora.

`spell.method` 26 → 2 e `spell.prepared` 25 → 1 (os dois restantes são quirk do premade: um
`Contact Other Plane` que ele mesmo encoda diferente dos irmãos, e um nome de magia repetido).

### TC-0068 - o pool de recurso vem do SRD, não de mais 14 linhas curadas

14 features chegavam ao Foundry sem `system.uses` (Relentless Endurance, Draconic Flight, Wild
Resurgence, Large Form, Divine Intervention, Uncanny Metabolism…), então não havia o que gastar na
ficha. Em vez de curar caso a caso, `npm run gen:uuids` passou a emitir **`FEATURE_USES_BY_CLASS`**
e **`FEATURE_USES_FLAT`** (47 pools) do SRD - mesmo padrão do `EQUIPMENT_TYPES` (TC-0066) e do
registro de uuids (DDL-0055). Precedência: **curado → SRD → overlay**. `feat.uses` 29 → 0.

**Achado colateral, este mais sério: duas referências `@scale` curadas estavam ÓRFÃS.** O TC-0062
alinhou os identificadores de ScaleValue aos nomes curtos do SRD (`points`, `focus`), mas o registro
de `uses` continuava montando a referência com o slug do NOSSO título - `@scale.sorcerer.sorcery-points`
e `@scale.monk.focus-points` não apontavam para escala nenhuma. E um terceiro caso pior, que uma
sonda de "referência sem escala" não pegaria: `wild shape` apontava para `@scale.druid.wild-shape`,
que EXISTE mas é a escala de **CR**, não a de usos. As três entradas ganharam um campo `id` literal.
**Regra que fica:** a referência tem de casar com o IDENTIFICADOR exportado, nunca com o slug do
título - e uma referência que resolve ainda pode estar apontando para a escala errada.

### Referências `@…[…]` do overlay: 35 apontavam para o vazio

O overlay do 5etools guarda tokens do conversor do Plutonium (`@spell[divine smite|xphb]`,
`@creature[imp|xmm]`) que **não são uuids do Foundry**. Exportávamos crus. Agora `@spell[…]` resolve
no uuid real do compêndio, e a activity que carrega uma referência que não sabemos resolver (as
invocações de criatura - monstro não faz parte do nosso escopo) é **descartada inteira**, o mesmo
princípio dos links órfãos que o módulo já aplicava. Medido nos 48 atores: **35 tokens → 0**.

As de `type: 'enchant'` FICAM. A primeira tentativa as descartou junto (o raciocínio era que os
efeitos de encantamento são pulados na tradução) e o comparador subiu de 18 para 24 na hora: os
premades oficiais TRAZEM essas activities (Martial Arts, Sacred Weapon, Repelling Blast).

### Três alvos baratos

- **TC-0073 (tamanho):** uma espécie com escolha S/M ainda não feita exportava o PRIMEIRO código do
  array, então um Humano premade reimportado virava **Small**. O ator tem UM tamanho: o padrão
  honesto é o MAIOR, que é o que o premade traz. 12 → 0.
- **TC-0074 (alinhamento):** "True Neutral" → "Neutral", e cada palavra capitalizada, como os 48
  premades escrevem. O import já aceitava as duas formas. 12 → 0.
- **TC-0074 (identificador de subclasse):** `open-hand` × `hand`. Não é rótulo - o dnd5e o cita em
  fórmula (`@subclasses.hand.levels`) - e não sai do nome, então virou mais uma tabela gerada do
  SRD (`SUBCLASS_IDENTIFIERS`). As 12 subclasses publicadas usam o identificador canônico; as outras
  123 seguem com o slug. 3 → 0.

### Verificação

1193 testes (+9), lint limpo, sweep 285/285 `--strict`, `npm run t2` de **361 → 257** achados
(+23 esperadas). Decisões em DDL-0074.

---

## 98. Phase T - T2b: o que um ator EXTERNO perdia ao ser importado (257 → 190)

Quinta leva do burn-down. O tema saiu da medição, não do plano: quatro das cinco correções são do
lado do **IMPORT** - decisões que um ator vindo do Foundry trazia e que nós descartávamos em
silêncio. Duas classes de achado foram a **zero** (`skills` e `tools`), e uma terceira também
(`traits.weaponProf`).

### TC-0079 - magia de nome próprio não resolvia e sumia do export

O SRD tira o nome do mago do título (é Product Identity), então o sistema dnd5e escreve "Hideous
Laughter" onde o 5etools transcreve o livro e mantém "Tasha's Hideous Laughter". `resolveSpellObj`
devolvia `null`, e `buildSpellItems` pula a entrada sem `raw`: **uma magia preparada pelo jogador
desaparecia sem aviso nenhum**.

A regra é DERIVADA, não curada - "a magia cujo nome é `<alguém>'s <nome curto>`", aceita só quando
o candidato é ÚNICO. Medida contra o pacote `spells24` do dnd5e: dos 16 casos, **13 saem pela
regra**; os 3 restantes (Arcane Hand, Arcane Sword, Arcanist's Magic Aura) o SRD reescreveu por
inteiro e viraram exceções, conferidas uma a uma por círculo e escola. O sentido inverso
(`srdSpellNames`) faz o `compendiumSource` resolver, então a magia passa a ter procedência mesmo
saindo com o nome do livro.

**O nome exportado continua o do LIVRO** - somos um builder alimentado pelo 5etools, e quem carrega
a identidade do documento é o `compendiumSource`, não a grafia. Para o comparador não acusar 26
falsos positivos, o oráculo passou a reduzir os dois lados ao nome curto (`spellKey`).

### TC-0081 - as magias de um talento não voltavam de um ator externo

Um premade com Magic Initiate traz 2 cantrips + 1 magia de círculo como itens `spell` sempre
preparados. O import os descarta - certo, concessão é derivável -, **mas a derivação não os
recriava**, porque o talento chegava com `choices: {}`.

`featSpellBag` reconstrói o sub-bag casando as magias do ator contra os MESMOS descritores que a UI
usa (`parseChoices` + `spellChoosePredicate`), então nada ali sabe de talento específico. Quando há
listas ALTERNATIVAS (Cleric/Druid/Wizard), vence a que explica mais magias da ficha.

Duas afinações que a medição pediu, ambas lendo marcas que o próprio documento deixa:

- **a magia de um talento carrega o ATRIBUTO dele e a FREQUÊNCIA dele**; a da classe herda os dois e
  vem sem. É o que separa o Bless do domínio (sem `ability`, sem `uses`) do Command do Magic
  Initiate (`wis`, 1/descanso) quando os dois cabem no mesmo filtro;
- **uma magia que uma concessão FIXA já explica não é candidata** - sem esse corte, o Fire Bolt da
  linhagem infernal do Tiefling ocupava um slot de escolha e o Mage Hand que o jogador escolheu
  ficava de fora, perdido.

Medido: das 81 magias `prepared: 2` que sumiam, **57 voltaram**. As 24 restantes são a mesma família
com OUTRO dono (linhagem, subclasse, Magical Discoveries) - ver o hand-off.

### TC-0061 - escolhas dentro de outros documentos (skills 39 → 0, tools 12 → 0)

Três casos, e o terceiro revelou um bug maior que o enunciado:

1. **Ferramentas iniciais da classe.** O premade titula o Trait "Tool Proficiencies"; o nosso
   descritor se chama "Musical Instruments". `choiceTraitBag` casava só por título, então as 3 do
   Bardo e a do Monge se perdiam. Agora há um índice de reserva por **(kind, nível)**, usado quando
   o título não casa e só se for único ali - a mesma lição do TC-0056: um documento de fora escreve
   o título que quiser.
2. **Bonus Proficiencies de subclasse.** As 3 perícias do College of Lore vivem no item de
   SUBCLASSE, que o import não lia. Passou a ler.
3. **Traits dentro de um talento concedido.** O Skilled guarda os três picks numa Trait só, sem
   título, misturando `tool:` e `skills:` - então cada chave é roteada pelo PRÓPRIO prefixo, e o
   destino pode ser o descritor do kind exato ou um `mixed` que aceite aquele kind.

**O achado maior, ao fazer (3):** o talento do **Versatile do Humano se perdia INTEIRO**. O
`value.added` de um `ItemChoice` é ANINHADO POR NÍVEL (`{"0": {id: uuid}}`), e o código assumia a
forma plana do `ItemGrant` - `byId.get("0")` não devolvia nada. Sonda nas 48 fichas: **as 12 que têm
ItemChoice de raça usam a forma aninhada**, ou seja o caso plano assumido não existe em nenhuma.
`addedItemIds` passou a ler as duas.

### TC-0076/TC-0078 - a regra CONDICIONAL de arma, enumerada

O Monge 2024 é proficiente em "Simple weapons and Martial weapons that have the Light property".
Isso vira uma frase na ficha (o certo para o jogador ler), mas o Foundry só entende CÓDIGOS - e sem
eles o Monge importado **não é proficiente com cimitarra**.

Não precisou de curadoria: o 5etools guarda a mesma regra estruturada em
`weaponProficiencies[].all.fromFilter`, o mesmo insumo do `weaponFilterAllows` (DDL-0033). A ficha
continua mostrando a frase; só o export enumera (`derived.weaponNames`, campo à parte).

De passagem, uma correção do INSTRUMENTO: o premade do Ranger lista `longbow`/`shortbow` ao lado de
`sim`+`mar`, que já os cobrem. Quem tem os dois é proficiente com toda arma mundana, então os dois
lados são reduzidos antes do diff - sem esconder o caso que importa, porque Monge e Ladino têm só
`sim` e para eles cada arma marcial PRECISA estar enumerada.

### Verificação

1209 testes (+16), lint limpo, sweep 285/285 `--strict`, `npm run t2` de **257 → 190** achados
(+23 esperadas), e passada ao vivo (o card de Proficiências do Monge segue mostrando a FRASE, não as
armas uma a uma; zero erros de console). Decisões em DDL-0075.

---

## 99. Phase T - conhecida x preparada, e o resto do TC-0081 (190 → 170)

Duas frentes numa sessão: fechar as 24 magias que ainda se perdiam ao importar um ator externo, e
modelar a distinção **conhecida x preparada** que o TC-0080 tinha deixado como decisão do usuário.

### O resto do TC-0081: um genérico no lugar do específico

As 24 restantes eram a mesma família com outro DONO. `featSpellBag` virou **`spellChoiceBag`**,
parametrizado pelos descritores da entidade, e ganhou três chamadores: espécie (o cantrip à escolha
da linhagem élfica), classe e subclasse (as Magical Discoveries do College of Lore, o terreno do
Circle of the Land).

Duas coisas que o genérico precisou aprender:

- **uma lista alternativa pode não ter escolha nenhuma.** As quatro do Circle of the Land são listas
  FIXAS de terreno; a única evidência de qual o jogador tomou são as magias concedidas que a ficha
  tem. Daí o `grantedFor`: vence o grupo que explica mais magias somando escolhas casadas E
  concessões fixas. Sem evidência alguma, nenhum grupo é escolhido.
- **ninguém reivindica a mesma magia duas vezes.** O conjunto `explained` passou a ser MUTADO por
  cada chamada, na ordem espécie → talento → classe → subclasse; e numa bag de classe, uma magia que
  o ator atribui a OUTRA classe (`sourceItem`) nem é candidata.

Medido: as magias `prepared: 2` que sumiam foram de **81 a zero** nas 48 fichas.

### Conhecida x preparada (TC-0080, decisão do usuário)

A distinção é **uma bandeira no ref que já existe**: `SpellRef.prepared === false` = no repertório,
não preparada. Ausente = preparada - o que faz toda ficha antiga derivar idêntica, sem migração e
sem bump de schema.

- **A derivação separa em vez de reinterpretar:** `origin.prepared` continua sendo o que está
  preparado e ganha o irmão `origin.unprepared`, então nenhum consumidor antigo mudou de sentido.
- **Cantrip e arcanum ficam de fora** - um está sempre disponível, o outro não gasta espaço.
- **O limite de conhecidas sai do dado:** `spellsKnownProgressionFixed`, que entre as 12 classes de
  2024 só o Mago tem. Cuidado do campo: ele é o DELTA por nível (`[6,2,2,…]`), não o total, então o
  limite é a soma acumulada. E é PISO, não teto (o Mago copia de pergaminho), então passar do número
  só acende o contador.
- **Toggle no molde do inventário:** `PreparedToggle` é o mesmo átomo do "equipar" - só o círculo,
  preenchido = preparada -, e a linha despreparada recua para o segundo plano.
- **Padrão ao adicionar: preparada; cheio, despreparada.** Isso obrigou dois ajustes que a passada
  ao vivo pegou: o seletor parou de esconder os círculos quando as preparadas enchem (o filtro
  existia para mostrar "onde cabe", e agora sempre cabe), e o botão "+ Prepare spell" parou de
  desabilitar por preparadas cheias.
- **Export/import:** `prepared: 0` nos dois sentidos - a forma que o próprio premade usa. A bandeira
  entrou no `decisionSummary` do sweep, pela regra do TC-0055 (campo de decisão fora do oráculo
  deixa o round-trip cego).

O que continua fora, e é o certo: as 35 magias soltas da Riswynn (Ladino/Thief, sem conjuração) não
têm origem que as segure.

### Verificação

1218 testes (+9), lint, sweep 285/285 `--strict`, `npm run t2` de **190 → 170**, e ao vivo num Mago
2: Known 0/8 → 6/8, a 6ª magia entrando despreparada com Prepared parado em 5/5, o toggle levando a
6/5 em vermelho e voltando, mobile 375px sem overflow, zero erros de console. Decisões em DDL-0076.
Achado novo de passagem: **TC-0082** (o Find Familiar do Wild Companion, que o dado codifica como
sempre-preparada mas o texto trata como permissão de conjurar).

---

## 100. Selector: chip de filtro que não leva a lugar nenhum fica DESABILITADO

Melhoria de usabilidade pedida pelo usuário, portada do GLIS (outro app dele, cujo catálogo nasceu
do `filterModel.js` daqui e devolveu a ideia). Ao marcar um filtro, as opções dos OUTROS grupos que
já não alcançam nenhum resultado ficam apagadas e inertes, em vez de virarem um clique que esvazia a
lista. O exemplo do pedido, verificado ao vivo: no seletor de espécies, marcar **Size: Small** apaga
**Speed: Swim** (nenhuma espécie Small tem natação), junto com Powerful Build, Aberration e 11 fontes.

### A contagem

`facetCounts(items, {query, filterState, filterIds})` (`selector/filterModel.js`, puro) devolve
`{ [filtro]: { [opção]: n } }` = quantos resultados restariam se aquela opção fosse marcada.

- **A contagem de um filtro ignora o estado DELE MESMO** e aplica todos os OUTROS - é exatamente o
  que o clique produz. Se ela se contasse, marcar "Small" zeraria as outras opções de tamanho e o
  grupo viraria um beco sem saída; dá para marcar Small E Medium, porque dentro de um filtro o
  include é OR.
- **Uma opção ATIVA nunca desabilita**, senão não haveria como desmarcar o filtro que zerou a lista.
  Verificado ao vivo: Small percorre include → exclude → off e a lista volta a 75.
- **Custo:** uma passada só sobre os itens. Para cada item conta em QUANTOS filtros ativos ele
  reprova - 0 entra na base de todos, 1 entra só na do filtro que reprovou, 2+ em nenhuma - em vez
  de refiltrar a lista por filtro (o caminho direto seria filtros × opções × itens). Medido no
  browser: 7 ms no pior caso sintético (7700 itens × 6 filtros, o tamanho do glossário), 5 ms na
  forma da loja (4700 × 10). E roda só ao REFINAR: as dependências do memo são
  `(items, query, filterState, entity.filters)`, nenhuma delas recriada a cada render, então passar
  o mouse por um card não recalcula nada.

### Limite deliberado

A conta NÃO considera o `exclude` do painel (o predicado que esconde o que já está na ficha): em
vários chamadores ele é uma closure recriada a cada render, e depender dele faria a conta refazer-se
a cada hover. O preço é uma opção que sobrevive habilitada levando só a itens já possuídos - raro e
inofensivo.

Verificado: 1224 testes (+6 em `filterModel.test.js`), lint, e ao vivo no seletor de espécies
(desktop 1280px e mobile 375px, o mesmo comportamento na gaveta, sem overflow e zero erros de
console).

---

## 101. Selector: opção que nunca alcança nada é REMOVIDA (e o bug que a remoção ia esconder)

Segundo passo do §100, pedido do usuário: além de desabilitar o que está zerado AGORA, sumir com o
que está zerado SEMPRE. Não existe espécie jogável Tiny nem Large em edição nenhuma, então os dois
chips eram peso morto permanente.

### A regra, e por que ela é diferente da anterior

Uma opção cujo valor NENHUM item do catálogo carrega é removida da lista. Contada sobre `items`
cru - **sem busca e sem filtro** - porque a pergunta é sobre o CATÁLOGO, não sobre a tela. As duas
regras convivem e a diferença aparece ao vivo no seletor de espécies:

- **Tiny / Large / Blindsight somem** (zero no dataset inteiro, conferido inclusive no `races.json`
  cru, sem `latestOnly`: `{M: 125, S: 49, V: 1}`);
- **PSD / PSI continuam apagados, não sumidos**: existem, e estão fora só porque o filtro "Setting
  Variant" vem pré-marcado (DDL-0064). Removê-los tornaria inalcançável algo que um clique em Clear
  devolve.

Só atinge as opções FIXAS - as derivadas saem dos dados e nunca nascem mortas. Catálogo vazio (db
carregando) não poda nada. Um grupo que fique sem nenhuma opção some inteiro.

Outras podas medidas: **classe / Primary Ability perde Constitution** (nenhuma classe a tem como
primária) enquanto **Saving Throws mantém** (quatro classes têm) - a regra é por filtro, não por
nome de valor.

### O achado: "Very Rare" nunca funcionou

A sonda que mediu o que estava morto acusou **"Very Rare" com zero itens na loja** - o que não podia
ser verdade. O `cap()` genérico do `item.js` só sobe a PRIMEIRA letra, então o precompute emitia
`"Very rare"` e a opção declarada era `"Very Rare"`: **o chip existia, e nunca achou nenhum dos 732
itens.** O rótulo exibido no card e na linha de meta também saía errado.

Corrigido com um mapa `RARITY_LABEL` (as raridades de uma palavra continuam pelo `cap`; valores fora
do mapa - `unknown`, `unknown (magic)`, `varies` - também). Ao vivo: marcar Very Rare vai de 0 para
**732 resultados**.

**Isso é o que a poda ia esconder**, e é a razão da rede de segurança: em DEV, quando uma opção fixa
morta convive com um valor EMITIDO que nenhuma opção cobre, o painel avisa no console. Essa
combinação é a assinatura de um valor digitado errado, não de uma opção legitimamente inútil - Tiny
e Large não disparam nada, porque ali não há valor órfão do outro lado.

Fica anotado, não corrigido (não é regressão, e o rótulo é decisão de produto): **301 itens têm
raridade sem chip nenhum** - `unknown` (38), `unknown (magic)` (255) e `varies` (8).

Verificado: 1226 testes (+2), lint, sweep 285/285 `--strict`, e ao vivo (espécie, classe e loja).

---

## 102. Phase T - T2b sessão 7: o item de ESPÉCIE, as escadas de concessão e as activities do SRD (170 → 71)

Sessão de burn-down que fechou **todas as pendências `TC-` abertas** do ledger: TC-0064, TC-0065,
TC-0070, TC-0071 (a parte acionável), TC-0072 e TC-0082. Decisões em **DDL-0079**.

**O item de ESPÉCIE ganhou a forma que o dnd5e usa (TC-0064, decisão do usuário).** Antes só um
traço com ação ou recurso virava item e o resto ficava como Active Effect no item de raça: no
Foundry o jogador não VIA "Fey Ancestry", "Trance" ou "Powerful Build" entre as features. Agora
**todo traço vira um item**, com o nível lido da prosa (`"When you reach character level 5"` /
`"Starting at character level 5"`, as duas fórmulas do dado) - então **Draconic Flight e Large Form
deixaram de ser concedidos no nível 1** e viram a receita de compêndio do nível 5. Junto vieram o
**ScaleValue do Breath Weapon** (a activity do sopro referenciava `@scale.dragonborn-silver.breath`,
que não existia - o dano rolava ZERO) e o Trait de resistência.

**O nome do documento passou a ser o do dnd5e** ("Elf, High" no lugar de "Elf; High Elf Lineage";
"Elven Lineage, High Elf" no lugar de "Elven Lineage (High Elf)"), o que também destravou o
`compendiumSource` da espécie e dos traços. A ficha do FlyBy continua mostrando o nome do livro.

**A ancestralidade volta de um ator externo (TC-0065).** O documento do dnd5e nomeia a espécie
inteira, então "Dragonborn" não diz a cor: ela vive no Trait de resistência (`dr:cold`) e, no
Goliath, no `ItemChoice`. `inferLineage` lê essas marcas; o NOSSO export leva a linhagem exata numa
flag (DDL-0028).

**As escadas de concessão cobrem os níveis JÁ alcançados (TC-0072)**, com `value.added` apontando
para o item de magia embutido - é o que diz ao Foundry de onde veio a magia que o personagem já
tem. Vale para subclasse e linhagem; para a classe, só os níveis futuros (é lá que ela faz
diferença, e o SRD não tem o passo).

**Activities geradas do SRD (TC-0070, decisão do usuário).** Das 133 features do SRD com activity,
13 eram curadas à mão. `npm run gen:srd` extrai as activities **e os Active Effects que elas
referenciam por `_id`** - nunca separados. Precedência curado → SRD → overlay, **tudo-ou-nada por
tier** (somar os dois fazia "Cunning Action: Hiding" sair em dobro). O parser
(`scripts/lib/yamlLite.js`, 6 testes) cobre o subconjunto de YAML dos packs, medido nos 336
arquivos, em vez de uma dependência nova só para o gerador.

**Menores:** "Metamagic Options"/"Eldritch Invocation Options" são CATÁLOGO de optional features e
deixaram de virar item (detectado pela forma, não por nome); o talento escolhido pela espécie virou
`ItemChoice`; e o **Find Familiar do Wild Companion deixou de ser concedido** - a feature permite
conjurá-lo, não o deixa preparado (TC-0082, novo registro `REMOVED_ADDITIONAL_SPELLS`).

Verificado: 1238 testes (+12), lint, sweep 285/285 `--strict`, `npm run t2` de **170 → 71** achados
(+33 nomeadas como esperadas), e uma sonda sobre as 48 fichas confirmando **zero** referência de
effect órfã e **zero** effect duplicado.

---

## 103. Revisão dos adiados: os três aprovados automaticamente (63 achados)

Depois do levantamento em `DEFERRED-REVIEW.md`, os itens **sem malefício algum** foram
implementados por regra do usuário.

**A1 - o item "Unarmed Strike" do Bárbaro e do Monge.** É o que dá o botão de ataque desarmado na
ficha do Foundry, e um Monge criado no FlyBy chegava lá **sem a arma principal da classe inteira**.
O comparador não denunciava porque as fichas premade já trazem o item (entrava pelo import e voltava
no export) - só um personagem criado do zero sofria. A premissa antiga do TC-0071 ("emiti-lo seria
inventar um documento") estava ERRADA: o item existe no `equipment24` do dnd5e. `npm run gen:srd`
passou a emitir `SRD_CLASS_WEAPON_GRANTS` lendo o ItemGrant do PRÓPRIO documento da classe - a única
fonte que diz qual uuid usar, porque o Bárbaro aponta para a cópia do `equipment24` e o Monge para a
do `classes24`. O import o ignora como inventário (a derivação o recria da classe).

**A2 - `{@table}` inline deixou de ser inerte.** O motivo de estar inerte era o risco de link morto,
e ele caiu no DDL-0035, quando as ~2300 tabelas do gendata passaram a ser carregadas. `lookupTable`
indexa por `nome|fonte`; o `TableLink` abre a tabela no popup de regra e degrada para texto simples
quando não resolve. Alcance medido: **230 tags no conteúdo que exibimos, 226 resolvem** - a maior
parte em descrição de item mágico.

**A3 - as raridades sem chip.** `unknown`, `unknown (magic)` e `varies` não tinham opção no filtro,
e por isso **301 itens eram inalcançáveis**. Entraram no `RARITY_LABEL` (o que também limpa o rótulo
do card) e no `RARITY_OPTIONS`; nenhuma vira badge colorido, que continua só para os tiers reais.

Verificado: 1247 testes (+9), lint, sweep 285/285 `--strict`, `npm run t2` de 71 → **63**, e ao vivo
no browser (o chip "Unknown (Magic)" devolvendo os 255 itens; o link "minor beneficial" do Axe of
the Dwarvish Lords abrindo a tabela d100, com os links de condição vivos dentro dela).

---

## 104. Revisão dos adiados, leva 2: os aprovados restantes e as sugestões (63 → 43)

Segunda leva do `DEFERRED-REVIEW.md`, sob o princípio que o usuário fixou: **o SRD é referência, não
autoridade** - onde segui-lo penaliza o usuário ou o funcionamento da ficha exportada, divergimos, e
o comparador NOMEIA a divergência em vez de escondê-la.

**A5 - o pseudo-idioma `other`.** O 5etools usa a chave `other` quando o idioma é o próprio do
cenário, e a ficha mostrava literalmente "Other" - no card de Idiomas de 21 espécies e como OPÇÃO do
seletor do Simic Hybrid, a única escolha do app que não dizia o que era. Novo registro curado
`engine/speciesLanguages.js` (22 entradas). **A varredura correta não é sobre `races.race`:** a
primeira passada fez isso e ficou incompleta em três entradas, porque `other` também vem de
`races.subrace` (o Keldon) e de reimpressões por `_copy` (Minotaur|MOT). O cabeçalho do módulo manda
varrer o CATÁLOGO RESOLVIDO. O **Human (Ixalan) fica de fora de propósito**: lá o idioma depende da
origem nacional do personagem, então não há resposta única, e "Other" é a degradação honesta.

**A4 - o boon da ancestralidade como item próprio.** "Cloud's Jaunt" vira documento à parte, por uma
regra ESTREITA: o traço tem de ter exatamente UM sub-item nomeado E o nome tem de existir no
`origins24` (a base do Goliath lista os seis no mesmo traço, e por isso não casa). Entra num passo de
advancement próprio, para não inflar a contagem do passo oficial.

**5.1 - Unarmed Strike para TODA classe.** A primeira divergência deliberada do SRD sob o princípio
acima: ele concede o item só ao Bárbaro e ao Monge, mas a regra 2024 diz que toda criatura pode fazer
um Ataque Desarmado, e sem o item um Mago desarmado chega ao Foundry sem botão nenhum de ataque.

**5.2 - as convenções de nível viram `EXPECTED`.** O SRD não tem regra (`@0` no Gnome, `@1` no Elfo).
**Antes de nomeá-las, fechei uma lacuna REAL que o predicado esconderia:** a magia ESCOLHIDA da
linhagem (o cantrip do Alto Elfo) não entrava na escada de concessão porque o `bag` não era passado
ao `grantedSpells`.

**5.3 - aviso de magia sem origem no import.** Um ator externo pode listar magias que nenhuma classe
da ficha sabe conjurar (35 no premade da Riswynn); elas somem, e sumir CALADO era a parte ruim. O
import agora avisa. A forma elaborada (guardar o conteúdo) fica pendente como B4 no
`DEFERRED-REVIEW.md`.

**A lição da leva:** divergir do SRD sem NOMEAR a divergência faz o placar SUBIR. O Unarmed Strike
universal acrescentou 40 achados de `items.gear` e inflou o `class-spell-ladder` de 6 para 46, porque
o passo novo se misturava ao ItemGrant oficial. A correção foi dupla - título de advancement próprio
para o que é nosso, e uma entrada `EXPECTED` com o motivo escrito.

Verificado: 1259 testes (+12), lint, sweep 285/285 `--strict`, `npm run t2` de 63 → **43** (+85
nomeados), e ao vivo (o seletor de idioma do Simic Hybrid mostrando "Elvish" e "Vedalken"; um Monge,
um Bárbaro e um Fighter criados do zero saindo com o item de ataque desarmado).

**Achado colateral, NÃO corrigido:** o `BuilderInner` viola a ordem dos Hooks (erro de console ao
abrir a ficha). Confirmado por A/B como **pré-existente**, não regressão desta sessão. Registrado
como TC-0083.

---

## 105. Revisão dos adiados, leva 3: as decisões B (43 → 35)

As cinco decisões que faltavam no `DEFERRED-REVIEW.md`, resolvidas pelo usuário.

**B1 - os chips de meta duplicados: MANTER, com uma razão melhor que a minha.** Eu tinha tratado a
prosa redundante de "Creature Type"/"Size"/"Speed" (95 entradas do dado) como ruído. Não é: **muitas
dessas prosas detalham o funcionamento CORRETO da feature** - a limitação do voo à armadura leve
(média no Tiefling Winged) está no TEXTO, não no chip -, servem de lembrete do traço para jogadores
novos, e o chip continua útil como referência rápida para quem já conhece a regra. As duas
apresentações têm função diferente. Encerrado, não é mais pendência.

**B2 - o `swap` do Dwarf: FEITO.** O módulo `legacyHalflingLineages.js` virou o genérico
**`legacySwapLineages.js`**, com um registro `SWAP_LINEAGES` de duas entradas. O "Dwarf Lineage"
oferece **Hill** e **Mountain**, cada uma TROCANDO o Dwarven Toughness que a base 2024 absorveu do
Hill - exatamente a forma do DDL-0063, incluindo a regra de que o conjunto tem de conter a opção que
reproduz a base.

**Duas armadilhas que isso destapou, e valem como regra:**
1. **Um `swap` move a MECÂNICA junto com o traço.** O Dwarven Toughness (+1 HP/nível) vive num
   registro keyed por nome de raça RESOLVIDA (`hpBonuses`); ao virar linhagem, a chave `Dwarf|XPHB`
   deixou de casar e **nenhum** Dwarf ganhava o HP. Quem acrescentar uma espécie ao `SWAP_LINEAGES`
   tem de migrar a chave para a opção que carrega o traço.
2. **Assinatura derivada larga dá falso positivo - foi a SEGUNDA vez.** O gerador marcava "o
   documento do SRD guarda a linhagem dentro de si" com um `- dr:` em qualquer lugar do YAML; a
   resistência a veneno do Dwarven Resilience é um **grant fixo**, não escolha, então o Dwarf entrava
   e a linhagem que NÓS criamos herdava o nome e a procedência do documento publicado - o near-match
   que o DDL-0056 proíbe. Agora o `dr:` tem de estar sob `pool:`.
   **O sweep pegou as duas na mesma rodada** (137 linhas vermelhas).

**B3 - o polimento do PDF: ADIADO** (a ficha digital já cumpre o papel da impressa). Quando voltar, o
overflow vem primeiro: é a única parte que pode inutilizar a folha.

**B4 - magias sem origem: LOSSLESS FEITO.** Novo campo aditivo `character.unassignedSpells` (balde de
CARGA, sem bump de schema): o que um ator importado trazia e nenhuma classe da ficha sabe conjurar
fica guardado e **volta ao Foundry no re-export**. Não aparece na Spellbook nem conta em limite
nenhum, porque não tem origem. Medido no premade da Riswynn L17: 34 magias entram, 34 saem, e o balde
é estável num segundo ciclo. A atribuição de origem pelo jogador ficou agendada (B4b) - o balde já
guarda `SpellRef`, a mesma forma do `ClassEntry.spells`, então atribuir será MOVER o ref.

**B5 - criação em nível alto: manter como está**, e as menções foram removidas da documentação
(CLAUDE.md "Explicitly OUT OF SCOPE" e TESTING-PLAN).

Verificado: 1263 testes (+4), lint, sweep **286/286** `--strict` (uma linha nova: Hill e Mountain no
lugar do Dwarf base), `npm run t2` de 43 → **35** (+93 nomeados), e ao vivo - o preview do Dwarf
mostra "Dwarf Lineage" com Hill e Mountain, sem erro de console novo. A pane do browser não compôs
frames neste ambiente (mesma limitação do DDL-0066), então a passada visual foi por `read_page` e
pelos mesmos code paths da UI.

---

## 106. Revisão dos adiados, leva 4: C0, C4, as sugestões e a família das resistências (35 → 18)

Quarta e última leva da revisão aberta em `DEFERRED-REVIEW.md`. Fecha os dois itens C que ainda
tinham resolução pendente, as duas sugestões que dava para fazer antes do T2d, e o TC-0083 - que
**não era bug**. Ver DDL-0080 (mesma entrada das levas 1-3).

**C0 - a ancestralidade volta a ser uma ESCOLHA aos olhos do Foundry.** Uma espécie com linhagem
resolvida guarda só o traço escolhido, então o item de raça saía sem nenhum `ItemChoice` - o Foundry
recebia o boon do Goliath como se fosse concessão fixa e não oferecia trocá-lo. `ancestryBoonPool`
(`engine/foundryItems.js`) monta o pool dos seis boons a partir do traço-guarda-chuva da espécie
BASE, e o passo só é emitido quando **pelo menos dois** uuids resolvem (com um só, não há escolha a
oferecer). Sai um `ItemChoice@0` com `restriction: {type:'race'}` e `value.added` apontando para o
item embutido do boon escolhido. A classe `advancement.race` foi a **zero**.

**C4 - um pack agora é CONTÊINER + conteúdo, nos dois sentidos.** `unpackContainer` desdobra a
entrada única do inventário em um item `container` mais os itens de dentro, tudo derivado do
`packContents` do 5etools (20 packs o declaram). Três cuidados que a medição impôs:
- **o peso do contêiner é o peso do RECIPIENTE**, não o total do pack: o Foundry SOMA o conteúdo, e
  usar o total contava tudo duas vezes;
- **o preço fica só no contêiner** (`price: 0` nos filhos), pela mesma razão;
- **o import recolhe de volta numa entrada só**, pulando os filhos por `system.container` e o
  contêiner por ele ter `packContents` - a decisão do DDL-0013 (o pack é um item) fica intacta.
Idêntico ao premade da Akra: 5 lb, 33 gp, 6 conteúdos.

**O que abrir o comparador revelou.** `container` estava na lista `DELIBERATE` (o comparador nem
olhava), e tirá-lo de lá expôs **55 achados reais**: Bag of Holding, Backpack e Pouch saíam como
`equipment`, e por isso **não guardavam nada** no Foundry. `RECLASSIFIABLE` ganhou `container` e o
tipo passa a vir do `equipment24` como qualquer outro. **Regra que fica: uma entrada em `DELIBERATE`
protege uma decisão e ao mesmo tempo CEGA o oráculo - revise-a quando a decisão mudar.**

**§5.2 - as 3 magias que faltavam eram DUAS causas distintas**, como a sugestão previa:
- uma magia de **PERGAMINHO** (`sourceItem` apontando para um `consumable`) caía num balde de classe
  que ninguém lia. É o mesmo defeito do B4 por outra porta: agora é roteada para a carga
  (`SPELL_OWNED_BY_ITEM` em `spellSourceClass`), então volta ao Foundry no re-export;
- a **cópia do cantrip por invocação** é convenção do premade (a invocação, no nosso modelo, é uma
  feature; o cantrip é um só). Nomeada `invocation-spell-copy`.

**§5.4 - `npm run check:keys`, a rede contra chave morta.** `scripts/check-species-keys.js` cruza os
6 registros curados keyed por `Nome|FONTE` de espécie com o catálogo RESOLVIDO (espécies + toda
linhagem) e acusa chave que não casa nada. Nasceu da armadilha da leva 3 (o `Dwarf|XPHB` do
`RACE_HP_PER_LEVEL` parou de casar quando o Dwarf ganhou linhagem, e **nenhum** Dwarf ganhava mais o
+1 HP/nível). Hoje: 0 chaves mortas.
**A sonda deu um falso positivo antes de acertar**, e o instrumento é que estava errado: o
`naturalArmorFor` também tenta `<baseName>|<fonte da variante>` (é como o Goblin de Ixalan herda o
Grit), então essa forma precisa entrar no pool. **Descartar o defeito do instrumento é o primeiro
passo, sempre.**

**TC-0083 (ordem dos Hooks no `BuilderInner`) - `wontfix`, não era bug.** Era resíduo de HMR: eu
havia editado o `useCharacterImport` momentos antes das duas medições. O A/B definitivo, em **ABA
NOVA**, mostra as duas versões do arquivo carregando limpas. O `useCallback` que eu tinha removido
"para consertar" foi restaurado. **Regra: `location.reload()` na mesma aba não descarta artefato de
HMR** - num projeto com o React Compiler o grafo de módulos sobrevive ao reload. Abra uma aba nova
antes de tratar um aviso de ordem de hooks como bug.

**Uma família REAL que a varredura destapou: resistência a dano de feature de subclasse.** Ao
conferir os achados restantes, dois deles (`traits.dr` + metade de `advancement.subclass`) não eram
quirk nem espera de T2d: **um Sorcerer Draconic 6, um Warlock Celestial 6 ou um Cleric War 17 não
tinham resistência nenhuma na ficha.** A varredura das 37 features de fonte atual que citam
`{@variantrule Resistance|Immunity}` separa quatro grupos, e só o primeiro deriva - o critério inteiro
está no cabeçalho do `engine/subclassGrants.js`:
- **permanente e FIXA** (6 casos) -> campo `resist` novo no `SUBCLASS_GRANTS`, consumido pelo
  `deriveDamageTraits`: Avatar of Battle, Guarded Mind, Psychic Defenses, Radiant Soul, Thought
  Shield, Necrotic Husk;
- **permanente À ESCOLHA** (1 caso) -> Elemental Affinity vira uma escolha kind `resist` no
  `SUBCLASS_FEATURE_GRANTS`, com o pool fechado dos cinco tipos dracônicos. O kind já existia (a
  escolha estruturada de raça/talento o usa), então UI, completude, autoBuild e derivação vieram de
  graça;
- **RE-ESCOLHIDA a cada descanso** -> não é decisão de build, é estado de sessão: Fiendish
  Resilience, Dread Allegiance, Nature's Ward. Fica na prosa até a Phase C ter play-state;
- **condicional a uma aura/forma/reação, ou não sobre um TIPO de dano** -> prosa, pela mesma regra que
  o `damageTraits` já aplicava. Inclui a versão PHB do Avatar of Battle ("from nonmagical attacks"),
  que é um `bypasses` do Foundry - por isso aquela entrada casa a fonte.
No EXPORT a escolha vira um `Trait` no nível da feature com pool `dr:<tipo>` (o padrão do DDL-0056
estendido), e o import lê `dr:` de volta. **Regra que fica: antes de cadastrar o caso que apareceu,
varra o dataset** - foi o que separou 7 casos acionáveis de 30 que pareciam iguais.

**E o segundo Fighting Style do Champion voltou.** O premade encoda a escolha como um `ItemChoice` de
tipo feat no item de SUBCLASSE (nível na chave de `choices`, não no campo `level`); nós não emitíamos
o passo e o import não o lia, então **um Champion vindo de um ator externo perdia o estilo em
silêncio**. O `buildItemChoiceAdvancements` ganhou um terceiro caso (pool de talentos, `restriction`
de feat, índice de itens à parte para um talento homônimo de uma optional feature não se confundir) e
o import ganhou o `subclassFeatChoiceBag`, que casa o passo pelo NÍVEL da chave e, na falta, pelo
título.

**Documentação.** `DEFERRED-REVIEW.md` foi reestruturado a pedido do usuário: PENDENTE / RESOLVIDO /
DECIDIDO POR DESIGN / FORA DO ALCANCE, cada item em uma seção só (a versão anterior misturava
resolvido com pendente, especialmente no C7). Saíram as menções ativas às três decisões que na
prática são de design: os chips de meta redundantes (que o usuário decidiu MANTER - a prosa detalha o
funcionamento correto da feature, como a limitação do voo à armadura leve), o nome do item de
background e as classes sidekick/UA. As entradas históricas do DDL log ficam como estão.

Verificado: 1274 testes (+11), lint, `npm run check:keys` (0 mortas), sweep **286/286** `--strict`,
`npm run t2` de 35 → **18** (+65 nomeados como esperados), e ao vivo (o pack no inventário, o A/B do
TC-0083 em aba nova, a resistência derivando ponta a ponta na ficha e no ator). **Três classes de
achado foram a zero** (`traits.dr`, `advancement.subclass`, `items.feat`).

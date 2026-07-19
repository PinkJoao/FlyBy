# Findings ledger - Phase T (TESTING-PLAN.md)

One numbered entry per finding (`TC-xxxx`). Sessions APPEND here; nothing is
silently deleted - a fixed issue gets `status: fixed@<date>`, a rejected one
`wontfix` + why. Open `TC-` ids referenced by `KNOWN_ISSUES` in
`scripts/lib/roundtrip.js` keep the sweep green while they wait; **closing an
issue = fixing the code + removing its pattern there + a clean sweep.**

Severity: `blocker` (wrong sheet / crash) · `bug` (data loss or wrong behavior)
· `polish` (cosmetic / minor UX).

> **2026-07-17 - TC-0011…TC-0017 ALL FIXED (+ TC-0018 found & fixed)** - the whole
> T1a-session-1 backlog (see DDL-0029: choice kinds the engine didn't recognize -
> spell/spellSet/resist/save/mixed - plus fixed subclass grants, curated HP-max
> bonuses, guided-kit auto-equip and the featureoption collapse). Sweep still
> 256/256 `--strict`; there are **no open TC issues**.

> **2026-07-16 - TC-0001…TC-0010 ALL FIXED** in one batch (see DDL-0028 for the
> architecture: Foundry-native encodings where a native slot exists + a
> namespaced `flags.builder5e.choices` on the owning Item where none does).
> The full sweep now runs **256/256 with ZERO round-trip diffs in `--strict`
> mode**, `KNOWN_ISSUES` and `WAIVERS` are both **empty**, and the oracle also
> validates base-score reconstruction (`scores` added to the decision summary).

---

## TC-0001 - Custom-origin tool & language don't round-trip

- **Found:** 2026-07-15, first full sweep. **Severity:** bug. **Status:** fixed@2026-07-16.
- The background Trait EXPORTED tools/languages, but the key codes were lossy
  ("Common Sign Language" → `common` → reversed to "Common"; "Hand Drum" →
  `hand` → reversed to "Hand Crossbow").
- **Fix:** `toolId`/`languageCode` fall back to a FULL reversible slug
  (`hand-drum`) for names outside the canonical Foundry tables; the canonical
  multi-word names the old truncation hit by luck ("Dice Set", "Chess Set",
  "Playing Card Set", "Pan Flute") were added to `TOOL_TO_FVTT` explicitly.

## TC-0002 - Chosen feats' sub-choices don't round-trip

- **Found:** 2026-07-15 sweep (628 diffs strict). **Severity:** bug. **Status:** fixed@2026-07-16.
- **Fix:** every chosen feat Item now carries its sub-bag in
  `flags.builder5e.choices` (origin feat, class ASI/style slots, species feats);
  the import restores it and counts chosen ability boosts into the base-score
  reconstruction. Foundry ignores the flag.

## TC-0003 - Weapon-mastery pick format drift (`'Club'` vs `'Club|PHB'`)

- **Found:** 2026-07-15 sweep. **Severity:** polish. **Status:** fixed@2026-07-16.
- **Fix:** `weaponKeyToPick` returns the plain name - the UI's canonical format
  (chips and selector dedup now behave after an import).

## TC-0004 - Optional features not exported/reconstructed

- **Found:** 2026-07-15 sweep. **Severity:** bug. **Status:** fixed@2026-07-16.
- Worse than triaged: invocations/metamagic/maneuvers/arcane shots/runes/pact
  boons didn't even EXPORT as Items (invisible in Foundry).
- **Fix:** `buildOptionalFeatureItems` emits a feat Item per pick (with the
  dnd5e subtype: eldritchInvocation, metamagic, maneuver…); the picks travel in
  the class item's residual flag; flag-less actors (premades) get a native
  fallback that matches actor feats against each descriptor's featureType list.

## TC-0005 - Class proficiency choices beyond starting skills not imported

- **Found:** 2026-07-15 sweep. **Severity:** bug. **Status:** fixed@2026-07-16.
- **Fix:** `tool@start-*`, `expertise@*`, curated prose grants and subclass
  `sub:` grants travel in the class item's `flags.builder5e.choices`
  (`residualClassChoices`); the import merges them back verbatim.

## TC-0006 - Champion's extra Fighting Styles import into wrong keys

- **Found:** 2026-07-15 sweep. **Severity:** bug. **Status:** fixed@2026-07-16.
- **Fix:** only the class's OWN `feat@<level>` slots feed the class item's
  ItemChoice/ASI advancement; subclass-granted styles (`sub:feat@…`) and
  optionalfeatureProgression styles (`feat@fs@…`) export as loose items + the
  residual flag, so the import never invents `feat@7`/`feat@10` entries.

## TC-0007 - `featureoption` picks don't export as "<Feature>: <Option>" Items

- **Found:** 2026-07-15 sweep (54 diffs - the largest native cluster). **Severity:** bug. **Status:** fixed@2026-07-16.
- **Fix:** `buildFeatureOptionItems` emits a feat Item named
  `"Divine Order: Thaumaturge"` (etc.) per pick - the premades' encoding - with
  the option's own text as description; the EXISTING import
  (`featureOptionChoiceBag`) reconstructs the picks unchanged, by name or
  identifier slug.

## TC-0008 - Parenthesized race names misresolved on import

- **Found:** 2026-07-15 sweep (15 species rows). **Severity:** bug. **Status:** fixed@2026-07-16.
- **Fix:** `parseSpecies` first tries an EXACT compendium match against base
  race names AND every `_versions` name ("Human (Ixalan)", "Dragonborn (Gem;
  Amethyst)", "Variant; Gifted Aetherborn"); the separator heuristic only runs
  when nothing matches exactly (still needed for premade "Elf, High" forms).

## TC-0009 - Species `spellAbility` pick lost on round-trip

- **Found:** 2026-07-15 sweep (25+ species rows). **Severity:** bug. **Status:** fixed@2026-07-16.
- **Fix:** the race item carries `spellAbility-N` (and `size-N`, and mixed
  pools) in `flags.builder5e.choices`; the import restores them. This also
  retired the old `species-size-pick` WAIVER (DDL-0017's accepted loss).

## TC-0010 - Species proficiency back-fill steals feat sub-bag picks

- **Found:** 2026-07-15 sweep. **Severity:** bug. **Status:** fixed@2026-07-16.
- **Fix (both sides):** the species item's Trait/ASI advancements now use
  SHALLOW picks only (a feat's sub-choices belong to the feat's item/flag), and
  the import only back-fills a species skill/tool/language entry when
  `parseChoices(raceObj)` actually offers that choice (ability is deliberately
  NOT gated - a race-item ASI belongs to the race by construction, and legacy
  actors need it for score reconstruction).

## TC-0011 - `additionalSpells` `{choose}` picks have NO selector anywhere

- **Found:** 2026-07-16, T1a Artificer session (via Magic Initiate on the origin-feat
  step). **Severity:** bug (structural). **Status:** fixed@2026-07-17 (DDL-0029).
- `grantedSpells` only COUNTED `{choose}` leaves (`pendingChoices`, deliberately
  deferred in B2.4) and nothing consumed the counter: no UI, no completeness check.
  Magic Initiate reached "complete" with just its Spellcasting Ability - its 2
  cantrips + level-1 spell (and the Cleric/Druid/Wizard list pick) were unchoosable.
- **Fix (the suggested shape, in full):** `grantedSpells` now EMITS Choice
  descriptors - a `spellSet` select when the `additionalSpells` array has multiple
  entries (they are ALTERNATIVES; before, all groups merged - itself a bug) and a
  `spell` choice per `{choose}` leaf (filter expression or closed `{from}` list) -
  and CONSUMES the picks from the owning entity's bag with the leaf's own cast
  mode/frequency. `parseChoices(entity, {level, bag})` surfaces them for races and
  feats; `buildClassChoices` for class/subclass `additionalSpells` (ids prefixed
  `class:`/`sub:`). UI: `SpellChoice` (chips + spell selector restricted by
  `spellChoosePredicate`) and the `spellSet` select in ChoiceList; picking a new
  list discards the sibling spell picks. Deep completeness, autoBuild, the fixup
  guide and the Foundry export flags all consume the same descriptors. Verified
  live: Magic Initiate grants its spells and a Spellbook origin tab with honest
  frequencies (cantrips known, level-1 spell innate 1/day).

## TC-0018 - Curated HP-max increases (Tough…) never derived

- **Found:** 2026-07-17, live verification of this batch (Tough on the test Human
  didn't raise HP). **Severity:** bug. **Status:** fixed@2026-07-17 (DDL-0029).
- Feats/traits whose only mechanics are a prose "Hit Point maximum increases…"
  were inert on the sheet AND in the export. Full dataset scan (tag-aware):
  Tough PHB/XPHB (+2/char level), Boon of Fortitude XPHB (+40), Dwarven
  Toughness (Dwarf XPHB, Dwarf (Kaladesh) PSK; the Hill PHB / Stensia PSI
  variants live in `subrace`, which the app doesn't offer), Draconic Resilience
  (Sorcerer Draconic PHB/XPHB, +1/sorcerer level - both versions equal class
  level). **Fix:** curated registry `engine/hpBonuses.js` → `deriveHpBonus`
  feeds `maxHp` (via `ctx.extraMaxHp`); export writes per-character-level rates
  into the native `hp.bonuses.level` and the rest (flat + per-class-level) into
  `hp.bonuses.overall`; the import subtracts the re-derivable part so `hpBonus`
  round-trips as the player's manual adjustment only.

## TC-0012 - Fixed subclass proficiency grants don't derive

- **Found:** 2026-07-16, T1a Artificer session. **Severity:** bug. **Status:** fixed@2026-07-17 (DDL-0029).
- Armorer "Tools of the Trade" (Heavy armor + Smith's Tools) and Battle Smith
  "Battle Ready" (Martial weapons) never reached the Proficiencies card (or the
  Foundry Traits) - the DDL-0002 deferred class ("FIXED subclass grants").
- **Fix:** curated registry `engine/subclassGrants.js` (`SUBCLASS_GRANTS`, full
  sweep of every class-*.json: armor/weapons/skills/expertise/tools/languages/
  saves per subclass, source-disambiguated), derived by `deriveSubclassGrants`
  into `deriveFromDb`/`ownedFromDb` (dedup) and the export Traits. Fixed
  EXPERTISE grants (Rogue Scout, PDK) mark skill level 2. The "if you already
  have it…" conditionals became LIVE choices (`subclassConditionalChoices` →
  `sub:cond-*` ids: replacement artisan tool, alternate save via new `save`
  kind, alternate skill), and the choice side of the same sweep also completed
  `SUBCLASS_FEATURE_GRANTS` (Blessings of Knowledge, Cavalier/Samurai mixed
  skill-or-language, Kensei tool list, Mastermind, Bladesinger FRHoF…). The
  DDL-0002 deferred list closed along the way: Monk's "artisan OR instrument"
  is ONE selector with merged categories; the expertise pool now includes
  auto-granted skills; Gloom Stalker/Samurai save conditionals work. Verified
  live (Armorer at 3: Heavy Armor + Smith's Tools on the card + the replacement
  tool choice in the fixup guide). Out of scope, documented in the module:
  per-weapon proficiency (Kensei weapons), featureoption-internal grants
  (Totem SCAG Tiger), sidekicks/UA.

## TC-0013 - Picked feat with unfilled sub-choices escapes the pendency system

- **Found:** 2026-07-16, T1a Artificer session. **Severity:** bug. **Status:** fixed@2026-07-16.
- `fixupSteps.js` `filled = picks.length >= count` is SHALLOW: picking the ASI feat
  (or an Epic Boon with an ability/damage-type sub-choice) satisfies the features
  step immediately - the level-up overlay advances, the slot leaves the fixup guide,
  and the badge drops to zero while "+2 to one / +1 to two" sits unfilled on the
  Class tab. Contradicts DDL-0022 ("the button tracks EVERY required field"); the
  CREATION guide's deep check (`choicesComplete`) already recurses into feat
  sub-bags - the fixup/pendency side needs the same recursion.
- **Fix:** `choiceComplete` (per-choice deep check) extracted from
  `choicesComplete` in `createGuideContext.js` and used by BOTH shallow spots:
  `unfilledClassChoices` (fixupSteps.js - badge, step existence, live status)
  and `FeaturesStep`'s `unfilledOnly` filter (so a half-filled ASI/boon renders
  its chip + embedded sub-choices inside the overlay). 7 regression tests in
  `fixupSteps.test.js`; verified live on the T1a Artificer 19 (ASI@4 and Epic
  Boon@19 reappeared in the fixup guide, filling +2 Int removed the entry live
  and derived Int 17→19).

## TC-0014 - Structured `resist` choices not parsed (Boon of Energy Resistance)

- **Found:** 2026-07-16, T1a Artificer session (Epic Boon at level 19). **Severity:**
  bug. **Status:** fixed@2026-07-17 (DDL-0029).
- **Fix:** `parseChoices` reads `resist`/`immune`/`vulnerable` `{choose}` entries
  (all three share the shape; only `resist` has chooses in the current dataset) →
  list Choices rendered as toggle PILLS (`PillsChoice` in ChoiceList, also used by
  the `save` kind). Derivation: new `engine/damageTraits.js` collects fixed string
  grants (race incl. lineage, feats), chosen picks (all bags) and equipped/attuned
  item traits (`fromItems`, deduped) → Proficiencies card sections + actor
  `traits.dr/di/dv` (character-own only; items carry their own Active Effect,
  which `itemBonusEffect` now emits for structured item resist/immune/vulnerable).
  Prose-conditional object entries stay in the trait text - never invented.
  Verified live (Boon of Energy Resistance at 19: 9 pills, 2 picks → "Damage
  Resistances: Fire, Cold" on the card).

## TC-0015 - Guided create leaves the starting kit unequipped (AC reads unarmored)

- **Found:** 2026-07-16, T1a Artificer session. **Severity:** polish
  (`needs-user-eyes`). **Status:** fixed@2026-07-17.
- **Fix (product call: yes, armor AND weapons):** `startingKitInventory(option, db)`
  marks kit items whose resolved group is `armor` or `weapon` as `equipped`; the
  guided EquipmentStep passes the db. Verified live: guided Artificer finishes
  with Studded Leather + Dagger equipped, AC 13 on the sheet.

## TC-0016 - Guide pickers showed raw lowercase ids ("artificer", "human")

- **Found:** 2026-07-16, T1a Artificer session. **Severity:** polish.
  **Status:** fixed@2026-07-16 (this session).
- ClassStep/SpeciesStep passed `cls.classId`/`species.id` as the PickerField label;
  now they use the resolved object's real name (fallback: capitalized id).

## TC-0017 - Featureoption chip renders ALL options' full text under the chosen chip

- **Found:** 2026-07-16, T1a Artificer session (Armorer's Armor Model). **Severity:**
  polish (`needs-user-eyes`). **Status:** fixed@2026-07-17.
- **Fix:** with the choice COMPLETE, `FeatureOptionChoice` collapses unchosen
  option cards to name-only buttons (still tappable - with count 1 a tap swaps the
  selection and reopens its text); the chosen option keeps its full description.
  Reaches the Class tab and the wizard FeaturesStep. Verified live (Armor Model =
  Dreadnaught full text, Guardian/Infiltrator collapsed).

---

> **2026-07-17 (T1a session 2 - Barbarian)**: TC-0019/0020/0021 found & fixed in-session
> (TC-0021 fixed for Barbarian; its Rogue variant stays inside the entry). **TC-0022 fixed
> post-session (DDL-0034): the ability-score cap is now enforced (data-driven), and species
> natural armor (Tortle/Autognome/Warforged) derives. There are no open TC issues.**

## TC-0019 - Storm Herald's Storm Aura environment choice had no selector

- **Found:** 2026-07-17, T1a Barbarian session (pre-session dataset scan). **Severity:**
  bug. **Status:** fixed@2026-07-17.
- Storm Aura (L3) encodes Desert/Sea/Tundra as an `options`+`refSubclassFeature` block -
  the shape DDL-0002 confirmed as "grant all, no selector" for Genie/Psi Warrior/Soulknife -
  but its prose is a real choice ("Choose desert, sea, or tundra", re-choosable per level),
  and Storm Soul (L6) grants fire/lightning/cold resistance based on it. No selector
  anywhere; the sweep never saw a pendency.
- **Fix:** `'storm aura': true` in `CHOOSE_ONE_FEATURES` (`engine/featureOptions.js`) -
  `findChooseGroup` extracts the three refSubclassFeature options by itself. Storm Soul@6
  and Raging Storm@14 deliberately stay selector-less (they follow the L3 choice). The pick
  rides the standard featureoption machinery: TC-0017 collapse, fixup guide, autoBuild,
  DDL-0028 export flags. Verified live (Desert/Sea/Tundra cards @3, Sea picked, badge
  clears) + unit test; sweep 274/274 `--strict`.

## TC-0020 - ✦ badge counted guide steps, not decisions

- **Found:** 2026-07-17, T1a Barbarian session (L19 with 7 open choices showed "1 choice
  left"). **Severity:** bug (misleading UX). **Status:** fixed@2026-07-17.
- `fixupPendencyCount` summed `buildFixupSteps().length` - at most 3 per class (subclass /
  features / spells) - while the badge's own docstring and DDL-0022 promise decisions. All
  feature choices share ONE step, so any number of them read as "1".
- **Fix:** count `unfilledClassChoices()` (+1 missing subclass, +1 spells-to-fill) per
  class. Regression test in `fixupSteps.test.js` (two open ASI slots = 2; +1 when the
  subclass is missing). Verified live: badge 7 → decremented per pick → 0.

## TC-0021 - Weapon Mastery pool ignored per-class restrictions (Barbarian melee-only)

- **Found:** 2026-07-17, T1a Barbarian session (a Barbarian mastered a Blowgun).
  **Severity:** bug. **Status:** fixed@2026-07-17 for Barbarian; Rogue variant deferred.
- XPHB Weapon Mastery texts restrict the eligible kinds per class: Barbarian "Simple or
  Martial MELEE weapons"; Rogue "Simple weapons and Martial weapons that have the Finesse
  or Light property"; Fighter/Paladin/Ranger unrestricted. The `weaponMastery` choice
  always offered every simple/martial weapon.
- **Fix:** curated `MASTERY_FILTERS` map in `engine/classFeatureChoices.js` attaches a
  `weaponFilter` (the DDL-0030 Kensei machinery) to the mastery pool; enforced in
  ChoiceList (kind `weapon` now, not just `weaponProf`) and autoBuild. Barbarian =
  `{kind:'melee'}` (25 options live, 0 ranged). **Rogue needs a conditional semantics**
  (simple: any; martial: only Finesse/Light) that `weaponFilterAllows` doesn't have -
  add it in the Rogue T1a session and extend the map.

## TC-0022 - Feat ability increases don't enforce the ability score cap (20)

- **Found:** 2026-07-17, T1a Barbarian session. **Severity:** bug (rules accuracy).
  **Status:** fixed@2026-07-17 (DDL-0034).
- Great Weapon Master (+1 Str) and Sentinel (+1 Str picked) raised Str 19 → 21 before the
  Epic Boon (→22). RAW: regular feats cap the score at 20 (their texts say "to a maximum
  of 20"); Epic Boons cap at 30. Nothing in the engine/UI enforced it.
- **Product call: hard-cap per RAW** (the user can still adjust base scores manually). The
  cap is DATA-DRIVEN (`ability[].max`: 30 on Epic Boons, absent = 20). **Fix:** `finalScores`
  applies boosts sequentially, lowest cap first, never past a boost's cap nor lowering a base
  already above it; `resolve.withAbilityCaps` back-fills the cap onto chosen picks from feat
  data at derive time (works for characters saved without a stored `max` - no re-pick). The
  export's capped final scores round-trip via a new lossless `flags.builder5e.scores` on the
  actor (subtraction stayed as the flag-less fallback). Verified live: the T1a Barbarian's
  Boon of Irresistible Offense now lifts Str past the regular-feat cap. See CHANGELOG §38.

---

> **2026-07-18 (T1a session 3 - Bard)**: session started with a migration repair (DDL-0037
> fallout: loadDb sibling path, vitest/eslint descending into the in-repo snapshot) and
> TC-0023 found on the guided create's origin-feat step, fixed in-session.

## TC-0023 - Countable proficiency tokens ({anyMusicalInstrument: 3}) never became choices

- **Found:** 2026-07-18, T1a Bard session (guided create: Musician origin feat offered no
  instrument picker and the step read complete). **Severity:** bug (structural).
  **Status:** fixed@2026-07-18.
- `parseProfField` only understood `{choose}` and `{any: N}`; token-keyed counts fell into
  the "fixed grant" bucket and were DISCARDED - no selector, no deep-completeness gate, no
  derivation. Reachable: feats Musician XPHB + Harper Agent FRHoF (both ORIGIN feats,
  `anyMusicalInstrument: 3`), Artificer Initiate TCE + Quicksmithing PSK
  (`anyArtisansTool: 1`); species Satyr MPMM (instrument), Dwarf (Kaladesh) PSK (2 artisan's
  tools), and every `{anyStandard: N}` language race (Custom Lineage TCE, Aetherborn PSK,
  Human (Ixalan) PSX, Human (Innistrad) PSI + lineages, Merfolk Ixalan subrace merges...).
  The sweep could never catch it: an unparsed choice produces no pendency.
- **Fix:** `PROF_COUNT_TOKENS` in `engine/choices.js` - token entries emit a Choice with the
  same category-restricted pool the class tool choices use (`{type:'any', of, category}`,
  AT/INS/GS), so ChoiceList, autoBuild, deep completeness and the DDL-0028 export flags all
  work with zero extra wiring. Along the way the multi-entry semantics were corrected:
  entries in one proficiency field are ALTERNATIVES (5etools joins them with "or" in
  `_summariseProfs`), so only the first entry that yields a choice emits one - Human
  (Ixalan)'s double `{anyStandard:1}` is ONE language, not two (the sweep's 3 new round-trip
  diffs confirmed and then cleared). 4 unit tests; sweep 274/274 `--strict`.

## TC-0024 - Kit entries `{equipmentType}` silently dropped (Bard's instrument)

- **Found:** 2026-07-18, T1a Bard session (guided create: Option A listed no instrument).
  **Severity:** bug. **Status:** fixed@2026-07-18.
- `parseStartingEquipment` only understood `item`/`value`/`special`; the Bard XPHB kit's
  `{equipmentType: "instrumentMusical"}` ("Musical Instrument of your choice") vanished
  from the kit card and the inventory. Only reachable case today (current class versions);
  legacy PHB kits use the shape heavily, so the mapping covers all 8 known types.
- **Fix:** kit options now carry `chooses[]`; the card lists them, the guided
  EquipmentStep renders a per-choose item picker (SelectorPanel over the item entity,
  category-matched via `kitChooseAllows` - INS/weapon category/SCF subtype), picks live in
  `meta.startingKitPicks` and join the inventory (`startingKitInventory` 3rd arg, weapons/
  armor auto-equip). Deep completeness: `kitStepComplete` (createGuideContext) gates the
  equipment step via the ctx flag pattern. 5 new engine tests; verified live (Lute).

## TC-0025 - Sibling spell chooses accept the SAME spell twice (Magical Discoveries)

- **Found:** 2026-07-18, T1a Bard session (Lore @6: both "Cleric/Druid/Wizard" chooses
  took Air Bubble; the Spellbook dedup then collapses them into ONE row - a grant lost).
  **Severity:** bug. **Status:** fixed@2026-07-18.
- Each `SpellChoice` excluded only its OWN picks; the sibling `spell`-kind entries in the
  same bag were fair game. RAW: "you learn two spells" - distinct.
- **Fix:** ChoiceList computes `siblingSpellPicks` (all other `spell` entries in the bag)
  per spell choose and SpellChoice excludes them in the selector AND the add guard.
  Verified live (Air Bubble absent from the second picker). autoBuild keeps per-choice
  dedup only (random collisions are astronomically rare and round-trip-consistent) -
  accepted.

## TC-0026 - Prose-granted spell missing from `additionalSpells` (Spirits' Guidance)

- **Found:** 2026-07-18, T1a Bard session (College of Spirits RHW: Channeler says "You
  know the Guidance cantrip" but the Spellbook showed nothing at L3). **Severity:** bug
  (upstream data gap). **Status:** fixed@2026-07-18.
- The RHW entry only encodes Spirit Guardians @6 (`prepared.6.daily.1e`); the legacy VRGR
  version had `known: {3: [guidance#c]}` and the reprint dropped it. Nothing our sweep
  could catch - no structural signal.
- **Fix:** curated `MISSING_ADDITIONAL_SPELLS` registry (`engine/grantedSpellUses.js`,
  beside the DDL-0011 frequency overlay): entries the prose grants but the data omits,
  MERGED into the first `additionalSpells` group (never appended - a new group would read
  as an alternative and spawn a false `spellSet` choice, TC-0011 semantics).
  `resolveGranted` applies it for class/subclass/race/feat alike. 3 unit tests; verified
  live (Guidance Always Prepared in the Bard origin @19).

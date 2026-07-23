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
  **Severity:** bug. **Status:** fixed@2026-07-21 (Barbarian half fixed@2026-07-17; Rogue
  half fixed@2026-07-21, T1a Rogue session - DDL-0050). **Ledger now has no open items.**
- XPHB Weapon Mastery texts restrict the eligible kinds per class: Barbarian "Simple or
  Martial MELEE weapons"; Rogue "Simple weapons and Martial weapons that have the Finesse
  or Light property"; Fighter/Paladin/Ranger unrestricted. The `weaponMastery` choice
  always offered every simple/martial weapon.
- **Fix (Barbarian):** curated `MASTERY_FILTERS` map in `engine/classFeatureChoices.js`
  attaches a `weaponFilter` (the DDL-0030 Kensei machinery) to the mastery pool; enforced in
  ChoiceList (kind `weapon` now, not just `weaponProf`) and autoBuild. Barbarian =
  `{kind:'melee'}` (25 options live, 0 ranged).
- **Fix (Rogue, 2026-07-21):** `weaponFilterAllows` gained the conditional field
  `martialRequiresAnyProp` (simple weapons unrestricted; martial weapons require one of the
  listed property codes) - the semantics the flat filter lacked. `MASTERY_FILTERS.rogue =
  { martialRequiresAnyProp: ['F', 'L'] }`. Flows through the same two consumers (ChoiceList
  kind `weapon` + autoBuild) with no other wiring. Verified live: 21 options (all simple +
  martial Rapier/Scimitar/Shortsword/Hand Crossbow/Whip); Longsword = 0 results. 1 unit test
  in `choices.test.js`; sweep 274/274 `--strict`.

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

> **2026-07-19 (T1a session 4 - Cleric)**: the biggest finding of the campaign so far -
> every legacy subclass adopted onto a 2024 class is a `_copy` stub the resolver never
> expanded, so 13 of the Cleric's 19 domains had ZERO domain spells. Found while checking
> why Nature's druid-cantrip choose was absent.

## TC-0027 - Legacy subclass `_copy` stubs unresolved: additionalSpells (domain spells) lost

- **Found:** 2026-07-19, T1a Cleric session (Nature PHB @3: no druid-cantrip choose, and
  `alwaysPrepared` EMPTY - no domain spells at all). **Severity:** bug (structural, wide).
  **Status:** fixed@2026-07-19.
- 5etools attaches every legacy subclass to the 2024 class via a `_copy` STUB carrying only
  the re-pointed `subclassFeatures` (levels moved to the XPHB slots); everything else -
  `additionalSpells` above all - is inherited from the original entry. `resolveSubclassObj`
  read the raw list and its `findLast(has subclassFeatures)` preferred the stub whenever the
  stub carried features (ALL 19 cleric stubs do), returning it UNRESOLVED: the domain spells
  and their `{choose}` leaves (Nature/Strength druid cantrip, Arcana's 2 wizard cantrips +
  Arcane Mastery 6th-9th picks, Death's necromancy cantrip) simply vanished. Bard/Barbarian
  escaped by luck: their stubs carry no own features (same levels), so the ORIGINAL entry
  won the findLast. 73 stubs across all classes were affected in principle; every class
  whose subclass level differs from the legacy one (cleric 1-3) hits the bad path.
  The sweep can never catch it: a grant that never derives produces no pendency and no
  round-trip diff.
- **Fix:** `resolveSubclassObj` now resolves `_copy` (memoized per db+class via WeakMap,
  same `resolveCopies` + shortName|source|classSource id the selector already used). The
  stub keeps its own re-pointed features; everything else inherits. 1 regression test;
  verified live on all 13 legacy cleric domains (10-15 Always Prepared spells each).

## TC-0028 - Divine Order: Thaumaturge's extra cantrip never raised the cantrip limit

- **Found:** 2026-07-19, T1a Cleric session (guided create: cantrips step read 0/3 with
  Thaumaturge chosen; DDL-0013 had cited exactly this case as the reason features precede
  spells, but the bump was never implemented). **Severity:** bug. **Status:**
  fixed@2026-07-19.
- `cantripLimit` read only the class's `cantripProgression`; "you know one extra cantrip
  from the X spell list" featureoptions (Cleric Thaumaturge, Druid Magician - Primal Order)
  were inert. Grants of cantrips from OTHER lists (Acolyte of Nature, Arcane Initiate) are
  a different mechanism (`additionalSpells` chooses, TC-0027) and were excluded on purpose.
- **Fix:** curated `CANTRIP_BONUS_FEATURES` + `cantripLimitBonus(classEntry)` in
  `engine/featureEffects.js`; `resolve.js` adds the bonus to the class origin's
  `cantripLimit` (only when the base is > 0). Reaches the guide step, fixup overlay,
  Spellbook and ✦ badge through the single derived field. 3 unit tests; verified live
  (4/4 @1, 6/6 @19 on the Thaumaturge cleric).

## TC-0029 - ASI / Epic Boon feat pickers exclude categories RAW allows

- **Found:** 2026-07-19, T1a Cleric session (Tough absent from the level-12 feat picker).
  **Severity:** product decision. **Status:** fixed@2026-07-19 (user decision same day).
- The ASI slot's pool was `category: ['G']` and the Epic Boon slot's `['EB']`
  (engine/classFeatureChoices.js). XPHB RAW: both features say "or another feat of your
  choice for which you qualify" - ORIGIN feats (Tough, Lucky, Alert, Skilled... - Tough is
  Origin in 2024) have no prerequisite, so they qualify at any ASI slot, and General/Origin
  feats qualify at the Epic Boon slot (D&D Beyond allows both).
- **User decision + fix:** same pattern as the spell pickers (DDL-0026) - the list WIDENS
  (`pool.extraCategories`: ASI lists G+O+EB, boon lists EB+G+O) but a **Category filter
  comes pre-marked on the slot's default** (General / Epic Boon), removable by the player
  (DM permission cases). Origin/Epic Boon cards carry a category badge when the filter is
  active. Prerequisite warnings are UNCHANGED and still confirm on Not Met/Unverifiable
  (an Epic Boon at an ASI slot below 19 warns via its own Level 19+ prereq). The
  autoBuild/sweep keeps picking from `pool.category` (the default), so seeded builds are
  unchanged. Verified live: "tough" 0 results with General marked; marking Origin shows
  Tough with an Origin badge; the boon picker opens EB-only and marking General reveals
  the G feats.

## TC-0030 - Blessings of Knowledge: PSA granted nothing; chosen skills lacked expertise

- **Found:** 2026-07-19, T1a Cleric session (Knowledge (PSA) @19: no language/skill
  chooses at all; FRHoF's two chosen skills derived plain proficiency, no expertise).
  **Severity:** bug. **Status:** fixed@2026-07-19.
- Two gaps: (1) `SUBCLASS_FEATURE_GRANTS` is keyed `shortName|featureName`, but the PSA
  domains inline their level-1 text in an umbrella feature named after the subclass
  ("Knowledge Domain (PSA)") - the 'knowledge (psa)|blessings of knowledge' key could never
  match. (2) Both Blessings versions (PHB/PSA "proficiency bonus is doubled", FRHoF "you
  have Expertise") grant expertise ON the chosen skills, which no grant kind expressed.
- **Fix:** umbrella-feature key ('knowledge (psa)|knowledge domain (psa)') + dedup by KEY
  (not name@level - the umbrella exists in BOTH class attachments, PHB@1 and XPHB@3, and
  would have emitted twice); new `expertise: true` flag on skill grants → the choice is
  emitted as kind 'expertise' with `newProf` (pool = the grant's fixed list, NOT
  intersected with proficient skills), so picks derive at level 2 through the existing
  `collectSkillProficiencies` path and ride the DDL-0028 export flags unchanged. Applied to
  PSA + both 'knowledge|blessings of knowledge' entries (FRHoF + PHB fallback). Verified
  live: PSA Arcana/History +12 and FRHoF Nature/Religion +12 under EXPERTISE @19.

## TC-0031 - Spell pickers offer spells already always-prepared from another origin

- **Found:** 2026-07-19, T1a Cleric session (guided cantrips step offered Guidance/Sacred
  Flame, both always-prepared via Magic Initiate; picking Guidance consumed 1 of the 3
  class picks with no warning). **Severity:** polish. **Status:** fixed@2026-07-19 (user
  decision same day).
- The guide's SpellPicker and the Spellbook prepare flow deduped only same-origin owned
  spells; cross-origin grants (feat/race/other class) stayed selectable silently. RAW
  it's legal and sometimes DESIRED - a Warlock 1/Cleric 1 may prepare Toll the Dead in
  BOTH classes for the ability-score difference - so hard-hiding would be wrong.
- **User decision + fix:** `preparedElsewhere(origins, excludeKey)`
  (engine/spellcasting.js) maps every spell known in the OTHER origins to its source
  label; `makeSpellEntity` gains an "Already Prepared" filter + card badge for those, and
  both the Spellbook prepare flow and the guide's SpellPicker pre-mark it as EXCLUDE
  (removable, like the Class/Level filters). Adding one anyway joins the existing confirm
  dialog with the source: "You already have Guidance from Magic Initiate. Prepare it
  anyway?". Verified live on the Cleric 19 + Magic Initiate (hidden by default → badge
  after unmarking → confirm names the feat). 2 unit tests (preparedElsewhere).

## TC-0032 - Shepherd's Speech of the Woods never granted Sylvan

- **Found:** 2026-07-20, T1a Druid session (Shepherd @19: LANGUAGES card showed only
  Common + Elvish). **Severity:** bug. **Status:** fixed@2026-07-20.
- Speech of the Woods (XGE, level 2) grants Sylvan in PROSE ("You learn to speak, read,
  and write Sylvan") - exactly the TC-0012 class of gap: the curated `SUBCLASS_GRANTS`
  registry (engine/subclassGrants.js) had no `druid|shepherd` entry (the 2026-07-16
  dataset sweep missed this one; it looked for proficiency phrasing, this is a language).
- **Fix:** one registry line (`{ level: 2, feature: 'Speech of the Woods', languages:
  ['Sylvan'] }`; level 2 matches the XGE feature - on the XPHB chassis the subclass only
  exists from 3, so the `level <= cls.level` gate can never fire early). 1 unit test.
  Verified live (Common · Sylvan · Elvish on the card @19).

## TC-0033 - Kit items that reference an ITEM GROUP landed as "unresolved" junk

- **Found:** 2026-07-20, T1a Druid session (Inventory showed "Druidic Focus ·
  unresolved · 0 lb" under Other after the guided kit). **Severity:** bug.
  **Status:** fixed@2026-07-20.
- `druidic focus|xphb` in the Druid kit's `defaultData` is an **itemGroup** ("one of:
  Sprig of Mistletoe / Wooden Staff / Yew Wand"), not a concrete item; `resolveRef` fell
  through to the title-case fallback and the inventory got a dead item. Dataset scan:
  exactly 3 kits affected - Druid + Cleric + Paladin XPHB (`holy symbol|xphb`), so the
  Cleric session's rep build had the same silent junk item.
- **Fix:** `parseStartingEquipment` detects the group and emits a kit CHOOSE with a
  CLOSED pool (`{type:'itemGroup', label, allow:[member uids]}`), riding the whole
  TC-0024 machinery unchanged (EquipmentStep picker, `kitChoosesComplete` gating, deep
  completeness, `startingKitPicks`). `kitChooseAllows` honors the closed pool;
  `kitChooseLabel` uses the group name. 3 unit tests. Verified live: kit card lists
  "Druidic Focus of your choice", picker shows exactly the 3 members, pick lands in
  Inventory as a resolved Spellcasting Focus (4 lb).

## TC-0034 - Feat sub-choice spell pickers skip the DDL-0040 "Already Prepared" flow

- **Found:** 2026-07-20, T1a Druid session (Magic Initiate's level-1 spell picker
  accepted Speak with Animals - always prepared via Druidic - with no badge, no
  pre-marked exclude filter and no confirm). **Severity:** polish (consistency with
  DDL-0040; the pick is legal, just silently redundant). **Status:** fixed@2026-07-20.
- TC-0031's fix wired `preparedElsewhere` into the SpellbookTab prepare flow and the
  guide's SpellPicker, but the feat sub-bag spell chooses (TC-0011's SpellChoice in
  ChoiceList) built their selector without the character's derived origins, so the
  whole flow (filter + badge + confirm) was absent there.
- **Fix:** ChoiceList derives the map ITSELF at its single choke point, instead of
  plumbing `origins` through all seven call sites (the structural change the entry
  feared). It calls `preparedElsewhere(deriveFromDb(character, db).spellcasting.origins)`
  in a `useMemo` and passes the result down as `spellsOwned` - to `SpellChoice` (entity
  badge + pre-marked `owned: exclude` filter + confirm naming the source) and to the
  NESTED ChoiceList of a feat sub-bag, which therefore never re-derives. The memo only
  runs when a spell picker can actually be reached (a `spell` pool in this list, or a
  `feat` pool whose sub-bag may hold one), so the ordinary proficiency/feature lists pay
  nothing. **No origin is excluded** (unlike the other two call sites, which exclude the
  origin being edited): this choice's own picks and its siblings already leave the
  selector via `exclude`, and a FIXED grant of the same entity (High Elf's
  Prestidigitation beside its own cantrip choose) is exactly the redundancy worth
  warning about. Verified live on a Druid 1 + Magic Initiate (Druid): Speak with Animals
  (always prepared via Druidic) hidden by default → unmarking the filter shows it with
  the "Already Prepared" badge → selecting it confirms "You already have Speak with
  Animals from Druid. Add it anyway?"; Cancel leaves 0/1, Add anyway lands the pick.

---

## TC-0035 - Orphaned spell picks mislabeled "Mystic Arcanum" after a subclass swap removes casting

- **Found:** 2026-07-20, T1a Fighter session (Eldritch Knight 19 swapped to Arcane
  Archer: every leftover EK spell row showed a "Mystic Arcanum / 1/Long Rest" badge,
  and the Cantrips/Prepared counter cards vanished entirely - no over-limit signal at
  all, unlike the Druid session's red counters). **Severity:** bug (display).
  **Status:** fixed@2026-07-20.
- Two independent causes in `SpellbookTab.jsx`: (1) the row badge was computed as
  `raw.level > origin.maxPrepareLevel` with no check that the origin HAS arcanum
  circles - on a non-casting origin (maxPrepareLevel 0) every orphaned pick qualified;
  (2) the Cantrips/Prepared counter cards only rendered when the LIMIT was > 0, so a
  limit-0 origin with orphaned picks showed nothing.
- **Fix:** badge now requires `origin.arcanumLevels.includes(raw.level)` (the engine's
  own arcanum classification - resolve.js already returned [] for non-pact casters);
  counters also render when the COUNT is > 0 (red "3/0" / "12/0" over-limit, the
  DDL-0026 freedom signalled, never hidden). Note: when the swapped-to subclass grants
  nothing at all (Champion), the class origin doesn't exist and the orphans stay
  dormant/invisible until a casting subclass returns - intentional (DDL-0041 swap
  semantics), recorded here so future sessions don't re-report it.

## TC-0036 - Defense fighting style never reached the live sheet's AC

- **Found:** 2026-07-20, T1a Fighter session (Champion 19 picked Defense as the
  Additional Fighting Style: AC stayed 16 with Chain Mail; RAW is +1 while wearing
  armor - the Foundry export already carried the Active Effect via
  `foundryEffects.js`, only the LIVE derivation missed it). **Severity:** bug.
  **Status:** fixed@2026-07-20.
- **Fix:** new curated `AC_BONUS_FEATURES` registry + `acFeatureBonuses(character)` in
  `engine/featureEffects.js` (the module's header always reserved space for AC
  effects); `resolve.js` folds each bonus over `deriveArmorClass`'s result, honoring
  `requiresArmor` vs. the derived `hasArmor`. Covers every slot a fighting style can
  occupy (class feat@1, Champion's sub:feat, species/origin feats). 3 unit tests.
  Verified live: Champion + Defense + Chain Mail = AC 17; removing armor drops the
  bonus.

## TC-0037 - Create-guide intro promised "which spells to prepare" to a non-caster

- **Found:** 2026-07-20, T1a Fighter session (Fighter 1 with Magic Initiate: the
  "Your character is ready" screen said the Fighter lets you choose "Fighting Style,
  Weapon Mastery, and which spells to prepare" - but no spell step follows at level 1
  with no subclass). **Severity:** polish (copy). **Status:** fixed@2026-07-20.
- `FeaturesIntroStep.jsx` treated ANY spellcasting origin as "is a caster" - the
  Magic Initiate FEAT origin counted. Now it requires the origin of the class itself
  (`o.uid === cls.uid`) with a real cantrip/prepare limit.
- Riding along (cosmetic, same session): the Cavalier/Samurai curated `mixed` choose
  titled itself "Bonus Proficiency - mixed", leaking the internal kind name -
  `classFeatureChoices.js` now renders the alternatives ("Bonus Proficiency - Skill
  or Language"). 1 unit test.

---

> **2026-07-20 (2) (post-session)** - T1a Fighter session logged TC-0035/0036/0037, all
> fixed in-session. **The only open item in this ledger remains the Rogue half of
> TC-0021** (conditional weapon-filter semantics for its Weapon Mastery pool),
> deliberately scheduled for the Rogue T1a session. Everything else is `fixed@<date>`.

---

> **2026-07-21 (T1a session 8 - Paladin)**: TC-0038 found & fixed in-session. Half-caster
> spell steps, oath-spell grants (incl. legacy `_copy` DMG/SCAG/XGE/TCE/FRHoF), Channel
> Divinity, the DDL-0034 ability caps and the DDL-0033 unrestricted Weapon Mastery all
> verified. The only open item stays the Rogue half of TC-0021.

## TC-0038 - Guide SpellPicker offers the origin's OWN always-prepared spells (duplicate picks)

- **Found:** 2026-07-21, T1a Paladin session (fixup guide @19: the guide's "+ Choose a
  spell" picker listed Aid/Divine Smite/Protection from Evil and Good/Shield of Faith -
  all ALWAYS PREPARED via the Devotion oath / Paladin's Smite - and let them be added as
  chosen prepared spells; Aid got added twice, surfacing as two "Aid" rows in the Spellbook
  with a React "two children with the same key" console error, and a stray/orphan row after
  swapping the oath). **Severity:** bug (data integrity / redundant prepared slot).
  **Status:** fixed@2026-07-21.
- Root cause: `components/wizard/steps/SpellPicker.jsx` computed its `exclude` set as
  `ownedNames = picks.map(...)` - only the CHOSEN picks of this origin's level range, NOT
  the origin's `alwaysPrepared`. The SpellbookTab prepare flow builds `ownedNames` from
  `all` (prepared + arcanum + **alwaysPrepared**, `SpellbookTab.jsx` ~L96-100/333), so it
  correctly hides them - the two flows disagreed. The duplicate arose because a spell that
  is BOTH chosen and always-prepared collapses into the granted copy at derive time (B2.3),
  so `current`/`picks` never reflected the just-added Aid, leaving it addable again.
  `preparedElsewhere` doesn't cover it (it excludes the CURRENT origin's key by design -
  that's the cross-origin case, DDL-0040/TC-0031).
- **Fix:** `ownedNames` now also includes `origin.alwaysPrepared` names (mirroring the
  SpellbookTab), so same-origin always-prepared spells are excluded from the guide picker.
  All three callers (SpellsStep / CantripsStep / LevelUpSpellsStep) pass `origin` from
  `derived.spellcasting.origins`, which carries `alwaysPrepared` - self-contained, no
  caller change. Verified live (Oathbreaker @19: searching "Hellish Rebuke" now returns
  0 results in the guide picker; normal spells still list; no key-collision errors on a
  clean build). 950 tests, lint, sweep 274/274 `--strict`.

---

> **2026-07-21 (3) (T1a session 9 - Ranger)**: NO findings - zero code changes (like the Monk
> session). Half-caster spell steps, TC-0038 exclusion of always-prepared spells (Hunter's Mark/
> Disguise Self same-origin hard-excluded; Longstrider cross-origin via the DDL-0040 filter), the
> Gloom Stalker Iron Mind Wis-save grant (flat, engine-verified L7 str/dex/wis), all 10 subclasses'
> granted spells (incl. legacy `_copy` via TC-0027), Fey Wanderer's @3 skill choose, Hunter's 3
> featureoptions, and Beast Master's Primal Companion (prose-by-design, no missing selector) all
> verified. The only open item stays the Rogue half of TC-0021 (conditional weapon-filter
> semantics for its Weapon Mastery pool), scheduled for the next session.

> **2026-07-21 (4) (T1a session 10 - Rogue)**: TC-0021 CLOSED (its Rogue half - see the entry
> above, fixed@2026-07-21 / DDL-0050). Arcane Trickster (third-caster INT, spell steps + Wizard-
> filtered picker), Mastermind (curated Master of Intrigue tool/language grants), all 10 subclasses
> listed, weapon-mastery count-stays-2, and the full @19 feat/expertise/epic-boon slots verified.
> **THE LEDGER NOW HAS NO OPEN ITEMS** - every `TC-` is `fixed@<date>` or `wontfix`. NOTE: this is
> NOT the same as T1a being complete - the Rogue rows are `ui: ok`, but by alphabetical order
> **Sorcerer, Warlock and Wizard (32 rows) are still `todo`**. Next session: T1a Sorcerer.

---

## TC-0039 - Storm Sorcery não concede o idioma Primordial (Wind Speaker)

- **Unidade:** `class:sorcerer/Storm` (XGE sobre o chassi XPHB). **Severidade:** bug (derivação
  incompleta). **Encontrado:** T1a sessão 11 (Sorcerer), 2026-07-22. **Status:** fixed@2026-07-22.
- Sintoma: um Sorcerer 19 / Storm Sorcery mostrava LANGUAGES = Common, Aarakocra no card de
  Proficiências - sem **Primordial**, que a feature Wind Speaker concede em PROSA ("You can speak,
  read, and write Primordial. Knowing this language allows you to understand… Aquan, Auran, Ignan,
  Terran").
- Raiz: idêntica ao TC-0032 (Speech of the Woods → Sylvan, Shepherd). O grant só existe no texto;
  não há campo estruturado, e `SUBCLASS_GRANTS` (`engine/subclassGrants.js`) não tinha nenhuma
  entrada para sorcerer. A varredura curada de 2026-07-16 procurou fraseado de PROFICIÊNCIA e
  continua não pegando concessões de IDIOMA.
- Fix: `'sorcerer|storm': [{ level: 3, feature: 'Wind Speaker', languages: ['Primordial'] }]`.
  Nível 3 porque o `_copy` XPHB reaponta a umbrella "Storm Sorcery" para o nível 3 e a subclasse não
  é escolhível antes disso. Varredura de `{@language}` em TODAS as subclasses de sorcerer das fontes
  atuais confirmou que Storm é o ÚNICO caso alcançável (o Draconic Bloodline PHB, que concede
  Draconic, é reprint-oculto pelo Draconic Sorcery XPHB, que não concede idioma).
- Verificado ao vivo (LANGUAGES = Common, Primordial, Aarakocra) + 2 testes em
  `subclassGrants.test.js` (nível 3 concede, nível 2 não).

## TC-0040 - `text-transform: capitalize` do PickerField quebra nomes próprios

- **Unidade:** transversal (todo `PickerField`). **Severidade:** polish (cosmético).
  **Encontrado:** T1a sessão 11 (Sorcerer), 2026-07-22. **Status:** fixed@2026-07-22.
- Sintoma: o chip do slot de Epic Boon mostrava "Boon **Of** Fortitude". O DOM continha o nome
  correto ("Boon of Fortitude"); quem alterava era a regra `.name { text-transform: capitalize }`
  em `components/common/PickerField.module.css`. Atingiria qualquer nome com partícula minúscula
  ("Pass without Trace", "Circle of the Land", os 29 "Boon of …").
- Raiz: a regra era uma muleta da época em que alguns callers passavam ids minúsculos. Desde o
  TC-0016 (DDL-0033) todos passam o nome REAL da entidade ou um id já capitalizado
  (`capitalize(classId)`), então ela só introduzia erro.
- Fix: regra removida (com comentário explicando por quê). Verificado ao vivo: os rótulos de
  classe/subclasse/espécie continuam corretos e o boon passa a ler "Boon of Fortitude".

---

> **2026-07-22 (T1a sessão 11 - Sorcerer)**: dois achados (TC-0039, TC-0040), ambos corrigidos em
> sessão. Também verificados sem problema: Metamagic (10 opções, 2→4→6), a coluna Sorcery Points da
> tabela, Draconic Resilience na CA ao vivo (DDL-0045), os caps de atributo (DDL-0034: ASIs saturam
> em 20, Epic Boon leva a 21), o spellSet do Divine Soul, as "3 Charges" do Summon Beast do Shadow
> (DDL-0011), a tabela d100 do Wild Magic Surge e o fluxo "Already Prepared" cruzado do DDL-0040.
> Nenhum item do ledger fica aberto. Restam **Warlock e Wizard (23 linhas)** para fechar a T1a.

## TC-0041 - pré-requisito de MAGIA imprimia só "Spell"

- **Unidade:** transversal (invocações de warlock são o único caso do dataset). **Severidade:**
  polish (cosmético/informativo). **Encontrado:** T1a sessão 12 (Warlock), 2026-07-22.
  **Status:** fixed@2026-07-22.
- Sintoma: no seletor de invocações, Agonizing Blast/Eldritch Spear/Repelling Blast (XPHB) e
  Grasp of Hadar/Lance of Lethargy/Maddening Hex (XGE) exibiam o pré-requisito como "Spell" -
  o jogador não sabia QUE magia precisava.
- Raiz: `engine/prereq.js` não tinha renderer para a chave `spell`, então caía no `default` do
  `otherText` (`titleCase(key)`). Há 10 pré-requisitos `spell` no dataset, TODOS invocações.
- Fix: `spellText`, portado de `Parser.prereqSpellToFull` + `Renderer…_getHtml_spell` do 5etools -
  string sem sufixo → o nome; `#c` → "<Magia> cantrip"; `#x` → "Hex spell or a warlock feature
  that curses"; objeto `{choose, entry, entrySummary}` (versões XPHB) → o `entrySummary`.
- Verificado ao vivo ("Agonizing Blast … Warlock Cantrip That Deals Damage, Warlock level 2+";
  "Grasp of Hadar … Eldritch Blast cantrip") + 1 teste em `prereq.test.js`.

## TC-0042 - Resilient não concedia a proficiência em salvaguarda

- **Unidade:** transversal (talento Resilient; achado com um Warlock 19). **Severidade:** bug
  (derivação incompleta). **Encontrado:** T1a sessão 12 (Warlock), 2026-07-22.
  **Status:** fixed@2026-07-22.
- Sintoma: escolher Resilient e apontar o +1 para Dexterity deixava o card SAVING THROWS com
  Wisdom/Charisma apenas - a proficiência em salvaguarda de Dex nunca aparecia.
- Raiz: o campo `savingThrowProficiencies` dos talentos não era lido por ninguém. É o único
  talento do dataset com o campo (PHB reprint-oculto + XPHB).
- Fix: `deriveFeatSaveProficiencies(character, db)` (`engine/resolve.js`), dobrado em
  `ctx.proficientSaves` ao lado dos grants de subclasse e dos picks `save`. Como o RAW amarra a
  salvaguarda ao MESMO atributo do +1 ("Choose one ability in which you lack saving throw
  proficiency… You gain saving throw proficiency with the chosen ability"), NÃO emitimos uma
  segunda escolha: lemos os picks `ability` do sub-bag do próprio talento. Entradas fixas
  (`[{con:true}]`, forma hoje inexistente) são concedidas direto.
- Verificado ao vivo (Dexterity entra no card ao apontar o +1 do Resilient para Dex) + 3 testes
  em `resolve.test.js`.

## TC-0043 - listas EXPANDIDAS de subclasse não contam como "lista da classe" no seletor de magias

- **Unidade:** `class:warlock/*` legadas (Hexblade/Genie/Fathomless/Undying) e, por tabela, toda
  subclasse pré-2024 com `expanded` (domínios/círculos legados). **Severidade:** polish.
  **Encontrado:** T1a sessão 12 (Warlock), 2026-07-22. **Status:** fixed@2026-07-22 (DDL-0054).
- Sintoma: um Warlock do Genie (Efreeti) que tenta preparar Fireball recebe a confirmação
  "Fireball is not on the Warlock spell list" - mas o RAW da subclasse legada justamente ADICIONA
  aquelas magias à lista dele. Não é bloqueio (DDL-0026 permite com aviso), só um aviso errado.
- Contexto: por decisão do B2.3/DDL-0008, `expanded` NÃO concede magia (não é always-prepared) -
  isso está certo. O que falta é o outro lado: o conjunto "on-list" do picker (hoje
  `classSpellList(db, origin.spellListClass)`) poderia incluir os nomes de `expanded` da subclasse
  escolhida, e o filtro Class pré-marcado poderia deixá-las visíveis.
- **Decisão do usuário (2026-07-22): opção (a), somar ao on-list** - e o escopo foi AMPLIADO por
  ele para todo mecanismo de "alargar a lista", não só os patronos: Divine Soul (lista de clérigo
  inteira) e o Magical Secrets do Bardo @10 são a mesma ideia.
- **Correção de escopo do registro original:** a frase "por tabela, toda subclasse pré-2024 com
  `expanded` (domínios/círculos legados)" estava ERRADA. Varredura de todos os `class-*.json`: o
  bucket `expanded` com nomes soltos existe em exatamente **9 subclasses, todas de Warlock**
  (Archfey/Fiend/Great Old One PHB, Undying SCAG, Celestial/Hexblade XGE, Fathomless/Genie TCE,
  Undead VRGR). Domínios de clérigo e círculos de druida concedem por `prepared` (sempre
  preparadas), não alargam lista.
- **Fix (fixed@2026-07-22, DDL-0054):** novo módulo puro `engine/spellListWidening.js`
  (`expandedSpellNames` + `originExtraSpells`) lê o bucket `expanded` em suas três formas - nomes
  soltos com chave `sN` (círculo de espaço) ou numérica (nível de classe), `{all: "level=N|class=X"}`
  (Divine Soul) e `{all}` com LISTAS em ambos os campos (`level=1;2;3;4;5|class=Cleric;Druid;Wizard`,
  o Magical Secrets do Bardo). Grupos múltiplos seguem a semântica de ALTERNATIVA do TC-0011 (sem a
  afinidade/elemento escolhido, nada alarga). A derivação expõe `origin.expandedSpells` (nomes) e
  `origin.expandedFrom` (nome → fonte); a SpellbookTab e o SpellPicker do guia unem isso ao
  `listNames` (mata o aviso) e passam ao `makeSpellEntity`, que injeta a classe da origem no filtro
  de Classe da magia (é o que o RAW diz: "count as Warlock/Bard spells for you") e põe um badge com
  a fonte.
- **Descoberta durante o fix:** o Magical Secrets do Bardo NÃO é prosa - está inteiro no
  `additionalSpells` da classe. O registro curado que eu tinha criado para ele foi removido: era
  redundante e menos preciso que o dado (liberava círculos 6-9 cedo demais). Hoje NENHUM alargador
  vive só em prosa; o cabeçalho do módulo documenta isso e onde pôr um, se aparecer.
- Verificado ao vivo: **Genie/Efreeti 19 prepara Fireball sem aviso**, com badge "The Genie" e
  visível no filtro Warlock pré-marcado; **Divine Soul 3 prepara Guiding Bolt** (badge "Divine
  Soul") - e, sem a afinidade escolhida, o alargamento corretamente não vale. 7 testes em
  `spellListWidening.test.js`; 979 testes, lint, sweep 274/274 `--strict`.

## TC-0044 - Forest Gnome só concede Speak with Animals a partir do nível 3

- **Unidade:** `species:Gnome|XPHB/Gnome; Forest Gnome Lineage` (achado com um Wizard 1).
  **Severidade:** bug (derivação incompleta). **Encontrado:** T1a sessão 13 (Wizard), 2026-07-22.
  **Status:** fixed@2026-07-22.
- Sintoma: um Gnome/Forest Gnome de nível 1 mostrava só Minor Illusion na aba da linhagem; o Speak
  with Animals ("always have prepared", PB×/dia) aparecia apenas no nível 3.
- Raiz: divergência entre prosa e dado no 5etools. O traço diz "You know the Minor Illusion
  cantrip. You also always have the Speak with Animals spell prepared…" - sem nível -, mas
  `additionalSpells` codifica `innate: {3: {daily: {pb: [speak with animals|xphb]}}}`. Mesma
  família do TC-0026 (a prosa é a autoridade), só que aqui a magia EXISTE no dado, no nível errado:
  corrigir é MOVER, não acrescentar, e o `MISSING_ADDITIONAL_SPELLS` só sabe fundir.
- Fix: novo registro `REGRADED_ADDITIONAL_SPELLS` (`engine/grantedSpellUses.js`) com
  `{bucket, spell, from, to}`, aplicado no `curatedAdditionalSpells`. `takeSpell`/`putSpell`
  preservam o CAMINHO dentro do nível (a estrutura `{daily:{pb:[…]}}` chega intacta no destino) e o
  nível de origem é podado se ficar vazio; o dado nunca é mutado.
- Escopo: varredura de `races.json` (todas as versões/linhagens) mostrou que é o ÚNICO caso -
  Flamekin/Rimekin LFL também têm grants em 3/5, mas a prosa deles (herdada do Genasi MPMM via
  `_copy`) diz "Starting at 3rd level", então o dado está certo.
- Verificado ao vivo (nível 1: "Speak with Animals · ALWAYS PREPARED · 2/DAY · RITUAL") + 3 testes
  em `grantedSpellUses.test.js` (o move preserva a estrutura, a magia é concedida no nível 1, e o
  dado cru sem a correção só concede a partir do 3).

## TC-0045 - features de subclasse legada renderizam um nível cedo demais

- **Unidade:** transversal - toda subclasse pré-2024 adotada num chassi 2024 cujo nível de
  subclasse mudou (os 4 schools PHB do wizard 2→3; por tabela também domínios de clérigo 1→3 etc.).
  **Severidade:** polish (exibição; não concede nada cedo). **Encontrado:** T1a sessão 13 (Wizard),
  2026-07-22. **Status:** fixed@2026-07-22.
- Sintoma: com School of Conjuration (PHB) escolhida num Wizard 19, o card de Features mostrava
  **Conjuration Savant** e **Minor Conjuration** sob "LEVEL 2" - um nível antes de a subclasse ser
  sequer escolhível -, enquanto a umbrella "School of Conjuration" aparecia certa em LEVEL 3.
- Raiz: o stub `_copy` do chassi XPHB reaponta a umbrella para o nível 3
  (`School of Conjuration|Wizard|XPHB|Conjuration||3`), mas o corpo dela vem por `_copy` da versão
  de nível 2, e os `refSubclassFeature` de dentro seguem apontando `…|Conjuration||2`. O
  `subclassFeatureList` emite cada ref direto como feature própria (comportamento desejado desde a
  Fase 6) usando o nível da FEATURE, não o da umbrella que a inlinou.
- Fix: `emitFeature(f, atLevel)` (`engine/subclassPreview.js`) propaga o nível da umbrella para os
  refs diretos, recursivamente. É como o 5etools renderiza (aninhadas na umbrella). Onde os níveis
  já coincidem - todo o conteúdo 2024 - o override é no-op.
- Nota: só exibição. O gate de concessão é `level <= cls.level` e a subclasse não existe abaixo do
  nível dela, então nada era concedido cedo. A prosa legada segue dizendo "at 2nd level" no texto -
  isso é o texto original da fonte, não corrigimos.
- Verificado ao vivo (Conjuration Savant/Minor Conjuration sob LEVEL 3) + 2 testes em
  `subclassPreview.test.js` (herda o nível da umbrella reapontada; a cadeia legada original mantém
  os níveis próprios).

---

> **2026-07-22 (2) (T1a sessão 13 - Wizard)**: TC-0044 e TC-0045 achados e corrigidos em sessão.
> **T1a ESTÁ CONCLUÍDA** - todas as 135 linhas `class:*` estão `ui: ok`. O único item aberto do
> ledger é o **TC-0043** (needs-user-eyes, listas `expanded` de subclasse legada no seletor de
> magias), que aguarda decisão do usuário. Próximo estágio: **T1b - espécies e linhagens**.

---

> **2026-07-22 (3)** - **TC-0043 FECHADO (DDL-0054)**, por decisão do usuário e com o escopo
> ampliado por ele para todo alargamento de lista (patronos + Divine Soul + Magical Secrets).
> **O ledger não tem mais nenhum item aberto** e a T1a segue concluída. Próximo estágio: T1b.

## TC-0046 - Custom Lineage tratava o "Variable Trait" como LINHAGEM

- **Unidade:** `species:Custom Lineage|TCE` (também `species:Kobold|MPMM`, mesma forma).
  **Severidade:** bug (rótulo enganoso). **Encontrado:** sessão avulsa de espécies, 2026-07-23.
  **Status:** fixed@2026-07-23.
- Sintoma: a aba oferecia um seletor **"Lineage"** com "Darkvision"/"Skill Proficiency". O Custom
  Lineage não tem linhagem nenhuma: tem um traço variável (a) visão no escuro OU (b) uma perícia.
- Raiz: o 5etools codifica esse ou-exclusivo como `_versions`, e `_versions` é exatamente o que o
  app chama de linhagem. O rótulo "Lineage" era uma string FIXA nos dois JSX.
- Fix: `lineageSelectorLabel(race)` (`engine/speciesData.js`) tira o nome do DADO - o traço que as
  versões substituem (`_mod.entries.replace`). Aplicado no rótulo, no placeholder e no título do
  SelectorPanel (a entity o deriva sozinha, sem mudar call site).
- Escopo: melhora 8 espécies de uma vez - "Variable Trait" (Custom Lineage), "Kobold Legacy",
  "Elven Lineage", "Gnomish Lineage", "Giant Ancestry", "Fiendish Legacy", "Shifting". Sem
  `_versions` (linhagens vindas de sub-raças: Genasi, Stensia) ou com `replace` sem letra (lixo do
  dataset: Faerie/Kithkin LFL trazem `","`) cai no genérico "Lineage".

## TC-0047 - benefício OU-EXCLUSIVO era oferecido pela BASE, antes de o jogador ter direito

- **Unidade:** `species:Custom Lineage|TCE`, `species:Kobold|MPMM`. **Severidade:** bug (regra).
  **Encontrado:** sessão avulsa de espécies, 2026-07-23. **Status:** fixed@2026-07-23.
- Sintoma: sem nada escolhido, o Custom Lineage já mostrava "Choose any skill" E derivava
  Darkvision 60 - os dois lados de um "ou". Idem no Kobold (perícia do Craftiness).
- Raiz: `lineageDeferredKinds` (DDL-0061) só adiava um campo quando TODA linhagem o sobrescrevia.
  Aqui a versão "Skill Proficiency" MANTÉM o campo da base e a outra o ANULA - então a regra de
  sobrescrita não disparava.
- Fix: regra irmã de REMOÇÃO - um campo é adiado quando ALGUMA linhagem o anula (sinal de
  ou-exclusivo). `skillProficiencies`/`toolProficiencies`/`languageProficiencies` entram só por
  ela (pela regra de sobrescrita esconderiam escolhas legítimas: o merge de sub-raça CONCATENA
  idiomas/perícias e "difere" da base sem substituí-la).
- Escopo medido no dataset: Custom Lineage (skill), Kobold (skill + magias), Goblin PSZ (resist,
  no-op - o campo dele não gera escolha). A perícia do Keen Senses élfico continua aparecendo.
- Nota: a visão no escuro da base ainda é derivada enquanto nada foi escolhido (a escolha é
  obrigatória, então é transitório) - mesma situação de qualquer espécie sem linhagem escolhida.

## TC-0048 - espécie legada concedia aumento de atributo (regra 2014)

- **Unidade:** `species:Custom Lineage|TCE`, `species:Aetherborn|PSK` (+ a variante Gifted),
  `species:Simic Hybrid|GGR`. **Severidade:** bug (regra). **Encontrado:** sessão avulsa de
  espécies, 2026-07-23. **Status:** fixed@2026-07-23.
- Sintoma: a aba mostrava "Ability Score Increase" (+2 à escolha no Custom Lineage), somado aos
  boosts da origem 2024.
- Raiz: o DDL-0058 fixou que o `ability` legado é ignorado, mas a limpeza só existia para as
  SUB-RAÇAS curadas (`prepareLegacySubrace`); uma espécie BASE 2014 passava direto.
- Fix: `normalizeLegacySpecies` (`engine/legacySpeciesRules.js`), aplicado no `resolveRaceObj` -
  o único ponto por onde o app pega um objeto de espécie para trabalhar.
- Limitação aceita: uma ficha salva ANTES com esse pick guarda o boost no bag e ele continua
  contando. Não há migração porque o mesmo `species.choices['ability-0']` é o que o import do
  Foundry usa para reconstruir os scores de um ator legado (DDL-0028) - apagá-lo cegamente
  quebraria os premades. Basta limpar a escolha à mão na ficha afetada (as três são obscuras).

## TC-0049 - o talento do Custom Lineage não tinha categoria

- **Unidade:** `species:Custom Lineage|TCE`. **Severidade:** regra (curadoria). **Encontrado:**
  sessão avulsa de espécies, 2026-07-23. **Status:** fixed@2026-07-23 (decisão do usuário).
- Sintoma: o seletor de talento listava TODAS as categorias (General/Fighting Style/Epic Boon) no
  nível 1, enquanto o Human XPHB - o análogo 2024 - restringe a ORIGIN.
- Fix: registro `FEAT_CATEGORY_OVERRIDES` em `engine/legacySpeciesRules.js`
  (`'Custom Lineage|TCE': ['O']`), reescrevendo `[{any:1}]` como o `anyFromCategory` do Human. A
  chave é a da espécie BASE, então a variante de traço herda.
- Verificado ao vivo: o seletor passou a listar as mesmas 25 origens do Human.

## TC-0050 - pick de idioma "other" se perdia no round-trip

- **Unidade:** `species:Simic Hybrid|GGR`. **Severidade:** bug (export/import). **Encontrado:**
  pelo sweep `--strict` na mesma sessão (o deslocamento do RNG revelou um caso latente).
  **Status:** fixed@2026-07-23.
- Sintoma: `species.choices.language-0 = ['other']` sumia ao reimportar (1 diff no strict).
- Raiz: o 5etools usa o pseudo-idioma `other` para o idioma próprio do cenário (Simic Hybrid:
  "Elvish ou Vedalken"). Exportávamos `languages:standard:other`, que não existe no dnd5e, e o
  import não achava idioma nenhum com esse código.
- Fix: pela política do DDL-0028 - sem casa nativa, vai na flag. `isKnownLanguage(db, name)`
  filtra o Trait (só idiomas reais) e um pick não mapeável manda a escolha INTEIRA para
  `flags.builder5e.choices` do item de raça, de onde o import a restaura (a flag vence).
- Pendente (cosmético, não aberto como bug): o seletor mostra a opção como **"Other"** em vez do
  idioma que ela representa (Vedalken). Traduzir exigiria curadoria por espécie.

---

> **2026-07-23 (sessão avulsa - Custom Lineage)**: TC-0046…TC-0050 achados e corrigidos em sessão
> (ver DDL-0062). Três dos cinco são GERAIS (rótulo derivado, regra de remoção, `ability` legado) e
> pegam Kobold/Aetherborn/Simic Hybrid junto. O ledger segue sem itens abertos; a T1b (espécies)
> ganha um adiantamento parcial - as linhas do Custom Lineage e do Kobold já foram olhadas.

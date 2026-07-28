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

## TC-0051 - Tiefling; Abyssal Legacy exibia Darkvision 120 ft (dado upstream errado)

- **Unidade:** `species:Tiefling|XPHB/Tiefling; Abyssal Legacy`. **Severidade:** bug (dado).
  **Encontrado:** T1b sessão 2 (Bloco S-A2), 2026-07-25. **Status:** fixed@2026-07-25.
- Sintoma: o preview do seletor e a ficha mostravam "120 ft / Darkvision" só para a legacy
  Abyssal; Chthonic e Infernal (as outras duas oficiais 2024) ficavam nos 60 ft da base, e
  nenhuma prosa da entrada menciona alteração de visão no escuro.
- Raiz: confirmado no JSON cru do 5e.tools (`races.json`, `_versions` do Tiefling XPHB) - a
  versão "Abyssal Legacy" carrega `darkvision: 120` no campo de topo, sem nenhuma entry
  correspondente. Cross-checado contra o SRD oficial (dnd5e system, CC-BY-4.0,
  `packs/_source/origins24/species/tiefling-abyssal.yml`): "Darkvision. You have Darkvision
  with a range of 60 feet." - sem exceção para a Abyssal. É um erro pontual do dado upstream,
  não uma regra do livro.
- Fix: `KNOWN_DATA_FIXES` em `engine/speciesData.js`, aplicado dentro de `buildVariant` por
  chave exata `Raça|Fonte/Versão` - corrige só essa entrada, sem tocar resistência/magias/
  demais campos dela nem qualquer outra linhagem. 2 testes novos em `speciesData.test.js`.
- Verificado ao vivo: preview e ficha da Abyssal Legacy agora mostram só "Poison / Resistance"
  (sem badge de Darkvision), igual às outras duas legacies oficiais.

## TC-0052 - linhagem curada caía na lore da EDIÇÃO ERRADA (fallback por nome puro)

- **Unidade:** as 11 `species:Tiefling|XPHB/Tiefling; * Legacy` legadas, `Halfling; Ghostwise
  Lineage`, `Halfling; Lotusden Lineage`, `Elf (Eladrin)`. **Severidade:** bug (exibição).
  **Encontrado:** T1b sessão 3 (Bloco S-B1), 2026-07-25. **Status:** fixed@2026-07-25.
- Sintoma: ao escolher uma legacy legada do Tiefling (Zariel/Winged/…), a LORE da espécie
  trocava para o texto de **2014** ("To be greeted with stares and whispers…") em vez do texto
  2024 da base. Idem para as duas linhagens legadas do Halfling. O `Elf (Eladrin)` chegava a
  exibir a lore e a ARTE do **Elf de Lorwyn** (LFL), sem relação nenhuma com ele.
- Raiz: uma linhagem curada carrega a fonte da sub-raça de ORIGEM (MTF/SCAG/EGW), e esses livros
  não têm entrada de fluff da espécie. A cadeia de resolução do `raceEntity.fluff` terminava num
  `list.find((f) => f.name === baseName)` - **a primeira entrada de mesmo nome**, que é a de 2014
  (ou, no caso do Eladrin, uma entrada de outro cenário). Não era uma escolha de sabor: nenhum
  sabor 2014 estava sendo preservado, era ordem de array.
- Fix: `buildVariant` (`engine/speciesData.js`) passou a gravar `_baseSource` ao lado do
  `_baseName` (a MESMA convenção que o `mergeSubrace` já usava), e a cadeia do
  `raceEntity.fluff` ganhou um passo `baseName + _baseSource` **antes** do fallback por nome puro.
  Cirúrgico: só as 14 linhas que caíam no último passo mudaram.
- Não regride o DDL-0066: as fundidas (Elf/Fairy de Lorwyn e Shadowmoor) resolvem no passo 3
  (`baseName + fonte da própria linhagem` = LFL), antes do novo passo - verificado, incluindo a
  troca curada de arte Lorwyn↔Shadowmoor. Pallid, Genasi, Aven e as linhagens nativas idênticas.
- Verificado: sonda sobre o compêndio real (14 linhas antes → 14 corrigidas, 0 regressões), 3
  testes novos em `race.test.js`, e ao vivo (Zariel Legacy passou a exibir a lore 2024).

## TC-0053 - cinco especies declaravam a propria CA em prosa e derivavam 10+Dex

- **Unidade:** `species:Lizardfolk|MPMM` (onde foi notado), `species:Thri-kreen|AAG`,
  `species:Locathah|LR`, `species:Loxodon|GGR`, `species:Goblin|PSZ` (+ suas tribos e a
  variante de Ixalan). **Severidade:** bug (regra). **Encontrado:** T1b sessao 5/6 (Bloco S-C),
  2026-07-25. **Status:** fixed@2026-07-25.
- Sintoma: o card do seletor marcava o traco **Natural Armor**, mas a ficha derivava a CA base
  comum (10 + Dex). O probe do S-C mostrou o contraste: Tortle derivou 17 e Lizardfolk 11.
- Raiz: o registro `NATURAL_ARMOR` (DDL-0034) tinha so tres entradas (Tortle/Autognome/
  Warforged). A maquinaria ja era generica - `deriveArmorClass` aceita `unarmored` com
  `base`+`ability`, permite escudo e escolhe a MAIOR CA - faltavam so as linhas.
- Fix: varredura de TODA especie alcancavel com o traitTag `Natural Armor` cruzada com o
  registro, e as cinco que faltavam entraram: Lizardfolk 13+Dex, Thri-kreen 13+Dex (Chameleon
  Carapace), Locathah 12+Dex, **Loxodon 12+Con** (o unico que soma Constituicao) e Goblin PSZ
  11+Dex (Grit). Mais `Goblin|PSX`, porque o goblin de Ixalan e sub-raca FUNDIDA do de Zendikar
  e o fallback do modulo procura `<baseName>|<fonte da variante>`.
- **Fora do registro de proposito:** Simic Hybrid (GGR) - a CA dele vem de uma OPCAO escolhivel
  do "Animal Enhancement", que e caminho de featureoption, nao traco fixo; e as versoes que o
  `latestOnly` esconde (Lizardfolk VGM/DMG, Tortle TTP, Warforged ERLW, Troglodyte DMG).
- Verificado: probe sobre o compendio real (as 12 linhas com o traco agora resolvem: Lizardfolk
  15, Loxodon 14, Thri-kreen 14, Locathah 13, Goblin 13, Tortle 17), 2 testes novos, e ao vivo
  (**Lizardfolk com Dex 10 mostra AC 13** na ficha; era 10).

## TC-0054 - Tiefling Winged: texto de atributo de conjuracao pendurado no vazio

- **Unidade:** `species:Tiefling|XPHB/Tiefling; Winged Legacy`. **Severidade:** polish (texto).
  **Encontrado:** relatado pelo USUARIO, 2026-07-25. **Status:** fixed@2026-07-25.
- Sintoma: a Winged e a unica legacy que nao concede magia (da asas e resistencia), mas (a) o
  traco dela terminava com "Intelligence, Wisdom, or Charisma is your spellcasting ability for
  the spells you cast with this trait" - e nao ha magia alguma conjurada com esse traco; e (b) o
  "Otherworldly Presence" dizia que o Thaumaturgy usa "the same spellcasting ability you use for
  your Fiendish Legacy Trait", apontando para um traco que nao fala de atributo nenhum.
- Fix (pontual, so para legacy SEM magia propria - hoje so a Winged): a frase do atributo **muda
  de traco** em vez de sumir, porque o atributo continua existindo (o Thaumaturgy precisa dele).
  O traco da legacy fica com resistencia + asas; o Otherworldly Presence perde a frase que
  apontava para a legacy e recebe a frase do atributo - ali o "this trait" passa a se referir a
  ele mesmo, que e o traco com que o Thaumaturgy e conjurado.
- **Sem prosa nossa** (DDL-0061/DDL-0003): as duas frases saem do dado (a 1a sentenca do
  Otherworldly Presence + o paragrafo 3 do template oficial). Se o texto upstream mudar a ponto
  de a frase nao ser reconhecida, o traco fica intacto (degradar em vez de inventar).
- Verificado: 4 testes novos (incl. que as legacies COM magia nao mudam), conferencia contra o
  compendio real e ao vivo na ficha.

---

> **2026-07-23 (sessão avulsa - Custom Lineage)**: TC-0046…TC-0050 achados e corrigidos em sessão
> (ver DDL-0062). Três dos cinco são GERAIS (rótulo derivado, regra de remoção, `ability` legado) e
> pegam Kobold/Aetherborn/Simic Hybrid junto. O ledger segue sem itens abertos; a T1b (espécies)
> ganha um adiantamento parcial - as linhas do Custom Lineage e do Kobold já foram olhadas.

---

> **2026-07-26 - ABERTURA DO STAGE T2**: o oráculo novo (`npm run t2`, TESTING-PLAN §5.1)
> re-exporta as 48 fichas premade oficiais e compara o resultado com elas: **1023 achados em
> 27 classes** na 1ª rodada. Cinco foram corrigidos na mesma sessão (TC-0055…TC-0058 + TC-0060),
> levando o total a **745**. Os demais estão abaixo, cada um com a CAUSA triada (export /
> import / decisão de produto). Regra do burn-down: corrigir no MECANISMO, nunca por unidade;
> re-rodar `npm run t2` e `npm run sweep -- --strict` depois de cada classe fechada.

## TC-0055 - A moeda do personagem nunca era exportada

- **Unidade:** todas (48/48 fichas). **Severidade:** bug (perda de dado). **Causa:** export.
  **Encontrado:** 2026-07-26, 1ª rodada do `npm run t2`. **Status:** fixed@2026-07-26.
- `buildActorSystem` escrevia `currency: {pp:0, gp:0, ep:0, sp:0, cp:0}` LITERAL, então todo o
  dinheiro do personagem (a carteira da aba Inventory, CHANGELOG §11) desaparecia no export. O
  import já lia o campo corretamente desde sempre.
- **Por que o sweep não pegava:** `decisionSummary` (o oráculo de round-trip) não comparava
  `currency` - zerado nos dois lados, o diff era vazio. O campo entrou no resumo junto com o fix,
  então uma regressão volta a falhar a linha.
- Fix: `buildCurrency(character)` em `foundryExport.js` + `currency` no `decisionSummary`.
  3 testes.

## TC-0056 - Perícias e ferramenta da ORIGEM se perdiam ao importar qualquer premade

- **Unidade:** todas (129 achados de `skills` + 48 de `tools`). **Severidade:** bug.
  **Causa:** import. **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-26.
- O import roteava os Traits do item de background pelo TÍTULO (`/skill/i`, `/tool/i`,
  `/language/i`). Um premade real usa **um Trait só**, chamado "Background Proficiencies",
  misturando `skills:*` E `tool:*` - nenhum dos três regexes casa, e as perícias e a ferramenta
  da origem sumiam inteiras (um Merric importado ficava sem Athletics/Insight/Mason's Tools).
- Fix: rotear pelo **PREFIXO da chave escolhida**, acumulando nos três baldes - exatamente a
  regra que o bloco do item de RAÇA já documentava logo acima ("não pelo título - premades reais
  usam títulos de sabor"). Vários Traits (a forma do nosso próprio export) continuam funcionando.
- Sobra o mesmo padrão em OUTROS documentos: ver TC-0061.

## TC-0057 - Item sem `source` no ator externo desaparecia no re-export

- **Unidade:** todas (parte de `items.feat`, `items.spell`, `traits.dr`). **Severidade:** bug.
  **Causa:** import. **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-26.
- Um ator de fora (premade/Plutonium) não traz `system.source.book`, e o import gravava a fonte
  VAZIA no personagem. Consequências em cadeia: `findFeat` casa nome E fonte, então
  `'Savage Attacker|'` não resolvia e **o talento de origem inteiro não saía no export** (com ele,
  as magias do Magic Initiate); a espécie com fonte vazia resolvia por nome e podia cair em OUTRA
  EDIÇÃO (o Dragonborn 2014 em vez do XPHB), perdendo traços.
- Fix: helper `featSource(item, db)` (a fonte do documento, ou a do talento de mesmo nome no
  compêndio) usado no talento de origem e no `itemRef`; `resolveRaceByExactName` passou a devolver
  a `source` da espécie resolvida, e `parseSpecies` a usa quando o item não tem nenhuma. Também
  corrigidas duas chamadas `itemRef(featItem)` **sem `db`** (talento de ASI e Fighting Style), que
  anulavam a re-resolução que a função já fazia. 3 testes.

## TC-0058 - Chaves de idioma fora do vocabulário do dnd5e (`sign`, `cant`)

- **Unidade:** 20 fichas. **Severidade:** bug. **Causa:** export (e o import, que inverte pelo
  mesmo mapa). **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-26.
- "Common Sign Language" slugificava para `common-sign-language` e Thieves' Cant estava mapeado
  para `thievescant`; o sistema usa **`sign`** e **`cant`** (conferido em `module/config.mjs` e
  nas fichas reais, que trazem `sign` 16x e `cant` 4x). Uma chave fora do vocabulário não aparece
  na ficha do Foundry, e na volta não reverte para idioma nenhum.
- Fix: duas linhas em `LANGUAGE_TO_FVTT`. O reverso (`languageKeyToName`) inverte pelo mesmo mapa,
  então veio de graça. 1 teste.

## TC-0059 - Idioma concedido por FEATURE de classe (Druidic, Thieves' Cant) nunca é concedido

- **Unidade:** `class:druid/*`, `class:rogue/*` (8 achados de `traits.languages`).
  **Severidade:** bug. **Causa:** derivação (atinge a FICHA, não só o export).
  **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-26 (com TC-0075 e TC-0077, ver DDL-0073).
- Druidic e Thieves' Cant são **features de nível 1** no dado do 5etools (prosa), não entradas de
  `languageProficiencies` - então nossa derivação não concedia o idioma, e o card Languages de um
  Druida/Ladino não os listava. Os premades os trazem em `traits.languages` (`druidic`, `cant`).
- Fix: registro curado `CLASS_FEATURE_GRANTS` (`engine/classFeatureGrants.js`), irmão do
  `SUBCLASS_GRANTS`. O Thieves' Cant tem uma segunda metade que faltava: o RAW diz "You know
  Thieves' Cant **and one other language of your choice**", então a entrada declara
  `languageChoices: 1` e isso vira uma Choice de kind `language` no bag da classe
  (`classgrant-lang@1`) - seletor na aba Class, contada na completude, sorteada pelo autoBuild.
- O idioma escolhido faz round-trip nas duas pontas: o Trait exportado leva o CONCEDIDO em
  `grants` e o ESCOLHIDO em `choices` (a forma do premade), e o import ignora o que está em
  `grants` para não confundir concessão com escolha.
- Verificado ao vivo: um Rogue 1 mostra o seletor "Language 0/1" e o card **LANGUAGES: Common ·
  Thieves' Cant**.

## TC-0060 - Progressão de conjuração inválida; subclasse conjuradora sem nenhuma

- **Unidade:** `class:fighter/Eldritch Knight`, `class:rogue/Arcane Trickster` (+ toda classe
  legada). **Severidade:** blocker (ficha sem espaços de magia no Foundry). **Causa:** export.
  **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-26.
- Duas metades. (a) O 5etools escreve as frações `'1/2'`/`'1/3'`, que **não existem** em
  `CONFIG.DND5E.spellcasting`; exportadas cruas, o bloco é inválido. (b) `buildSubclassItem`
  escrevia `progression: 'none'` FIXO, mas o terço-conjurador é da SUBCLASSE - o dnd5e tem o campo
  (o `SpellcastingField` do DataModel de subclass) e é assim que modela EK/AT. Resultado: um
  Eldritch Knight exportado chegava ao Foundry **sem conjuração em lugar nenhum**.
- Fix: `fvttProgression()` (`'1/2'→half`, `'1/3'→third`) aplicada na classe e na subclasse, e a
  subclasse passa a emitir a própria progressão + atributo. Verificado ao vivo: EK/AT agora saem
  `{progression:'third', ability:'int'}`. 3 testes.
- **Deliberado, verificado:** `artificer` é PRESERVADO no Paladino/Ranger 2024 (é o que o dado
  diz). O premade escreve `half`, mas o sistema define os dois de forma idêntica (`divisor: 2`,
  `roundUp: true`), então não há diferença mecânica.

## TC-0061 - Escolhas de proficiência dentro de OUTROS documentos não voltam de um ator externo

- **Unidade:** 15 fichas (39 achados de `skills`, 12 de `tools`). **Severidade:** bug.
  **Causa:** import. **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-27 (DDL-0075).
- Depois do TC-0056, o que sobra são os Traits de escolha que vivem em documentos que o import
  ainda não varre por prefixo: as **ferramentas iniciais da classe** (`tool:music:*` do Bardo,
  `tool:art:brewer` do Monge - hoje `tool@start` só existe na nossa flag, sem descritor nativo),
  as **Bonus Proficiencies de subclasse** (as 3 perícias do College of Lore) e os **Traits INTERNOS
  de um talento concedido** (as 3 perícias do Skilled que o Human ganha por Versatile).
- Fix, nos três: (1) `choiceTraitBag` ganhou um índice de reserva por **(kind, nível)**, usado
  quando o TÍTULO não casa e só se houver um candidato - o premade titula "Tool Proficiencies" onde
  o nosso descritor se chama "Musical Instruments"; (2) passou a ler também os Traits do item de
  SUBCLASSE; (3) `featTraitBag` lê os Traits DENTRO do item de talento, roteando cada chave pelo
  próprio prefixo (o Skilled mistura `tool:` e `skills:` numa Trait só, sem título) para um
  descritor do kind exato ou um `mixed` que o aceite.
- **Achado maior, destravado por (3): o talento do Versatile do Humano se perdia INTEIRO.** O
  `value.added` de um `ItemChoice` é ANINHADO POR NÍVEL (`{"0": {id: uuid}}`) e o código assumia a
  forma plana do `ItemGrant` - com um comentário afirmando que a plana era "a forma dos premades
  reais". Sonda nas 48 fichas: **as 12 que têm ItemChoice de raça usam a aninhada**, ou seja a forma
  assumida não existe em nenhuma. `addedItemIds` passou a ler as duas.
- Verificado: `skills` de 39 → **0** e `tools` de 12 → **0**; 4 testes.

## TC-0062 - Chave de ScaleValue divergente do SRD; falta `max-prepared` e o `preparation.formula`

- **Unidade:** toda classe conjuradora + Monge/Bardo/Feiticeiro/Warlock. **Severidade:** bug.
  **Causa:** export. **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-26.
- **A premissa original estava ERRADA e foi corrigida ao medir:** `identifier: ''` NÃO é inválido -
  o dnd5e faz fallback para o slug do título (`scale-value.mjs`: `configuration.identifier ||
  formatIdentifier(this.title)`), e os próprios premades deixam a maioria em branco. O bug real é
  mais estreito: onde o SRD usa um identificador CURTO e próprio (`points`, `focus`, `die`, `aura`,
  `mark`, `rage-damage`, `inspiration`, `mastery`, `max-prepared`, `invocations-known`), nós
  emitíamos o slug do NOSSO título - `@scale.sorcerer.sorcery-points` em vez de
  `@scale.sorcerer.points` -, quebrando qualquer fórmula do overlay que o cite.
- Causa: a entrada da TABELA vencia e a do overlay (que traz o identificador) era descartada por
  ter o mesmo título; e o overlay era ignorado INTEIRO para uma classe com entrada curada.
- Fix: precedência por ENTRADA - curadas, depois overlay, depois tabela -, com a tabela descartada
  quando já existe entrada de mesmo título **ou de mesma escala** (o SRD às vezes nomeia diferente
  o mesmo recurso: "Bardic Die" x "Inspiration Die", "Martial Arts" x "Martial Arts Die"). Mais
  quatro escalas que a tabela não dá: **Max Prepared Spells / Max Pact Magic Spells**
  (`max-prepared`, de `preparedSpellsProgression`) + o `spellcasting.preparation.formula` que a
  referencia, **Cantrips Known**, **Weapon Masteries Known** (`mastery`, só onde a contagem CRESCE
  - no SRD as classes de contagem fixa não têm a escala) e **Eldritch Invocations Known**
  (`invocations-known`).
- Verificado por sonda comparando a chave EFETIVA (`identifier || slug(title)`) das 12 classes
  contra os premades: **zero chave faltando**, e a única a mais é a `divine-spark` curada
  (deliberada - a activity do Clérigo a referencia). 4 testes.

## TC-0063 - Sem escadas `ItemChoice`: nada a escolher ao subir de nível no Foundry

- **Unidade:** toda classe com escolha (Fighting Style, Divine Order, Blessed Strikes, Primal
  Order, Metamagic, Invocations...). **Severidade:** bug. **Causa:** export.
  **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-26.
- O premade modela cada escolha de feature como um advancement `ItemChoice` com o POOL de opções
  (uuid de compêndio) e o nível. Nós emitíamos o item ESCOLHIDO, mas o `ItemChoice` do Fighting
  Style saía com **pool vazio** e as demais escolhas não geravam passo nenhum - quem subisse de
  nível dentro do Foundry não recebia prompt algum (o irmão do DDL-0055 para o ItemGrant).
- Fix: `buildItemChoiceAdvancements` (`foundryItems.js`), emitido no item de classe E no de
  subclasse. Duas metades, como no SRD: `configuration.pool` com os uuids de TODAS as opções
  (é o que o Foundry oferece) e `value.added` apontando, por nível, para o item EMBUTIDO já
  escolhido - senão o passo voltaria a perguntar o que já foi decidido. Os picks são FATIADOS
  entre os níveis na ordem (o bag guarda uma lista só para todos), como os Traits de Weapon
  Mastery do DDL-0055.
- Duas armadilhas que a sonda pegou: `optionalFeatureChoices` funde os descritores da classe e da
  subclasse sem marcá-los (o Warlock emitia as invocações DUAS vezes - a diferença é o descritor
  que só aparece com a subclasse); e uma opção sem uuid conhecido não entra no pool, com o
  descritor inteiro descartado quando o pool fica vazio (escada que não oferece nada é pior que
  nenhuma; `allowDrops` continua deixando arrastar à mão).
- **Destravou o TC-0069 de graça:** o gerador de uuids passou a indexar as pastas de OPÇÕES da
  classe (`metamagic-options`, `eldritch-invocation-options`), que é de onde saem tanto o pool
  quanto o `compendiumSource` das optional features.
- **Resta um caso** (não reaberto como bug): o Fighting Style EXTRA do Champion no nível 7 vem de
  um descritor `feat` do `SUBCLASS_FEATURE_GRANTS`, não de featureoption nem de optionalfeature, e
  por isso ainda não gera passo na subclasse. 3 testes.

## TC-0064 - Item de espécie muito mais magro que o do premade

- **Unidade:** 24 fichas (`advancement.race`). **Severidade:** bug + 1 decisão de produto.
  **Causa:** export. **Encontrado:** 2026-07-26. **Status:** open (parte `needs-user-eyes`).
- Falta no nosso item de raça: o **Trait de escolha de resistência** do Dragonborn 2024
  (`dr:cold` - é assim que o dnd5e modela a ancestralidade), o **ScaleValue do Breath Weapon**
  (`breath`), o **ItemGrant de nível 5** (Draconic Flight / Large Form) e o título convencional
  (`"<Raça> Traits"` em vez do nosso `"Species Traits"`).
- **`needs-user-eyes`:** o premade emite **um item por traço de espécie** (Fey Ancestry, Trance,
  Keen Senses...); nós só emitimos itens para traços com ação/recurso e deixamos o resto como
  effects no item de raça (DDL-0057). Funciona, mas no Foundry o jogador não VÊ esses traços como
  features. É escolha de produto - não mexer sem decisão.

## TC-0065 - Ancestralidade do Dragonborn/Goliath não volta de um ator externo

- **Unidade:** `species:Dragonborn|XPHB/*`, `species:Goliath|XPHB/*` (6 achados de `traits.dr`).
  **Severidade:** bug. **Causa:** import. **Encontrado:** 2026-07-26. **Status:** open.
- No premade o item de raça chama-se só "Dragonborn" e a ancestralidade está num **Trait de
  escolha de resistência** (`chosen: ['dr:cold']`) - não no nome. Nosso import resolve o nome e
  fica com `lineage: null`, então a ficha reimportada perde ancestralidade, resistência, tipo de
  dano do sopro e o traço de nível 5. O Goliath tem a forma equivalente (`ItemChoice` de linhagem).
- Caminho: mapear o `dr:*` escolhido (e o `ItemChoice` do Goliath) de volta para a linhagem, no
  espírito do `resolveLineageName` (DDL-0005).

## TC-0066 - Inventário: quase todo item vira `loot` no Foundry

- **Unidade:** todas (288 achados - era a maior classe). **Severidade:** bug. **Causa:** export.
  **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-26.
- Pares observados: `consumable -> loot` (171: tochas, rações, óleo, poções), `equipment -> loot`
  (112: mantos, botas, mochilas, kits), `weapon -> equipment` (4). No Foundry um `loot` não se
  equipa nem se consome, então a ficha importada perdia affordances reais.
- **Raiz: a distinção NÃO é derivável do dado do 5etools.** Todo item de aventura é o mesmo código
  `G`, e o SRD o reparte item a item (35 loot, 32 equipment, 22 consumable só na pasta
  adventuring-gear). Nosso mapa `GROUP_FOUNDRY` mandava o grupo `gear` inteiro para `loot`.
- Fix, no molde do DDL-0055: o gerador `npm run gen:uuids` passou a emitir **`EQUIPMENT_TYPES`**
  (`nome` → `"tipo/subtipo"`, 572 itens) a partir do pacote `equipment24` do sistema dnd5e - só
  classificação, nenhum conteúdo de regra. `equipmentFoundryType(name)` consulta, e
  `buildInventoryItems` adota **apenas dentro do trio equipment/consumable/loot**, para não tocar
  nos ramos de arma/armadura/ferramenta, que carregam dano/CA/perícia.
- **Uma exceção deliberada:** o SRD PROMOVE a arma um item que o 5etools classifica como foco -
  o "Staff" (e o "Wooden Staff") tem `weaponCategory`, `dmg1` e propriedades no dado, é só o
  `type` que diz `SCF`. A promoção só acontece quando há dano no dado, então a ficha de arma
  nunca é inventada; a categoria vem do raw.
- **Achado colateral, corrigido junto:** `resolveItemObj` casava o nome com CAIXA EXATA, então a
  "Sprig of mistletoe" da Quillathe (m minúsculo, como o premade escreve) não resolvia e o item
  perdia peso, preço, descrição E tipo de uma vez. Agora há uma rede case-insensitive DEPOIS do
  casamento exato - o caminho normal do builder não muda.
- Verificado: `items.gear.type` de **288 → 0** nas 48 fichas; 5 testes novos; sweep 285/285
  `--strict`.

## TC-0067 - Magia concedida como sempre-preparada sai `innate` em vez de `spell`+`prepared:2`

- **Unidade:** 12 fichas (26 `spell.method` + 25 `spell.prepared`). **Severidade:** bug.
  **Causa:** export. **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-27 (DDL-0074).
- Detect Magic/Misty Step (linhagem élfica) e Hellish Rebuke/Darkness (legacy do Tiefling) saem
  como `method: 'innate'`, `prepared: 0`; o premade usa `method: 'spell'`, `prepared: 2` (sempre
  preparada) - o que o RAW 2024 diz ("you always have X prepared", MAIS um uso grátis por descanso).
  Com `innate` o jogador perde a possibilidade de gastar espaço de magia.
- **Confirmado no SRD antes de mexer** (`origins24/.../fiendish-legacy-infernal.yml`): "You always
  have that spell prepared… **You can also cast the spell using any spell slots you have**". O `uses`
  do DDL-0011 continua valendo - muda só o método + `prepared`.
- Fix: em `foundryPreparation`, uma concessão com frequência CONHECIDA (daily/rest/restLong/resource)
  ou sem nenhuma vira `spell`/`pact` + `prepared: 2`. Só o `innate` CRU (o dado não declara
  frequência) segue `innate`, porque ali não sabemos se gasta espaço.
- **Meia correção a mais:** num Warlock PURO não há espaço comum, então a concessão DE CÍRCULO de
  raça/talento também sai `pact` (é o que o premade faz com Faerie Fire/Darkness da linhagem Drow).
  O **cantrip** da mesma linhagem fica em `spell` - cantrip não gasta espaço, e promover os dois
  fez o comparador acusar Dancing Lights na hora.
- **Sobram 3 achados, nenhum acionável:** o `Contact Other Plane` da Sefris, que o PRÓPRIO premade
  encoda diferente de todas as irmãs dela (`spell` onde as outras são `pact`), e uma `Greater
  Restoration` que aparece DUAS vezes na ficha do Krusk (o comparador guarda a primeira).

## TC-0068 - `uses` faltando em features que o SRD rastreia

- **Unidade:** 22 fichas (29 achados). **Severidade:** bug. **Causa:** export.
  **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-27 (DDL-0074).
- Exemplos: Draconic Flight, Divine Intervention, Wild Resurgence, Relentless Endurance. O
  premade traz `system.uses.max`; nós não - então não há recurso para gastar na ficha do Foundry.
- Fix, no molde do TC-0066: `npm run gen:uuids` passou a emitir **`FEATURE_USES_BY_CLASS`** e
  **`FEATURE_USES_FLAT`** (47 pools) do SRD do dnd5e; `featureUses` consulta na ordem
  **curado → SRD → overlay**. Duas tabelas porque o NOME colide entre classes ("Channel Divinity"
  tem escala própria no Clérigo e no Paladino).
- **Achado colateral, mais sério que o enunciado: duas referências `@scale` curadas estavam
  ÓRFÃS.** O TC-0062 alinhou os identificadores de ScaleValue aos nomes curtos do SRD, mas o
  registro de `uses` seguia montando a referência com o slug do NOSSO título -
  `@scale.sorcerer.sorcery-points` e `@scale.monk.focus-points` não apontavam para escala nenhuma.
  E um terceiro caso que a sonda de "referência sem escala" NÃO pegaria: `wild shape` apontava para
  `@scale.druid.wild-shape`, que existe mas é a escala de **CR**, não a de usos. As três ganharam um
  campo `id` literal.
- **Regra que fica:** a referência tem de casar com o IDENTIFICADOR exportado, nunca com o slug do
  título; e uma referência que RESOLVE ainda pode apontar para a escala errada. A sonda útil compara
  `@scale.<x>.<y>` emitido contra `identifier || slug(title)` dos ScaleValue do próprio ator.
- **Pendência menor deixada aberta:** `@scale.circle-of-the-land.lands-aid` (6 achados invisíveis ao
  comparador) - a fórmula vem do OVERLAY, que assume o identificador `circle-of-the-land`, enquanto o
  SRD (e nós, desde o TC-0074) usamos `land`. Corrigir exigiria reescrever fórmula de terceiro.

## TC-0069 - `compendiumSource` ausente em toda OPTIONAL FEATURE

- **Unidade:** 7 fichas (34 achados: metamagias, invocações, pact boon). **Severidade:** polish.
  **Causa:** export. **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-26.
- O registro do DDL-0055/0056 cobre features de classe/subclasse, talentos e magias, mas não
  `optionalfeatures`. Sem procedência, o Foundry não oferece "atualizar do compêndio".
- Fix (junto com o TC-0063): no dnd5e as optional features são documentos de CLASSE (pastas
  `metamagic-options` / `eldritch-invocation-options` dentro de `classes24`), e o gerador só
  varria `class-features`. Passou a varrer todas as pastas da classe (159 para 197 features), e as
  34 divergências foram a zero sem nenhuma mudança no export.

## TC-0070 - Cobertura de `activities` divergente nos DOIS sentidos

- **Unidade:** 15 fichas (18 achados). **Severidade:** bug. **Causa:** export.
  **Encontrado:** 2026-07-26. **Status:** open (a metade das REFERÊNCIAS QUEBRADAS foi fechada
  em 2026-07-27, DDL-0074; a cobertura em si continua aberta).
- Faltam nas nossas: Potent Spellcasting (`damage`), Aura of Protection (`utility`), Favored Enemy
  (`cast`), Cunning Strike (`save`+`utility`), Devious Strikes (`save`). Sobram nas nossas:
  Paladin's Smite (`cast`), Agonizing Blast (`enchant`).
- **O que foi medido e fechado (2026-07-27): as REFERÊNCIAS.** O overlay guarda tokens do conversor
  do Plutonium (`@spell[divine smite|xphb]`, `@creature[imp|xmm]`) que **não são uuids do Foundry**,
  e nós os exportávamos crus - **35 referências apontando para o vazio nas 48 fichas**. Agora
  `@spell[…]` resolve no uuid real do compêndio e a activity com uma referência irresolúvel (as
  invocações de CRIATURA - monstro está fora do nosso escopo) é descartada inteira, o mesmo
  princípio dos links órfãos. Sonda A/B: 35 → 0.
- **`enchant` FICA, medido:** descartá-las junto (o raciocínio era que os efeitos de encantamento
  são pulados na tradução, DDL-0031) subiu o comparador de 18 para 24 na hora - os premades TRAZEM
  essas activities (Martial Arts, Sacred Weapon, Repelling Blast). Fica a questão de fundo, não
  reaberta aqui: emitimos a activity de encantamento SEM os efeitos que ela aplica.
- **O que resta é COBERTURA, e é caro:** as activities do SRD são documentos ricos que referenciam
  Active Effects do próprio item por `_id` (Cunning Strike aponta para os efeitos de Poison/Daze).
  Gerá-las do SRD exigiria copiar também os efeitos e suas referências cruzadas. Valor funcional
  baixo (um botão de rolagem a menos; a feature e o texto seguem na ficha) - por isso ficou.
- **`Paladin's Smite` (3, sentido inverso) é DEFENSÁVEL, não bug óbvio:** o SRD tem `activities: {}`
  (em 2024 Divine Smite é MAGIA, e a ficha a lança pelo item de magia); o overlay dá um `cast` com
  `uses` 1/descanso longo, que é literalmente o que o RAW 2024 concede. Não decidir sozinho se vale
  emitir os dois - conferir antes se o uso grátis não fica CONTADO EM DOBRO (item de magia + activity).

## TC-0071 - Composição do ItemGrant por nível difere do premade (dois sentidos)

- **Unidade:** 19 fichas (25 achados). **Severidade:** polish/bug (a investigar).
  **Causa:** export. **Encontrado:** 2026-07-26. **Status:** open.
- Ex: `paladin Class Features@2` concede 3 no premade e 2 nas nossas; `sorcerer Class Features@2`
  o contrário (2 x 3). Pode ser agrupamento diferente (o premade separa em passos com títulos
  distintos) ou feature realmente ausente - **checar caso a caso** antes de tratar como bug.

## TC-0072 - Escada de magias da subclasse só cobre os níveis FUTUROS

- **Unidade:** 15 fichas (`advancement.subclass`). **Severidade:** polish. **Causa:** export.
  **Encontrado:** 2026-07-26. **Status:** open.
- O premade traz o `ItemGrant` de "<Subclasse> Spells" em TODOS os níveis (os alcançados com
  `value.added` preenchido); nós emitimos só os futuros - as magias dos níveis já alcançados vão
  embutidas, sem o passo correspondente. Mesma questão para o `Trait@6` do Draconic Sorcery e o
  `ItemChoice` do Champion.

## TC-0073 - Tamanho exportado como Small quando a escolha S/M não foi feita

- **Unidade:** 12 fichas (Human, Tiefling). **Severidade:** bug. **Causa:** export + import.
  **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-27 (o lado do EXPORT; ver a nota abaixo).
- Uma espécie com escolha de tamanho (DDL-0017) sem pick nenhum exporta o PRIMEIRO código
  (`'S'` -> `sm`), então um Humano premade reimportado vira **Small**.
- Fix: `foundrySize` passa a devolver o MAIOR dos códigos possíveis. Um ator tem UM tamanho, então
  a escolha não feita precisa de um padrão, e o maior é o que os premades trazem. 12 → 0.
- **Metade deliberadamente NÃO feita:** o import continua sem RECUPERAR a escolha a partir do
  `traits.size`/do advancement `Size` do ator. Não é o mesmo bug - o valor exportado agora está
  certo -, e recuperar exigiria decidir se um tamanho igual ao padrão conta como decisão do jogador.

## TC-0074 - Cosméticos do export (rótulos e slugs)

- **Unidade:** 12 fichas (`details.alignment`), 3 (`subclass.identifier`). **Severidade:** polish.
  **Causa:** export. **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-27 (DDL-0074).
- `alignment`: escrevemos "True Neutral", o premade "Neutral". `identifier` de subclasse:
  `open-hand` x `hand` do premade - e identificador **é referenciado em fórmula**
  (`@subclasses.hand.levels`), então este pesa mais que um rótulo.
- Fix do alinhamento: o mapa passou a escrever a grafia dos 48 premades (cada palavra capitalizada,
  e o neutro puro é só "Neutral"). O import já aceitava as duas formas.
- Fix do identificador: nova tabela GERADA `SUBCLASS_IDENTIFIERS` (`npm run gen:uuids`, do campo
  `system.identifier` do SRD) consultada por `subclassIdentifier()`; `buildSubclassItem` a prefere
  ao slug. Das 12 publicadas, só o Monge divergia ("Warrior of the Open Hand" → `hand`). As outras
  123 subclasses seguem com o slug do shortName - não há identificador canônico para elas.

## TC-0075 - Proficiência de save do Slippery Mind (Ladino 15) não deriva

- **Unidade:** `class:rogue/*` (2 achados, Riswynn L17). **Severidade:** bug.
  **Causa:** derivação (atinge a FICHA). **Encontrado:** 2026-07-26.
  **Status:** fixed@2026-07-26 (com TC-0059 e TC-0077, ver DDL-0073).
- O premade tem Wis e Cha proficientes em save no nível 17; nós não. Slippery Mind (nível 15)
  concede as duas, e é feature de CLASSE em prosa - mesmo mecanismo que faltava ao TC-0059.
  Achado do lado do BUILDER que a T1a não pegou (o sweep não tem oráculo de regra).
- Fix: entrada no `CLASS_FEATURE_GRANTS` (`saves: ['wis','cha']` no nível 15) + um `Trait` no
  nível dela no item de classe, que é a forma do premade. A varredura achou um SEGUNDO caso que
  ninguém tinha reportado: **Disciplined Survivor (Monge 14) concede TODAS as seis salvaguardas**
  (`allSaves: true`).
- Verificado ao vivo: um Rogue 15 mostra SAVING THROWS Dex/Int/**Wis/Cha**.

## TC-0076 - Proficiência de arma CONDICIONAL não é enumerada no export

- **Unidade:** `class:monk/*`, `class:rogue/*`, `class:ranger/*` (parte de `traits.weaponProf`).
  **Severidade:** bug. **Causa:** export. **Encontrado:** 2026-07-26.
  **Status:** fixed@2026-07-27 (com o TC-0078, ver DDL-0075).
- O Monge 2024 é proficiente em "Martial weapons that have the Light property" e o Ladino em
  "Finesse or Light"; o premade ENUMERA (`weapon:mar:scimitar`, `weapon:mar:shortsword`,
  `weapon:mar:handcrossbow`...). Nós exportamos só a categoria `sim`, então no Foundry o Monge não
  é proficiente com cimitarra. **O dado tem o filtro** (`weaponProficiencies[].all.fromFilter`),
  então dá para enumerar sem curadoria - é o mesmo insumo do `weaponFilterAllows` (DDL-0033).
- Nota: o sentido INVERSO desta classe (nossas com `mar`/`hvy` a mais - Akra, Aoth) foi
  verificado e está **correto**: vem de Divine Order Protector / Primal Order Warden, que o
  premade deixa como Active Effect em vez de assar no ator.

## TC-0077 - Aumento de atributo do CAPSTONE não deriva (Body and Mind, Monge 20)

- **Unidade:** `class:monk/*` (1 achado, `AbilityScoreImprovement@20`). **Severidade:** bug.
  **Causa:** derivação (atinge a FICHA). **Encontrado:** 2026-07-26, ao fechar o TC-0063.
  **Status:** fixed@2026-07-26 (com TC-0059 e TC-0075, ver DDL-0073). A varredura achou o
  IRMÃO que faltava: o **Primal Champion do Bárbaro 20** (+4 Força, +4 Constituição). Os dois
  entraram no `CLASS_FEATURE_GRANTS` com `max: 25`, o teto que o RAW dá a eles (acima do 20 dos
  ASIs, abaixo do 30 dos Epic Boons - a máquina de tetos do DDL-0034 ordena por teto e já
  fazia a coisa certa). No export viram um `AbilityScoreImprovement` de valores FIXOS, com
  `value` só no nível alcançado.
- **Achado de import na mesma leva:** um ASI de valores fixos chega com `assignments` vazio, e o
  import o tratava como decisão do jogador - inventava um pick de talento "Ability Score
  Improvement" que o round-trip do sweep acusou na hora (20 linhas vermelhas). Agora exige ao
  menos um aumento real.
- O premade do Monge tem um `AbilityScoreImprovement` no nível 20 com valores FIXOS - é o "Body
  and Mind" (+4 Destreza, +4 Sabedoria). Nossa derivação não concede o aumento e o export não
  emite o passo.
- Mesma FAMÍLIA do TC-0059 (Druidic/Thieves' Cant) e do TC-0075 (Slippery Mind): feature de
  CLASSE que concede algo em prosa. Vale resolver os três com um registro só, no espírito do
  `SUBCLASS_GRANTS` (DDL-0029) mas para features de classe - e varrer o dataset inteiro antes, em
  vez de cadastrar caso a caso.

## TC-0078 - Proficiências de arma INDIVIDUAIS do premade não são enumeradas (parte do TC-0076)

- **Unidade:** `class:monk/*`, `class:rogue/*`, `class:ranger/*` (11 achados). **Severidade:** bug.
  **Causa:** export. **Encontrado:** 2026-07-26. **Status:** fixed@2026-07-27 (DDL-0075; fecha
  também o TC-0076, do qual este era a medida de perto).
- **Fix:** `conditionalWeaponNames` (`engine/autoProficiencies.js`) enumera as armas do
  `weaponProficiencies[].all.fromFilter`; elas viajam num campo À PARTE (`derived.weaponNames`) e só
  o export as usa - na ficha continua valendo a FRASE, que é o que o livro diz. Sem curadoria: o
  filtro é o mesmo insumo do `weaponFilterAllows` (DDL-0033), então uma classe nova sai sozinha.
- **Metade que era do INSTRUMENTO:** os 3 achados do Ranger (Quillathe) não eram falta nossa - o
  premade lista `longbow`/`shortbow` ao lado de `sim`+`mar`, que já os cobrem. O comparador passou a
  reduzir os dois lados quando ambos os códigos estão presentes; Monge e Ladino têm só `sim`, então
  para eles a enumeração continua sendo exigida.
- Verificado: `traits.weaponProf` de 11 → **0**; 3 testes.
- Com os supersets já classificados como ESPERADOS (o `EXPECTED` do harness), o que sobra em
  `traits.weaponProf` é só a direção que FALTA: o premade enumera as armas individuais que a regra
  condicional concede (Monge: `weapon:mar:handcrossbow/scimitar/shortsword`; Ladino: rapier/whip…;
  Ranger: longbow/shortbow), e nós exportamos só a categoria `sim`.
- O dado TEM o filtro (`weaponProficiencies[].all.fromFilter`), então dá para enumerar sem
  curadoria - é o mesmo insumo do `weaponFilterAllows` (DDL-0033). Ver TC-0076 para o contexto.


## TC-0079 - Magia com NOME PRÓPRIO não resolve e some do export (Tasha's/Leomund's/Bigby's…)

- **Unidade:** 4 fichas (Beiro, Morthos, Sefris, Zanna; ~9 magias, parte de `items.spell`).
  **Severidade:** bug (perda silenciosa de decisão do jogador). **Causa:** export.
  **Encontrado:** 2026-07-27. **Status:** fixed@2026-07-27 (DDL-0075).
- A edição 2024 tirou o nome do mago do título e o **dnd5e escreve o nome curto** ("Hideous
  Laughter", "Tiny Hut", "Arcane Hand", "Magnificent Mansion"), enquanto o **5etools mantém o longo
  mesmo em XPHB** ("Tasha's Hideous Laughter", "Leomund's Tiny Hut", "Bigby's Hand", "Mordenkainen's
  Magnificent Mansion"). Sonda: `resolveSpellObj(db, 'Hideous Laughter', '')` → **NULL**.
- **A magia É importada** (entra em `cls.spells`) e some no EXPORT, porque `buildSpellItems` pula a
  entrada sem `raw`. Ou seja: uma magia preparada pelo jogador desaparece **sem aviso nenhum**.
  Vale para qualquer ator vindo do Foundry, não só os premades.
- Caminho sugerido: um pequeno mapa de ALIASES nome-curto → nome-5etools, aplicado como fallback
  DEPOIS do casamento exato em `resolveSpellObj` (o mesmo formato da rede case-insensitive do
  TC-0066). O conjunto é fechado e pequeno: as magias de nome próprio do PHB (Tasha's, Leomund's,
  Bigby's, Mordenkainen's, Otiluke's, Evard's, Melf's, Nystul's, Drawmij's, Rary's).
- `Eldritch Blast (Repelling)` do Sefris NÃO entra aqui: é uma variante ENCANTADA que o Foundry
  gera, não uma magia do compêndio.
- **Fix:** a rede vive em `resolveSpellObj`, DEPOIS do casamento exato, e é DERIVADA - "a magia cujo
  nome é `<alguém>'s <nome curto>`", aceita só com candidato ÚNICO (nome ambíguo não se adivinha; o
  `Jim's Magic Missile` de Acquisitions Inc. é o caso que obriga o exato a vir primeiro). Medida
  contra o pacote `spells24`: **13 dos 16 casos saem pela regra**; os 3 que o SRD reescreveu por
  inteiro (Arcane Hand, Arcane Sword, Arcanist's Magic Aura) são exceções, conferidas uma a uma por
  círculo e escola. `srdSpellNames` faz o sentido inverso, e com ele o `compendiumSource` resolve.
- **O nome EXPORTADO continua o do LIVRO** (decisão, ver DDL-0075): a identidade do documento vai no
  `compendiumSource`, não na grafia. Para o comparador não acusar 26 falsos positivos, `spellKey`
  reduz os dois lados ao nome curto - correção do instrumento, não do export.
- Verificado por sonda A/B: das 26 magias de nome próprio que sumiam, **as 15 `prepared: 1` (as
  escolhidas pelo jogador) voltaram**; as 11 restantes são `prepared: 0`, ou seja TC-0080. 7 testes.

## TC-0080 - Magia CONHECIDA mas não preparada não tem lugar no nosso modelo

- **Unidade:** 38 fichas (189 magias - a maior fatia de `items.spell`). **Severidade:** decisão de
  produto. **Causa:** modelo. **Encontrado:** 2026-07-27.
  **Status:** fixed@2026-07-27 - **o usuário decidiu modelar** (DDL-0076).
- `ClassEntry.spells` guarda só as PREPARADAS (DDL-0008). O premade traz também as `prepared: 0` -
  magias que o personagem tem à disposição mas não preparou hoje. Ao reimportar, elas somem.
- **São dois casos diferentes, e só um é lacuna de verdade:**
  - **Grimório do Mago** (Zanna L17 perde 36 magias): o livro de magias é conteúdo REAL e
    permanente do personagem, e hoje não temos onde guardá-lo. Um Mago reimportado perde o livro.
  - **Sugestões do premade** (o Clérigo, que prepara da lista inteira): o documento lista algumas
    magias a mais para o jogador trocar. Não perder isso vale pouco.
- Não decidir sozinho: modelar "conhecidas × preparadas" mexe no schema, na aba Spellbook e no
  fluxo de preparar. O escopo mínimo defensável seria só o grimório do Mago.
- **Decisão do usuário (2026-07-27): modelar, e para TODO conjurador.** `SpellRef.prepared`
  (`false` = no repertório, não preparada; ausente = preparada, o que preserva tudo que já estava
  salvo), um toggle por linha no molde do "equipar" do inventário, magia nova nasce PREPARADA a não
  ser que o limite esteja cheio (aí entra despreparada), e um contador **Known** para quem tem
  repertório próprio - `spellsKnownProgressionFixed`, que entre as 12 classes 2024 só o Mago tem.
  Ver DDL-0076.
- **Fica de fora, e é o certo:** as 35 magias `prepared: 0` da Riswynn (Ladino/Thief, sem conjuração
  nenhuma) continuam sem voltar - não há origem que as segure, e o documento as lista como sugestão.
  É a metade do TC-0080 que a própria entrada já classificava como de pouco valor.

## TC-0081 - Magias do TALENTO DE ORIGEM se perdem ao importar um ator externo

- **Unidade:** 12+ fichas (Akra, Beiro… parte de `items.spell`, ~84 magias `prepared: 2`).
  **Severidade:** bug. **Causa:** import. **Encontrado:** 2026-07-27.
  **Status:** fixed@2026-07-27 para o TALENTO (DDL-0075); as outras origens seguem abertas - ver o
  fim da entrada.
- Um premade com **Magic Initiate** traz as 2 cantrips + a magia de 1º círculo como itens `spell`
  com `prepared: 2` (e `uses` 1/descanso longo na de círculo). O import as descarta - corretamente,
  porque `prepared: 2` é concessão derivável -, **mas a derivação não as recria**: o talento entra
  com `choices: {}` (sonda no Beiro L01: `originFeat = {id:'Magic Initiate', source:'PHB',
  choices:{}}`), então as escolhas de magia dele nunca foram reconstruídas.
- Duas frentes, e a segunda é suspeita à parte: (a) reconstruir o sub-bag do talento a partir dos
  itens `spell` do ator, casando contra os MESMOS descritores que `grantedSpells` emite (o padrão do
  `choiceTraitBag`, DDL-0056); (b) o talento resolveu como **`Magic Initiate|PHB`** (2014) num ator
  2024 - conferir se o `featSource` do TC-0057 está escolhendo a edição certa.
- Parte dos 84 é a mesma família por outra via: traços de linhagem cujo grant não deriva. Medir de
  novo depois de (a) antes de abrir mais frentes.
- **Fix de (a):** `featChoiceBag` = `featTraitBag` (TC-0061) + `featSpellBag`. As magias do ator são
  casadas contra os MESMOS descritores que a UI usa (`parseChoices` + `spellChoosePredicate`), então
  nenhum talento é citado por nome; havendo listas ALTERNATIVAS, vence a que explica mais magias.
  Duas afinações que a medição exigiu, ambas lendo marcas do próprio documento: a concessão de um
  TALENTO carrega o atributo e a frequência dele (a da classe herda os dois e vem sem), e **uma
  magia que uma concessão FIXA já explica não é candidata** - sem esse corte o Fire Bolt da linhagem
  infernal ocupava um slot e o Mage Hand escolhido pelo jogador se perdia.
- **(b) confirmado e corrigido:** `featSource` não aplicava `latestOnly`, então "Magic Initiate"
  resolvia na entrada **PHB de 2014** (a primeira do array) num ator 2024 - e a estrutura de
  `additionalSpells` difere entre edições, ou seja os descritores eram os errados. O irmão
  `resolveInventorySource` já filtrava; era a metade que o TC-0057 esqueceu.
- Verificado: das 81 magias `prepared: 2` que sumiam, **57 voltaram**. 5 testes.
- **As 24 restantes eram a MESMA família com outro DONO, e foram fechadas em 2026-07-27** junto com
  o resto: `featSpellBag` virou o genérico **`spellChoiceBag`**, parametrizado pelos descritores da
  entidade dona, e ganhou três chamadores novos - espécie (o cantrip da linhagem élfica), classe e
  subclasse (as Magical Discoveries do College of Lore e o terreno do Circle of the Land).
- **O que o genérico precisou aprender:** uma lista alternativa pode não ter escolha NENHUMA - as
  quatro do Circle of the Land são listas FIXAS de terreno -, e aí a única evidência de qual grupo o
  jogador tomou são as próprias magias concedidas. Daí o `grantedFor`: o grupo vencedor é o que
  explica mais magias da ficha somando escolhas casadas E concessões fixas. Sem nenhuma evidência,
  não se adivinha grupo algum.
- **Contra a dupla reivindicação:** o conjunto `explained` passou a ser MUTADO por cada chamada, na
  ordem espécie → talento → classe → subclasse, então uma magia já atribuída não é candidata de
  novo. E o filtro `accepts` corta, numa bag de classe, a magia que o ator atribui a OUTRA classe
  (`sourceItem`).
- **Resultado medido: as magias `prepared: 2` que sumiam foram de 81 a ZERO** nas 48 fichas.

## TC-0082 - Wild Companion (Druida) deriva Find Familiar como SEMPRE PREPARADA

- **Unidade:** `class:druid/*` (3 achados, Aoth L05/11/17). **Severidade:** polish.
  **Causa:** leitura do dado. **Encontrado:** 2026-07-27 (apareceu ao fechar o TC-0081, que
  destapou os extras do nosso lado). **Status:** open.
- O `additionalSpells` do Druida XPHB traz `{prepared: {1: [speak with animals], 2: [find
  familiar]}}`, e nós lemos o balde `prepared` como "sempre preparada". Mas a feature é o **Wild
  Companion**, cujo texto diz outra coisa: *"you can expend a spell slot or a use of Wild Shape to
  cast the Find Familiar spell"* - é permissão de CONJURAR, não uma magia preparada. O premade não
  a lista, e o SRD do dnd5e não a concede como item.
- Não é regressão e não afeta o Speak with Animals (esse é mesmo sempre preparado, nível 1).
- Caminho, quando valer a pena: é curadoria de UMA entrada, no espírito do
  `MISSING_ADDITIONAL_SPELLS`/`REGRADED_ADDITIONAL_SPELLS` (DDL-0038/0053) - um registro de
  concessão a REMOVER, que hoje não existe. Antes de criar o mecanismo, varrer o dataset para ver
  se há outros casos de "permissão de conjurar" codificada como `prepared`.

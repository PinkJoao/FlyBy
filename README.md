# FlyBy

A character builder for **D&D 5e (2024 rules)**. Mobile-first, runs in the browser, and keeps your characters saved locally.

## Features

- Manage multiple characters (create, duplicate, delete).
- Build a character across **Species**, **Background**, **Class** and more — with stats (ability scores, HP, saves, proficiencies) updating live as you choose.
- Rich pickers with search, filters and a detail preview (art, lore and full feature text) for every choice.
- Custom origin (no prepackaged backgrounds) and full **multiclassing**.
- **Export to/import from Foundry VTT** — download a dnd5e actor `.json` (with class, subclass,
  feats, proficiencies, HP, `ScaleValue` resource tables and tap-to-roll activities all set up)
  and import it back, including loading real Foundry premades for comparison/testing.
- **Inventory** — browse equipment grouped by type, equip, attune (with limit/prerequisite
  warnings), buy from a searchable shop, track currency and carried weight vs. capacity.
- Game content comes from the 5e.tools community and is cached for offline use.

## Roadmap

**Done**
1. Foundation - data layer (5e.tools content, offline cache), local storage, character roster.
2. Sheet shell - live derived stats (abilities, HP, saves), proficiencies card, tab navigation, portrait upload (file or web URL).
3. Species - traits, lore, racial choices and lineage sub-choices (e.g. Human Skillful/Versatile, Elf Keen Senses).
4. Background - ability boosts, origin feat, proficiencies and language.
5. Class - class, multiclass, subclass, level and skill proficiencies, with info and art in the preview. Feature progression view (unlocked or full 1-20) and the class table.
6. Class progression - per-level choices: feats / ability score increases, fighting style, expertise, weapon mastery. Feat prerequisites are shown and checked against the character (legacy feats count as general feats, with a free +1 bonus). A curated grants map surfaces a selector for **every class and subclass feature that requires a choice** (skills, tools, languages, expertise), including prose-only grants like Deft Explorer, Bard College of Lore or Battle Master's Student of War.
7. **Foundry VTT export & import** - a character exports as a **Foundry dnd5e actor `.json`** that **imports cleanly** (class, subclass, feats, proficiencies, abilities and HP all register), including `ScaleValue` resource tables and **tap-to-roll activities** for iconic features (Second Wind, Lay on Hands, Font of Magic, Channel Divinity, Wild Shape…). The importer reads actor JSON back into the builder's decisions, including real Foundry premades (for testing) and their lineage-naming/species-choice quirks. One **Export** button offers Foundry Actor (working) or PDF Sheet (mockup, not yet functional).
8. **Inventory** - browse equipment grouped by type (weapons, armor, tools, wondrous items…), sorted/sub-grouped, with search; equip and attune items (flat 3-item limit with prerequisite warnings); a **shop** to buy anything in the 5e.tools catalog — **including the ~2700 generated magic-item variants** (+1 Longsword, +1 Shield, Warhammer of Warning…) that 5e.tools builds from its generic-variant rules, with **weapon filters** (category, melee/ranged, property — Heavy, Light, Finesse, Firearm… — and mastery, so "Light weapons with Vex" is two clicks); a currency card (pp/gp/ep/sp/cp); and a carried-weight-vs-capacity readout.
9. **Equipment in the export** - inventory items export (and re-import) as Foundry `weapon`/`equipment`/`tool`/`loot` Items with **tap-to-roll weapon attack activities** and Active Effects (magic-weapon attack/damage bonus, magic-item AC/save bonuses, fighting-style and Unarmored Defense mechanics); AC recomputes from the equipped gear on round-trip.

10. **Spellbook** - a Spellbook tab modeled on the Inventory tab: spells split into **tabs by origin** (each caster class, plus racial and feat spells), with **spell-level categories** (Cantrips, 1st Level, …), group/sort/search, a **prepared-spells counter** and a **spell-slot / pact-slot / per-rest-use** display. A **"Prepare spell"** button opens the picker with the class's spell list **and** the spell circles you can actually prepare pre-selected as ordinary, removable filters (any other class or circle is one click away — for when the DM allows it — with a confirmation for off-list, over-limit or over-circle picks) and disables when there is nowhere left to put a spell; spells granted by a subclass, feat or lineage are always prepared and don't count toward the limit. Handles the Warlock's **Mystic Arcanum** and per-rest/per-day innate castings, and exports (and re-imports) everything as Foundry `spell` Items plus the actor's spell slots.
11. **Biography** - a Biography tab for the roleplay traits (personality, ideals, bonds, flaws), appearance and the physical descriptors (age, height, eyes, faith…); the character's story is written in the Background tab, right next to the origin choices it explains. Everything maps onto the Foundry actor's `details` block, in both directions.
12. **Rules glossary with inline links** - every rule mention inside any text the app renders (conditions like *Prone*, actions like *Dash*, senses, skills, weapon masteries/properties and the 2024 Rules Glossary terms) is a **tappable link** that opens a popup with the rule's full text — and references inside the popup are links too, stacking another popup on top. Mentions of **spells, items, feats, optional features, species, classes, languages, backgrounds and class features** are links as well, opening the same rich detail preview the pickers use (a feature citing *Eldritch Blast* or *Arcane Focus* is one tap from its full text). The **titles of the Class tab's choice selectors** (Weapon Mastery, Expertise, Eldritch Invocations…) are links too — tap one to read the feature you're choosing for. The rule list matches 5e.tools' own Rules Glossary across **every book (2024 DMG included)**, with 2014 reprints filtered out, and each rule is categorized (**Core / Optional / Variant / Variant Optional**). A **browsable Glossary** (first item in the menu, from the roster or a sheet) lets you search every one of those ~7800 rules and entities — **including every subclass**, and with classes carrying their full level 1–20 feature progression — through the same interface as the pickers (category/source filters in a side panel on desktop, a drawer on mobile), listing **core rules first**, then the play-reference terms (conditions, actions, skills…), then everything else. New players learn the rules from their own sheet.

**Planned**

The end goal is a sheet you can **play with at the table**: open the app on your phone, tap a skill, save or attack, and roll it — with every bonus already computed from your build. Getting there:

13. Wizard - step-by-step guided creation mode for new players (reuses the choice components).
14. PDF export *(working, polish pending)* - a printable character-sheet PDF via the Export menu's "Export PDF" option (in the builder **and** on each Home roster card). A **clean-room** layout drawn with `@react-pdf/renderer` (our own original sheet, not the copyrighted official one), lazy-loaded so it stays out of the main bundle. The sheet exports **filled**: identity (size and alignment spelled out), abilities/saves/skills (with proficiency marks), AC/HP/hit dice, weapon attack rows, class features with the **player's choices annotated** (weapon masteries, fighting style, invocations/metamagic, Divine/Primal Order, expertise, level feats), **species traits with their full descriptions** (structured paragraphs with bold headings; the font auto-fits to fill the card), feats (names only — the books stay the reference), spell pages (slots, DC/attack, prepared + granted spells — racial/feat spells carry their own DC; **more spells than the table holds add extra spell pages**) and equipment/coins. **Multiclass exports one sheet per class** in the same file; background, XP, current HP, spent hit dice and expended slot pips stay blank for play.
15. Testing & curation campaign *(in progress)* - certify the builder UI and the Foundry export for **every species, class and subclass** (then feats, spells and items) via an automated sweep harness (274 units, green) plus targeted review sessions. Strategy and status live in [TESTING-PLAN.md](TESTING-PLAN.md).
16. Play mode - a **separate, mobile-first interface** (opened per character) for running a character at an in-person table: roll skills, saves, attacks and damage; track HP, hit dice and resources during a session.

Along the way, the remaining features of the previous prototype (dnd-sheet) keep being ported and improved.

A short list of **known, deliberately deferred items** (real compendium UUIDs in the Foundry
export, PDF polish details, sidekick/UA classes, a possible legacy-content toggle…) is tracked
in [CLAUDE.md](CLAUDE.md) under "Known deferred backlog".

See [CHANGELOG.md](CHANGELOG.md) for a detailed, topic-by-topic development log.

## Development

```bash
npm install
npm run dev     # start
npm run test    # run tests
npm run build   # production build
```

## Data

Game content (species, classes, feats, items and so on) comes from the open-source **5e.tools** community project:

- **How it's obtained** - the app downloads the JSON data files at runtime from the community's public mirror, on first launch and whenever the local copy is stale or incomplete.
- **How it's stored** - everything is cached in your browser (IndexedDB), so the app opens instantly and works offline after the first load. Your characters live in the same local database and never leave your device.
- **What's in this repository** - only code. No game content is bundled, committed or redistributed here.

This project is **not affiliated with, endorsed by, or connected to 5e.tools** in any way. Huge thanks to the 5e.tools open-source community for the data files and the structure that make this app possible.

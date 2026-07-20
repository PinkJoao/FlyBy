# FlyBy

A character builder for **D&D 5e (2024 rules)**. Mobile-first, runs in the browser, and keeps your characters saved locally.

## Features

- **Guided character creation wizard** - a step-by-step, newcomer-friendly flow through every decision (species, class, background, abilities, equipment, features, spells), plus a lighter guide for filling in gaps after level-ups.
- Manage multiple characters (create, duplicate, delete), with live derived stats (ability scores, HP, saves, proficiencies) updating as you choose.
- Build a character across **Species**, **Background** (custom origins, no prepackaged ones) and **Class**, with full **multiclassing** and per-level choices (feats, ASIs, fighting style, expertise, weapon mastery), feat prerequisites checked automatically, and every choice-requiring feature surfaced with its own selector.
- Rich pickers with search, filters and a detail preview (art, lore and full feature text) for every choice.
- **Inventory & shop** - browse and equip gear, attune items (with limit/prerequisite warnings), buy from a searchable shop covering the full catalog (including generated magic-item variants) with weapon filters, plus a currency and carried-weight tracker.
- **Spellbook** - spells organized by origin (class, species, feats) with prepared-spell counters, spell/pact slots, a guided "Prepare spell" picker, and support for special cases like the Warlock's Mystic Arcanum.
- **Biography** tab for roleplay traits, appearance and physical descriptors.
- **Rules glossary** - every rule, spell, item, feat or feature mentioned in the app's text is a tappable link to its full description, plus a browsable glossary searching all ~7800 rules and entities.
- **Two-way Foundry VTT export/import** - download a ready-to-use Foundry dnd5e actor `.json` (class, subclass, feats, proficiencies, inventory, spells, resource tracking and tap-to-roll activities all set up) and import one back, including real Foundry premades.
- **PDF character sheet export** - a printable, filled-in sheet (abilities, skills, features, spells, equipment), with one sheet per class for multiclass characters.
- Game content comes from the 5e.tools community and is cached for offline use, so the app works without a backend and offline after first load.
- **Play mode (Planned)** - a mobile-first, at-the-table companion for running a character: tap to roll skills/saves/attacks/damage, track HP and resources during a session.
- **Testing & curation campaign (Work in Progress)** - an ongoing pass certifying the builder UI and Foundry export for every species, class and subclass, backed by an automated sweep harness.

See [CHANGELOG.md](CHANGELOG.md) for a detailed, topic-by-topic development log, and
[CLAUDE.md](CLAUDE.md) for architecture notes and the known, deliberately deferred backlog.

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

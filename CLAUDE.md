# CLAUDE.md — Shared working agreement & design-decision log

> **Read this file fully at the start of every session before doing any work.**
> It is the single source of truth shared across all chats/sessions (and people)
> working on this repository. The user frequently switches between chats, so
> decisions live here — not only in a chat history that may be lost.
>
> **Keep it updated.** Whenever a design decision, direction, or convention is
> made or changed, record it in the [Design Decision Log](#design-decision-log)
> below (dated, ADR-style) as part of the same change. When in doubt, over-record.

---

## 1. What this project is

A **D&D 5e (2024 / XPHB rules) character builder** — a React + Vite single-page
app. It reads 5e.tools content (fetched at runtime, cached offline in IndexedDB),
lets the user build a character through guided choices, and derives a live sheet
(abilities, HP, saves, proficiencies, features, spells…).

**End goal / north star:** export finished characters as **`.json` compatible with
Foundry VTT** (dnd5e system actor format), and eventually PDF. Every design choice
about "how do we represent a character's mechanics" should be made with the Foundry
export in mind — see [DDL-0001](#ddl-0001--effects--foundry-export-architecture).

This is the **successor** to an earlier project at `C:\Sync\Projects\dnd-sheet`
(features are being ported/improved from it).

---

## 2. Working agreement (process rules)

These are firm user preferences — follow them unless told otherwise:

1. **CHANGELOG on every change.** Document every meaningful change in
   `CHANGELOG.md` (it's a topic-by-topic dev log, not date-by-date).
2. **README on milestones.** Update `README.md` (esp. the roadmap) when we reach a
   significant milestone or a status changes.
3. **Claude commits; the user pushes/pulls.** Create a git commit whenever a set of
   modifications is finished. Do **not** push or pull — the user does that.
   - Commit messages carry **no `Co-Authored-By` line and no AI-authorship trailer** —
     commits are attributed solely to the user (their git author identity already is).
4. **Verify before claiming done.** Run the test suite (`npm run test`), `npm run
   lint`, and — for UI-observable changes — the browser preview, before saying
   something works.
5. **Record decisions here** (section 4) as you make them.

---

## 3. Orientation & reference material

### Codebase shape (where things live)
- `src/engine/` — **pure** rules engine (no network/DOM). Abilities, HP, saves,
  proficiencies, choices, prerequisites, class/subclass/species parsing, multiclass,
  optional features, feature effects. Heavily unit-tested (`*.test.js`, Vitest).
- `src/data/` — data layer: fetch, cache (IndexedDB), character repo, provider.
- `src/components/`, `src/pages/`, `src/selector/` — UI (builder tabs, selector
  panels, choice rendering).
- **Choice model:** user picks are stored in a recursive per-source "choice bag"
  (`{ [choiceId]: { kind, picks[], sub? } }`); the engine derives everything from
  the character's decisions. `deriveFromDb(character, db)` is the top derivation
  entry point; `ownedFromDb` computes what the sheet already has (for dedup).

### Reference material (now INSIDE the repo, git-ignored)
Some may still be downloading — verify a path exists before relying on it.

**The reference source material now lives INSIDE the project**, at `DnD Source Material/`
(project root), and **always will, on every machine** — the user keeps it in that same in-repo
location wherever they work, even though it is git-ignored. So resolve it as
`./DnD Source Material` relative to the project root; you can rely on it being there (no more
sibling-folder / two-machine path guessing). It is **git-ignored** (never committed or
redistributed — see DDL-0037 and the DDL-0003 licensing decision) and is used as a private,
read-only reference only. It was previously kept as a *sibling* of the project directory across
two machines (`../DnD Source Material`); that arrangement is **retired**.
**`DnD Source Material/README.md` documents all four subfolders** (contents, licences, and what
each is good for); read it before digging into them. The bullets below use the old
`C:\Sync\Projects\DnD Source Material\…` form for brevity — substitute the in-repo
`DnD Source Material/…` path.
- `C:\Sync\Projects\DnD Source Material\5etools Source Code` — 5e.tools source +
  **data** (`data/class/class-*.json`, `data/spells/`, etc.). The authoritative content the app
  consumes; read these to see the exact structure of a class/feature/spell.
- `C:\Sync\Projects\DnD Source Material\DnD 5e System Source Code` — the Foundry
  **dnd5e system** source (DataModels in `module/data/`, sample items in `packs/`).
  This is the **authoritative target schema** for the Foundry export.
- `C:\Sync\Projects\DnD Source Material\Plutonium Module Code` — the 5etools→Foundry
  importer. `js/` is **minified** (`Bundle.js`) — usable as a mapping reference only
  via search, not clean source.
- `C:\Sync\Projects\DnD Source Material\Character Sheets in JSON` — **real Foundry dnd5e
  actor exports** (`.json`). `Standard Premade Characters/` = official premades (schema
  ground truth); `Plutonium Made Player Characters/` (`lili/melina/ohma/throgan/etienne`) =
  the user's players; plus a hand-built `Level 6 Champion Fighter…`. **These are real
  input→output examples for the Foundry export** (`etienne.json` also backs the engine fixture
  `src/engine/fixtures/etienne.js`).
- `C:\Sync\Projects\dnd-sheet` — predecessor project (no Foundry export exists there).

---

## 4. Roadmap & action plan

Product roadmap lives in `README.md`. Status as of **2026-07-09**:
- Phases 1–5 done. **Phase 6 (class progression) done**: the choice **selectors** are
  complete (all class/subclass grants surfaced) and each pick now has a **mechanical
  representation** via the Foundry-Item model (features/feats → Items with advancement +
  Active Effects).
- **Phase B1 (Inventory tab) done — BOTH sides**: builder side (browse/equip/attune/shop/
  currency/encumbrance) **and** the Foundry-export side (inventory → `weapon`/`equipment`/
  `tool`/`loot` Items with weapon attack activities + item Active Effects, both directions —
  see CHANGELOG §11). This is README roadmap item 9 ("Equipment in the export"), now **done**.
  The only inventory piece deliberately deferred is real compendium UUIDs.
- **Phase A (Foundry export pipeline) — DONE & validated end-to-end.** The generated
  actor `.json` now **imports cleanly into Foundry (dnd5e 5.3.3)** with the class,
  subclass, feats, proficiencies and HP all registering correctly. The last blocker (a
  strict `DocumentUUIDField` rejecting a relative `uuid` on the class's Subclass
  advancement, which silently invalidated the whole class Item → "level 0, no class") is
  fixed; `hp.max` is exported as `null` so Foundry derives HP from the advancement. See
  DDL-0001 status, DDL-0005, and CHANGELOG §11.

**Impact assessment (2026-07-04):** the export needs **no reformulation** of existing
work. The "decisions-not-computed" architecture, the pure engine, the export-aware
schema (`isOriginalClass`→`details.originalClass`, `currency`, `inventory`, spell refs),
and the fully client-side storage (Dexie/IndexedDB, 5e.tools fetched at runtime, no
backend) all already support the goal. Remaining work is **additive**.

**North-star goal:** a Foundry-VTT-exportable digital sheet, **mobile-first but strongly
desktop-compatible**, running **entirely on the user's machine**, with a creation
**wizard** and an on-the-go **play mode** for in-person tables — with **no distribution
licensing problems** (ship code only; never bundle game data or Plutonium; see DDL-0003).

**Action plan (ordered):**
- **Phase A — Foundry export pipeline. ✅ DONE (validated end-to-end).**
  A1 class-item serializer (system + advancement[] + HitPoints.value + ItemChoice Fighting
  Style + applied Trait `value.chosen`). A2 feature/feat Items + curated Active-Effects
  registry, linked via ItemGrant. A3 species + origin/background Items (+ origin-feat
  ItemGrant). A4 full actor assembly → a real importable `.json`, **imported into Foundry
  and confirmed working**.
  - **A-remaining — DONE (2026-07-07)** except compendium UUIDs. ✅ **Foundry actor IMPORT**
    (reverse mapping, `foundryImport.js` — Foundry is the single import/export format both
    ways; premades import correctly for testing/comparison), including **lineage-name
    remapping** (official premades' abbreviated `"Elf, High"` form resolved against the real
    `_versions` name via a keyword match — see DDL-0005 area / CHANGELOG §11) and **species
    sub-choices back-fill** (Human Skillful/Versatile, Elf Keen Senses round-trip both ways).
    ✅ **`ScaleValue`** tables (class resource columns + a small curated map for prose-only
    scalings). ✅ **`uses`** (resource tracking) + feature-item dedup by name. ✅
    **`activities`**, all three batches (`foundryActivities.js`): simple self-consuming
    (Second Wind, Action Surge, Rage, Bardic Inspiration…), pool-consumption (Lay on Hands,
    Font of Magic) and multi-item cross-consumption (Sear Undead/Preserve Life spending the
    base Channel Divinity item's pool via `feat:<identifier>`), plus Wild Shape's `transform`
    activity and Turn Undead's target-facing Active Effect. ⏳ Still open: real compendium
    UUIDs (`compendiumSource`) — deliberately deferred, not planned near-term.
- **Phase B — content the sheet & export need.**
  - **B1 equipment/inventory — BUILDER SIDE DONE (2026-07-07).** The "Equipment" tab is now
    **Inventory**: browse (grouped by type into sub-tabs styled like Class's, sorted by
    name/rarity, sub-grouped by weapon category/kind or armor slot), equip, attune (flat
    limit of 3 + prerequisite warnings via the same `window.confirm` pattern as multiclass/
    feat-prereq checks), a **shop** (`EquipmentShop.jsx`, reusing `SelectorPanel` directly so
    it stays open across purchases, over the combined `items-base` + `items.json` catalog —
    `items.json`/`fluff-items.json` newly fetched, see `engine/items.js`), a currency card
    (`engine/currency.js`), and a carried-weight/capacity readout (`engine/attunement.js` for
    the limit check).
  - **B1 equipment/inventory — EXPORT SIDE DONE (2026-07-09).** Inventory entries now export
    (and re-import) as Foundry `weapon`/`equipment`/`tool`/`loot` Items with the right
    `system` shape (damage/range/properties, armor AC/dex-cap/stealth, price/weight/rarity/
    attunement), **tap-to-roll weapon attack activities** (`includeBase`, Foundry derives
    hit/damage), magic-weapon `magicalBonus`, and **item Active Effects** (magic-item AC/save
    bonuses as transfer effects; fighting-style + Unarmored Defense mechanics broadened in
    `foundryEffects.js`). AC recomputes from equipped gear on round-trip; verified live +
    18 tests in `foundryInventory.test.js`. See CHANGELOG §11. ⏳ Still open: real compendium
    UUIDs (shared with the whole export, deliberately deferred).
  - **B2 spellbook — ✅ DONE (2026-07-10). All five stages shipped** (B2.1 data layer → B2.2
    engine+schema v2 → B2.3 read-only tab → B2.4 prepare flow → B2.5 Foundry export/import),
    against the architecture and the user's 12 requirements fixed in DDL-0008. Delivers the
    Spellbook tab (origin sub-tabs, level categories, group/sort/search, slot & counter cards,
    SelectorPanel prepare flow with the class filter pre-marked), the lineage/subclass/feat
    granted spells, the Warlock's **Mystic Arcanum** (DDL-0010), honest/curated cast frequencies
    (DDL-0011) and the spell side of the Foundry export **both ways**. The next roadmap item is
    **Phase D — the creation wizard**.
- **Phase D — creation wizard** (guided step-by-step; reuses the choice components; the
  `/build/:id/wizard` route stub already exists). **Reprioritized before play mode — see
  DDL-0006.**
- **Phase E — PDF export** (a printable character-sheet PDF; the Export menu's "Export PDF"
  option). **A separate step from the wizard, and also before play mode — see DDL-0006.**
  **Status (2026-07-14): blank clean-room template DONE (both pages, standardized grid) and the
  FILLED export DONE (E1–E4)** — identity/abilities/skills/combat, weapon rows, feature/trait/
  feat names, spell pages and equipment/coins, with **one sheet per class for multiclass** and
  player-owned fields left blank (conventions in DDL-0016; log in CHANGELOG §22). Visual test
  mode: `npm run pdf:preview`. **E5 pass 1 DONE (2026-07-14):** size + alignment spelled out
  (size backed by the new species-size choice, DDL-0017), player choices annotated on the
  feature list (weapon masteries, fighting style, invocations/metamagic, Divine/Primal Order,
  expertise, level feats), racial/feat spell rows carry their own DC/attack (block falls back to
  a granted origin on non-caster sheets), species traits print full descriptions with an
  auto-shrinking font, and the Home roster's "Export PDF" is live. **E5 pass 2 DONE
  (2026-07-14):** species traits render as structured PARAGRAPHS (bold lead per trait AND per
  named sub-entry/list item — Aasimar's Celestial Revelation options each get their own line),
  the traits card picks the LARGEST font that fits (10→4 pt — traits never grow, so the box is
  used whole), and spell rows beyond page 2's table (31) emit EXTRA spell pages (page 1 does not
  repeat). Remaining: E5 polish (attack cantrips in the weapons table, overflow tuning for very
  long feature/equipment lists, portrait/appearance page niceties).
- **Phase T — testing & curation campaign** (NEW 2026-07-15, before play mode — see
  **DDL-0024** and **`TESTING-PLAN.md`**, the campaign's working context, to be read at the
  start of every testing session). Certify UI adequacy + Foundry export for EVERY species/
  class/subclass (then feats/spells/items later), via a 3-tier strategy: automated sweep
  harness (`npm run sweep`, stage T0) → Claude UI sessions at decision levels (T1) → user
  curation + real Foundry imports (T2). Status lives in `TESTING-PLAN.md` §7 +
  `testing/COVERAGE.md`. **T0 DONE (2026-07-15):** harness built; first full sweep green
  (256 rows, builder-side flawless); ten export/import round-trip gaps triaged as
  TC-0001…TC-0010 in `testing/ISSUES.md`. **T0 backlog BURNED DOWN (2026-07-16, DDL-0028):**
  all ten fixed; sweep 256/256 with zero diffs in `--strict`; next step is **T1a** (UI
  sessions per class).
- **Phase C — play mode / on-the-go** (mobile-first, **separate interface** — see DDL-0004).
  **Now comes AFTER the wizard and PDF export (DDL-0006).** C1 add mutable play-state to the
  schema (current/temp HP, spent hit dice, spell slots, resources, conditions, death saves,
  inspiration) + `schemaVersion` bump & migrate. C2 play UI: tap to roll skills/saves/attacks/
  damage; track HP/resources during a session.
- **Cross-cutting — legal/distribution:** keep all game content fetched client-side from the
  public 5e.tools mirror (we ship code only, never data); attribute SRD/CC where applicable.

### Known deferred backlog (tracked 2026-07-17, DDL-0030 — resolve later, deliberately)

The single list of things we KNOW are pending and have chosen not to do yet. Sessions should
not rediscover these; remove an item (and note where it was done) when it ships.

1. **Real compendium UUIDs** (`compendiumSource` on exported Items — DDL-0001/0005). The
   export works without them; adding them would link imported Items to the dnd5e compendium
   entries. Not planned near-term.
2. **E5 PDF polish**: attack cantrips in the weapons table, overflow tuning for very long
   feature/equipment lists, portrait/appearance page niceties (see §4 Phase E).
3. **Sidekick classes and UA content** (Mystic…): not curated in any registry
   (subclassGrants, featureOptions, hpBonuses) and not covered by the sweep matrix.
4. ~~**foundry-*.json overlay adoption** (DDL-0009)~~ — **DONE 2026-07-17 (DDL-0031,
   CHANGELOG §35)**: the overlay now backs `engine/foundryEffects.js` at runtime
   (`engine/foundryOverlay.js`), curated-first. Overlay `activities`/`system`/`advancement`
   blocks remain unadopted (effects only — see DDL-0031's out-of-scope note).
5. **High-level CREATE guide ordering** (DDL-0013 D2 note): creating a character directly at
   level N reuses the level-1 step order; the extra ASIs/feats surface via the fixup guide
   afterwards rather than as ordered wizard steps.
6. **Legacy-content toggle**: reprint-hidden content (Hill Dwarf PHB and every subrace of a
   reprinted base, Bladesinging TCE's weapon choice, Totem Warrior's SCAG options, Hobgoblin
   VGM / Weapon Master PHB weapon chooses…) is invisible by the latestOnly policy. If a
   "show legacy" switch ever ships, featureoption-internal grants (Totem Tiger) become real
   work again (see DDL-0030).

---

## 5. Foundry data model (reference — how import & derivation work)

Investigated 2026-07-04 from the real exports + the dnd5e system + the Plutonium
data. This is the mental model the Foundry export must target.

**A Foundry actor is a bundle of documents, not a computed sheet.** It holds an
`Actor` (base values + references) plus embedded `items[]` (class, subclass, race,
background, feat, spell, weapon, equipment…). Almost nothing is a "final number".

**Two interpreters run, at two different times:**
1. **Advancement system — at import / level-up (unfolds the recipe).** Class/
   subclass/race/background items carry an `advancement[]` array of typed steps:
   `HitPoints`, `Trait` (proficiency grants: saves/skills/weapons/armor/mastery),
   `ItemGrant` (auto-grant feature items per level), `AbilityScoreImprovement`,
   `ItemChoice` (e.g. Fighting Style), `Subclass`, `ScaleValue` (level→number tables
   like Second Wind uses / Sneak Attack dice). Foundry runs these to grant HP, create
   the feature/spell items, apply proficiencies, and prompt for choices. One-time,
   produces concrete stored data + items.
2. **Active Effects + calculators — at runtime (every sheet load / `prepareData`).**
   Each item can carry `effects[]`; each effect has `changes: [{key, mode, value}]`
   where `key` is a data path (`system.attributes.ac.bonus`, `system.traits.dr.value`,
   `system.bonuses.mwak.attack`, `flags.dnd5e.*`) and `mode` is 2=ADD, 5=OVERRIDE,
   4=UPGRADE, 3=DOWNGRADE, 1=MULTIPLY. These are declarative rules applied on top of
   base values. Then the system's calculators derive modifiers, save/skill totals,
   passive perception, AC, spell DC, HP max.

**Does Foundry store formulas? Some, declaratively — not the arithmetic.**
- **Stored:** Active-Effect changes (rules), ScaleValue tables, and **activity**
  configs on items — attack/damage/save. But even these lean on derivation: a weapon
  attack has `ability:""` + `damage.parts:[]` + `includeBase:true` (Foundry computes
  hit/damage from the weapon's base + your stats); a spell save uses
  `dc.calculation:"spellcasting"` (Foundry computes the DC). Custom bonuses/formulas
  are only stored when they deviate from the default.
- **Derived (never stored):** ability modifiers, save/skill totals, AC total, spell
  DC, HP max, passive scores.

**Where the mechanics data lives — and how Plutonium solves it.** 5e.tools content is
prose. **Plutonium keeps a curated overlay** in `Plutonium-Module/data/foundry-*.json`
(`foundry-feats`, `foundry-races`, `foundry-backgrounds`, `foundry-items`,
`foundry-optionalfeatures`, `foundry-psionics`) and `data/class/foundry.json`
(`class`/`subclass`/`classFeature`/`subclassFeature`). Each entry is keyed by
name+source and supplies only the **Foundry-specific mechanics that can't be derived
from prose** — Active Effects, ScaleValue tables, special advancement configs. Only
entries that need mechanics have a record (e.g. `foundry-feats.json` has ~51 of the
hundreds of feats; "Alert" carries the `flags.dnd5e.initiativeAlert` effect we saw in
a real export). The rest of each item (HitPoints/Trait/ItemGrant/ASI/Subclass
advancement) Plutonium **generates programmatically** from the structured 5e.tools
fields (`startingProficiencies`, `classFeatures`, `hd`…). So it is a hybrid:
generated skeleton + curated overlay.

**Implication for us (Option B):** we can **reuse the `foundry-*.json` overlay data** as our
mechanical repository, and generate the structured advancement skeleton from the same 5e.tools
fields we already parse — instead of inventing effect encodings. That collapses much of the
"case-by-case" work into "reuse curated data + generate the structured parts".
**Licence resolved (DDL-0009, 2026-07-09):** the overlay is *not* Plutonium's — it ships in the
MIT 5e.tools repo and every path returns 200 on our mirror, so it is fetchable at runtime like
any other data file.

## Design Decision Log

ADR-style. Newest first. Each entry: **date — title**, then Context / Decision /
Consequences. Append here whenever a direction is set or changed; never silently
overwrite a past decision — supersede it with a new dated entry.

### DDL-0050 — T1a Rogue session: `martialRequiresAnyProp` fecha o Weapon Mastery condicional (TC-0021); T1a de CLASSES concluída
**Resolve:** TC-0021 (a metade Rogue — o ÚNICO item aberto do ledger de testes). **Builds on:**
DDL-0033/TC-0021 (o registro `MASTERY_FILTERS` + a máquina `weaponFilterAllows`, cuja lacuna
condicional este entry preenche), DDL-0030 (o filtro plano de arma do Kensei que aquele registro
reusa).
**Date:** 2026-07-21

**Context.** T1a sessão 10 (Rogue + 10 subclasses, TESTING-PLAN §7 2026-07-21 (4)). O Rogue trazia
o único trabalho real conhecido pendente na campanha: seu Weapon Mastery restringe o pool com uma
regra CONDICIONAL — "Simple weapons and Martial weapons that have the Finesse or Light property" —
que o `weaponFilterAllows` (kind/noProps/allow, plano) não sabia expressar. Barbarian
(`{kind:'melee'}`, plano) já estava resolvido desde a sessão dele; o Rogue ficou explicitamente
adiado para esta sessão (TC-0021 PARTIAL).

**Decisions.**
- **`weaponFilterAllows` (`engine/choices.js`) ganhou `martialRequiresAnyProp`** (array de códigos
  de propriedade): armas SIMPLE passam sem restrição; armas MARTIAL só passam se tiverem AO MENOS
  UMA das propriedades listadas. Para o Rogue: `['F', 'L']` (F = Finesse, L = Light, códigos
  confirmados no items-base). É uma condicional sobre `weaponCategory`, não uma restrição plana —
  exatamente o que o campo `kind`/`noProps` não conseguia. Aplicado DEPOIS do `noProps`, então
  compõe com os outros campos se um filtro futuro precisar dos dois.
- **`MASTERY_FILTERS.rogue = { martialRequiresAnyProp: ['F', 'L'] }`** (`classFeatureChoices.js`).
  Barbarian permanece `{kind:'melee'}`; Fighter/Paladin/Ranger continuam sem entrada (irrestritos,
  DDL-0033). Como já era o padrão do registro, o filtro flui de graça pelos DOIS únicos consumidores
  que roteavam por `weaponFilterAllows` — o ChoiceList (kind `weapon`) e o `autoBuild` do sweep — sem
  nenhuma fiação nova. REGRA para uma classe futura com regra condicional de arma: estenda
  `weaponFilterAllows` com o predicado e declare-o no `MASTERY_FILTERS`; nunca ramifique por classe
  no ChoiceList.
- **O count do Weapon Mastery do Rogue é fixo em 2** (sem coluna na tabela; `weaponMasteryCount`
  devolve 2 em todos os níveis) — verificado ao vivo até 19.

**Consequences.**
- Cobertura: as 10 linhas `class:rogue/*` com `ui: ok`. Arcane Trickster (third-caster INT: slots
  1st×2, DC 10, 0/2 cantrips, 0/3 prepared @3; picker pré-filtrado à lista Wizard) e Mastermind
  (grants curados Master of Intrigue — tool restrito a 4 Gaming Sets + 2 languages) verificados ao
  vivo; as outras 8 pelo engine/sweep. **O ledger `testing/ISSUES.md` não tem mais itens abertos** e
  a etapa **T1a (todas as classes + subclasses) está CONCLUÍDA** — a próxima é **T1b (espécies +
  linhagens)**.
- Verificado ao vivo (Rogue: seletor de Weapon Mastery = 21 armas, todas simple + martial F/L; Rapier
  selecionável; "Longsword" = 0 resultados; "Staff"/"Wooden Staff" aparecem por serem simple, não
  regressão), 962 testes (+1 em `choices.test.js`), lint, sweep 274/274 `--strict`, mobile 375px sem
  overflow, zero erros de console. Ver CHANGELOG §58.

### DDL-0049 — Level-down reconcilia as magias preparadas (remove concessões da subclasse + poda por prioridade)
**Date:** 2026-07-21
**Builds on:** DDL-0008 (o colapso "preparada que também é concedida vira a cópia sempre-preparada"
— cuja interação criava a ressurgência), DDL-0026 (liberdade de over-prepare durante o jogo — que
esta reconciliação só rompe num level-down, a pedido do usuário), o precedente de
`cleanupClassEntry` (poda estrutural de escolhas/subclasse/mastery no level-down).

**Context.** Relato do usuário: um Paladin 2 com "Protection from Evil and Good" preparada sobe
pro 3, escolhe Devotion (que a concede sempre-preparada) e prepara outra magia no lugar do slot
liberado. Ao dar LEVEL-DOWN, a magia concedida RESSURGIA junto com o substituto, e nada era podado
quando os limites encolhiam. Raiz: `cls.spells` guarda a DECISÃO do jogador; a derivação apenas
ESCONDE (colapsa, DDL-0008) uma preparada que também é concedida — ela continua no array. Ao perder
a subclasse, deixa de ser escondida e volta a aparecer. E o level-down estrutural
(`cleanupClassEntry`) nunca tocava em `spells`.

**Decisions.**
- **Nova função pura `reconcileClassSpells(oldCls, newCls, db)`** (`engine/resolve.js`), chamada no
  `Builder.setClasses` para toda entrada de classe, DEPOIS do `cleanupClassEntry` (então `newCls`
  já tem o nível/subclasse finais). Devolve o novo array `spells` (o MESMO por referência quando
  nada muda, para o chamador pular a escrita).
- **Regra 1 — subclasse trocada/removida derruba as concessões da ANTIGA.** Quando
  `subclassId`/`subclassSource` mudam e havia subclasse, remove de `spells` toda magia que a
  subclasse antiga concedia como sempre-preparada (resolvida pela MESMA via da derivação —
  `resolveGranted`, incluindo as escolhas de magia do bag `sub:`). É o que quebra a ressurgência:
  a cópia manual colapsada some junto com a concessão; o substituto permanece. Vale em QUALQUER
  troca de subclasse (não só no level-down) — limpar/trocar a subclasse na aba Class também.
- **Regra 2 — a ORDEM DE APRENDIZADO é a ordem do array `spells`.** As magias são adicionadas ao
  FIM (SpellbookTab), então "mais recente" = fim do array; nenhum campo novo de schema é preciso.
- **Regra 2 (level-down) — poda por PRIORIDADE até caber nos limites do novo nível:** (a) magias
  cujo CÍRCULO o novo nível não alcança mais (Wizard 5→4 perde as de 3º), removidas
  incondicionalmente; (b) depois, as PREPARADAS e cantrips MAIS RECENTES (do fim) até a contagem
  não exceder o limite da origem. Concessões da classe/subclasse ATUAL colapsam mas NÃO contam nem
  são podadas; um arcanum válido do Warlock (círculo destravado acima do teto de slot) é preservado
  pela exceção da regra (a).
- **A poda por contagem só roda no LEVEL-DOWN** (não numa troca de subclasse a mesmo nível nem no
  jogo normal), preservando a liberdade de over-prepare do DDL-0026. Um EK/AT que perde a subclasse
  mantém suas magias guardadas (mostradas over-limit em vermelho) — voltam se a subclasse retornar.
- **Escopo:** wiring só no app (`Builder.setClasses`); o `sweep` continua usando `cleanupClassEntry`
  cru e não reconcilia magias (não é preciso para os invariantes dele).

**Consequences.**
- Um novo tipo de origem de magia ou uma nova concessão de subclasse entra na reconciliação sem
  fiação extra (a resolução reusa `resolveGranted`/`casterInfo`/limites já existentes).
- Verificado: 961 testes (+7 em `reconcileClassSpells.test.js` cobrindo subclasse removida,
  círculo alto demais, poda de preparadas/cantrips por recência, colapso da concessão atual, e o
  no-op por referência), lint. Ver CHANGELOG §57.

### DDL-0048 — QoL: guia sugere magia obtida em duplicidade; o preview do seletor trava no item já selecionado
**Date:** 2026-07-21
**Builds on:** DDL-0046 (o `exclude` da MESMA origem no picker do guia), DDL-0040/TC-0031 (o
filtro "Already Prepared" da origem CRUZADA), DDL-0011/B2.3 (o colapso prepared→always-prepared).
**Não altera** nenhuma decisão anterior — são dois acréscimos de qualidade de vida a pedido do
usuário, entre sessões da Phase T.

**Context.** Dois ajustes pequenos pedidos pelo usuário.
1. As sessões de Paladin/Ranger consolidaram como o app trata redundância de magias no MOMENTO
   de adicionar (esconde/avisa). Faltava a QoL inversa: quando o personagem JÁ tem uma magia
   sempre-preparada por uma via (subclasse etc.) e a obteve ANTES por outra (outra classe num
   multiclasse, ou um talento como Magic Initiate), o guia deveria CHAMAR ATENÇÃO — é incomum
   precisar da mesma magia por várias vias, e o guia é para novatos. Explicitamente só sugestão.
2. Nos seletores, ao reabrir o painel para substituir algo já escolhido, o item seguia marcado
   como selecionado, mas o PREVIEW não travava nele: mostrava o último item que passou pelo
   hover, em vez de voltar ao selecionado como acontece com um item clicado/fixado.

**Decisions.**
- **Sugestão de duplicidade = faixa informativa no guia, nunca bloqueio.** Novo helper puro
  `redundantPreparations(origins)` (`engine/spellcasting.js`): varre as origens e aponta cada
  magia que ≥1 origem CONCEDE (`alwaysPrepared`) e que aparece em ≥2 origens distintas — seja
  concedida por outra via (Magic Initiate + subclasse) ou preparada à mão numa outra classe.
  Retorna `{name, level, grantedFrom[], alsoFrom[]}`. Deliberadamente NÃO aponta magia meramente
  preparada à mão em duas classes sem nenhuma concessão (ambas custam slot e podem ser
  intencionais — atributos diferentes, DDL-0040). Componente `SpellRedundancyNotice.jsx` (faixa
  âmbar `.suggestion`, distinta do callout accent) montado no topo das telas de magia do guia,
  filtrando por círculo: CantripsStep = cantrip, SpellsStep = leveled, LevelUpSpellsStep = ambos.
  Complementa (não substitui) o `exclude` da mesma origem (DDL-0046) e o filtro "Already
  Prepared" da origem cruzada (DDL-0040), que agem ao ADICIONAR; a faixa fala de uma duplicidade
  que JÁ existe.
- **O item selecionado (`currentId`) trava o preview do seletor.** `SelectorPanel` ganhou
  `selectedRaw` (memo sobre a lista COMPLETA `items` + `currentId`) inserido na cadeia do
  preview: `hovered ?? detailItem ?? selectedRaw ?? lastHovered ?? results[0]`. Assim, reabrir o
  painel para substituir algo mostra o selecionado e volta a ele quando o mouse sai de um card —
  como um item clicado/fixado. Vem de `items` (não de `results`) para aparecer mesmo se um
  filtro/`exclude` o escondesse. Na 1ª escolha (`currentId` null) `selectedRaw` é null e o
  comportamento antigo (último hover) segue idêntico. Não toca em `detailItem` (a tela de detalhe
  do mobile fica intacta). Vale de graça para todo `PickerField` de valor único.

**Consequences.**
- Um novo picker de valor único com `currentId` ganha o lock automaticamente; um novo tipo de
  origem de magia entra na sugestão sem fiação extra (o helper varre `origins`).
- Verificado: 954 testes (+4 em `spellcasting.test.js` cobrindo os quatro ramos de
  `redundantPreparations`), lint, e passada ao vivo no seletor de espécie (preview trava no
  selecionado ao abrir, segue o hover, retorna ao selecionado ao sair). Ver CHANGELOG §56.

### DDL-0047 — T1a Ranger session: sessão limpa (zero achados); o fix do TC-0038 cobre o half-caster Ranger
**Date:** 2026-07-21
**Builds on:** DDL-0046 (o fix do TC-0038, aqui reconfirmado no Ranger), DDL-0029 (a linha
`ranger|gloom stalker` do `subclassGrants.js` — Iron Mind), DDL-0027 (a resolução de `_copy`
das subclasses legadas), DDL-0033 (Weapon Mastery irrestrito), DDL-0034 (caps de atributo).

**Context.** T1a sessão 9 (Ranger + 10 subclasses, TESTING-PLAN §7 2026-07-21 (3)). Terceiro
half-caster da campanha (após Paladin). Como a sessão do Monk (DDL-0044), foi uma sessão SEM
nenhum bug — nada foi corrigido. Registro breve para continuidade.

**Findings (todos verdes, zero mudanças de código).**
- **O TC-0038 (DDL-0046) cobre o Ranger de ponta a ponta.** Hunter's Mark (feature de classe
  2024, sempre preparada) e Disguise Self (Gloom Stalker @3) são excluídas por `exclude` DURO
  do picker "+ Choose a spell" do guia (mesma origem); Longstrider (Wood Elf @3, always-prepared
  de OUTRA origem) fica oculta pelo filtro "Already Prepared" pré-marcado e removível (o caso
  cruzado DDL-0040/TC-0031). Sem duplicatas nem colisão de key. O fix do Paladin não precisou de
  nenhuma adaptação para o chassi Ranger.
- **Iron Mind (Gloom Stalker @7) concede Wis save PLANO.** O Ranger base tem só Str/Dex, então
  a alternativa condicional Int/Cha do grant nunca dispara — `proficientSaves` = str/dex no L1,
  **str/dex/wis a partir do L7** (linha `ranger|gloom stalker` do `subclassGrants.js`, DDL-0029).
- **Primal Companion (Beast Master) é PROSA por design, não um selector faltante.** O texto
  "Choose Beast of the Land/Sea/Sky" é a escolha do stat block do COMPANHEIRO — uma criatura
  separada, não modelada como parte da derivação do personagem (igual Find Steed/Wild Shape). Os
  `{@creature}` renderizam como texto simples (inertes por DDL-0025). O autoBuild converge a zero
  pendências (nenhuma escolha travada). Sessões futuras não devem reportar como bug.
- **Subclasses `_copy` legadas derivam magias via TC-0027** (Horizon Walker/Monster Slayer/
  Swarmkeeper/Drakewarden); Fey Wanderer (skill choose @3) e Hunter (3 featureoptions) renderizam
  suas escolhas na UI; Beast Master/Hunter corretamente sem magias.
- **Nota de UX (não é bug):** na tela de Species, setar o atributo de conjuração da LINHAGEM
  antes de escolher a própria linhagem reseta o atributo — ele pertence à linhagem e re-deriva
  quando ela muda. No fluxo natural (linhagem primeiro) não acontece; auto-corrigível.

**Consequences.**
- Cobertura: as 10 linhas `class:ranger/*` com `ui: ok`. Nenhum TC novo; o único item aberto do
  ledger segue sendo a metade Rogue do TC-0021 (filtro condicional de Weapon Mastery).
- Sem alterações de engine → sweep permanece 274/274 `--strict` e a suíte 950 testes sem tocar.
  Ver CHANGELOG §55. **Próximo: T1a sessão 10 — ROGUE** (aqui a metade aberta do TC-0021 vira
  trabalho real: o pool de Weapon Mastery do Rogue precisa da semântica condicional "Simple, ou
  Martial com Finesse/Light" que o `weaponFilterAllows` ainda não expressa; Arcane Trickster é
  third-caster — checar os passos de magia @3/7).

### DDL-0046 — T1a Paladin session: o SpellPicker do guia exclui o que a própria origem SEMPRE concede (paridade com a SpellbookTab)
**Date:** 2026-07-21
**Resolve:** TC-0038. **Builds on:** DDL-0040/TC-0031 (`preparedElsewhere` = magias de OUTRA
origem; este fecha o lado da MESMA origem), DDL-0011/B2.3 (o colapso "preparada que também é
concedida vira a cópia sempre-preparada", cuja interação criava o duplo).

**Context.** Sessão T1a 8 (Paladin + 10 subclasses, TESTING-PLAN §7 2026-07-21 (2)). O half-caster
foi verificado de ponta a ponta — steps de magia (prepared até o 5º círculo), oath spells
concedidas (incl. as legacy `_copy` DMG/SCAG/XGE/TCE/FRHoF, TC-0027 reconfirmado; Noble Genies
FRHoF traz até o cantrip Elementalism), Channel Divinity, os caps do DDL-0034 (4×+Str saturam em
20, Boon of Irresistible Offense leva a 21) e o Weapon Mastery irrestrito do DDL-0033. Um único
achado.

**Decisions.**
- **O `exclude` do `SpellPicker.jsx` (guia de criação/level-up/fixup) inclui agora
  `origin.alwaysPrepared`**, além das `picks` da faixa. Antes, ele só escondia as ESCOLHIDAS,
  então as magias que a própria origem SEMPRE concede (oath / Paladin's Smite → Divine Smite /
  Faithful Steed → Find Steed) apareciam no picker e podiam ser adicionadas como prepared
  redundantes. A **SpellbookTab** já montava o `ownedNames` dela de `all` (prepared + arcanum +
  **alwaysPrepared**) — os dois fluxos divergiam; agora concordam.
- **Por que virava DUPLICATA (não só redundância):** uma magia que é escolhida E sempre-preparada
  COLAPSA na cópia concedida na derivação (B2.3), então `current`/`picks` nunca refletia a recém
  adicionada → dava para adicioná-la de novo (duas linhas "Aid" + erro de key do React, e linha
  órfã ao trocar o oath que a concedia). Excluir as `alwaysPrepared` na fonte quebra o ciclo.
- **`preparedElsewhere` continua sendo o caso CRUZADO** (exclui a própria origem por design — um
  Warlock 1/Cleric 1 PODE preparar a mesma magia nas duas por causa do atributo, DDL-0040). Este
  fix é só a MESMA origem: não há por que preparar de novo o que ela já dá sempre.
- **Correção auto-contida no componente:** os três callers (SpellsStep/CantripsStep/
  LevelUpSpellsStep) já passam a `origin` de `derived.spellcasting.origins`, que carrega
  `alwaysPrepared` — nenhum call site mudou. Regra p/ novos pickers de magia: derive o "já
  possuído" de prepared + arcanum + always-prepared, como a SpellbookTab.

**Consequences.**
- Cobertura: as 10 linhas `class:paladin/*` com `ui: ok`. Rep build Devotion (guided create
  Aasimar/Tough + overlay 1-3 + fixup 19); swaps Oathbreaker (DMG `_copy`) e Noble Genies (FRHoF,
  skill choose @3 + cantrip concedido) verificados ao vivo; as outras 7 pelo engine.
- Verificado ao vivo (Oathbreaker @19: "Hellish Rebuke" some do picker do guia; magias normais
  seguem listando; sem key-collision num build limpo), 950 testes, lint, sweep 274/274 `--strict`.
  Ver CHANGELOG §54. **Próximo: T1a sessão 9 — Ranger** (outro half-caster; o fix já cobre suas
  magias de conclave/companion).

### DDL-0045 — Defesa sem Armadura é um registro por-fórmula (classe/subclasse); Draconic Sorcerer entra; escudo é regra do candidato, não hardcode
**Date:** 2026-07-21
**Builds on:** DDL-0034 (armadura natural de espécie — flat/unarmored/bonus, que compartilham
o mesmo `deriveArmorClass`), DDL-0031 (precedência curado > overlay, que o efeito de export do
Draconic reusa). **Generaliza** o hardcode `if (!shield)` do Monk introduzido no primeiro slice
de CA (CHANGELOG §3).

**Context.** O usuário pediu, antes de retomar a Phase T, para verificar e melhorar a detecção
das features que definem a PRÓPRIA fórmula de CA (Barbarian/Monk Unarmored Defense; armadura
natural de espécie; e — explicitamente adiantado — a Draconic Sorcerer). Regra fixada por ele:
essas fórmulas NÃO se combinam entre si; escolhe-se a MAIOR CA respeitando a condição de cada
uma (o Monk perde a fórmula com escudo, o Barbarian não; idem por atributo). Verificação achou
os casos existentes já corretos (Monk/Barb com/sem escudo, natural armor competindo pela maior);
as lacunas eram a ausência de fórmulas de SUBCLASSE e o escudo estar hardcoded só no Monk.

**Decisions.**
- **Fórmulas de Defesa sem Armadura viram um registro curado** `UNARMORED_DEFENSE`
  (`engine/armorClass.js`), keyed por `classId` (+ `subclassId`/`minLevel` opcionais), cada uma
  com `abilities` (somadas a 10) e `allowsShield`. Barbarian `['dex','con']` shield OK; Monk
  `['dex','wis']` shield NÃO; **Sorcerer/Draconic** `['dex','cha']` shield OK, `minLevel:3`.
  Detecção é PURA (lê `ClassEntry.classId/subclassId/level`, sem db), como já era para
  barbarian/monk.
- **`allowsShield` é propriedade do CANDIDATO, não um `if` por classe.** Cada candidato de
  CA-base (armadura de item, base 10+Dex, cada fórmula, armadura natural) carrega `allowsShield`;
  com escudo equipado os candidatos que o proíbem são **filtrados ANTES do max**. Como a base
  10+Dex sempre permite escudo, o pool nunca fica vazio, e somar o escudo por cima do melhor é
  sempre RAW (todos os sobreviventes permitem escudo). Isso torna trivial qualquer fórmula futura
  com restrição própria de escudo/armadura.
- **Draconic Resilience é a versão XPHB 2024: `10 + Dex + Cha`** (a PHB 2014 era `13 + Dex`, fora
  do latestOnly do app). Nível 3 da subclasse. Export: entrada curada `'draconic resilience'` em
  `foundryEffects.js` = `ac.calc=custom` + `formula '10 + @abilities.dex.mod + @abilities.cha.mod'`
  (o calc `draconic` nativo do dnd5e é o 13+Dex de 2014, errado para 2024). O curado vence o
  overlay (DDL-0031) — um teste do overlay que usava Draconic Resilience como exemplo de
  roteamento foi movido para uma feature de subclasse sem curado.
- **Limitação de multiclasse no export é PRÉ-EXISTENTE e aceita:** o Foundry só tem UM `ac.calc`
  por ator, então barbarian+monk+draconic no export só materializam um; o SHEET AO VIVO é a fonte
  da verdade e escolhe a maior. Não é regressão desta mudança.

**Consequences.**
- **Próximo (adiantado pelo usuário para o mesmo padrão):** qualquer nova fórmula de CA de
  classe/subclasse/espécie é uma linha em `UNARMORED_DEFENSE` (ou `NATURAL_ARMOR`, DDL-0034). O
  usuário citou "algo similar para draconic sorcerer" — feito aqui; o mecanismo serve p/ outras.
- Verificado: 950 testes (+8), lint, sweep 274/274 `--strict`, e passada ao vivo no código servido
  (Draconic 3 =16 / +escudo 18 / nv2 =12; Monk/Barb =16 sem escudo, 15 com). Ver CHANGELOG §53.

### DDL-0044 — T1a Monk session: sessão limpa (zero achados); nota de harness sobre o badge ✦
**Date:** 2026-07-21
**Builds on:** DDL-0030 (a máquina `weaponProf`/`weaponFilter` do Kensei, aqui verificada ao
vivo), DDL-0002 (o tool mesclado artesão-OU-instrumento do Monk), DDL-0033/TC-0020 (a
sobreposição `basic`/`fixup` na contagem do badge), DDL-0029 (SUBCLASS_GRANTS).

**Context.** T1a sessão 7 (Monk + 10 subclasses, TESTING-PLAN §7 2026-07-21). Primeira sessão
da campanha SEM nenhum bug — nada foi corrigido porque nada quebrou. Registro breve para
continuidade + uma nota de harness que custou tempo desta sessão.

**Findings (todos verdes, zero mudanças de código).**
- **Kensei é o caso mais rico e está 100% correto ao vivo:** o `weaponFilter` do DDL-0030
  produz exatamente o RAW — @3 melee (simples/marcial melee, sem Heavy/Special), @3 ranged
  (Longbow liberado pela exceção `allow`, Heavy Crossbow/Net barrados), @6/11/17 qualquer tipo
  sem Heavy/Special. O tool do Kensei fica restrito a Calligrapher's/Painter's.
- **Grants e magias de subclasse derivam e renderizam:** Mercy (Insight/Medicine + Herbalism
  Kit no card de Proficiências), Elements (featureoption Elemental Epitome @17 com 5 opções +
  cantrip Elementalism no Spellbook), Shadow/Sun Soul (magias concedidas). O tool de classe do
  Monk continua sendo UM seletor de categorias mescladas (DDL-0002).
- **Nota de harness (não é decisão de produto, mas evita re-trabalho):** o número do badge ✦
  está no `title`/nome acessível do botão ("N choices left"), NÃO no `textContent` (que é só
  "⚛N"). Ler `textContent` por regex dá "vazio" e parece um bug de contagem — não é. Além
  disso, uma leitura do badge durante o boot-load do compêndio (db ainda carregando →
  `guidancePendencies` retorna 0) ou logo após uma mudança disparada por JS (sem re-render
  síncrono) lê 0 transitoriamente. Confira sempre pelo nome acessível (read_page) e após um
  reload estável. O badge em si está CORRETO (engine `fixupPendencyCount` = UI).

**Consequences.**
- Cobertura: as 10 linhas `class:monk/*` com `ui: ok`. Nenhum TC novo; o único item aberto do
  ledger segue sendo a metade Rogue do TC-0021 (filtro condicional de Weapon Mastery).
- Sem alterações de engine → o sweep permanece 274/274 `--strict` e a suíte 944 testes sem
  tocar. Ver CHANGELOG §52.

### DDL-0043 — T1a Fighter session: badge de arcanum segue o engine, bônus de CA de feature é registro curado
**Date:** 2026-07-20
**Builds on:** DDL-0010 (semântica de Mystic Arcanum — o badge agora a respeita), DDL-0026/0041
(over-limit sinalizado em vermelho, nunca escondido; picks sobrevivem a swaps), DDL-0029/0034
(o padrão de registro curado que o bônus de CA reusa), DDL-0040 (fluxos verificados nesta sessão).

**Context.** T1a sessão 6 (Fighter + 10 subclasses, TESTING-PLAN §7 2026-07-20 (3)). Três
achados reais, todos corrigidos em sessão (TC-0035/0036/0037 em `testing/ISSUES.md`).

**Decisions.**
- **O badge "Mystic Arcanum" da SpellbookTab deriva do ENGINE, não de aritmética própria da
  UI** (TC-0035): a linha só o mostra quando `origin.arcanumLevels` inclui o círculo da magia
  (a mesma classificação do resolve.js — vazia para não-pact). Antes, `level >
  maxPrepareLevel` marcava TODO pick órfão de um swap que removeu o casting (EK → Arcane
  Archer). Junto: os contadores Cantrips/Prepared também renderizam quando a CONTAGEM > 0
  mesmo com limite 0 — "12/0" vermelho, o over-limit DDL-0026 sinalizado. REGRA: componente
  não re-deriva semântica que o engine já expõe.
- **Picks órfãos com origem INEXISTENTE ficam dormentes — intencional.** Se a subclasse nova
  não concede nada (Champion), a origem de classe nem existe (`!info && granted.length === 0`)
  e os picks não aparecem em lugar nenhum até um swap de volta. É a semântica DDL-0041;
  sessões futuras não devem reportar como bug.
- **Bônus plano de CA de feature escolhida é registro curado** (TC-0036): `AC_BONUS_FEATURES`
  + `acFeatureBonuses(character)` em `engine/featureEffects.js` (o módulo já reservava o slot
  "bônus de CA" no header), dobrado sobre o resultado de `deriveArmorClass` no resolve.js com
  `requiresArmor` vs. o `hasArmor` derivado. Defense (+1 armado) é a única entrada hoje; um
  futuro feat de CA plano é uma linha. O export NÃO muda (o Active Effect do overlay/curado já
  cobria — o gap era só o sheet ao vivo).
- **"Caster" na tela de transição do guia = a CLASSE tem magias para preparar** (TC-0037):
  `FeaturesIntroStep` exige a origem com `uid` da classe e limite real — origens de
  talento/raça (Magic Initiate) não disparam mais "and which spells to prepare".
- **Rótulo do choose `mixed` descreve as alternativas** ("Skill or Language"), nunca o nome
  interno do kind (cosmético, Cavalier/Samurai).

**Consequences.**
- Cobertura: as 10 linhas `class:fighter/*` com `ui: ok`. Fluxos DDL-0040 (Already Prepared +
  categorias de feat) e caps DDL-0034 verificados de ponta a ponta no chassi Fighter/EK.
- Verificado: 944 testes (+4), lint, sweep 274/274 `--strict`, passada live completa
  (CHANGELOG §51).

### DDL-0042 — O ChoiceList DERIVA o que precisa; prop "encanada" só quando há um dono claro
**Date:** 2026-07-20
**Resolve:** TC-0034 (o único pendente aberto da sessão T1a Druid, DDL-0041). **Builds
on:** DDL-0040 (o fluxo "Already Prepared"), DDL-0032 (o precedente: o ChoiceList é o
choke point ÚNICO, e um recurso novo entra nele em vez de em cada tab/step).

**Context.** O fluxo DDL-0040 (filtro pré-marcado + badge + confirmação citando a
origem) valia na SpellbookTab e no SpellPicker do guia — ambos já recebiam `derived` —
mas não nos chooses de magia dos sub-bags de FEAT (Magic Initiate num slot de talento).
O TC-0034 foi registrado como "estrutural" por supor que a correção exigia passar
`origins` pelos SETE call sites do ChoiceList (ClassTab, SpeciesTab, BackgroundTab,
FeaturesStep, OriginFeatStep, ProficienciesStep, SpeciesStep).

**Decisions.**
- **O ChoiceList deriva o mapa ELE MESMO**, num `useMemo` sobre `(character, db)` que ele
  já recebe — zero mudanças nos call sites. O resultado desce como prop `spellsOwned`
  para o `SpellChoice` (entity com badge + `initialFilterState {owned: exclude}` +
  confirmação) e para a lista ANINHADA do sub-bag de talento, que por isso **nunca
  re-deriva**: uma derivação por tela, não uma por slot de feat.
- **O memo é PORTEIRADO pelo conteúdo da lista:** só deriva se houver um pool `spell`
  nesta lista ou um pool `feat` (cujo sub-bag pode conter um). As listas comuns de
  proficiência/feature não pagam nada. `feat` é o único pool que aninha ChoiceList hoje —
  se outro passar a aninhar, o porteiro precisa incluí-lo.
- **Nenhuma origem é excluída aqui** (ao contrário dos outros dois call sites, que
  excluem a origem sendo editada): os picks da própria escolha e os dos chooses irmãos já
  saem do seletor por `exclude` (TC-0025), e um grant FIXO da mesma entidade — o
  Prestidigitation do High Elf ao lado do cantrip choose dele — é justamente a
  redundância que o aviso deve pegar.
- **Regra geral:** quando um componente-choke-point já tem os INSUMOS (`character` + `db`)
  para derivar o que precisa, ele deriva (memoizado e porteirado) em vez de exigir que
  todo chamador saiba do recurso. Encanar por prop fica para quando há um dono claro do
  dado — como a lista aninhada aqui, que recebe pronto para não duplicar trabalho.

**Consequences.**
- Todo host de ChoiceList (tabs, wizard, overlay de level-up) ganhou o fluxo de graça,
  como aconteceu com os links de título no DDL-0032.
- Um novo picker dentro do ChoiceList que precise de estado derivado segue o mesmo
  caminho; não crie uma sétima prop nos call sites.
- Verificado ao vivo (Druid 1 + Magic Initiate (Druid): Speak with Animals escondido por
  padrão → badge ao desmarcar → confirmação "You already have Speak with Animals from
  Druid" → Cancel mantém 0/1, Add anyway grava), 940 testes, lint, sweep 274/274
  `--strict`. Ver CHANGELOG §50.

### DDL-0041 — T1a Druid session: idioma em prosa de subclasse é grant curado; item de kit que referencia ITEM GROUP vira choose de pool fechado
**Date:** 2026-07-20
**Builds on:** DDL-0029 (registro `SUBCLASS_GRANTS`), DDL-0038 (TC-0024, a máquina de kit
chooses que o fix reusa), DDL-0039 (TC-0027, cuja resolução de `_copy` esta sessão validou
nos stubs do druid), DDL-0040 (cujo fluxo "Already Prepared" foi verificado de ponta a
ponta — e cujo único buraco restante virou o TC-0034).

**Context.** T1a sessão 5 (Druid + 8 subclasses, TESTING-PLAN §7 2026-07-20). Dois bugs
reais corrigidos em sessão (TC-0032/0033) e um aberto (TC-0034) — ver `testing/ISSUES.md`.

**Decisions.**
- **Grant de IDIOMA em prosa de subclasse é uma linha do registro DDL-0029** (TC-0032):
  Speech of the Woods (Shepherd XGE) → `languages: ['Sylvan']` em `SUBCLASS_GRANTS`. A
  varredura curada de 2026-07-16 procurou fraseado de proficiência e não pegou idiomas —
  futuras sessões devem conferir o card de LANGUAGES por subclasse, não só armas/armadura.
- **Item de kit que referencia um ITEM GROUP é um kit CHOOSE de pool fechado** (TC-0033):
  `parseStartingEquipment` detecta o uid de grupo (`druidic focus|xphb`, `holy
  symbol|xphb` — só Druid/Cleric/Paladin XPHB no dataset) e emite `{type:'itemGroup',
  label, allow:[uids dos membros]}`, montado sobre a máquina inteira do TC-0024
  (EquipmentStep, completeness, `startingKitPicks`) sem nenhuma mudança nos consumidores.
  Antes, o inventário ganhava um item "unresolved" morto — inclusive na rep build da
  sessão Cleric, onde passou despercebido.
- **A contabilidade do prepared-collapse entre swaps de subclasse está CORRETA e é
  intencional**: trocar para uma subclasse que concede uma magia já preparada libera o
  slot (badge conta 1); trocar para fora a des-colapsa e o contador fica over-limit em
  VERMELHO sem nag (a liberdade DDL-0026). Sessões futuras não devem reportar isso como
  bug.
- **~~Aberto~~ (TC-0034, polish) — RESOLVIDO em 2026-07-20 (DDL-0042):** os pickers de
  magia dos sub-bags de FEAT (SpellChoice do ChoiceList, TC-0011) não recebiam o fluxo
  DDL-0040. Supunha-se exigir encanar as origins por todos os call sites; a solução foi
  o ChoiceList DERIVAR o mapa nele mesmo, sem tocar em nenhum call site.

**Consequences.**
- Um novo grant de idioma/perícia/etc. em prosa continua sendo uma linha de registro; um
  novo kit com referência de grupo Just Works (o choose emerge do dado).
- Verificado: 940 testes (+10), lint, sweep 274/274 `--strict`, passada live completa
  (CHANGELOG §49). Cobertura: as 8 linhas `class:druid/*` com `ui: ok`.

### DDL-0040 — Liberdade com aviso é o padrão dos pickers: categorias de feat e magias repetidas viram filtros pré-marcados
**Date:** 2026-07-19
**Resolves:** TC-0029 e TC-0031 (abertos na sessão T1a Cleric, DDL-0039). **Builds on:**
DDL-0026 (o precedente: recorte padrão = filtro pré-marcado removível + confirmação, nunca
esconder por regra dura).

**Context.** Decisão do usuário para os dois pendentes da sessão Cleric: o picker de ASI só
listava feats General (Tough/Lucky/Alert — Origem no XPHB 2024 — inescolhíveis, contra o RAW
"or another feat of your choice for which you qualify") e o de Epic Boon só EB; e os pickers
de magia oferecerem magias já sempre-preparadas de OUTRA origem sem aviso (mas esconder seria
errado: um Warlock 1/Cleric 1 pode legitimamente preparar Toll the Dead nas duas classes pela
diferença de atributo).

**Decisions.**
- **Slots de feat listam TODAS as categorias qualificáveis atrás de um filtro Category
  pré-marcado no padrão do slot** (ASI: lista G+O+EB, marca General; Epic Boon: lista
  EB+G+O, marca Epic Boon). `pool.extraCategories` no descriptor (engine), `opts.
  categoryFilter` na `makeFeatEntity` (filtro + badge Origin/Epic Boon nos cards),
  pré-marcação via `initialFilterState` no `FeatChoice`. Os avisos de pré-requisito são
  INTOCADOS e continuam confirmando (boon fora do 19 avisa pelo próprio prereq). O
  autoBuild segue sorteando só de `pool.category` — o sweep não muda com a decisão.
- **Magias já conhecidas em outra origem são um filtro "Already Prepared" pré-marcado como
  EXCLUDE + badge + confirmação citando a fonte** ("You already have Guidance from Magic
  Initiate. Prepare it anyway?"). `preparedElsewhere(origins, excludeKey)` em
  engine/spellcasting.js é a única fonte (nome→rótulo da origem); consumida pela
  SpellbookTab e pelo SpellPicker do guia (create/level-up/fixup, via a nova prop
  `origins`). Preparar em dobro segue permitido — é aviso, nunca bloqueio.
- **Regra geral reafirmada para futuros seletores:** recorte de conveniência = filtro
  pré-marcado removível; ato potencialmente indesejado = confirmação com o motivo;
  esconder por regra dura só quando a regra é inambígua (dedup da própria origem).

**Consequences.**
- Um novo slot de feat com categoria própria só precisa declarar `category` (padrão) +
  `extraCategories` (o resto qualificável); um novo picker de magia por origem passa
  `origins` ao SpellPicker e ganha o fluxo inteiro.
- Verificado ao vivo (Cleric 19 + Magic Initiate) + 930 testes + lint + sweep 274/274
  `--strict` (CHANGELOG §46).

### DDL-0039 — T1a Cleric session: `_copy` de subclasse resolvido, bônus de cantrip curado, expertise em perícias escolhidas
**Date:** 2026-07-19
**Builds on:** DDL-0024 (Phase T), DDL-0029 (registros curados de grants), DDL-0002/0013
(o caso Thaumaturge citado e nunca implementado). **Corrige uma premissa silenciosa** de
todo consumidor de `resolveSubclassObj` desde a Fase 6.

**Context.** T1a sessão 4 (Cleric + 19 subclasses, TESTING-PLAN §7 2026-07-19). Quatro
bugs reais (TC-0027/0028/0030 corrigidos em sessão; TC-0029/0031 abertos como decisão de
produto) — ver `testing/ISSUES.md`.

**Decisions.**
- **`resolveSubclassObj` resolve `_copy` (TC-0027).** Toda subclasse legada anexada à
  classe 2024 é um STUB `_copy` (só as `subclassFeatures` re-apontadas; o resto herda da
  original). O resolver preferia o stub NÃO expandido sempre que ele trazia features
  (todos os 19 domains do cleric) — as domain spells e os `{choose}` dentro de
  `additionalSpells` sumiam por inteiro. Agora a lista de subclasses é expandida por
  `resolveCopies` (memoizada por db via WeakMap, mesmo id shortName|source|classSource do
  seletor). REGRA para futuros consumidores: nunca ler `db['class-X'].subclass` cru para
  campos herdáveis — passe por `resolveSubclassObj`. O sweep NÃO detecta essa classe de
  bug (grant que não deriva → sem pendência, sem diff de round-trip).
- **"You know one extra cantrip" é registro curado** (TC-0028): `CANTRIP_BONUS_FEATURES`
  em `engine/featureEffects.js` (Thaumaturge/Cleric, Magician/Druid → +1), somado ao
  `cantripLimit` da origem da classe em resolve.js (só com base > 0). Cantrips de OUTRA
  lista (Acolyte of Nature, Arcane Initiate) NÃO entram aqui — são chooses de
  `additionalSpells` (mecanismo do TC-0027/TC-0011).
- **Perícias escolhidas COM expertise têm um flag de grant** (TC-0030): `expertise: true`
  num grant `skill` de `SUBCLASS_FEATURE_GRANTS` emite a escolha como kind `expertise`
  com `newProf` (pool = a lista fixa do grant, sem intersectar com proficientes; picks
  derivam nível 2 pelo caminho existente). Aplica às DUAS versões de Blessings of
  Knowledge (PHB/PSA e FRHoF). Junto: os domains PSA inlinam o texto de nível 1 numa
  feature GUARDA-CHUVA com o nome da subclasse — a chave do registro casa o guarda-chuva
  ('knowledge (psa)|knowledge domain (psa)') e o dedup do gerador passou a ser por CHAVE
  (o guarda-chuva existe nos dois anexos da classe, PHB@1 e XPHB@3, e emitia em dobro).
- **Abertos (needs-user-eyes):** TC-0029 — o picker de ASI é só categoria G e o de Epic
  Boon só EB; RAW ("or another feat of your choice for which you qualify") admite feats
  de Origem no ASI (Tough/Lucky/Alert são Origin no XPHB 2024) e G/O no boon. TC-0031 —
  pickers de magia oferecem magias já always-prepared de OUTRA origem (pick legal mas
  silenciosamente desperdiçado após o collapse do Spellbook).

**Consequences.**
- Todos os 73 stubs legados do dataset agora herdam `additionalSpells` e qualquer outro
  campo — as sessões T1a seguintes (Druid: Land/Moon…) devem ver as circle spells
  derivando; conferir com atenção (o Land tem spellSet por terreno).
- Um novo featureoption "+N cantrips" é uma linha em `CANTRIP_BONUS_FEATURES`; uma nova
  feature "perícia escolhida com expertise" é `expertise: true` no grant.
- Verificado: 928 testes (+6), lint, sweep 274/274 `--strict`, passada live completa
  (CHANGELOG §45). Cobertura: as 19 linhas `class:cleric/*` com `ui: ok`.

### DDL-0038 — T1a Bard session: proficiency tokens, kit equipmentType chooses, sibling-spell dedup, curated missing spell grants
**Date:** 2026-07-19
**Builds on:** DDL-0024 (Phase T), DDL-0029 (choice-kind completeness), DDL-0011 (curated
spell overlays), DDL-0037 (repairs its migration fallout).

**Context.** T1a session 3 (Bard + 10 subclasses, TESTING-PLAN §7 2026-07-18/19). The session
found four real bugs (TC-0023…TC-0026 in `testing/ISSUES.md`), all fixed in-session, plus the
first-run breakage left by the DDL-0037 migration.

**Decisions.**
- **Migration fallout (DDL-0037) is repaired**: `scripts/lib/loadDb.js` resolves the in-repo
  `./DnD Source Material` (not the retired sibling path); vitest excludes `DnD Source
  Material/**` (`vite.config.js` — the snapshot ships its own jest tests) and eslint
  global-ignores the folder (it ships its own flat config with unresolvable deps). Anyone
  adding tooling that walks the repo tree must remember the snapshot is a foreign codebase.
- **Countable proficiency tokens are choices** (TC-0023): `PROF_COUNT_TOKENS` in
  `engine/choices.js` turns `{anyMusicalInstrument: 3}` / `{anyStandard: 1}`-style entries
  into Choices with the SAME category-restricted pool shape the class tool choices use
  (`{type:'any', of, category}`), so ChoiceList/autoBuild/completeness/export all work with
  zero extra wiring. **Multi-entry proficiency fields are ALTERNATIVES** (5etools renders
  them joined by "or" — `_summariseProfs`): only the first entry that yields a choice emits
  one. The sweep can never catch this class of bug (an unparsed choice produces no pendency)
  — it is exactly what T1 sessions are for.
- **Kit `{equipmentType}` entries are kit CHOOSES** (TC-0024): `parseStartingEquipment`
  emits `chooses[]`; the guided EquipmentStep renders a per-choose item picker
  (`kitChooseAllows` matches INS / weapon category / SCF subtype), picks live in
  `meta.startingKitPicks` (additive meta field, no schema bump) and feed
  `startingKitInventory`; `kitStepComplete` gates the step via the createGuideContext ctx
  pattern. Bard XPHB is the only reachable case today; the type map covers the legacy kits.
- **Sibling spell chooses dedup** (TC-0025): ChoiceList passes each SpellChoice the other
  `spell`-kind picks of the same bag; selector + add guard exclude them (Magical
  Discoveries ×2 must be distinct). autoBuild deliberately keeps per-choice dedup only.
- **Missing prose grants are a curated registry** (TC-0026): `MISSING_ADDITIONAL_SPELLS`
  (`engine/grantedSpellUses.js`) holds spells the prose grants but `additionalSpells`
  omits (College of Spirits RHW → Guidance; the VRGR original had it, the reprint dropped
  it). `curatedAdditionalSpells` MERGES the entry into the FIRST group — never appends a
  group, because multiple groups are alternatives and would spawn a false `spellSet`
  choice (TC-0011 semantics). Applied in `resolveGranted`, so class/subclass/race/feat and
  the Foundry export all see it.

**Consequences.**
- A future feat/race with a token-counted proficiency, a kit with an equipment-type entry,
  or a reprint that drops a prose-granted spell each have a one-line home now.
- Verified: 920 tests (+12 since the Barbarian session), lint, sweep 274/274 `--strict`,
  full live pass (CHANGELOG §43). Coverage: all 10 `class:bard/*` rows `ui: ok`.

### DDL-0037 — Project migration: "FlyBy" repo, Firebase Hosting, in-repo (git-ignored) source material, tracked CLAUDE.md/.claude
**Date:** 2026-07-18
**Touches:** the §3 reference-material section (moved in-repo) and the §2 rule-3 commit-authorship
rule (one-time exception). **Does not change** any DDL-0003/0009 licensing decision.

**Context.** The project moved to a fresh repository under its own name, changed hosting provider,
and pulled its reference material inside the working tree. These are infrastructure facts sessions
must not re-derive.

**Decisions / facts.**
- **New repository.** The project now lives at **`github.com/PinkJoao/FlyBy`** (git remote
  `origin`), replacing the earlier repo. If the rename/migration turns out to have broken anything
  (paths, CI, deploy hooks, history), fix it when it surfaces — nothing is known broken yet.
- **Hosting: Firebase Hosting**, replacing the previous **Cloudflare (Pages / `*.pages.dev`)**
  deploy. Config is committed: `firebase.json` (SPA rewrite of `**` → `/index.html`, serving
  `dist/`) and `.firebaserc` (default project **`flyby-hub`**). Deploy is `npm run build` then
  `firebase deploy` — the **user runs deploys**, like pushes/pulls (§2 rule 3). No Cloudflare/
  wrangler config remains in the repo.
- **Reference material moved in-repo and git-ignored.** `DnD Source Material/` now sits at the
  project root (was a sibling across two machines — see §3) and is added to `.gitignore`, so it is
  never committed or redistributed (consistent with DDL-0003: ship code only). The user keeps it in
  this **same in-repo location on every machine**, so resolve it as `./DnD Source Material` and rely
  on it being there.
- **CLAUDE.md and `.claude/` config are now TRACKED** (removed from `.gitignore`) so the shared
  working agreement and project config travel with the repo — `.claude/settings.json` and
  `.claude/launch.json` are committed. **`.claude/settings.local.json` is deliberately NOT
  force-ignored** (matching the previous project's `.gitignore`, which never listed it) and is left
  **untracked/uncommitted** — it is a machine-local permission cache. Kept ignored: `.agents/`,
  `skills-lock.json`.
- **Commit-authorship: §2 rule 3 stands unchanged** (Claude adds **no** `Co-Authored-By` / AI
  trailer). **One-time exception, already spent:** the single commit that removed `CLAUDE.md` and
  `.claude` from `.gitignore` (bundled with these context updates) was allowed to carry Claude's
  co-authorship trailer. Every commit after it follows the no-co-authorship rule again.

**Consequences.**
- The reference paths in §3 resolve in-repo now; the two-machine sibling note is retired.
- A future contributor cloning the repo gets CLAUDE.md/`.claude` config but not the (licensed,
  bulky) source material — they must supply their own `DnD Source Material/` locally.

### DDL-0036 — Good-citizen data usage: attribution footer + incremental (SHA-diff) sync
**Date:** 2026-07-17
**Builds on:** the cross-cutting legal/distribution note (fetch client-side, ship code only,
attribute SRD/CC) and the DDL-0003/0009 licensing decisions. **Refines:** the boot/cache flow
(useDataEngine "Gatekeeper") without changing its cache-first contract.

**Context.** The user asked whether our heavy use of the 5e.tools GitHub mirror harms their
project, and wanted (a) a discreet attribution and (b) to download less — ideally only the
files that actually changed — to stay light even at scale.

**Findings (the impact question).** Financial impact on the 5e.tools team is ~nil: the files
are served by **GitHub's** infra (raw.githubusercontent.com / Fastly), free for public repos,
no bandwidth billing to the repo owner. Rate limits are per-client-IP (hit the consumer, not
them). The only real (indirect) vector is the mirror's DMCA fragility (`config.js` already
notes mirrors migrate on takedowns). We're already a light consumer (30-day IndexedDB cache,
no backend re-serving, no bundled data).

**Decisions.**
- **Attribution:** a discreet muted footer on Home crediting 5e.tools + SRD 5.2 (CC BY 4.0, ©
  WotC) with an unofficial-fan-tool disclaimer. Small, theme-aware, links open in a new tab.
- **Incremental sync — download only changed files (chosen over just bumping the TTL).** The
  ideal per-file HTTP conditional (`If-None-Match` → 304) is **impossible from a browser
  against the raw host** — verified empirically: raw.githubusercontent.com does NOT send
  `Access-Control-Expose-Headers` (JS can't read the ETag) and a custom `If-None-Match`
  triggers a CORS **preflight that 403s**. The browser's own HTTP-cache revalidation gives
  free 304s but doesn't survive the 30-day gap (eviction). So the only browser-viable "only
  what changed" mechanism is a **version check via the GitHub API**, which IS CORS-open and
  exposes each file's **git blob SHA** (a content hash). Rate limit 60/h is **per user IP**
  (scales per-user; we do ~5 calls per 30-day refresh).
  - **Shape:** `fetchRemoteShas` (fetcher.js) asks the Contents API once per used directory
    (data, data/class, data/spells, data/generated) for every file's SHA + the latest commit
    touching `data/`. `syncCompendium`: **fast-path** (unchanged `data/` commit + complete
    cache → 0 downloads) → **per-file diff** (fetch via raw only the changed/missing/unresolved
    SHAs, reuse the rest from cache) → **full-download fallback** when the API is unusable
    (mirror not github, rate-limited, offline). It is NEVER worse than the old full download.
  - **Persistence (cache.js):** the blob SHA rides on each `compendium` row as a **non-indexed
    `sha` field (no Dexie schema bump)**; the `data/` commit lives in `kv`. `writeCache` always
    persists the FULL merged set — the "incremental" is only in what gets DOWNLOADED, not how
    it's stored (a local IndexedDB rewrite is free). `forceCacheUpdate` clears SHAs+commit too,
    so a manual update is a guaranteed full re-download that also re-records SHAs.
  - **Repo binding:** the API repo is PARSED from the primary mirror (`githubRepoFromMirror`),
    so raw + API can't drift; a non-github mirror simply disables the SHA path (full download).
    Legacy caches (rows without `sha`) do one full download, then every later refresh is
    incremental — self-healing.

**Consequences.**
- Quiet 30-day windows cost ~5 API calls + 0 file bytes; a typical window where the mirror
  touched books we don't use still downloads only our 1–3 changed files instead of all 74.
- New external dependency on `api.github.com`, fully behind a graceful fallback — an API
  outage/limit degrades to today's behavior, not a failure.
- Anyone adding a mirror that isn't raw.githubusercontent.com gets the full-download path
  automatically (the SHA sync only activates for a parseable github raw mirror).
- Verified: 12 new tests + a live probe (all 74 SHAs resolve against the real repo; a
  1-stale-file diff downloads exactly one file); 908 total, lint, live boot. See CHANGELOG §41.

### DDL-0035 — SRD 5.2 tables in the glossary (srd52-flagged, ordered above non-core rules)
**Date:** 2026-07-17
**Builds on:** DDL-0025 (browsable glossary page), DDL-0027 (rules-first tier ordering),
DDL-0020 (RulePopup). **Partly supersedes:** DDL-0025's note that `{@table}` is inert because
"targets live in book/gendata, not tables.json" — the gendata tables are now loaded (though
`{@table}` INLINE links stay inert; only the browsable glossary consumes them).

**Context.** The user wanted the 2024 free-rules (SRD 5.2) reference tables from the PHB and
DMG browsable in the glossary — many carry useful rule descriptions/concepts — ordered just
above the optional/variant/other rules but below actions/conditions/etc.

**Decisions.**
- **`srd52: true` IS the filter.** 5etools marks each free-rules table with that flag in
  `generated/gendata-tables.json`; it's the exact machine encoding of "belongs to the free
  rules", so no hand-curated list. Of ~2300 book-extracted tables, 49 carry it (42 XPHB, 4
  XDMG, 3 XMM — the MM ones ride along because they too are SRD 5.2; the user named PHB/DMG but
  the operative criterion they gave was SRD 5.2 membership). `engine/glossary.js`
  `glossaryTables(db)` normalizes each into a rule-shaped entry (`{type:'table', name, source,
  entries:[{...table, type:'table'}]}`), display name = the clean `caption` ("Skills"), not the
  compound gendata `name` ("Skill List; Skills"). The table is the popup BODY (renderTable).
- **Load the whole gendata-tables.json at runtime, filter in the engine.** 2.8 MB (same order
  as items.json), fetched once per 30-day cache like everything else — consistent with DDL-0003
  ("fetch, never bundle") over hand-curating 49 tables into the repo. Only the 49 srd52 tables
  surface; the rest just sit cached. Manifest add followed the usual caution (verified 200; one
  404 breaks the whole Promise.all).
- **Ordering: a new tier between the game glossary and the other rules.** `glossaryIndex.js`
  `itemTier`: core rules (0) → game glossary [condition/status/disease/action/skill/sense] (1)
  → **tables (2)** → other rules [variant/optional/…] (3) → the rest (4). A "Table" category
  filter appears alphabetically (the filter list stays alphabetical per DDL-0027's amendment).
- **`{@table}` inline links stay inert.** Only the browsable glossary reads the tables; making
  inline `{@table}` tags live would risk dead links to the ~2250 non-loaded tables. Out of
  scope, not a gap.
- **renderTable gained `colLabelRows` + `footnotes` (general win).** EntryContent's table
  renderer previously dropped both; now multi-row headers (cells can be `{type:'cellHeader',
  width}` → colSpan — e.g. Travel Pace's "Distance Traveled Per…/Minute/Hour/Day") and
  footnotes render. Benefits every rendered table (spell/feature embedded tables too).

**Consequences.**
- A new free-rules table in the data Just Works (srd52 → it appears). A table that needs a
  richer header/footnote now renders it everywhere.
- The manifest carries one more heavy file; anyone trimming initial load should note only 57 KB
  of the 2.8 MB is ever surfaced (a future SRD-only slice could shrink it, but there's no such
  file upstream).
- Verified: 896 tests (+8), lint, live browser (Coin Values + Travel Pace popups, the Table
  filter/category). See CHANGELOG §40.

### DDL-0034 — Ability score cap (data-driven, backfilled) + species natural armor (three curated patterns)
**Date:** 2026-07-17
**Closes:** TC-0022 (DDL-0033's only open finding). **Builds on:** DDL-0028 (round-trip base
scores), DDL-0031 (foundry overlay), the DDL-0002/0029 curated-registry pattern.

**Context.** Two rules-accuracy asks: (1) feat/ASI ability increases must respect the RAW score
cap (regular 20; Epic Boons 30) — GWM+Sentinel were pushing Str past 20; (2) species that
define their own Armor Class in prose (Tortle, Autognome, Warforged — three DISTINCT patterns)
never derived an AC.

**Decisions — ability cap (TC-0022).**
- **The cap is DATA-DRIVEN.** 5etools encodes the ceiling: an `ability[].max` of 30 on every
  Epic Boon, absent = 20 (RAW). `finalScores` (engine/abilities.js) applies boosts SEQUENTIALLY,
  **lowest cap first** (regulars before boons), never exceeding a boost's own cap and never
  LOWERING a score already above it — so a hand-set high base is preserved, a regular feat
  empacado em 20 wastes the point, and a later Epic Boon still lifts 20→21. Order within a cap
  tier is irrelevant to the result.
- **The cap is BACKFILLED at derive time, not stored in the pick — single source = feat data.**
  A chosen boost's saved pick is only `{ability, amount}`. `resolve.withAbilityCaps` walks the
  feat sub-bags, reads each feat's `ability.max`, and injects `max` onto its ability picks on a
  CLONE (never mutates saved state; returns the same object when nothing needs patching). This
  is why it works for characters saved BEFORE the fix with no re-pick — the alternative
  (storing max in the pick via ChoiceList/autoBuild) was implemented then reverted precisely
  because it left legacy epic-boon picks capped at 20. Fixed feat boosts already read `max`
  through `fixedAbilityBoosts`→`deriveFeatAbilityBoosts`. `finalScores` called without the
  backfill (multiclass/prereq/proficiency, no db) defaults to cap 20 — correct there (those
  never involve boons and only test ≥ thresholds).
- **Round-trip: base scores now travel in `flags.builder5e.scores` on the actor.** Once the
  derived (capped) final can SATURATE, `base = final − Σamounts` (the DDL-0028 import) is no
  longer reversible without ambiguity. The lossless flag is the fix; flag-less actors
  (premades/Plutonium) keep the subtraction path. The oracle's `scores` check now reads the
  flag for our own characters — boost integrity is still guarded by the choice-bag comparison.

**Decisions — species natural armor.** Curated `engine/naturalArmor.js` (edition-strict, keyed
by resolved `Nome|FONTE`, CURRENT versions only — Tortle MPMM / Autognome AAG / Warforged EFA;
old TTP/ERLW are latestOnly-hidden), three patterns because the mechanics genuinely differ:
- **flat** (Tortle): base AC 17, Dex ignored, no body armor (shield still adds).
- **unarmored** (Autognome): 13 + Dex when unarmored — a candidate that COMPETES with class
  Unarmored Defense and 10+Dex; the highest wins (RAW: one AC formula at a time).
- **bonus** (Warforged): +1 to AC, armored or not.
`deriveArmorClass` (pure) takes the pattern (resolved in resolve.js, needs the db) and folds it
into a max-of-candidates base + shield + item bonuses + the flat bonus. **Foundry export uses
the SAME Active-Effect encoding as the overlay's `raceFeature`** (`ac.calc=custom`+`ac.formula`,
or `ac.bonus`), emitted from the curated registry — necessary because the overlay only has these
under OLD sources (Autognome AAG is the one edition the overlay covers; Tortle MPMM/Warforged
EFA are absent). `buildSpeciesItem` PRUNES the overlay's own `system.attributes.ac*` changes for
a race with curated natural armor, so Autognome doesn't double.

**Consequences.**
- A new score-capping rule needs nothing (data-driven); a new feat with an odd cap is just its
  `ability.max`. A new natural-armor species is one `NATURAL_ARMOR` line (+ its Foundry effect
  for free). Adding a per-weapon/other cap concept would reuse the same backfill shape.
- `withAbilityCaps` clones via `structuredClone` only when a patch is needed — cheap on the
  common (no-boon) path.
- Verified: 888 tests (+19), lint, sweep 274/274 `--strict`, live browser (Barbarian 19 Str
  now 20→21 via the boon without re-picking; end-to-end AC 17/13/15 + single AC effect each).
  See CHANGELOG §38.

### DDL-0033 — T1a Barbarian session: badge counts DECISIONS, per-class mastery filters, Storm Aura is a real choice
**Date:** 2026-07-17
**Builds on:** DDL-0024 (Phase T), DDL-0022 (✦ badge), DDL-0030 (`weaponFilter` machinery),
DDL-0002 (the options+refSubclassFeature "grant all" call).

**Context.** T1a session 2 (Barbarian + 10 subclasses, TESTING-PLAN §7 2026-07-17 (3)) found
three real bugs, all fixed in-session (TC-0019/0020/0021 in `testing/ISSUES.md`), and one open
product question (TC-0022).

**Decisions.**
- **The ✦ badge counts DECISIONS, not guide steps** (TC-0020). `fixupPendencyCount` sums
  `unfilledClassChoices()` + missing subclass + spells-to-fill per class; before, it counted
  `buildFixupSteps().length` (max 3), so a Barbarian 19 with 7 open choices said "1 choice
  left". DDL-0022's "tracks every required field" now extends to the NUMBER shown. (Known
  overlap, accepted: a proficiency-kind class choice like Primal Knowledge counts once in
  `basic` — the creation guide's proficiency step — and once in `fixup`.)
- **Weapon Mastery pools carry per-class restrictions** via a curated `MASTERY_FILTERS` map
  (`engine/classFeatureChoices.js`) feeding the DDL-0030 `weaponFilter` through ChoiceList
  (kind `weapon`, not just `weaponProf`) and the sweep's autoBuild. Barbarian XPHB =
  `{kind:'melee'}`. **Rogue's rule ("Simple, or Martial with Finesse/Light") needs a
  conditional semantics `weaponFilterAllows` doesn't have — deliberately deferred to the
  Rogue T1a session**; Fighter/Paladin/Ranger are unrestricted and stay filter-less.
- **Storm Herald's Storm Aura is a curated CHOOSE_ONE_FEATURES entry** (TC-0019): its
  `options`+`refSubclassFeature` block is a REAL choice (prose: "Choose desert, sea, or
  tundra"), unlike the grant-all family DDL-0002 identified — the curated set is exactly the
  mechanism for distinguishing them. Storm Soul@6/Raging Storm@14 follow the L3 pick and
  deliberately get no selector of their own.
- **Open (TC-0022, needs-user-eyes):** feat ability increases don't enforce the RAW score
  cap (20; boons 30) — GWM+Sentinel raised Str 19→22 before the Epic Boon. Whether to
  hard-cap, warn, or accept (DDL-0026-style freedom) is a pending product decision.

**Consequences.**
- A future class whose mastery text restricts kinds is one `MASTERY_FILTERS` line away; a
  prose "choose one of the following" subclass feature is one `CHOOSE_ONE_FEATURES` line.
- Badge numbers changed everywhere (they were understated whenever >1 choice shared a step).
- Small fixes riding along: SpeciesTab/ClassTab picker labels use the resolved/capitalized
  name (TC-0016's family); inline `{@table}` honors its display segment (NOT generalized to
  `{@filter}`); Spellbook dedups the Ritual chip when the grant's cast type is already
  Ritual; `t1-choices.js` prints a choice at first appearance (Giant's spellSet was hidden).
- Verified: 869 tests, lint, sweep 274/274 `--strict`, live pass. See CHANGELOG §37.

### DDL-0032 — Choice-title glossary links everywhere: kind-based rule fallback
**Date:** 2026-07-17
**Builds on:** DDL-0027 (choice titles → feature popup, Class tab only) and DDL-0020 (rule
popup infrastructure).

**Context.** The user asked to make the inline glossary present on the Species and Background
tabs like it is on the Class tab: the Size selector title should open the XPHB "Size" rule,
Background's "Skill Proficiencies"/"Tool Proficiencies" the Skill (XPHB)/Tool Proficiencies
(XGE) rules, and the "Ability Score Boosts" section title the "Ability Score and Modifier"
(XPHB) rule. All four targets verified to exist in the fetched glossary data.

**Decisions.**
- **A kind→rule fallback at ChoiceList's title render**, not per-tab wiring:
  `components/builder/choiceRules.js` maps a choice `kind` to the glossary rule that explains
  it (size/skill/expertise/save + resist/immune/vulnerable → XPHB; tool → Tool Proficiencies
  XGE), and `ChoiceList` renders `choice.ruleEntry ?? kindRuleEntry(db, kind)`. Precedence:
  the feature-specific `ruleEntry` (DDL-0027, from `buildClassChoices`) always wins; the kind
  rule only fills titles with none; no rule → plain text (never a dead link). Because
  ChoiceList is the single choke point, Species/Background tabs, feat sub-choices and all
  wizard steps got the links with zero per-site code — and the Class tab's starting "Skill
  Proficiencies" (which DDL-0027 left unlinked, having no granting feature) linked for free.
- **Deliberately unmapped kinds**: `language` (no glossary rule exists in the data);
  `weapon`/`weaponProf`/`feat`/`featureoption`/`optionalfeature` (always granted by a
  feature, which attaches the specific link); `spellAbility`/`spellSet`/`mixed` (ambiguous).
- **Section titles that are not choice descriptors** (Background's "Ability Score Boosts" h3)
  use `namedRuleEntry(db, 'Name|Source')` + a `.titleLink` style copying `.labelLink`'s
  dotted-underline affordance at the h3's inherited font.
- Like `classChoices`, the module lives in the COMPONENTS layer (needs the db + `glossaryFor`
  lookups) — never in the pure engine.

**Consequences.**
- A new choice kind that deserves a generic rule is one `KIND_RULES` line away; a kind whose
  choices always carry `feature` needs nothing (the specific link wins anyway).
- Verified: 866 tests (6 new), lint, live pass on both tabs + Class-tab precedence
  (Weapon Mastery still opens the class feature). See CHANGELOG §36.

### DDL-0031 — Foundry overlay adopted (effects only): curated-first, edition-strict, HP-changes dropped
**Date:** 2026-07-17
**Implements:** DDL-0009's follow-through (known-deferred-backlog item 4). **Builds on:**
DDL-0001 (Foundry-Item model), DDL-0029 (hpBonuses native HP export).

**Context.** DDL-0009 established that the `foundry-*.json` mechanics overlay is MIT 5e.tools
data, fetchable from our mirror — but we kept hand-curating `engine/foundryEffects.js`. The
user asked to resolve the backlog item before the next T1a session.

**Decisions.**
- **Scope: Active Effects ONLY.** The overlay also carries `activities`, `system` (uses) and
  `advancement` blocks; those stay unadopted — our curated `foundryActivities`/
  `foundryFeatureUses`/`foundryAdvancement` were validated against real premades and adopting
  the overlay's would be a much larger, riskier change with import-side implications. If ever
  wanted, it is a NEW decision, not an extension of this one.
- **Four files fetched** (all verified 200 on the mirror 2026-07-17, byte-equal to the local
  snapshot): `foundry-feats.json`, `foundry-races.json`, `foundry-optionalfeatures.json`,
  `class/foundry.json` (db key `foundry-class`). Per DDL-0009's caveats, `foundry-backgrounds`
  (404) and `foundry-psionics` (empty) stay out.
- **`engine/foundryOverlay.js`** (pure; WeakMap-per-db index) translates overlay → dnd5e:
  string `mode` → numeric; any-typed `value` → string (objects as JSON); **absent `transfer`
  = `false`** (the Plutonium converter's "on-use effect" semantics — NOT Foundry's schema
  default of true; ~half the dataset's effects rely on this); `type:"enchantment"` + riders
  skipped; change keys outside `system.`/`flags.` skipped; **`system.attributes.hp.bonuses.*`
  changes dropped** because max-HP already exports natively (DDL-0029 `hpBonuses.js`) and an
  AE would double it — this silently neutralizes Tough/Dwarven Toughness/Boon of Fortitude
  and halves Draconic Resilience to its AC part, all correct. Empty-after-filter effects die.
- **Precedence: curated wins, all-or-nothing per feature.** Any `foundryEffects.js` entry
  (changes OR target effect) suppresses the overlay for that feature — the curated registry
  is premade-validated and activity-referenced (`targetEffectId`). The overlay only fills
  features with no curated entry. Lookups are **edition-strict** (source must match; never
  PHB effects on an XPHB feature) with exact-level-then-lowest disambiguation for homonyms
  (Mystic Arcanum ×3, Expertise ×2).
- **Race traits attach to the RACE item** (we emit no per-trait items; a transfer effect on
  any embedded item reaches the actor), gated on the trait existing in the RESOLVED race's
  entries (a lineage/subrace that replaces a trait doesn't inherit its effect), looked up by
  merged name then `_baseName`. Featureoption items ("Divine Order: Thaumaturge") look up the
  OPTION name only — the parent feature's own item keeps the parent's effects, no doubling.

**Consequences.**
- ~250 features/feats/optional features/race traits now export official Active Effects (Rage's
  toggle with `@scale.barbarian.rage-damage`, Alert/Lucky flags, Halfling Luck, invocations…)
  with zero new curation; `foundryEffects.js` remains the override point when the overlay is
  wrong or missing (Unarmored Defense has NO overlay entry — curated still carries it).
- The import never reads `effects`, so the round-trip is untouched (sweep 274/274 `--strict`).
- A new curated entry in `foundryEffects.js` SILENCES the overlay for that feature — add one
  only with the overlay's content in view, or effects get lost, not merged.
- Anyone extending the manifest keeps the DDL-0009 caution: verify a path returns 200 before
  adding (one 404 breaks the whole fetch `Promise.all`).
- Verified: 860 tests, lint, sweep 274/274 `--strict`, real-data spot check + live browser
  pass. See CHANGELOG §35.

### DDL-0030 — Subraces as lineages, per-weapon proficiency (`weaponProf`), and the KNOWN DEFERRED BACKLOG
**Date:** 2026-07-17
**Builds on:** DDL-0029 (closes what remained of its out-of-scope notes), DDL-0005 (import name
resolution), DDL-0017/0018 (lineage machinery the subraces ride on).

**Context.** Three items from DDL-0029's out-of-scope list, tackled at the user's request before
T1a session 2: per-weapon proficiency choices (Kensei), grants inside featureoption OPTIONS
(Totem SCAG Tiger), and races that only exist as 5etools `subrace` entries (Hill Dwarf PHB,
Stensia PSI). Plus: record compendium UUIDs and E5 PDF polish as tracked known pendencies.

**Decisions.**
- **Subraces are LINEAGES of the base race** (`engine/speciesData.js`): `subraceVersions(db,
  race)` ports the 5etools merge (`Renderer.race._getMergedSubrace` — name join incl. the
  parenthesized-base form "Human (Innistrad; Stensia)", positional ability merge, entries
  append with `data.overwrite`, traitTags/languageProficiencies concat, skillProficiencies
  merge, rest Object.assign), memoized per db; `raceLineages(db, race)` = `_versions` variants
  + merged subraces, and is now THE lineage source everywhere (SpeciesTab/SpeciesStep,
  createGuideContext, lineage entity, resolveRaceObj, sweep matrix, Foundry import name
  resolution). Nameless subraces (mechanics-free in the dataset) and subraces with their own
  `reprintedAs` (ERLW marks) are skipped — same latestOnly semantics as everything else.
  Subraces of a REPRINTED base (Hill Dwarf PHB, PHB Elf/Tiefling subraces…) stay unreachable
  because the base isn't listed: that's the latestOnly POLICY, not a gap (they'd come back
  only with a hypothetical legacy-content toggle). Net effect: 18 new sweep rows (Genasi
  MPMM Air/Earth/Fire/Water, Human (Innistrad) ×4 incl. Stensia, Merfolk/Goblin/Vampire PSZ,
  Aven PSA, Elf (Kaladesh/Zendikar), Shifter EFA ×4, Half-Elf/Half-Orc PHB variants…), all
  green in `--strict`. Race fixed `weaponProficiencies`/`armorProficiencies` now also derive
  (autoProficiencies) — several subraces grant them.
- **Per-weapon proficiency is the `weaponProf` choice kind.** The ONLY reachable case is Monk
  Kensei (dataset-verified: Hobgoblin VGM, Weapon Master PHB and Bladesinging TCE are all
  reprint-hidden; Bladesinger FRHoF grants a blanket fixed prof instead). The Kensei registry
  entry (classFeatureChoices `SUBCLASS_FEATURE_GRANTS`) emits one melee + one ranged choice at
  3 and one any-type at 6/11/17 (grant-level gating via the new per-grant `level`; per-grant
  `tag` disambiguates ids). Pools carry a `weaponFilter` ({kind, noProps, allow}) enforced by
  `weaponFilterAllows` (engine/choices) in ChoiceList AND autoBuild — RAW-faithful: simple/
  martial, no Heavy/Special, Longbow explicitly allowed. Picks derive as proficient weapons
  (deriveFromDb → granted.weapons) and export natively: individual mundane weapon names map to
  dnd5e `weaponProf.value` ids via `KNOWN_WEAPON_NAMES` (lowercase-no-space convention, same as
  masteries — this also moved fixed grants like Bard Swords' Scimitar out of `custom`).
- **Grants inside featureoption OPTIONS: no reachable instance — documented, not built.** A
  full dataset scan found proficiency grants only in option-entries of features already covered
  by the registries (Tools of the Trade sub-entries etc.) and in Totem Warrior (PHB+SCAG
  additions) — which is reprint-hidden behind Wild Heart XPHB. Recorded in subclassGrants.js's
  header; becomes real work only if a legacy toggle ever ships.
- **KNOWN DEFERRED BACKLOG (tracked, deliberately later)** — see the roadmap subsection added
  in §4: real compendium UUIDs; E5 PDF polish; sidekick/UA classes; the optional foundry-*.json
  overlay adoption (DDL-0009); high-level-create guide ordering; legacy-content toggle.

**Consequences.**
- A new subrace in the data Just Works (it becomes a lineage row + sweep row automatically);
  a new per-weapon-prof feature is a registry entry away (`weaponProf` + `weaponFilter`).
- `raceLineages` needs the db — any new caller that only has the race object must be given the
  db too (the old `expandRaceVersions(race)` remains for pure `_versions` use).
- Verified: 842 tests, lint, sweep 274/274 `--strict`, live pass (Genasi Air lineage +
  Lightning resistance on the card; Kensei melee picker = 21 weapons no Heavy/ranged, ranged
  picker = 9 with Longbow present and Net/Heavy Crossbow absent; Longsword pick derives to the
  Proficiencies card). See CHANGELOG §34.

### DDL-0029 — Choice-kind completeness: spell/spellSet/resist/save/mixed kinds, fixed subclass grants, curated HP-max bonuses
**Date:** 2026-07-17
**Builds on:** DDL-0024/0028 (Phase T; closes the whole TC-0011…TC-0018 backlog — no open TC
issues remain). **Closes:** DDL-0002's deferred list (Monk artisan-OR-instrument, expertise pool
vs. auto-granted skills, conditional grants, saving-throw choices, FIXED subclass grants).

**Context.** The T1a Artificer session exposed a family of gaps: 5etools encodes choices/grants
that `parseChoices`/the derivation didn't recognize — spell chooses in `additionalSpells`
(TC-0011), fixed subclass proficiency grants in prose (TC-0012), structured `resist` chooses
(TC-0014) — plus two guided-UX calls (TC-0015 kit unequipped, TC-0017 featureoption verbosity).
The live pass added TC-0018 (prose HP-max increases inert: Tough didn't raise HP).

**Decisions (details per issue in `testing/ISSUES.md`; log in CHANGELOG §33).**
- **Spell chooses are Choice descriptors emitted AND consumed by `grantedSpells`** (single
  source: the same ids feed the UI, completeness, autoBuild and derivation). Multiple
  `additionalSpells` entries are ALTERNATIVES → a `spellSet` select gates which group grants
  (before, all groups merged — a latent bug); each `{choose}` leaf → a `spell` Choice whose pool
  is a filter expression or closed list, resolved by `spellChoosePredicate(pool, db)`. Picks
  live in the OWNING entity's bag (race/feat sub-bag; class bag with `class:`/`sub:` prefixes)
  and inherit the leaf's cast mode/frequency. `parseChoices` gained `{level, bag}` opts — bag is
  REQUIRED for spell choices (the active group and count gating depend on it); callers that
  render or check completeness must pass both.
- **Fixed subclass proficiency grants live in a curated registry** (`engine/subclassGrants.js`,
  full dataset sweep 2026-07-16/17), keyed `classId|shortName` with per-source disambiguation.
  Conditionals ("if you already have…") are LIVE choices generated against the character
  (`subclassConditionalChoices` → `sub:cond-*`), using the new `save` kind and the tool
  category-list pool. `ownedFromDb` dedups selectors against these grants; fixed EXPERTISE
  marks skill level 2. Out of scope, documented in the module: per-weapon proficiency (Kensei),
  grants inside featureoption OPTIONS, sidekicks/UA.
- **Damage traits derive from data, never from prose guesses** (`engine/damageTraits.js`):
  fixed string entries + chosen picks (`resist`/`immune`/`vulnerable` kinds, PILLS UI) +
  equipped/attuned items (kept separate — the actor exports only character-own traits in
  `traits.dr/di/dv`; items carry their own transfer Active Effect). Prose-conditional object
  entries stay prose.
- **HP-max increases are a curated closed set** (`engine/hpBonuses.js`: Tough, Boon of
  Fortitude, Dwarven Toughness, Draconic Resilience). Export: per-character-level rates →
  native `hp.bonuses.level`; flat + per-class-level → `hp.bonuses.overall`; the import
  SUBTRACTS the re-derivable part so `hpBonus` stays the player's manual adjustment.
- **Guided kit auto-equips armor and weapons** (`startingKitInventory(option, db)`); the
  featureoption cards COLLAPSE unchosen options to name-only once the choice is complete.

**Consequences.**
- New kinds (`spell`, `spellSet`, `resist`/`immune`/`vulnerable`, `save`, `mixed`) ride the
  existing bag/flag machinery — they reach export/import via DDL-0028's residual flags with no
  extra wiring, and the sweep guards them (256/256 `--strict` after the batch; 831 tests).
- Anyone adding a subclass with prose grants must extend `SUBCLASS_GRANTS` (fixed) or
  `SUBCLASS_FEATURE_GRANTS` (choices); a new HP-affecting feat goes in `engine/hpBonuses.js`.
  These registries are deliberate curation points — the sweep can't invent them.
- `parseChoices(entity)` without opts still works (shallow/legacy use), but spell chooses then
  see `level=Infinity, bag=null` — fine for "does it have choices", wrong for granting; always
  pass `{level, bag}` where picks matter.

### DDL-0028 — Foundry round-trip completeness: native encodings + `flags.builder5e.choices`
**Date:** 2026-07-16
**Builds on:** DDL-0024 (Phase T; closes the whole TC-0001…TC-0010 backlog), DDL-0001/0005
(export architecture). **Supersedes in part:** DDL-0017's "the import does not back-fill the
size pick" note — it now does (the old sweep waiver is retired).

**Context.** The T0 sweep's round-trip oracle (`foundryToCharacter ∘ assembleFoundryActor`)
had triaged ten gap families (TC-0001…TC-0010, `testing/ISSUES.md`): choices that exported
nothing (featureoptions, optional features), import reconstruction misses (feat sub-bags,
class tool/expertise/grants, species spellAbility, parenthesized race names) and two encoding
drifts (weapon-mastery pick format, lossy tool/language key codes). In strict mode the full
matrix showed 932 real diffs.

**Decision — two-tier encoding policy.**
- **Foundry-NATIVE wherever Foundry has a slot** (these also make the actor correct inside
  Foundry, not just round-trippable): `featureoption` picks → `"<Feature>: <Option>"` feat
  Items (the premades' own encoding; the existing `featureOptionChoiceBag` import needed no
  change); optional features → feat Items with dnd5e subtypes (they were absent before);
  only plain `feat@<level>` slots feed the class ItemChoice/ASI advancement (Champion's
  `sub:feat@…` style stays out); exact-name race resolution (bases + `_versions`) before the
  lineage keyword heuristic; plain weapon names (the UI's canonical pick format); reversible
  full-slug fallback for tool/language codes (canonical multi-word names added to
  `TOOL_TO_FVTT` — the old first-word truncation reversed "Hand Drum" into "Hand Crossbow").
- **`flags.builder5e.choices` on the OWNING Item where Foundry has no slot:** feat Items
  carry their sub-bag; the race Item carries `spellAbility-N`/`size-N`/mixed pools; the
  class Item carries the residual bag (`residualClassChoices`: tool@start/expertise/curated
  prose grants/`sub:` grants/optional-feature picks). Foundry ignores the namespaced flag;
  flag-less actors (premades/Plutonium) still take the native paths, incl. a new
  optional-feature name-match fallback. The flag is deliberately NOT a whole-character dump:
  everything with a native representation stays native so the sweep keeps testing it.
- **Guard-rails:** the species Item's Trait/ASI use SHALLOW picks only, and the import only
  back-fills a species proficiency entry when `parseChoices(raceObj)` offers that choice
  (ability deliberately un-gated — a race-item ASI belongs to the race, and legacy actors
  need it for score reconstruction). The oracle now also compares base `scores`, so a
  lost/doubled boost anywhere (including inside feat flags) fails the row.

**Consequences.**
- Sweep: **256/256 with ZERO diffs in `--strict`**; `KNOWN_ISSUES`/`WAIVERS` are empty —
  any new round-trip diff fails its row. New `npm run sweep -- --strict` flag is the
  burn-down measuring stick.
- Anyone adding a NEW choice kind must give it a home: native if Foundry can express it,
  otherwise the owning Item's `flags.builder5e.choices` — and the sweep will catch it if
  they forget. Verified: 793 tests, lint, strict sweep clean (CHANGELOG §27).

### DDL-0027 — Glossary rule completeness: gendata rules, ruleType categories, rules-first order, linked choice titles
**Date:** 2026-07-16
**Builds on:** DDL-0019/0020 (rules glossary), DDL-0025/0026 (browsable glossary page/panel).

**Context.** Four user asks (2026-07-16): XDMG rules were missing from the glossary; confirm
2014 reprints are excluded; categorize rules (core/optional/variant/variant optional) as the
usual mini-tags; reorder the glossary panel rules-first. Plus: the Class tab's choice selector
titles (Weapon Mastery, Expertise…) should open the granting feature's text like a glossary link.

**Findings & decisions.**
- **The XDMG rules live in `data/generated/gendata-variantrules.json`, not `variantrules.json`.**
  5etools' Rules Glossary page concatenates both files (see `DataUtil.variantrule.loadJSON`);
  the gendata file has the 13 book-extracted rules (9 XDMG). Added to `buildManifest` (verified
  200) and merged into `buildGlossary`. With it our rule list equals 5etools' Rules Glossary tab.
- **Reprints:** same-name reprints already collapsed, but RENAMED reprints (PHB "Use an Object"
  → XPHB "Utilize") showed both. `glossaryEntries` (browsable list) now applies latestOnly
  semantics (drops `reprintedAs` carriers); the lookup INDEX deliberately stays complete so
  legacy prose citing the old source still resolves. `pickBySource` gained the xdmg/dmg rungs.
- **Categories:** normalized entries keep `ruleType`; `ruleCategoryLabel(entry)` (single source,
  engine/glossary) maps C/O/V/VO → Core/Optional/Variant/Variant Optional Rule (absent →
  "Rule"). Used by BOTH the RulePopup badge and the glossary panel categories. The labels are
  data-faithful: 5etools tags the XDMG sections as `C`, so Firearms is a "Core Rule" there too.
- **Order:** `CATEGORY_ORDER` is now rules-first per the user's spec: Core Rule → Condition/
  Status/Disease/Action/Skill/Sense → Optional/Variant/Variant Optional/Rule → Weapon
  Property/Mastery → entities.
- **Choice titles → popup (the easier of the two options the user offered; no scroll-to).**
  Descriptors carry `feature: {name, level, subclass?}` (pure engine data, set by every
  generator that stems from a real feature; starting proficiencies have none). The resolution
  to a `ruleEntry` happens in `buildClassChoices` (components layer) through `lookupEntityLink`
  — the SAME path an inline `{@classFeature}` tag takes, exact level first then name-only
  fallback (optionalfeatureProgression names don't always carry the feature's level). ChoiceList
  renders the title as a link-styled button → `showRulePopup`; no match degrades to plain text.
  The wizard steps reuse the same builder, so they got the links for free.

**Consequences.**
- Adding any future gendata file follows the same manifest caution (verify 200 first).
- A choice selector whose title should link but doesn't = its generator didn't set `feature`,
  or the name doesn't match a classFeature/subclassFeature — check `choiceRuleEntry`'s fallback
  before suspecting the popup. Verified live + 786 tests + lint + sweep 256/256 (CHANGELOG §31).

**Amendment (2026-07-16, CHANGELOG §32) — filter vs. display categories split.** The five rule
labels made the glossary FILTERS unintuitive, so filter membership is now decoupled from the
display label: `ruleFilterCategories(entry)` (engine/glossary, beside `ruleCategoryLabel`) gives
each rule its filter chips — every rule joins **"Rule"** (that chip = ALL rules) and a **Variant
Optional** rule joins **both** "Variant Rule" and "Optional Rule" (deliberate double count). There
is **no "Variant Optional Rule" filter**; the card/popup BADGE still shows it (display unchanged).
The glossary entity's `filterValues.category` = the entry's `filterCategories` array. Separately,
the **filter chip list is alphabetical again** — the rules-first `CATEGORY_ORDER` now applies ONLY
to the panel's ITEM order (a tier function in `buildIndex`: Core → game glossary [Condition/Status/
Disease/Action/Skill/Sense, alphabetical by name, no category grouping] → other rules → the rest
[alphabetical by name, no grouping]); `CATEGORY_ORDER` itself was retired. So DDL-0027's "categories
badge and ordering" now means: BADGE keeps the five labels; the FILTER LIST is alphabetical with
four rule options; the ITEM order is the rules-first tiering above.

### DDL-0026 — Glossary rides the SelectorPanel; chunked selector rendering; spell scoping via filters
**Date:** 2026-07-16
**Builds on:** DDL-0025 (glossary page), DDL-0008 (Spellbook R10/R11). **Supersedes in part:**
DDL-0013 D2.10's "the wizard spell picker comes LOCKED to the class list and level" — the lock is
now pre-marked, removable filters + confirmation (below).

**Context.** Four user asks (2026-07-16): (1) the glossary page should reuse the selector's
filter UX (desktop left panel with Clear + filter search; mobile drawer) instead of its own
chip-row layout; (2) subclasses were missing from the glossary index; (3) glossary CLASS entries
should show the full 1–20 feature progression (like the subclass selector preview) — but NOT in
the class selector; (4) the shop lagged since the ~2700 generated variants landed; (5) the spell
prepare/pick panels hard-hid off-class/off-circle spells — the scoping must be normal, removable
filters (DM permission cases), like items/feats.

**Decisions.**
- **`SelectorPanel` gained a `noPreview` mode** (+ `heading`/`hint` props): no preview column or
  mobile detail screen; tapping a card calls `onSelect(raw)` directly. `GlossaryOverlay` is now a
  thin wrapper: a "glossary entity" whose items are the `glossaryIndex` entries, with Category
  (fixed) + Source (derived) filters; `onSelect` routes to `showDetailPopup`/`showRulePopup` on
  the DDL-0007 stack (Esc guard unchanged). One layout to maintain; the glossary inherited the
  drawer/filter-search/clear for free. Its module CSS was deleted.
- **Index additions:** subclasses (per class, via the SAME `makeSubclassEntity` the selector
  uses — a glossary hit and the selector always agree), new "Subclass" category; and a
  `glossaryClassEntity` wrapping the class entity whose `entries` append "Level N: Feature"
  blocks from `classFeatureLevels`. Deliberately glossary-only — the class SELECTOR stays lean.
- **Chunked rendering in SelectorPanel** (fixes the shop AND keeps the glossary's 7800 entries
  viable): `RENDER_CHUNK` (120) cards + sentinel `<li>` + IntersectionObserver (root = results
  scroller) growing the window; reset on refinement via render-adjust — **NOT on `results`
  identity**, because the shop's `exclude` closure changes on every cart tap and would snap the
  scroll to the top. Plus a module-level `WeakMap` card cache keyed by the precomputed item
  wrapper (`entity.card` runs once per item — the shop's calls `itemValue`, derived pricing).
  The glossary's old 200-row cap died with its bespoke list.
- **Spell scoping = pre-marked filters + confirm, in BOTH flows** (SpellbookTab prepare and the
  guide's SpellPicker): `exclude` only dedups owned spells; the **Level filter comes pre-marked**
  on the buckets with room (Cantrip if space, 1..maxPrepareLevel if space, free arcanum circles)
  next to the pre-marked Class filter — the default view is IDENTICAL to the old hard-hidden one,
  but every chip is removable. Adding outside the default confirms with the reasons (off-list =
  the old R10; full buckets with the counts; no slots/arcanum of the circle; the guide adds
  off-step-range). R11's disabled button when everything is full stands.

**Consequences.**
- Every selector (class/species/feat/spell/item/shop/glossary) now renders at most ~120 cards +
  a growing window; any future huge catalog is covered. If a selector ever needs "scroll resets
  when results change," don't — see the exclude-churn note above.
- A player can over-prepare past the limits after confirming; the counters already render
  over-limit in red (`statOver`). This is intended freedom, not a bug.
- Verified live (desktop + mobile) + 776 tests + lint. See CHANGELOG §30.

### DDL-0025 — Entity links (glossary v2), generated magic-item variants, weapon filters
**Date:** 2026-07-16
**Builds on:** DDL-0020 (ships its v2 backlog), DDL-0021 (reuses `showDetailPopup`), DDL-0007
(dialog stack).

**Context.** Mid-Phase-T, the user requested three things: (1) extend the rules-glossary links to
EVERYTHING resolvable — features citing spells ({@spell}), items ({@item} — Artificer features,
Improved Pact Weapon…), feats etc. should be tappable like rules; (2) the item shop was missing
the whole class of generic/specific magic variants (+1 Shield, +1 Warhammer, every Weapon of
Warning…); (3) weapon filters (property: heavy/light/ranged/firearm…; mastery: Vex…) in the shop.

**Decisions.**
- **Entity links.** New pure `components/common/entityLinks.js` (per-db WeakMap index, like
  `glossaryFor`): `{@spell}/{@item}/{@feat}/{@optfeature}/{@race}/{@class}/{@language}` open the
  entity's EXISTING `DetailView` via `showDetailPopup` — a link and its selector always agree;
  `{@background}/{@classFeature}/{@subclassFeature}` (no selector entity) open the rule popup with
  new type badges. `classFeature`/`subclassFeature` have their own pipe grammar (name|class|
  classSource|level|source[|display] and the subclass variant) resolved against the class's own db
  file. `{@item}` also resolves **itemGroups** ("Arcane Focus") into a popup listing the members as
  nested {@item} links. Everything stacks on the DDL-0007 dialog store. Still inert on purpose
  (data not fetched / nothing to show): creature, deity, table (targets live in book/gendata, not
  `tables.json`), quickref, card/deck, hazard/trap/object/vehicle, subclass — but their display
  segments now print correctly, and `{@dc}`/`{@hit}` render "DC 15"/"+5".
- **Magic variants.** `magicvariants.json` added to the manifest (verified 200);
  **`engine/magicVariants.js`** ports the 5etools specific-variant generation (requires/excludes
  matching, edition matrix, inherits merge, `{=…}` templates, `[[…]]` value expressions,
  `{#itemEntry}`+`{{getFullImmRes …}}` dereference). Only CURRENT variants generate (every classic
  one is reprinted — dataset-verified), over `latestOnly` base items, never shadowing a real
  catalog item; publication fields (esp. `reprintedAs`) never propagate or `latestOnly` would hide
  the result. 2701 items in ~80 ms, memoized per db. `resolveItemObj` (and the import's
  `resolveInventorySource`) fall back to the generated set, so inventory, derivation, attunement,
  prices (rarity-derived, base cost via the inherited `baseItem` uid) and the **Foundry export
  round-trip** all work unchanged.
- **Filters.** Item entity: Weapon Category, Melee/Ranged, Weapon Property (incl. the `firearm`
  flag), Weapon Mastery — empty values on non-weapons, so an active weapon filter excludes them;
  the weapon (mastery) entity gained the Property filter. Names come from the static
  `PROPERTY_NAMES` map (+`Vst`) because `precompute` has no db.

**Browsable glossary page (added same day, closes the v2 backlog).** A **"Glossary"** entry —
first item in BOTH hamburger menus (Home + sheet) — opens a full-screen search interface over
EVERYTHING the app can explain. `components/common/glossaryIndex.js` (memoized per db) unifies the
glossary rules (`engine/glossary.js` `glossaryEntries` + `GLOSSARY_TYPE_LABELS`), the entity types
(reusing the exported `SIMPLE_TAGS`, each labelled) and every class/subclass feature (walked from
`class-*.json`, collapsed by name+class+subclass preferring the 2024 edition) — ~7700 entries in 19
categories. `GlossaryOverlay` (mounted in App via `store/glossaryStore.js`) is a portal panel:
search + category filter chips + results capped at 200 rendered rows; a row opens the SAME preview
the inline link would (`showDetailPopup`/`showRulePopup`) on the DDL-0007 stack, so it layers above
the glossary and nested links keep working. Esc-to-close guards on `dialogStore` (a popup on top
gets the Esc, not the glossary). 9 tests (`glossaryIndex.test.js`).

**Consequences.**
- The shop sells ~2700 more items; anything referencing them (inventory, export, links) resolves
  through the same single `resolveItemObj` chain. A future 5etools schema change in
  `magicvariants.json` surfaces in `magicVariants.test.js` first.
- Every EntryContent consumer got the entity links for free; PDF and Foundry export untouched.
- **DDL-0020's "v2 backlog" is now DONE in full** (entity links + browsable glossary page).
- Verified: 774 tests, lint clean, sweep 256/256, live browser pass (shop variants + Light+Vex
  filters + stacked spell/item popups from Warlock's Pact Magic + the glossary page, desktop &
  mobile). See CHANGELOG §23 (v2), §28 (shop) and §29 (glossary page).

### DDL-0024 — Phase T (testing & curation campaign) before play mode; plan lives in TESTING-PLAN.md
**Date:** 2026-07-15

**Context.** The project is nearing its end state. Before Phase C (play mode), the user wants an
extensive testing/curation pass guaranteeing the app is adequate — selectors, inputs, previews,
derivation — for **every species (incl. lineages), class and subclass and all their features**,
then the **Foundry export** for the same units, and only later the same for feats/spells/items.
Testing everything at all 20 levels by hand is impossible, so the process needs strategy, methods
and scripts, plus Claude-driven verification sessions.

**Decision.**
- The campaign is **Phase T**, inserted in the work order between Phase E (PDF) and Phase C
  (play mode). Scope order: **T1 species/classes/subclasses UI → T2 their export → T3
  feats/spells/items (later; do not drift into it early)**.
- The full strategy, tooling design, session protocol and live status are fixed in
  **`TESTING-PLAN.md`** (project root) — the session-context document for the campaign, kept
  updated at the end of every testing session (its §7 is the hand-off). Summary of the
  architecture decided there:
  - **Tier 0 — automated sweep** (`npm run sweep`, vite-node + the local sibling data snapshot,
    same loader precedent as `scripts/render-pdf-preview.jsx`): enumerate the whole matrix
    data-driven (`latestOnly`), auto-build characters with seeded random picks through the SAME
    deep-completeness machinery the app uses (DDL-0018/0022), and assert invariants — derivation
    never throws (levels 1–20), auto-fill converges to zero pendencies (a stuck choice = a
    missing-selector bug, the DDL-0002 "Problem 1" class, caught mechanically), no dead refs, and
    the export both deep-scans clean AND **round-trips** (`foundryToCharacter ∘ assembleFoundryActor`
    = identity modulo an explicit waiver list, e.g. DDL-0017's size pick).
  - **Tier 1 — Claude UI sessions** in the browser preview, sampled at each class's **decision
    levels** (emitted by the sweep), one class + its subclasses per session, species in batches;
    fixed per-unit checklist; "fix small, log big".
  - **Tier 2 — user curation** (`needs-user-eyes` flags) + **real Foundry milestone imports** of
    sweep-generated actors (structural checks can't see Foundry's runtime).
  - Trackers committed under `testing/`: `COVERAGE.md` (single source of truth of what's done),
    `ISSUES.md` (numbered `TC-` findings ledger), `report.json` (last sweep).
- Same-day, unrelated: the app logo became `public/logo.svg` (PNG deleted, favicon updated) and
  the Home header shows the logo left of the FlyBy title — size adjustable at
  `Home.module.css` `.brandLogo` (CHANGELOG §26).

**Consequences.**
- Next actionable step is **stage T0** (build the harness); UI sessions only start once the
  sweep's first backlog is burned down — script-detectable bugs must never consume Tier-1 time.
- Like the old `RULES-GLOSSARY-PLAN.md`, `TESTING-PLAN.md` is a living plan file; when the
  campaign ends it should be folded back into CLAUDE.md/CHANGELOG and removed.

### DDL-0023 — UI polish: per-slot picker key, and square filter button via `1lh`
**Date:** 2026-07-15

**Context.** A batch of four UI fixes (CHANGELOG §25). Two carry non-obvious technical decisions
worth recording so they aren't reintroduced the wrong way.

**Decisions.**
- **The class `PickerField` is keyed by the slot's `uid`** (`ClassTab.jsx`). `PickerField` guards
  its auto-open with an internal `didAuto` ref (open the selector once on mount). Without a per-slot
  key, React reuses ONE `PickerField` instance across multiclass sub-tabs, so `didAuto` stays true
  after the first add and the selector never re-opens — a 3rd+ multiclass, an add after a remove, or
  an add after cancelling once all showed an empty "New class" tab with no picker. `key={c.uid}`
  gives each slot a fresh instance → the selector auto-opens every add; the existing `onClose` (which
  discards a still-empty freshly-added slot) makes "cancel = no-op". **Do not** try to "fix" this by
  resetting the ref manually — the key is the correct React-idiomatic solution.
- **The desktop filter search (🔍) button is a `calc(1lh + 12px)` square with `line-height: inherit`**
  (`SelectorPanel.module.css` `.filterSearchBtn`), NOT `aspect-ratio` + `align-self: stretch`. Two
  facts make this work: the app's line-height is an inherited absolute length (`:root font:
  18px/145%` → 26.1px) and `* { box-sizing: border-box }`, so the sibling "Clear" text button is
  `1lh + padding(10) + border(2)` tall. Matching that with a fixed square: (a) `line-height: inherit`
  is REQUIRED — a bare `<button>`'s UA `font` shorthand resets line-height to `normal`, so `1lh`
  would stop matching Clear (the button drops to ~32 px instead of 38.09). (b) `aspect-ratio` is
  **ignored on a flex item whose cross size is stretched**, which is why the square must be sized
  explicitly rather than via stretch + ratio. This tracks Clear's height even when Clear is hidden.

**Consequences.** Both patterns are load-bearing on subtle CSS/React behavior; the inline comments
spell out the "why". The other two §25 fixes (fixed-square roleplay buttons; biography inputs on
`--bg-soft`) are ordinary and need no DDL.

### DDL-0022 — The ✦ button tracks EVERY required field; guidance is per-character; Standard Array is the guided default
**Date:** 2026-07-15
**Builds on / partly supersedes:** DDL-0015 (the ✦ button was class-decisions-only; now it also
covers the creation basics) and DDL-0012 (guidance was a single GLOBAL preference; the button/overlay
are now gated per-character). DDL-0018's deep-completeness flags are reused wholesale.

**Context.** The pendency button (✦) only appeared for class decisions (`fixupPendencyCount`). If the
player finished creation and then emptied the **background ability boosts** — or cleared species,
class, a proficiency, or any nested sub-choice — the button stayed hidden and never nagged. The user
wants the button visible while the sheet has ANY required, non-biographical field unfilled (only story
/alignment/name/portrait excepted). Two smaller asks came with it: Standard Array as the default
ability method in the guide (was Manual), and a "Just the sheet" character starting with guidance
turned off.

**Decisions.**
- **One comprehensive pendency source.** `components/wizard/guidancePendencies.js`
  (`guidancePendencies(db, character, derived) → { basic, fixup, total }`) is the single truth for the
  badge. It reuses DDL-0018's `createGuideContext` flags (`speciesComplete`, `originFeatComplete`,
  `proficienciesComplete`) plus `hasClass`, and the now-**exported** `scoresTouched`/`boostsComplete`
  from `engine/wizardSteps`, and adds the class `fixupPendencyCount`. Lives in the components layer (it
  needs the `db`), never in the pure engine.
- **Two buckets, two targets.** `basic` = the creation steps the light overlay can't fill
  (species/class/origin feat/proficiencies/abilities/boosts) → the button opens the **full creation
  guide at its Review screen** (`WizardPage` reads `location.state.atReview` → `Wizard initialIndex`),
  whose jump-back list is the fastest way to a single gap. `fixup` = class decisions (subclass/
  features/spells) → the light `LevelUpWizard` overlay, as before. A character with both opens the
  creation guide (it covers class features/spells too).
- **Starting equipment is NOT a pendency.** Its only completion signal is `meta.startingKit`, set
  solely by the guided Equipment step, so counting it would nag every manually-equipped character
  forever. It remains a step inside the creation guide's Review (so the badge count, e.g. 6, can be
  one less than the guide's own "N steps need a choice") — an accepted, documented scope difference.
- **Guidance is per-character (`meta.guided`).** New optional boolean on `CharacterMeta`. `false`
  hides the ✦ button and suppresses the level-up overlay for that character; absent/true = active
  (`guidanceActive(character) = meta.guided !== false`). "Just the sheet" creation writes `false`;
  guided writes `true`; `migrate`'s `meta` deep-merge gives legacy characters `true`. The Builder ☰
  "Enable/Disable Character Guidance" now toggles THIS flag (it used to flip the global preference);
  the global `ask/on/off` in Home still governs only the create prompt. **The global setting no longer
  gates the button** — each character owns its guidance state.
- **Standard Array is the guided default.** `createCharacter` gained `guided`/`scoreMethod` opts;
  Home's guided path passes `scoreMethod: 'standard-array'` (was the schema-wide Manual default, which
  "Just the sheet" keeps). Scores stay all-10 at creation so `ClassStep` still seeds the class's
  recommended spread (a permutation of the standard array) — the Abilities step then opens on Standard
  Array showing that spread.

**Consequences.**
- The button reaches every required decision with no per-field wiring — deleting a boost, clearing a
  species sub-choice, or dropping a proficiency all resurface it. Reuses DDL-0018's deep checks, so a
  completeness fix there reaches the badge for free.
- `meta.guided` is additive (no schema-version bump); the deep-merge migrate keeps old characters
  active. The per-character move means a globally-"Never guided" user's *legacy* characters can now
  show the button when incomplete — intended (the button is about pendencies, not the create prompt),
  and dismissible per-character.
- Verified live + 9 new tests (`guidancePendencies.test.js`, 719 total): "just the sheet" → no button;
  enable → "6 choices left" → creation guide at Review; guided Fighter saved as `standard-array` with
  the Fighter spread.

### DDL-0021 — Choice chips are clickable (detail popup) + weapon entity reuses item preview
**Date:** 2026-07-15
**Builds on:** DDL-0007 (dialog stack), DDL-0020 (rule links inside the popup body).

**Context.** After picking options that render as chips (invocations, metamagic, weapon
masteries, skills…), there was no way to re-read what a chip means. Separately, the Weapon
Mastery selector's preview was nearly empty — not even the mastery description — unlike the item
shop's rich preview.

**Decisions.**
- **One reusable `showDetailPopup({entity, raw, db})`** (`components/common/detailPopup.jsx`)
  renders the SAME `DetailView` the SelectorPanel uses, inside the DDL-0007 dialog stack. Chips
  don't get a bespoke description component — they reuse the entity's own preview, so a chip and
  its selector always agree. `DetailView` got a `hideHeader` prop (dialog title carries the
  name; avoids duplication).
- **Chips resolve their `raw` from the entity's `list(db)`**, not from a second store: the chip
  only holds the pick value (name, `Name|Source`, or skill code), and each `ChoiceList`
  renderer maps it back the same way it maps forward. Applies to `TagChoice`,
  `OptionalFeatureChoice` and `MixedChoice`; the × remove button is untouched.
- **`weapon.js` delegates `meta`/`entries`/`fluff` to `itemEntity`** instead of duplicating
  weapon rendering. It keeps its weapon-mastery-specific `list`/filters/`card`. This is why the
  preview now shows the resolved mastery + property descriptions (itemEntity already appends
  `Mastery: <name>` blocks) — the point of the Weapon Mastery picker.

**Consequences.**
- The fix reaches every `ChoiceList` host (Class tab + wizard FeaturesStep) with no per-site
  work. Rule links inside a chip popup stack further popups (composes with DDL-0020).
- `itemEntity` is now a dependency of `weaponEntity`; keep item's weapon branch (damage/range/
  properties/mastery) working — the weapon picker rides on it.

### DDL-0020 — Rules glossary v1 SHIPPED: RuleLink via context, popup on the dialog stack
**Date:** 2026-07-15
**Implements:** DDL-0019's plan (the standalone `RULES-GLOSSARY-PLAN.md` file was folded into
this entry + CHANGELOG §23 and removed 2026-07-15 once v1 shipped — see DDL-0019 below for the
feasibility findings that made the plan cheap).

**Context.** The user gave the go-ahead; v1 (stages G1–G3) is implemented and verified live.
Three implementation decisions the plan had left open were made here:

**Decisions.**
- **`RuleLink` reads the db via `DataContext` directly** (a small component rendered by
  `renderTag`'s default branch), instead of threading the glossary through the pure render
  helpers. It uses `useContext(DataContext)` (not `useData()`, which throws) so EntryContent
  still renders outside the provider — there, and whenever `lookupRule` misses, it degrades to
  the old inert `.ref` span (a link is never dead). `engine/glossary.js` memoizes the index per
  db object (`glossaryFor`, WeakMap), so render-time lookups are Map hits.
- **The popup REUSES the DDL-0007 dialog stack** (`showRulePopup` in
  `components/common/RulePopup.jsx` → `dialogStore.open` with title + type/source badges + an
  `<EntryContent>` body) rather than a sibling host: nested links push another dialog,
  X/Esc/click-outside pop the top one — exactly the required stack, zero new host code. The
  body resets DialogHost's `white-space: pre-line`.
- **itemProperty is indexed by abbreviation AND name** — the prose references it by
  abbreviation, case-insensitively (`{@itemProperty 2h|XPHB|Two-Handed}`), and its display name
  lives in `entries[0].name`, not at the top level. All lookups are case-insensitive
  (`{@status concentration}` is common).

**Consequences.**
- Every EntryContent consumer got the links for free (verified: species selector/tab, class
  features, item shop details, popups themselves). PDF and Foundry export untouched.
- Bonus display fix: unresolved glossary tags now show the 3rd-pipe display text (Fighter's
  `{@variantrule weapon mastery properties|XPHB|mastery properties}` has no matching
  variantrule entry and used to print the raw name).
- Link styling is the plan's baseline (dotted underline + pointer on the `.ref` base, accent on
  hover/focus) — final look still tunable with the user.
- **v2 backlog (SHIPPED 2026-07-16 — see DDL-0025; only the browsable glossary page remains open):** `{@spell}`/`{@item}`/`{@feat}` tags (≈1.9k /
  0.8k / 93 mentions in content we already display) becoming links that open the app's EXISTING
  entity detail views (`DetailView` via the selector entities) instead of a glossary popup —
  same `RuleLink`-in-`renderTag` mechanism, just routed to a different overlay per tag type; a
  browsable standalone glossary page/tab (search all rules — `glossaryFor`'s index makes this
  cheap, it's just a new route/UI over data already in memory); `{@creature}`, `{@deity}`,
  `{@filter}`, `{@quickref}` (different pipe grammar), `{@book}` deliberately stay plain text
  (out of scope, not gaps).

### DDL-0019 — Rules glossary with inline links: feasibility POSITIVE, plan fixed
**Date:** 2026-07-14

**Context.** The user wants an app-wide rules glossary (like 5e.tools' own): rule mentions
inside any rendered text (a weapon mastery citing the *Prone* condition, a trait citing
*Darkvision*) become tappable links opening a popup with the rule's text — so new players learn
the rules from their own sheet.

**Decision.** Analysis done (2026-07-14), result **positive** — the findings and the staged
implementation plan (G1 data+engine, G2 links+popup, G3 sweep) were fixed in a standalone
`RULES-GLOSSARY-PLAN.md` (project root), followed as written and **removed 2026-07-15** once v1
shipped (its content is now split between DDL-0020 above and CHANGELOG §23). Key facts: the
5etools prose already embeds machine-readable tags (`{@condition Prone|XPHB}` — ≈3.3k glossary
mentions in content we display); the glossary sources are mostly ALREADY fetched
(`variantrules`/`skills`/`senses`/`items-base`), with only `conditionsdiseases.json` +
`actions.json` to add (both verified 200 on the mirror); rendering has a single choke point
(`EntryContent.renderTag`); and the DDL-0007 dialog stack covers the popup. **Superseded by
DDL-0020 (2026-07-15): v1 shipped.**

### DDL-0018 — Creation guide: every non-biographical step is required, with DEEP completeness
**Date:** 2026-07-14
**Builds on:** DDL-0015 (blocking Next on incomplete required steps), DDL-0017 (the size choice).

**Context.** The creation guide already blocked Next on required steps, but "complete" was
shallow: the SPECIES step passed with just a species picked (lineage, the new Size selector and
the racial skill/feat sub-choices could all be skipped), and the ORIGIN FEAT step passed without
the feat's own sub-choices (a Magic Initiate without its spells). Fixed with the user
(2026-07-14): **in the creation guide, every step that is not biographical is ALWAYS mandatory,
including every sub-choice** — only story, alignment and name/portrait stay optional.

**Decision.**
- **Completeness is DEEP and lives in `createGuideContext`** (needs the db): `choicesComplete`
  checks every descriptor's picks against its target (an `ability` pool targets the CHOSEN
  alternative's count — "+1 to two" with one pick still pends) and **recurses into chosen feats'
  sub-bags** using the same list ChoiceList renders (`parseChoices(feat)` + the legacy free +1).
- New flags: `speciesComplete` (species + lineage when the race has `_versions` + ALL species
  sub-choices, size included) and `originFeatComplete` (the origin feat's own sub-bag);
  `proficienciesComplete`/`featuresComplete` upgraded from shallow pick-counting to the same deep
  check (an ASI-slot feat now requires its embedded choices).
- `wizardSteps`' species/originFeat statuses consume the ctx flags, **falling back to the old
  shallow check when no ctx is passed** (pure/unit-test use) — the WizardPage always passes ctx.
- A race missing from the compendium (or a feat the db doesn't have) counts as complete — there
  is nothing to render, so blocking would soft-lock the guide.

**Consequences.**
- `LEGACY_ABILITY_CHOICE` moved from ChoiceList to **`engine/choices.js`** (shared by the
  renderer and the completeness check; also required by the react-refresh lint rule).
- The ✦ fixup/pendency button is untouched — it remains class-decisions-only (DDL-0015); the
  deep requirements apply to the CREATION guide's Next/Review flow.

### DDL-0017 — Species size is a player choice; Verdan is level-driven
**Date:** 2026-07-14

**Context.** The PDF sheet needed a SIZE value, but 2024 races often say "you are Small or
Medium" — a player decision we never captured. Surveying the data: `size` is `["M"]` (95 races),
`["S","M"]` (30), `["S"]` (19), **absent** (15, mostly legacy/partner content) or `["V"]`
(only Verdan AI — "at 1st level you are Small … at 5th level you become Medium").

**Decision (fixed with the user).**
- Races with **more than one size code choose** via a **Size selector** in Species Choices
  (SpeciesTab and the guide's SpeciesStep — same ChoiceList, same species choice-bag, stored as
  `{ kind: 'size', picks: ['S'] }`). A race with **no size data counts as "small/medium"** (same
  choice); a single code is fixed (no selector); **Verdan ('V') is never a choice** — Small
  through total level 4, Medium from 5 on (`effectiveSizeCodes`).
- **Unchosen prints as the combined label** ("Small/Medium") on the PDF — never guessed.
- The engine lives in `engine/speciesData.js` (`sizeCodes`, `speciesSizeChoice`, `sizePick`,
  `effectiveSizeCodes`, `sizeLabel`); consumers are the PDF `sheetModel` and the **Foundry
  export** (actor `traits.size` + the species item's `Size` advancement), all level-aware.

**Consequences.**
- ChoiceList gained a `'size'` pool rendered by the same single-value select as `'spellAbility'`
  (generalized `SelectChoice`) — no new storage, no schema change.
- The Foundry import does not back-fill the size pick from an actor's `traits.size` (unchosen
  round-trips as the race default); acceptable until someone asks.

### DDL-0016 — PDF export: filling conventions, multiclass = one sheet per class
**Date:** 2026-07-14

**Context.** Phase E moved from the blank clean-room template to the FILLED sheet. The user
supplied a partially-filled fillable version of the official 2024 sheet as the reference for *how*
players fill it (extracted via its AcroForm field values): skills as total bonuses, features as
names with short parentheticals, spells with abbreviated casting times and frequency notes.

**Decision (fixed with the user).**
- **Names only, never full descriptions** for class features, species traits and feats — the
  player references the books, exactly like we already do for spells.
- **Multiclass exports one sheet (2 pages) per class in a single file**, nearly identical: what
  varies is CLASS/SUBCLASS, that class's feature list and that class's spellcasting block
  (ability/DC/attack + its spell rows). Shared blocks (abilities, skills, HP, inventory, slots)
  repeat; species/feat-granted spells appear on every sheet.
- **Blank by default, for the player to fill at the table:** background (we use custom origins),
  XP, current/temp HP, spent hit dice, death saves, heroic inspiration and expended slot pips.
  Slot **totals** are printed; the pact slot is folded into its circle's Total (the sheet has no
  Pact Magic row).

**Consequences.**
- `src/pdf/sheetModel.js` (pure, tested) is the single translator decisions+derivation → display
  values; `CharacterSheetDoc` stays a dumb positioner (`model` optional — without it the blank
  template still renders, and stays exportable).
- The visual test mode (`npm run pdf:preview`) renders blank + a filled multiclass fixture,
  loading the compendium from the local `../DnD Source Material/5etools Source Code/data`
  snapshot — layout iteration never needs the browser.
- Weapon attack math (melee/ranged/finesse, category/name proficiency, `bonusWeapon`) is
  recomputed in the model — if it ever drifts from the Foundry activities' math, the model is the
  one to fix (Foundry derives its own; the PDF must print final numbers).

### DDL-0015 — Two guides: the full CREATION tutorial vs. the light FIXUP/level-up overlay
**Date:** 2026-07-13
**Supersedes in part:** DDL-0014 #5 (the pendency button used to reopen the *creation* wizard; it now
opens the light overlay) and the D3.5 "reopen the create guide" mechanism.

**Context.** The Character Guidance had ONE interface (the full creation wizard) reused for creation,
the pendency button, and level-up. That wizard is far more than a level-up needs, and it showed every
already-done step before you could reach what was missing. Fixed with the user (2026-07-13): split the
two experiences.

**Decision.**
- **Creation guide** (`WizardPage`, `/build/:id/wizard`, the full ordered flow with Review) is the
  **tutorial** — used during initial creation (`meta.creating`) and re-runnable from the hamburger
  ("Creation guide"). It now **blocks advancing on an incomplete required step** (`Wizard`
  `blockIncomplete`): required steps (class, species, subclass, origin feat, proficiencies, abilities,
  boosts, equipment, features, cantrips, spells) must be filled before Next; only biography, alignment
  and name stay optional/skippable. Its exit is non-destructive once the character has a class.
- **Fixup / level-up overlay** (`LevelUpWizard`, an overlay over the sheet) is the **light guide**
  shared by the **✦ button** and **level-up**. It shows ONLY the class decisions still to fill —
  **subclass → features (unfilled, ALL levels) → spells** — in order, with **no Review** (`Wizard`
  `showReview={false}`) and the same blocking. Steps are built live by
  `components/wizard/fixupSteps.js` (`buildFixupSteps`, db-aware) so filling one advances the guide.
  Opened by level-up ⇒ exit offers Undo/Keep; opened by the button ⇒ exit just closes.
- **The ✦ button** shows only when there ARE class pendencies (`fixupPendencyCount`), always accent
  with a count badge, and opens the overlay on the first class with something to fill
  (`firstClassWithFixup`) — it no longer navigates to the creation wizard.
- **Level-up is detected centrally** in `Builder.setClasses` (a class's level went +1): it fires from
  BOTH the top-bar `LevelControls` and the **Class tab's** level stepper. `LevelControls` no longer
  has an `onLeveledUp` prop. The overlay opens only when `buildFixupSteps` is non-empty.

**Why "features, all levels, unfilled"** (not the old per-level diff): a level can GROW a choice whose
feature was granted earlier — e.g. Barbarian level 4 adds a feat AND a 3rd Weapon Mastery slot (the
mastery feature is level 1, count grows at 4). Filtering by `level === toLevel` missed the mastery;
filtering by "not yet filled, any level" catches both, and also surfaces anything left from earlier
levels (the user's requirement).

**Consequences.**
- Removed the now-dead engine pieces: `buildLevelUpSteps`, `levelUpHasDecisions`,
  `guidancePendencyCount`, `firstIncompleteIndex` (and `components/wizard/levelUpContext.js`). The
  create catalog keeps a `subclass` step (shown when a class is past its subclass level) for the
  re-run-creation case; `WizardPage` targets it at the class past its subclass level.
- Weapon-mastery (and any weapon TagChoice) now **excludes already-picked weapons** from its
  selector, so the same weapon can't be chosen twice.
- The pendency signal is now purely class-decision-based; the creation basics are enforced by the
  creation guide's blocking instead of nagging via the button.

### DDL-0014 — Level-up guide (Phase D3): decisions & shape
**Date:** 2026-07-13
**Builds on:** DDL-0012 (the wizard is create + level-up, and optional), DDL-0013 (D3 is a diff).

**Context.** D3 is the guided **level-up**. Five product calls were fixed with the user (2026-07-13).

**Decisions.**
1. **No HP step — average always.** The level-up guide never asks about HP; per-level HP stays the
   average (`hitpoints.js` default), and rolling remains the **HP card button on the sheet**. So
   `buildLevelUpSteps` **drops the HP step**: the guide opens **only** when the level unlocks a real
   choice (subclass / ASI-feat / spells / a newly-unlocked feature choice). A level that unlocks
   nothing (most 1→2) applies immediately with no guide (DDL-0013 #3).
2. **Single-level only.** The guide targets newcomers who level one at a time; "create at a high
   level" and multi-level jumps are out of scope.
3. **Overlay, +1 applied first.** Level-up runs as an **overlay over the sheet** (not a route),
   launched from `LevelControls`' `onLeveledUp`. The `+1` is applied first (the character *is* the new
   level), then the overlay guides only the unlocked decisions. The `Builder` owns the overlay (it has
   `derived` for `levelUpHasDecisions`).
4. **Exit offers two options, level-appropriate.** Like level-1 create's Discard/Keep, but here:
   **Revert the level** (undo the `+1`) / **Keep it** (stay leveled, finish later) / dismiss. Never
   deletes the character.
5. **Pendency indicator + reopen.** A button **beside the hamburger**, present while guidance is
   active. **Accent theme** whenever the character has ANY unmade required choice (level 1 *or* any
   later level); **normal theme** when nothing is pending. It reopens the guide to fill the gaps.
   This needs a **character-wide pendency check** — the guide's step list must be buildable from the
   character's **current** level (create steps + subclass/ASI/spell/feature steps unlocked by levels
   ≥2), with the Review screen flagging the incomplete ones.

**Consequences / sub-phase plan. ✅ DONE (2026-07-13; see CHANGELOG §21). Verified live on an
Artificer 1→4 (spells@2, subclass@3, ASI@4, Undo revert, average HP, pendency button + reopen).**
- **D3.0** ✅ — overlay wiring in `Builder` + `onLeveledUp` + exit (Undo/Keep); HP step dropped. The
  overlay (`components/wizard/LevelUpWizard.jsx`) **snapshots its steps against the target level** so
  the async `save` lag can't drop a just-unlocked feature.
- **D3.1** ✅ — **`SubclassStep`** (reuses `makeSubclassEntity`), at its level when unset.
- **D3.2 + D3.4** ✅ — one **`FeaturesStep`** generalized with `classUid` + `onlyLevel` shows the
  level's newly-unlocked choices; the **ASI is just a feature choice** (no separate step; `ASI_LEVELS`
  removed). The diff gate is `ctx.hasFeatureChoices` from `levelUpContext` (`buildClassChoices` entry
  at `toLevel`). *(Class-specific ASI levels come for free — the ASI feature's own level drives it.)*
- **D3.3** ✅ — **`LevelUpSpellsStep`** + `SpellPicker` generalized to a level range (`level..maxLevel`)
  for cantrips + prepared spells up to the new max circle; gate is `spellLimitsGrew`.
- **D3.5** ✅ — **pendency button** (`✦` beside the hamburger, accent + badge when a required choice is
  unmade — missing class/species, or a subclass past its level). Reopens the guide; a new **`subclass`
  create step** (`when` = past the subclass level) lets the reopened guide fix a leveled character, and
  the wizard exit is **non-destructive when already created**. Engine: `pendingSubclassClass`,
  `guidancePendencyCount`.

### DDL-0013 — Character Guidance (wizard) architecture & phase plan
**Date:** 2026-07-10
**Builds on:** DDL-0012 (two flows, optional, entry points already exist), DDL-0006 (Phase D order).

**Update 2026-07-11 — level-1 create order, nav, and D2 scope (fixed with the user).**
The D1 catalog was a placeholder order; the real **level-1 creation order** is finer-grained and
splits the monolithic tabs into single-question screens:
1. **Class** (pick the class; level 1) → 2. **Species** (+ lineage + species choices) →
3. **Origin feat** (+ its sub-choices) → 4. **Proficiencies** (class *and* background skill/tool/
language picks, unified) → 5. **Abilities** (base scores + method + the background ability boosts)
→ 6. **Starting equipment** (the class package OR gold) → 7. **Identity** (name + portrait +
biography) → 8. **Class features** (Divine/Primal Order, Fighting Style, Weapon Mastery, Eldritch
Invocations, Expertise…) → 9. **Class spells** → **Review**.
- **Key implementation fact:** steps 4 and 8 **partition the same class choice-bag by `kind`** —
  `skill`/`tool`/`language` (+ the origin's proficiency choices) render in step 4; `featureoption`/
  `optionalfeature`/`weapon`(mastery)/`expertise`/`feat`(non-origin)/`ability`(ASI) render in step 8.
  The origin *feat* (step 3) is `origin.originFeat` specifically; the background *boosts* (step 5)
  are `origin.abilityBoosts`. Every screen still writes the same `character` and reuses SelectorPanel/
  ChoiceList/PickerField/engine — no rules fork (the DDL-0013 guard-rail).
- **Dependency check (correct):** class before all class-derived picks; **features (8) before spells
  (9)** because a feature can change the spell buckets (Cleric Thaumaturge's extra cantrip, a
  Warlock invocation that grants a spell); Rogue **Expertise (8) after proficiencies (4)**.
- **Two accepted frictions:** (a) Cleric **Divine Order "Protector"** *grants* proficiencies but is
  chosen in step 8, after the proficiencies screen (step 4) — the grants just won't show on that
  screen (they are grants, not choices). (b) Level-1 **features are chosen late** (after gear/name);
  narratively fine for newcomers, kept per the user's draft.
- **Decisions:** **Skip appears only on optional steps** (Next and Skip both advance under live-save,
  so Skip is a clear "leave this" only where a step is skippable; required steps show just Back/Next).
  Nav is **Back · Next · Skip in the footer**, similar styling (Back leaves the wizard at step 0).
  **D2 targets level-1 create only** (creating directly at a higher level reuses the same steps but
  its ordering/extra-ASIs are deferred). The **starting-equipment package IS in D2** (parse
  `class.startingEquipment.defaultData[0]` — options A/B/C of `{item,quantity}`/`{value}` cp/
  `{special}` — into inventory + currency; packs added as a single item, `special` handled minimally).
- **D2 sub-phases:** D2.0 shell nav (footer Back/Next/Skip, Skip-on-optional) + reorder the create
  catalog to the level-1 order + `renderStep` plumbing + the **Class screen** as the reference
  template; then one screen per sub-phase (Species → Origin feat → Proficiencies → Abilities →
  Equipment(+package) → Identity → Features → Spells), each verified and reviewed with the user
  before the next, since the screens will be adjusted heavily.
- **Exit & resume (level-1 create) — decided & shipped.** A guided character carries **`meta.creating:
  true`** while the create wizard is unfinished (set by Home's guided `create({creating:true})`, cleared
  on **Finish**). Consequences: (a) a Home roster card opens the **wizard** instead of the sheet while
  `creating`, resuming at **step 1** (the shell always mounts at index 0) with all live-saved inputs
  intact — the first step doubles as a recap. (b) The wizard's **✕ / Back-from-step-0** asks
  *"Leave character creation?"* → **Discard** (delete + Home) / **Keep it** (Home, stays resumable) /
  dismiss (stay). This discard-on-exit is **level-1-create-specific**; the **level-up guide (D3) will
  treat exit differently** (no discard — the character already exists). `migrate` deep-merges `meta`, so
  legacy characters read `creating:false` and open the sheet as before.

**Context.** Phase D is the guided creation/level-up assistant, branded **"Character Guidance"**
(the preference already lives in `store/settingsStore.js` as `ask`/`on`/`off`, and the Home
prompt + hamburger set it). Four product decisions were fixed with the user (2026-07-10):
1. **Non-blocking validation** — *Next* is always enabled; incomplete steps are flagged, not
   locked. Fits the engine's "decisions, not obligations" model.
2. **Custom step screens** — each step is a purpose-built, newcomer-friendly screen with
   explanatory copy, **not** a thin wrapper around the existing tab.
3. **Level-up opens only when the new level unlocks a decision** — pure HP/number gains apply
   immediately without opening the wizard.
4. **First character suggests guided** — an empty roster with preference still `ask` opens the
   prompt with "Guide me" emphasised.

**Decision — architecture.**
- **Custom screens, shared rules.** The step screens are bespoke (layout, copy, tips), but they
  **must not re-implement rules or the choice-bag**. They render the same *atomic* pieces the tabs
  use — `SelectorPanel` (pick species/class/subclass/feat/spell), `ChoiceList` (sub-choices),
  `PickerField`, and the `deriveFromDb` engine — and write to the **same** `character` shape. The
  wizard owns *flow and presentation*, never a second source of truth for mechanics. (This is the
  guardrail on decision #2: "custom" = the envelope, not the engine.)
- **One component, two flows, from a computed step list.** A `Wizard` takes `mode: 'create' |
  'levelup'` and walks a **step list built from character state**, not a fixed script:
  `steps = STEP_CATALOG.filter((s) => s.when(character, derived, ctx))`. Create yields the full
  ordered set; level-up yields only the steps the new level opened (the diff).
- **Step model** (pure, testable — `engine/wizardSteps.js`):
  `{ id, title, subtitle, help, when(character, derived, ctx) -> bool,
     status(character, derived) -> 'complete' | 'incomplete' | 'optional' }`.
  The **status** drives the non-blocking flags and the Review screen; it never blocks Next.
- **Shell.** `components/wizard/Wizard.jsx` + a `WizardStep` layout (progress bar, title/help,
  body slot, footer: Back / Skip / Next, and Finish on the last step). Create runs full-page on
  the existing **`/build/:id/wizard`** route; level-up runs as an **overlay** over the sheet,
  launched from `LevelControls`' `onLeveledUp(uid, newLevel)` (DDL-0012) — same shell, `mode`
  differs.
- **Create step catalog (draft order, tweakable):** Identity (name/portrait) → Class (+subclass
  when the level allows) → Species (+lineage) → Background (boosts, origin feat, proficiencies,
  story) → Abilities (method) → Progression choices (ASI/feat, fighting style, expertise, weapon
  mastery — those the level opened) → Spells (casters only) → Equipment → Biography (optional) →
  **Review** (lists every incomplete/optional flag, links back to its step, then Finish).
  - *Equipment step note:* the **starting-gold default already exists** — `engine/startingGold.js`
    seeds 50 GP (background) + the original class's gold alternative on class-selection (see
    CHANGELOG §13). The Equipment step turns this into an explicit **"take starting equipment OR
    take the gold"** choice (the gold path is done; the "grant the class's starting equipment
    items" path is the new work).
- **Level-up diff steps:** HP for the new level → Subclass (only at its level, if unset) → ASI/Feat
  (only on that class's ASI levels) → new/changed Spells (casters, when limits/slots move) → any
  class/subclass **feature choices** newly unlocked → Review. `when()` for each encodes exactly
  that condition, so a level with no choices produces an **empty diff** and the wizard is skipped
  (decision #3) — `LevelControls` applies the `+` immediately in that case.
- **Guidance routing (already partly built).** Home's Add flow reads the preference: `on` →
  wizard route, `off` → sheet, `ask` → the guided prompt with the "Remember my answer" checkbox.
  Decision #4 adds: when the roster is empty and preference is `ask`, the prompt emphasises
  "Guide me". No schema change — the whole feature is a preference + a presentation layer.

**Implementation phases (each verified + CHANGELOG'd before the next).**
- **D1 — step engine + shell.** `engine/wizardSteps.js` (catalog, `when`/`status`, `buildSteps`
  for create and for a level diff) with unit tests; `Wizard`/`WizardStep` shell with progress,
  Back/Skip/Next, and a Review screen driven by `status`. Steps render placeholders first, so the
  navigation/validation/diff logic is proven before any screen design.
- **D2 — create screens. ✅ DONE (2026-07-11; spells reworked 2026-07-12).** All create screens built
  and verified live, each reusing `SelectorPanel`/`ChoiceList`/`PickerField`/engine with no rules fork:
  intro (info) → class → species (+ Dragonborn draconic-ancestry lineage fix) → origin feat →
  proficiencies (class+origin skill/tool/language, one `buildClassChoices` bag split by `kind`) →
  abilities (Point Buy / Standard Array / Manual) → background boosts → equipment (parse
  `startingEquipment` A/B/C into inventory + currency) → personality & story → alignment → name &
  portrait → features-intro (info) → class features (`isFeatureChoice` half of the same bag) → **cantrips** →
  **level-1 spells** → review. Two informational screens use a new `status: 'info'` (no Skip, out of
  Review). The `/build/:id/wizard` route runs `mode:'create'`; exit/resume via `meta.creating`.
  See CHANGELOG §21 (D2.0–D2.10).
  - **The magic step is TWO newcomer screens, not the SpellbookTab (D2.10, 2026-07-12).** Reusing the
    whole SpellbookTab was a wall of controls for a new player. It is now a **Cantrips** screen and a
    **Level-1 spells** screen, each just a guide card + pickers (like the features step). The guide copy
    is pulled from the class's own `Spellcasting`/`Pact Magic` prose (`engine/spellcastingText.js`) so
    it is authoritative and per-class (Warlock's "Short or Long Rest" recovery, etc.); Ranger/Paladin
    have no `Cantrips` block so their cantrips screen is skipped (the `cantrips` step's `when` also
    requires `cantripLimit > 0`). A shared `SpellPicker` writes the same `ClassEntry.spells` and opens
    `SelectorPanel` locked to the class list + level. A reusable `components/common/FeatureText.jsx`
    (+ extracted `ClassTableView.jsx`, which `ClassProgression` now reuses) shows the class **features
    table** wherever a feature's text cites it — on these spell screens and in `FeaturesStep` (Eldritch
    Invocations, Weapon Mastery…).
- **D3 — level-up.** The diff builder + the overlay flow from `onLeveledUp`; apply-immediately when
  the diff is empty. Tests for the diff at representative levels (1→2 nothing; 2→3 subclass;
  3→4 ASI; caster slot bumps).
- **D4 — guidance polish.** First-character emphasis; a "you can change this in Settings" hint;
  confirm the `ask`/`on`/`off` paths end-to-end.

**Consequences.**
- The wizard cannot drift from the sheet's mechanics: both write the same `character` and derive
  through `deriveFromDb`. A rules fix in the engine reaches both for free.
- The step list being a **diff** is what lets one component serve creation and level-up (DDL-0012).
- Non-blocking validation means the **Review screen is the safety net**, not the Next button — it
  must enumerate every `incomplete` step with a jump-back link.
- Custom screens are more code than wrapping tabs; the guardrail (atomic reuse, no engine fork)
  keeps that cost in the *presentation*, where it belongs.

### DDL-0012 — The wizard is a creation **and** level-up assistant, and it is optional
**Date:** 2026-07-10

**Context.** Phase D was scoped as a guided *creation* flow. The user extended it: the same
assistant should also run a **level-up**, and the whole thing must be **switchable off** for
players who prefer to edit the sheet directly. That changes what the entry points are.

**Decision.**
- The wizard covers **two flows** off one component: *create* (all steps, from a blank character)
  and *level up* (only the steps the new level actually opens — HP, subclass at its level, ASI/feat,
  new spells, new choices).
- It is a **user preference**, not a mode of the character: a player who turns it off keeps the
  tab-based builder and the `+`/`−` level buttons acting immediately.
- **The entry point already exists.** `components/builder/LevelControls.jsx` (added 2026-07-10)
  sits in the top bar next to Export: `−  [total level]  +`. It asks **which class** changes when
  the character is multiclassed (in-app `ask` dialog, DDL-0007), caps the total at 20, and never
  takes a class below level 1 — *removing* a class stays a deliberate action in the Class tab, not
  a side effect of clicking `−`. It already exposes an `onLeveledUp(uid, newLevel)` callback: that
  is where Phase D hangs the level-up wizard.

**Consequences.**
- Phase D must build the step list from a **diff** (what this level unlocks), not from a fixed
  script, so the same machinery serves both flows.
- The preference needs somewhere to live (a small settings store + a toggle); it does not exist yet
  and should be created with the wizard, not before — an unused switch is worse than none.
- Levelling down deliberately does **not** open the wizard, and leaves per-level HP rolls in place;
  they are keyed by level and simply stop being read.

### DDL-0011 — Granted-spell frequency: resolve what the data encodes, never invent the rest
**Date:** 2026-07-10

**Context.** Two Spellbook edge cases exposed how `additionalSpells` encodes *how often* a granted
spell may be cast, and where it stops encoding it at all.
- **Archfey Patron (XPHB)** grants Misty Step **twice**: once under `prepared` (cast with a Pact
  slot) and once under `innate._.daily.cha` — the count key is the string **`"cha"`**, meaning
  "a number of times equal to your Charisma modifier (minimum 1)". We rendered it as two rows and
  a meaningless "Daily" label (`Number("cha")` → `NaN`).
- **Aarakocra (MPMM)** grants `innate: { 3: ["gust of wind"] }` — a **bare list**, with no recharge
  type. The rule is once per long rest, but the data does not say so, and the **same shape** means
  *at will* for Yuan-Ti's Animal Friendship. `foundry-races.json` (DDL-0009) has no entry either.

**Findings (surveyed across the whole dataset).** The count key of `daily`/`rest`/`resource` is
one of: a number (`'1'`), a number + `e` (`'1e'` = one **each**), `'pb'` (proficiency bonus), or an
**ability abbreviation** (`'cha'`, `'int'`). Bare lists appear under `innate` in 19 places.

**Decision.**
1. **Parse every encodable form.** `parseUsesKey` classifies the key into `{count, scale, each}`;
   `resolveGrantedUses(entry, {profBonus, modifiers})` turns a `scale` into a real number at
   derivation time (where prof/mods exist), applying the 5e **minimum of 1**, and returns a
   `usesNote` ("Charisma modifier") that the UI shows as a tooltip. The engine stays pure: the
   parser never sees a character.
2. **One spell, one row.** `grantedSpells` now dedups **by spell name**, merging across buckets:
   the most "prepared" mode wins (`prepared` > `known` > `innate`) and the cast type/uses come from
   whichever bucket carries them. Misty Step is a single row badged *Always Prepared* + *4/Day*.
3. **Never invent a frequency.** A bare `innate` list becomes `castType: 'innate'`, labelled
   **"No Spell Slot"**, with a tooltip pointing the player at the feature text. We do not guess
   "1/Day", because the same shape covers both once-per-long-rest and at-will grants.

4. **Curated overlay for the bare-innate grants** (`engine/grantedSpellUses.js`, added same day at
   the user's request). `INNATE_USES` maps `"Name|SOURCE"` → `{ spell: {castType, count} }`, and
   `applyUsesOverlay(spells, entity)` fills in only the entries the data left ambiguous
   (`castType === 'innate'`). Each row **cites the feature prose that justifies it**. Introduces
   `castType: 'restLong'` ("1/Long Rest") — `additionalSpells` cannot express short-vs-long rest,
   so only the overlay produces it. Reading the prose showed the 14 reachable cases split three
   ways: 1/long rest (Aarakocra, Firbolg, Glamour…), 1/short-or-long rest (Ancestral Guardian,
   Diviner), and **at will** (Yuan-Ti's Animal Friendship; the Giant/Artificer cantrips). One case
   inverts the bucket's meaning entirely: **Great Old One's Hex** sits under `innate` but the text
   says only "You always have the Hex spell prepared" — no free cast — so the overlay sets
   `castType: null`.

**Consequences.**
- Anything the data encodes is displayed exactly; anything it does not encode is either **curated
  from the prose** or displayed *honestly* ("No Spell Slot"), never guessed. An entity absent from
  the overlay still falls back to the honest label — tested.
- The overlay is a **closed, small list**, not a heuristic. Newer content (Elf/Tiefling XPHB and
  anything following that shape) encodes `daily`/`rest` maps directly and never reaches it.
- The Foundry export (B2.5) can map `scale` directly onto dnd5e's `uses.max` formulas
  (`@prof`, `@abilities.cha.mod`) instead of a baked number, and `restLong`/`rest`/`will` onto
  `uses.recovery`.

### DDL-0010 — Mystic Arcanum: high-circle spells are ClassEntry spells above the slot ceiling
**Date:** 2026-07-09

**Context.** The Warlock breaks the Spellbook's "prepared spells + slots" model. Pact Magic's
slot table stops at the **5th circle**, but from level 11 the **Mystic Arcanum** grants one spell
of the 6th, 7th, 8th and 9th circle (levels 11/13/15/17), each cast **once per long rest**,
without a slot, and **not counted against the prepared limit**. The 5e.tools data is prose only
(a `classFeature` named "Mystic Arcanum"), so nothing derives automatically. We needed a storage
and derivation shape that did not invent a second spell store.

**Decision.** An arcanum spell is **just a `ClassEntry.spells` entry whose level is above the
origin's `maxPrepareLevel`**. No new storage, no marker field, no schema change.
- `engine/spellcasting.js` gains `ARCANUM_TABLE` (`{11:6, 13:7, 15:8, 17:9}`) and
  `arcanumLevels(casterCode, classLevel)` — empty for anything that is not `pact`.
- `deriveSpellcasting` computes `maxPrepareLevel` per origin (the pact ceiling, or the highest
  leveled slot circle), and splits the player's spells: at or below it → `prepared` (counts
  against `prepareLimit`); above it → `arcanumSpells` + `arcana[{level, spell|null}]`, outside
  every counter.
- The picker allows a spell above the ceiling **only into a free arcanum of exactly that
  circle**; the Prepare button disables only when cantrips, prepared **and** arcanum are all
  full. Rows render a "Mystic Arcanum" + "1/Long Rest" badge.

**Consequences.**
- Generalizes for free: any future caster whose spells outrank its slots reuses `maxPrepareLevel`
  without new concepts. A non-pact caster gets `arcanumLevels() === []` and behaves exactly as
  before.
- The derivation must remember to **list** `arcanumSpells` alongside `prepared` — removing them
  from the counters once made them vanish from the tab (caught in live verification, now tested).
- The Foundry export (B2.5) will map an arcanum spell to `preparation.mode` plus `uses`
  (1/long rest), not to a spell slot.

### DDL-0009 — The `foundry-*.json` mechanics overlay is 5e.tools (MIT), not Plutonium
**Date:** 2026-07-09
**Supersedes in part:** DDL-0003 (only its premise about where the overlay lives; every
Plutonium prohibition in DDL-0003 stands unchanged).

**Context.** DDL-0003 recorded that the curated Foundry mechanics overlay
(`foundry-feats.json`, `foundry-races.json`, `foundry-items.json`,
`foundry-optionalfeatures.json`, `class/foundry.json` — Active Effects, ScaleValue tables,
special advancement configs) was **Plutonium data**, therefore UNLICENSED and unusable. That
premise was wrong, and it has been costing us: it is the reason we resolved to author our own
Active-Effects registry from scratch.

**Findings (verified 2026-07-09).**
- The overlay files in `DnD Source Material\Plutonium Module Code\data\` are **byte-for-byte
  identical** to the ones in `DnD Source Material\5etools Source Code\data\` (39723 / 75954 /
  435745 / 105204 / 425319 bytes respectively). Plutonium **bundles a copy of the 5e.tools
  `data/` tree**; it does not originate the overlay.
- The 5e.tools repository is **MIT** (`LICENSE.md`, TheGiddyLimit and contributors).
- **Every overlay path returns HTTP 200 on the mirror we already fetch from**
  (`5etools-mirror-3/5etools-src/main/data/`), at the same byte sizes: `foundry-feats.json`,
  `foundry-races.json`, `foundry-items.json`, `foundry-optionalfeatures.json`,
  `foundry-actions.json`, `foundry-rewards.json`, `foundry-vehicles.json`,
  `foundry-psionics.json`, `class/foundry.json`.
- Content confirmed to be the real overlay: `foundry-feats.json` = `{feat: [...]}` with 51
  entries; "Alert" carries `effects[].changes[] = {key:'flags.dnd5e.initiativeAlert', …}` —
  the exact effect observed in the real Foundry export.

**Decision.** The `foundry-*.json` overlay is **fetchable at runtime from the public 5e.tools
mirror, like every other data file we consume**, and may be used as our mechanical repository.
This does **not** relax DDL-0003 in any other respect: Plutonium remains a private reference
only — never bundled, fetched, or redistributed.

**Caveats for whoever implements this.**
- `foundry-backgrounds.json` is **Plutonium-only** (404 on the mirror). Out of bounds.
- `foundry-psionics.json` is an empty `{}` (3 bytes) upstream.
- The overlay's Active-Effect `mode` is a **string** (`"OVERRIDE"`, `"ADD"`), not Foundry's
  numeric mode (5, 2). A consumer must translate.
- Adding these to `buildManifest` follows the `items.json` caution: **one 404 breaks the whole
  `Promise.all`** — the paths above were verified, re-verify any new one.

**Consequences.**
- `engine/foundryEffects.js` (our hand-curated registry) can be **backed by, or largely
  replaced with, the upstream overlay**, reducing per-feature curation to the gaps the overlay
  leaves. Not scheduled yet — it is additive and does not block B2.
- Generating the advancement skeleton ourselves (DDL-0003's other decision) remains correct and
  unaffected: the overlay only supplies what prose cannot express.
- Attribution: MIT (5e.tools) alongside the SRD/CC-BY-4.0 attribution we already owe.

### DDL-0008 — Phase B2 (Spellbook) architecture & implementation plan
**Date:** 2026-07-09

**Context.** B2 is the next roadmap item (README #10): spell selection + prepared spells for
casters, plus granted spells (lineage/subclass/feat) and the spell side of the Foundry export.
The user specified a robust, inventory-like interface with a set of firm requirements (below).
This entry fixes the architecture BEFORE any code, so every session builds the same thing.

**User requirements (numbered R1–R12).**
- **R1** — A robust interface like the Inventory tab, but a bit more: spells are split into
  **tabs by ORIGIN** (each spellcasting class its own tab; racial spells their own tab; feat
  spells their own tab). Multiclass shows which spells came from which class.
- **R2** — Spells granted by a **class/subclass feature stay inside that class's tab** (not a
  separate tab) to avoid clutter.
- **R3** — Within an origin, **categories are spell levels**: "Cantrips", "1st Level",
  "2nd Level", … (mirrors the Inventory tab's per-group categories).
- **R4** — Each origin has an **"All"** category showing every spell of that origin, grouped
  by level.
- **R5** — **Group-by** options (level / school / save-type or attack-roll / casting time) and
  **sort** options (alphabetical / level / casting time / range) — like the Inventory tab.
- **R6** — A **search** box.
- **R7** — A way to display **spell slots, pact slots, and per-rest use counts** (long/short).
- **R8** — A **counter of how many spells that class can prepare**.
- **R9** — A **"Prepare spell" button** that opens the **SelectorPanel** to browse spells.
- **R10** — The selector **comes pre-filtered to the origin's class spell list** by default
  (a Wizard sees the Wizard list), but the filter can be **turned off** for freedom —
  **always asking confirmation** when adding a spell outside the origin's default list.
- **R11** — On reaching the **prepared limit**, the Prepare button is **disabled** until the
  user removes a spell from that origin's list.
- **R12** — Spells **auto-prepared** by a subclass/feat/race are **actually always prepared**
  and, as usual, **do NOT count** against the prepare limit.

**Data model (investigated 2026-07-09 from `DnD Source Material\5etools Source Code\data`).**
- Spells live per-source: `spells/spells-<src>.json` → `{ spell: [...] }`; `spells/index.json`
  maps SOURCE→filename; `spells/fluff-spells-<src>.json` + `fluff-index.json` for art/lore.
- A spell object: `name, source, level (0 = cantrip), school (single-letter code A/V/…),
  time [{number,unit}], range {type, distance}, duration [...], components {v,s,m},
  savingThrow ["dexterity"], spellAttack, damageInflict, miscTags (e.g. ritual), areaTags,
  entries, entriesHigherLevel`. Reprints exist (PHB→XPHB) → use the same `latestOnly()` dedup.
- **The spell→class mapping is NOT on the spell.** It's the reverse map in
  `spells/sources.json`, keyed `[SOURCE][SpellName].class = [{name, source}]` — this is how we
  build "the Wizard spell list" (R10). Subclass/lineage/feat granted spells come from an
  `additionalSpells: [{ innate|known|prepared: { <level>: [name…] }, ability, … }]` field on
  the race/subclass/feat/background objects (may include a `choose` form).
- Class spellcasting fields (`class-<name>.json`, XPHB entry): `spellcastingAbility` ('int'),
  `casterProgression` ('full'|'half'|'third'|'artificer'|'pact'), `cantripProgression`
  [by level], `preparedSpellsProgression` [by level — the 2024 prepared count, R8],
  `preparedSpellsChange` ('restLong'), `spellsKnownProgressionFixed` (legacy known-casters).
  Warlock = Pact Magic (pact slots, separate table).
- **Foundry target** (from `Character Sheets in JSON`): spells are `Item` type `spell`
  (`system`: level, school, properties, materials, target, range, activation, duration, uses,
  `preparation:{mode, prepared}`, activities, identifier); actor `system.spells` = `spell1`…
  `spell9` + `pact`, each `{value, max, override}`. `preparation.mode` ∈
  `prepared|always|atwill|innate|pact`.

**Decision — architecture.**
- **Storage (schema).** Bump `CHARACTER_SCHEMA_VERSION` 1→2 (+ defensive migrate). Add
  **`spells: ContentRef[]`** to `ClassEntry` (the user's chosen prepared spells + picked
  cantrips for that class; `createClassEntry` seeds `[]`). We store **decisions only** (which
  spells the user prepared) — never the derived slots/limits/DC. Racial/feat spells are NOT
  stored here: fixed grants are derived from `additionalSpells`; where the data offers a
  `choose`, that pick rides the **existing choice-bag** (`species.choices` / feat `choices`),
  not a new store. The unused `spells-known`/`cantrips-known` `LevelChoice` variants are
  superseded by `ClassEntry.spells`.
- **Data layer** (`data/config.js` + new `engine/spells.js`, pure — the spell counterpart to
  `engine/items.js`). Fetch spell sources (enumerate like `CLASS_NAMES`, or drive off
  `spells/index.json`) + `spells/sources.json` + fluff, verifying each path exists on the live
  mirror first (same caution the `items.json` add used — one 404 breaks the whole
  `Promise.all`). `engine/spells.js`: `resolveSpellObj`, `spellLevelLabel` (0→"Cantrip"),
  `schoolName`, `castingTimeLabel`, `rangeLabel`, `componentsText`, `saveOrAttack`
  classification, and `classSpellList(db, className, classSource)` (from `sources.json`),
  with `latestOnly()` reprint dedup.
- **Engine** (`engine/spellcasting.js`, pure). `spellcasterLevel(character)` (multiclass caster
  level: full=level, half, third, artificer=ceil(level/2); warlock/pact tracked separately);
  `spellSlots(casterLevel)` (standard 2024 multiclass table 1..9) and `pactSlots(warlockLevel)`;
  per-class `prepareLimit` (from `preparedSpellsProgression`), `cantripLimit` (from
  `cantripProgression`), `spellcastingAbilityFor`, `spellSaveDc`/`spellAttackBonus`
  (8/0 + prof + mod). `deriveSpellcasting(character, db)` merged into **`deriveFromDb`** (the
  same plug-in point `deriveInventory` uses — `deriveCharacter` stays pure). It returns an
  **`origins[]`** array, one per origin:
  `{ key:'class:wizard'|'race'|'feat:<id>', label, kind, ability, saveDc, attackBonus, slots,
  pactSlots, cantripLimit, prepareLimit, cantrips[], prepared[], alwaysPrepared[] }` — with
  class-feature/subclass-granted spells folded into that class origin's `alwaysPrepared`
  (R2/R12), racial into the `race` origin, feat into a `feat:*` origin. Resolved spell objects
  carry the display metadata the tab needs.
- **UI** — new **`components/builder/SpellbookTab.jsx`**, deliberately mirroring
  `InventoryTab.jsx`: **origin sub-tabs** (R1 — one per caster class the character has, plus
  Racial / Feats tabs only when they grant spells); per-origin **header card** showing spell
  slots / pact slots / per-rest uses (R7), the **prepare-count counter** (R8), and spell save
  DC / attack / ability; **level categories** with an **"All"** default grouped by level
  (R3/R4); **Group-by** (level/school/save-attack/casting time) and **Sort**
  (name/level/casting time/range) dropdowns (R5); **search** (R6); spell rows tap → a
  `DetailView` overlay (reuse the inventory overlay pattern) with full text +
  `entriesHigherLevel`. **Prepare flow:** a **"+ Prepare spell" button** (R9) opens
  **`SelectorPanel` directly** (the `EquipmentShop` pattern — stays open across picks) over a
  new **`selector/entities/spell.js`**; the panel is **pre-filtered to the origin's class
  spell list** (R10) via a new SelectorPanel prop for an initial/locked filter (small additive
  change, like the shop's `renderFooter`), with a toggle to lift it and an **in-app `confirm`**
  when adding an off-list spell (R10). The button is **disabled at the prepare limit** (R11).
  **Auto-prepared** spells render with an "Always Prepared" badge, are **not removable**, and
  are **excluded from the counter** (R12). Removing a prepared spell frees a slot in the count.
- **Foundry export/import (follow-on stage, split like B1's export side).**
  `foundryItems.buildSpellItems` → `spell` Items (level/school/activation/range/duration/
  target/components/materials + `preparation.mode` = `prepared` for user picks, `always` for
  granted, `pact`/`atwill` where applicable, `preparation.prepared`), spell save/attack as
  activities; fill actor **`system.spells`** slot block (`spell1..9` + `pact`) from
  `spellSlots`. `foundryToCharacter` reverses spell Items into `ClassEntry.spells` (skipping
  `mode:'always'` grants) and infers slots. Real compendium UUIDs stay deferred (shared with
  the rest of the export).

**Implementation stages (ordered, each verified + CHANGELOG'd before the next).**
1. **B2.1 Data layer — ✅ DONE (2026-07-09).** Fetch spells + fluff + `sources.json`
   (`data/config.js` `SPELL_SOURCES`/`SPELL_FLUFF_SOURCES`, all paths verified 200 on the live
   mirror); `engine/spells.js` (catalog + reprint dedup, resolution, label/rank helpers,
   `classSpellList`). Verified: 24 unit tests, cache self-migrated, 936 spells + fluff +
   `spell-sources` in IndexedDB, no console errors. See CHANGELOG §15.
2. **B2.2 Spellcasting engine + schema — ✅ DONE (2026-07-09).** `engine/spellcasting.js`
   (Foundry-faithful slot table + pact table + progression algorithm, caster level, cantrip/
   prepare limits, DC/attack); schema bump 1→2 + migrate + `ClassEntry.spells`;
   `deriveSpellcasting` wired into `deriveFromDb` (one origin per caster class, slots/limits/DC,
   resolved player picks). Verified: 45 unit tests (432 total), and live the real Artificer/Bard
   derived correct caster level 2 / slots {1:3} / per-class limits. See CHANGELOG §15.
3. **B2.3 Spellbook tab (read-only) — ✅ DONE (2026-07-09).** `engine/grantedSpells.js` (parses
   `additionalSpells`: `known`/`prepared`/`innate` grant, `expanded` doesn't; `{choose}` leaves
   deferred to B2.4 as `pendingChoices`); `deriveSpellcasting` gained subclass grants folded into
   the class origin (R2), a `race` origin and `feat:<id>` origins, all `alwaysPrepared` and out
   of the counters (R12); `selector/entities/spell.js` (fluff/meta/entries, for `DetailView`);
   `SpellbookTab.jsx` mirroring `InventoryTab` (origin sub-tabs, slot/DC/counter cards, level
   categories + "All", group/sort/search, detail overlay). Two decisions made here: a prepared
   spell that is **also granted** collapses to the granted copy (no duplicate, no counter hit),
   and a granted origin whose ability is a `{choose}` shows **no DC** instead of guessing.
   Verified: 26 new tests (463 total), lint clean, live on a Cleric 5 (Life) / Elf Drow.
   See CHANGELOG §15.
4. **B2.4 Prepare flow — ✅ DONE (2026-07-09).** `selector/entities/spell.js` gained list/filters/
   card and became a **factory (`makeSpellEntity(db)`)** so its **Class** filter can be built from
   the `spell-sources` reverse map (`spellClassIndex`). The picker's class scope is a **normal
   filter with every class as an option** — the origin's class merely comes pre-marked, via
   **`SelectorPanel`'s one additive prop, `initialFilterState`** — so a DM-approved Warlock spell
   can be found while preparing a Bard. Adding a spell off the origin's list still confirms (R10).
   Prepare button beside the search, **disabled only when cantrips, prepared AND arcanum are all
   full** (R11 — the picker hides each full bucket, so cantrips stay pickable when leveled slots
   are full); remove from the detail overlay; granted spells have no Remove (R12).
   Warlock's Mystic Arcanum is handled per **DDL-0010**.
   Also generalized: **`spellAbility` Choice** — `parseChoices` reads `additionalSpells[].ability
   .choose` on ANY entity (race/feat/background) and `ChoiceList` renders it, so granted origins
   finally get a DC/attack; `spellAbilityPick` deliberately does NOT recurse into sub-bags (a
   feat's ability belongs to the feat's origin). Every origin now carries `uses` (daily/rest/will/
   ritual casts) → origins without slots render a **"Uses" card** in the slot card's place.
   **Design:** level chips adopted the Inventory sub-tab style; page order is now
   **cards → origin tabs → search (+Prepare) → level categories → Group/Sort**.
   Verified: 12 new tests (475 total), lint clean, live on Cleric 5 / Warlock 1 / Elf Drow.
   See CHANGELOG §15.
5. **B2.5 Foundry export/import side — ✅ DONE (2026-07-10). PHASE B2 COMPLETE.**
   `engine/foundrySpells.js` builds a `spell` Item per spell per origin + the actor's
   `system.spells`. **dnd5e 5.3.3 uses `method` + `prepared` (0/1/2), not the deprecated
   `preparation:{mode,prepared}`** — the importer reads both (Plutonium exports still use the old
   pair). Mapping taken from the official Warlock 17 premade, not invented: picks → `spell`/`pact`
   + `prepared:1`; slot-spending grants → `prepared:2`; **Mystic Arcanum → `atwill`, `prepared:0`,
   `uses` 1/long rest**; innate grants → `innate` + `uses`. `uses.max` exports the **formula**
   (`@abilities.cha.mod`, `@prof`) so Foundry recomputes — that is what DDL-0011's `scale` was for.
   Import keeps only player decisions (`isPlayerChosenSpell`), keyed back to a class by
   `sourceItem`; `atwill` is disambiguated by `uses.max` (arcanum) vs. none (racial at-will).
   **Fixed a pre-existing importer bug found by the round-trip:** `subclassId` was read from the
   Foundry Item's *name* while the builder stores the 5e.tools *shortName*, so every
   subclass-granted spell and feature vanished on reimport (only "Champion" coincided).
   Verified: 41 new tests (561 total) incl. a full round-trip and a diff against the real premade;
   live export/reimport of an Aarakocra / Warlock 13 (Archfey). See CHANGELOG §15.

**Consequences.**
- Reuses established patterns end-to-end (pure engine + `deriveFromDb` plug-in; `DetailView`
  overlay; `SelectorPanel`-direct like the shop; in-app `confirm`; per-tab sub-tabs/group/sort/
  search), so B2 is additive and low-risk — the same shape B1 followed.
- `SelectorPanel` gains ONE additive prop (initial/locked filter); no other selector changes.
- Schema v2 is the first real migration — the migrate stays defensive (existing characters get
  empty spell lists and derive normally).
- Warlock Pact Magic and legacy fixed-known casters are handled as explicit variants of the
  2024 prepared model, not a separate system.

### DDL-0007 — In-app dialog system replaces native `window.confirm`/`alert`
**Date:** 2026-07-09

**Context.** Every warning/confirmation used the browser's `window.confirm`/`alert`/`prompt`
(multiclass, feat/optional-feature prerequisites, attunement, inventory remove, shop
no-price / not-enough-gold, character delete, import failure). Those cannot be styled, do
not match the app, and give no control over layout/behavior. We want one reusable in-app
component for warnings, confirmations, and general questions (yes/no, dropdowns…), fitting
its content, responsive, and themeable — usable for anything that must grab the user's
attention or ask for input.

**Decision.** Build a **promise-based in-app dialog system**:
- `store/dialogStore.js` (Zustand singleton) holds a stack of open dialogs + resolvers.
- `components/common/dialog.js` is the imperative API — `confirm()`→`Promise<boolean>`,
  `alert()`→`Promise<void>`, `ask()`→`{action, values}` for rich questions (select/text
  `fields`). Callers do `if (!(await confirm(...))) return;`.
- `components/common/DialogHost.jsx` (mounted once in `App`) renders the stack via a
  portal; a content-fit, responsive, **themeable** card (style props → `--dlg-*` CSS
  custom properties, same pattern as `Stepper`) over a dimming overlay, with optional
  **click-outside/Esc dismiss**, an **X** for pure warnings, action **tones**
  (default/primary/danger), and Enter=primary.

**Consequences.**
- All existing call sites migrated; native dialogs are gone from the app.
- **No em dashes in notification text** (user preference) — messages reworded.
- The component file is **`DialogHost.jsx`, not `Dialog.jsx`**, to avoid a
  case-insensitive-filesystem collision with `dialog.js` (an extensionless import can
  resolve to the wrong one → the API's object default gets rendered → "Element type is
  invalid"). Keep this naming.
- Reusable going forward for any attention/interaction prompt (e.g. play mode, wizard).

### DDL-0006 — Wizard and PDF export are separate steps, both before play mode
**Date:** 2026-07-08

**Context.** The roadmap had **play mode** (Phase C) ahead of the **creation wizard**
(Phase D), and folded a "working PDF export" into the wizard step as an afterthought. On
reflection the two are unrelated deliverables — a guided *creation* flow vs. a *printable
sheet* — and both are more immediately useful than the on-the-go play interface (which needs
new mutable play-state, DDL-0004/Phase C1).

**Decision.** Split them and reprioritize:
- The **creation wizard** (Phase D) and the **PDF export** (new Phase E) are **separate
  steps**, no longer bundled.
- **Both come before play mode (Phase C).** New priority order after the spellbook (B2):
  **Wizard → PDF export → Play mode.** README roadmap items renumbered accordingly
  (11 Wizard, 12 PDF, 13 Play mode).

**Consequences.**
- Phase letters stay as stable identifiers (C = play mode, D = wizard, E = PDF), but the
  *order of work* is D → E → C. DDL-0004 (play mode is a separate interface) is unchanged —
  only its scheduling moves later.
- The Export menu's "PDF Sheet" mockup (already discoverable, disabled) is the entry point
  for Phase E.

### DDL-0005 — Foundry VTT is the single import/export format
**Date:** 2026-07-06

**Context.** The north star is full Foundry-VTT compatibility (DDL-0001). The builder had
been shipping **two** export buttons — a Foundry actor `.json` and an internal
`.builder.json` (re-importable in the roster). Maintaining two serialization formats (and a
builder-only import path) duplicates effort and drifts from the goal.

**Decision.** **Foundry (dnd5e actor `.json`) is the ONLY import/export format.** The app
should be able to both **export to** and (eventually) **import from** Foundry. The
`.builder.json` export is removed; the builder shows a single **"Export"** button producing
the Foundry actor. Characters continue to live in IndexedDB (Dexie) as the working store —
export/import is the interchange boundary, and that boundary is Foundry-shaped.

**Consequences.**
- Export effort concentrates on one target; our generated actor is kept **structurally
  identical to a Foundry-native export** (advancement as an `_id`-keyed object, `_stats`
  blocks, full `source`, fluff descriptions — see CHANGELOG §11).
- **Reverse import (Foundry actor → builder decisions) is still TODO** — today the roster
  import only accepts the builder shape and rejects a Foundry actor. Until the reverse
  mapping exists, a round-trip back *into the builder* isn't possible; this is the next
  Foundry-compat milestone. (The engine's "decisions, not computed state" model means the
  importer must infer choices from the actor's items/advancement values.)
- Supersedes the two-format approach; does not change the engine or storage.

### DDL-0004 — Play mode is a separate interface, not a tab in the builder
**Date:** 2026-07-04

**Context.** The final goal includes an on-the-go **play mode** (run a character at an
in-person table: roll, track HP/resources). Building it *inside* the builder would clutter
both and entangle two very different purposes (create/edit vs. run a session), which also
have different UX needs (the builder is edit-heavy; play mode is mobile-first, glanceable,
tap-to-roll).

**Decision.** Play mode lives in its **own interface / route** (e.g. `/play/:id`), entered
via a **"Play" button on the character card (Home)** and/or on the sheet page — not as
another builder tab. Build and play share the **engine/derivation** but have **separate UIs**.

**Consequences.**
- Play mode can be developed (or ignored) independently; the builder stays uncluttered.
- Needs a mutable **play-state** on the character schema (session state: current/temp HP,
  spent hit dice, spell slots, resources, conditions, death saves, inspiration), separate
  from the build **decisions**. Additive field + `schemaVersion` bump & migrate (Phase C1).
- Both interfaces read the same derived numbers from the pure engine.

### DDL-0003 — Licensing: Plutonium is off-limits; the dnd5e system is the licensed reference
**Date:** 2026-07-04
**⚠ Partly superseded by DDL-0009 (2026-07-09):** the `foundry-*.json` overlay is **not**
Plutonium's — it originates in the MIT-licensed 5e.tools repo and is fetchable from our mirror.
Read DDL-0009 before acting on the overlay paragraphs below. Everything else here still holds.

**Context.** We wanted to reuse Plutonium's `foundry-*.json` mechanical overlay (DDL-0001
findings) and ideally fetch it at runtime like we fetch 5e.tools. Checked the licences.

**Findings.**
- **Plutonium** — `module.json` says `"license": "UNLICENSED"` (all rights reserved). It's
  a **paid Patreon** module by Giddy/TheGiddyLimit, distributed via a **gated** GitHub
  repo (`plutonium-next` releases). There is **no public data mirror** and **no permissive
  licence**. So we **cannot bundle, fetch, or redistribute** its data. It may only serve as
  a **private reference** for our own understanding (we own a local copy) — never copied into
  the product.
- **5e.tools** — code is **MIT**; our app already fetches data at runtime from the public
  community mirror (`raw.githubusercontent.com/5etools-mirror-3/...`), cached client-side,
  not bundled (see `src/data/config.js`). Covers all content structurally (as prose).
- **Foundry dnd5e system** — code is **MIT** (`foundryvtt/dnd5e`, public on GitHub); the
  compendium content in `packs/_source/**` is the **SRD subset** (WotC 5.x SRD under
  CC-BY-4.0 + 2024 free rules). It contains full Foundry **class/subclass/feature items with
  `advancement[]` + Active Effects** (e.g. `classes24/fighter/fighter.yml`). This is the
  **canonical, licensed reference** for the Foundry format and Active-Effect keys, and its
  SRD items are directly reusable with attribution.

**Decision.**
- **Do not use Plutonium data** in the product (bundle or fetch). Reference only, privately.
- **Generate the advancement skeleton** (HitPoints / Trait / ItemGrant / ASI / Subclass /
  ItemChoice) ourselves from the 5e.tools structured fields we already fetch.
- Use the **Foundry dnd5e system source** (MIT + SRD/CC) as the spec/reference for the item
  and Active-Effect encoding, and reuse its SRD items where helpful (with attribution).
- **Author our own small Active-Effects registry** for prose-only mechanics, using the dnd5e
  system's **public AE keys/modes** (a documented API — facts, not Plutonium's expression).

**Consequence.** No licence/update headaches from Plutonium; our mechanical layer is either
generated from MIT-licensed 5e.tools data or authored by us against the MIT dnd5e system's
public API. Attribute SRD/CC content per CC-BY-4.0 when we ship.

### DDL-0002 — Two known problems being solved in/after phase 6
**Date:** 2026-07-04

**Context.** Two gaps identified while continuing phase 6:
- **Problem 1 — missing selectors.** The class-choice list was built from
  fragmented, name-hardcoded paths, so grants that didn't match were never shown
  (Artificer tool choice, Ranger "Deft Explorer" expertise+languages, Wizard
  "Scholar" expertise, all named differently from what the code matched).
- **Problem 2 — features have no mechanical effect.** Only abilities/HP/saves/
  proficiencies derive; most chosen features are inert. The end goal is Foundry
  export, so features need real mechanical representation.

**Decision.** Sequence: **do Problem 1 first (quick), then build Problem 2.**

**Status.**
- ✅ Problem 1 first pass **2026-07-04** (commit `69f970a`): curated
  `NAMED_FEATURE_GRANTS` (Deft Explorer, Scholar) + `classToolChoices()` reading the
  structured `toolProficiencies` field, tool-picker category restriction, structured
  fixed-tool derivation, and `ownedFromDb` dedup vs. auto-grants.
- ✅ Selector-coverage audit **2026-07-04**: swept every class/subclass feature for
  choice structures. Added "choose one of the following" **sub-feature option** selectors
  for both structured (`type:'options'`) and prose-only cases via a curated flag +
  extraction from the feature's own sub-entries (`featureOptions.js`:
  `subclassFeatureOptionChoices`, `CHOOSE_ONE_FEATURES`) — Blessed Strikes, Hunter's Prey,
  Wild Heart, Armor Model, Champion's Additional Fighting Style (feat), etc. Confirmed the
  subclass `options`+refSubclassFeature cases (Genie/Psi Warrior/Soulknife) are NOT real
  choices (grant all) and correctly stay hidden. Spell/cantrip choices deferred to the
  Spellbook phase (B2).
- ✅ Problem 1 completed **2026-07-04** (systematic sweep of every class/subclass
  feature): added subclass-feature choice generation (`subclassFeatureChoices`,
  iterating the raw `class-X.subclassFeature` pool because XPHB inlines real features
  under an umbrella feature via `refSubclassFeature`), a `subclass|feature` grants
  map (Bard Lore, Battle Master, Fey Wanderer, Cleric Order/Peace), Barbarian Primal
  Knowledge, and the Bard `{any:N}` skill fix. Grant→Choice via a shared
  `grantChoices()` helper; skill/expertise pools finalized in ClassTab (`resolvePool`).
- ⏳ Deferred grant cases (belong to the effects layer / niche, not blocking): Monk's
  "artisan OR instrument" (renders two selectors); the expertise pool still excludes
  AUTO-granted proficient skills; conditional grants ("if you already have X, choose
  another" — Artificer subclass tools); weapon-proficiency choices (Bladesinging) —
  weapons aren't individually chosen in our model; saving-throw proficiency choices
  (Gloom Stalker); sidekick classes; and FIXED subclass grants (Monk Mercy, Cleric
  Twilight/Protector, Druid Warden…) which are auto-proficiencies for the effects layer.
- ⏳ Problem 2 — not started (see DDL-0001).

### DDL-0001 — Effects & Foundry export architecture → **Option B (Foundry-Item model)**
**Date:** 2026-07-04

**Context.** For Problem 2, features' mechanical effects live only as **prose** in
5e.tools data. We need an internal representation of those effects that also drives
the Foundry `.json` export. Three options were weighed: (A) a curated typed
effect-registry we derive from ourselves; (B) represent each pick as / mapped to a
**Foundry Item** (with Active Effects / advancements) from the start, derive the
sheet from that, and export ≈ serialize; (C) an incremental hybrid.

An earlier (lost) chat had begun **Option A** — a curated effects registry — which
is why `src/engine/featureEffects.js` today holds a tiny `FEATURE_EFFECTS` map
(`protector`, `warden` from Divine/Primal Order). That work is not wasted: the task
of "discover each feature's mechanical effect" is needed under any option.

**Decision.** Adopt **Option B — the Foundry-Item model.** Represent each chosen/
granted feature as (or mapped to) a Foundry Item with Active Effects; derive the
live sheet from that representation; the export becomes a near-serialization.

**Rationale.**
- The end goal *is* Foundry JSON — modeling in the target shape removes a translation
  layer and a whole class of drift bugs.
- We now have **17 real Foundry actor exports** (`…\Character Sheets`) plus the dnd5e
  system source, giving concrete input→output examples and the exact Active-Effect
  encodings — so Option B no longer requires guessing during curation, which was the
  main argument against it.

**Consequences.**
- Problem 2 work should **start by reverse-engineering** the real exports: fix the
  target schema from examples (not assumptions), catalog the Active Effects Foundry
  uses for common features, and build export fixtures (generate our actor → diff
  against the matching real export).
- **Player sheets caveat:** the user's players (`lili/melina/ohma/throgan/etienne`)
  were built with **Plutonium + some homebrew**, so they can differ from the official
  premades (`fvtt-Actor-*`). Treat the **premades as the canonical schema reference**;
  use player sheets as real-world (homebrew-aware) examples, not as schema ground truth.

**Status (2026-07-04).**
- ✅ First slice: the actor **`system` block** exporter (`engine/foundryExport.js`) —
  generalized translator (abilities, save/skill proficiency, tools, traits, XP, HP)
  using standard dnd5e enumeration tables. Validated by a **closed-loop test** against
  `etienne.json` (the Fighter 6 that also backs the engine fixture): decisions →
  derivation → Foundry `system` matches the real export.
- Key schema learning confirmed: the Foundry actor is a **shell**; derived stats
  (modifiers, saves, HP max, AC, speed, senses) are recomputed by Foundry from
  `items[] + Active Effects`. `details.race/background/originalClass` are item `_id`
  references.
- ✅ Second slice: the **class-item `advancement[]` generator** (`engine/foundryAdvancement.js`)
  — generates HitPoints / Trait (saves, skill choice, weapons, armor, weapon mastery) /
  AbilityScoreImprovement (ASI + Epic Boon levels) / Subclass from the 5e.tools structured
  data, no Plutonium dependency (DDL-0003). Validated against **both** real Fighter exports:
  Randal (premade, official full advancement) and Étienne (Plutonium, reduced subset), plus
  the MIT dnd5e source. Deferred within the class item: ItemGrant (feature items), ItemChoice
  (Fighting Style), ScaleValue — all need compendium item references.
- ✅ Third slice (Phase A2, partial): **feature Items + Active Effects registry**
  (`foundryItems.buildClassFeatureItems`, `foundryEffects.js`) — each class feature →
  a Foundry `feat` Item (subtype `class`); a curated AE registry attaches `{key,mode,
  value}` changes (dnd5e public keys) for prose-only mechanics; the class item wires an
  `ItemGrant` per level to the feature items. Validated on the real Fighter (L6).
- ✅ A2/A3 items shipped: subclass Items + subclass feature Items; species Items
  (`buildSpeciesItem`, lineage-aware); background Item (`buildBackgroundItem`, ASI + skill
  Trait from the custom origin).
- ✅ A4 **DONE & validated in Foundry**: `engine/foundryActor.js` `assembleFoundryActor`
  composes the full `Actor` (system + items[] + details refs); the single **"Export"**
  button downloads `<name>.json`. The `.json` **imports into Foundry (dnd5e 5.3.3)** with
  class, subclass, feats, proficiencies and HP all correct. Getting there closed three
  real import bugs (each caught by diffing our export against the premades + the Foundry
  console): chosen feats/ASI weren't exported as Items; `advancement` had to be an
  `_id`-keyed object with applied `Trait.value.chosen`; `hp.max` must be `null` (else the
  sheet goes manual-HP); and the class's Subclass advancement `value.uuid` **must not** be
  a relative UUID (strict `DocumentUUIDField` → invalidated the whole class Item → "level
  0, no class") — we now write only `value.document`.
- ⏳ Next (export polish, non-blocking — see §4 "A-remaining"): `ScaleValue` tables and
  `uses`/`activities` on feature items (make an imported sheet tap-to-roll & resource-
  tracking); tool/language Traits on the background; real compendium UUIDs. Then Phase B
  (equipment + spell Items). The AE registry grows as we curate more features.
- The existing `featureEffects.js` curated registry folds in as the "what does this
  feature do" knowledge; the *representation* moves toward Foundry Items/AEs.
- Reconciliation with the prior chat's Option-A direction is intentional and
  explicit (this supersedes it).

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

### 4.5 T1b — plano de blocos das ESPÉCIES (fixado 2026-07-25)

T1a fechou (as 135 linhas `class:*` estão `ui: ok`). T1b são as **~150 linhas
`species:*`** de `testing/COVERAGE.md`, quase todas `todo`. Diferente das classes
(uma classe + subclasses por sessão), aqui o eixo natural é **procedência + grau
de curadoria**: as três queixas do usuário — *por source*, *legacy × atualizado*,
e *as linhagens adaptadas individualmente num bloco à parte* — se resolvem numa
divisão em **5 blocos**, testados nesta ordem (valor decrescente e risco
decrescente do código). Cada bloco é 1-3 sessões de ~10-12 linhas (§4.2); linhagens
que compartilham a MESMA base (Dragonborn ×10, Goliath ×6…) contam como leves — a
base se repete, muda só o seletor de linhagem, então cabem mais numa sessão.

Regra transversal: rodar `npm run sweep` verde antes de cada sessão; usar o
checklist de espécie do §4.3 por linhagem; **fix small, log big** (§4.1). Os
"itens de atenção" abaixo são mecânicas especiais que já têm DDL/TC próprios — cada
um DEVE ser conferido ao vivo na sessão do seu bloco, não presumido pelo sweep.

#### Bloco S-A — Núcleo 2024 (XPHB mainstream) · ~28 linhas · 2 sessões
As espécies que um jogador novo escolhe primeiro; têm de ser impecáveis. É a
baseline visual/de derivação contra a qual os outros blocos se comparam.
- **S-A1 (bases + linhagens curtas) - DONE 2026-07-25 (9 linhas `ui: ok`, zero bugs):** Aasimar,
  Dwarf, Human, Orc (sem linhagem); Elf|XPHB núcleo (Drow/High/Wood); Gnome (Forest/Rock).
- **S-A2 (muitas linhagens do mesmo padrão) - DONE 2026-07-25 (19 linhas `ui: ok`, TC-0051
  fixed):** Dragonborn|XPHB ×10, Goliath|XPHB ×6, Tiefling|XPHB núcleo (Abyssal/Chthonic/Infernal
  — as 3 legacies OFICIAIS 2024).
- **Atenção:** escolha de tamanho S/M (DDL-0017) em várias; a linhagem élfica
  adia `skillProficiencies`? não — Keen Senses permanece (DDL-0061/`lineageDeferredKinds`).
  Tiefling sem linhagem NÃO deve mostrar os chips de resist/spell list (DDL-0061 §69).

#### Bloco S-B — Linhagens ADAPTADAS individualmente (o bloco à parte pedido) · ~23 linhas · 2 sessões
Maior RISCO da campanha: são caminhos de código NOSSOS (DDL-0059…0066), com
migração de ficha e texto montado do dado. Vem cedo porque o contexto está fresco
no DDL log e várias linhas já são `ui: ok` (foram rep-builds), então o bloco em
parte se autovalida. Conferir contra o DDL citado, não só "renderiza".
- **S-B1 (Tiefling reescritos, DDL-0061) - DONE 2026-07-25 (11 linhas `ui: ok`, TC-0052
  fixed):** as 11 legacies (Baalzebul, Dispater, Fierna, Glasya, Levistus, Mammon,
  Mephistopheles, Zariel, Devil's Tongue, Hellfire, Winged). **Atenção:** resistência TRAVA em
  fogo; atributo de conjuração é escolha Int/Wis/Cha; magias remapeadas para XPHB (Branding
  Smite→Shining Smite); Winged = voo no nível 1; a tabela do preview lista as 14 opções
  (`withLegacyTable`).
- **S-B2 (o resto da curadoria):** Elf (Pallid) [DDL-0060 lineage], Elf
  Lorwyn/Shadowmoor + Fairy Faerie Lorwyn/Shadowmoor [DDL-0066 merged — **conferir
  a ARTE por linhagem**, DDL-0066 amendment: os arquivos do Elf LFL estão trocados
  no dado], Halfling Lightfoot/Stout/Ghostwise/Lotusden [DDL-0063 swap, já `ok` —
  validar Stout=resist. veneno, Lotusden=origem de magia Wis], Human (Keldon)
  [DDL-0060 species], Custom Lineage ×2 [DDL-0062, já `ok` — seletor "Variable
  Trait", talento ORIGIN, sem atributo legado].

#### Bloco S-C — MPMM (Monsters of the Multiverse, reformatados) · ~31 linhas · 3 sessões
Espécies 2014 reformatadas para o padrão moderno; entram como linhagens/bases via
`raceLineages`. Aarakocra, Bugbear, Centaur, Deep Gnome, Duergar, Eladrin, Fairy
(base), Firbolg, Genasi ×4, Githyanki, Githzerai, Goblin, Harengon, Hobgoblin,
Kenku, Kobold ×3, Lizardfolk, Minotaur, Satyr, Sea Elf, Shadar-Kai, Tabaxi,
Tortle, Triton, Yuan-Ti.
- **Atenção:** **Tortle** = armadura natural flat (DDL-0034); **Kobold** = seletor
  "Kobold Legacy" com perícia/magia adiadas (TC-0046/0047, tem nota de UI PENDENTE
  no COVERAGE — fechar aqui); Genasi = resistência por elemento na ficha.

#### Bloco S-D — Outros livros modernos · ~28 linhas · 2-3 sessões
AAG (Astral Elf, Autognome, Giff, Hadozee, Plasmoid, Thri-kreen), EFA (Changeling,
Kalashtar, Khoravar, Warforged), RHW (Dhampir, Hexblood, Reborn, Lupin), SCC
(Owlin), GGR (Loxodon, Vedalken, Simic Hybrid), MOT (Leonin), FTD (Dragonborn Gem
×5), OGA (Grung), DSotDQ (Kender), LR (Locathah), AI (Verdan).
- **Atenção:** **Autognome/Warforged** = armadura natural unarmored/bonus
  (DDL-0034); **Verdan** = tamanho por nível (S→M no 5º, DDL-0017 — nunca é escolha);
  **Simic Hybrid** = idioma "other" mostra "Other" no seletor (cosmético conhecido,
  TC-0050/DDL-0062 — não é bug); Dragonborn Gem = tipo de dano do sopro + voo.

#### Bloco S-E — CENÁRIO / legado (atrás do filtro "Setting Variant") · ~36 linhas · 2-3 sessões
Menor prioridade (2014-era, escondidas por padrão pelo filtro DDL-0064). Passada
mais leve: confirmar que constroem, derivam e não vazam `{@tag}`; polish vai para
`needs-user-eyes`.
- **LFL (Lorwyn, oficial 2024 mas de cenário):** Boggart, Flamekin, Kithkin
  Lorwyn/Shadowmoor, Lorwyn Changeling, Rimekin.
- **Plane Shift (PS*):** Aetherborn, Aven ×2, Dwarf (Kaladesh), Elf (Kaladesh) ×2,
  Elf (Zendikar) ×3, Goblin ×4, Human (Innistrad) ×3, Khenra, Kor, Merfolk ×5,
  Minotaur (Amonkhet), Naga, Orc (Ixalan), Siren, Vampire ×2, Vedalken (PSK).
- **Atenção:** conferir que o filtro "Setting Variant" pré-marcado ESCONDE as que
  colidem de nome e um clique no chip as revela (DDL-0064); as vazias já foram
  REMOVIDAS (não devem aparecer nem com o filtro desligado).

**Ordem e ajuste.** A ordem S-A → S-B → S-C → S-D → S-E é mainstream/alto-valor
primeiro, cenário/legado por último, com o bloco de código próprio (S-B) logo em
seguida enquanto o contexto está quente. É ajustável — se o usuário preferir varrer
o legado antes, os blocos são independentes.

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

- **2026-07-25 (4)** - **T1b sessão 3: Bloco S-B1 CONCLUÍDO (11 linhas `ui: ok`) - TC-0052 fixed.**
  O bloco de maior RISCO da campanha (código NOSSO, DDL-0061). Sweep verde antes (285/285
  `--strict`). Método: li o `engine/legacyFiendishLegacies.js` PRIMEIRO e montei a tabela esperada
  (cantrip / L3 / L5 / upcast / extras por legacy), depois conferi cada uma ao vivo contra ela - as
  11 batem exatamente. **Resistência travada em fogo** nas 11; **as 4 sem cantrip próprio**
  (Baalzebul/Dispater/Zariel/Hellfire) têm a frase do cantrip CORTADA, não vazia; **os 7 upcasts
  `#2`** aparecem só onde devem; **Zariel deriva `Shining Smite`** (o único remap manual) - build
  Fighter 5 ao vivo com Searing Smite 1/Day @3 + Shining Smite 1/Day @5, card USES e DAMAGE
  RESISTANCES: Fire; **Winged** deriva "Speed 30 ft, fly 30 ft" e Spellbook só com Thaumaturgy;
  as 3 do SCAG trazem o traço "Appearance". Atributo de conjuração Int/Wis/Cha em todas (Wisdom →
  DC 10 / +2).
  **TC-0052 FIXED em sessão (transversal):** escolher uma legacy legada trocava a LORE da espécie
  para o texto de 2014. A cadeia do `raceEntity.fluff` terminava num `find(name === baseName)` - a
  PRIMEIRA entrada de mesmo nome - porque MTF/SCAG/EGW não têm fluff da espécie. Não era sabor
  preservado, era ordem de array (o `Elf (Eladrin)` pegava lore E arte do Elf de **Lorwyn**). Fix:
  `buildVariant` grava `_baseSource` (convenção que o `mergeSubrace` já tinha) + um passo
  `baseName + _baseSource` antes do fallback por nome puro. **Sonda sobre o compêndio real: 14
  linhas mudaram, 0 regressões** (as fundidas do DDL-0066 resolvem num passo anterior). Também
  corrigiu Halfling Ghostwise/Lotusden. Ver DDL-0071.
  1141 testes (+3), lint, sweep 285/285 `--strict`, mobile 375px sem overflow, zero erros de console.
  **Nota de harness:** o `.click()` via `javascript_tool` NÃO move o preview do SelectorPanel (ele
  segue `hovered`, DDL-0048) e, após muitos hot-updates, cliques por `ref` param de responder -
  recarregue a página e clique por COORDENADA VISUAL de screenshot (a pane compõe frames depois do
  primeiro screenshot bem-sucedido). Ler o preview por JS funciona sempre.
  **Next action: T1b sessão 4 - Bloco S-B2** (o resto da curadoria, ~12 linhas): Elf (Pallid)
  [DDL-0060 lineage], Elf Lorwyn/Shadowmoor + Fairy Lorwyn/Shadowmoor [DDL-0066 merged - **conferir
  a ARTE por linhagem**: os arquivos do Elf LFL estão TROCADOS no dado e há override curado],
  Halfling Lightfoot/Stout/Ghostwise/Lotusden [DDL-0063 swap, já `ok` - validar Stout=resist.
  veneno e Lotusden=origem de magia Wis], Human (Keldon) [DDL-0060 species], Custom Lineage ×2
  [DDL-0062, já `ok`]. As linhas do Halfling acabaram de ganhar a lore 2024 pelo TC-0052 - conferir.

- **2026-07-25 (3)** - **T1b sessão 2: Bloco S-A2 CONCLUÍDO (19 linhas `ui: ok`) - TC-0051 fixed.**
  Sweep verde antes de começar (285/285 `--strict`). Passada de UI ao vivo (~1000/800px + spot-check
  375px sem overflow) sobre **Dragonborn|XPHB** (as 10 ancestralidades presentes no seletor de
  linhagem; preview resolve o tipo de dano por ancestralidade - Black→Acid, Red→Fire; selecionado Red
  ao vivo: "1d10 Fire damage" + "Resistance to Fire" na ficha, Draconic Flight @5 renderiza),
  **Goliath|XPHB** (as 6 ancestralidades de gigante; preview resolve só o benefício escolhido -
  Cloud's Jaunt e Stone's Endurance testados ao vivo; Large Form @5 + Powerful Build) e o **núcleo do
  Tiefling|XPHB** (as 3 legacies OFICIAIS 2024 - Abyssal/Chthonic/Infernal, cada uma selecionada ao
  vivo com resistência+cantrip corretos + a escolha de atributo Int/Wis/Cha; Infernal com Charisma
  escolhida deriva DC 10/Attack +2 na Spellbook, Fire Bolt+Thaumaturgy Always Prepared; reconfirmado
  que SEM linhagem a ficha não mostra chip de resist/spell-list, DDL-0061 §69).
  **TC-0051 FIXED em sessão:** a legacy Abyssal exibia "120 ft / Darkvision" (preview e ficha), único
  caso entre as 14 legacies do dataset - as outras 13 (incl. Chthonic/Infernal oficiais) não tocam o
  campo. Confirmado como erro do DADO upstream (JSON cru do 5e.tools carrega `darkvision: 120` sem
  nenhuma entry de prosa correspondente) via cross-check contra o SRD oficial (dnd5e system,
  CC-BY-4.0, `tiefling-abyssal.yml`: "Darkvision. You have Darkvision with a range of 60 feet.").
  Fix: novo registro `KNOWN_DATA_FIXES` em `engine/speciesData.js`, aplicado dentro de `buildVariant`
  por chave exata `Raça|Fonte/Versão` - corrige só o campo errado. Ver DDL-0070.
  1138 testes (+2), lint, sweep 285/285 `--strict`, mobile 375px sem overflow, zero erros de console.
  **Next action: T1b sessão 3 - Bloco S-B1** (as 11 legacies REESCRITAS do Tiefling, DDL-0061:
  Baalzebul/Dispater/Fierna/Glasya/Levistus/Mammon/Mephistopheles/Zariel/Devil's Tongue/Hellfire/
  Winged) - maior risco de código da campanha (caminho NOSSO de merge/reescrita), conferir contra o
  DDL citado: resistência TRAVA em fogo, atributo de conjuração é escolha Int/Wis/Cha, magias
  remapeadas para XPHB (Branding Smite→Shining Smite), Winged = voo no nível 1, tabela do preview
  lista as 14 opções (`withLegacyTable`).

- **2026-07-25 (2)** - **T1b sessão 1: Bloco S-A1 CONCLUÍDO (9 linhas `ui: ok`) - ZERO bugs.** Sweep
  verde antes de começar (285/285 `--strict`). Passada de UI ao vivo (mobile-first, ~560/820px + spot-
  check 375px sem overflow) sobre as bases 2024 XPHB e os núcleos de linhagem de Elf/Gnome:
  **Aasimar** (escolha de tamanho S/M com link glossário "Size"; Light cantrip Cha na origem de raça da
  Spellbook, DC 9; Celestial Revelation em opções estruturadas; lightbox de imagem OK), **Dwarf**
  (sem sub-escolhas; Dwarven Toughness deriva HP 14->15 @1; filtro esconde Kaladesh - 1 resultado),
  **Human** (os 3 pickers - size, any-skill 14, Origin feat 24 categoria-correta - filtram e persistem;
  chip do feat com botão ℹ️ DDL-0021), **Orc** (Adrenaline Rush/Darkvision 120/Relentless Endurance;
  sem Powerful Build, correto p/ 2024), **Elf** (os 6 da linhagem aparecem - Drow/High/Wood + Lorwyn/
  Shadowmoor FOLDED DDL-0066 + Pallid, sem "Elf|LFL" duplicado; Drow: Darkvision 120 + Dancing Lights;
  High: seletor "Choose a Wizard cantrip" 24 opts pré-marcado; Wood: Speed 35 + Druidcraft; Keen Senses
  fica visível e o spellcasting-ability é adiado p/ depois da linhagem, DDL-0061), **Gnome** (Forest +
  Rock; Gnomish Cunning; **TC-0044 CONFIRMADO ao vivo** - Forest concede Minor Illusion + Speak with
  Animals 2/Day ambos @1). Todos com links de glossário resolvendo, zero `{@tag}` vazado, escolhas
  persistindo, derivações corretas (HP/Darkvision/Speed/magias concedidas). Nenhuma mudança de código -
  suíte/lint inalterados. Ledger sem itens novos e sem nenhum item aberto (TC-0043 foi fechado em
  2026-07-22, DDL-0054 - a nota "único aberto TC-0043" de sessões T1b anteriores estava desatualizada).
  **Nota de harness:** o SelectorPanel a <=760px é MOBILE (tela de detalhe cheia via portal) e os cliques
  por `ref` do read_page caem em coordenadas erradas nesse app - usar viewport ~820px (SelectorPanel em
  3 painéis: filtros+lista+preview c/ Select, estável) e coordenadas VISUAIS de screenshot; `form_input`
  por ref funciona sempre. Tutoriais foram DESLIGADOS pelo menu ☰ (auto-disparam em install nova).
  **Next action: T1b sessão 2 - Bloco S-A2** (Dragonborn|XPHB ×10, Goliath|XPHB ×6, Tiefling|XPHB núcleo
  Abyssal/Chthonic/Infernal): muitas linhagens do MESMO padrão (base repete, muda o seletor de linhagem)
  - conferir tipo de dano do sopro/ancestralidade e que o Tiefling SEM linhagem não mostra chips de
  resist/spell list (DDL-0061 §69).

- **2026-07-25** - **T1b PLANEJADA: as ~150 espécies divididas em 5 blocos (§4.5).** Nenhuma
  linha testada nesta sessão - só o plano. Eixo: procedência + grau de curadoria, respondendo
  as três queixas do usuário (por source / legacy × atualizado / linhagens adaptadas num bloco
  à parte). Ordem: **S-A** núcleo 2024 XPHB (~28, 2 sessões) → **S-B** linhagens ADAPTADAS por
  nós (~23, 2 sessões, maior risco de código) → **S-C** MPMM (~31, 3 sessões) → **S-D** outros
  livros modernos (~28, 2-3 sessões) → **S-E** cenário/legado atrás do filtro (~36, passada leve).
  Cada bloco carrega seus "itens de atenção" (armadura natural DDL-0034, tamanho por nível
  DDL-0017, Tiefling reescrito DDL-0061, arte das linhagens fundidas DDL-0066, Kobold TC-0046/0047
  pendente…). **Next action: T1b sessão 1 - Bloco S-A1** (bases + Elf/Gnome núcleo); rodar o
  sweep verde antes. O único item aberto do ledger segue sendo `TC-0043` (needs-user-eyes).

- **2026-07-22 (5)** - **Foundry level-up + overlay: três levas fora da campanha, a pedido do
  usuário** (DDL-0055/0056/0057, CHANGELOG §63-65). Relato dele: exportar um Barbarian 1, importar
  no Foundry e subir pro 2 não concedia Reckless Attack/Danger Sense. Causa: o item de classe só
  levava `ItemGrant` dos níveis JÁ alcançados (uuid relativo a itens embutidos), enquanto os
  premades trazem a escada INTEIRA (1..20) com uuid de compêndio nos níveis futuros. Entregue:
  registro de UUIDs **gerado** do source do dnd5e (`npm run gen:uuids`), escadas de classe e
  subclasse (features + magias de subclasse), `compendiumSource` em todo item publicado, Traits de
  escolha no nível delas (Expertise/Primal Knowledge/Deft Explorer/Bonus Proficiencies), Weapon
  Mastery com `mode: 'mastery'` e crescimento por breakpoint, import de premade recuperando essas
  escolhas, `classRestriction` primary/secondary vindo de `multiclassing`, e a **adoção completa do
  overlay** (activities/system/advancement + itens de traço de espécie). 1017 testes, lint, sweep
  274/274 `--strict`, 48 premades importados+re-exportados ok.
  **Impacto na campanha:** as fichas premade de nível 1/5/11 que o usuário adicionou ao material de
  referência são agora um gabarito muito melhor para a **T2** - compare o advancement gerado com o
  do premade do mesmo nível antes de marcar uma linha como `ok`. **Backlog: "criar em nível alto" e
  "sidekick/UA" foram CANCELADOS pelo usuário** (ver CLAUDE.md §4, "Explicitly OUT OF SCOPE") - não
  são mais pendências. **Next action: stage T1b - SPECIES + lineages** (inalterado).

- **2026-07-22 (4)** - **TC-0043 FIXED (DDL-0054) - the ledger has NO open items.** By user
  decision, with the scope widened by them from "warlock patrons" to **every list-widening
  mechanic**: a subclass/class feature that ADDS spells to your list (Genie/Hexblade/… Expanded
  Spell List, Divine Soul's whole cleric list, the Bard's Magical Secrets @10) now counts as
  "on-list" - no more wrong "not on the X spell list" warning, and the spells show under the
  pre-marked Class filter with a badge naming the source. New pure module
  `engine/spellListWidening.js`; the origin exposes `expandedSpells` + `expandedFrom`, consumed by
  the SpellbookTab and the guide's SpellPicker. **All derived from the data - no curated registry**
  (the Bard's Magical Secrets looked prose-only because of its `{@filter}` tags, but it is fully
  encoded on the CLASS's `additionalSpells`; the registry I had written for it was removed as
  redundant AND less accurate). Scope correction recorded in the ledger: `expanded` with loose
  names exists in exactly **9 subclasses, all Warlock** - legacy cleric domains/druid circles
  GRANT (`prepared`), they don't widen. 979 tests (+7), lint, sweep 274/274 `--strict`.
  See CHANGELOG §62 + DDL-0054. **Next action: stage T1b - SPECIES + lineages** (unchanged).

- **2026-07-22 (3)** - **T1a session 13: WIZARD + all 13 subclasses done** (all rows `ui: ok`).
  **T1a IS COMPLETE: every one of the 135 `class:*` rows is now `ui: ok`.** Sweep green before
  starting (274/274 strict). Rep build **Evoker**: guided create (**Gnome / Forest Gnome lineage /
  Magic Initiate (Wizard)** / Standard Array pre-filled with the Wizard spread) -> L1 HP 8, AC 11,
  slots 1st x2, DC 13, atk +5, 3/3 cantrips, 4/4 prepared; overlay level-ups 1->3 (Scholar
  Expertise @2 with the pool correctly restricted to already-proficient skills, and the step list
  REBUILT live after the pick; subclass @3 + the two Evocation Savant spell chooses, pool = the
  data's own filter expression - Evocation, level <= 2); then 19 via the Class-tab stepper
  (**HP 116, PB +6, slots 4/3/3/3/3/2/1/1/1, DC 19, atk +11, 5/5 cantrips, 24/24 prepared**, badge
  **13** = 5 feat slots + 7 savant chooses + spells). **DDL-0034 caps live:** 4 ASIs saturate Int
  at 20, the Epic Boon lifts it to **21**.
  **All 13 subclasses swapped @19:** the 4 PHB schools, War XGE, Chronurgy/Graviturgy EGW, Scribes
  TCE, Abjurer/Diviner/Evoker/Illusionist XPHB, Bladesinger FRHoF - zero `{@tag}` leaks. The four
  XPHB ones emit their 9 spell chooses (2 @3 + one per new slot level) with the right pool per
  level; Diviner renders **The Third Eye** @10 (3 options) and its See Invisibility 1/Rest in the
  Uses card; Bladesinger carries the curated weapon grant + the skill choose restricted to
  Athletics/Performance/Persuasion. Mobile 375px no overflow; zero console errors.
  Findings - BOTH fixed in-session: **TC-0044** (Forest Gnome's Speak with Animals only granted at
  level 3 - the XPHB prose has no level gate but `additionalSpells` says 3; new curated
  `REGRADED_ADDITIONAL_SPELLS` registry that MOVES a grant between levels preserving its frequency
  structure - dataset-verified as the only such case), **TC-0045** (TRANSVERSAL: a legacy
  subclass's inlined sub-features rendered at their ORIGINAL level - Conjuration Savant/Minor
  Conjuration under "LEVEL 2" on a chassis where the subclass starts at 3; `subclassFeatureList`
  now propagates the umbrella's level to its direct refs. Display-only - the `level <= cls.level`
  gate could never grant early).
  972 tests (+5), lint, sweep 274/274 `--strict`. See CHANGELOG §61 + DDL-0053.
  **Next action: stage T1b - SPECIES + lineages** (§4.2: batches of ~10-12 rows; per-lineage
  checklist in §4.3). Start with the `species:` rows in `testing/COVERAGE.md`, all still `todo`;
  the Gnome Forest lineage row already carries a TC-0044 note. The ledger's only open item stays
  **TC-0043** (needs-user-eyes, legacy `expanded` subclass lists in the spell picker).

- **2026-07-22 (2)** - **T1a session 12: WARLOCK + all 9 subclasses done** (all rows `ui: ok`).
  Sweep green before starting (274/274 strict). Rep build **Hexblade**: guided create (Tiefling /
  Infernal legacy / size Medium / Tough) → L1 HP 12, AC 13 (kit Leather auto-equipped), **Pact
  (1st) ×1**, DC 13; then level 19 via the Class-tab Level field (HP 174 → **214** with the boon;
  Cha 20 saturated by the ASIs → **21** with the Epic Boon).
  **Pact Magic card:** `Pact (5th) ×4` plus **6th/7th/8th/9th "1/Long Rest"** rows, counters
  `2/4 CANTRIPS`, `2/15 PREPARED` and **`0/4 ARCANUM`** (DDL-0010). Preparing Eyebite (6th) badges
  the row **MYSTIC ARCANUM + 1/LONG REST** and counts against the arcanum, not the prepared limit.
  **Invocations:** 1 @1 → **10 @18**; 58 options total, prerequisites printed on the cards, the
  Met/Not Met/Unverifiable filter works, already-picked ones leave the pool.
  **Hexblade's curated Hex Warrior grants** (Medium Armor / Shields / Martial Weapons) show on the
  Proficiencies card; base saves Wis/Cha correct.
  **Swaps @19:** Genie (spellSet Dao/Djinni/Efreeti/Marid), Fiend (Fiendish Resilience @10
  featureoption, 12 damage options; 11 granted spells), Fathomless (**Evard's Black Tentacles
  1/Day** in the Uses card), Archfey/Celestial/Great Old One/Undead/Undying - no `{@tag}` leaks;
  DDL-0049 correctly dropped the previous patron's granted spells each time. Mobile 375px no
  overflow; zero console errors.
  Findings: **TC-0041** (spell prerequisites printed just "Spell" - new `spellText` in
  `engine/prereq.js` ported from 5etools' `prereqSpellToFull`; fixed), **TC-0042** (Resilient never
  granted its saving-throw proficiency - new `deriveFeatSaveProficiencies`, tied to the feat's own
  ability pick per RAW; fixed), plus finishing **TC-0040** (the same stale `capitalize` rule lived
  on the CHIP styles: "Pact Of The Blade"). **TC-0043 is OPEN (needs-user-eyes):** legacy subclass
  EXPANDED spell lists don't count as "the class list" in the picker, so preparing Fireball on a
  Genie warlock warns "not on the Warlock spell list" - harmless (DDL-0026 lets it through) but
  wrong; three options recorded in the ledger.
  967 tests (+4), lint, sweep 274/274 `--strict`. See CHANGELOG §60 + DDL-0052.
  **Next action: T1a session 13 - WIZARD + its 14 subclasses, the LAST class batch** (largest
  remaining; the spellbook chassis is "prepared from a spellbook" - check the prepare counters and
  the level-up spell steps; Bladesinging TCE vs. Bladesinger FRHoF both carry curated
  `SUBCLASS_GRANTS` lines; Scribes/Chronurgy/Graviturgy are `_copy` stubs - verify their grants via
  TC-0027's resolution). After it, T1a is complete and T1b (species) begins.

- **2026-07-22** - **T1a session 11: SORCERER + all 10 subclasses done** (all rows `ui: ok`).
  Sweep green before starting (274/274 strict). **First full caster of the campaign** (Artificer/
  Eldritch Knight/Arcane Trickster were partial). Rep build **Draconic**: full guided create
  (Dragonborn **Red** lineage / Magic Initiate (Wizard) / Standard Array pre-filled with the
  Sorcerer spread), overlay level-ups 1→3, jump to 19 via the Class-tab Level field, fixup guide.
  **Derivations:** L1 HP 8 / AC 11; **L3 AC 14 = Draconic Resilience** (10 + Dex 1 + Cha 3, label
  shown in the AC breakdown - DDL-0045) and HP 23 (its +3/+1-per-level included); L19 **HP 213**
  (135 base+Resilience, +38 Tough, +40 Boon of Fortitude), slots **4/3/3/3/3/2/1/1/1**, DC 19,
  attack +11, prepared 21 / cantrips 6. **DDL-0034 caps live:** two +2 ASIs saturate Cha at 20,
  the Epic Boon lifts it to 21.
  **Metamagic:** 10 XPHB options in the picker, **2 @2 → 4 @10 → 6 @17**, chips + previews fine;
  the class table carries the **Sorcery Points** column (ScaleValue).
  **DDL-0040 verified on this chassis:** the guide's spell picker hides Prestidigitation/Fire Bolt/
  Magic Missile (Magic Initiate = CROSS origin) behind the pre-marked "Already Prepared" filter;
  the ASI slot pre-marks General (Tough only appears after clearing the filter, badged Origin) and
  the Epic Boon slot pre-marks Epic Boon (29 boons).
  **Subclass swaps @19:** Divine Soul (spellSet Good/Evil/Law/Chaos/Neutrality → Cure Wounds Always
  Prepared), Shadow (11 granted + Summon Beast badged "3 Charges" with a Uses-card entry, DDL-0011),
  Wild Magic (d100 Surge table renders), plus Storm/Lunar/Aberrant/Clockwork/Spellfire/Pyromancer -
  no `{@tag}` leaks. DDL-0049's reconciliation correctly dropped the previous subclass's granted
  spells on each swap. Mobile 375px no overflow; zero console errors.
  Findings - BOTH fixed in-session: **TC-0039** (Storm Sorcery never granted **Primordial** - Wind
  Speaker is prose-only; one `SUBCLASS_GRANTS` line, same family as TC-0032's Sylvan), **TC-0040**
  (the PickerField's `text-transform: capitalize` rendered "Boon **Of** Fortitude" - the DOM text
  was right; the CSS crutch predates TC-0016 and is now removed).
  963 tests (+2), lint, sweep 274/274 `--strict`. See CHANGELOG §59 + DDL-0051.
  **Next action: T1a session 12 - WARLOCK + its 9 subclasses** (Pact Magic: pact slots + the
  **Mystic Arcanum** semantics of DDL-0010 at 11/13/15/17, Eldritch Invocations as optional-feature
  picks with prerequisites, and the curated `warlock|hexblade` grants; Archfey's double-granted
  Misty Step is the DDL-0011 dedup case). Then WIZARD closes T1a.

- **2026-07-21 (4)** - **T1a session 10: ROGUE + all 10 subclasses done** (all rows `ui: ok`).
  **The ISSUES.md ledger now has NO open items** (TC-0021 was the last). This is NOT the same as
  T1a being finished: by alphabetical order **SORCERER, WARLOCK and WIZARD (32 rows) are still
  `todo`**. Sweep green before starting (274/274 strict). This session closed the last known real
  work in the ledger - **TC-0021's Rogue half** (DDL-0050).
  **The fix:** `weaponFilterAllows` (`engine/choices.js`) gained a CONDITIONAL field
  `martialRequiresAnyProp` - simple weapons pass unrestricted, martial weapons require one of the
  listed property codes. `MASTERY_FILTERS.rogue = { martialRequiresAnyProp: ['F', 'L'] }`
  (Finesse/Light). It flows for free through the two consumers that already routed via
  `weaponFilterAllows` (ChoiceList kind `weapon` + the sweep's autoBuild) - no other wiring.
  **Verified live:** Rogue Weapon Mastery selector = 21 options (all simple + martial Rapier/
  Scimitar/Shortsword/Hand Crossbow/Whip); "Longsword" = 0 results (martial, Versatile only,
  correctly barred); "Staff"/"Wooden Staff" appear because they are SIMPLE weapons (Versatile +
  Topple), not a regression. Rapier selectable, chip renders. Weapon Mastery count stays 2 at all
  levels (Rogue never scales).
  **Other checks:** Arcane Trickster (the only Rogue caster - third-caster INT: slots 1st×2, DC 10,
  0/2 cantrips, 0/3 prepared @3; "+ Prepare spell" picker pre-filtered to the Wizard list, 60
  results); Mastermind (curated Master of Intrigue grants - tool restricted to 4 Gaming Sets + 2
  languages); all 10 subclasses listed in the selector; @19 all Feat/Expertise/Epic-Boon slots
  render (Sneak Attack 10d6, PB +6). Mobile 375px no horizontal overflow; zero console errors. The
  other 8 subclasses are engine/sweep-verified (standard feature grants; Scout's Survivalist
  Expertise lives in subclassGrants).
  962 tests (+1, `choices.test.js`), lint, sweep 274/274 `--strict`. See CHANGELOG §58 + DDL-0050.
  **Next action: T1a session 11 - SORCERER + its 10 subclasses** (first full caster since the
  Wizard/Warlock are still pending too - check Metamagic optional-feature picks, the Sorcery Points
  resource, Draconic Resilience AC per DDL-0045, and per-subclass granted spells; then Warlock
  (Pact Magic + invocations + Mystic Arcanum DDL-0010) and Wizard to finish T1a).

- **2026-07-21 (3)** - **T1a session 9: RANGER + all 10 subclasses done** (all rows `ui: ok`).
  Sweep green before starting (274/274 strict). Third half-caster of the campaign (after
  Paladin). Rep build Gloom Stalker: full guided create (**Elf / Wood Elf lineage / Tough**) -
  verified the Wood Elf species choices (lineage + Keen Senses skill + spellcasting ability
  Wisdom + Druidcraft granted), the DDL-0032 "Skill" rule popup, **unrestricted Weapon Mastery**
  (DDL-0033, 40 opts), and the half-caster's two spell steps (**no cantrips** - Ranger has none;
  prepared only). **L1: HP 13 (d10 10 + Con 1 + Tough 2), AC 15 (Studded Leather 12 + Dex 3);
  DC 12 / atk +4 / slots 1×2.** Overlay level-ups 1→3 (Deft Explorer Expertise + 2 languages,
  Fighting Style, subclass @3), jump to 19 via the Class-tab Level field (**HP 175 = base 137 +
  Tough 38; slots 4/3/3/3/2 up to circle 5; PB +6; Favored Enemy 6; Prepared 15**).
  **Hunter's Mark (2024 class feature) + Disguise Self (Gloom Stalker @3) Always Prepared** (off
  the counter); **Longstrider (Wood Elf @3) 1/Day Always Prepared**; "+ Prepare spell" → "Remove
  a spell..." at the limit (R11).
  **TC-0038 fix confirmed on Ranger:** the guide's "+ Choose a spell" picker excludes SAME-origin
  always-prepared by hard exclude (searching "Hunter's Mark"/"Disguise Self" = 0 results) and
  CROSS-origin ones (Longstrider via Wood Elf) via the pre-marked removable "Already Prepared"
  filter (DDL-0040/TC-0031) - no duplicates, no key collision.
  **Iron Mind (Gloom Stalker @7) engine-verified:** grants Wisdom save proficiency FLAT (base
  ranger has only Str/Dex, so the conditional Int/Cha never fires) - `proficientSaves` = str/dex
  @L1, **str/dex/wis from L7** (the `ranger|gloom stalker` line in `subclassGrants.js`).
  All 10 subclasses' granted spells engine-verified @19 (legacy `_copy` stubs Horizon Walker/
  Monster Slayer/Swarmkeeper/Drakewarden derive via TC-0027; Fey Wanderer/Gloom Stalker/Winter
  Walker/Hollow Warden; Beast Master + Hunter correctly none). UI swaps @19: **Fey Wanderer**
  (Otherworldly Glamour @3 skill choose renders), **Hunter** (3 featureoptions render with
  selectable options), **Beast Master** (Primal Companion renders as PROSE - stat-block choice,
  not modeled; no selector by design, no `{@tag}` leak). Mobile (375px) no horizontal overflow
  (Class + Spellbook); zero console errors.
  **NO bugs found - zero code changes.** One non-bug UX note: on the Species screen, setting the
  lineage's *spellcasting ability* BEFORE picking the lineage itself resets the ability (it
  belongs to the lineage, so it re-derives when the lineage changes); the natural order (lineage
  first) never triggers it. 950 tests, lint, sweep 274/274 `--strict`. See CHANGELOG §55 + DDL-0047.
  **Next action: T1a session 10 - ROGUE + its 10 subclasses** (the OPEN half of TC-0021 becomes
  real work here: the Rogue's Weapon Mastery pool needs the conditional "Simple, or Martial with
  Finesse/Light" semantics that `weaponFilterAllows` can't yet express - extend `MASTERY_FILTERS`;
  Arcane Trickster is a third-caster - check its spell steps @3/7).

- **2026-07-21 (2)** - **T1a session 8: PALADIN + all 10 subclasses done** (all rows `ui: ok`).
  Sweep green before starting (274/274 strict). Rep build Devotion: full guided create
  (**Aasimar** / Tough - verified the size choice, the **holy-symbol itemGroup kit choose**
  Amulet/Emblem/Reliquary TC-0033, the DDL-0037 caster-intro copy TC-0037 correctly naming
  "Weapon Mastery and which spells to prepare" for the half-caster, and Weapon Mastery
  unrestricted 40 opts DDL-0033), overlay level-ups 1->3 (Fighting Style **Defense -> AC 19**
  live TC-0036; subclass @3 with oath spells Protection from Evil and Good/Shield of Faith
  Always Prepared + Channel Divinity/Sacred Weapon rendering), jump to 19 via the Class-tab
  Level field, fixup guide (badge **6** = 5 feat slots + spells; **DDL-0034 caps verified
  live: 4 x +Str feats saturate Str at 20, Boon of Irresistible Offense lifts to 21**;
  HP **175** = base 137 + Tough 38; slots **4/3/3/3/2 up to circle 5** half-caster).
  Subclass swaps @19: **Oathbreaker** (DMG `_copy`: all oath spells Always Prepared) and
  **Noble Genies** (FRHoF: Genie's Splendor @3 skill choose renders; oath spells incl. the
  **Elementalism cantrip** + Contact Other Plane Ritual all Always Prepared). Remaining 7
  oaths' spells engine-verified (Crown/Conquest/Redemption/Watchers legacy + Glory/Ancients/
  Vengeance XPHB). Mobile fine, no console errors.
  Finding - fixed in-session: **TC-0038** (the guide's "+ Choose a spell" picker offered the
  origin's OWN always-prepared spells - oath/Paladin's Smite/Faithful Steed grants - and let
  them be added as redundant chosen picks, producing duplicate "Aid" rows + a React key
  collision; `SpellPicker.jsx` `ownedNames` now includes `origin.alwaysPrepared`, mirroring
  the SpellbookTab prepare flow). 950 tests, lint, sweep 274/274 `--strict`.
  See CHANGELOG §54 + DDL-0046.
  **Next action: T1a session 9 - RANGER + its 10 subclasses** (half-caster like Paladin -
  the TC-0038 fix now covers its Favored Enemy / conclave granted spells too; check the
  Beast Master companion, Gloom Stalker's save-choice grant, and per-subclass Spellbook
  grants; Fey Wanderer/Horizon Walker carry curated grants).

- **2026-07-21** - **T1a session 7: MONK + all 10 subclasses done** (all rows `ui: ok`).
  Sweep green before starting (274/274 strict). Rep build Kensei: full guided create
  (Elf/Wood Elf lineage / Tough) - verified the whole create flow incl. the merged class
  tool choice **"Artisan's Tools or Musical Instruments"** (42 options, DDL-0002's
  artisan-OR-instrument), Wood Elf species choices (lineage + Keen Senses skill +
  spellcasting ability + granted Druidcraft/Longstrider/Pass without Trace), and the
  DDL-0032 "Skill" rule popup from a choice title. **Level-1 derivations: HP 11 (d8 8 +
  Con 1 + Tough 2), AC 15 = Unarmored Defense (10 + Dex 3 + Wis 2)** - both derive live;
  Martial Arts + Unarmored Defense features render. **Kensei `weaponProf` machinery
  verified live** (DDL-0030): @3 melee picker (21 opts, simple/martial MELEE, no
  Heavy/Special, zero ranged), @3 ranged picker (9 opts, **Longbow present via the `allow`
  exception**, Heavy Crossbow/Net absent, zero melee), @3 tool restricted to
  Calligrapher's/Painter's, @6 picker (32 opts, **any type** - melee AND ranged - no
  Heavy/Special, Longbow). @11/@17 share the @6 filter. Subclass swaps @19: **Elements**
  (Elemental Epitome @17 featureoption renders 5 options Acid/Cold/Fire/Lightning/Thunder;
  Elementalism cantrip in Spellbook Monk origin; AC 15 intact) and **Mercy** (Implements of
  Mercy grants Insight/Medicine + Herbalism Kit all render on the Proficiencies card).
  Remaining 8 subclasses' derivations engine-verified (Drunken Master Performance+Brewer's;
  Shadow Minor Illusion+Darkness; Sun Soul Burning Hands; Long Death/Astral Self/Ascendant
  Dragon/Open Hand correctly no grants). Mobile-width fine, zero console errors.
  **NO bugs found - zero code changes.** The ✦ badge counting is correct throughout (10 at
  L19 Kensei = 4 ASI + Epic Boon + Kensei tool + 3 @6/11/17 weapons + 1 `basic`, the
  documented DDL-0033/TC-0020 basic/fixup overlap for a prof-kind class choice). One
  **harness note for future sessions**: the ✦ badge's count lives in its `title`/accessible
  name ("N choices left"), NOT `textContent` (which is just "⚛N") - query the accessible
  name (read_page) or `.title`, and never trust a badge read taken during the compendium
  boot-load or right after a JS-dispatched change (both transiently read 0).
  944 tests, lint, sweep 274/274 `--strict`. See CHANGELOG §52 + DDL-0044.
  **Next action: T1a session 8 - PALADIN + its 10 subclasses** (half-caster: check the
  spell steps and the Channel Divinity / oath-spell grants; several oaths grant fixed
  proficiencies/spells - check the Proficiencies + Spellbook cards per oath).

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

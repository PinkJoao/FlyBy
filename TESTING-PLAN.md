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
  input/preview, and the derivation must be right. ✅ **done** (286/286).
- **T2 — Foundry export for those same units. ← current focus.**
- **T3 — Feats, spells, items** (same machinery, new units). **Explicitly out of
  scope for now** — do not drift into it beyond fixing what T2 trips over.

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

## 3. Tier 0 — the automated sweep harness (stage T0, built)

Scripts under `scripts/`, run with `vite-node`, loading the compendium from the
**in-repo snapshot** (`./DnD Source Material/5etools Source Code/data` +
`buildManifest()`) through the shared `scripts/lib/loadDb.js`. No browser, no
IndexedDB, pure Node - fast enough to run the whole matrix on every session.

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
- `testing/ISSUES.md` — the findings ledger: open findings in full, plus an index
  row per closed one (`TC-0001`, `TC-0002`…) with its status. Sessions append here;
  nothing is ever silently deleted. The full text of the 86 findings closed through
  2026-07-30 is in `docs/archive/issues-ledger.md`.

`npm run sweep` runs the whole thing; `npm run sweep -- --class=wizard` (or
`--species=…`) reruns one slice while fixing.

### 3.5 T0 exit criterion

The harness exists, the full sweep runs, and every failure it finds is either
**fixed** or **logged in ISSUES.md with a decision**. Expect the first sweep to
produce a real bug backlog — that's the point; burn it down before UI sessions
start (fixes are cheapest at this tier).

---

## 4. Tier 1 — Claude UI sessions (stage T1, complete)

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
- ✅ **REVISÃO DO S-A2 FEITA em 2026-07-25** (pedida pelo usuário porque a 1ª passada rodou em
  Sonnet). **Resultado: as conclusões da 1ª passada se sustentam — zero bugs novos.** O que ela
  tinha de frágil era a EVIDÊNCIA, não o veredito: 8 das 10 ancestralidades de Dragonborn e 4 das
  6 de Goliath estavam anotadas como "engine-verificado" sem que nada tivesse sido executado por
  ancestralidade, e o card de **DAMAGE RESISTANCES da FICHA** nunca fora aberto para o Dragonborn.
  Fechado assim: um **probe exaustivo** construiu as 19 linhas pelo `autoBuild` e comparou a
  derivação contra um oráculo **digitado do livro** (as 10 duplas dragão→dano, as 6
  ancestralidades de gigante, as 3 legacies) — resist, darkvision, speed, traços e convergência
  do autoBuild, tudo verde; e ao vivo conferi **Dragonborn (Green) → DAMAGE RESISTANCES: Poison**
  e **Goliath (Fire) → sem card de resistência**. As notas do COVERAGE foram reescritas para dizer
  o que foi de fato verificado. **REGRA que fica:** não anotar "engine-verificado" sem ter
  rodado algo; ou roda um probe, ou a nota diz "inferido do padrão".
  **O S-A1 NÃO será revisado — decisão do usuário (2026-07-25):** ele confirmou que não precisa.
  Não é pendência; não reabrir.
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
- **S-B2 (o resto da curadoria) - DONE 2026-07-25 (6 linhas novas `ui: ok` + 6 revalidadas, zero
  bugs). O Bloco S-B está FECHADO.** Elf (Pallid) [DDL-0060 lineage], Elf
  Lorwyn/Shadowmoor + Fairy Faerie Lorwyn/Shadowmoor [DDL-0066 merged — **conferir
  a ARTE por linhagem**, DDL-0066 amendment: os arquivos do Elf LFL estão trocados
  no dado], Halfling Lightfoot/Stout/Ghostwise/Lotusden [DDL-0063 swap, já `ok` —
  validar Stout=resist. veneno, Lotusden=origem de magia Wis], Human (Keldon)
  [DDL-0060 species], Custom Lineage ×2 [DDL-0062, já `ok` — seletor "Variable
  Trait", talento ORIGIN, sem atributo legado].

#### Bloco S-C — MPMM (Monsters of the Multiverse, reformatados) · ~31 linhas · CONCLUÍDO 2026-07-25
Espécies 2014 reformatadas para o padrão moderno; entram como linhagens/bases via
`raceLineages`. Aarakocra, Bugbear, Centaur, Deep Gnome, Duergar, Eladrin, Fairy
(base), Firbolg, Genasi ×4, Githyanki, Githzerai, Goblin, Harengon, Hobgoblin,
Kenku, Kobold ×3, Lizardfolk, Minotaur, Satyr, Sea Elf, Shadar-Kai, Tabaxi,
Tortle, Triton, Yuan-Ti.
- **Atenção:** **Tortle** = armadura natural flat (DDL-0034); **Kobold** = seletor
  "Kobold Legacy" com perícia/magia adiadas (TC-0046/0047, tem nota de UI PENDENTE
  no COVERAGE — fechar aqui); Genasi = resistência por elemento na ficha.
- ✅ **DECIDIDO pelo usuário (2026-07-25) — NÃO reabrir:** 22 espécies MPMM trazem
  `Creature Type` / `Size` / `Speed` como traços de PROSA, duplicando os chips de meta
  da ficha. **Fica como está.** Razão dele: "por mais que seja redundante com as chips,
  é mínimo, então vamos minimizar a interferência onde não precisamos". Ou seja, o
  `LEGACY_PROSE_SECTIONS` (DDL-0059) **não** se estende ao conteúdo próprio do
  compêndio — ele existe só para sobras dos merges que NÓS fazemos.

#### Bloco S-D — Outros livros modernos · 32 linhas · CONCLUÍDO 2026-07-26
AAG (Astral Elf, Autognome, Giff, Hadozee, Plasmoid, Thri-kreen), EFA (Changeling,
Kalashtar, Khoravar, Warforged), RHW (Dhampir, Hexblood, Reborn, Lupin), SCC
(Owlin), GGR (Loxodon, Vedalken, Simic Hybrid), MOT (Leonin), FTD (Dragonborn Gem
×5), OGA (Grung), DSotDQ (Kender), LR (Locathah), AI (Verdan).
- **Atenção:** **Autognome/Warforged** = armadura natural unarmored/bonus
  (DDL-0034); **Verdan** = tamanho por nível (S→M no 5º, DDL-0017 — nunca é escolha);
  **Simic Hybrid** = idioma "other" mostra "Other" no seletor (cosmético conhecido,
  TC-0050/DDL-0062 — não é bug); Dragonborn Gem = tipo de dano do sopro + voo.

#### Bloco S-E — CENÁRIO / legado (atrás do filtro "Setting Variant") · 37 linhas · CONCLUÍDO 2026-07-26
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

## 5. Tier 2 — export curation & real Foundry validation (stage T2)

- Tier 1 flags anything subjective as `needs-user-eyes` in the coverage notes;
  the user sweeps those in batches at their own pace.
- **Milestone Foundry imports:** at the end of each class's T2 pass (and for a
  sample of species), the user imports a sweep-generated actor into the real
  Foundry (dnd5e 5.3.3+) and checks: class/level register, features present,
  tap-to-roll activities work, AC/HP derive. The structural sweep can't see
  Foundry's runtime behavior — only a real import can. Export a batch of test
  actors with a small script (`npm run sweep -- --emit-actors`) so this is one
  drag-and-drop session, not twenty.

### 5.1 O oráculo da T2: re-exportar as fichas premade (`npm run t2`)

Fixado 2026-07-26, na abertura do stage. O sweep (Tier 0) já garante o PISO do
export para as 285 linhas: estrutura válida, zero `NaN`/`undefined`, e round-trip
das nossas DECISÕES ida-e-volta. O que ele **não** vê é fidelidade ao que o
Foundry espera - ele compara o nosso export com o nosso próprio import, então
tudo que nunca foi exportado é invisível para ele (foi assim que a **moeda** ficou
zerada por meses: o campo não estava no `decisionSummary`).

O gabarito são as **48 fichas premade OFICIAIS** (12 personagens × níveis
1/5/11/17, em `DnD Source Material/Character Sheets in JSON/Standard Premade
Characters`) - documentos gerados pelo próprio sistema dnd5e, ou seja a verdade
de esquema. O harness (`scripts/compare-premades.js` + `scripts/lib/premadeDiff.js`)
roda o ciclo completo em cada uma:

```
P --foundryToCharacter--> C --assembleFoundryActor--> A   e diffa A × P
```

e **agrega os achados por CLASSE** (`cat`), para triar uma vez por classe de
problema em vez de linha a linha. Flags: `--actor=merric`, `--level=05`,
`--cat=currency` (fatia de burn-down), `--verbose`, `--players` (as fichas
Plutonium do usuário - homebrew, NÃO são verdade de esquema).

**Uma divergência tem três causas, e a triagem DEVE dizer qual:**
1. **export** - não emitimos o que o Foundry espera;
2. **import** - a decisão se perdeu no caminho (o premade a tinha);
3. **deliberada** - diferença conhecida do nosso modelo. Estas vivem na lista
   `DELIBERATE` do `premadeDiff.js`, **cada uma com o porquê** - uma diferença
   sem justificativa ali é bug disfarçado, não ruído.

Cobertura do gabarito: as **12 classes** 2024 (todas menos Artificer), uma
subclasse cada, 12 espécies e 12 origens, em quatro níveis. O que ele NÃO cobre
(as outras 123 subclasses, as outras ~138 linhas de espécie, multiclasse,
inventário mágico) sai por **generalização**: uma classe de achado corrigida no
mecanismo vale para todas as linhas, e o sweep guarda contra regressão.

### 5.2 Ordem de trabalho da T2

- **T2a — o harness.** ✅ DONE 2026-07-26 (ver §7). Primeira rodada: **1023
  achados em 27 classes**; o lote de correções da mesma sessão levou a **745**.
- **T2b — burn-down por classe de achado**, do maior valor para o menor. Uma
  sessão pega 2-4 classes de `testing/ISSUES.md` (TC-0055+), corrige no
  MECANISMO (nunca por unidade), adiciona teste, e re-roda `npm run t2` +
  `npm run sweep -- --strict`. Prioridade: o que quebra a ficha no Foundry
  (progressão de conjuração, ScaleValue sem identificador, tipo de item de
  inventário) antes do que só empobrece (títulos, `compendiumSource`).
- **T2c — decisões do usuário.** Alguns achados são escolha de produto, não bug
  (ex: emitir um item por traço de espécie como os premades × mantê-los como
  effects no item de raça, DDL-0057). Ficam marcados `needs-user-eyes` no
  ledger, nunca "corrigidos" por conta própria.
- **T2d — importações reais no Foundry** (o único passo que Claude não faz):
  `npm run sweep -- --emit-actors` gera o lote em `testing/actors/`, o usuário
  arrasta para o Foundry e confere runtime.
- **Marcar `export: ok`** numa linha do COVERAGE exige: sweep verde em
  `--strict`, nenhuma classe de achado ABERTA que atinja aquela unidade, e -
  para uma das 12 famílias com premade - o `npm run t2` limpo para as fichas
  dela. Não marcar por "não achei nada olhando".

---

## 6. Stage plan and exit criteria

The order is T0 → T1a → T1b → T2 → T3. **Where each stage stands is §7**; this
table is the durable part, the bar each one has to clear.

| Stage | What | Exit criterion |
|---|---|---|
| **T0** | the harness (loadDb, matrix, autoBuild, invariants, round-trip, trackers, `npm run sweep`) | sweep green, or every failure logged with a decision |
| **T1a** | UI sessions: all classes + subclasses | every `class:*` row `ui: ok` or `ui: issues` with its `TC-` closed or accepted |
| **T1b** | UI sessions: all species + lineages | same, for every `species:*` row |
| **T2** | export curation + real-Foundry imports (§5.1-5.2, `npm run t2`) | every row `export: ok`, by the strict rule at the end of §5.2 |
| **T3** | feats → spells → items, same machinery (new matrix units, same trackers) | later; re-plan then |

The sweep stays OUT of `npm run test`: it needs the in-repo data snapshot, which is
git-ignored and therefore not present everywhere the suite runs. Harness lib logic
that is non-trivial (matrix enumeration, waiver diffing) is unit-tested normally.

---

## 7. Status & session hand-off (UPDATE EVERY SESSION)

> Keep this section to the **current state plus the last session**. When you add a
> hand-off, move the previous one to `docs/archive/phase-t-sessions.md` (42 entries
> there, 2026-07-15 to 2026-07-30). The per-unit state is `testing/COVERAGE.md`;
> what each session built is the CHANGELOG.

### Where the campaign stands

| Stage | State |
|---|---|
| **T0** harness | ✅ done 2026-07-15; backlog (TC-0001…TC-0010) burned down 2026-07-16 |
| **T1a** classes | ✅ done 2026-07-22 - 135 `class:*` rows `ui: ok`, 13 sessions |
| **T1b** species | ✅ done - 150 `species:*` rows `ui: ok`, 7 sessions in the 5 blocks of §4.5. The 2 Dwarf swap rows, born after the 2026-07-26 close, were certified 2026-07-30: **286/286** |
| **T2a** export oracle | ✅ done 2026-07-26 - `npm run t2` built; first run 1023 findings in 27 classes |
| **T2b** burn-down | 🔄 **in progress** - 1023 → **6** over 8 sessions plus the deferred-review levas |
| **T2c** user decisions | pending: rows flagged `needs-user-eyes` |
| **T2d** real Foundry imports | ⏳ **blocked on the user** (see below) |
| **T3** feats/spells/items | later; re-plan then |

**Last measured:** 1331 tests · lint clean · `npm run sweep -- --strict` **286/286**
· `npm run t2` **6** findings (+127 named as expected) · `check:keys` and
`check:uuids` clean.

**No `export: ok` row has been marked yet** - the criterion is in §5.2, and it is
deliberately stricter than "I did not spot anything".

### The remaining 6 findings

All 16 findings that stood on 2026-07-30 were measured one by one against the
source data, instead of being read from the old triage note - which had been wrong
twice in a row. **One was a defect of ours** (TC-0088, the Barbarian losing the
level-17 Improved Brutal Strike on export); it is fixed. The rest were named as
`EXPECTED` in `scripts/lib/premadeDiff.js`, each with a narrow predicate and the
measurement behind it. See DDL-0085 and CHANGELOG §112.

What is left is **6 findings of a single category**:

| N | Category | Why it is still open |
|---:|---|---|
| 6 | `feat.activities` (Krusk, Sefris) | We emit `cast` on Paladin's Smite and `enchant` on Agonizing Blast; the SRD leaves `activities: {}`. Removing them loses a button the RAW grants; keeping them risks double-counting the free use. **Only a real import decides** - it is T2d question 2. |

**Do not name this one `EXPECTED` before T2d.** It is the one difference where we
genuinely do not know which side is right, and that is exactly what the T2d import
is for.

#### The method lesson from that pass

Two findings in a row had been misfiled, and both hid the same way: **the oracle
was reporting COUNTS.** `advancement.*.grants` said `premade=3 ours=2`, which reads
identically whether the SRD merely bundles the granted spell into the same step
(harmless) or a feature is missing (lost rules). The comparator now reports
`"<kind>:<name>"` per step, so the difference names itself - and the `EXPECTED`
predicates can require "what is missing must be a SPELL", which a count-based test
could never do. A predicate like `before === after + 1` would have swallowed
TC-0087 itself.

### Blocked on the user (T2d)

`npm run sweep -- --emit-actors` writes the batch to `testing/actors/`; the user
drags them into Foundry (dnd5e 5.3.3+). Five concrete questions are waiting:

1. Does dnd5e already offer an unarmed strike by another route? (If so, the
   `universal-unarmed-strike` divergence is redundant and can follow the SRD again.)
2. Is the Paladin's free Smite use counted twice?
3. Does the broken `@scale.barbarian.rage` stop Persistent Rage from working?
4. Do the Dwarf lineage and the Unarmed Strike item arrive correctly on a real sheet?
5. Does a pack arrive as a container with its contents, and does carried weight match?

### Last session

- **2026-07-30 (7)** - **TC-0089 fechado (dedup por padrao) + o levantamento das
  concessoes de magia.** 1331 testes (+13), lint, sweep 286/286 `--strict`, `t2`
  estavel em 6. DDL-0087, CHANGELOG §114.

  Escolha de magia repetida num ator externo passa a ser deduplicada. **O escopo
  e a decisao:** concessao com pool de usos NAO mora em `ClassEntry.spells`, entao
  a dedup nao alcanca nenhuma. E a **ordem** importa - o primeiro corte rodava
  antes do encalhe e teria colapsado as duas Magic Missile da Riswynn dentro do
  balde de carga, que aceita repetidos de proposito.

  **Ferramenta nova:** `npx vite-node scripts/survey-granted-spells.js` lista as
  973 concessoes de magia (188 com uso proprio) e as colisoes de mesma magia por
  fontes diferentes. E o gabarito de qualquer dedup futura, e foi ele que achou o
  **TC-0090** (Hunter's Mark do Ranger sem o pool do Favored Enemy).

  **A licao e sobre o INSTRUMENTO:** tres probes mentiram antes de acertar nesta
  sessao, e o pior deles concluiu que NENHUMA magia de patrono do Warlock derivava
  - so porque chamou a subclasse de `Archfey Patron` quando o engine a indexa por
  `Archfey`. Uma linha do `COVERAGE.md` escrita numa sessao ao vivo desmentiu.
  Antes de reportar ausencia, confirme que o probe acha o que voce sabe que existe.


- **2026-07-30 (6)** - **O usuario achou o erro da triagem: Contact Patron.** 1318
  testes (+4), lint, sweep 286/286 `--strict`, `t2` estavel em **6**. DDL-0086,
  CHANGELOG §113.

  A sessao anterior nomeou o `spell.method` da Sefris como quirk do premade. Nao
  era: `Contact Other Plane` e concedida pelo **Contact Patron (Warlock @9)**, e o
  premade encoda a concessao com `prepared: 2` **mais `uses` 1/descanso longo**. A
  triagem olhou o `method` e nao olhou o `uses` na mesma linha.

  Por baixo da nomeacao havia defeito nosso: o `additionalSpells` da classe declara
  a magia em `prepared` sem frequencia, o uso gratis so existe na PROSA, e o
  `applyUsesOverlay` so agia sobre `castType: 'innate'` - entao **o uso gratis sumia
  do export**. Corrigido; o `method: "pact"` fica, agora com o motivo certo (e a
  entrada `EXPECTED` carrega o historico do erro dentro dela).

  **Regra que fica:** antes de nomear uma divergencia como esperada, leia a FEATURE
  que concede, nao so o campo que diverge. Terceira variacao do mesmo tema - a
  anterior foi "predicado sobre contagem esconde bug" (DDL-0085).

  Aberto de lambuja: **TC-0089** (o ator premade da Sefris lista Hex e Hideous
  Laughter em duplicidade; a key da linha foi corrigida, a dedup e decisao de
  produto e ficou aberta).


- **2026-07-30 (5)** - **Triagem executada: TC-0088 corrigido e o oraculo passou a
  nomear.** 1314 testes (+2), lint, sweep 286/286 `--strict`, `check:keys` e
  `check:uuids` limpos. `npm run t2` **16 -> 6**. DDL-0085, CHANGELOG §112.

  O fix do Barbaro e uma linha de gate. **O que valeu mais foi mudar o oraculo:**
  `advancement.*.grants` comparava CONTAGENS, e foi por isso que dois defeitos
  reais (TC-0087, TC-0088) ficaram semanas invisiveis - "premade=2 ours=1" le-se
  igual quer o SRD so agrupe diferente, quer falte uma feature. Agora cada passo
  reporta `"<tipo>:<nome>"`.

  A troca destapou de imediato um par que a contagem escondia (o cantrip do Alto
  Elfo do Beiro). Medido antes de acusar: **nao** era defeito novo, e o limite ja
  documentado no `spellChoiceBag` - os dois atores tem os mesmos 5 cantrips, so o
  rotulo de quem concedeu troca.

  **Regra que fica:** um predicado de `EXPECTED` sobre CONTAGEM engole bug por
  construcao. Faca o oraculo dizer O QUE difere, depois escreva o predicado sobre
  isso - os cinco novos exigem que o ausente seja `spell:`, entao uma FEATURE que
  suma continua sendo achado.


- **2026-07-30 (5)** - **Triagem MEDIDA dos 16 achados restantes; nada implementado.**
  Sessao de analise a pedido do usuario, que quer retomar as correcoes na proxima.
  Nenhum codigo mudou: 1312 testes, sweep 286/286 `--strict`, `t2` em 16.

  **O resultado esta na secao "The remaining 16 findings" acima, que e a ORDEM DE
  TRABALHO.** Resumo: **so 1 dos 16 e defeito nosso** (TC-0088, o Barbaro perdendo
  o texto do Improved Brutal Strike @17 no export). 3 sao defeitos confirmados do
  documento premade, 6 sao forma de documento sem perda de conteudo, e 6 nao dao
  para decidir sem o T2d.

  **Proxima sessao, na ordem:**
  1. corrigir o **TC-0088** (entrada completa com o fix sugerido em
     `testing/ISSUES.md`); `t2` deve cair de 16 para 15;
  2. nomear como `EXPECTED` no `scripts/lib/premadeDiff.js`, cada uma com o motivo:
     o `details.xp` da Riswynn, o `spell.method` da Sefris, e a composicao do
     `ItemGrant` do Paladino (esta ultima com a ressalva de reconferir no T2d);
     `t2` deve cair de 15 para 5;
  3. **nao tocar** nas 6 `feat.activities` antes do T2d.

  Feito isso, o placar passa a dizer a verdade: os 5 restantes sao exatamente
  "esperando uma importacao real no Foundry", em vez de misturar bug com quirk.


- **2026-07-30 (4)** - **P2 fechado, fora da T2: magias sem origem ganham sub-aba e
  podem receber uma classe.** 1312 testes (+7), lint, sweep 286/286 `--strict`,
  `t2` estavel em 16. Decisoes em DDL-0084, log em CHANGELOG §111.

  **A licao repete a do TC-0086, e vale como regra:** o modelo estava certo e os
  testes passavam, mas a passada ao vivo achou DUAS perdas de conteudo que nenhum
  teste teria pego. (1) A ficha da Riswynn traz a MESMA magia duas vezes, e o
  filtro por `id+source` removeria as duas ao atribuir uma - no exato campo que
  existe para nao perder conteudo. Agora tudo opera por indice. (2) O card de
  numeros renderizou "2/0 Prepared" em vermelho para um balde que nao conta em
  limite nenhum, porque o gate cobria so o DC e nao o bloco inteiro.

  **E uma terceira, de documentacao:** o texto do aviso de import dizia "they do
  not appear in the Spellbook", que a mudanca tornou falso. Toda feature que muda
  o que o usuario ve precisa varrer as strings que descrevem o comportamento
  antigo.


- **2026-07-30 (3)** - **Survey of what was still open, and the two things it
  found.** 1305 tests (+1), lint, sweep 286/286 `--strict`, `t2` 18 -> **16**,
  `check:keys` and `check:uuids` clean. Log in CHANGELOG §110, decision in DDL-0083.

  **1. T1 was not actually complete.** The matrix had grown to 286 when the Dwarf
  swap shipped (DDL-0080, 2026-07-29), three days AFTER T1 was declared done at
  285. The two new rows had never been opened in a browser. Certified now: the
  "Dwarf Lineage" umbrella lists both options, Hill derives Dwarven Toughness
  (HP 33 -> 39 at level 6) and Mountain derives Dwarven Armor Training (ARMOR:
  Light + Medium) with Toughness correctly ABSENT - the swap is exclusive.
  **286/286 `ui: ok`.**

  **2. A finding filed as a premade quirk was a real bug.** The triage note said
  all 8 `advancement.class.grants` were the Paladin's `ItemGrant`. Two were a
  MONK case, and the giveaway was in the numbers nobody had read: it appeared at
  L01/L05 and vanished at L11/L17. A finding that disappears as the level rises
  cannot be a defect of the premade - it is the signature of a ladder built from
  the CURRENT level. Root cause: `Self-Restoration` (@10) has no file in the
  dnd5e `packs/_source` tree, so the generated registry had no uuid for it and
  `buildClassFutureGrants` dropped it silently. A Monk exported below level 10
  and levelled up inside Foundry never received it.

  **The net matters more than the fix:** `npm run check:uuids` now crosses every
  `classes24` uuid the 48 premades reference against the registry, so the next
  missing document fails loudly instead of costing a feature. It found exactly
  two ids, one of which (`phbmnkUnarmedStr`) is absent on purpose and is named as
  such in the probe.

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

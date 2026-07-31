# Findings ledger - Phase T (TESTING-PLAN.md)

One numbered entry per finding (`TC-xxxx`). Sessions APPEND here; nothing is
silently deleted - a fixed issue gets `fixed@<date>`, a rejected one `wontfix` +
why. Open `TC-` ids referenced by `KNOWN_ISSUES` in `scripts/lib/roundtrip.js`
keep the sweep green while they wait; **closing an issue = fixing the code +
removing its pattern there + a clean sweep.**

Severity when opening one: `blocker` (wrong sheet / crash) · `bug` (data loss or
wrong behavior) · `polish` (cosmetic / minor UX).

## Open findings

**None.** Every `TC-` raised so far is closed (86 fixed, 1 wontfix). `KNOWN_ISSUES`
and `WAIVERS` in `scripts/lib/roundtrip.js` are both empty, so any new round-trip
diff fails its sweep row.

> `npm run t2` reports **6** findings, all of one category (`feat.activities`), and
> none is triaged as our defect: they are activities we emit and the SRD does not,
> waiting on T2d question 2. The measured triage is in **TESTING-PLAN.md §7**. A
> finding only becomes a `TC-` entry once it is triaged as our defect.

## Adding a finding

Append a new numbered section under **Closed findings** using the next free id:

```
## TC-0087 - one-line statement of the defect

- **Found:** <date, how>. **Severity:** bug. **Status:** open.
- What is wrong, and what the player or the exported actor loses because of it.
- **Fix:** (filled in when closed) the mechanism that was changed, not the symptom.
```

Fix in the **mechanism**, never per unit, and record the decision in
`docs/DECISIONS.md` when it sets a rule.

---

## Closed findings

Full text of every entry below is preserved in
**`docs/archive/issues-ledger.md`** - go there for the reasoning, the measurements
and the traps each one left behind. The table is the index.

| id | Finding | Status |
|---|---|---|
| TC-0001 | Custom-origin tool & language don't round-trip | fixed@2026-07-16 |
| TC-0002 | Chosen feats' sub-choices don't round-trip | fixed@2026-07-16 |
| TC-0003 | Weapon-mastery pick format drift (`'Club'` vs `'Club\|PHB'`) | fixed@2026-07-16 |
| TC-0004 | Optional features not exported/reconstructed | fixed@2026-07-16 |
| TC-0005 | Class proficiency choices beyond starting skills not imported | fixed@2026-07-16 |
| TC-0006 | Champion's extra Fighting Styles import into wrong keys | fixed@2026-07-16 |
| TC-0007 | `featureoption` picks don't export as "<Feature>: <Option>" Items | fixed@2026-07-16 |
| TC-0008 | Parenthesized race names misresolved on import | fixed@2026-07-16 |
| TC-0009 | Species `spellAbility` pick lost on round-trip | fixed@2026-07-16 |
| TC-0010 | Species proficiency back-fill steals feat sub-bag picks | fixed@2026-07-16 |
| TC-0011 | `additionalSpells` `{choose}` picks have NO selector anywhere | fixed@2026-07-17 (DDL-0029) |
| TC-0018 | Curated HP-max increases (Tough…) never derived | fixed@2026-07-17 (DDL-0029) |
| TC-0012 | Fixed subclass proficiency grants don't derive | fixed@2026-07-17 (DDL-0029) |
| TC-0013 | Picked feat with unfilled sub-choices escapes the pendency system | fixed@2026-07-16 |
| TC-0014 | Structured `resist` choices not parsed (Boon of Energy Resistance) | fixed@2026-07-17 (DDL-0029) |
| TC-0015 | Guided create leaves the starting kit unequipped (AC reads unarmored) | fixed@2026-07-17 |
| TC-0016 | Guide pickers showed raw lowercase ids ("artificer", "human") | fixed@2026-07-16 (this session) |
| TC-0017 | Featureoption chip renders ALL options' full text under the chosen chip | fixed@2026-07-17 |
| TC-0019 | Storm Herald's Storm Aura environment choice had no selector | fixed@2026-07-17 |
| TC-0020 | ✦ badge counted guide steps, not decisions | fixed@2026-07-17 |
| TC-0021 | Weapon Mastery pool ignored per-class restrictions (Barbarian melee-only) | fixed@2026-07-21 (Barbarian half @2026-07-17) |
| TC-0022 | Feat ability increases don't enforce the ability score cap (20) | fixed@2026-07-17 (DDL-0034) |
| TC-0023 | Countable proficiency tokens ({anyMusicalInstrument: 3}) never became choices | fixed@2026-07-18 |
| TC-0024 | Kit entries `{equipmentType}` silently dropped (Bard's instrument) | fixed@2026-07-18 |
| TC-0025 | Sibling spell chooses accept the SAME spell twice (Magical Discoveries) | fixed@2026-07-18 |
| TC-0026 | Prose-granted spell missing from `additionalSpells` (Spirits' Guidance) | fixed@2026-07-18 |
| TC-0027 | Legacy subclass `_copy` stubs unresolved: additionalSpells (domain spells) lost | fixed@2026-07-19 |
| TC-0028 | Divine Order: Thaumaturge's extra cantrip never raised the cantrip limit | fixed@2026-07-19 |
| TC-0029 | ASI / Epic Boon feat pickers exclude categories RAW allows | fixed@2026-07-19 (user decision same day) |
| TC-0030 | Blessings of Knowledge: PSA granted nothing; chosen skills lacked expertise | fixed@2026-07-19 |
| TC-0031 | Spell pickers offer spells already always-prepared from another origin | fixed@2026-07-19 (user decision) |
| TC-0032 | Shepherd's Speech of the Woods never granted Sylvan | fixed@2026-07-20 |
| TC-0033 | Kit items that reference an ITEM GROUP landed as "unresolved" junk | fixed@2026-07-20 |
| TC-0034 | Feat sub-choice spell pickers skip the DDL-0040 "Already Prepared" flow | fixed@2026-07-20 |
| TC-0035 | Orphaned spell picks mislabeled "Mystic Arcanum" after a subclass swap removes casting | fixed@2026-07-20 |
| TC-0036 | Defense fighting style never reached the live sheet's AC | fixed@2026-07-20 |
| TC-0037 | Create-guide intro promised "which spells to prepare" to a non-caster | fixed@2026-07-20 |
| TC-0038 | Guide SpellPicker offers the origin's OWN always-prepared spells (duplicate picks) | fixed@2026-07-21 |
| TC-0039 | Storm Sorcery não concede o idioma Primordial (Wind Speaker) | fixed@2026-07-22 |
| TC-0040 | `text-transform: capitalize` do PickerField quebra nomes próprios | fixed@2026-07-22 |
| TC-0041 | pré-requisito de MAGIA imprimia só "Spell" | fixed@2026-07-22 |
| TC-0042 | Resilient não concedia a proficiência em salvaguarda | fixed@2026-07-22 |
| TC-0043 | listas EXPANDIDAS de subclasse não contam como "lista da classe" no seletor de magias | fixed@2026-07-22 (DDL-0054) |
| TC-0044 | Forest Gnome só concede Speak with Animals a partir do nível 3 | fixed@2026-07-22 |
| TC-0045 | features de subclasse legada renderizam um nível cedo demais | fixed@2026-07-22 |
| TC-0046 | Custom Lineage tratava o "Variable Trait" como LINHAGEM | fixed@2026-07-23 |
| TC-0047 | benefício OU-EXCLUSIVO era oferecido pela BASE, antes de o jogador ter direito | fixed@2026-07-23 |
| TC-0048 | espécie legada concedia aumento de atributo (regra 2014) | fixed@2026-07-23 |
| TC-0049 | o talento do Custom Lineage não tinha categoria | fixed@2026-07-23 (decisão do usuário) |
| TC-0050 | pick de idioma "other" se perdia no round-trip | fixed@2026-07-23 |
| TC-0051 | Tiefling; Abyssal Legacy exibia Darkvision 120 ft (dado upstream errado) | fixed@2026-07-25 |
| TC-0052 | linhagem curada caía na lore da EDIÇÃO ERRADA (fallback por nome puro) | fixed@2026-07-25 |
| TC-0053 | cinco especies declaravam a propria CA em prosa e derivavam 10+Dex | fixed@2026-07-25 |
| TC-0054 | Tiefling Winged: texto de atributo de conjuracao pendurado no vazio | fixed@2026-07-25 |
| TC-0055 | A moeda do personagem nunca era exportada | fixed@2026-07-26 |
| TC-0056 | Perícias e ferramenta da ORIGEM se perdiam ao importar qualquer premade | fixed@2026-07-26 |
| TC-0057 | Item sem `source` no ator externo desaparecia no re-export | fixed@2026-07-26 |
| TC-0058 | Chaves de idioma fora do vocabulário do dnd5e (`sign`, `cant`) | fixed@2026-07-26 |
| TC-0059 | Idioma concedido por FEATURE de classe (Druidic, Thieves' Cant) nunca é concedido | fixed@2026-07-26 (com TC-0075 e TC-0077, ver DDL-0073) |
| TC-0060 | Progressão de conjuração inválida; subclasse conjuradora sem nenhuma | fixed@2026-07-26 |
| TC-0061 | Escolhas de proficiência dentro de OUTROS documentos não voltam de um ator externo | fixed@2026-07-27 (DDL-0075) |
| TC-0062 | Chave de ScaleValue divergente do SRD; falta `max-prepared` e o `preparation.formula` | fixed@2026-07-26 |
| TC-0063 | Sem escadas `ItemChoice`: nada a escolher ao subir de nível no Foundry | fixed@2026-07-26 |
| TC-0064 | Item de espécie muito mais magro que o do premade | fixed@2026-07-29 (DDL-0079) |
| TC-0065 | Ancestralidade do Dragonborn/Goliath não volta de um ator externo | fixed@2026-07-29 (DDL-0079) |
| TC-0066 | Inventário: quase todo item vira `loot` no Foundry | fixed@2026-07-26 |
| TC-0067 | Magia concedida como sempre-preparada sai `innate` em vez de `spell`+`prepared:2` | fixed@2026-07-27 (DDL-0074) |
| TC-0068 | `uses` faltando em features que o SRD rastreia | fixed@2026-07-27 (DDL-0074) |
| TC-0069 | `compendiumSource` ausente em toda OPTIONAL FEATURE | fixed@2026-07-26 |
| TC-0070 | Cobertura de `activities` divergente nos DOIS sentidos | fixed@2026-07-29 (DDL-0079) |
| TC-0071 | Composição do ItemGrant por nível difere do premade (dois sentidos) | fixed@2026-07-29 (DDL-0079), minus the Paladin ItemGrant |
| TC-0072 | Escada de magias da subclasse só cobre os níveis FUTUROS | fixed@2026-07-29 (DDL-0079) |
| TC-0073 | Tamanho exportado como Small quando a escolha S/M não foi feita | fixed@2026-07-27 (o lado do EXPORT; ver a nota abaixo) |
| TC-0074 | Cosméticos do export (rótulos e slugs) | fixed@2026-07-27 (DDL-0074) |
| TC-0075 | Proficiência de save do Slippery Mind (Ladino 15) não deriva | fixed@2026-07-26 (com TC-0059 e TC-0077, ver DDL-0073) |
| TC-0076 | Proficiência de arma CONDICIONAL não é enumerada no export | fixed@2026-07-27 (com o TC-0078, ver DDL-0075) |
| TC-0077 | Aumento de atributo do CAPSTONE não deriva (Body and Mind, Monge 20) | fixed@2026-07-26 (com TC-0059 e TC-0075, ver DDL-0073) |
| TC-0078 | Proficiências de arma INDIVIDUAIS do premade não são enumeradas (parte do TC-0076) | fixed@2026-07-27 (DDL-0075; fecha |
| TC-0079 | Magia com NOME PRÓPRIO não resolve e some do export (Tasha's/Leomund's/Bigby's…) | fixed@2026-07-27 (DDL-0075) |
| TC-0080 | Magia CONHECIDA mas não preparada não tem lugar no nosso modelo | fixed@2026-07-27 - **o usuário decidiu modelar** (DDL-0076) |
| TC-0081 | Magias do TALENTO DE ORIGEM se perdem ao importar um ator externo | fixed@2026-07-27 para o TALENTO (DDL-0075); as outras origens seguem abertas - ver o |
| TC-0082 | Wild Companion (Druida) deriva Find Familiar como SEMPRE PREPARADA | fixed@2026-07-29 (DDL-0079) |
| TC-0083 | `BuilderInner` viola a ordem dos Hooks (erro de console ao abrir a ficha) | wontfix@2026-07-29 - investigado e descartado |
| TC-0084 | 11 subclasses alcançáveis não derivam a resistência/imunidade que a feature concede | fixed@2026-07-30 (DDL-0081, CHANGELOG §107) |
| TC-0085 | O ator exportado não tem nenhuma ação básica (Dash, Hide, Help, Study…) | fixed@2026-07-30 (DDL-0081, CHANGELOG §107) |
| TC-0086 | Item guardado num contêiner continuava EQUIPADO | fixed@2026-07-30 (DDL-0082, CHANGELOG §108) |
| TC-0087 | Monge perde Self-Restoration ao subir de nível DENTRO do Foundry (escada @10 sem uuid) | fixed@2026-07-30 (DDL-0083, CHANGELOG §110) |
| TC-0088 | Barbaro perde "Improved Brutal Strike (2)" no export ao ALCANCAR o nivel 17 | fixed@2026-07-30 (DDL-0085, CHANGELOG §112) |

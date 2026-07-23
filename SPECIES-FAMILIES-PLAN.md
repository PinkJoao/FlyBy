# SPECIES-FAMILIES-PLAN.md — famílias de espécie com nome repetido

> Documento de trabalho (padrão `RULES-GLOSSARY-PLAN.md` / `TESTING-PLAN.md`): levantamento,
> catalogação e estratégia. Quando a implementação terminar, dobrar em CLAUDE.md (DDL) +
> CHANGELOG e apagar este arquivo.
>
> **Status (2026-07-23): CAMPANHA ENCERRADA.** O `swap` do **Halfling** foi implementado
> (DDL-0063 + CHANGELOG §71). O **Dwarf ficou de fora por decisão do usuário** e está na seção
> "Explicitly OUT OF SCOPE" do CLAUDE.md — **não é pendência**.
>
> Este arquivo continua no repositório por um motivo só: o **censo do §3** (as 98 sub-raças em 7
> grupos + a análise item a item das 20 do grupo novo). Ele responde "o que ainda falta de
> espécie?" com dado, e **não deve ser refeito**. As decisões e o desenho vivem no DDL-0063.

---

## 1. A pergunta

Depois do DDL-0058…0062 (sub-raças legadas recuperadas como linhagem, como espécie à parte, ou
REESCRITAS), sobrou a sensação de que ainda há conteúdo "de nome repetido" fora do alcance:
duas sub-raças de halfling, algumas de anão, muitas de elfo. Este documento responde três coisas:

1. **Quais** entradas ainda estão inalcançáveis, e por quê.
2. **Quais delas têm conteúdo real a recuperar** — e quais só parecem ter.
3. **Como recuperá-las sem quebrar o balanceamento**, dado que várias bases 2024 (Halfling,
   Dwarf, Human) **não são um chassi com linhagens**: pendurar a sub-raça 2014 nelas produz um
   upgrade puro, e o halfling/anão/humano 2024 "puro" fica sem razão de existir.

---

## 2. Método

Censo direto sobre `db.races` do snapshot local, usando as MESMAS funções do app
(`latestOnly` + `resolveCopies` + `legacyStandaloneSpecies` = a lista do seletor;
`raceLineages` = as linhagens de cada base). Scripts descartáveis, resultado abaixo.

Números brutos: **160 espécies de topo** (109 sem `reprintedAs`), **98 sub-raças**,
**92 espécies visíveis hoje** no seletor.

---

## 3. O censo

### 3.1 As 98 sub-raças, por motivo (fecha o universo — nada fora destes 7 grupos)

| Grupo | N | O que é | Situação |
|---|---:|---|---|
| **Alcançáveis** | 28 | base visível → já viram linhagem hoje (Genasi MPMM, Human (Innistrad), Merfolk/Goblin/Vampire PSZ, Aven PSA, Elf (Kaladesh/Zendikar), Shifter EFA, Half-Orc PHB…) | ✅ nada a fazer |
| **Curadas** | 15 | DDL-0059/0060/0061 (Pallid, Ghostwise, Lotusden, Keldon + 11 legacies do Tiefling) | ✅ resolvidas |
| **Descartadas** | 9 | DDL-0059 (Eladrin DMG, Asmodeus, Infernal Legacy SCAG, 4 `Descent` de Half-Elf, Draconblood, Ravenite) | ✅ decisão tomada |
| **Marcas dracônicas** | 12 | ERLW `Mark of …` — têm `reprintedAs` próprio (objeto) | ⛔ fora de escopo (Eberron; regra de marca é um sistema à parte) |
| **Reprint → ESPÉCIE moderna** | 13 | Duergar, Eladrin MTF, Sea, Shadar-kai, Genasi EEPC ×4, Githyanki/Githzerai, Deep ×2, Half-Elf → Khoravar | ✅ o substituto já está no seletor |
| **Reprint → BASE 2024** | **20** | **o grupo desta análise** — ver §3.2 | ⚠️ a resolver |
| Órfã | 1 | `Amonkhet\|PSA` (sem base no dado) | ⛔ lixo do dataset |

**Por que este grupo escapou do DDL-0058:** aquele levantamento mirou as sub-raças **sem**
`reprintedAs` (as que somem por colateral da base). Estas 20 **têm** `reprintedAs`, apontando
para a própria base 2024 — o 5etools diz "foram reimpressas como o Dwarf XPHB". Ficaram fora
por definição, não por esquecimento. A pergunta que ninguém tinha feito: *a base 2024 realmente
contém o que a sub-raça tinha?*

### 3.2 As 20 do grupo "reprint → base 2024", caso a caso

| Sub-raça | Base 2014 | O que ela tem | Existe em 2024? | Veredito |
|---|---|---|---|---|
| **Mountain** \|PHB | Dwarf | Dwarven Armor Training (armadura leve+média) | **NÃO** | ⚠️ **LACUNA REAL** |
| **Stout** \|PHB | Halfling | Stout Resilience (resist. veneno + vantagem) | **NÃO** | ⚠️ **LACUNA REAL** |
| **Hill** \|PHB | Dwarf | Dwarven Toughness (+1 PV/nível) | Sim — **virou traço da base** | 🟡 mecânica absorvida, IDENTIDADE perdida |
| **Lightfoot** \|PHB | Halfling | Naturally Stealthy | Sim — **virou traço da base** | 🟡 mecânica absorvida, IDENTIDADE perdida |
| **Variant** \|PHB | Human | 1 perícia + 1 talento livre | Sim — **virou a base inteira** (Skillful+Versatile), e 2024 ainda dá Resourceful | 🟡 identidade perdida; 2024 é ESTRITAMENTE superior |
| Drow \|PHB | Elf | Superior Darkvision, Drow Magic, Drow Weapon Training | Sim — `Elf; Drow Lineage` | ✅ redundante |
| High \|PHB | Elf | cantrip de mago, idioma extra, Elf Weapon Training | Sim — `Elf; High Elf Lineage` | ✅ redundante |
| Wood \|PHB | Elf | speed 35, Mask of the Wild, Elf Weapon Training | Sim — `Elf; Wood Elf Lineage` | ✅ redundante |
| Forest \|PHB | Gnome | Minor Illusion, Speak with Small Beasts | Sim — `Gnome; Forest Gnome Lineage` | ✅ redundante |
| Rock \|PHB | Gnome | Artificer's Lore, Tinker | Sim — `Gnome; Rock Gnome Lineage` (Mending/Prestidigitation + engenhoca) | ✅ redundante |
| Fallen \|VGM | Aasimar | Necrotic Shroud @3 | Sim — Celestial Revelation, opção *Necrotic Shroud* | ✅ redundante (2024 melhor: escolhe a cada transformação) |
| Protector \|VGM | Aasimar | Radiant Soul (voo) @3 | Sim — opção *Heavenly Wings* | ✅ redundante |
| Scourge \|VGM | Aasimar | Radiant Consumption @3 | Sim — opção *Inner Radiance* | ✅ redundante |
| Beasthide / Longtooth / Swiftstride / Wildhunt \|ERLW | Shifter | 4 tipos de metamorfose | Sim — `Shifter\|EFA` tem as 4 como linhagens | ✅ redundante (×4) |
| (sem nome) \|PHB ×4 | Dragonborn, Human, Tiefling, Half-Elf | só o campo `ability` (descartado pela regra 2024, DDL-0058) | — | ✅ nada a recuperar |

> **Nota de edição, não lacuna:** Drow/High/Wood 2024 perderam as proficiências de ARMA
> (Elf/Drow Weapon Training) e o idioma extra do High. É política deliberada da edição 2024
> (espécie não concede arma nem idioma), não conteúdo esquecido. Não recuperar.

### 3.3 As famílias de nome no seletor de hoje (o lado da "agregação")

| Família | Entradas hoje | Faltando |
|---|---|---|
| **Elf** | Elf\|XPHB (4 linhagens: Drow/High/Wood/**Pallid**), Astral Elf\|AAG, Sea Elf\|MPMM, Eladrin\|MPMM, Shadar-Kai\|MPMM, Elf\|LFL (2 lin.), Elf (Kaladesh)\|PSK (2 lin.), Elf (Zendikar)\|PSZ (3 lin.) | **nada** — as "muitas de elfo" já estão todas cobertas |
| **Dwarf** | Dwarf\|XPHB (0 linhagens), Dwarf (Kaladesh)\|PSK, Duergar\|MPMM | **Hill, Mountain** |
| **Halfling** | Halfling\|XPHB (0 linhagens), Halfling (Ghostwise)\|SCAG, Halfling (Lotusden)\|EGW | **Lightfoot, Stout** |
| **Human** | Human\|XPHB (0 linhagens), Human (Innistrad)\|PSI (4 lin.), Human (Ixalan/Kaladesh/Keldon/Zendikar) | Variant (redundante) |
| **Gnome** | Gnome\|XPHB (Forest/Rock), Deep Gnome\|MPMM, Autognome\|AAG | nada |
| **Aasimar** | Aasimar\|XPHB (0 linhagens) | nada (as 3 do VGM viraram opções da Celestial Revelation) |
| **Shifter / Genasi / Gith / Goliath / Dragonborn / Kobold / Tiefling** | base atual com todas as linhagens | nada |

**Conclusão do censo:** o conteúdo mecânico realmente perdido no dataset inteiro cabe em
**dois traços** — *Dwarven Armor Training* (Mountain) e *Stout Resilience* (Stout). Todo o
resto é redundância, política de edição, ou **identidade** (Hill, Lightfoot, Variant Human).

---

## 4. O achado que muda a estratégia: o padrão da ABSORÇÃO

O DDL-0060 já tinha visto isso no Halfling. O censo mostra que é um **padrão sistemático** da
edição 2024: **cada base absorveu UMA de suas sub-raças 2014**.

| Base 2024 | = base 2014 … | … + o traço de QUAL sub-raça | (+ modernizações) |
|---|---|---|---|
| **Dwarf\|XPHB** | Dwarf\|PHB | **Dwarven Toughness** (do *Hill*) | darkvision 60→120, Stonecunning vira Tremorsense; caem Combat Training e Tool Proficiency |
| **Halfling\|XPHB** | Halfling\|PHB | **Naturally Stealthy** (do *Lightfoot*) | speed 25→30 |
| **Human\|XPHB** | Human\|PHB | **Skillful + Versatile** (= o *Variant* inteiro) | + Resourceful, size S/M |
| **Aasimar\|XPHB** | Aasimar\|VGM | as 3 transformações (*Fallen/Protector/Scourge*) viram opções de UMA feature | escolhe a cada uso |
| **Elf\|XPHB** | Elf\|PHB | **nada** — as 3 sub-raças viraram as 3 LINHAGENS | Keen Senses vira escolha de 3 perícias |
| **Gnome\|XPHB** | Gnome\|PHB | **nada** — as 2 sub-raças viraram as 2 LINHAGENS | speed 25→30 |

É exatamente isto que dá razão à objeção do usuário: **pendurar Stout no Halfling XPHB entrega
Lightfoot + Stout de uma vez.** Não é opinião — a base 2024 literalmente *é* o Lightfoot.
Elf e Gnome são a exceção limpa (nada absorvido, guarda-chuva de linhagem presente), e é por
isso que Pallid pôde virar linhagem sem discussão (DDL-0060).

---

## 5. Estratégia proposta

### 5.1 As três formas de hoje, e por que nenhuma serve

| Forma | Mecanismo | Serve para Dwarf/Halfling? |
|---|---|---|
| `as: 'lineage'` (DDL-0059) | funde na base 2024 | ❌ **empilha** — é a objeção do usuário |
| `as: 'species'` (DDL-0060) | funde na base LEGADA, espécie à parte | 🟡 funciona e é balanceado, mas produz um halfling 2014 (sem Nimbleness modernizado, speed 25) num app de regras 2024, e **piora o problema de nome repetido** — mais uma linha "Halfling (Stout)" no seletor |
| REESCRITA (DDL-0061) | normaliza a mecânica 2014 no formato 2024 | ⚠️ exige um **traço guarda-chuva com TABELA** onde encaixar. Dwarf/Halfling/Human XPHB **não têm nenhum** |

### 5.2 A forma nova: `as: 'swap'` — a linhagem TROCA o traço absorvido

**A ideia:** construir para Dwarf e Halfling o guarda-chuva de linhagem que a edição 2024 não
lhes deu, e no qual cada opção **SUBSTITUI** o traço absorvido em vez de somar a ele.

```
Halfling|XPHB  →  novo traço "Halfling Lineage" (ocupa o lugar de Naturally Stealthy)
                  ├─ Lightfoot   → Naturally Stealthy      ← reproduz EXATAMENTE a base de hoje
                  ├─ Stout       → Stout Resilience
                  ├─ Ghostwise   → Silent Speech           (hoje espécie à parte)
                  └─ Lotusden    → Child of the Wood + Timberwalk + magias   (hoje espécie à parte)

Dwarf|XPHB     →  novo traço "Dwarven Lineage" (ocupa o lugar de Dwarven Toughness)
                  ├─ Hill        → Dwarven Toughness       ← reproduz EXATAMENTE a base de hoje
                  └─ Mountain    → Dwarven Armor Training
```

**Por que isto resolve as duas exigências do usuário de uma vez:**

- **Balanceamento:** é uma troca 1-por-1, não uma soma. E como **uma das opções reproduz a base
  atual exatamente**, ninguém perde nada e não existe opção "obviamente melhor". A pergunta
  "por que escolher o halfling 2024 puro?" desaparece: o halfling 2024 puro **é** o Lightfoot.
- **Lore:** Hill/Mountain/Lightfoot/Stout voltam com os NOMES deles. Em 2014 essas quatro eram
  **irmãs** (nenhuma era "a base"), então modelá-las como opções de um mesmo guarda-chuva é
  literalmente o que o livro 2014 fazia, portado para o chassi 2024.
- **Nome repetido:** Halfling passa de 3 entradas no seletor para 1; Dwarf recupera 2 sem criar
  entrada nenhuma. É a "agregação" pedida.

**Por que é legítimo à luz do DDL-0060/0061.** A regra do `as` (DDL-0060) julga a **fusão CRUA**;
o DDL-0061 já abriu a exceção: uma sub-raça cujo empilhamento foi **neutralizado na fonte** pode
ser linhagem. Aqui a neutralização é ainda mais barata que no Tiefling — não precisa reescrever
texto nenhum, só declarar que a linhagem **ocupa o lugar** do traço absorvido. O campo
`supersedes` do `LEGACY_SUBRACES` já existe exatamente para isso.

**REGRA para uma entrada `'swap'` futura (obrigatória):**
1. Identifique o traço da base 2024 que veio de uma sub-raça 2014 (a tabela do §4 é o método:
   diff base-2024 × base-2014).
2. Toda opção do guarda-chuva **deve** `supersedes` esse traço.
3. O conjunto **deve** incluir uma opção que reproduza a base 2024 exatamente (a sub-raça
   absorvida). Sem ela, a mudança tira algo de quem já tinha.
4. Se não houver traço absorvido identificável, **não use `'swap'`** — é `'lineage'` (Elf) ou
   `'species'` (DDL-0060).

### 5.3 O que NÃO fazer (decisões negativas, para não serem redescobertas)

- **Não** trazer Drow/High/Wood/Forest/Rock/Shifter ERLW/Genasi EEPC/Aasimar VGM: são
  redundantes por verificação item a item (§3.2), não por heurística de nome.
- **Não** recriar as proficiências de arma/idioma de Elf 2014: política da edição (§3.2 nota).
- **Não** dar tratamento `'swap'` ao **Human**: não há traço a trocar — o Variant foi absorvido
  INTEIRO e o 2024 ainda soma Resourceful. Keldon fica como espécie à parte (DDL-0060), que já
  está certo.
- **Não** mexer em **Aasimar**: a Celestial Revelation 2024 já é as três sub-raças, e melhor.
- **Não** abrir as **marcas dracônicas** de Eberron: sistema à parte, escopo próprio.
- O **toggle geral de conteúdo legado** segue **cancelado** (DDL-0058).

### 5.4 Esboço de implementação (ordem sugerida)

1. **Registro.** Um módulo irmão do `legacyFiendishLegacies.js` — proposta:
   `engine/legacyLineageSwaps.js` — emitindo descritores no formato `_versions` (o mesmo que
   `raceLineages` já passa por `buildVariant`), com `_mod.entries.replaceArr` sobre o traço
   absorvido. **Esse é literalmente o idioma do dado 2024**: o `Gnome; Forest Gnome Lineage` do
   XPHB faz `replaceArr` sobre "Gnomish Lineage". Nada a jusante (seletor, completude, guia,
   sweep, export, import) precisa saber que a linhagem é nossa.
2. **Texto montado do dado, nunca escrito por nós** (DDL-0061): o corpo de cada opção é o
   `entries` da sub-raça 2014; o guarda-chuva é a única frase autoral (uma linha de moldura, no
   espírito da nota de upcast do Tiefling).
3. **`requiresLineage`** (DDL-0059) passa a valer para Dwarf/Halfling — elas ganham linhagem
   NATIVA nossa. Conferir `lineageDeferredKinds` (DDL-0061/0062): o Stout traz `resist`, então
   a regra de **remoção** (DDL-0062) provavelmente entra em jogo. Verificar, não supor.
4. **Migração obrigatória** (dupla, e é o ponto de maior risco):
   - ficha salva como `Halfling|XPHB` / `Dwarf|XPHB` **sem** linhagem → recebe *Lightfoot* /
     *Hill* (as opções que reproduzem a base de hoje) — migração sem perda;
   - ficha salva como `Halfling (Ghostwise)|SCAG` / `Halfling (Lotusden)|EGW` (espécies à parte
     desde 2026-07-22) → volta a `Halfling|XPHB` + a linhagem. É o mesmo tipo de migração que o
     DDL-0061 fez com os tieflings; **toda mudança de FORMA de uma espécie legada precisa dela**.
5. **`LEGACY_SUBRACES`**: remover as linhas de Ghostwise/Lotusden (viram `swap`); Keldon fica.
6. **Verificação:** `npm run test`, `npm run lint`, `npm run sweep -- --strict` (as linhas
   `species:*` mudam de forma — `species:Halfling (Ghostwise)|SCAG` vira
   `species:Halfling|XPHB/Halfling; Ghostwise`), e passada ao vivo na aba Species.
   Atenção ao bug de `parseExistingCoverage` corrigido no DDL-0061 (pipe escapado).

---

## 6. Decisões do usuário (2026-07-23) — TODAS TOMADAS

1. **`as: 'swap'` ADOTADO** para Dwarf e Halfling (§5.2). As alternativas descartadas, para não
   serem re-propostas: espécie à parte (piora o nome repetido), identidade cosmética sem mecânica
   (perderia Dwarven Armor Training e Stout Resilience), não fazer nada.
2. **Ghostwise e Lotusden MIGRAM** de espécie à parte para opções da Halfling Lineage. O `swap`
   resolve exatamente o motivo pelo qual o DDL-0060 as tirou de lá (o Naturally Stealthy de
   graça), então o compromisso daquele entry deixa de ser necessário. Implica a migração de ficha
   salva do §5.4 item 4.
3. **A assimetria do Lotusden é ACEITA** — ela fica mais pesada que Lightfoot/Stout/Ghostwise
   (cantrip + 2 magias por nível contra um traço só), e tudo bem: o dado 2014 já era assim e as
   linhagens do Elf 2024 têm esse mesmo formato. **NÃO reescrever** — o texto vem do dado, sem
   curadoria autoral (DDL-0061).
4. **Human, Aasimar, Elf, Gnome e as marcas dracônicas ficam como estão** (§5.3). Keldon segue
   espécie à parte.

**Guarda-chuva final decidido:**

| Base | Traço ocupado | Opções |
|---|---|---|
| `Dwarf\|XPHB` | Dwarven Toughness | **Hill** (Dwarven Toughness) · **Mountain** (Dwarven Armor Training) |
| `Halfling\|XPHB` | Naturally Stealthy | **Lightfoot** (Naturally Stealthy) · **Stout** (Stout Resilience) · **Ghostwise** (Silent Speech) · **Lotusden** (Child of the Wood + Timberwalk + magias) |

---

## 7. O que foi entregue (2026-07-23)

**Só o Halfling**, por decisão do usuário — o Dwarf foi descartado, não adiado. Ver DDL-0063
(desenho + regras) e CHANGELOG §71 (log). O módulo é `engine/legacyHalflingLineages.js`.

Ajustes que a implementação impôs sobre o esboço do §5.4, e que valem para um `swap` futuro:
- **O guarda-chuva precisa existir ANTES do `buildVariant`.** O `replaceArr` da versão procura o
  traço; sobre a base crua ele não acha o alvo e `applyArrMods` ignora a op — o traço da linhagem
  sumiria em silêncio. Daí `withLineageUmbrella` ser aplicado dentro do `raceLineages` e do
  `resolveRaceObj`, e ser idempotente.
- **`lineageDeferredKinds` (DDL-0062) ficou VAZIO** — verificado, não suposto: a regra só age sobre
  campo que a BASE tem, e o Halfling não tem `resist`/`additionalSpells`/perícia. O `resist` do
  Stout chega pela variante e não dispara nada.
- **O `parseExistingCoverage` do sweep já estava certo** (o pipe escapado do DDL-0061): as colunas
  manuais das outras linhas sobreviveram à regeneração.
- A migração dupla previu bem o risco e não teve surpresa.

Sobra deste documento: o **censo do §3**, que continua sendo a resposta com dado à pergunta "o que
ainda falta de espécie?" — e a resposta é: nada, fora o Mountain Dwarf, que está fora de escopo.

---

## 8. Adendo (2026-07-23) — as espécies de CENÁRIO, o outro eixo do "nome repetido"

O censo do §3 é sobre **SUB-RAÇAS** e sobre o eixo **EDIÇÃO**. Depois dele apareceu a outra metade
da queixa de "nome repetido", que ele não cobria porque são **espécies de TOPO**: as entradas de
CENÁRIO — `Elf (Zendikar)`, `Human (Kaladesh)`, `Dwarf (Kaladesh)`… Censo próprio feito, decisões
tomadas e implementadas no **DDL-0064** (+ CHANGELOG §72). Resumo, para não refazer:

- **21 das 90 espécies visíveis são "Plane Shift"** (PSA/PSD/PSI/PSK/PSX/PSZ), PDFs gratuitos do
  crossover com Magic, 2016-2018, regras 2014. Ficam no app; as que COLIDEM de nome com outra
  espécie do catálogo ficam **escondidas por padrão** atrás do filtro "Setting Variant"
  (pré-marcado, removível). As ÚNICAS (Aetherborn, Aven, Khenra, Kor, Merfolk, Naga, Siren,
  Vampire) seguem visíveis - ver o refino no CHANGELOG §73.
- **`LFL` NÃO é isso.** "Lorwyn: First Light" é de **2025-11-18**, livro oficial em **regras 2024**,
  formato moderno — o `Kithkin|LFL` inclusive faz o mesmo `swap` que o DDL-0063. Não tocar.
- **Três espécies foram REMOVIDAS por derivarem ZERO** (`Human (Ixalan)|PSX`,
  `Human (Kaladesh)|PSK`, `Human (Zendikar)|PSZ`) + a linhagem `Gavony`: o conteúdo inteiro delas
  era o `ability` que a regra 2024 descarta. São as **únicas** do catálogo nessa condição.
- **O tratamento de linhagem (`lineage`/`species`/reescrita/`swap`) NÃO se aplica a cenário** — o
  raciocínio completo está no DDL-0064 e não deve ser reaberto: o eixo é outro, e a regra do `as`
  reprova mecanicamente de qualquer forma.

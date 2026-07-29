# DEFERRED-REVIEW.md - o que ainda ignoramos de propósito

> Aberto em **2026-07-29** para revisar tudo que tinha sido adiado por conveniência ao longo do
> projeto. **Três levas já foram implementadas** (ver §4); este documento contém o que CONTINUA
> pendente, o registro do que foi decidido e por quê, e as sugestões para o que sobra (§5).
>
> Regra de manutenção: item implementado SAI da lista de pendências (a decisão vira entrada no DDL
> log do `CLAUDE.md` e no CHANGELOG) e passa para o §4. Item rejeitado FICA, com o motivo, para não
> ser redescoberto.
>
> **Estado do comparador:** `npm run t2` em **35 achados** (+93 nomeados como esperados). Era 71
> quando este documento foi aberto.

---

## 1. Os eixos da classificação

### 1.1 Aprovação (o balanço benefício × malefício)

| Nível | Significado |
|---|---|
| **AUTO** | Não tem malefício algum: nenhum risco, nenhuma dívida de manutenção, nenhuma divergência de modelo. **Aprovado automaticamente**, por regra do usuário. |
| **SIM** | Tem algum custo, mas o benefício é claramente maior. |
| **DECIDIR** | O balanço depende de uma escolha de produto que só o usuário faz. |
| **NÃO** | O malefício supera o benefício, ou já é decisão tomada. |
| **IMPOSSÍVEL** | Não é escolha nossa: limitação do Foundry, do dado upstream, ou conteúdo que não existe. |

**"Malefício" não é esforço.** Esforço tem coluna própria. Malefício é o que a mudança PIORA: risco
de regressão, dívida de curadoria que cresce com o dataset, divergência do modelo do app, conteúdo
inventado, ou informação que o jogador perde.

### 1.2 Criticidade · 1.3 Esforço · 1.4 Escala e quem sente

- **Criticidade:** CRÍTICA (falseia a regra) · ALTA (o jogador perde uma capacidade real) · MÉDIA
  (atrito, dá para contornar) · BAIXA (só fidelidade documental) · NULA (identidade de documento ou
  estado de sessão).
- **Esforço:** TRIVIAL (uma linha) · LOCALIZADO (uma função + teste) · MODERADO (módulo ou gerador)
  · ESTRUTURAL (schema + migração + derivação + UI).
- **Escala:** a correção é **DERIVADA** (funciona sozinha para conteúdo novo) ou **CURADA** (cada
  caso é uma linha, e a dívida cresce)? Uma curadoria só se paga quando o conjunto é FECHADO.
- **Quem sente:** o jogador na **ficha**, no **Foundry**, ou só o **comparador**.

### 1.5 O princípio que rege as decisões de fidelidade

> **O SRD é referência, não autoridade** (fixado pelo usuário, 2026-07-29). Onde ele é apenas
> convenção, convergir é opcional; onde segui-lo penalizaria o usuário ou o funcionamento correto da
> ficha exportada, **divergimos** - e o comparador NOMEIA a divergência (`EXPECTED`) em vez de
> escondê-la.
>
> **Corolário aprendido na prática (§4, leva 2):** divergir sem nomear faz o placar SUBIR. Toda
> divergência deliberada precisa de DUAS coisas: uma forma que não se passe pela do SRD (um título
> de advancement próprio, por exemplo) e uma entrada `EXPECTED` com o motivo escrito.

---

## 2. O que continua pendente

| # | Item | Aprovação | Criticidade | Esforço | Escala | Quem sente |
|---|---|---|---|---|---|---|
| B3 | Polimento do PDF (E5) | **ADIADO** | MÉDIA | MODERADO | derivada | impressão |
| B4b | Deixar o jogador ATRIBUIR origem às magias do balde | **DEPOIS** | BAIXA | MODERADO | derivada | ficha |
| C0 | `ItemChoice` da ancestralidade do Goliath | **NÃO** | BAIXA | LOCALIZADO | derivada | comparador |
| C1 | Chips de meta duplicados por traço de prosa | **NÃO** | - | - | - | ficha |
| C2 | Activities que temos a mais (Smite, Agonizing Blast) | **NÃO** | NULA | TRIVIAL | - | comparador |
| C3 | Nome do item de background ("Custom Background") | **NÃO** | NULA | LOCALIZADO | - | comparador |
| C4 | Pack como um item só (sem contêiner) | **NÃO** | BAIXA | ESTRUTURAL | derivada | Foundry |
| C5 | Classes sidekick e conteúdo UA | **NÃO** | NULA | MODERADO | derivada | ficha |
| C6 | Toggle geral de conteúdo legado | **NÃO** | BAIXA | ESTRUTURAL | derivada | ficha |
| C7 | As 6 entradas `EXPECTED` do comparador | **NÃO** | NULA | - | - | comparador |
| D1 | `@scale.barbarian.rage` quebrado no upstream | **IMPOSSÍVEL** | BAIXA | - | - | Foundry |
| D2 | UUID para conteúdo fora do SRD | **IMPOSSÍVEL** | BAIXA | - | - | Foundry |
| D3 | Duas fórmulas de CA sem armadura no multiclasse | **IMPOSSÍVEL** | BAIXA | - | - | Foundry |
| D4 | `{@creature}` e `{@deity}` inertes | **NÃO** | BAIXA | MODERADO | derivada | ficha |
| D5 | Quirks dos próprios premades | **IMPOSSÍVEL** | NULA | - | - | comparador |
| D6 | Prosa, identidade de documento, estado de sessão, `senses`/`movement`, `artificer`==`half` | **NÃO** | NULA | - | - | ninguém |

**Nenhuma decisão do usuário pendente.** Duas coisas agendadas para depois (B3, B4b) e 14 mantidas
com motivo.

---

## 3. Item a item

### B - Agendados

#### B3. Polimento do PDF (E5) - ADIADO, mas na mira

- **O que é.** Item 2 do known-deferred-backlog: cantrips de ataque na tabela de armas, ajuste de
  overflow para listas muito longas de features/equipamento, miudezas da página de retrato.
- **Decisão do usuário (2026-07-29):** adiar mais um pouco, mantendo em mente. *"O PDF não é nossa
  prioridade pois a ficha digital já cumpre o papel que uma ficha impressa cumpriria."*
- **Quando voltar, o overflow vem primeiro:** é a única parte que pode inutilizar a folha, e uma
  ficha de nível 17 é justamente onde a impressão é mais usada.

#### B4b. Deixar o jogador ATRIBUIR origem às magias do balde

- **O que é.** A parte lossless do B4 **já foi feita** (§4, leva 3): magias que um ator importado
  trazia e nenhuma classe da ficha sabe conjurar ficam guardadas em `character.unassignedSpells`, o
  re-export as devolve ao Foundry, e o import avisa o jogador. Elas não aparecem na Spellbook porque
  não têm origem.
- **O passo seguinte, decidido pelo usuário:** permitir que o jogador **indique a origem** dessas
  magias, escolhendo entre as possibilidades que a ficha oferece (as origens de conjuração que ele
  tem, ou uma marca de "concedida por item/DM").
- **Por que é fácil a partir daqui:** o balde guarda `SpellRef`, a mesma forma do
  `ClassEntry.spells`. Atribuir uma origem é MOVER o ref de um array para o outro; o resto (limites,
  DC, preparação) a derivação já faz. O trabalho é de UI, não de modelo.
- **A regra que precisa ser mantida:** o balde é CARGA, não decisão do jogador. Quem acrescentar um
  consumidor tem de respeitar isso - ele não conta em limite nenhum enquanto não for atribuído.

---

### C - Mantidos (o malefício supera, ou a decisão continua válida)

#### C0. O `ItemChoice` da ancestralidade do Goliath (4 achados)

O SRD modela a escolha do benefício como um `ItemChoice` com o pool dos seis boons; nós emitimos o
boon escolhido como item (feito na leva 2) mas num `ItemGrant`. Montar o pool exigiria alcançar a
espécie BASE de dentro do `buildSpeciesItem`, que só tem o `_baseName`. **O jogador tem o benefício**
e ele aparece como feature; o que falta é o Foundry saber que era uma escolha. Só o comparador vê.

#### C1. Chips de meta duplicados por um traço de prosa

Espécies reformatadas (MPMM e outras) trazem "Creature Type", "Size" e "Speed" como TRAÇOS de prosa,
ao lado dos chips que a ficha já mostra. São 95 entradas no dado (~22 alcançáveis).

**Decisão do usuário (2026-07-29): manter como está, e a razão é melhor que a minha.** Eu tinha
tratado a redundância como ruído; ela não é:

- **muitas dessas prosas detalham o funcionamento CORRETO da feature** - a limitação do voo à
  armadura leve (média no caso do Tiefling Winged) está no texto, não no chip;
- **servem de lembrete do traço**, o que é justamente o público do app (jogadores novos);
- **a redundância do chip continua útil** como referência rápida para quem já conhece a regra.

Ou seja: as duas apresentações têm função diferente, e esconder qualquer uma das duas perderia
informação. A pergunta que eu havia reformulado (esconder o CHIP em vez do traço) está **respondida
e encerrada** - não reabrir.

#### C2. Activities que NÓS temos e o premade não (6 achados)

`Paladin's Smite` (o `cast` do overlay) e `Agonizing Blast` (`enchant`). O SRD tem `activities: {}`
para o primeiro porque em 2024 Divine Smite é MAGIA. **Tirá-las PERDE um botão que o RAW 2024
concede** - sob o princípio §1.5, manter é o certo. **Único ponto a checar no T2d:** confirmar que o
uso grátis do Smite não fica contado em dobro (item de magia + activity). Se estiver, aí sim é o
nosso extra que penaliza, e a activity sai.

#### C3. Nome do item de background

O FlyBy só tem origens custom, então sai "Custom Background". A mecânica inteira (boosts, perícias,
ferramenta, idiomas, talento) É comparada e está correta. Mudar exigiria um catálogo de origens
prontas, que é decisão de produto oposta à que o projeto tomou.

#### C4. Pack como um item só

Nosso modelo compra "Explorer's Pack" como UM item (DDL-0013); o Foundry usa um `container` com o
conteúdo dentro. Desdobrar mexe no inventário, no peso, no preço e na UI da aba: ESTRUTURAL para
benefício de organização. Reavaliar só se o peso carregado começar a divergir de forma visível.

#### C5. Classes sidekick e conteúdo UA · C6. Toggle geral de conteúdo legado

Decisões de escopo (2026-07-22, DDL-0058). No caso do legado, o levantamento que sustentou o
cancelamento continua valendo: as perdas reais fora das sub-raças eram 3 talentos, 3 magias, ~17
invocações e 8 itens base - e as sub-raças, que eram a perda de verdade, **já voltaram curadas**
(DDL-0059 a 0063, e o Dwarf na leva 3).

#### C7. As seis entradas `EXPECTED` do comparador (93 achados nomeados)

| id | O que é |
|---|---|
| `baked-feature-grant` | O premade deixa a proficiência de uma feature a cargo de um Active Effect; nós a assamos no ator. Runtime idêntico. |
| `capstone-asi-on-class-item` | O aumento do capstone: o SRD usa as duas formas (item de classe no Monge, item da feature no Bárbaro). |
| `curated-swap-lineage` | Os guarda-chuvas "Halfling Lineage" e "Dwarf Lineage" são acréscimo NOSSO (DDL-0063); herdar o nome publicado faria o Foundry trocar a linhagem escolhida pela base. |
| `class-spell-ladder` | Emitimos a escada de magias da classe nos níveis futuros de TODA classe; o SRD só a tem no Paladino. Sem ela, subir de nível no Foundry não concede a magia. |
| `universal-unarmed-strike` | Concedemos o Ataque Desarmado a toda classe, não só a Bárbaro e Monge. |
| `race-grant-level-convention` | O SRD não é consistente sobre em que nível pendurar uma concessão de criação (`@0` no Gnome, `@1` no Elfo). Nossa convenção é mais coerente e o Foundry concede igual. |

Em três delas **a nossa saída é melhor que a do SRD**.

---

### D - Fora do nosso alcance

- **D1. `@scale.barbarian.rage` quebrado.** A activity do Persistent Rage referencia uma escala que
  **nem o ator oficial tem** (a escala se chama `rages` dos dois lados; conferido no premade do
  Merric L17). Corrigir divergiria do documento publicado e sumiria na próxima regeração. **Vale
  checar no T2d se isso impede o Persistent Rage de funcionar** - se impedir, o princípio §1.5 manda
  consertar, e é uma linha.
- **D2. UUID para o que o SRD não publica.** Artificer, as 123 subclasses fora do SRD, variantes
  mágicas geradas, linhagens mescladas e espécies legadas curadas ficam sem `compendiumSource`. Por
  design (DDL-0056): apontar para um near-match faria o Foundry **substituir o conteúdo do jogador**.
- **D3. Duas fórmulas de CA sem armadura num multiclasse.** O ator do Foundry tem UM `ac.calc`. A
  ficha ao vivo do FlyBy escolhe a maior e é a fonte da verdade (DDL-0045).
- **D4. `{@creature}` e `{@deity}` inertes.** Ao contrário do `{@table}` (feito na leva 1), estes
  **não** têm o alvo carregado: os bestiários são o maior dado do 5etools e nunca entraram no
  manifesto. Ligá-los significa baixar o bestiário inteiro por causa de links de sabor. A conta muda
  se o play mode um dia precisar de stat blocks de companheiro.
- **D5. Quirks dos próprios premades.** `spell.method` da Sefris (o documento encoda uma magia dela
  diferente de todas as irmãs) e `details.xp` do Riswynn L11 (o XP não bate com o nível da própria
  ficha). São defeitos do gabarito.
- **D6. O que o comparador nem olha.** Prosa, identidade de documento, estado de sessão,
  `senses`/`movement` (o Foundry deriva de effects) e `artificer` == `half`. **Não são
  divergências**; a lista existe para que ninguém as trate como tal.

---

## 4. Implementado (registro do que saiu da lista)

### Leva 1 - os aprovados automaticamente (2026-07-29, CHANGELOG §103)

| Item | Resultado |
|---|---|
| Item "Unarmed Strike" no Bárbaro e no Monge | A premissa antiga do TC-0071 ("seria inventar um documento") estava ERRADA: o item existe no `equipment24`. O uuid e a ficha vêm do próprio documento da classe no SRD. Um Monge criado no app chegava ao Foundry **sem a arma principal da classe**. |
| `{@table}` inline vira link | O risco de link morto que a mantinha inerte caiu no DDL-0035. **226 das 230 tags** do conteúdo que exibimos resolvem - a maior parte em descrição de item mágico. |
| Raridades sem chip na loja | `unknown`, `unknown (magic)` e `varies` deixavam **301 itens inalcançáveis** pelo filtro. |

### Leva 2 - os aprovados restantes e as sugestões (2026-07-29, CHANGELOG §104)

| Item | Resultado |
|---|---|
| Boon do Goliath como item próprio | "Cloud's Jaunt" vira documento à parte, por uma regra ESTREITA (o traço tem de ter exatamente UM sub-item nomeado, e o nome tem de existir no `origins24`) e num passo de advancement próprio. |
| Idioma `other` | Registro curado de 22 espécies (`engine/speciesLanguages.js`): "Other" virou "Loxodon", "Quori", "Vedalken"… Atinge o card de Idiomas de 21 espécies E a única escolha do app que não dizia o que era (o Simic Hybrid). |
| Unarmed Strike para TODA classe | **Primeira divergência deliberada do SRD** sob o princípio §1.5. Nomeada no comparador como `universal-unarmed-strike`. |
| Convenções de nível viram `EXPECTED` | O SRD não tem regra aqui. **Antes disso, fechei uma lacuna REAL que o predicado esconderia:** a magia ESCOLHIDA da linhagem (o cantrip do Alto Elfo) não entrava na escada de concessão. |
| Aviso de magia sem origem no import | Metade barata do B4; a lossless veio na leva 3. |

### Leva 3 - as decisões B (2026-07-29, CHANGELOG §105)

| Item | Decisão e resultado |
|---|---|
| **B1** chips duplicados | **Manter**, com a razão do usuário: a prosa detalha o funcionamento correto (a limitação do voo à armadura leve/média) e serve de lembrete a novatos; o chip é referência rápida para veteranos. As duas têm função diferente. Encerrado - virou o **C1**. |
| **B2** `swap` do Dwarf | **Feito.** O módulo virou genérico (`engine/legacySwapLineages.js`, registro `SWAP_LINEAGES`): "Dwarf Lineage" com Hill/Mountain, cada uma TROCANDO o Dwarven Toughness que a base 2024 absorveu do Hill. |
| **B3** PDF | **Adiado** (a ficha digital já cumpre o papel da impressa). Continua na lista, §3. |
| **B4** magias sem origem | **Lossless feito**: balde `unassignedSpells` no schema, devolvido ao Foundry no re-export. A atribuição de origem pelo jogador ficou agendada como **B4b**. |
| **B5** criação em nível alto | **Manter como está** (irrelevante para o uso atual do app), e **as menções foram removidas da documentação** - CLAUDE.md "Explicitly OUT OF SCOPE" e TESTING-PLAN. |

**Duas armadilhas que a leva 3 destapou**, e valem como regra:

1. **Um `swap` move a MECÂNICA junto com o traço.** O `Dwarven Toughness` (+1 HP/nível) vive num
   registro curado keyed por nome de raça RESOLVIDA (`hpBonuses`). Ao virar linhagem, a chave
   `Dwarf|XPHB` deixou de casar e **nenhum** Dwarf ganhava o HP. Quem acrescentar uma espécie ao
   `SWAP_LINEAGES` tem de varrer os registros keyed por nome de raça e migrar a chave para a opção.
2. **Assinatura derivada larga dá falso positivo - foi a segunda vez.** O gerador marcava "o
   documento do SRD guarda a linhagem dentro de si" com um `- dr:` em qualquer lugar do YAML; a
   resistência a veneno do Dwarven Resilience é um **grant fixo**, não uma escolha, então o Dwarf
   entrava e a nossa linhagem herdava o nome e a procedência do documento publicado - exatamente o
   near-match que o DDL-0056 proíbe. O `dr:` agora tem de estar sob `pool:`. **O sweep pegou nos dois
   casos, na mesma rodada** (137 linhas vermelhas): rode `npm run sweep -- --strict` depois de cada
   mudança de export/import.

---

## 5. Sugestões para os achados que ficam

> Sob o princípio §1.5. Nenhuma está aprovada: são candidatas, com o ganho para o usuário explícito.
> As três sugestões da rodada anterior (5.1, 5.2, 5.3) foram implementadas - ver §4, leva 2.

### 5.1 O `ItemChoice` da ancestralidade (4 achados) - custo mal distribuído

O C0 fica por um motivo técnico estreito: `buildSpeciesItem` recebe a espécie RESOLVIDA e não alcança
a base para montar o pool das seis opções.

- **Sugestão, se algum dia valer:** passar o `db` + o `_baseName` para o construtor do item de raça e
  derivar o pool das MARCAS de linhagem que o `inferLineage` já calcula (elas são exatamente os seis
  boons). A máquina existe; falta a fiação.
- **Ganho:** o Foundry passaria a saber que a ancestralidade foi uma escolha, e ofereceria trocá-la
  no level-up. **Não muda nada para quem joga hoje.**

### 5.2 As 3 magias `items.spell` que sobram - medir antes de mexer

Caíram de 11 para 3 com o balde lossless. As três restantes (`detect poison and disease` no Quillathe
L05 e companhia) estão numa classe CONJURADORA, então não são caso de balde.

- **Sugestão:** antes de qualquer código, classificar as três pela FORMA que têm no premade - foi
  exatamente isso que transformou o TC-0080 de "268 magias sumindo" em quatro problemas distintos,
  três deles acionáveis. Três achados podem ser três causas.

### 5.3 `feat.activities` (6) e `advancement.subclass` (6) - conferir no Foundry primeiro

Os dois grupos restantes têm a mesma característica: **o que decide se são bug é o runtime**, não o
documento.

- `feat.activities` são as activities que temos A MAIS (C2). A pergunta é se o uso grátis do Smite
  fica contado em dobro.
- `advancement.subclass` são passos de forma diferente (`Trait@6` do Draconic Sorcery, `ItemChoice@0`
  do Champion). A pergunta é se o Foundry aplica a mecânica de outra via.
- **Sugestão:** ambos entram na lista de verificação do **T2d**, e a decisão vem de lá. Mexer antes é
  adivinhar.

### 5.4 Uma varredura que ainda não fizemos: os OUTROS registros keyed por nome de raça

A armadilha 1 da leva 3 (o HP do Dwarf) foi pega pelo sweep, mas por sorte: o `hpBonuses` tinha uma
chave de Dwarf. Nada garante que o próximo registro tenha cobertura de sweep igual.

- **Sugestão (barata, e é higiene):** uma sonda que cruze TODO registro curado keyed por
  `Nome|FONTE` de espécie (`hpBonuses`, `naturalArmor`, `settingSpecies`, `mergedLineages`,
  `speciesLanguages`) com o catálogo RESOLVIDO, e acuse chave que não casa nada. Uma chave morta é
  sempre um sintoma: ou a espécie mudou de nome, ou a mecânica ficou órfã.
- **Ganho:** transforma a lição da leva 3 em rede permanente, em vez de comentário.

### 5.5 Resumo

| # | Sugestão | Ganho | Custo | Depende de |
|---|---|---|---|---|
| 5.1 | `ItemChoice` da ancestralidade | O Foundry sabe que foi escolha | LOCALIZADO | nada (baixa prioridade) |
| 5.2 | Classificar as 3 magias restantes | Saber se são 1 ou 3 causas | TRIVIAL (medição) | nada |
| 5.3 | Smite em dobro / passos de subclasse | Decidir com fato, não palpite | - | **T2d** |
| 5.4 | Sonda de chave morta nos registros de espécie | Rede permanente contra a armadilha da leva 3 | LOCALIZADO | nada |

---

## 6. Próximos passos

1. **O T2d**, que só o usuário pode fazer: `npm run sweep -- --emit-actors` e a importação real no
   Foundry. Quatro perguntas concretas esperando resposta:
   - o dnd5e oferece o ataque desarmado por outro caminho? (se sim, a divergência do
     `universal-unarmed-strike` virou redundante e pode voltar a seguir o SRD);
   - o uso grátis do Paladin's Smite fica contado em dobro? (C2 / §5.3);
   - o `@scale.barbarian.rage` quebrado impede o Persistent Rage de funcionar? (D1);
   - a linhagem do Dwarf e o item de Ataque Desarmado chegam certos numa ficha real?
2. **TC-0083** (`testing/ISSUES.md`): o `BuilderInner` viola a ordem dos Hooks. Confirmado como
   **pré-existente** por A/B. Sem sintoma funcional observado, mas é bug latente - vale investigar
   antes da Fase C.
3. **§5.4**, se quiser fechar a lição da leva 3 com uma rede em vez de um comentário.

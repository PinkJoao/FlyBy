# DEFERRED-REVIEW.md - o que ainda ignoramos de propósito

> Aberto em **2026-07-29** para revisar tudo que tinha sido adiado por conveniência ao longo do
> projeto. **Duas levas já foram implementadas** (ver §4); este documento foi reescrito para conter
> só o que CONTINUA pendente, mais o registro do que foi decidido e por quê.
>
> Regra de manutenção: item implementado SAI daqui (a decisão vira entrada no DDL log do
> `CLAUDE.md` e no CHANGELOG). Item rejeitado FICA, com o motivo, para não ser redescoberto.
>
> **Estado do comparador:** `npm run t2` em **43 achados** (+85 nomeados como esperados). Era 71
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

---

## 2. O que continua pendente

| # | Item | Aprovação | Criticidade | Esforço | Escala | Quem sente |
|---|---|---|---|---|---|---|
| B1 | Chips de meta duplicados por traço de prosa | **DECIDIR** | MÉDIA | LOCALIZADO | derivada | ficha |
| B2 | `swap` do Dwarf (Hill/Mountain) | **DECIDIR** | BAIXA | TRIVIAL | curada (1 caso) | ficha |
| B3 | Polimento do PDF (E5) | **DECIDIR** | MÉDIA | MODERADO | derivada | impressão |
| B4 | Guardar as magias sem origem (a forma elaborada) | **DECIDIR** | BAIXA | ESTRUTURAL | derivada | Foundry |
| B5 | Criação direta em nível alto | **DECIDIR** | MÉDIA | ESTRUTURAL | derivada | ficha |
| C1 | `ItemChoice` da ancestralidade do Goliath | **NÃO** | BAIXA | LOCALIZADO | derivada | comparador |
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

**5 decisões do usuário pendentes, 13 mantidos.** Nada aprovado está por fazer.

---

## 3. Item a item

### B - Precisam de uma decisão do usuário

#### B1. Chips de meta duplicados por um traço de prosa

- **O que é.** Espécies reformatadas (MPMM e outras) trazem "Creature Type", "Size" e "Speed" como
  TRAÇOS de prosa, ao lado dos chips que a ficha já mostra com a mesma informação. São **95 entradas
  no dado** (~22 alcançáveis depois do `latestOnly`).
- **Decisão anterior (2026-07-25):** manter. *"Por mais que seja redundante com as chips, é mínimo,
  então vamos minimizar a interferência onde não precisamos."* O `LEGACY_PROSE_SECTIONS` (DDL-0059)
  existe só para sobras dos merges que NÓS fazemos.
- **A pergunta reformulada, que é o que reabre o item.** São duas coisas diferentes:
  - **esconder o TRAÇO** - mexer no conteúdo do compêndio. Continua sendo o que você recusou, e eu
    concordo: é conteúdo de terceiros, e o critério "é redundante" é nosso, não do livro;
  - **esconder o CHIP quando existe um traço homônimo** - mexer só na NOSSA apresentação. Mesmo
    resultado visual, sem tocar em nada de fora.
- **Se aprovado:** MÉDIA / LOCALIZADO / derivada.

#### B2. O `swap` do Dwarf (Hill/Mountain)

- **O que é.** O Dwarf tem o padrão de absorção IDÊNTICO ao do Halfling (Dwarf XPHB = Dwarf 2014 +
  Dwarven Toughness do *Hill*; o *Mountain* ficou de fora com o Dwarven Armor Training). O mecanismo
  `as: 'swap'` do DDL-0063 resolveria igual.
- **Decisão anterior (2026-07-23):** só o Halfling, porque *"o objetivo era centralizar as opções
  mais relevantes e confusas, não varrer o dataset"*.
- **Por que reabro:** era decisão de PRIORIDADE, tomada com muito mais coisa na frente. O custo hoje
  é **TRIVIAL** (um segundo alvo no `engine/legacyHalflingLineages.js` + a migração que o DDL-0063 já
  documentou), e não há malefício técnico.
- **O que ainda é escolha sua:** se a Anã da Montanha DEVE ser construível no FlyBy. É decisão de
  conteúdo, não de código.

#### B3. Polimento do PDF (E5)

- **O que é.** Item 2 do known-deferred-backlog: cantrips de ataque na tabela de armas, ajuste de
  overflow para listas muito longas de features/equipamento, miudezas da página de retrato.
- **Sem malefício**, mas é a única linha da lista que é **trabalho de produto, não correção**:
  ninguém reportou, e a fase E foi dada como concluída.
- **Criticidade MÉDIA:** o PDF é o formato que vai para a mesa física, e um overflow numa ficha de
  nível 17 é justamente onde ele mais é usado.
- **Sugestão:** só o **overflow** agora (é o que pode inutilizar a folha); o resto depois.

#### B4. Guardar as magias sem origem (a forma elaborada)

- **O que é.** Um ator externo pode listar magias que nenhuma classe da ficha sabe conjurar - o
  premade da Riswynn (Ladina) traz 35 como sugestão. Nosso modelo não tem onde guardá-las.
- **A metade barata JÁ FOI FEITA** (2026-07-29): o import agora **AVISA** quantas magias não foram
  importadas, em vez de perdê-las em silêncio. O que resolvia a surpresa está resolvido.
- **O que fica pendente, e é um LEMBRETE deliberado:** guardar de fato o conteúdo, para que
  reimportar um ator externo seja lossless. Duas formas possíveis, em ordem de custo:
  1. **snapshot de carga** - um balde no schema no molde do `custom` que o inventário já usa para
     item fora do catálogo: as magias voltariam ao Foundry no re-export, sem aparecer na aba
     Spellbook (não têm origem). LOCALIZADO, mas cria um campo que não é decisão do jogador e
     precisa de regra clara de quando é lido, senão vira depósito.
  2. **modelar "magia sem origem"** como conceito de primeira classe. ESTRUTURAL, e a regra do jogo
     não tem esse conceito.
- **Minha recomendação continua sendo NÃO**, a menos que *"reimportar qualquer ator é lossless"*
  vire um princípio do projeto - aí é decisão de arquitetura, não deste item isolado.

#### B5. Criação direta em nível alto

- **O que é.** Cancelado em 2026-07-22: o personagem nasce no nível 1 e sobe pelo app.
- **Sem malefício técnico**, mas com custo real de fluxo: o guia de criação teria de ordenar
  decisões de vários níveis de uma vez, e o DDL-0013 registrou que essa ordenação ficou de fora.
- **Por que reabro:** é a única decisão cancelada cuja motivação era "não é para agora". Com o app
  maduro a pergunta muda: **um mestre que precisa de um NPC de nível 9 hoje clica oito vezes no
  `+`.** Isso é atrito de USO, não de criação de personagem.
- **Se voltar, sugiro a versão barata primeiro:** um campo de nível na criação que aplica os `+` em
  sequência e joga o jogador no guia de pendências, que já existe e já sabe listar o que falta em
  qualquer nível.

---

### C - Mantidos (o malefício supera, ou a decisão continua válida)

#### C1. O `ItemChoice` da ancestralidade do Goliath (4 achados)

O SRD modela a escolha do benefício como um `ItemChoice` com o pool dos seis boons; nós emitimos o
boon escolhido como item (**isso já foi feito** - ver §4) mas num `ItemGrant`. Montar o pool exigiria
alcançar a espécie BASE de dentro do `buildSpeciesItem`, que só tem o `_baseName`. **O jogador tem o
benefício** e ele aparece como feature; o que falta é o Foundry saber que era uma escolha. Só o
comparador vê.

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
(DDL-0059 a 0063).

#### C7. As seis entradas `EXPECTED` do comparador (85 achados nomeados)

| id | O que é |
|---|---|
| `baked-feature-grant` | O premade deixa a proficiência de uma feature a cargo de um Active Effect; nós a assamos no ator. Runtime idêntico. |
| `capstone-asi-on-class-item` | O aumento do capstone: o SRD usa as duas formas (item de classe no Monge, item da feature no Bárbaro). |
| `curated-halfling-lineage` | O guarda-chuva "Halfling Lineage" é acréscimo NOSSO (DDL-0063); herdar o nome publicado faria o Foundry trocar a linhagem escolhida pela base. |
| `class-spell-ladder` | Emitimos a escada de magias da classe nos níveis futuros de TODA classe; o SRD só a tem no Paladino. Sem ela, subir de nível no Foundry não concede a magia. |
| `universal-unarmed-strike` | Concedemos o Ataque Desarmado a toda classe, não só a Bárbaro e Monge (ver §4). |
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
- **D4. `{@creature}` e `{@deity}` inertes.** Ao contrário do `{@table}` (feito, §4), estes **não**
  têm o alvo carregado: os bestiários são o maior dado do 5etools e nunca entraram no manifesto.
  Ligá-los significa baixar o bestiário inteiro por causa de links de sabor. A conta muda se o play
  mode um dia precisar de stat blocks de companheiro.
- **D5. Quirks dos próprios premades.** `spell.method` da Sefris (o documento encoda uma magia dela
  diferente de todas as irmãs) e `details.xp` do Riswynn L11 (o XP não bate com o nível da própria
  ficha). São defeitos do gabarito.
- **D6. O que o comparador nem olha.** Prosa, identidade de documento, estado de sessão,
  `senses`/`movement` (o Foundry deriva de effects) e `artificer` == `half`. **Não são
  divergências**; a lista existe para que ninguém as trate como tal.

---

## 4. Implementado (registro do que saiu desta lista)

### Leva 1 - os aprovados automaticamente (2026-07-29, CHANGELOG §103)

| # | Item | Resultado |
|---|---|---|
| A1 | Item "Unarmed Strike" no Bárbaro e no Monge | A premissa antiga do TC-0071 ("seria inventar um documento") estava ERRADA: o item existe no `equipment24`. O uuid e a ficha vêm do próprio documento da classe no SRD. Um Monge criado no app chegava ao Foundry **sem a arma principal da classe**. |
| A2 | `{@table}` inline vira link | O risco de link morto que a mantinha inerte caiu no DDL-0035. **226 das 230 tags** do conteúdo que exibimos resolvem - a maior parte em descrição de item mágico. |
| A3 | Raridades sem chip na loja | `unknown`, `unknown (magic)` e `varies` deixavam **301 itens inalcançáveis** pelo filtro. |

### Leva 2 - os aprovados restantes e as sugestões (2026-07-29, CHANGELOG §104)

| # | Item | Resultado |
|---|---|---|
| A4/5.5 | Boon do Goliath como item próprio | "Cloud's Jaunt" vira documento à parte, por uma regra ESTREITA (o traço tem de ter exatamente UM sub-item nomeado, e o nome tem de existir no `origins24`) e num passo de advancement próprio, para não inflar a contagem do passo oficial. |
| A5 | Idioma `other` | Registro curado de 22 espécies (`engine/speciesLanguages.js`): "Other" virou "Loxodon", "Quori", "Vedalken"… Atinge o card de Idiomas de 21 espécies E a única escolha do app que não dizia o que era (o Simic Hybrid). |
| 5.1 | Unarmed Strike para TODA classe | **Primeira divergência deliberada do SRD sob o princípio §1.5.** A regra 2024 diz que toda criatura pode fazer um Ataque Desarmado; sem o item, um Mago desarmado chega ao Foundry sem botão nenhum. Nomeado no comparador como `universal-unarmed-strike`. |
| 5.2 | Convenções de nível viram `EXPECTED` | O SRD não tem regra aqui (`@0` no Gnome, `@1` no Elfo). Saem da contagem, ficam nomeadas. **Antes disso, fechei uma lacuna REAL que o predicado esconderia:** a magia ESCOLHIDA da linhagem (o cantrip do Alto Elfo) não entrava na escada de concessão porque o `bag` não era passado. |
| 5.3 | Aviso de magia sem origem no import | O import avisa quantas magias o ator listava que nenhuma classe da ficha sabe conjurar. A forma elaborada continua pendente - virou o **B4**. |

**Lição de método desta leva:** divergir do SRD sem NOMEAR a divergência faz o placar subir, não
descer. O `universal-unarmed-strike` acrescentou 40 achados de `items.gear` e inflou o
`class-spell-ladder` de 6 para 46, porque o passo novo se misturava ao ItemGrant oficial. A correção
foi dupla: **título de advancement próprio** para o que é nosso, e uma entrada `EXPECTED` com o
motivo escrito. Vale para toda divergência futura sob o princípio §1.5.

---

## 5. Próximos passos

1. **As cinco decisões B1-B5**, em ordem de impacto: **B5** (criar em nível alto - a que mais muda o
   uso do app, e tem uma versão barata), **B1** (chips duplicados - reformulada), **B3** (só o
   overflow do PDF), **B2** (Dwarf, custo trivial), **B4** (recomendo não).
2. **O T2d**, que só o usuário pode fazer: `npm run sweep -- --emit-actors` e a importação real no
   Foundry. Três perguntas concretas esperando resposta:
   - o dnd5e oferece o ataque desarmado por outro caminho? (se sim, o 5.1 virou redundante e pode
     voltar a seguir o SRD);
   - o uso grátis do Paladin's Smite fica contado em dobro? (C2);
   - o `@scale.barbarian.rage` quebrado impede o Persistent Rage de funcionar? (D1).
3. **TC-0083** (`testing/ISSUES.md`): o `BuilderInner` viola a ordem dos Hooks. Achado nesta sessão,
   confirmado como **pré-existente** por A/B. Sem sintoma funcional observado, mas é bug latente -
   vale investigar antes da Fase C.

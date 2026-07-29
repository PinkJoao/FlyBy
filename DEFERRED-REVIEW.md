# DEFERRED-REVIEW.md - revisão das divergências que ignoramos de propósito

> Levantamento feito em **2026-07-29**, ao fim da T2b sessão 7 (`npm run t2` em 71 achados).
> O projeto está maduro o bastante para reabrir o que foi adiado por conveniência. Este documento
> pega **tudo** que hoje é ignorado deliberadamente - as listas `DELIBERATE`/`EXPECTED` do
> comparador, os 71 achados restantes, os cosméticos espalhados pelos DDLs e o escopo cancelado -
> e classifica cada item para decidir **o que voltamos a fazer agora**.
>
> Quando um item for aprovado e implementado, marque-o aqui e mova a decisão para o DDL log do
> `CLAUDE.md`. Quando for rejeitado de novo, o motivo fica registrado aqui e a entrada não deve ser
> redescoberta numa sessão futura.

---

## 1. Os eixos da classificação

### 1.1 Aprovação (o balanço benefício × malefício)

| Nível | Significado |
|---|---|
| **AUTO** | Não tem malefício algum: nenhum risco, nenhuma dívida de manutenção, nenhuma divergência de modelo. **Aprovado automaticamente**, por regra sua. |
| **SIM** | Tem algum custo, mas o benefício é claramente maior. Aprovado. |
| **DECIDIR** | O balanço depende de uma escolha de produto que só você faz (o que a ficha deve mostrar, até onde ir no escopo). |
| **NÃO** | O malefício supera o benefício, ou já é uma decisão tomada. Fica como está, e o motivo está escrito. |
| **IMPOSSÍVEL** | Não é uma escolha nossa: limitação do Foundry, do dado upstream ou de conteúdo que não existe. |

**"Malefício" aqui não é esforço.** Esforço tem coluna própria. Malefício é o que a mudança PIORA:
risco de regressão, dívida de curadoria que cresce com o dataset, divergência do modelo do app,
conteúdo inventado, ou informação que o jogador perde.

### 1.2 Criticidade (o quanto a ausência machuca, hoje e no futuro)

| Nível | Significado |
|---|---|
| **CRÍTICA** | Quebra ou falseia a regra. O jogador chega à mesa com a ficha errada. |
| **ALTA** | O jogador perde uma capacidade real (uma ação que não dá para usar, um recurso que não dá para gastar). |
| **MÉDIA** | Atrito ou confusão: funciona, mas o jogador precisa saber contornar. |
| **BAIXA** | Só fidelidade documental. Ninguém percebe jogando. |
| **NULA** | Nem fidelidade: é diferença de identidade de documento ou estado de sessão. |

A coluna considera **hoje e no futuro**: um item de criticidade baixa hoje sobe se estiver no
caminho de algo que vem depois (a Fase C, o play mode, é a próxima grande peça).

### 1.3 Esforço estrutural

| Nível | Significado |
|---|---|
| **TRIVIAL** | Uma linha de registro, ou um valor. Minutos. |
| **LOCALIZADO** | Uma função e seu teste. Uma sessão curta. |
| **MODERADO** | Um módulo novo ou um gerador, com testes e uma passada de verificação. |
| **ESTRUTURAL** | Toca schema, migração, derivação e UI ao mesmo tempo. Sessão inteira ou mais. |

### 1.4 Dois parâmetros extras que mudam a decisão

- **Escala** - a correção é **DERIVADA** (funciona sozinha para conteúdo novo) ou **CURADA**
  (cada caso novo é uma linha a mais, e a dívida cresce com o dataset)? A campanha inteira mostrou
  que derivado quase sempre vence, e que uma curadoria só se paga quando é um conjunto FECHADO.
- **Quem sente** - o jogador na **ficha do FlyBy**, o jogador no **Foundry**, ou só o
  **comparador**? Um achado que só o comparador vê é, por definição, de criticidade baixa.

---

## 2. Quadro geral

Ordenado por aprovação e depois por criticidade. Os detalhes de cada linha estão na seção 3.

| # | Item | Aprovação | Criticidade | Esforço | Escala | Quem sente |
|---|---|---|---|---|---|---|
| A1 | Item "Unarmed Strike" no Bárbaro e no Monge | ✅ **FEITO** | ALTA | LOCALIZADO | derivada | Foundry |
| A2 | `{@table}` inline vira link no glossário | ✅ **FEITO** | MÉDIA | LOCALIZADO | derivada | ficha |
| A3 | Raridades sem chip na loja (`unknown`, `varies`) | ✅ **FEITO** | MÉDIA | TRIVIAL | derivada | ficha |
| A4 | Boon do Goliath como item próprio ("Cloud's Jaunt") | **SIM** | BAIXA | LOCALIZADO | derivada | Foundry |
| A5 | Idioma `other` mostrando "Other" no seletor | **SIM** | MÉDIA | LOCALIZADO | curada (3 casos) | ficha |
| B1 | Traços de prosa duplicando os chips (95 espécies) | **DECIDIR** | MÉDIA | LOCALIZADO | derivada | ficha |
| B2 | `swap` do Dwarf (Hill/Mountain) | **DECIDIR** | BAIXA | TRIVIAL | curada (1 caso) | ficha |
| B3 | Polimento do PDF (E5) | **DECIDIR** | MÉDIA | MODERADO | derivada | impressão |
| B4 | Grimório sem origem (as 35 magias da Riswynn) | **DECIDIR** | BAIXA | ESTRUTURAL | derivada | Foundry |
| B5 | Criação direta em nível alto | **DECIDIR** | MÉDIA | ESTRUTURAL | derivada | ficha |
| C1 | Convenções de nível do `advancement.race` | **NÃO** | BAIXA | LOCALIZADO | curada (cresce) | comparador |
| C2 | Activities que temos a mais (Smite, Agonizing Blast) | **NÃO** | NULA | TRIVIAL | - | comparador |
| C3 | Nome do item de background ("Custom Background") | **NÃO** | NULA | LOCALIZADO | - | comparador |
| C4 | Pack como um item só (sem contêiner) | **NÃO** | BAIXA | ESTRUTURAL | derivada | Foundry |
| C5 | Classes sidekick e conteúdo UA | **NÃO** | NULA | MODERADO | derivada | ficha |
| C6 | Toggle geral de conteúdo legado | **NÃO** | BAIXA | ESTRUTURAL | derivada | ficha |
| C7 | As 4 entradas `EXPECTED` do comparador | **NÃO** | NULA | - | - | comparador |
| D1 | `@scale.barbarian.rage` quebrado | **IMPOSSÍVEL** | BAIXA | - | - | Foundry |
| D2 | UUID para conteúdo fora do SRD | **IMPOSSÍVEL** | BAIXA | - | - | Foundry |
| D3 | Duas fórmulas de CA sem armadura no multiclasse | **IMPOSSÍVEL** | BAIXA | - | - | Foundry |
| D4 | `{@creature}` e `{@deity}` inertes | **NÃO** | BAIXA | MODERADO | derivada | ficha |
| D5 | Quirks dos próprios premades (`spell.method`, `details.xp`) | **IMPOSSÍVEL** | NULA | - | - | comparador |
| D6 | Prosa, identidade de documento, estado de sessão, `senses`/`movement`, `artificer`==`half` | **NÃO** | NULA | - | - | ninguém |

**Contagem:** 3 aprovados automaticamente (**os três já implementados em 2026-07-29**), 2 aprovados,
5 a decidir, 8 mantidos, 5 fora do nosso alcance. O comparador saiu de 71 para **63 achados**: o A1
fechou os 8 do "Unarmed Strike"; restam os 10 do A4 (aprovado, ainda não feito) e os 53 que caem em
NÃO/IMPOSSÍVEL - para esses, a seção 5 traz sugestões de melhoria.

---

## 3. Item a item

### A - Aprovados

#### A1. Item "Unarmed Strike" no nível 1 do Bárbaro e do Monge

- **O que é.** O ator premade concede, no `ItemGrant` de nível 1 da classe, um item `weapon` de
  subtipo `natural` chamado "Unarmed Strike". É o que dá o botão de ataque desarmado na ficha do
  Foundry. Nós não emitimos o passo.
- **Aprovação: AUTO.** Não há malefício. **Medi hoje e a premissa antiga estava errada:** eu tinha
  registrado no TC-0071 que emiti-lo seria "inventar um documento", mas o item existe no
  `equipment24` do dnd5e e **já está no nosso registro gerado** (`EQUIPMENT_IDS['unarmed strike']`
  → `dmgUnarmedStrike`, tipo `weapon/melee`). Ou seja: dá para apontar para o compêndio, sem
  inventar nada. E o SRD publica um documento `unarmed-strike.yml` dentro de `classes24/barbarian`
  e `classes24/monk`, então **quais classes o concedem também é derivável**, não curadoria.
- **Criticidade: ALTA.** Um Monge construído no FlyBy chega ao Foundry **sem o ataque desarmado**,
  que é a arma principal da classe inteira. Hoje isso passa despercebido no comparador porque as
  fichas premade que testamos JÁ TRAZEM o item (ele entra pelo import e volta no export); um
  personagem criado do zero no app não tem essa sorte.
- **Esforço: LOCALIZADO.** Um passo no advancement da classe, mais o item em si.
- ✅ **FEITO em 2026-07-29.** `npm run gen:srd` passou a emitir `SRD_CLASS_WEAPON_GRANTS` lendo o
  ItemGrant do PRÓPRIO documento da classe - é a única fonte que diz qual uuid usar, porque o
  Bárbaro aponta para a cópia do `equipment24` e o Monge para a do `classes24` (nem o nome nem a
  pasta bastam). A ficha do item também é copiada do documento do SRD: **nada é inventado**.
  · O item vai EMBUTIDO (é o que dá o botão sem depender do compêndio instalado) e o advancement o
    referencia por `value.added`, como no premade.
  · O import passou a IGNORÁ-LO como inventário: a derivação o recria da classe, então lê-lo o
    duplicaria no re-export (mesmo princípio das magias sempre-preparadas).
  · Verificado num Monge 5 e num Bárbaro 1 construídos do zero: item `weapon/natural` com activity
    de `attack`, concedido no nível 1, com a procedência certa. Um Fighter continua sem - é o que o
    SRD faz, e a seção 5.1 registra a pergunta que só um import real responde.

#### A2. `{@table}` inline continua inerte no texto

- **O que é.** Desde o DDL-0035 o glossário navegável mostra as 49 tabelas do SRD 5.2, mas uma
  citação `{@table}` DENTRO do texto de uma feature continua texto morto.
- **Aprovação: AUTO.** O motivo original para deixar inerte foi "risco de link morto para as ~2250
  tabelas não carregadas". Esse motivo **caiu**: o `gendata-tables.json` inteiro é carregado desde
  o DDL-0035, então o alvo ou existe no db ou não, e o `RuleLink` já degrada para texto simples
  quando o lookup falha (é o comportamento padrão dele desde o DDL-0020). Não há como criar link
  morto.
- **Criticidade: MÉDIA** - e MAIOR do que eu estimei. Medi o alcance real: **230 tags `{@table}` no
  conteúdo que exibimos, das quais 226 resolvem** (98%). A maior parte está em descrição de item
  mágico (203), o resto no glossário de regras. As 4 que não resolvem moram em arquivos de livro
  que não baixamos, e viram texto simples.
- **Esforço: LOCALIZADO.** Uma entrada no `renderTag`, no mesmo mecanismo dos outros tags.
- ✅ **FEITO em 2026-07-29.** `lookupTable` (engine/glossary) indexa TODAS as tabelas do gendata por
  `nome|fonte`, com o nome puro como rede; o `TableLink` abre a tabela no popup de regra, e degrada
  para texto simples quando não resolve. Verificado ao vivo no "Axe of the Dwarvish Lords": o link
  "minor beneficial" abre a tabela d100 inteira, e os links DENTRO dela (Poisoned, Charmed,
  Frightened) continuam vivos.

#### A3. Raridades sem chip na loja

- **O que é.** 301 itens têm raridade que nenhum chip do filtro cobre: `unknown` (38),
  `unknown (magic)` (255) e `varies` (8). Anotado no DDL-0078 e não corrigido.
- **Aprovação: AUTO.** Nenhum malefício: são três opções a mais num filtro que já existe, e a
  própria rede de segurança do DDL-0078 (o aviso em dev de "valor emitido sem chip") existe
  justamente para apontar isto. Deixar como está mantém 301 itens inalcançáveis por filtro.
- **Criticidade: MÉDIA.** Filtrar por raridade é o jeito natural de navegar uma loja com 7700
  itens, e hoje ela mente por omissão.
- **Esforço: TRIVIAL.** As opções são declaradas num lugar só.
- ✅ **FEITO em 2026-07-29.** As três entraram no `RARITY_LABEL` (o que também limpa o rótulo do
  card: "Unknown (magic)" → "Unknown (Magic)") e no `RARITY_OPTIONS`. Nenhuma vira badge colorido no
  card - só os tiers reais recebem. Verificado ao vivo: o chip "Unknown (Magic)" devolve **255
  itens**, exatamente o número que a sonda do DDL-0078 tinha medido.
- **Se quiser um rótulo diferente** ("Mágico, raridade desconhecida"), é um valor no `RARITY_LABEL`.
  **REGRA do DDL-0078:** o rótulo é livre, mas a opção do filtro tem de casar o que o `precompute`
  emite - as duas saem do mesmo mapa agora, então mudar um muda o outro.

#### A4. O boon do Goliath como item próprio ("Cloud's Jaunt")

- **O que é.** O SRD emite dois documentos: a feature guarda-chuva "Giant Ancestry" e um item para
  o boon escolhido ("Cloud's Jaunt"). Nós emitimos um só, o traço mesclado.
- **Aprovação: SIM.** O malefício é pequeno e contornável: a regra de detecção ("o traço da
  linhagem tem exatamente UM item de lista nomeado que existe no `ORIGIN_IDS`") pode disparar em
  falso numa espécie futura. Mitigação: exigir que o nome nomeado esteja no `ORIGIN_IDS`, que é o
  mesmo corte de segurança que o TC-0064 já usa.
- **Criticidade: BAIXA.** O jogador TEM o boon: ele está no texto do traço "Giant Ancestry" que
  exportamos. O que falta é ele aparecer como uma feature separada e clicável.
- **Esforço: LOCALIZADO.** 10 dos 71 achados.

#### A5. O idioma `other` aparece como "Other"

- **O que é.** O 5etools usa o pseudo-idioma `other` para o idioma próprio de um cenário (Simic
  Hybrid: "Elvish ou Vedalken"). O seletor mostra literalmente "Other".
- **Aprovação: SIM.** O malefício é uma curadoria, mas **é um conjunto fechado e minúsculo**: só as
  espécies com `other` no `languageProficiencies`, e o próprio texto da espécie diz qual idioma é.
  Não cresce com o dataset da forma que o C1 cresce.
- **Criticidade: MÉDIA.** O jogador escolhe uma opção que não diz o que ela é. É a única escolha do
  app inteiro que não se explica sozinha.
- **Esforço: LOCALIZADO**, no molde de qualquer registro curado por `Nome|FONTE`.
- **Alternativa sem curadoria nenhuma**, se preferir: mostrar "Outro idioma (ver a espécie)" em vez
  de "Other". Resolve a confusão sem afirmar qual é.

---

### B - Precisam de uma decisão sua

#### B1. Traços de prosa duplicando os chips de meta (95 espécies no dado, ~22 alcançáveis)

- **O que é.** Espécies reformatadas (MPMM e outras) trazem "Creature Type", "Size" e "Speed" como
  TRAÇOS de prosa, ao lado dos chips que a ficha já mostra com a mesma informação.
- **Decisão anterior (2026-07-25):** manter, com o seu motivo: *"por mais que seja redundante com
  as chips, é mínimo, então vamos minimizar a interferência onde não precisamos"*. O
  `LEGACY_PROSE_SECTIONS` (DDL-0059) existe só para sobras dos merges que NÓS fazemos, e não se
  estende ao conteúdo próprio do compêndio.
- **Por que reabro:** o número real é maior do que parecia quando você decidiu. São **95 entradas
  no dado** (~22 alcançáveis depois do `latestOnly`), não um punhado. E a análise de hoje separa
  duas coisas que estavam juntas:
  - **esconder o traço** (mexer no conteúdo do compêndio) - continua sendo o que você recusou, e eu
    concordo: é conteúdo de terceiros, e o critério "é redundante" é nosso, não do livro;
  - **esconder o CHIP quando existe um traço homônimo** - é mexer só na NOSSA apresentação, e o
    resultado é o mesmo sem tocar em nada de fora.
- **Aprovação: DECIDIR**, e a pergunta é só essa segunda forma. **Criticidade MÉDIA** (poluição
  visual na aba mais visitada), **esforço LOCALIZADO**, derivada.

#### B2. O `swap` do Dwarf (Hill/Mountain)

- **O que é.** O Dwarf tem o padrão de absorção IDÊNTICO ao do Halfling (Dwarf XPHB = Dwarf 2014 +
  o Dwarven Toughness do *Hill*; o *Mountain* ficou de fora com o Dwarven Armor Training). O
  mecanismo `as: 'swap'` do DDL-0063 resolveria exatamente igual.
- **Decisão anterior (2026-07-23):** só o Halfling, porque *"o objetivo era centralizar as opções
  mais relevantes e confusas, não varrer o dataset"*.
- **Por que reabro:** era uma decisão de PRIORIDADE, tomada quando havia muito mais coisa na
  frente. O custo hoje é **TRIVIAL**: um segundo alvo no `engine/legacyHalflingLineages.js`, mais a
  migração que o DDL-0063 já documentou. Não há malefício técnico.
- **O que ainda é escolha sua:** se a Anã da Montanha DEVE ser construível no FlyBy. É uma decisão
  de conteúdo, não de código. **Criticidade BAIXA** (ninguém está bloqueado; a Anã base funciona).

#### B3. Polimento do PDF (E5)

- **O que é.** O item 2 do known-deferred-backlog: cantrips de ataque na tabela de armas, ajuste de
  overflow para listas muito longas de features e equipamento, e miudezas da página de retrato.
- **Aprovação: DECIDIR.** Sem malefício, mas é a única linha desta lista que é **trabalho de
  produto e não de correção**: ninguém reportou, e a fase E foi dada como concluída.
- **Criticidade: MÉDIA.** O PDF é o formato que vai para a mesa física. Um overflow numa ficha de
  nível 17 é justamente onde ele é mais usado. **Esforço: MODERADO.**
- **Sugestão:** só o **overflow** agora (é o que pode inutilizar a folha), o resto depois.

#### B4. Magias sem origem no import (as 35 da Riswynn)

- **O que é.** O premade da Riswynn (Ladina, sem conjuração nenhuma) lista 35 magias `prepared: 0`
  como sugestão. Ao importar, elas somem: não há origem de conjuração que as segure.
- **Decisão anterior:** o próprio TC-0080 classificou esta metade como de pouco valor, e o DDL-0076
  modelou só a outra (o grimório do Mago, que hoje volta inteiro).
- **Aprovação: DECIDIR**, mas **minha recomendação é NÃO**. O malefício é grande: exigiria um balde
  de "magias sem origem" no schema, que é conceito que a regra não tem, e que apareceria na aba
  Spellbook sem casa. **Criticidade BAIXA**, **esforço ESTRUTURAL**.
- **Vale reabrir se** você quiser que reimportar um ator externo qualquer seja lossless por
  princípio. Aí é decisão de arquitetura, não deste item isolado.

#### B5. Criar personagem direto num nível alto

- **O que é.** Cancelado em 2026-07-22: o personagem nasce no nível 1 e sobe pelo app.
- **Aprovação: DECIDIR.** Não tem malefício técnico, mas tem um **custo real de fluxo**: o guia de
  criação teria de ordenar decisões de vários níveis de uma vez, e o DDL-0013 registrou que essa
  ordenação foi explicitamente deixada de fora.
- **Por que reabro:** é a única decisão cancelada cuja motivação era "não é para agora". Com o app
  maduro, a pergunta muda: **um mestre que precisa de um NPC de nível 9 hoje precisa clicar oito
  vezes no `+`.** Isso é atrito real de uso, não de criação de personagem.
- **Criticidade: MÉDIA**, **esforço ESTRUTURAL**. Se voltar, sugiro a versão barata primeiro: um
  campo de nível na criação que só aplica os `+` em sequência e joga o jogador no guia de
  pendências (que já existe, e já sabe listar tudo que falta em qualquer nível).

---

### C - Mantidos como estão (o malefício supera, ou a decisão continua válida)

#### C1. Convenções de nível do `advancement.race` (16 achados)

O SRD não é consistente consigo mesmo: o passo de concessão de nível 1 é `@0` no Gnome e `@1` no
Elfo; a resistência da legacy do Tiefling é `Trait@1` e a do Dragonborn `Trait@0`. **Não há regra
derivável.** Acertar exigiria uma tabela por espécie, que é dívida de curadoria crescente para
**zero efeito funcional** (o Foundry concede a coisa igual nos dois níveis, porque é criação de
personagem). **Só o comparador vê.** Manter.

#### C2. Activities que NÓS temos e o premade não (6 achados)

`Paladin's Smite` (o `cast` que o overlay dá) e `Agonizing Blast` (`enchant`). O SRD tem
`activities: {}` para o primeiro porque em 2024 Divine Smite é MAGIA. **Tirá-las PERDE um botão que
o RAW 2024 concede.** Manter. Nota herdada do TC-0070, ainda válida: conferir num import real se o
uso grátis do Smite não fica contado em dobro (item de magia + activity).

#### C3. Nome do item de background

O FlyBy só tem origens custom, então sai "Custom Background". A mecânica inteira (boosts, perícias,
ferramenta, idiomas, talento) É comparada e está correta. Mudar exigiria um catálogo de origens
prontas, que é uma decisão de produto oposta à que o projeto tomou. Manter.

#### C4. Pack como um item só

Nosso modelo compra "Explorer's Pack" como UM item (DDL-0013); o Foundry usa um `container` com o
conteúdo dentro. Desdobrar mexe no inventário, no peso, no preço e na UI da aba. **Esforço
ESTRUTURAL para benefício de organização.** Manter, e reavaliar só se o peso carregado começar a
divergir de forma visível.

#### C5. Classes sidekick e conteúdo UA

Decisão de escopo de 2026-07-22. A ausência nos registros curados É a decisão. Manter.

#### C6. Toggle geral de conteúdo legado

Cancelado no DDL-0058, e o levantamento que sustentou o cancelamento continua valendo: as perdas
reais fora das sub-raças eram 3 talentos, 3 magias, ~17 invocações e 8 itens base. As sub-raças, que
eram a perda de verdade, **já voltaram curadas** (DDL-0059 a 0063). Manter.

#### C7. As quatro entradas `EXPECTED` do comparador

`baked-feature-grant`, `capstone-asi-on-class-item`, `curated-halfling-lineage` e
`class-spell-ladder`. Todas verificadas, todas com o motivo escrito no `premadeDiff.js`, e em duas
delas **a nossa saída é melhor que a do SRD** (a escada de magias da classe faz o level-up dentro do
Foundry conceder o que a classe concede). Manter.

---

### D - Fora do nosso alcance

#### D1. `@scale.barbarian.rage` não resolve

A activity do Persistent Rage referencia uma escala que **nem o ator oficial tem** (a escala se
chama `rages` nos dois lados). Conferido no premade do Merric L17: mesma referência quebrada. É
defeito do conteúdo do dnd5e. Corrigir seria divergir do documento publicado, e a correção sumiria
na próxima regeração. **Deixar quebrado igual.**

#### D2. UUID de compêndio para o que o SRD não publica

Artificer, as 123 subclasses fora do SRD, variantes mágicas geradas, linhagens mescladas e as
espécies legadas curadas ficam sem `compendiumSource`. Por design (DDL-0056): apontar para um
documento near-match faria o Foundry oferecer "atualizar do compêndio" e **substituir o conteúdo do
jogador**. Não há o que corrigir; os documentos não existem.

#### D3. Duas fórmulas de CA sem armadura num multiclasse

O ator do Foundry tem UM `ac.calc`. Um Bárbaro/Monge exporta com uma só. A ficha ao vivo do FlyBy
escolhe a maior e é a fonte da verdade (DDL-0045). Limitação do sistema de destino.

#### D4. `{@creature}` e `{@deity}` inertes

Ao contrário do A2, estes **não** têm o alvo carregado: os bestiários são o maior dado do 5etools e
nunca entraram no manifesto. Ligá-los significa buscar e cachear o bestiário inteiro por causa de
links de sabor. **Manter inertes** enquanto não houver um motivo de jogo (o play mode, se um dia
precisar de stat blocks de companheiro, muda essa conta).

#### D5. Quirks dos próprios premades

`spell.method` da Sefris (o documento encoda uma magia dela diferente de todas as irmãs) e
`details.xp` do Riswynn L11 (o XP não bate com o nível da própria ficha). São defeitos do gabarito,
não nossos.

#### D6. As diferenças que o comparador nem olha

Prosa, identidade de documento (`_id`/`_stats`/`img`/`sort`/`ownership`/`folder`/`flags`), estado de
sessão (HP atual, espaços gastos, death saves), `senses`/`movement` (o Foundry deriva de effects) e
`artificer` == `half` (são a mesma progressão no config do dnd5e). **Não são divergências**, e a
lista existe para que ninguém as trate como tal.

---

---

## 5. Sugestões para os 53 achados que ficam

> **Princípio que rege esta seção (fixado pelo usuário, 2026-07-29):** *não precisamos seguir o SRD
> se isso penalizar o usuário ou o funcionamento correto do app e da ficha exportada no Foundry.*
>
> Isso muda a régua. Até aqui, "o premade faz assim" era argumento suficiente para os dois lados:
> divergir era achado, convergir era acerto. Agora o SRD é **referência, não autoridade**. Onde ele
> é apenas uma convenção, convergir é opcional; onde ele deixa o jogador pior, **divergir é o certo**
> - e o comparador deve NOMEAR a divergência (`EXPECTED`), não escondê-la.
>
> Cada sugestão abaixo diz o que ganharia o usuário. Nenhuma está aprovada: são candidatas.

### 5.1 O caso mais forte: quem NÃO tem ataque desarmado no Foundry

O A1 seguiu o SRD e concedeu o Unarmed Strike só ao Bárbaro e ao Monge, que são as duas classes cujo
documento oficial o publica. Mas a regra 2024 é clara: **qualquer criatura pode fazer um Ataque
Desarmado.** Um Mago que perdeu o cajado, ou um Ladino desarmado, chega ao Foundry sem botão nenhum
de ataque.

- **Sugestão:** conceder o item a TODA classe, não só às duas.
- **O que falta para decidir:** saber se o dnd5e oferece o ataque desarmado por outro caminho
  (uma ação nativa da ficha) quando o item não existe. **Não dá para responder isso sem um import
  real** - é a primeira coisa a checar no T2d. Se não oferecer, esta vira a mudança de maior impacto
  prático da lista inteira; se oferecer, o SRD está certo e ficamos como estamos.
- **Custo se for aprovada:** TRIVIAL (tirar o filtro por classe). O malefício é emitir um item que
  nenhum ator oficial tem - aceitável se o alternativa é o jogador sem ataque.

### 5.2 Convenções de nível do `advancement.race` (16 achados) - divergir e NOMEAR

O SRD põe o passo de concessão de nível 1 em `@0` no Gnome e em `@1` no Elfo, e a resistência em
`Trait@0` no Dragonborn e `Trait@1` no Tiefling. **Não há regra**, é inconsistência do próprio
conteúdo oficial.

- **Sugestão:** parar de tratar isso como achado. Nossa convenção (nível 0 para o que vem na criação,
  o nível real para o resto) é **mais coerente que a do SRD**, e o Foundry concede igual nos dois
  casos. Vira uma entrada `EXPECTED` com o motivo escrito.
- **Ganho:** o relatório da T2 deixa de carregar 16 achados que ninguém vai corrigir, e a próxima
  sessão não perde tempo redescobrindo que não há padrão. **Custo: nenhum.**
- **Esta é a mudança que eu faria primeiro entre as cinco desta seção.**

### 5.3 As 11 magias `prepared: 0` da Riswynn - uma alternativa barata ao B4

O B4 (modelar magias sem origem) é ESTRUTURAL e eu recomendei não. Mas há um meio-termo que não
mexe no schema:

- **Sugestão:** ao importar um ator, guardar as magias sem origem no `custom` snapshot que o
  inventário já usa para item fora do catálogo, e re-emiti-las no export sem tentar derivá-las.
- **Ganho para o usuário:** reimportar um ator externo deixa de PERDER conteúdo em silêncio, que é a
  parte ruim. Elas não apareceriam na aba Spellbook (não têm origem), mas voltariam ao Foundry.
- **Custo:** LOCALIZADO em vez de ESTRUTURAL. O malefício é um campo de "carga" que não é decisão do
  jogador - precisa de uma regra clara de quando é lido, senão vira depósito.
- **Alternativa mais honesta ainda:** avisar no import ("N magias deste ator não têm origem e não
  foram importadas") em vez de perdê-las caladamente. Custo TRIVIAL, e resolve a parte que de fato
  penaliza: a surpresa.

### 5.4 As 6 activities que temos A MAIS - o princípio já nos dá razão

`Paladin's Smite` (o `cast` do overlay) e `Agonizing Blast` (`enchant`). O SRD tem `activities: {}`
para o primeiro; nós damos o botão que o RAW 2024 concede.

- **Sugestão:** manter, e promover de "achado" para `EXPECTED`. Sob o princípio novo isso deixa de
  ser divergência a explicar e passa a ser **decisão deliberada a favor do jogador**.
- **A ressalva que continua valendo, e é a única coisa a checar no T2d:** confirmar que o uso grátis
  do Smite não fica CONTADO EM DOBRO (o item de magia + a activity). Se estiver, o certo é remover a
  activity - aí seria o nosso extra que penaliza.

### 5.5 O "Cloud's Jaunt" e os 10 achados de `items.feat` (o A4, já aprovado)

Sem novidade de princípio: o A4 está aprovado e pendente. Vale registrar por que ele é de baixa
prioridade **mesmo sob a régua nova**: o jogador já TEM o boon (está no texto do traço "Giant
Ancestry" que exportamos). O que muda é ele virar uma feature separada e clicável. Não há penalidade,
só organização.

### 5.6 Os que continuam sem ação, e agora com um motivo mais forte

O princípio novo não muda nada aqui, mas explica melhor:

- **`@scale.barbarian.rage` quebrado (D1).** "Consertar" divergiria do documento oficial numa
  referência que o ator oficial também tem quebrada. Se algum dia isso IMPEDIR o Persistent Rage de
  funcionar no Foundry, o princípio manda consertar - e aí é uma linha. **Vale checar no T2d.**
- **Quirks dos premades (D5).** O XP do Riswynn L11 não bate com o nível da própria ficha oficial.
  Copiar o erro seria seguir o SRD contra o usuário.
- **Nome do background (C3), pack como um item (C4), `EXPECTED` (C7).** São diferenças do NOSSO
  modelo, tomadas a favor do fluxo do app. O princípio as reforça.

### 5.7 Resumo das sugestões

| # | Sugestão | Ganho | Custo | Depende de |
|---|---|---|---|---|
| 5.1 | Unarmed Strike para TODA classe | Ninguém fica sem ataque no Foundry | TRIVIAL | um import real (T2d) |
| 5.2 | Convenções de nível viram `EXPECTED` | -16 achados de ruído permanente | TRIVIAL | nada |
| 5.3 | Avisar (ou carregar) as magias sem origem | O import para de perder conteúdo calado | TRIVIAL / LOCALIZADO | sua escolha entre as duas formas |
| 5.4 | Activities extras viram `EXPECTED` | -6 achados; decisão a favor do jogador | TRIVIAL | conferir o Smite em dobro (T2d) |
| 5.5 | A4 (Cloud's Jaunt) | Organização da ficha | LOCALIZADO | nada (já aprovado) |

**Três das cinco custam minutos e não dependem de nada** (5.2, 5.4, e a forma barata da 5.3).
Juntas tirariam **22 dos 53** achados restantes do relatório - não escondendo, mas nomeando com o
motivo, que é a diferença que o DDL-0073 fixou entre `DELIBERATE` e `EXPECTED`.

---

## 4. O que eu recomendo fazer agora

**Os três aprovados automaticamente foram implementados em 2026-07-29** (A1, A2, A3 - ver os
detalhes na seção 3). O comparador foi de 71 para 63 achados, e o ganho que não aparece no placar é
o A1: um Monge criado no app agora chega ao Foundry com o ataque desarmado.

**Sobram dois aprovados, ainda não feitos:**

1. **A5 - idioma `other`** (MÉDIA). Ou o registro curado, ou o rótulo genérico honesto ("Outro
   idioma (ver a espécie)"), que não exige curadoria nenhuma.
2. **A4 - boon do Goliath** (BAIXA). Fecha 10 achados, mas é o único que não muda nada para quem
   joga - o boon já está no texto do traço que exportamos.

**As cinco decisões que preciso de você** (B1 a B5), em ordem de impacto:

- **B5 - criar em nível alto.** É a que mais muda o uso do app, e a versão barata (aplicar os `+`
  em sequência e cair no guia de pendências) reaproveita máquina que já existe.
- **B1 - chips duplicados.** Reformulei a pergunta: esconder o CHIP, não o traço. Isso mexe só na
  nossa apresentação, que era exatamente a sua objeção anterior.
- **B3 - overflow do PDF.** Só a parte que pode inutilizar a folha impressa.
- **B2 - Dwarf.** Custo trivial; a pergunta é de conteúdo.
- **B4 - magias sem origem.** Recomendo NÃO, a menos que "reimportar qualquer ator é lossless" vire
  um princípio do projeto.

**E o passo que só você pode dar, independente de tudo isso:** o **T2d** do plano de testes.
`npm run sweep -- --emit-actors` gera o lote e a importação real no Foundry é o único jeito de ver o
runtime das mudanças de ontem - as activities novas rolando, o sopro do Dragonborn fazendo dano, o
traço de nível 5 chegando na hora certa. Várias linhas do `COVERAGE.md` só podem virar `export: ok`
depois disso.

# DEFERRED-REVIEW.md - a revisão do que ficou adiado

> Aberto em **2026-07-29** para revisar tudo que tinha sido adiado por conveniência ao longo do
> projeto. **Quatro levas implementadas.** O comparador da T2 saiu de **71 para 18 achados**.
>
> **Como este documento está organizado** (reestruturado a pedido do usuário, porque a versão
> anterior misturava resolvido com pendente):
> - **§1** os eixos e o princípio que rege as decisões de fidelidade;
> - **§2 PENDENTE** - o que ainda não tem resolução. É a única seção que pede ação;
> - **§3 RESOLVIDO** - o que foi feito, com o resultado;
> - **§4 DECIDIDO POR DESIGN** - o que não é pendência nem nunca vai virar código, e por quê;
> - **§5 FORA DO NOSSO ALCANCE** - limitação do Foundry ou defeito do upstream;
> - **§6** próximos passos.
>
> Regra de manutenção: um item se move entre as seções, nunca fica em duas. Item resolvido vai para
> a §3 e a decisão vira entrada no DDL log do `CLAUDE.md`.

---

## 1. Os eixos e o princípio

### 1.1 A classificação

| Eixo | Níveis |
|---|---|
| **Aprovação** | **AUTO** (sem malefício algum - aprovado por regra do usuário) · **SIM** · **DECIDIR** · **NÃO** · **IMPOSSÍVEL** |
| **Criticidade** | CRÍTICA (falseia a regra) · ALTA (o jogador perde uma capacidade real) · MÉDIA (atrito) · BAIXA (fidelidade documental) · NULA |
| **Esforço** | TRIVIAL · LOCALIZADO (uma função + teste) · MODERADO (módulo/gerador) · ESTRUTURAL (schema + migração + derivação + UI) |
| **Escala** | **DERIVADA** (funciona sozinha para conteúdo novo) × **CURADA** (cada caso é uma linha, e a dívida cresce) |
| **Quem sente** | a **ficha** · o **Foundry** · só o **comparador** |

**"Malefício" não é esforço.** Esforço tem eixo próprio. Malefício é o que a mudança PIORA: risco de
regressão, dívida de curadoria, divergência do modelo, conteúdo inventado, ou informação que o
jogador perde.

### 1.2 O princípio de fidelidade (DDL-0080)

> **O SRD é referência, não autoridade** (fixado pelo usuário). Onde ele é apenas convenção,
> convergir é opcional; onde segui-lo penalizaria o usuário ou o funcionamento correto da ficha
> exportada, **divergimos**.
>
> **COROLÁRIO, aprendido na prática:** divergir sem NOMEAR faz o placar SUBIR. Toda divergência
> deliberada precisa de DUAS coisas: uma FORMA que não se passe pela do SRD (um título de
> advancement próprio) e uma entrada `EXPECTED` no comparador com o motivo escrito.
>
> **E o inverso:** antes de nomear algo como esperado, confira se o predicado não esconde bug real.
> O de "convenção de nível de raça" teria engolido uma lacuna verdadeira, corrigida primeiro.

---

## 2. PENDENTE

| # | Item | Aprovação | Criticidade | Esforço | Escala |
|---|---|---|---|---|---|
| P1 | Polimento do PDF (E5) | **ADIADO** | MÉDIA | MODERADO | derivada |
| P2 | Deixar o jogador ATRIBUIR origem às magias do balde | **DEPOIS** | BAIXA | MODERADO | derivada |

### P1. Polimento do PDF (E5) - adiado, mas na mira

- **O que falta:** cantrips de ataque na tabela de armas, overflow para listas muito longas de
  features/equipamento, miudezas da página de retrato.
- **Decisão do usuário (2026-07-29):** adiar. *"O PDF não é nossa prioridade pois a ficha digital já
  cumpre o papel que uma ficha impressa cumpriria."*
- **Quando voltar, o overflow vem primeiro:** é a única parte que pode inutilizar a folha, e uma
  ficha de nível 17 é justamente onde a impressão é mais usada.

### P2. Atribuir origem às magias sem origem

- **A parte lossless já está feita** (§3): magias que um ator importado trazia e nenhuma classe da
  ficha sabe conjurar ficam em `character.unassignedSpells`, voltam ao Foundry no re-export, e o
  import avisa. Elas não aparecem na Spellbook porque não têm origem.
- **O passo seguinte, decidido pelo usuário:** permitir que o jogador **indique a origem** dessas
  magias, escolhendo entre as possibilidades que a ficha oferece.
- **Por que é fácil a partir daqui:** o balde guarda `SpellRef`, a mesma forma do
  `ClassEntry.spells`. Atribuir uma origem é MOVER o ref de um array para o outro; limites, DC e
  preparação a derivação já faz. O trabalho é de UI, não de modelo.
- **A regra a manter:** o balde é CARGA, não decisão. Não conta em limite nenhum enquanto não for
  atribuído.

---

## 3. RESOLVIDO

### Leva 5 - o que o usuário pediu depois da revisão (CHANGELOG §107-108)

| Item | Resultado |
|---|---|
| **Resistências de subclasse** (TC-0084) | A suspeita do usuário sobre o Genie era real, e eram **11 subclasses**, não uma. A varredura da leva 4 filtrou por TAG e por fonte atual e viu 37 features; por PROSA, em qualquer fonte, são 96. Campos novos `immune` e `resistBy` (o tipo vindo de outra escolha já feita). DDL-0081. |
| **Ações básicas no export** (TC-0085) | As 18 ações do XPHB viram itens, derivadas de `actions.json`. 2ª divergência deliberada do SRD, com marca própria e a entrada `EXPECTED` `basic-actions`. DDL-0081. |
| **P3 Contêineres** | Um campo `container` (aditivo), a regra de peso do RAW valendo pela cadeia de pais, o mini-inventário na tela do item com guardar/tirar em lote, e `capacity`/`weightlessContents` no export - o Foundry passa a aplicar a mesma conta de peso. DDL-0082. |

### Leva 1 - os aprovados automaticamente (CHANGELOG §103)

| Item | Resultado |
|---|---|
| Item "Unarmed Strike" no Bárbaro e no Monge | A premissa antiga do TC-0071 ("seria inventar um documento") estava ERRADA: o item existe no `equipment24`. Um Monge criado no app chegava ao Foundry **sem a arma principal da classe**. O uuid e a ficha vêm do documento da classe no SRD. |
| `{@table}` inline vira link | O risco de link morto que a mantinha inerte caiu no DDL-0035. **226 das 230 tags** do conteúdo que exibimos resolvem - a maior parte em descrição de item mágico. |
| Raridades sem chip na loja | `unknown`, `unknown (magic)` e `varies` deixavam **301 itens inalcançáveis** pelo filtro. |

### Leva 2 - os aprovados restantes (CHANGELOG §104)

| Item | Resultado |
|---|---|
| Idioma `other` | Registro curado de 22 espécies (`engine/speciesLanguages.js`): "Other" virou "Loxodon", "Quori", "Vedalken"… Atinge o card de Idiomas de 21 espécies E a única escolha do app que não dizia o que era (o Simic Hybrid). |
| Boon do Goliath como item próprio | "Cloud's Jaunt" vira documento à parte, por uma regra ESTREITA (o traço tem de ter exatamente UM sub-item nomeado, e o nome tem de existir no `origins24`). |
| Unarmed Strike para TODA classe | **Primeira divergência deliberada do SRD** sob o princípio §1.2 - a regra 2024 diz que toda criatura pode fazer um Ataque Desarmado. |
| Convenções de nível viram `EXPECTED` | O SRD não tem regra aqui (`@0` no Gnome, `@1` no Elfo). **Antes disso, fechei a lacuna REAL que o predicado esconderia:** a magia ESCOLHIDA da linhagem não entrava na escada de concessão. |
| Aviso de magia sem origem no import | Metade barata; a lossless veio na leva 3. |

### Leva 3 - as decisões B (CHANGELOG §105)

| Item | Resultado |
|---|---|
| `swap` do Dwarf | O módulo virou o genérico `engine/legacySwapLineages.js` (registro `SWAP_LINEAGES`): "Dwarf Lineage" com Hill/Mountain, cada uma TROCANDO o Dwarven Toughness que a base 2024 absorveu do Hill. |
| Magias sem origem, lossless | Campo aditivo `unassignedSpells` (sem bump de schema). Medido no premade da Riswynn L17: 34 magias entram, 34 saem, balde estável num 2º ciclo. |

**Duas armadilhas que a leva 3 destapou**, e que valem como regra permanente:

1. **Um `swap` move a MECÂNICA junto com o traço.** O Dwarven Toughness (+1 HP/nível) vive num
   registro keyed por nome de raça RESOLVIDA; ao virar linhagem, a chave `Dwarf|XPHB` deixou de casar
   e **nenhum** Dwarf ganhava o HP. → virou a sonda da leva 4.
2. **Assinatura derivada larga dá falso positivo (2ª vez).** Um `- dr:` em qualquer lugar do YAML
   marcava "o documento do SRD guarda a linhagem"; a resistência do Dwarven Resilience é um **grant
   fixo**, então o Dwarf entrava e a nossa linhagem herdava o nome do documento publicado. O `dr:`
   agora tem de estar sob `pool:`.

### Leva 4 - C0, C4, as sugestões e o TC-0083 (CHANGELOG §106)

| Item | Resultado |
|---|---|
| **C0** `ItemChoice` da ancestralidade | O pool dos seis boons sai do traço-guarda-chuva da espécie BASE (a linhagem resolvida guarda só o escolhido). O Foundry passa a saber que houve uma ESCOLHA e oferece trocá-la. `advancement.race` foi a **zero**. |
| **C4** pack como contêiner | Um pack agora exporta como `container` + conteúdo, tudo derivado do `packContents` do 5etools (20 packs o têm). O peso é o do RECIPIENTE e o preço só no contêiner - senão o Foundry contaria os dois em dobro. O import recolhe de volta numa entrada só (DDL-0013 intacto). Idêntico ao premade da Akra: 5 lb, 33 gp, 6 conteúdos. |
| **§5.2** classificar as 3 magias restantes | Eram **duas causas distintas**, como a sugestão previa: uma magia de PERGAMINHO (`sourceItem: consumable:…`) que caía num balde que ninguém lia - o mesmo defeito do B4 por outra porta, agora roteada para a carga - e a cópia do cantrip por invocação, que é convenção do premade. |
| **§5.4** sonda de chave morta | `npm run check:keys` cruza os 6 registros curados keyed por espécie com o catálogo RESOLVIDO. Transforma a armadilha 1 da leva 3 em rede permanente. |
| **TC-0083** ordem dos Hooks | **Não era bug** - resíduo de HMR. Ver a nota abaixo. |
| **Resistência a dano de feature de subclasse** | Uma família REAL que a varredura destapou: um Sorcerer Draconic 6, um Warlock Celestial 6 e um Cleric War 17 **não tinham resistência nenhuma na ficha**. 6 casos fixos + 1 à escolha; os outros 30 do dataset são estado de sessão ou condicionais. Detalhe em §3.1. |
| **2º Fighting Style do Champion** | Viajava num `ItemChoice` no item de SUBCLASSE que não emitíamos nem líamos: um Champion vindo de um ator externo **perdia o estilo em silêncio**. |

### 3.1 A família das resistências, e por que a varredura decidiu o escopo

Antes de cadastrar o caso que apareceu, varri as **37 features** de classe/subclasse de fonte atual
que citam `{@variantrule Resistance|Immunity}`. Elas se separam em quatro grupos, e **só o primeiro
deriva** (o critério vive no cabeçalho do `engine/subclassGrants.js`):

| Grupo | Casos | Tratamento |
|---|---|---|
| **Permanente e FIXA** | 6 - Avatar of Battle (War 17), Guarded Mind (Psi Warrior 10), Psychic Defenses (Aberrant 6), Radiant Soul (Celestial 6), Thought Shield (Great Old One 10), Necrotic Husk (Undead 10) | campo `resist` novo no `SUBCLASS_GRANTS`, consumido pelo `deriveDamageTraits` |
| **Permanente À ESCOLHA** | 1 - Elemental Affinity (Draconic 6): acid/cold/fire/lightning/poison | escolha kind `resist` (o kind já existia) no `SUBCLASS_FEATURE_GRANTS`. UI, completude, autoBuild e derivação vieram de graça |
| **RE-ESCOLHIDA a cada descanso** | 3 - Fiendish Resilience, Dread Allegiance, Nature's Ward | **não** deriva: é estado de SESSÃO, não decisão de build. Espera a Phase C |
| **Condicional / não é tipo de dano** | o resto | prosa, pela mesma regra que o `damageTraits` já aplicava: dentro de uma aura ou forma, por reação, ou "damage of spells" (Abjurer). Inclui a versão PHB do Avatar of Battle ("from nonmagical attacks"), que é um `bypasses` do Foundry |

Sem a varredura eu teria cadastrado 1 caso e deixado 6 quebrados - ou cadastrado 30 e inventado
resistências que a regra não dá.

**Três lições da leva 4:**

1. **Abrir o comparador para o que ele ignorava revela o que estava escondido.** Tirar `container`
   da lista de ignorados expôs **55 achados reais**: a Bag of Holding, a Backpack e a Pouch saíam
   como `equipment`, e por isso **não guardavam nada** no Foundry. Uma entrada em `DELIBERATE`
   protege uma decisão, mas também cega o oráculo - revise-as quando a decisão mudar.
2. **O premade não é sempre a referência melhor.** O Explorer's Pack dele vem **sem as 10 tochas**
   que o PHB 2024 lista: nosso conteúdo sai do dado e é mais completo. Nomeado como
   `pack-contents-from-data`.
3. **`location.reload()` na mesma aba não descarta artefato de HMR.** Foi o que me fez chamar o
   TC-0083 de bug: num projeto com o React Compiler o grafo de módulos sobrevive ao reload. **Abra
   uma ABA NOVA** antes de tratar um aviso de ordem de hooks como bug - numa aba limpa o erro não
   existe, nem com a versão antiga do código. O `useCallback` que eu havia removido "para consertar"
   foi restaurado.

---

## 4. DECIDIDO POR DESIGN

Não são pendências e não viram código. Ficam aqui só para não serem redescobertos como lacuna.

### 4.1 A redundância que é FUNÇÃO, não ruído

Espécies reformatadas trazem "Creature Type"/"Size"/"Speed" como TRAÇOS de prosa, ao lado dos chips
de meta. Eu propus esconder os chips; **o usuário manteve, e a razão corrige a minha premissa:**

- **muitas dessas prosas detalham o funcionamento CORRETO da feature** - a limitação do voo à
  armadura leve (média no Tiefling Winged) está no TEXTO, não no chip;
- **servem de lembrete do traço**, o que é justamente o público do app;
- **o chip continua útil** como referência rápida para quem já conhece a regra.

As duas apresentações têm função diferente; esconder qualquer uma perde informação.

### 4.2 O que o comparador da T2 deliberadamente não olha

Prosa (HTML editorial), identidade de documento (`_id`/`_stats`/`img`/`sort`/`ownership`/`folder`/
`flags`), estado de sessão (HP atual, espaços gastos, death saves), `senses`/`movement` (o Foundry
deriva de effects), `artificer` == `half` (a mesma progressão no config do dnd5e), o nome do item de
background (só temos origens custom - a mecânica inteira É comparada) e o "Unarmed Strike"
concedido pela classe. **Não são divergências**; a lista vive no `DELIBERATE` do `premadeDiff.js`,
que é a documentação funcional dela.

### 4.3 As 9 divergências NOMEADAS (`EXPECTED`, 74 achados)

O comparador olha, acha, e sabe por que a nossa saída está certa. Em quatro delas **nossa saída é
melhor que a do SRD**.

| id | O que é |
|---|---|
| `baked-feature-grant` | O premade deixa a proficiência de uma feature a cargo de um Active Effect; nós a assamos no ator. Runtime idêntico. |
| `capstone-asi-on-class-item` | O SRD usa as duas formas (item de classe no Monge, item da feature no Bárbaro). |
| `curated-swap-lineage` | "Halfling Lineage" e "Dwarf Lineage" são acréscimo NOSSO (DDL-0063); herdar o nome publicado faria o Foundry trocar a linhagem escolhida pela base. |
| `class-spell-ladder` | Emitimos a escada de magias da classe nos níveis futuros de TODA classe; o SRD só a tem no Paladino. Sem ela, subir de nível no Foundry não concede a magia. |
| `universal-unarmed-strike` | Ataque Desarmado para toda classe, não só Bárbaro e Monge. |
| `basic-actions` | As 18 ações do XPHB (Dash, Hide, Study…) como itens. O dnd5e as publica como journal, então nenhum ator as tem e no Foundry elas não aparecem em lugar nenhum da ficha. |
| `race-grant-level-convention` | O SRD não é consistente sobre em que nível pendurar uma concessão de criação. |
| `pack-contents-from-data` | O conteúdo do pack sai do dado, que segue o livro; o premade é curado à mão e omite itens. |
| `srd-item-name-variant` | O SRD publica dois documentos para a mesma lanterna; usamos a grafia do 5etools, que resolve para um uuid real. |
| `invocation-spell-copy` | O premade emite uma cópia do cantrip por invocação; no nosso modelo a invocação é uma feature e o cantrip é um só. |

### 4.4 Diferenças de modelo que ficam

- **Activities que temos A MAIS** (`Paladin's Smite`, `Agonizing Blast`, 6 achados). O SRD tem
  `activities: {}` no primeiro porque em 2024 Divine Smite é MAGIA; tirá-las PERDE um botão que o RAW
  concede. **Único ponto a checar no T2d:** se o uso grátis do Smite fica contado em dobro.
- **Classes sidekick e conteúdo UA.** Fora de escopo. A ausência nos registros curados É a decisão.
- **Toggle geral de conteúdo legado.** Cancelado no DDL-0058, e o levantamento continua valendo: as
  perdas reais fora das sub-raças eram 3 talentos, 3 magias, ~17 invocações e 8 itens base - e as
  sub-raças **já voltaram curadas** (DDL-0059 a 0063, mais o Dwarf na leva 3).
- **`{@creature}` e `{@deity}` inertes.** Ao contrário do `{@table}`, estes **não** têm o alvo
  carregado: os bestiários são o maior dado do 5etools. A conta muda se o play mode um dia precisar
  de stat blocks de companheiro.

---

## 5. FORA DO NOSSO ALCANCE

- **`@scale.barbarian.rage` quebrado.** A activity do Persistent Rage referencia uma escala que **nem
  o ator oficial tem** (conferido no premade do Merric L17). Corrigir divergiria do documento
  publicado. **Checar no T2d se isso impede o Persistent Rage de funcionar** - se impedir, o
  princípio §1.2 manda consertar, e é uma linha.
- **UUID para o que o SRD não publica.** Artificer, as 123 subclasses fora do SRD, variantes mágicas
  geradas, linhagens mescladas e espécies legadas curadas ficam sem `compendiumSource`. Por design
  (DDL-0056): apontar para um near-match faria o Foundry **substituir o conteúdo do jogador**.
- **Duas fórmulas de CA sem armadura num multiclasse.** O ator do Foundry tem UM `ac.calc`. A ficha
  ao vivo do FlyBy escolhe a maior e é a fonte da verdade (DDL-0045).
- **Quirks dos premades.** `spell.method` da Sefris (o documento encoda uma magia dela diferente de
  todas as irmãs) e `details.xp` do Riswynn L11 (o XP não bate com o nível da própria ficha).

---

## 6. Próximos passos

**Tudo o que dava para fazer antes do T2d está feito**, e a última medição corrigiu esta seção: ao
conferir os achados restantes um por um, **dois deles não eram quirk nem espera de T2d** - eram a
família das resistências (§3.1) e o Fighting Style do Champion, os dois corrigidos. Os **18**
restantes se dividem, agora de fato, em: o que espera o T2d (as 6 activities extras), quirk do premade
(o `spell.method` da Sefris, o `details.xp` do Riswynn), a forma do capstone do Bárbaro, e a
composição do ItemGrant do Paladino (8 achados - o passo do nível ALCANÇADO não lista a magia
concedida junto das features; decisão já medida no DDL-0079, e o item de magia está no ator de
qualquer forma).

1. **O T2d**, que só o usuário pode fazer: `npm run sweep -- --emit-actors` e a importação real no
   Foundry. Cinco perguntas concretas esperando resposta:
   - o dnd5e oferece o ataque desarmado por outro caminho? (se sim, a divergência do
     `universal-unarmed-strike` virou redundante e pode voltar a seguir o SRD);
   - o uso grátis do Paladin's Smite fica contado em dobro? (§4.4);
   - o `@scale.barbarian.rage` quebrado impede o Persistent Rage de funcionar? (§5);
   - a linhagem do Dwarf e o item de Ataque Desarmado chegam certos numa ficha real?
   - o pack chega como contêiner com o conteúdo dentro, e o peso carregado bate?
2. **P1 e P2**, quando você quiser.
3. **`npm run check:keys`** vale entrar na rotina de quem mexer em espécie - é a rede contra a
   armadilha da leva 3.

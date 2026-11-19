// =============================================================================
// playCatalog: tudo o que o personagem pode fazer e gastar, estruturado
// =============================================================================
// O QUE FAZ
//   A derivação pura que o play mode lê (docs/PLAY-MODE-PLAN.md 3.4) e que a
//   ficha PDF também usa: uma fonte só para a mesa e para o papel.
//   derivePlayCatalog(character, db) devolve:
//     rollData   os dados das fórmulas (`@abilities.str.mod`, `@prof`,
//                `@classes.x.levels`, `@scale.x.y`), para o engine/dice
//     stats      CA (e as peças dela), HP máximo, PB, nível, iniciativa, deslocamento
//                a pé e todos os deslocamentos da espécie (voo, natação...)
//     checks     atributos, saves, perícias, iniciativa, morte, concentração; cada
//                teste com as PARTES do bônus (atributo, proficiência, item), que
//                o engine/playChecks separa em fixo e condicional
//     defenses   resistências, imunidades e vulnerabilidades a dano (com as de item)
//     features   o nome (minúsculo) de toda feature do ator, para as passivas (sem
//                as ações básicas: "two-weapon fighting" é o estilo de luta, não a ação)
//     featureList as features para a aba Features do jogo, com tipo, seção e texto
//                (engine/playFeatures, DDL-0151)
//     attacks   armas, ataque desarmado e cantrips de ataque ou salvaguarda
//     actions    as ações básicas e as das features, com custo e consumo
//     resources  dados de vida, slots, pacto, pools de feature, cargas de item
//                (engine/playInventory) e usos de magia
//                concedida, com máximo e recuperação
//     spells     por origem, com DC, ataque, preparo, ritual, concentração e a
//                mecânica (ataque, save, dano, cura, upcast)
//     problems   o que não deu para resolver (o survey cobra zero)
//
// FUNÇÕES
//   Texto e números
//     slug(s), norm(s), propCodes(raw): auxiliares de texto.
//     recoveryText(recovery): "Long Rest, 1 on Short Rest".
//     evalUses(formula, ctx): o número de um `uses.max`, ou null.
//   Ficha
//     initiativeBonus(character, derived): DES, mais o PB com o Alert e o bônus de teste dos itens (DDL-0256).
//     hitDiceByFace(derived): os dados de vida agregados por face.
//     weaponProficient(entry, weaponProfs, weaponNames), weaponAttacks(character,
//       derived): as armas do inventário, equipadas primeiro.
//     unarmedStrike(derived): o ataque desarmado.
//     withFeatTypes(attacks, features): o tipo de dano que um talento deixa escolher nos ataques com arma e
//       desarmado (FEAT_DAMAGE_TYPES: o Blazing Strike do Boon of Blazing Dawn, radiante, DDL-0261).
//     diceAverage(dice), withMartialArts(attacks, ctx): o Martial Arts do monge sobre
//       o desarmado e as armas de monge (o dado da tabela e a DES); o dado da Versatile
//       nas duas mãos também (a lança do monge 11 dizia "Two hands (1d8)", DDL-0221).
//     scaledDice(raw, level), textDice(raw), textHealDice(raw), upcastDice(raw),
//       spellMechanics(raw, level): a mecânica de uma magia pelo dado. O dano ganha `addMod` quando a frase
//       do primeiro dado de dano soma o modificador ("1d8 plus your spellcasting ability modifier": Spiritual
//       Weapon, Flame Blade, Bigby's Hand, Mordenkainen's Sword, Conjure Fey; DDL-0245), e os tipos vêm do
//       par do texto quando o dado não traz `damageInflict` (Holy Star of Mystra: Force or Radiant).
//     damageAddsMod(raw, dice): a frase do dado soma o modificador de conjuração?
//     damageLater(raw): o dano só vem DEPOIS do lançamento? O parágrafo até o primeiro dado tem um gatilho
//       posterior ("whenever you hit", "Until the spell ends, you can take a Magic action", "starts its
//       turn") e nenhum do lançamento ("When you cast", "when it appears"); vira `damage.later`, e o
//       lançamento não abre a rolagem quando outro caminho rola depois (DDL-0247). Medido: 25 magias.
//     cantripAttacks(spellcasting, level): os cantrips que atacam ou pedem save.
//   Ator em memória
//     safeActor(character, db): o ator montado, ou null se a montagem falhar.
//     scaleSteps(actor, totalLevel): o degrau de cada ScaleValue no nível do dono.
//     scaleValues(actor, totalLevel): as ScaleValues numéricas (pools).
//     scaleRollData(actor, totalLevel): as ScaleValues para as fórmulas.
//     usesContext(actor, derived): o contexto do evalUses.
//     actorResources(actor, derived, problems): os pools de feature.
//     partFormula(part): a fórmula de uma parte de dano ou cura do Foundry.
//     atLeastOneDie(formula): o número de dados de um modificador nunca abaixo de 1: o
//       Sear Undead ("a number of d8s equal to your Wisdom modifier (minimum of 1d8)") vem
//       do SRD como `(@abilities.wis.mod)d8` e quebrava com SAB baixa (DDL-0218, só no jogo).
//       O scaledDice pula o escalonamento com marcador `{{...}}` (o dano secundário do
//       Green-Flame Blade), que o motor de dados não lê.
//     normActivation(a, item): o custo normalizado, ou null (passiva). A activity sem
//       `activation.type` que o jogador dispara sem ação (TRIGGERED_ACTIVITIES; desde o DDL-0228 também as opções do Open Hand Technique e do
//       Improved Brutal Strike e o Superior Defense, que gasta 3 de Focus: Natural
//       Recovery, Wild Resurgence, Font of Inspiration, Sorcerous Restoration, Sorcery
//       Incarnate, Persistent Rage, as recargas de Intimidating Presence, Archdruid, Holy
//       Nimbus, Hurl Through Hell e Dragon Wings, Eldritch Master, a salvaguarda e a cura da
//       Relentless Rage, a cura do Land's Aid) vira `type: 'none'`: antes ela sumia, e o "Use"
//       só gastava o pool da feature (passe ao vivo, DDL-0221). Sem nome, ela leva o do tipo
//       (TYPE_NAMES). ACTIVITY_ROLLS é o dado que só o texto diz (o Cutting Words subtrai um
//       dado de Bardic Inspiration); a CD que cresce com os usos (`@item.uses.spent`, a
//       Relentless Rage) vai em `save.dcFormula`, lida no uso (playUse). HEAL_LABELS dá o
//       nome do que o SRD faz como cura e é redução de dano (Deflect Attacks); ancestryTypes
//       deixa no Breath Weapon só o tipo que a espécie resiste ("determined by your Draconic
//       Ancestry", o mesmo da Damage Resistance), em vez dos cinco (DDL-0221).
//     consumptionOf(a, item, ctx): o que uma activity gasta.
//     saveDcOf(a, ctx): a CD de uma activity de save.
//     featureActions(actor, ctx): as ações básicas e das features.
//     castingMod(derived): o `@mod` de uma activity que não é ataque (o Empowered Evocation e
//       o Elemental Affinity do SRD de 2014 somam "@mod"): o modificador da conjuração da
//       classe, o maior quando há mais de uma (DDL-0222).
//   Catálogo
//     defensesOf(derived, character): as defesas a dano, com as de item e a redução do Heavy Armor Master.
//     speedOf(character, db): o deslocamento a pé da espécie.
//     speedsOf(character, db): todos os deslocamentos da espécie, em pés.
//     featureSpeedBonus(actor, armorClass, rollData): o que as features somam ao deslocamento
//       a pé, pelos effects `movement.walk` do ator; `SPEED_ARMOR` é a armadura que cada uma
//       proíbe (Unarmored Movement sem armadura nem escudo; Fast Movement e Roving sem
//       armadura pesada). O monge 11 andava 30 ft, não 50 (passe ao vivo, DDL-0221).
//     spellRollData(spellcasting): os slots como dados de fórmula.
//     buildRollData(character, derived, actor): os dados das fórmulas; desde o DDL-0215,
//       `attunement.value` (os itens atunados, Soul of Artifice) e `featAbility` (o atributo
//       que cada talento aumentou, Conjuration Adept).
//     featAbilities(character): o atributo de cada talento escolhido, pelo nome.
//     checkList(derived, character): os testes; o bônus de teste dos itens vira uma parte `item` (DDL-0256).
//     firstNum(match): o primeiro grupo preenchido de um regex com alternativas (a CD e o ataque do texto do item).
//     itemSpellOrigins(inventory, db, level, ctx): as magias que os itens ativos lançam (`attachedSpells`), como
//       origens `item`, com a CD e o ataque do texto do item ou os do personagem; o upcast por carga só com a frase
//       (DDL-0257). As formas do DDL-0262: `daily`/`rest`/`limited` com "e" é por magia, sem "e" é um pool só
//       (a prosa "cast that spell again" faz cada uma valer à parte: Iggwilv's Horn); `rest` volta no curto,
//       `limited` não volta; `ritual` só como ritual; a lista solta e `other` gastam carga quando o texto diz
//       quanto, valem uma vez por dia quando a frase do lançamento diz "until the next dawn", e senão são
//       "From the item" (o texto manda); o item que "functions as a spellbook" fica fora (as magias são do grimório),
//       e a poção também (beber é o Use do item). A forma `magia#4` lança no círculo 4 (`castLevel`).
//     spellStores(inventory): os itens que guardam magias e o que cabe neles (o diálogo de lançar oferece guardar;
//       a magia guardada sai do item ao ser lançada, com o círculo, a CD e o ataque de quem a guardou, DDL-0258).
//     replicateInfo(character, db): os planos do Replicate Magic Item e o máximo de itens (coluna Magic Items).
//     spellResources(spellcasting), spellOrigins(spellcasting, level, opts): magias; com o
//       Ritual Adept, o ritual do grimório do mago sem preparar vem com `ritualOnly` (TC-0158).
//     spendsChannelDivinity(feature): o texto da feature gasta um uso do Channel Divinity? Também o `consumes` do
//       dado (Djinni's Escape, TC-0178, DDL-0251). Qualquer outro `consumes` que o CONSUMES_BY_NAME liga a um
//       pool (Sorcery Point: Waxing and Waning) dá o "Use" que gasta, fora as features dos registros de
//       rerrolagem, que gastam ao rerrolar (Empowered Healing), e a que tem pool próprio (Crown of Spellfire: os
//       pontos só restauram o uso; DDL-0253). A que tem pool próprio também não gasta o Channel Divinity: nela o
//       Channel Divinity só restaura o uso (Dispelling Recovery, DDL-0254).
//     withItemSpeeds(speeds, inventory): os deslocamentos sempre ligados dos itens ativos (Slippers of Spider
//       Climbing, Ring of Swimming, Boots of Striding and Springing; engine/itemEffects.js, DDL-0256).
//     withFeatureSpeeds(speeds, features): escalada e natação de feature (FEATURE_SPEEDS:
//       Second-Story Work, Roving, Aquatic Affinity), iguais ao deslocamento a pé (TC-0156); uma entrada
//       `{ mode, feet, note }` dá um número fixo ou uma nota (Gift of the Sea nada 40, Stormborn voa ao ar livre, DDL-0253).
//     EXTRA_RECOVERY: a recuperação que uma feature soma ao pool de outra (o Cutthroat do Dread
//       Incarnate devolve um Bloodthirst no descanso curto, DDL-0236); com `replace`, a que troca a do pool (o
//       Power Surge volta a 1 no descanso longo, `resetTo`, e ganha 1 no curto se estiver vazio, `ifEmpty`, DDL-0253).
//     featureAttacks(features, derived, character): os ataques que uma feature cria (FEATURE_ATTACKS: as
//       Psychic Blades do Soulknife, TC-0161, só ladino: o College of Whispers tem outra feature com o
//       mesmo nome; os espinhos da Battlerager Armor, DDL-0239), no formato dos de arma.
//     hasClass(character, classId): o personagem tem a classe?
//     kenseiWeapons(character): as Kensei Weapons escolhidas, que o withMartialArts trata como armas de
//       monge (inclusive à distância, DDL-0242).
//     NATURAL_PATTERNS, naturalHit(text), naturalAttacks(features, derived, picked): as armas naturais
//       pela prosa ("the strike deals 1d6 + your Strength modifier slashing damage"; Claws, Horns,
//       Bite, Talons, Hooves, Ram, Dragon Hide), um Unarmed Strike com o dado e o tipo; numa feature
//       de opções (SPECIES_OPTION_FEATURES) só a opção escolhida (DDL-0239).
//     handsOf(raw, props): quantas mãos a arma pede (uma, duas, versátil, a Lance montada).
//     shieldInHand(inventory): o escudo equipado e se ele deixa as mãos livres.
//     featureOptionPicks(character): as opções escolhidas em escolhas `featureoption` (vão no catálogo
//       como `optionPicks`, para o registro curado saber qual opção vale: o Acid Spit). As cantrips que
//       uma invocação melhora vão como `optionTargets` (o Agonizing Blast, engine/optionTargets, DDL-0240). A feature que
//       gera um ataque (natural ou do FEATURE_ATTACKS) ganha `attack`, que o levantamento conta como uso.
//       Um traço de espécie cujo texto diz "the DC equals 8" ganha `dc` (8 + PB + o atributo escolhido
//       no `dcAbility` da espécie: Taunt, Fey Step, as linhagens Tauren, TC-0159, DDL-0239).
//     TYPE_CHOICE, TYPE_PAIR, spellTypeOptions(raw): os tipos de dano que a magia deixa escolher, pelo
//       texto (DDL-0240): todos os do dado com "of your choice"; só o par em "Radiant or Necrotic damage
//       (your choice)" (Destructive Wave). O diálogo de dano oferece a escolha (`typeOptions`).
//     derivePlayCatalog(character, db, opts): o catálogo.
//
// DECISÕES E ARMADILHAS
//   Channel Divinity sem activity (DDL-0225)
//   - A opção de Channel Divinity que o texto descreve e nenhuma activity traz (as antigas
//     que o app oferece, Conquering Presence, Cloak of Shadows, Watcher's Will, e várias de
//     2024, Vow of Enmity, Holy Bolt, Mind Magic) ganha o "Use" que gasta o pool da classe
//     (`spendItem`, lido por featureUseOf); a que tem activity sem consumo nenhum (o Touch of
//     Death do overlay) passa a consumir o pool. CHANNEL_CUE é a frase do gasto ("use your
//     Channel Divinity", "expend one use of your Channel Divinity", "using your Channel
//     Divinity") ou o nome "Channel Divinity: X" (o texto antigo costuma não repetir o gasto);
//     a que só cita as opções (Inescapable Destruction, Supreme Healing) não casa.
//   Fonte da mecânica (DDL-0108)
//   - As features vêm do ATOR montado em memória (`assembleFoundryActor`), como o
//     PDF já fazia: `system.uses` (máximo e recuperação, do registro curado, do
//     SRD, do overlay e da prosa) e as `activities` (custo, consumo, fórmulas).
//     Nada sai do app. Montagem que falha não derruba o catálogo: sem ator, as
//     features ficam de fora e o problema é registrado.
//   - As magias do ator não trazem activities (o Foundry as tira do compêndio),
//     então a mecânica delas vem do dado do 5etools: `spellAttack`,
//     `savingThrow`, `damageInflict`, o `{@damage}` do texto, a escala do
//     cantrip e o `{@scaledamage}`/`{@scaledice}` do upcast.
//   - As armas vêm do inventário DERIVADO (o mesmo da ficha), com números já
//     resolvidos; o ataque desarmado é 1 + FOR de concussão com o PB (2024).
//   Chaves (as do engine/playState)
//   - `pool:<identifier>` para o pool do item; `pool:<identifier>:<activity>`
//     quando o SRD guarda o pool na ACTIVITY (Natural Recovery, DDL-0106).
//     `hd:d<faces>`, `slot:<círculo>`, `pact`, `granted:<origem>|<magia>`.
//   - Consumo `itemUses`: alvo vazio é o pool do próprio item (ou da activity);
//     o resto (`_id`, `feat:<identifier>`, uuid de compêndio, o OBJETO cru do
//     overlay) acha o item pelo consumptionTargetItem do foundryConsumption, a
//     MESMA regra com que o export liga o alvo ao `_id` (TC-0097). Ator nosso já
//     chega com `_id`; o resto serve a ator de fora. Alvo que não resolve é
//     PROBLEMA.
//   - Consumo de outro tipo vai cru, sem chave, para a fase que o interpreta:
//     `attribute` (o Magical Cunning DEVOLVE slots de pacto), `hitDice` (Durable),
//     `spellSlots` (Font of Magic, Wild Companion).
//   Regras
//   - evalUses mantém a régua do PDF: só troca @scale, @abilities, @prof,
//     @classes e @details.level, e fórmula com o que não resolve dá null (nunca
//     um número inventado). Pool com máximo null é problema; com máximo 0 (mod
//     negativo sem piso) fica de fora em silêncio, como no PDF.
//   - ScaleValue de DADO ("3d6") entra no rollData como fórmula, com `.number`,
//     `.faces` e `.die` ("d6") em chaves planas; o evalUses vê a contagem pela
//     chave nua, como antes, e aceita `.number`/`.faces` (o Psi Warrior conta os
//     dados assim). Sem `identifier`, a chave é o slug do TÍTULO, como no dnd5e
//     (Divine Spark, Cantrips Known), e o explícito ganha do slug quando colidem
//     ("Channel Divinity Uses" e a coluna "Channel Divinity"). Cada escala também
//     responde pelo slug do NOME do item dono: o overlay cita
//     `@scale.college-of-whispers.psychic-blades` e o nosso identifier é
//     `whispers`. O degrau `{ n, die }` do overlay é lido como número e faces.
//     Resolver mais escalas pode fazer o PDF ganhar pools que antes caíam fora.
//   - `@mod` de uma activity de ataque é o modificador do atributo dela (ou o maior
//     de FOR e DES); `@scaling` (quanto se gasta, escolhido na hora: Lay on Hands,
//     Healing Light) vale 1 na conferência e a activity sai marcada `scalable`;
//     `@attributes.hd.largestAvailable` e `smallestAvailable` são o dado de vida de
//     maior e de menor face (o estado de jogo afina isso na C3); `largestFace` e
//     `smallestFace` são só as faces (os talentos de escola do FRHoF:
//     `(@scaling)d(@attributes.hd.smallestFace)`). `@attributes.hp.value` e
//     `@statuses.bloodied` (Persistent Wrath, Hungering Might) são o PV cheio e 0 no
//     catálogo; o "Use" troca pelo PV atual do estado (`liveRollData`, engine/playUse).
//   - CD de save `spellcasting` de uma feature usa a CD da origem de classe com
//     o maior valor (o Foundry usa o atributo de conjuração do ator); CD por
//     atributo é 8 + PB + mod. Sem origem conjuradora, a CD é null e vira problema.
//   - A activity diz se o alvo é o PRÓPRIO personagem (`selfTarget`): a cura de um
//     Second Wind se aplica sozinha; a de um Lay on Hands, a tela pergunta. A cura
//     de magia soma o modificador quando a prosa diz "spellcasting ability
//     modifier" (`heal.addMod`, Cure Wounds). O rollData traz os slots
//     (`@spells.pact.max`), que o Magical Cunning cita para devolver o pacto.
//   - Activity sem custo (`activation.type` vazio) é PASSIVA ou gatilho de outra
//     coisa (Disciple of Life soma na cura de magia): fica fora das ações.
//   - Recuperação da magia concedida segue o RECOVERY_PERIOD do foundrySpells:
//     `daily` é `day` (o play mode a recupera no descanso longo), `rest` é `sr`,
//     `restLong` é `lr`. `innate` sem frequência não ganha contador (carga).
//     Mystic Arcanum é 1 por descanso longo.
//   - Iniciativa: Destreza, mais o PB com o Alert (o 2024 dá "Initiative
//     Proficiency"); a mesma conta que o PDF fazia.
//   - A proficiência da arma olha também `derived.weaponNames` (2026-11-07, DDL-0159):
//     a regra condicional do 2024 ("Martial weapons that have the Finesse or Light
//     property" do ladino, "Light" do monge) chega como FRASE em `weapons` e como a
//     lista das armas em `weaponNames` (autoProficiencies, a mesma que o export usa).
//     Sem isso o Shortsword do ladino atacava sem o PB.
//   - Martial Arts (XPHB, withMartialArts, 2026-11-06): o desarmado e as armas de
//     monge (corpo a corpo simples, ou marcial com Light) usam DES se for maior e
//     rolam o dado da coluna da tabela (`@scale.monk.die`, o mesmo do SRD), ou o da
//     arma quando a média dele é maior ("in place of" é opção do jogador; a maior é
//     a que ele escolheria). Com armadura ou escudo, nada muda. Sem isso o monge
//     rolava 1 + FOR no desarmado.
//   - `actorEffects` (DDL-0211): os Active Effects ligados das features do ator, pela
//     lista fechada de engine/playActorEffects (Danger Sense, Luck, Aura of Protection);
//     o diálogo da rolagem os lê por rollEffects. Fórmula que não resolve vira problema.
//   - `proseEffects` (DDL-0213, DDL-0214): a vantagem, o bônus, o reroll do 1 e o piso
//     que só a prosa das features declara (engine/playProseEffects). A feature é "ativada"
//     (vale depois de usada) com custo do turno, gatilho, activity ou pool, a mesma regra
//     da aba Features. O bônus com fórmula que não resolve no rollData sai.
//   - `proseUses` (DDL-0214): a cura e os PV temporários da prosa; a feature ganha
//     `roll: 'use'`, e o "Use" dela (featureUseOf) rola a fórmula e aplica.
//     O Honed Spellfire soma o nível de Sorcerer aos temporários do Bolstering Flames
//     ("You add your Sorcerer level to the Temporary Hit Points gained", DDL-0215).
// -----------------------------------------------------------------------------

import { ABILITIES } from '../schema/character';
import { deriveFromDb, resolveRaceObj, resolveClassObj } from './resolve';
import { parseSpecies, SPECIES_OPTION_FEATURES } from './speciesData';
import { assembleFoundryActor } from './foundryActor';
import { isBasicActionItem } from './foundryBasicActions';
import { rangeLabel, isRitual, isConcentration, resolveSpellObj } from './spells';
import { SKILL_ABILITY, collectFeatIds } from './proficiency';
import { collectAbilityPicks, collectChoicePicks, dcAbilityPick } from './choices';
import { optionTargets } from './optionTargets';
import { validateFormula, rollFormula } from './dice';
import { roundsOf } from './playCombat';
import { chargeResources } from './playInventory';
import { featureList, plainText } from './playFeatures';
import { consumptionTargetItem, CONSUMES_BY_NAME } from './foundryConsumption';
import { itemSpeeds, isActiveItem, plainItemText, weaponExtraDamage, boundSpellRule, storeRuleOf, storedLevels, itemChargeMax, chargeCostOf } from './itemEffects';
import { tableColumnAt } from './grantedSpellUses';
import { REROLL_FEATURES } from './playRerolls';
import { actorRollEffects } from './playActorEffects';
import { proseRollEffects, proseUses } from './playProseEffects';

export const DAMAGE_NAME = {
  A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning',
  N: 'necrotic', P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder',
};

const PERIOD = {
  lr: 'Long Rest', sr: 'Short Rest', day: 'Dawn', dawn: 'Dawn', dusk: 'Dusk',
  turn: 'Turn', round: 'Round', initiative: 'Initiative',
};

const GRANTED_RECOVERY = { daily: 'day', rest: 'sr', restLong: 'lr' };

const slug = (s) => String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => String(s ?? '').trim().toLowerCase();
const propCodes = (raw) =>
  (raw?.property ?? []).map((p) => String(typeof p === 'string' ? p : p?.uid ?? '').split('|')[0]);

/** A recuperação de um pool ("Long Rest, 1 on Short Rest"). */
export function recoveryText(recovery) {
  const list = recovery ?? [];
  const all = list.filter((r) => r.type === 'recoverAll').map((r) => PERIOD[r.period] ?? r.period);
  const partial = list
    .filter((r) => r.type === 'formula' && r.formula)
    .map((r) => `${r.formula} on ${PERIOD[r.period] ?? r.period}`);
  const special = list
    .filter((r) => r.type === 'resetTo' || r.type === 'ifEmpty')
    .map((r) => (r.type === 'resetTo' ? `${r.formula} on ${PERIOD[r.period] ?? r.period}` : `${r.formula} on ${PERIOD[r.period] ?? r.period} if empty`));
  return [all.join(' or '), ...partial, ...special].filter(Boolean).join(', ');
}

/**
 * O número de uma fórmula de `uses.max` do Foundry, ou null se ela citar algo
 * que a ficha não sabe resolver.
 */
export function evalUses(formula, { scales = {}, mods = {}, prof = 0, classLevels = {}, level = 0 } = {}) {
  let unresolved = false;
  const expr = String(formula ?? '')
    .replace(/@scale\.([\w-]+\.[\w-]+(?:\.(?:number|faces)\b)?)/g, (_, k) => (k in scales ? String(scales[k]) : ((unresolved = true), '0')))
    .replace(/@abilities\.(\w+)\.mod/g, (_, a) => (a in mods ? String(mods[a]) : ((unresolved = true), '0')))
    .replace(/@classes\.([\w-]+)\.levels/g, (_, c) => String(classLevels[c] ?? 0))
    .replace(/@details\.level/g, String(level))
    .replace(/@prof/g, String(prof));
  if (unresolved || /@/.test(expr)) return null;
  const bare = expr.replace(/\b(max|min|floor|ceil|round)\b/g, '');
  if (!/^[\d\s+\-*/().,]*$/.test(bare) || !expr.trim()) return null;
  try {
    const value = new Function('max', 'min', 'floor', 'ceil', 'round', `return (${expr});`)(
      Math.max, Math.min, Math.floor, Math.ceil, Math.round,
    );
    return Number.isFinite(value) ? Math.floor(value) : null;
  } catch {
    return null;
  }
}

/** Iniciativa: DES, mais o PB com o Alert. */
export function initiativeBonus(character, derived) {
  const hasAlert = norm(character.origin?.originFeat?.id).startsWith('alert')
    || (character.classes ?? []).some((c) => Object.values(c.choices ?? {}).some((e) => e?.kind === 'feat' && (e.picks ?? []).some((p) => norm(p).startsWith('alert|'))));
  return (derived.modifiers?.dex ?? 0) + (hasAlert ? derived.proficiencyBonus ?? 0 : 0) + (derived.itemCheckBonus?.bonus ?? 0);
}

/** Os dados de vida por face, da maior para a menor ([{ faces: 10, count: 3 }]). */
export function hitDiceByFace(derived) {
  const count = {};
  for (const c of derived.classBreakdown ?? []) {
    if (c.hitDie) count[c.hitDie] = (count[c.hitDie] ?? 0) + c.level;
  }
  return Object.keys(count).map(Number).sort((a, b) => b - a).map((faces) => ({ faces, count: count[faces] }));
}

/** O personagem é proficiente com a arma? Também pelas armas que uma regra condicional enumera. */
function weaponProficient(entry, weaponProfs, weaponNames = []) {
  const profs = [...(weaponProfs ?? []), ...(weaponNames ?? [])].map((w) => String(w).toLowerCase());
  const cat = entry.category ? `${entry.category} weapons`.toLowerCase() : null;
  const name = (entry.raw?.name ?? '').toLowerCase();
  return profs.some((p) => p === cat || p === name || p === `${name}s`);
}

/** Quantas mãos a arma pede: 'one', 'two', 'versatile' (uma ou duas) ou 'mounted' (duas, uma se montado: a Lance). */
export function handsOf(raw, props = propCodes(raw)) {
  if (raw?.lance) return 'mounted';
  if (props.includes('2H')) return 'two';
  return raw?.dmg2 ? 'versatile' : 'one';
}

/** O escudo equipado e se ele pode deixar as mãos livres (o Animated Shield: "leaving your hands free"). */
export function shieldInHand(inventory) {
  const sh = (inventory ?? []).find((e) => e.group === 'armor' && e.armorSlot === 'shield' && e.equipped);
  if (!sh) return null;
  return { name: sh.raw?.name ?? 'Shield', handsFree: /leaving your hands free/i.test(plainText(sh.raw?.entries ?? [])) };
}

/** As armas do inventário como ataques estruturados, equipadas primeiro. */
export function weaponAttacks(character, derived) {
  const weapons = (derived.inventory ?? []).filter((e) => e.group === 'weapon' && e.raw);
  weapons.sort((a, b) => (b.equipped === true) - (a.equipped === true));

  const masteryPicks = new Set();
  const bags = [...(character.classes ?? []).map((c) => c.choices), character.origin?.originFeat?.choices, character.species?.choices];
  for (const bag of bags) for (const p of collectChoicePicks(bag ?? {}, 'weapon')) masteryPicks.add(String(p).split('|')[0].toLowerCase());

  return weapons.map((e) => {
    const raw = e.raw;
    const props = propCodes(raw);
    const finesse = props.includes('F');
    const { str = 0, dex = 0 } = derived.modifiers ?? {};
    const ability = e.kind === 'ranged' ? 'dex' : finesse && dex > str ? 'dex' : 'str';
    const mod = ability === 'dex' ? dex : str;
    const magic = Number(raw.bonusWeapon ?? 0) || 0;
    const proficient = weaponProficient(e, derived.weapons, derived.weaponNames);
    const prof = proficient ? derived.proficiencyBonus : 0;
    const toHitParts = [
      { label: ability === 'dex' ? 'Dexterity' : 'Strength', formula: mod },
      ...(prof ? [{ label: 'Proficiency', formula: prof }] : []),
      ...(magic ? [{ label: 'Magic', formula: magic }] : []),
    ];
    const mastery = masteryPicks.has(raw.name.toLowerCase()) && raw.mastery?.length
      ? String(raw.mastery[0]).split('|')[0]
      : null;
    return {
      key: `weapon:${e.uid ?? slug(raw.name)}`,
      kind: 'weapon',
      name: raw.name,
      uid: e.uid ?? null,
      magical: !!(Number(raw.bonusWeapon ?? 0) || (raw.rarity && raw.rarity !== 'none')),
      ...(e.pactConjured ? { pactConjured: true } : {}),
      range: e.kind === 'ranged' ? 'ranged' : 'melee',
      category: e.category ?? null,
      equipped: e.equipped === true,
      ability,
      proficient,
      toHit: { total: mod + magic + prof, parts: toHitParts },
      damage: raw.dmg1
        ? { dice: raw.dmg1, bonus: mod + magic, types: [DAMAGE_NAME[raw.dmgType] ?? raw.dmgType ?? ''].filter(Boolean) }
        : null,
      versatile: raw.dmg2 ?? null,
      hands: handsOf(raw, props),
      properties: props,
      mastery,
      thrown: props.includes('T'),
      ammunition: props.includes('A') || props.includes('AF'),
      ammoType: raw.ammoType ?? null,
      distance: raw.range ?? null,
      ...(() => {
        const extras = weaponExtraDamage(raw);
        return extras.length ? { itemExtras: extras.map((x) => ({ ...x, charge: x.charge && e.uid ? `charges:${e.uid}` : null })) } : {};
      })(),
    };
  });
}

/** A recuperação que uma feature soma ao pool de outra (Cutthroat: "You regain one expended use of Bloodthirst when you finish a Short Rest"). */
const EXTRA_RECOVERY = {
  'dread incarnate': { item: 'Bloodthirst', recovery: { period: 'sr', type: 'formula', formula: '1' } },
  'power surge': { item: 'Power Surge', replace: [{ period: 'lr', type: 'resetTo', formula: '1' }, { period: 'sr', type: 'ifEmpty', formula: '1' }] },
};

/** Os ataques que uma feature cria, pelo texto do XPHB (as Psychic Blades do Soulknife: 1d6 psíquico, Finesse, Thrown 60/120, Vex; a segunda, de ação bônus, 1d4). */
const FEATURE_ATTACKS = {
  'psychic blades': [
    { key: 'feature:psychic-blade', name: 'Psychic Blade', dice: '1d6', has: (c) => hasClass(c, 'rogue') },
    { key: 'feature:psychic-blade-bonus', name: 'Psychic Blade (Bonus Action, after the first)', dice: '1d4', has: (c) => hasClass(c, 'rogue') },
  ],
  'form of the beast': [
    { key: 'feature:beast-bite', name: 'Bite (Form of the Beast)', dice: '1d8', types: ['piercing'], ability: 'str', properties: [], mastery: null, distance: null },
    { key: 'feature:beast-claws', name: 'Claws (Form of the Beast; one more claw attack with the Attack action)', dice: '1d6', types: ['slashing'], ability: 'str', properties: [], mastery: null, distance: null },
    { key: 'feature:beast-tail', name: 'Tail (Form of the Beast, reach 10 feet)', dice: '1d8', types: ['piercing'], ability: 'str', properties: ['R'], mastery: null, distance: null },
  ],
  'battlerager armor': [
    { key: 'feature:armor-spikes', name: 'Armor Spikes (Bonus Action, while raging)', dice: '1d4', types: ['piercing'], ability: 'str', properties: [], mastery: null, distance: null },
  ],
};

/** O personagem tem a classe? (a Psychic Blades do College of Whispers não é a do Soulknife). */
const hasClass = (character, classId) => (character?.classes ?? []).some((c) => c.classId === classId);

const NATURAL_PATTERNS = [
  /\b(?:deal|deals|takes?)\s+(\w+) damage equal to (\d+d\d+) (?:\+|plus) your strength modifier/i,
  /\bthe strike deals (\d+d\d+) (?:\+|plus) your strength modifier (\w+) damage/i,
  /\bunarmed strikes?, which deal (\d+d\d+) (\w+) damage/i,
  /\bnatural attack that deals (\d+d\d+) (\w+) damage/i,
];

/** O dado e o tipo de uma frase de arma natural, ou null; `str` diz se soma a FOR. */
function naturalHit(text) {
  for (const [i, re] of NATURAL_PATTERNS.entries()) {
    const m = text.match(re);
    if (!m) continue;
    const [dice, type] = i === 0 ? [m[2], m[1]] : [m[1], m[2]];
    return { dice, type: type.toLowerCase(), str: i !== 3 };
  }
  return null;
}

/**
 * As armas naturais das features ("the strike deals 1d6 + your Strength modifier slashing damage, instead of
 * the bludgeoning damage normal for an unarmed strike"): um Unarmed Strike com o dado e o tipo do texto.
 */
export function naturalAttacks(features, derived, picked = new Set()) {
  const str = derived.modifiers?.str ?? 0;
  const prof = derived.proficiencyBonus ?? 0;
  const out = new Map();
  const visit = (name, entries, ownerOptions) => {
    for (const e of entries ?? []) {
      if (typeof e === 'string') {
        const hit = naturalHit(plainText([e]));
        const key = hit && `${name}|${hit.dice}|${hit.type}`;
        if (hit && !out.has(key)) {
          out.set(key, {
            key: `natural:${slug(name)}`,
            kind: 'unarmed',
            name: `Unarmed Strike (${name})`,
            range: 'melee',
            equipped: true,
            ability: 'str',
            proficient: true,
            toHit: { total: str + prof, parts: [{ label: 'Strength', formula: str }, { label: 'Proficiency', formula: prof }] },
            damage: { dice: hit.dice, bonus: hit.str ? str : 0, types: [hit.type] },
            versatile: null,
            properties: [],
            mastery: null,
            thrown: false,
            ammunition: false,
            distance: null,
          });
        }
      } else if (e?.type === 'list') {
        for (const item of e.items ?? []) {
          if (typeof item === 'string') visit(name, [item], false);
          if (!item?.name) continue;
          if (ownerOptions && !picked.has(item.name)) continue;
          visit(item.name, item.entries ?? (item.entry ? [item.entry] : []), false);
        }
      } else if (e && typeof e === 'object') {
        visit(e.name ?? name, e.entries ?? (e.entry ? [e.entry] : []), ownerOptions);
      }
    }
  };
  for (const f of features ?? []) visit(f.name, f.entries, SPECIES_OPTION_FEATURES.has(f.name));
  const seen = new Set();
  return [...out.values()].filter((a) => !seen.has(a.name) && seen.add(a.name));
}

/** As opções escolhidas em escolhas `featureoption` (o Animal Enhancement do Simic Hybrid). */
function featureOptionPicks(character) {
  const bags = [character?.species?.choices, ...(character?.classes ?? []).map((c) => c.choices)];
  return new Set(bags.flatMap((b) => collectChoicePicks(b ?? {}, 'featureoption')));
}

/** As Kensei Weapons escolhidas no builder ("count as monk weapons for you"), em minúsculas. */
function kenseiWeapons(character) {
  const out = new Set();
  for (const c of character?.classes ?? []) {
    for (const [key, e] of Object.entries(c.choices ?? {})) if (/kensei/i.test(key) && e?.kind === 'weaponProf') for (const pick of e.picks ?? []) out.add(String(pick).toLowerCase());
  }
  return out;
}

/** Os ataques das features (FEATURE_ATTACKS), no formato dos ataques de arma. */
function featureAttacks(features, derived, character = null) {
  const { str = 0, dex = 0 } = derived.modifiers ?? {};
  const ability = dex > str ? 'dex' : 'str';
  const mod = Math.max(dex, str);
  const prof = derived.proficiencyBonus ?? 0;
  return features.flatMap((name) => (FEATURE_ATTACKS[name] ?? []).filter((a) => !a.has || a.has(character)).map((a) => ({
    key: a.key,
    kind: 'weapon',
    name: a.name,
    uid: null,
    range: 'melee',
    category: 'simple',
    equipped: true,
    ability: a.ability ?? ability,
    proficient: true,
    toHit: { total: (a.ability ? derived.modifiers?.[a.ability] ?? 0 : mod) + prof, parts: [{ label: (a.ability ?? ability) === 'dex' ? 'Dexterity' : 'Strength', formula: a.ability ? derived.modifiers?.[a.ability] ?? 0 : mod }, { label: 'Proficiency', formula: prof }] },
    damage: { dice: a.dice, bonus: a.ability ? derived.modifiers?.[a.ability] ?? 0 : mod, types: a.types ?? ['psychic'] },
    versatile: null,
    properties: a.properties ?? ['F', 'T'],
    mastery: a.mastery === undefined ? 'Vex' : a.mastery,
    thrown: !a.properties,
    ammunition: false,
    ammoType: null,
    distance: a.distance === undefined ? '60/120' : a.distance,
  })));
}

/** A média de um dado "NdM" (0 sem dado). */
function diceAverage(dice) {
  const m = /^(\d*)d(\d+)$/.exec(String(dice ?? '').trim());
  return m ? (Number(m[1] || 1) * (Number(m[2]) + 1)) / 2 : 0;
}

/**
 * Martial Arts (XPHB): sem armadura nem escudo, o desarmado e as armas de monge usam
 * DES se for maior e rolam o dado da tabela (ou o da arma, se maior).
 */
const FEAT_DAMAGE_TYPES = { 'boon of blazing dawn': ['radiant'] };

/** O tipo de dano que um talento deixa escolher nos ataques com arma e desarmado ("the damage can be Radiant"). */
function withFeatTypes(attacks, features) {
  const extra = [...new Set((features ?? []).flatMap((f) => FEAT_DAMAGE_TYPES[f] ?? []))];
  if (!extra.length) return attacks;
  return attacks.map((a) => (a.damage ? { ...a, damage: { ...a.damage, typeOptions: [...new Set([...(a.damage.typeOptions ?? a.damage.types ?? []).map((x) => String(x).toLowerCase()), ...extra])] } } : a));
}

export function withMartialArts(attacks, { derived, rollData, features, monkWeapons = new Set() }) {
  const die = rollData?.['scale.monk.die'];
  if (!die || !(features ?? []).includes('martial arts')) return attacks;
  if (derived.armorClass?.hasArmor || derived.armorClass?.hasShield) return attacks;
  const mods = derived.modifiers ?? {};
  return attacks.map((a) => {
    const monkWeapon = (a.kind === 'weapon' && a.range === 'melee'
      && (a.category === 'simple' || (a.category === 'martial' && (a.properties ?? []).includes('L'))))
      || (a.kind === 'weapon' && monkWeapons.has(String(a.name).toLowerCase().replace(/^\+\d+\s+/, '')));
    if (a.kind !== 'unarmed' && !monkWeapon) return a;
    const before = mods[a.ability] ?? 0;
    const ability = (mods.dex ?? 0) > before ? 'dex' : a.ability;
    const mod = mods[ability] ?? 0;
    const label = ability === 'dex' ? 'Dexterity' : 'Strength';
    const parts = a.toHit.parts.map((p, i) => (i === 0 ? { label, formula: mod } : p));
    const extra = a.kind === 'unarmed' ? 0 : (a.damage?.bonus ?? before) - before;
    const dice = a.damage?.dice && diceAverage(a.damage.dice) >= diceAverage(die) ? a.damage.dice : die;
    const versatile = a.versatile && diceAverage(a.versatile) < diceAverage(die) ? die : a.versatile;
    return {
      ...a,
      ...(a.versatile ? { versatile } : {}),
      ability,
      martialArts: true,
      toHit: { total: a.toHit.total - before + mod, parts },
      damage: { dice, bonus: mod + extra, types: a.damage?.types ?? ['bludgeoning'] },
    };
  });
}

/** O ataque desarmado (2024): 1 + FOR de concussão, com o PB. */
export function unarmedStrike(derived) {
  const str = derived.modifiers?.str ?? 0;
  const prof = derived.proficiencyBonus ?? 0;
  return {
    key: 'unarmed',
    kind: 'unarmed',
    name: 'Unarmed Strike',
    range: 'melee',
    equipped: true,
    ability: 'str',
    proficient: true,
    toHit: { total: str + prof, parts: [{ label: 'Strength', formula: str }, { label: 'Proficiency', formula: prof }] },
    damage: { dice: null, bonus: 1 + str, types: ['bludgeoning'] },
    versatile: null,
    properties: [],
    mastery: null,
    thrown: false,
    ammunition: false,
    distance: null,
  };
}

/** O número de dados de um modificador nunca abaixo de 1 ("(@abilities.wis.mod)d8" do Sear Undead). */
function atLeastOneDie(formula) {
  return formula.replace(/\((@abilities\.[a-z]{3}\.mod)\)d(\d+)/g, '(max(1, $1))d$2');
}

/** O dado de um cantrip no nível do personagem ("2d10"). */
function scaledDice(raw, level) {
  const list = Array.isArray(raw?.scalingLevelDice) ? raw.scalingLevelDice : raw?.scalingLevelDice ? [raw.scalingLevelDice] : [];
  const scaling = (list.find((e) => !/\{\{/.test(JSON.stringify(e?.scaling ?? {}))) ?? list[0])?.scaling;
  if (!scaling) return null;
  const steps = Object.keys(scaling).map(Number).filter((n) => n <= level).sort((a, b) => b - a);
  return steps.length ? scaling[steps[0]] : null;
}

/** O primeiro dado de dano citado no texto ({@damage 1d10}). */
function textDice(raw) {
  return JSON.stringify(raw?.entries ?? []).match(/\{@damage ([^}|]+)/)?.[1] ?? null;
}

/** O primeiro dado de cura citado no texto ({@dice 2d8}). */
function textHealDice(raw) {
  return JSON.stringify(raw?.entries ?? []).match(/\{@dice ([^}|]+)/)?.[1] ?? null;
}

/** O dado somado por círculo acima do base ({@scaledamage 8d6|3-9|1d6} dá "1d6"). */
function upcastDice(raw) {
  return JSON.stringify(raw?.entriesHigherLevel ?? []).match(/\{@scale(?:damage|dice) [^|}]+\|[^|}]+\|([^|}]+)\}/)?.[1] ?? null;
}

const TYPE_CHOICE = /(?:type|damage) (?:of )?your choice|\(your choice\)|of a type you choose|choose (?:one of )?(?:the following|acid|cold|fire)/i;
const TYPE_PAIR = /\b([a-z]+) or ([a-z]+) damage \(your choice\)/i;

/** Os tipos de dano que a magia deixa escolher, pelo texto (Chromatic Orb: todos; Destructive Wave: só o par da frase), ou null. */
export function spellTypeOptions(raw) {
  const types = raw?.damageInflict ?? [];
  if (types.length < 2) return null;
  const text = JSON.stringify(raw?.entries ?? []).replace(/[{]@\w+ ([^|}]*)[^}]*[}]/g, '$1');
  const pair = text.match(TYPE_PAIR);
  if (pair) {
    const two = [pair[1], pair[2]].map((t) => t.toLowerCase()).filter((t) => types.includes(t));
    if (two.length === 2) return two;
  }
  return TYPE_CHOICE.test(text) ? types : null;
}

/** A frase do primeiro dado de dano soma o modificador de conjuração ("1d8 plus your spellcasting ability modifier")? */
export function damageAddsMod(raw, dice) {
  const m = JSON.stringify(raw?.entries ?? []).match(/\{@damage ([^}|]+)[^}]*\}([^.]*?)(?:plus|\+) your spellcasting ability modifier/i);
  return !!m && m[1] === dice && !/\{@damage/.test(m[2]);
}

const DAMAGE_NOW = /\bwhen (you cast|it appears|the [\w ]+ appears|they appear)|\bas part of (casting|the action)|\bimmediately\b/i;
const DAMAGE_LATER = /\bwhenever\b|until the spell ends, (you can|a creature|any creature)|\b(starts|ends) (its|their) turn\b|for the first time on a turn|\bfirst time each turn\b|\blater turns?\b|\bon each of your turns\b|\bexposed to\b/i;

/** O dano da magia só acontece DEPOIS do lançamento (Hunter's Mark, Hex, Produce Flame, Flaming Sphere)? Lê o parágrafo do primeiro dado até ele. */
export function damageLater(raw) {
  const paras = [];
  const walk = (e) => {
    if (typeof e === 'string') paras.push(e.replace(/[{]@\w+ ([^|}]*)[^}]*[}]/g, '$1'));
    else for (const x of [...(e?.entries ?? []), ...(e?.items ?? [])]) walk(x);
  };
  for (const e of raw?.entries ?? []) walk(e);
  for (const p of paras) {
    const sentences = p.split(/(?<=[.!?])\s+/);
    const i = sentences.findIndex((x) => /\b\d+d\d+\b/.test(x));
    if (i < 0) continue;
    const lead = sentences.slice(0, i + 1).join(' ');
    return !DAMAGE_NOW.test(lead) && DAMAGE_LATER.test(lead);
  }
  return false;
}

/** A mecânica de uma magia pelo dado do 5etools. */
export function spellMechanics(raw, level) {
  const text = JSON.stringify(raw?.entries ?? []).replace(/[{]@\w+ ([^|}]*)[^}]*[}]/g, '$1');
  const pair = !raw?.damageInflict?.length ? text.match(TYPE_PAIR) : null;
  const types = raw?.damageInflict ?? (pair ? [pair[1], pair[2]].map((t) => t.toLowerCase()) : []);
  const dice = raw?.level === 0 ? scaledDice(raw, level) ?? textDice(raw) : textDice(raw);
  const healing = (raw?.miscTags ?? []).includes('HL') ? textHealDice(raw) : null;
  const addMod = /spellcasting ability modifier/i.test(JSON.stringify(raw?.entries ?? []));
  return {
    attack: raw?.spellAttack?.[0] ?? null,
    save: raw?.savingThrow?.[0] ? raw.savingThrow[0].slice(0, 3) : null,
    damage: types.length ? { dice, types, ...(pair ? { typeOptions: types } : spellTypeOptions(raw) ? { typeOptions: spellTypeOptions(raw) } : {}), ...(damageAddsMod(raw, dice) ? { addMod: true } : {}), ...(damageLater(raw) ? { later: true } : {}) } : null,
    heal: healing ? { dice: healing, addMod } : null,
    upcast: raw?.level > 0 ? upcastDice(raw) : null,
  };
}

/** Os cantrips que atacam ou pedem salvaguarda e causam dano. */
export function cantripAttacks(spellcasting, level) {
  const out = [];
  const seen = new Set();
  for (const origin of spellcasting?.origins ?? []) {
    for (const s of [...(origin.cantrips ?? []), ...(origin.alwaysPrepared ?? [])]) {
      const raw = s.raw;
      if (!raw || raw.level !== 0 || seen.has(raw.name)) continue;
      const attack = raw.spellAttack?.length;
      const save = raw.savingThrow?.[0];
      if (!raw.damageInflict?.length || (!attack && !save)) continue;
      seen.add(raw.name);
      const originKey = origin.key ?? origin.uid ?? origin.label;
      out.push({
        key: `spell:${originKey}|${raw.name}`,
        kind: 'cantrip',
        name: raw.name,
        origin: originKey,
        cantrip: true,
        school: raw.school ?? null,
        spellClass: origin.classId ?? null,
        attack: attack ? { bonus: origin.attackBonus ?? null } : null,
        save: attack ? null : { ability: save.slice(0, 3), dc: origin.saveDc ?? null },
        damage: { dice: scaledDice(raw, level) ?? textDice(raw) ?? '', types: raw.damageInflict },
        rangeText: rangeLabel(raw),
      });
    }
  }
  return out;
}

/** O ator montado em memória, ou null se a montagem falhar. */
export function safeActor(character, db) {
  try {
    return assembleFoundryActor(character, db);
  } catch {
    return null;
  }
}

/** O nível de cada classe e dono de ScaleValue no ator. */
function scaleSteps(actor, totalLevel) {
  const items = actor?.items ?? [];
  const classLevel = Object.fromEntries(
    items.filter((i) => i.type === 'class').map((i) => [i.system?.identifier, i.system?.levels ?? 0]),
  );
  const explicit = [];
  const fallback = [];
  for (const it of items) {
    if (!['class', 'subclass', 'race'].includes(it.type)) continue;
    const level = it.type === 'class'
      ? classLevel[it.system?.identifier]
      : it.type === 'subclass' ? classLevel[it.system?.classIdentifier] : totalLevel;
    const owners = [...new Set([it.system?.identifier, slug(it.name)].filter(Boolean))];
    for (const a of Object.values(it.system?.advancement ?? {})) {
      if (a?.type !== 'ScaleValue') continue;
      const id = a.configuration?.identifier || slug(a.title);
      if (!id) continue;
      const steps = Object.keys(a.configuration?.scale ?? {}).map(Number).filter((n) => n <= (level ?? 0)).sort((x, y) => y - x);
      const raw = steps.length ? a.configuration.scale[steps[0]] : null;
      if (!raw) continue;
      const step = raw.die != null && raw.faces == null ? { number: raw.n ?? 1, faces: raw.die } : raw;
      for (const owner of owners) (a.configuration?.identifier ? explicit : fallback).push({ key: `${owner}.${id}`, step });
    }
  }
  const taken = new Set(explicit.map((s) => s.key));
  return [...explicit, ...fallback.filter((s) => !taken.has(s.key))];
}

/** O valor de cada ScaleValue do ator no nível dele ("cleric.channel-divinity"). */
export function scaleValues(actor, totalLevel) {
  const out = {};
  for (const { key, step } of scaleSteps(actor, totalLevel)) {
    if (key in out) continue;
    const value = step.value ?? step.number;
    if (typeof value === 'number') out[key] = value;
    if (typeof step.faces === 'number') {
      out[`${key}.number`] = typeof step.number === 'number' ? step.number : 1;
      out[`${key}.faces`] = step.faces;
    }
  }
  return out;
}

/** As ScaleValues como dados de fórmula: dado vira "3d6", com `.number` e `.faces`. */
export function scaleRollData(actor, totalLevel) {
  const out = {};
  for (const { key, step } of scaleSteps(actor, totalLevel)) {
    if (`scale.${key}` in out) continue;
    if (typeof step.faces === 'number') {
      const number = typeof step.number === 'number' ? step.number : 1;
      out[`scale.${key}`] = `${number}d${step.faces}`;
      out[`scale.${key}.number`] = number;
      out[`scale.${key}.faces`] = step.faces;
      out[`scale.${key}.die`] = `d${step.faces}`;
    } else if (typeof (step.value ?? step.number) === 'number') {
      out[`scale.${key}`] = step.value ?? step.number;
    } else if (typeof step.value === 'string' && step.value.trim()) {
      out[`scale.${key}`] = step.value;
    }
  }
  return out;
}

/** O contexto do evalUses a partir do ator e da derivação. */
function usesContext(actor, derived) {
  return {
    scales: scaleValues(actor, derived.level ?? 0),
    mods: derived.modifiers ?? {},
    prof: derived.proficiencyBonus ?? 0,
    classLevels: Object.fromEntries(
      (actor?.items ?? []).filter((i) => i.type === 'class').map((i) => [i.system?.identifier, i.system?.levels ?? 0]),
    ),
    level: derived.level ?? 0,
  };
}

/**
 * Os pools de feature do ator (o item, ou cada activity com pool próprio).
 * @returns {{ key: string, name: string, max: number, recovery: object[], kind: 'pool' }[]}
 */
export function actorResources(actor, derived, problems = []) {
  const ctx = usesContext(actor, derived);
  const out = [];
  const seen = new Set();
  const add = (key, name, uses, item) => {
    if (seen.has(key)) return;
    seen.add(key);
    const max = evalUses(uses.max, ctx);
    if (max == null) {
      problems.push({ where: name, message: `pool max does not resolve: ${uses.max}` });
      return;
    }
    if (max > 0) out.push({ key, kind: 'pool', name, max, recovery: uses.recovery ?? [], item: item.name });
  };
  for (const it of actor?.items ?? []) {
    if (it.type !== 'feat' || isBasicActionItem(it)) continue;
    const ident = it.system?.identifier || slug(it.name);
    if (it.system?.uses?.max) {
      add(`pool:${ident}`, it.name, it.system.uses, it);
      continue;
    }
    const pooled = Object.values(it.system?.activities ?? {}).filter((a) => a?.uses?.max);
    for (const a of pooled) add(`pool:${ident}:${slug(a.name)}`, pooled.length > 1 ? `${it.name}: ${a.name}` : it.name, a.uses, it);
  }
  return out;
}

/** A fórmula de uma parte de dano ou cura do Foundry. */
function partFormula(part) {
  if (part?.custom?.enabled && part.custom.formula) return atLeastOneDie(String(part.custom.formula).trim());
  const dice = part?.number && part?.denomination ? `${part.number}d${part.denomination}` : '';
  const bonus = String(part?.bonus ?? '').trim();
  return [dice, bonus].filter(Boolean).join(' + ');
}

/**
 * As activities sem `activation.type` que o jogador DISPARA sem ação (troca ou devolve recurso,
 * a salvaguarda e a cura da Relentless Rage), pelo nome da feature e o da activity (ou o tipo).
 */
const TRIGGERED_ACTIVITIES = {
  'natural recovery': ['Recover Spell Slots'],
  'wild resurgence': ['Regain Spell Slot', 'Regain Wild Shape'],
  'font of inspiration': ['Recharge with Spell Slot'],
  'sorcerous restoration': ['Restore Sorcery Points'],
  'sorcery incarnate': ['Restore Innate Sorcery'],
  'persistent rage': ['Recharge Rage on Initiative'],
  'intimidating presence': ['Recharge with Rage'],
  archdruid: ['Nature Magician', 'Recharge on Initiative'],
  'holy nimbus': ['Regain Use'],
  'hurl through hell': ['Regain Use'],
  'dragon wings': ['Restore Use'],
  'eldritch master': ['Eldritch Master'],
  'relentless rage': ['save', 'heal'],
  "land's aid": ['heal'],
  'open hand technique': ['Addle', 'Push', 'Topple'],
  'improved brutal strike': ['Sundering Blow', 'Staggering Blow'],
  'superior defense': ['utility'],
};

/** A "cura" que o SRD usa no lugar de reduzir o dano (Deflect Attacks): o card diz o que é. */
const HEAL_LABELS = { 'deflect attacks': 'Damage reduced', 'deflect energy': 'Damage reduced' };

/** Os tipos de dano que a ancestralidade decide: o Breath Weapon fica com o que a espécie resiste (o mesmo tipo, XPHB). */
function ancestryTypes(item, types, ctx) {
  if (types.length < 2 || String(item.name).toLowerCase() !== 'breath weapon') return types;
  const resist = new Set((ctx.derived.damageTraits?.resist ?? []).map((t) => String(t).toLowerCase()));
  const hit = types.filter((t) => resist.has(String(t).toLowerCase()));
  return hit.length === 1 ? hit : types;
}

/** O nome de uma activity disparada sem nome própria, pelo tipo ("Land's Aid: Healing"). */
const TYPE_NAMES = { heal: 'Healing', save: 'Saving throw', damage: 'Damage', utility: 'Use' };

/** O dado que a activity rola e que só o texto diz (o Cutting Words subtrai um dado de Bardic Inspiration). */
const CHANNEL_CUE = /\b(?:use|uses|using|(?:expend|expends|expending) (?:one|a) use of) (?:your )?channel divinity\b/i;

/** O texto da feature gasta um uso do Channel Divinity? */
export function spendsChannelDivinity(feature) {
  const name = feature?.name ?? '';
  if (/^channel divinity$/i.test(name)) return false;
  return /^channel divinity:/i.test(name) || /^channel divinity$/i.test(feature?.consumes ?? '') || CHANNEL_CUE.test(plainText(feature?.entries ?? []));
}

const ACTIVITY_ROLLS = {
  'cutting words': { label: 'Bardic Inspiration die (subtract it from the roll)', formula: '@scale.bard.inspiration' },
};

/** O custo normalizado de uma activity, ou null se ela é passiva. */
function normActivation(a, item = null) {
  const type = a?.activation?.type;
  if (!type) {
    const names = TRIGGERED_ACTIVITIES[String(item?.name ?? '').toLowerCase()] ?? [];
    return names.includes(a?.name || a?.type) ? { type: 'none', value: null, condition: a.activation?.condition || '' } : null;
  }
  return {
    type,
    value: a.activation.value ?? null,
    condition: a.activation.condition || '',
  };
}

/** O que uma activity gasta, em chaves de pool. */
function consumptionOf(a, item, ctx) {
  const ident = item.system?.identifier || slug(item.name);
  const ownPool = item.system?.uses?.max ? `pool:${ident}` : a.uses?.max ? `pool:${ident}:${slug(a.name)}` : null;
  const out = [];
  for (const t of a.consumption?.targets ?? []) {
    const amount = Number.parseInt(t.value, 10) || 1;
    let key = null;
    if (t.type === 'attribute') {
      out.push({ attribute: String(t.target ?? ''), formula: String(t.value ?? '') });
      continue;
    }
    if (t.type === 'hitDice' || t.type === 'spellSlots') {
      out.push({ [t.type === 'hitDice' ? 'hitDice' : 'spellSlot']: String(t.target ?? ''), formula: String(t.value ?? '1') });
      continue;
    }
    if (t.type === 'itemUses') {
      const target = t.target ?? '';
      const other = target ? consumptionTargetItem(target, item, ctx.actor?.items) : null;
      if (!target) key = ownPool;
      else if (other === item) key = ownPool;
      else if (other) key = `pool:${other.system?.identifier || slug(other.name)}`;
    } else if (t.type === 'activityUses') {
      key = a.uses?.max ? `pool:${ident}:${slug(a.name)}` : null;
    } else {
      ctx.problems.push({ where: item.name, message: `consumption type not handled: ${t.type}` });
      continue;
    }
    if (!key || !ctx.poolKeys.has(key)) {
      const shown = typeof t.target === 'object' ? JSON.stringify(t.target) : t.target ?? '';
      ctx.problems.push({ where: item.name, message: `consumption target does not resolve: ${t.type} ${shown}`.trim() });
      continue;
    }
    out.push({ key, amount });
  }
  return out;
}

/** A CD de uma activity de save. */
function saveDcOf(a, ctx) {
  const calc = a.save?.dc?.calculation;
  if (calc && calc !== 'spellcasting' && ABILITIES.includes(calc)) {
    return 8 + (ctx.derived.proficiencyBonus ?? 0) + (ctx.derived.modifiers?.[calc] ?? 0);
  }
  if (!calc && a.save?.dc?.formula) return Number.parseInt(a.save.dc.formula, 10) || null;
  return ctx.spellDc;
}

/** O modificador da conjuração da classe (o maior entre as origens de classe), ou null: o `@mod` de uma activity que não é ataque. */
function castingMod(derived) {
  const mods = (derived.spellcasting?.origins ?? []).filter((o) => o.kind === 'class' && o.abilityMod != null).map((o) => o.abilityMod);
  return mods.length ? Math.max(...mods) : null;
}

/** As ações básicas e das features, com custo, consumo e fórmulas. */
function featureActions(actor, ctx) {
  const out = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== 'feat') continue;
    const basic = isBasicActionItem(item);
    const ident = item.system?.identifier || slug(item.name);
    const activities = [];
    for (const a of Object.values(item.system?.activities ?? {})) {
      const activation = normActivation(a, item);
      if (!activation) continue;
      const mods = ctx.derived.modifiers ?? {};
      const attackAbility = a.type === 'attack'
        ? a.attack?.ability || ((mods.dex ?? 0) > (mods.str ?? 0) ? 'dex' : 'str')
        : null;
      const entry = {
        id: a._id ?? slug(a.name),
        type: a.type,
        name: a.name || (activation.type === 'none' && TYPE_NAMES[a.type] ? `${item.name}: ${TYPE_NAMES[a.type]}` : item.name),
        activation,
        consumes: basic ? [] : consumptionOf(a, item, ctx),
        attack: a.type === 'attack' ? { type: a.attack?.type?.value ?? null, ability: attackAbility } : null,
        save: a.type === 'save' ? { abilities: a.save?.ability ?? [], dc: saveDcOf(a, ctx), ...(/@item\.uses\.spent/.test(a.save?.dc?.formula ?? '') ? { dcFormula: a.save.dc.formula } : {}) } : null,
        roll: a.type === 'utility' && a.roll?.formula ? { label: a.roll.name || 'Roll', formula: a.roll.formula } : ACTIVITY_ROLLS[String(item.name).toLowerCase()] ?? null,
        heal: a.type === 'heal' && partFormula(a.healing) ? { formula: partFormula(a.healing), types: a.healing?.types ?? [], ...(HEAL_LABELS[String(item.name).toLowerCase()] ? { label: HEAL_LABELS[String(item.name).toLowerCase()] } : {}) } : null,
        damage: (a.damage?.parts ?? []).map((p) => ({ formula: partFormula(p), types: ancestryTypes(item, p.types ?? [], ctx) })).filter((p) => p.formula),
        selfTarget: a.target?.affects?.type === 'self',
      };
      entry.scalable = [entry.heal?.formula, ...entry.damage.map((p) => p.formula)].some((f) => /@scaling\b/.test(f ?? ''));
      if (!attackAbility && ctx.castMod != null) entry.mod = ctx.castMod;
      const data = attackAbility ? { ...ctx.rollData, mod: mods[attackAbility] ?? 0 } : { ...ctx.rollData, mod: entry.mod ?? 0 };
      for (const f of [entry.heal?.formula, ...entry.damage.map((p) => p.formula)].filter(Boolean)) {
        const error = validateFormula(f, data);
        if (error) ctx.problems.push({ where: `${item.name}: ${entry.name}`, message: `formula: ${f} (${error})` });
      }
      if (entry.save && entry.save.dc == null) ctx.problems.push({ where: `${item.name}: ${entry.name}`, message: 'save DC has no spellcasting origin' });
      activities.push(entry);
    }
    if (!activities.length) continue;
    out.push({
      key: `action:${ident}`,
      name: item.name,
      group: basic ? 'basic' : item.system?.type?.value || 'feature',
      subtype: item.system?.type?.subtype || null,
      pool: item.system?.uses?.max && ctx.poolKeys.has(`pool:${ident}`) ? `pool:${ident}` : null,
      activities,
    });
  }
  return out;
}

/** Resistências, imunidades e vulnerabilidades a dano, juntando as de item; `reduce` tira um número antes delas. */
function defensesOf(derived, character) {
  const dt = derived.damageTraits ?? {};
  const join = (kind) => [...new Set([...(dt[kind] ?? []), ...(dt.fromItems?.[kind] ?? [])].map((v) => String(v).toLowerCase()))];
  const reduce = [];
  const ham = collectFeatIds(character ?? {}).some((id) => /^heavy armor master\|/i.test(id));
  if (ham && derived.armorClass?.armorSlot === 'heavy') reduce.push({ types: ['bludgeoning', 'piercing', 'slashing'], amount: derived.proficiencyBonus ?? 2, label: 'Heavy Armor Master' });
  return { resist: join('resist'), immune: join('immune'), vulnerable: join('vulnerable'), reduce };
}

/** Todos os deslocamentos da espécie: { walk: { feet }, fly: { feet, note } }. */
function speedsOf(character, db) {
  if (!db || !character.species) return {};
  const raceObj = resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage);
  const sp = parseSpecies(raceObj)?.speed ?? {};
  const walk = typeof sp.walk === 'number' ? sp.walk : 0;
  const out = {};
  for (const mode of ['walk', 'fly', 'swim', 'climb', 'burrow']) {
    const v = sp[mode];
    if (v == null || v === false) continue;
    const feet = v === true ? walk : typeof v === 'object' ? Number(v.number) : Number(v);
    if (!Number.isFinite(feet) || feet <= 0) continue;
    const note = typeof v === 'object' && v.condition ? String(v.condition).replace(/\{@\w+ ([^}|]+)[^}]*\}/g, '$1') : null;
    out[mode] = note ? { feet, note } : { feet };
  }
  return out;
}

/** A armadura que cada feature de deslocamento proíbe, pelo texto do XPHB. */
const SPEED_ARMOR = {
  'unarmored movement': (ac) => !ac.hasArmor && !ac.hasShield,
  'fast movement': (ac) => ac.armorSlot !== 'heavy',
  roving: (ac) => ac.armorSlot !== 'heavy',
};

/** Os deslocamentos que uma feature dá iguais ao deslocamento a pé, pelo texto do XPHB ("a Climb Speed equal to your Speed"). */
const FEATURE_SPEEDS = {
  'second-story work': ['climb'],
  roving: ['climb', 'swim'],
  'aquatic affinity': ['swim'],
  stormborn: [{ mode: 'fly', note: 'not underground or indoors' }],
  'gift of the sea': [{ mode: 'swim', feet: 40 }],
  athlete: ['climb'],
};

/** Os deslocamentos com os dos itens ativos sempre ligados (itemSpeeds); o maior vence. */
function withItemSpeeds(speeds, inventory) {
  const out = { ...speeds };
  for (const [mode, s] of Object.entries(itemSpeeds(inventory, speeds.walk?.feet ?? 0))) {
    if (!(out[mode]?.feet >= s.feet)) out[mode] = { feet: s.feet, note: s.note };
  }
  return out;
}

/** Os deslocamentos com os das features (FEATURE_SPEEDS), iguais ao a pé final; o maior vence. */
function withFeatureSpeeds(speeds, features) {
  const walk = speeds.walk?.feet;
  if (!walk) return speeds;
  const out = { ...speeds };
  for (const name of features) {
    for (const entry of FEATURE_SPEEDS[name] ?? []) {
      const { mode, feet = walk, note = null } = typeof entry === 'string' ? { mode: entry } : entry;
      if (!(out[mode]?.feet >= feet)) out[mode] = { feet, ...(note ? { note } : {}) };
    }
  }
  return out;
}

/** O que as features somam ao deslocamento a pé (os effects `movement.walk` do ator), com a armadura de cada uma. */
function featureSpeedBonus(actor, armorClass, rollData) {
  let feet = 0;
  for (const item of actor?.items ?? []) {
    if (item.type !== 'feat') continue;
    const allowed = SPEED_ARMOR[String(item.name).toLowerCase()];
    if (allowed && !allowed(armorClass ?? {})) continue;
    for (const e of item.effects ?? []) {
      if (e.disabled || e.transfer === false) continue;
      for (const ch of e.changes ?? []) {
        if (ch.key !== 'system.attributes.movement.walk' || Number(ch.mode) !== 2) continue;
        try {
          feet += rollFormula(String(ch.value), { data: rollData }).total;
        } catch {
          // ATENÇÃO: valor que não resolve é ignorado; o levantamento o mostra como problema.
        }
      }
    }
  }
  return feet;
}

/** O deslocamento a pé da espécie, ou null (sem db ou sem espécie). */
function speedOf(character, db) {
  if (!db || !character.species) return null;
  const raceObj = resolveRaceObj(db, character.species.id, character.species.source, character.species.lineage);
  return parseSpecies(raceObj)?.speed?.walk ?? null;
}

/** Os slots como dados de fórmula (`@spells.pact.max`, `@spells.spell3.max`). */
function spellRollData(spellcasting) {
  const out = {};
  for (const [level, max] of Object.entries(spellcasting?.slots ?? {})) out[`spell${level}`] = { max, level: Number(level) };
  const pact = spellcasting?.pactSlots;
  if (pact?.slots) out.pact = { max: pact.slots, level: pact.level };
  return out;
}

/** O atributo que cada talento escolhido aumentou, pelo nome em minúsculas (Conjuration Adept). */
function featAbilities(character) {
  const out = {};
  const walk = (bag) => {
    for (const choice of Object.values(bag ?? {})) {
      if (!choice || typeof choice !== 'object') continue;
      if (choice.kind === 'feat' && choice.picks?.length) {
        const ability = collectAbilityPicks(choice.sub ?? {})[0]?.ability;
        if (ability) for (const p of choice.picks) out[String(p).split('|')[0].toLowerCase()] = ability;
      }
      for (const sub of Object.values(choice.sub ?? {})) walk(sub);
    }
  };
  walk(character.species?.choices);
  walk(character.origin?.originFeat?.choices);
  const origin = character.origin?.originFeat;
  const originAbility = collectAbilityPicks(origin?.choices ?? {})[0]?.ability;
  if (origin?.id && originAbility) out[String(origin.id).toLowerCase()] = originAbility;
  for (const cls of character.classes ?? []) walk(cls.choices);
  return out;
}

/** O rollData do jogo: atributos, PB, classes, PV, atunement, o atributo dos talentos e as escalas. */
function buildRollData(character, derived, actor) {
  const abilities = {};
  for (const a of ABILITIES) {
    abilities[a] = { value: derived.scores?.[a] ?? 10, mod: derived.modifiers?.[a] ?? 0, save: derived.saves?.[a] ?? 0 };
  }
  const classes = {};
  for (const c of character.classes ?? []) if (c.classId) classes[c.classId] = { levels: c.level };
  const faces = hitDiceByFace(derived).map((h) => h.faces);
  return {
    abilities,
    prof: derived.proficiencyBonus ?? 0,
    details: { level: derived.level ?? 0 },
    classes,
    attributes: {
      hp: { value: derived.maxHp ?? 0, max: derived.maxHp ?? 0 },
      ...(faces.length ? { hd: { largestAvailable: `1d${faces[0]}`, smallestAvailable: `1d${faces[faces.length - 1]}`, largestFace: faces[0], smallestFace: faces[faces.length - 1] } } : {}),
    },
    statuses: { bloodied: 0 },
    scaling: 1,
    attunement: { value: (character.inventory ?? []).filter((e) => e.attuned).length },
    featAbility: featAbilities(character),
    spells: spellRollData(derived.spellcasting),
    ...scaleRollData(actor, derived.level ?? 0),
  };
}

/** Os testes: atributos, saves, perícias, iniciativa, morte, concentração. */
function checkList(derived, character) {
  return {
    abilities: ABILITIES.map((ability) => {
      const mod = derived.modifiers?.[ability] ?? 0;
      const saveProf = (derived.proficientSaves ?? []).includes(ability);
      const items = (derived.itemSaveBonus?.sources ?? []).map((s) => ({ kind: 'item', label: s.name, value: s.value }));
      const checkItems = (derived.itemCheckBonus?.sources ?? []).map((s) => ({ kind: 'item', label: s.name, value: s.value }));
      return {
        ability,
        score: derived.scores?.[ability] ?? 10,
        mod,
        save: derived.saves?.[ability] ?? 0,
        saveProf,
        checkParts: [{ kind: 'ability', ability, value: mod }, ...checkItems],
        saveParts: [
          { kind: 'ability', ability, value: mod },
          ...(saveProf ? [{ kind: 'proficiency', level: 1, value: derived.proficiencyBonus ?? 0 }] : []),
          ...items,
        ],
      };
    }),
    skills: Object.entries(SKILL_ABILITY).map(([skill, ability]) => {
      const mod = derived.modifiers?.[ability] ?? 0;
      const bonus = derived.skills?.[skill]?.bonus ?? 0;
      const prof = derived.skills?.[skill]?.proficiency ?? 0;
      const itemBonus = derived.itemCheckBonus?.bonus ?? 0;
      const profPart = bonus - mod - itemBonus;
      return {
        skill,
        ability,
        bonus,
        prof,
        parts: [
          { kind: 'ability', ability, value: mod },
          ...(prof ? [{ kind: 'proficiency', level: prof, value: profPart }] : profPart > 0 ? [{ kind: 'proficiency', level: 0.5, value: profPart }] : []),
          ...(derived.itemCheckBonus?.sources ?? []).map((s) => ({ kind: 'item', label: s.name, value: s.value })),
        ],
      };
    }),
    initiative: { bonus: initiativeBonus(character, derived) },
    deathSave: { bonus: 0 },
    concentration: { bonus: derived.saves?.con ?? 0 },
  };
}

/** Os recursos de magia: slots, pacto e usos de magia concedida e arcanum. */
function spellResources(spellcasting) {
  const out = [];
  for (const [level, max] of Object.entries(spellcasting?.slots ?? {})) {
    if (max > 0) out.push({ key: `slot:${level}`, kind: 'slot', name: `Level ${level} slots`, level: Number(level), max, recovery: [{ period: 'lr', type: 'recoverAll' }] });
  }
  const pact = spellcasting?.pactSlots;
  if (pact?.slots > 0) out.push({ key: 'pact', kind: 'pact', name: 'Pact slots', level: pact.level, max: pact.slots, recovery: [{ period: 'sr', type: 'recoverAll' }] });
  for (const origin of spellcasting?.origins ?? []) {
    for (const s of origin.alwaysPrepared ?? []) {
      const period = GRANTED_RECOVERY[s.castType];
      if (!period || !(s.uses > 0) || !s.raw) continue;
      out.push({ key: `granted:${origin.key}|${s.raw.name}`, kind: 'granted', name: s.raw.name, origin: origin.key, max: s.uses, recovery: [{ period, type: 'recoverAll' }] });
    }
    for (const s of origin.arcanumSpells ?? []) {
      if (!s.raw) continue;
      out.push({ key: `granted:${origin.key}|${s.raw.name}`, kind: 'granted', name: s.raw.name, origin: origin.key, max: 1, recovery: [{ period: 'lr', type: 'recoverAll' }] });
    }
  }
  return out;
}

const ITEM_UPCAST = /increase the spell's (?:slot )?level by (?:1|one) for each additional charge/i;
const ITEM_CAP = /no more than (\d+) charges/i;
const EACH_SPELL = /can['’]?t be used to cast that spell again|cast (?:that|the same) spell again/i;
const SPELLBOOK_ITEM = /functions as a spellbook/i;
const DAWN_CAST = /\bcast\b[^.]{0,200}\.(?:[^.]{0,200}\.)?[^.]{0,120}\buntil the next dawn/i;
const ITEM_DC = /\(save (?:DC )?(\d+)\)|spell save DC (?:is |of )?(\d+)|saving throw DC is (\d+)|save DC of (\d+)/i;
const ITEM_ATTACK = /\(\+(\d+) to hit\)|spell attack (?:bonus|modifier) (?:is |of )?\+(\d+)|attack bonus (?:is|of) \+?(\d+)/i;
const firstNum = (m) => (m ? Number(m.slice(1).find((x) => x != null)) : null);

/**
 * As magias dos itens ativos (attachedSpells, a escolhida do Enspelled, as guardadas) como origens, e os usos por
 * dia como recursos; a CD e o ataque do texto do item, os do personagem ou os de quem guardou.
 */
export function itemSpellOrigins(inventory, db, level, { spellDc = null, spellAttack = null } = {}) {
  const origins = [];
  const resources = [];
  for (const e of inventory ?? []) {
    const raw = e?.raw;
    if (!raw || !e.uid || !isActiveItem(e)) continue;
    const att = raw.attachedSpells && !Array.isArray(raw.attachedSpells) ? raw.attachedSpells : {};
    const loose = Array.isArray(raw.attachedSpells) ? raw.attachedSpells : (att.other ?? []);
    const bound = e.boundSpell ? boundSpellRule(raw) : null;
    const store = storeRuleOf(raw);
    if (!Object.keys(att).length && !loose.length && !bound && !(store && e.stored?.length)) continue;
    const text = plainItemText(raw);
    const dc = firstNum(text.match(ITEM_DC));
    const atk = firstNum(text.match(ITEM_ATTACK));
    const key = `item:${e.uid}`;
    const spells = [];
    const add = (ref, extra, suffix = '') => {
      const [base, at] = String(ref).split('#');
      const [name, source] = base.split('|');
      const sp = resolveSpellObj(db, name, source?.toUpperCase());
      if (!sp) return;
      spells.push({
        key: `spell:${key}|${sp.name}${suffix}`, name: sp.name, source: sp.source ?? null, level: sp.level, ritual: isRitual(sp), school: sp.school ?? null,
        concentration: isConcentration(sp), time: sp.time?.[0]?.unit ?? null, durationRounds: roundsOf(sp.duration), mechanics: spellMechanics(sp, level),
        prepared: true, granted: true, itemUid: e.uid, castLevel: Number(at) > sp.level ? Number(at) : null, ...extra,
      });
    };
    const spellName = (ref) => String(ref).split('|')[0];
    const pooled = (field, castType, recovery, eachByProse = false) => {
      for (const [n, refs] of Object.entries(field ?? {})) {
        const count = parseInt(n, 10) || 1;
        const each = /e$/.test(n) || eachByProse || refs.length === 1;
        const groups = each ? refs.map((r) => [r]) : [refs];
        for (const group of groups) {
          const usesKey = each ? `granted:${key}|${spellName(group[0])}` : `granted:${key}|${castType}:${n}`;
          for (const ref of group) add(ref, { castType, uses: usesKey, count });
          resources.push({ key: usesKey, kind: 'granted', name: `${raw.name}: ${group.map(spellName).join(' or ')}`, origin: key, max: count, recovery });
        }
      }
    };
    for (const ref of att.will ?? []) add(ref, { castType: 'will', uses: null });
    pooled(att.daily, 'daily', [{ period: 'day', type: 'recoverAll' }], EACH_SPELL.test(text));
    pooled(att.rest, 'rest', [{ period: 'sr', type: 'recoverAll' }]);
    pooled(att.limited, 'limited', []);
    for (const ref of att.ritual ?? []) add(ref, { castType: 'ritual', uses: null, ritualOnly: true });
    const chargeMax = itemChargeMax(raw);
    if (loose.length && !SPELLBOOK_ITEM.test(text) && !String(raw.type ?? '').startsWith('P')) {
      const cost = chargeMax > 0 ? chargeCostOf(text) : null;
      const daily = !cost && DAWN_CAST.test(text);
      for (const ref of loose) {
        if (cost) add(ref, { castType: null, uses: null, chargeKey: `charges:${e.uid}`, chargeCost: cost.cost, chargeUpcast: cost.any || ITEM_UPCAST.test(text), chargeCap: Number(text.match(ITEM_CAP)?.[1]) || null });
        else if (daily) {
          const usesKey = `granted:${key}|${spellName(ref)}`;
          add(ref, { castType: 'daily', uses: usesKey, count: 1 });
          resources.push({ key: usesKey, kind: 'granted', name: `${raw.name}: ${spellName(ref)}`, origin: key, max: 1, recovery: [{ period: 'day', type: 'recoverAll' }] });
        } else add(ref, { castType: 'item', uses: null });
      }
    }
    if (chargeMax > 0) {
      const cap = Number(text.match(ITEM_CAP)?.[1]) || null;
      for (const [n, refs] of Object.entries(att.charges ?? {})) {
        for (const ref of refs) add(ref, { castType: null, uses: null, chargeKey: `charges:${e.uid}`, chargeCost: parseInt(n, 10) || 1, chargeUpcast: ITEM_UPCAST.test(text), chargeCap: cap });
      }
      if (bound) add(e.boundSpell, { castType: null, uses: null, chargeKey: `charges:${e.uid}`, chargeCost: 1, chargeUpcast: false, bound: true });
    }
    if (store) {
      (e.stored ?? []).forEach((st, i) => add(`${st.name}|${st.source ?? ''}`, {
        castType: null, uses: null, castLevel: st.level, stored: { uid: e.uid, index: i, level: st.level, dc: dc ?? st.dc ?? null, attack: atk ?? st.attack ?? null, mod: st.mod ?? null },
      }, `#${i}`));
    }
    if (!spells.length) continue;
    origins.push({
      key, kind: 'item', label: raw.name, ability: null, abilityMod: null, itemUid: e.uid,
      saveDc: dc ?? spellDc, attackBonus: atk ?? spellAttack,
      isPact: false, classId: null, spells,
    });
  }
  return { origins, resources };
}

/** Os itens ativos que guardam magias, com o que cabe: `[{ uid, name, one, maxLevel, room }]` (room em círculos; null = vazio ou cheio). */
export function spellStores(inventory) {
  const out = [];
  for (const e of inventory ?? []) {
    const rule = e?.uid && isActiveItem(e) ? storeRuleOf(e.raw) : null;
    if (!rule) continue;
    const used = storedLevels(e);
    const room = rule.one ? ((e.stored ?? []).length ? 0 : rule.maxLevel) : Math.max(0, rule.cap - used);
    out.push({ uid: e.uid, name: e.raw.name, one: rule.one, maxLevel: rule.maxLevel, room });
  }
  return out;
}

/** O Replicate Magic Item: os planos conhecidos e quantos itens o artífice pode ter (a coluna Magic Items), ou null. */
export function replicateInfo(character, db) {
  for (const cls of character?.classes ?? []) {
    if (cls.classId !== 'artificer') continue;
    const obj = resolveClassObj(db, cls.classId, cls.source);
    const plans = Object.values(cls.choices ?? {}).filter((e) => e?.kind === 'plan').flatMap((e) => e.picks ?? []);
    const max = tableColumnAt(obj, 'Magic Items', cls.level ?? 1);
    if (plans.length && max) return { plans, max };
  }
  return null;
}

/** As magias por origem, com a mecânica de cada uma. */
function spellOrigins(spellcasting, level, { ritualAdept = false } = {}) {
  return (spellcasting?.origins ?? []).map((o) => {
    const entry = (s, extra) => ({
      key: `spell:${o.key}|${s.raw.name}`,
      name: s.raw.name,
      source: s.raw.source ?? s.source ?? null,
      level: s.raw.level,
      ritual: isRitual(s.raw),
      school: s.raw.school ?? null,
      concentration: isConcentration(s.raw),
      time: s.raw.time?.[0]?.unit ?? null,
      durationRounds: roundsOf(s.raw.duration),
      mechanics: spellMechanics(s.raw, level),
      ...extra,
    });
    const spells = [
      ...(o.cantrips ?? []).filter((s) => s.raw).map((s) => entry(s, { prepared: true, castType: null, uses: null })),
      ...(o.prepared ?? []).filter((s) => s.raw).map((s) => entry(s, { prepared: true, castType: null, uses: null })),
      ...(o.unprepared ?? []).filter((s) => s.raw).map((s) => entry(s, { prepared: false, castType: null, uses: null, ...(ritualAdept && o.classId === 'wizard' && isRitual(s.raw) ? { ritualOnly: true } : {}) })),
      ...(o.alwaysPrepared ?? []).filter((s) => s.raw).map((s) => entry(s, {
        prepared: true,
        granted: true,
        castType: s.castType ?? null,
        castLevel: s.castLevel ?? null,
        uses: GRANTED_RECOVERY[s.castType] && s.uses > 0 ? `granted:${o.key}|${s.raw.name}` : null,
        ...(s.slot ? { slot: true } : {}),
      })),
      ...(o.arcanumSpells ?? []).filter((s) => s.raw).map((s) => entry(s, { prepared: true, arcanum: true, castType: null, uses: `granted:${o.key}|${s.raw.name}` })),
    ];
    return {
      key: o.key,
      kind: o.kind,
      label: o.label,
      ability: o.ability ?? null,
      abilityMod: o.abilityMod ?? null,
      saveDc: o.saveDc ?? null,
      attackBonus: o.attackBonus ?? null,
      isPact: !!o.isPact,
      classId: o.classId ?? null,
      spells,
    };
  });
}

/**
 * O catálogo de jogo do personagem.
 * @param {import('../schema/character').Character} character
 * @param {object} db
 * @param {{ derived?: object, actor?: object|null }} [opts] para reaproveitar o que o chamador já tem
 */
export function derivePlayCatalog(character, db, { derived = null, actor } = {}) {
  const d = derived ?? deriveFromDb(character, db);
  const a = actor === undefined ? safeActor(character, db) : actor;
  const problems = [];
  if (!a) problems.push({ where: 'actor', message: 'the in-memory actor could not be assembled; features are missing' });

  const rollData = buildRollData(character, d, a);
  const level = d.level || 1;
  const spellDcs = (d.spellcasting?.origins ?? []).filter((o) => o.kind === 'class' && o.saveDc != null).map((o) => o.saveDc);

  const pools = a ? actorResources(a, d, problems) : [];
  const resources = [
    ...hitDiceByFace(d).map((h) => ({ key: `hd:d${h.faces}`, kind: 'hitDice', name: `d${h.faces} Hit Dice`, faces: h.faces, max: h.count, recovery: [{ period: 'lr', type: 'recoverAll' }] })),
    ...spellResources(d.spellcasting),
    ...pools,
    ...chargeResources(d.inventory),
  ];
  const classOrigins = (d.spellcasting?.origins ?? []).filter((o) => o.kind === 'class');
  const itemSpells = itemSpellOrigins(d.inventory, db, level, {
    spellDc: classOrigins.length ? Math.max(...classOrigins.map((o) => o.saveDc ?? 0)) : null,
    spellAttack: classOrigins.length ? Math.max(...classOrigins.map((o) => o.attackBonus ?? 0)) : null,
  });
  resources.push(...itemSpells.resources);
  const ctx = {
    actor: a,
    derived: d,
    rollData,
    problems,
    poolKeys: new Set(pools.map((p) => p.key)),
    spellDc: spellDcs.length ? Math.max(...spellDcs) : null,
    castMod: castingMod(d),
  };

  const features = [...new Set((a?.items ?? []).filter((i) => i.type === 'feat' && !isBasicActionItem(i)).map((i) => norm(i.name)))];
  for (const [name, extra] of Object.entries(EXTRA_RECOVERY)) {
    if (!features.includes(name)) continue;
    const pool = resources.find((r) => r.kind === 'pool' && r.item === extra.item);
    if (pool && extra.replace) pool.recovery = extra.replace.map((r) => ({ ...r }));
    else if (pool && !(pool.recovery ?? []).some((r) => r.period === extra.recovery.period)) pool.recovery = [...(pool.recovery ?? []), extra.recovery];
  }
  const attacks = [
    ...withFeatTypes(withMartialArts([...weaponAttacks(character, d), unarmedStrike(d)], { derived: d, rollData, features, monkWeapons: kenseiWeapons(character) }), features),
    ...featureAttacks(features, d, character),
    ...cantripAttacks(d.spellcasting, level),
  ];
  for (const at of attacks) {
    if (at.kind === 'cantrip' ? !at.damage?.dice : at.kind === 'weapon' && !at.damage) {
      problems.push({ where: at.name, message: 'attack without a damage formula' });
    }
  }

  const bridged = a ? actorRollEffects(a) : [];
  for (const e of bridged) {
    if (e.formula && validateFormula(e.formula, rollData)) problems.push({ where: e.name, message: `actor effect ${e.key} does not resolve: ${e.formula}` });
  }

  const actions = a ? featureActions(a, ctx) : [];
  const featuresOfActor = a ? featureList(a, character, db) : [];
  const speedBonus = featureSpeedBonus(a, d.armorClass, rollData);
  const speeds = speedsOf(character, db);
  const withActivities = new Set(actions.filter((x) => x.activities?.length).map((x) => x.key));
  const pooled = new Set(resources.filter((r) => r.kind === 'pool').map((r) => r.item));
  const activated = (f) => f.costs?.length > 0 || !!f.trigger || withActivities.has(f.actionKey) || pooled.has(f.name);
  const uses = proseUses(featuresOfActor, { hasActivity: (f) => withActivities.has(f.actionKey) })
    .map((u) => (u.name === 'Bolstering Flames' && features.includes('honed spellfire') ? { ...u, formula: `${u.formula} + @classes.sorcerer.levels` } : u))
    .filter((u) => !validateFormula(u.formula, rollData));
  for (const f of featuresOfActor) if (!f.roll && uses.some((u) => u.name === f.name)) f.roll = 'use';
  const optionPicks = featureOptionPicks(character);
  const dcAbility = dcAbilityPick(character?.species?.choices);
  if (dcAbility) {
    const dc = 8 + (d.proficiencyBonus ?? 0) + (d.modifiers?.[dcAbility] ?? 0);
    for (const f of featuresOfActor) if (f.kind === 'species' && /\bDC equals 8\b/i.test(plainText(f.entries ?? []))) f.dc = dc;
  }
  attacks.push(...naturalAttacks(featuresOfActor, d, optionPicks));
  for (const f of featuresOfActor) {
    const own = FEATURE_ATTACKS[norm(f.name)] ?? [];
    if (naturalAttacks([f], d, optionPicks).length || own.some((x) => attacks.some((at) => at.key === x.key))) f.attack = true;
  }
  const channelKey = resources.find((r) => r.kind === 'pool' && String(r.item ?? '').toLowerCase() === 'channel divinity')?.key ?? null;
  for (const f of featuresOfActor) {
    if (!channelKey || !spendsChannelDivinity(f) || resources.some((r) => r.kind === 'pool' && r.item === f.name)) continue;
    const act = actions.find((x) => x.key === f.actionKey);
    if (act?.activities?.length && act.activities.every((x) => !x.consumes.length)) for (const x of act.activities) x.consumes.push({ key: channelKey, amount: 1 });
    if (f.roll || withActivities.has(f.actionKey)) continue;
    f.roll = 'use';
    f.spendItem = 'Channel Divinity';
  }
  for (const f of featuresOfActor) {
    const item = CONSUMES_BY_NAME[norm(f.consumes)];
    if (!item || f.roll || withActivities.has(f.actionKey) || REROLL_FEATURES.includes(norm(f.name)) || resources.some((r) => r.kind === 'pool' && r.item === f.name) || !resources.some((r) => r.kind === 'pool' && r.item === item)) continue;
    f.roll = 'use';
    f.spendItem = item;
  }

  return {
    rollData,
    stats: {
      ac: d.armorClass?.total ?? null,
      hasArmor: !!d.armorClass?.hasArmor,
      acBreakdown: d.armorClass?.breakdown ?? [],
      hpMax: d.maxHp ?? 0,
      profBonus: d.proficiencyBonus ?? 0,
      level: d.level ?? 0,
      initiative: initiativeBonus(character, d),
      speed: speedOf(character, db) == null ? null : speedOf(character, db) + speedBonus,
      speeds: withItemSpeeds(withFeatureSpeeds(speedBonus && speeds.walk ? { ...speeds, walk: { ...speeds.walk, feet: speeds.walk.feet + speedBonus } } : speeds, features), d.inventory),
    },
    checks: checkList(d, character),
    defenses: defensesOf(d, character),
    shield: shieldInHand(d.inventory),
    features,
    featureList: featuresOfActor,
    optionPicks: [...optionPicks],
    optionTargets: optionTargets(character),
    damageTypePicks: [...(character.classes ?? []).map((c) => c.choices), character.origin?.originFeat?.choices].flatMap((b) => collectChoicePicks(b ?? {}, 'damageType')),
    actorEffects: bridged,
    proseEffects: proseRollEffects(featuresOfActor, { activated, bridged, chosenTypes: () => (character.classes ?? []).flatMap((c) => collectChoicePicks(c.choices ?? {}, 'resist')) }).filter((e) => !e.part || !validateFormula(e.part.formula, rollData)),
    proseUses: uses,
    attacks,
    actions,
    resources,
    spells: [...spellOrigins(d.spellcasting, level, { ritualAdept: features.includes('ritual adept') }), ...itemSpells.origins],
    replicate: replicateInfo(character, db),
    spellStores: spellStores(d.inventory),
    problems,
  };
}

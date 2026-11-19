// =============================================================================
// playFeatureRolls: o registro curado das features que entram numa rolagem
// =============================================================================
// O QUE FAZ
//   A camada 2 do DDL-0203 (DDL-0205): as features sem activity que mexem numa
//   rolagem ou gastam ao serem usadas, uma entrada por feature, pelo texto do XPHB.
//   Três formas:
//   - `rider`: um extra que o diálogo da rolagem oferece (o dano do Divine Strike, o
//     d10 do Tactical Mind num teste), com o gasto de um pool ou do espaço do pacto
//     quando a feature gasta (Peerless Skill, Eldritch Smite);
//   - `toggle`: usar a feature liga um efeito (Reckless Attack: vantagem em ataques
//     de FOR até o seu próximo turno);
//   - `use`: usar gasta, rola (`roll`) e mostra a salvaguarda do alvo (Stunning
//     Strike, Commander's Strike, Inspiring Smite);
//   - `passive`: a feature só melhora outra entrada (Improved Blessed Strikes) ou é de
//     outra criatura (Combat Inspiration): fica PASSIVA mesmo com gatilho no texto.
//
// FUNÇÕES
//   featureRollOf(name): a entrada do registro de uma feature, ou null.
//   featureRiders(state, catalog, roll): os extras que valem para uma rolagem, no
//     formato de rollEffects (engine/playEffects).
//   spendKeyOf(catalog, spend): a chave do recurso que a entrada gasta (o pool pelo
//     nome do item, o espaço do pacto, ou um Dado de Vida com `hitDie`: o Health Funnel).
//   riderSpendOps(applied, catalog): as operações do gasto dos extras ligados.
//   amountOf(entry, rollData): quanto a entrada gasta (número, ou { min, max } a escolher).
//   featureUseOf(feature, catalog, chosen, option): o que o "Use" de uma feature `toggle` ou `use`
//     (`option` escolhe entre as `options` da entrada, cada uma com a sua rolagem e salvaguarda);
//     faz: o modificador, o gasto e a salvaguarda.
//   formulaOf(entry, rollData): a fórmula, que pode depender do nível.
//   AZERITE(rd): o dado do Azerite Surge pelo nível do personagem (1d10, 2d10 no 5, 3d10 no 11, 4d10 no 17).
//   SHOT_DIE(n), SHOT_DC(rd), BM_DC(rd): n dados de Arcane Shot do AU, a CD dele (8 + INT + PB)
//     e a CD das manobras (8 + PB + FOR ou DES) (DDL-0237). RUNE_DC(rd): a CD das runas do Rune
//     Knight, 8 + PB + CON (DDL-0238).
//   byLevel(classId, steps), MARTIAL(count): a fórmula pelo nível de uma classe
//     ([[nível, fórmula], ...] do maior ao menor) e N rolagens do dado de Martial Arts.
//   ridersOf(entry): os extras de uma entrada (ela mesma, se for `rider`, e os `also`).
//   noteOf(entry, rollData): a nota, que pode citar uma CD calculada.
//   maneuverDc(rollData), SUPERIORITY(rollData), BARDIC(rollData): a CD das manobras
//     (8 + PB + FOR ou DES) e os dados de superioridade e de inspiração.
//   fits(when, roll): a rolagem casa com o `when` da entrada (arma, FOR, corpo a corpo, magia,
//     qualquer rolagem de FOR).
//   CLERIC_STRIKE(rollData): a fórmula do Divine Strike pela escala do Cleric.
//   norm(s), slug(s): o nome comparável e o pedaço do id do extra.
//
// DECISÕES E ARMADILHAS
//   - A prova de cada entrada é a frase do texto, citada aqui (o corpo não leva
//     comentário). Sneak Attack (a escala do Rogue) e Brutal
//     Strike (a escala do Barbarian, só com FOR) moravam em rollEffects e vieram para
//     cá sem mudar o id (`rider:sneak-attack`). Frenzy: "roll a number of d6s equal to
//     your Rage Damage bonus", com Reckless Attack e Rage, FOR. Divine Fury: "1d6 plus
//     half your Barbarian level", com Rage. Radiant Strikes: "an extra 1d8 Radiant"
//     em todo acerto corpo a corpo, então começa LIGADO. Divine Strike (as versões
//     antigas, o tipo muda por domínio) e Blessed Strikes: 1d8, 2d8 no 14
//     (`@scale.cleric.divine-strike`). Primal Strike: 1d8, 2d8 no 15
//     (`@scale.druid.elemental-fury`). Dreadful Strikes: 1d4, 1d6 no Ranger 11.
//     Colossus Slayer (a opção do Hunter's Prey): 1d8 se o alvo perdeu PV. Eldritch
//     Smite: 1d8 mais 1d8 por círculo do espaço do pacto, que gasta. Peerless Skill:
//     o dado de Bardic Inspiration num teste ou ataque que falhou, gasta um uso.
//     Tactical Mind: 1d10 num teste que falhou, gasta um Second Wind. Reckless
//     Attack: vantagem em ataques de FOR "until the start of your next turn" (1
//     rodada). Stunning Strike: 1 Focus Point, save de CON contra 8 + PB + SAB.
//   - Segunda leva (DDL-0206, do `survey-feature-rolls.js`): manobras sem activity
//     (Goading e Menacing Attack somam o dado ao dano e pedem save de SAB; Ambush soma
//     o dado a Stealth ou à iniciativa; Commander's Strike e Bait and Switch rolam o
//     dado para o aliado ou para a CA), todas gastando Combat Superiority, e o próprio
//     Combat Superiority rola um dado (as manobras que ninguém registrou). Tandem
//     Footwork: o dado de inspiração na iniciativa. Dark One's Own Luck: 1d10 num teste
//     ou save. Boon of Fate: 2d4 num teste d20. Hurl Through Hell: 8d10 psíquico, um uso.
//     Fire's Burn (1d10 fogo) e Frost's Chill (1d6 frio) do Goliath, cada um com o pool
//     dele. Hand of Harm: o dado de Martial Arts mais SAB, desarmado, 1 Focus Point.
//     Charger: 1d8 corpo a corpo depois de andar 10 pés. Lunar Form: 2d10 radiante na
//     forma do Wild Shape. Inspiring Smite: 2d8 + nível de Paladin em PV temporários,
//     um Channel Divinity. Wild Magic Surge: o d20 depois da magia. Passivas: Improved
//     Blessed Strikes, Improved Elemental Fury e Improved Brutal Strike (a escala já
//     sobe o dado), Relentless e Heightened Focus (mudam outras), Combat Inspiration (o
//     dado é de quem o recebe), Pact Magic ("expend a slot" no texto a marcava ativa;
//     os espaços se gastam na aba Spells).
//   - Terceira leva (DDL-0207), os livros fora do XPHB, cada número pela frase do texto:
//     EFA: Alchemical Eruption 2d8 numa magia de Artificer; Lightning Launcher 1d6 do
//     Infiltrator (só o lançador, à distância); Detonate 3d10 do Explosive Cannon;
//     Arcane Jolt 2d6 (4d6 no Artificer 15, Improved Defender), um uso; Shifting
//     (Beasthide) 2 x PB + 1d6 e (Longtooth) 2 x PB em PV temporários. EGW: Reclaim
//     Potential 2d6 + CON temporários; Event Horizon 2d10; Violent Attraction 1d10. FTD:
//     Drake's Breath 8d6 (10d6 no 15); Breath of the Dragon duas rolagens do dado de
//     Martial Arts (três no 11). FRHoF: Group Recovery 1d4 + nível de Fighter; Blessing
//     of Moonlight 2d4; Lunar Vitality o dado de inspiração; Frostbite 1d4; Encourage Ally
//     2d6; Efreeti's Fury 2d4 no Divine Smite; Elemental Rebuke 2d10 + CAR; Fortifying
//     Soul 1d10 + nível de Ranger; Polar Strikes 1d4 (1d6 no 11); Frozen Haunt 2d4.
//     XPHB: Dreadful Strike (`@scale.gloom-stalker.dreadful-strike`, 2d6 sem a escala) e
//     a iniciativa + SAB do Dread Ambusher (`also`, ligada: "you can add"); Uncanny
//     Metabolism devolve TODO o Focus e cura o dado de Martial Arts + nível de Monk;
//     Searing Vengeance 2d8 + CAR. MPMM: Surprise Attack 2d6. RHW: Power from Beyond 1d6
//     numa magia de Bard; Spirits from Beyond o dado de inspiração; Pull of Death 1d4
//     (1d6 no Cleric 11); Hungering Might cura 1d10 + SAB; Knowledge from a Past Life 1d6
//     num teste que falhou; Form of Dread 1d10 + nível de Warlock temporários; Unholy
//     Resuscitation 2d10 + CAR. XGE: as flechas do Arcane Archer 2d6 (4d6 no 18; Piercing
//     1d6 e 2d6), um Arcane Shot; Warding Maneuver 1d8; Favored by the Gods 2d4; os
//     floreios do College of Swords com o dado de inspiração; Planar Warrior 1d8 (2d8 no
//     11); Slayer's Prey 1d6; Kensei's Shot 1d4 à distância; Deft Strike o dado de Martial
//     Arts, 1 Focus; Searing Sunburst 2d6. TCE: Halo of Spores 1d4, 1d6 no 6, 1d8 no 10,
//     1d10 no 14; Symbiotic Entity 4 x nível de Druid temporários, um Wild Shape, e 1d6
//     necrótico no corpo a corpo (`also`); Cauterizing Flames 2d10 + SAB; Unsettling
//     Words o dado de inspiração; Brace o dado de superioridade; Spirit Shield 2d6, 3d6 no
//     10, 4d6 no 14; Infectious Fury 2d12; Wild Surge a tabela de d8; Balm of Peace 2d6 +
//     SAB e Twilight Sanctuary 1d6 + nível de Cleric, um Channel Divinity; Guardian Coil e
//     Tentacle of the Deeps 1d8 (2d8 no Warlock 10); Giant's Might liga vantagem em FOR e
//     1d6 por turno (1d8 no 10, 1d10 no 18) por 1 minuto; Arms of the Astral Self duas
//     rolagens do dado, 1 Focus; Deflect Energy 1d10 + SAB; Gathered Swarm 1d6. SCAG e
//     PHB: Turn the Tide 1d6 + CAR; Touch of the Long Death 2d10 por ponto; Defy Death
//     1d8 + CON e Indestructible Life 1d8 + nível de Warlock (curam); Wrath of the Storm
//     2d8; Vigilant Rebuke 2d8 + CAR. BGG: Elemental Cleaver 1d6 com Rage (2d6 no 14,
//     Demiurgic Colossus). Passivas: Bond of Fang and Scale, Order's Wrath, Great
//     Stature, Runic Juggernaut, Demiurgic Colossus (Improved Defender e Eventide's Splendor
//     viraram `use` no DDL-0235).
//   - Improved Blessed Strikes e Heightened Focus deixaram de ser passivas (DDL-0214): o
//     "Use" dá os PV temporários que o texto conta ("twice your Wisdom modifier" do Potent
//     Spellcasting; "two rolls of your Martial Arts die" do Patient Defense). A escala do
//     Divine Strike e o Flurry de três golpes seguem nas outras entradas.
//   - Quarta leva (DDL-0214, o bônus que a prosa do G3 não lê): Guided Strike e Feat of
//     Strength, "+10 bonus to the roll" com um Channel Divinity (o de Feat of Strength só no
//     que usa FOR, `when: 'strRoll'`); Aura of Hate, o CAR (mínimo +1) no dano de arma corpo
//     a corpo, LIGADA; Alchemical Savant, o INT (mínimo +1) numa rolagem da magia; Arcane
//     Firearm, 1d8 no dano da magia.
//   - O Colossus Slayer genérico (`hunter's prey`, sem a opção conhecida) some quando a ficha
//     guarda a opção ("Hunter's Prey: Giant Killer"): o ranger com Giant Killer recebia o 1d8
//     no dano (passe ao vivo, DDL-0221).
//   - O Frenzy do XPHB (o extra de d6 com Reckless Attack) só vale para o do XPHB: o do PHB
//     (o Berserker antigo no chassi de 2024) é um ataque bônus em Rage, sem dano a mais. O mesmo
//     no Supreme Sneak (o do PHB é vantagem em Stealth, não o Stealth Attack): `xphbOnly`
//     (DDL-0221).
//   - A adaptação do ki (DDL-0224, E3): a subclasse de monge antiga que gastava ki gasta o Focus
//     do Monk's Focus (FOCUS), na quantidade do texto. `amount` é o gasto: um número (o Awakened
//     Astral Self, "spend 5 ki points"), ou { min, max } que o "Use" pergunta (Touch of the Long
//     Death "1 to 10", Sharpen the Blade "up to 3", Searing Sunburst até 3, Searing Arc Strike
//     de 2 até metade do nível de monge); a fórmula recebe o gasto (`formulaOf(entry, rd, n)`:
//     2d10 por ponto, 2d6 + 2d6 por ponto, o Burning Hands no nível 1 + cada ponto além de 2).
//     A CD é a do ki (8 + PB + SAB), a mesma do Stunning Strike.
//     Mastery of Death ("expend 1 ki point ... to have 1 hit point instead") cura 1. O gasto
//     alternativo quando o próprio pool acabou (o Breath of the Dragon "spend 2 ki points to use
//     this feature again", o Aspect of the Wyrm "3 ki points", e o Ascendant Aspect, 1 ponto que
//     melhora o sopro) fica no ajuste à mão do contador (DDL-0202).
//   - TC-0164 (DDL-0236): o Murderous Intent do Dread Incarnate é um piso só nos dados do Sneak
//     Attack (`forgoableMin`, a parte marcada `forgoable`), não na rolagem inteira como o `diceMin`.
//   - As opções de classe (DDL-0237, a camada `options` do registro de features): os Arcane Shots
//     do AU ("... Shot", o dado da escala `arcane-archer.arcane-shot`, CD 8 + INT + PB; os "...
//     Arrow" do XGE ficam para as fichas antigas), o Agonizing Blast (`when: 'cantrip'`, o CAR
//     no dano do cantrip, ligado), e as manobras que somam o dado de superioridade no ataque, no
//     dano ou no teste (`when` como lista de perícias: Commanding Presence, Tactical Assessment,
//     Grappling Strike), com a CD 8 + PB + FOR ou DES; Sweeping Attack e Heroic Leap no Use.
//   - As 69 com dado fora do SRD (DDL-0239), cada uma pela frase do texto: Order's Wrath (2d8 do aliado),
//     Improved Warding Flare (2d6 + SAB de temporários ao alvo), Eye for Weakness (3d6 no Sneak Attack),
//     a Psychic Blades do College of Whispers (`has`: só bardo; o FEATURE_ATTACKS do Soulknife só
//     ladino), Dread Lord, Ascendant Aspect, Lunar Phenomenon e Azerite Surge com `options`, Poisonous
//     Skin, Cohort of Chaos (o d4 da tabela), Spellfire Spark (a redução), o veneno da mordida das
//     Natural Weapons, o Gathered Swarm em 1d8 com o Mighty Swarm, e o dado de superioridade do
//     Summon Wildfire Spirit (o 2d6 da chegada; o summon não tem activity), o Acid Spit do Simic
//     Hybrid (só com a opção escolhida, `optionPicks` do catálogo), o dado de superioridade do
//     Martial Adept e do Superior Technique (d6 sem a escala do Battle Master; o pool deles, `alt` no SUP).
//   - TC-0170 (DDL-0243): Elemental Adept (o 1 conta como 2 no dano de magia, ligado; o tipo escolhido no
//     builder vai na nota) e Aura of Elemental Shielding (`toggle` com `options`, cada uma com o seu
//     modificador: o "Use" pergunta o tipo e liga a resistência).
//   - TC-0169 (DDL-0242): o Hexblade's Curse soma a proficiência no dano contra o alvo amaldiçoado (desligado,
//     o jogador liga quando o alvo é o amaldiçoado); o resto da família da arma está em engine/playWeapons.
//   - TC-0166 e TC-0167 (DDL-0238): o Fire Rune soma 2d6 de fogo no dano de arma e gasta o pool da
//     runa (CD 8 + PB + CON); o Gift of the Ever-Living Ones é um interruptor com `healMax` (o
//     familiar a 100 pés); o Health Funnel gasta Dados de Vida (`spend.hitDie`, quantos o jogador
//     escolher) e rola os temporários do familiar, que o jogador põe no cartão dele.
//     `targets` (Agonizing Blast, DDL-0240): com cantrips escolhidas no builder (`catalog.optionTargets`),
//     o extra só vale nelas (`roll.spellName`); sem escolha (ficha antiga), em toda cantrip.
//     `when: 'pact'` (Eldritch Smite, Lifedrinker) vale só no ataque da arma de pacto
//     (engine/playPact.js), achado no passe ao vivo do warlock: antes aparecia em qualquer arma.
//   - As famílias pós-2024 (DDL-0235), cada uma pela frase do texto: Raging Elements com `options`
//     (o Use pergunta Icefury, Lava Burst ou Lightning Bolt; os dados são o Rage Damage em d8, d4 e
//     d6), Spiritual Protectors (1d4 na fúria), Experimental Elixir (1d6 da tabela), Adventurer's
//     Atlas (1d4 na Iniciativa), Improved Reanimation (4d4), Improved Defender (1d4 + INT), Fortifying
//     e Tenacious Spell, Eventide's Splendor, Lightbringer's Aura, Aura of Malevolence, Radiant Fire
//     (1d8 no 14 pelo Honed Spellfire), Absorb Spells, as opções novas do Cunning Strike (Panache,
//     Dashing Strikes) e Superior Dread (um interruptor com as resistências, junto da Form of Dread).
//   - As famílias do XPHB (DDL-0232): Elemental Epitome (o Martial Arts die no desarmado),
//     Envenom Weapons (2d6 de veneno no Use), Homing Strikes e Psi-Bolstered Knack (um dado de
//     Psionic Energy depois de errar ou falhar; `scale.soulknife.die.die`, porque `.die` traz o
//     número de dados do pool), Chalice (a cura pela escala da Starry Form, 2d8 no 10).
//   - O registro de features no XPHB (DDL-0231): Relentless do Battle Master devolve um Superiority
//     Die na Iniciativa (`restoreUpTo` 1), Guarded Mind gasta um dado de Psionic Power, Portent rola
//     2d20 depois do descanso longo e Greater Portent 3d20 (o "Use" de cada um).
//   - O registro de features no SRD (DDL-0228, TC-0152): Perfect Focus devolve o Focus até 4
//     (`restoreUpTo`), no "Use" quando o jogador rola a Iniciativa.
//   - A camada legado do registro de features (DDL-0253), pelo texto de cada um: os números que só a prosa
//     dava (Sun Shield 5 + SAB, Pyromancer's Fury e Storm's Fury o nível de feiticeiro, Heart of Fire, Scornful
//     Rebuke, Deflecting Shroud, Aura of Conquest, Guardian Spirit, Spiked Retribution), a tabela do Wild Magic
//     (Unstable Backlash, a segunda rolagem do Controlled Surge), Bolstering Magic e Aspect of the Wyrm por
//     opções (a resistência escolhida é o modificador da opção), Balm of the Summer Court e Call the Hunt por
//     `amount`, Fighting Spirit com temporários e vantagem; riders Genie's Wrath (`when: 'attackRoll'`, qualquer
//     acerto de rolagem de ataque), Power Surge (pool próprio) e Enhanced Bond.
//   - O legado no passe ao vivo (DDL-0226), pelo texto de cada um: Storm Aura de mar ("1d6
//     lightning", 2d6 no 10, 3d6 no 15, 4d6 no 20, CD 8 + PB + CON) e de tundra (2 temporários,
//     3 no 5, 4 no 10, 5 no 15, 6 no 20); Master's Flourish ("roll a d6 and use it instead of
//     expending a Bardic Inspiration die"); Supernatural Defense ("add 1d6 to your roll" contra
//     o alvo do Slayer's Prey); Improved Pact Weapon (o +1 saiu daqui no DDL-0236: mora no ataque da
//     arma de pacto, engine/playPact.js);
//     Lifedrinker do XPHB (1d6 uma vez por turno; o Dado de Vida que cura sai pelo card de PV).
//     O Great Stature e o Runic Juggernaut só sobem o dado do Giant's Might (byLevel).
//   - Oitava leva (DDL-0221, o passe ao vivo): Great Weapon Fighting do XPHB ("you can treat
//     any 1 or 2 on a damage die as a 3", com uma arma corpo a corpo nas duas mãos), `diceMin`
//     3: LIGADO na arma Two-Handed (`when: 'twoHandedMelee'`) e oferecido desligado na
//     Versatile (`versatileMelee`), porque só vale com ela nas duas mãos. O export já punha o
//     `min3` na arma (greatWeaponMinimum); o jogo não o lia.
//   - Sétima leva (DDL-0218, achada pelos personagens modelo): Storm's Thunder ("1d8
//     Thunder damage" na reação) e Stone's Endurance ("1d12 plus your Constitution modifier"
//     de dano reduzido) do Goliath, com o pool de cada um; Colossus Slayer do Hunter antigo
//     (o 1d8 da opção, que no XPHB fica no Hunter's Prey); Multiattack Defense do Hunter
//     antigo ("a +4 bonus to AC against all subsequent attacks made by that creature for
//     the rest of the turn"), um `toggle` de 1 rodada com a nota do alvo.
//   - Sexta leva (DDL-0217, as features de dado do SRD): Cunning Strike (Poison, Trip,
//     Withdraw, 1d6 cada), Devious Strikes (Daze 2d6, Knock Out 6d6, Obscure 3d6) e o
//     Stealth Attack do Supreme Sneak (1d6): "Each effect has a die cost, which is the number
//     of Sneak Attack damage dice you must forgo"; o extra leva `forgo` e o Sneak Attack é
//     `forgoable`, e rollDamageEvent tira os dados da parte do Sneak Attack (`forgoDice`). A
//     CD é 8 + DES + PB (ROGUE_DC). Use Magic Device: o "Use" rola o d6 das cargas ("On a roll
//     of 6, you use the property without expending the charges"). Arcane Eloquence: Smooth
//     Talker, 1d4 em Deception, Intimidation e Persuasion (`when: 'social'`), LIGADO.
//   - Quinta leva (DDL-0215, as famílias em aberto do levantamento): Agile Parry (+2 CA até o
//     seu próximo turno), Awakened Astral Self (+2 CA, 10 minutos) e Revenant Blade (+1 CA com
//     a cimitarra de duas lâminas nas duas mãos) são `toggle` com `ac`; Devouring Plague
//     (1d10), Touch of the Grave (PB d4) e Blood Thirst (1d6) curam o dano necrótico que
//     causam ("you regain Hit Points equal to the Necrotic damage dealt"), então o "Use" rola
//     e cura o mesmo número; Fists of Fury (Clean Hits: "treat any 1 on a damage die as a
//     2", `diceMin`, aplicado por rollDamageEvent); Soul of Artifice do TCE (+1 por item
//     atunado, `@attunement.value`; o do EFA não tem bônus); Conjuration Adept (o
//     modificador do atributo que o talento aumentou, `@featAbility`, na concentração).
//   - Savage Attacker (DDL-0210): "roll the weapon's damage dice twice and use either
//     roll"; o extra não soma parte, liga `twice` e o dado da arma vira `max(dado,
//     dado)` (damageParts em engine/playActions), com o grupo perdedor riscado no card.
//     `when: 'armed'`: arma, não o desarmado (que não é arma em 2024). O feat de 2014
//     tem o mesmo nome e vale só corpo a corpo: fica na nota.
//   - A feature fora do registro com cura ou PV temporários na prosa (`catalog.proseUses`,
//     engine/playProseEffects, DDL-0214) ganha o mesmo "Use" de `apply` por featureUseOf.
//   - `apply` ('heal' ou 'temp') faz o "Use" curar ou dar PV temporários com o total
//     rolado, pelas mesmas regras do card de HP (healOutcome, tempHpOutcome: o temporário
//     não soma). `restore` devolve todo o gasto de um pool (Uncanny Metabolism).
//   - Ficaram de fora, de propósito, as que trocam o próprio ataque ou dependem de uma
//     escolha que o app não guarda (Strike of the Giants, Fey Gift, Vampiric Bite, Form of
//     the Beast, as armas do Armorer, Psychic Blades), as de tabela sem dado conhecido
//     (Experimental Elixir, Mythal Touched) e as que não rolam para o personagem
//     (Overchannel, Limited Wish, Ghost Walk, Umbral Form): `survey-feature-rolls.js` as
//     lista.
//   - O extra começa DESLIGADO (o jogador decide, uma vez por turno) salvo
//     `defaultOn`. "Uma vez por turno" fica na nota: o app não conta.
//   - `needs: 'Rage'` só oferece o extra com a Rage ligada (o modificador de nome
//     Rage): a regra é inequívoca, então esconde (§6.4).
//   - O gasto do extra entra no MESMO evento da rolagem (`riderSpendOps`, chamado por
//     `roll` em pages/Play.jsx) e só quando o jogador o liga. Sem o que gastar, o extra
//     aparece com "(none left)" e pode ser ligado assim mesmo (liberdade com aviso).
//     Peerless Skill e Tactical Mind dizem que o uso não se gasta se ainda falhar: o
//     app gasta, e o desfazer devolve.
//   - Uma família nova entra aqui com a frase como prova; `survey-play-catalog.js`
//     não a vê, o teste deste arquivo segura as fórmulas.
// -----------------------------------------------------------------------------

import { rollFormula } from './dice';
import { remainingOf } from './playState';

const maneuverDc = (rd) => 8 + (rd.prof ?? 0) + Math.max(rd.abilities?.str?.mod ?? 0, rd.abilities?.dex?.mod ?? 0);
const SUPERIORITY = (rd) => `1${rd['scale.battle-master.superiority.die'] ?? 'd6'}`;
const BARDIC = (rd) => (rd['scale.bard.inspiration'] ? '@scale.bard.inspiration' : '1d6');
const SUP = { item: 'Combat Superiority', alt: ['Martial Adept', 'Superior Technique'] };

const byLevel = (classId, steps) => (rd) => {
  const level = rd.classes?.[classId]?.levels ?? 0;
  return (steps.find(([lv]) => level >= lv) ?? steps[steps.length - 1])[1];
};
const MARTIAL = (count) => (rd) => Array.from({ length: typeof count === 'function' ? count(rd) : count }, () => (rd['scale.monk.die'] ? '@scale.monk.die' : '1d6')).join(' + ');
const BI = { item: 'Bardic Inspiration' };
const CD = { item: 'Channel Divinity' };
const FOCUS = { item: "Monk's Focus" };
const SHOT = { item: 'Arcane Shot' };
const ARROW = byLevel('fighter', [[18, '4d6'], [0, '2d6']]);

const ROGUE_DC = (rd) => 8 + (rd.prof ?? 0) + (rd.abilities?.dex?.mod ?? 0);
const SHOT_DIE = (n) => (rd) => `${n}${rd['scale.arcane-archer.arcane-shot.die'] ?? 'd6'}`;
const SHOT_DC = (rd) => 8 + (rd.prof ?? 0) + (rd.abilities?.int?.mod ?? 0);
const AZERITE = (rd) => { const l = rd.details?.level ?? 1; return `${1 + (l >= 5) + (l >= 11) + (l >= 17)}d10`; };
const RUNE_DC = (rd) => 8 + (rd.prof ?? 0) + (rd.abilities?.con?.mod ?? 0);
const BM_DC = (rd) => 8 + (rd.prof ?? 0) + Math.max(rd.abilities?.str?.mod ?? 0, rd.abilities?.dex?.mod ?? 0);

const CLERIC_STRIKE = (rd) => (rd['scale.cleric.divine-strike'] ? '@scale.cleric.divine-strike' : '1d8');

/** A entrada vale só para a feature do XPHB com esse nome (a do PHB de mesmo nome é outra regra). */
const xphbOnly = (name) => (c) => (c.featureList ?? []).some((f) => f.name === name && f.source === 'XPHB');

export const FEATURE_ROLLS = {
  'sneak attack': { kind: 'rider', on: ['damage'], when: 'weapon', has: (c) => !!c.rollData?.['scale.rogue.sneak-attack'], formula: '@scale.rogue.sneak-attack', forgoable: true, note: 'once per turn, Finesse or Ranged, with Advantage or an ally next to the target' },
  'cunning strike': {
    kind: 'rider', on: ['damage'], when: 'weapon', forgo: 1, label: 'Cunning Strike: Poison (1d6 of Sneak Attack)',
    note: (rd) => `with Sneak Attack; DC ${ROGUE_DC(rd)} Constitution save or Poisoned for 1 minute (save again at the end of each of its turns)`,
    also: [
      { on: ['damage'], when: 'weapon', forgo: 1, label: 'Cunning Strike: Trip (1d6 of Sneak Attack)', note: (rd) => `with Sneak Attack; a Large or smaller target makes a DC ${ROGUE_DC(rd)} Dexterity save or has the Prone condition` },
      { on: ['damage'], when: 'weapon', forgo: 1, label: 'Cunning Strike: Withdraw (1d6 of Sneak Attack)', note: 'with Sneak Attack; you move up to half your Speed without provoking Opportunity Attacks' },
    ],
  },
  'devious strikes': {
    kind: 'rider', on: ['damage'], when: 'weapon', forgo: 2, label: 'Devious Strikes: Daze (2d6 of Sneak Attack)',
    note: (rd) => `with Sneak Attack; DC ${ROGUE_DC(rd)} Constitution save or, on its next turn, only one of a move, an action or a Bonus Action`,
    also: [
      { on: ['damage'], when: 'weapon', forgo: 6, label: 'Devious Strikes: Knock Out (6d6 of Sneak Attack)', note: (rd) => `with Sneak Attack; DC ${ROGUE_DC(rd)} Constitution save or Unconscious for 1 minute or until it takes damage` },
      { on: ['damage'], when: 'weapon', forgo: 3, label: 'Devious Strikes: Obscure (3d6 of Sneak Attack)', note: (rd) => `with Sneak Attack; DC ${ROGUE_DC(rd)} Dexterity save or Blinded until the end of its next turn` },
    ],
  },
  'supreme sneak': { kind: 'rider', on: ['damage'], when: 'weapon', has: xphbOnly('Supreme Sneak'), forgo: 1, label: 'Stealth Attack (1d6 of Sneak Attack)', note: "with Sneak Attack; the Hide action's Invisible condition stays if you end the turn behind Three-Quarters or Total Cover" },
  'use magic device': { kind: 'use', roll: { label: 'Charges: on a 6, none are spent', formula: '1d6' } },
  'arcane eloquence': { kind: 'rider', on: ['check'], when: 'social', defaultOn: true, formula: '1d4', label: 'Smooth Talker', note: 'Deception, Intimidation or Persuasion' },
  'brutal strike': { kind: 'rider', on: ['damage'], when: 'str', has: (c) => !!c.rollData?.['scale.barbarian.brutal-strike'], formula: '@scale.barbarian.brutal-strike', note: 'only if you gave up Advantage on the attack' },
  frenzy: { kind: 'rider', on: ['damage'], when: 'str', needs: 'Rage', has: xphbOnly('Frenzy'), formula: (rd) => `${rd['scale.barbarian.rage-damage'] ?? 2}d6`, note: 'with Reckless Attack, the first target you hit this turn' },
  'divine fury': { kind: 'rider', on: ['damage'], when: 'weapon', needs: 'Rage', formula: '1d6 + floor(@classes.barbarian.levels / 2)', note: 'first creature you hit on each turn; Necrotic or Radiant' },
  'radiant strikes': { kind: 'rider', on: ['damage'], when: 'melee', defaultOn: true, formula: '1d8', label: 'Radiant Strikes (radiant)', note: 'every hit with a Melee weapon or an Unarmed Strike' },
  'blessed strikes: divine strike': { kind: 'rider', on: ['damage'], when: 'weapon', formula: CLERIC_STRIKE, label: 'Divine Strike', note: 'once on each of your turns; Necrotic or Radiant' },
  'divine strike': { kind: 'rider', on: ['damage'], when: 'weapon', formula: CLERIC_STRIKE, note: 'once on each of your turns; the damage type is in the feature' },
  'elemental fury: primal strike': { kind: 'rider', on: ['damage'], when: 'weapon', formula: (rd) => (rd['scale.druid.elemental-fury'] ? '@scale.druid.elemental-fury' : '1d8'), label: 'Primal Strike', note: 'once on each of your turns; Cold, Fire, Lightning or Thunder' },
  'dreadful strikes': { kind: 'rider', on: ['damage'], when: 'weapon', formula: (rd) => ((rd.classes?.ranger?.levels ?? 0) >= 11 ? '1d6' : '1d4'), note: 'Psychic; a target takes it only once per turn' },
  "hunter's prey": { kind: 'rider', on: ['damage'], when: 'weapon', has: (c) => (c.features ?? []).includes("hunter's prey") && !(c.features ?? []).some((f) => f.startsWith("hunter's prey: ")), formula: '1d8', label: 'Colossus Slayer', note: 'only with the Colossus Slayer option, if the target is missing Hit Points; once per turn' },
  "hunter's prey: colossus slayer": { kind: 'rider', on: ['damage'], when: 'weapon', formula: '1d8', label: 'Colossus Slayer', note: 'if the target is missing Hit Points; once per turn' },
  'eldritch smite': { kind: 'rider', on: ['damage'], when: 'pact', spend: { pact: true }, formula: (rd) => `${1 + (rd.spells?.pact?.level ?? 1)}d8`, note: 'pact weapon, once per turn; Force; a Huge or smaller target can be knocked Prone' },
  'peerless skill': { kind: 'rider', on: ['check', 'attack'], spend: { item: 'Bardic Inspiration' }, formula: (rd) => (rd['scale.bard.inspiration'] ? '@scale.bard.inspiration' : '1d6'), note: 'after you fail; not spent if it still fails' },
  'tactical mind': { kind: 'rider', on: ['check'], spend: { item: 'Second Wind' }, formula: '1d10', note: 'after you fail the check; not spent if it still fails' },
  'reckless attack': {
    kind: 'toggle',
    modifier: () => ({
      label: 'Reckless Attack',
      source: 'feature',
      duration: 'manual',
      maxRounds: 1,
      notes: ['Attack rolls against you have Advantage'],
      effects: [{ targets: ['attack'], mode: 'advantage', when: 'strAttack', label: 'Reckless Attack' }],
    }),
  },
  'stunning strike': { kind: 'use', spend: { item: "Monk's Focus" }, save: { ability: 'con', dc: '8 + @prof + @abilities.wis.mod' } },
  'goading attack': { kind: 'rider', on: ['damage'], spend: SUP, formula: SUPERIORITY, note: (rd) => `the target makes a DC ${maneuverDc(rd)} Wisdom save or has Disadvantage against others` },
  'menacing attack': { kind: 'rider', on: ['damage'], spend: SUP, formula: SUPERIORITY, note: (rd) => `the target makes a DC ${maneuverDc(rd)} Wisdom save or is Frightened` },
  ambush: { kind: 'rider', on: ['check', 'initiative'], when: 'stealth', spend: SUP, formula: SUPERIORITY, note: 'Stealth checks and Initiative' },
  "commander's strike": { kind: 'use', spend: SUP, roll: { label: "Ally's damage bonus", formula: SUPERIORITY } },
  'bait and switch': { kind: 'use', spend: SUP, roll: { label: 'AC bonus until your next turn', formula: SUPERIORITY } },
  'combat superiority': { kind: 'use', spend: SUP, roll: { label: 'Superiority Die', formula: SUPERIORITY } },
  'tandem footwork': { kind: 'rider', on: ['initiative'], spend: { item: 'Bardic Inspiration' }, formula: BARDIC, note: 'also for each ally within 30 feet' },
  "dark one's own luck": { kind: 'rider', on: ['check', 'save'], spend: { item: "Dark One's Own Luck" }, formula: '1d10', note: 'after seeing the roll; once per roll' },
  'boon of fate': { kind: 'rider', on: ['attack', 'check', 'save'], spend: { item: 'Boon of Fate' }, formula: '2d4', label: 'Improve Fate', note: 'a bonus or a penalty; again after Initiative or a rest' },
  'hurl through hell': { kind: 'rider', on: ['damage'], spend: { item: 'Hurl Through Hell' }, formula: '8d10', note: 'once per turn; Charisma save against your spell save DC; Psychic, not against a Fiend' },
  "fire's burn": { kind: 'rider', on: ['damage'], spend: { item: "Fire's Burn" }, formula: '1d10', note: 'Fire' },
  "storm's thunder": { kind: 'use', spend: { item: "Storm's Thunder" }, roll: { label: 'Thunder damage to the creature that damaged you', formula: '1d8' } },
  "stone's endurance": { kind: 'use', spend: { item: "Stone's Endurance" }, roll: { label: 'Damage reduced', formula: '1d12 + @abilities.con.mod' } },
  'colossus slayer': { kind: 'rider', on: ['damage'], when: 'weapon', formula: '1d8', note: 'if the target is missing Hit Points; once per turn' },
  'multiattack defense': { kind: 'toggle', modifier: () => ({ label: 'Multiattack Defense', source: 'feature', duration: 'manual', maxRounds: 1, ac: 4, notes: ['only against the creature that hit you, for the rest of the turn'], effects: [] }) },
  'defensive tactics: multiattack defense': { kind: 'toggle', modifier: () => ({ label: 'Multiattack Defense', source: 'feature', duration: 'manual', maxRounds: 1, ac: 4, notes: ['only against the creature that hit you, for the rest of the turn'], effects: [] }) },
  "frost's chill": { kind: 'rider', on: ['damage'], spend: { item: "Frost's Chill" }, formula: '1d6', note: 'Cold; the target loses 10 feet of Speed until your next turn' },
  'hand of harm': { kind: 'rider', on: ['damage'], when: 'unarmed', spend: { item: "Monk's Focus" }, formula: '@scale.monk.die + @abilities.wis.mod', note: 'once per turn; Necrotic' },
  charger: { kind: 'rider', on: ['damage'], when: 'melee', formula: '1d8', label: 'Charge Attack', note: 'after moving 10 feet straight at the target, once per turn (or push it instead)' },
  'lunar form': { kind: 'rider', on: ['damage'], formula: '2d10', label: 'Improved Lunar Radiance', note: "once per turn, with a Wild Shape form's attack; Radiant" },
  'inspiring smite': { kind: 'use', spend: { item: 'Channel Divinity' }, roll: { label: 'Temporary Hit Points to share', formula: '2d8 + @classes.paladin.levels' } },
  'wild magic surge': { kind: 'use', roll: { label: 'd20 (on a 20, roll on the table)', formula: '1d20' } },
  'improved blessed strikes': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points (Potent Spellcasting)', formula: '2 * @abilities.wis.mod' } },
  'improved elemental fury': { kind: 'passive' },
  'improved brutal strike (2)': { kind: 'passive' },
  relentless: { kind: 'use', restore: SUP, restoreUpTo: 1, note: 'when you roll Initiative with no Superiority Dice left' },
  'guarded mind': { kind: 'use', spend: { item: 'Psionic Power' }, note: 'ends every Charmed and Frightened condition on you' },
  'elemental epitome': { kind: 'rider', on: ['damage'], when: 'unarmed', formula: '@scale.monk.die', label: 'Empowered Strikes (Elemental Epitome)', note: 'once on each of your turns, while Elemental Attunement is active; the type of the strike' },
  'envenom weapons': { kind: 'use', roll: { label: 'Poison when the target fails the Poison save (ignores Resistance)', formula: '2d6' } },
  'homing strikes': { kind: 'rider', on: ['attack'], when: 'weapon', spend: { item: 'Psionic Power' }, formula: (rd) => `1${rd['scale.soulknife.die.die'] ?? 'd6'}`, note: 'Psychic Blade only, after a miss; not spent if it still misses' },
  'psi-bolstered knack': { kind: 'rider', on: ['check'], spend: { item: 'Psionic Power' }, formula: (rd) => `1${rd['scale.soulknife.die.die'] ?? 'd6'}`, note: 'after you fail with a proficient skill or tool; not spent if it still fails' },
  chalice: { kind: 'use', roll: { label: 'Chalice: healing to you or a creature within 30 feet', formula: (rd) => `${rd['scale.stars.die'] ? '@scale.stars.die' : '1d8'} + @abilities.wis.mod` } },
  portent: { kind: 'use', roll: { label: 'Portent: keep each number to replace a d20 Test (the total does not matter)', formula: '2d20' } },
  'greater portent': { kind: 'use', roll: { label: 'Greater Portent: keep each number to replace a d20 Test (the total does not matter)', formula: '3d20' } },
  'perfect focus': { kind: 'use', restore: FOCUS, restoreUpTo: 4, note: 'when you roll Initiative without using Uncanny Metabolism' },
  'heightened focus': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points (Patient Defense)', formula: MARTIAL(2) } },
  'combat inspiration': { kind: 'passive' },
  'pact magic': { kind: 'passive' },
  'chemical mastery': { kind: 'rider', on: ['damage'], when: 'spell', formula: '2d8', label: 'Alchemical Eruption', note: 'an Artificer spell dealing Acid, Fire or Poison; once per turn; Force' },
  infiltrator: { kind: 'rider', on: ['damage'], when: 'ranged', formula: '1d6', label: 'Lightning Launcher', note: 'with the launcher only; once per turn; Lightning' },
  'armor model: infiltrator': { kind: 'rider', on: ['damage'], when: 'ranged', formula: '1d6', label: 'Lightning Launcher', note: 'with the launcher only; once per turn; Lightning' },
  'explosive cannon': { kind: 'use', roll: { label: 'Detonate: Force within 20 feet (Dexterity save, half on success)', formula: '3d10' } },
  'arcane jolt': { kind: 'rider', on: ['damage'], when: 'weapon', spend: { item: 'Arcane Jolt' }, formula: byLevel('artificer', [[15, '4d6'], [0, '2d6']]), note: 'a magic weapon or your Steel Defender; or heal that much instead; once per turn; Force' },
  'improved defender': { kind: 'use', roll: { label: 'Force to the attacker (Improved Deflection, with the Deflect Attack)', formula: '1d4 + @abilities.int.mod' } },
  'shifting (beasthide)': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points', formula: '2 * @prof + 1d6' } },
  'shifting (longtooth)': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points', formula: '2 * @prof' } },
  'reclaim potential': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points', formula: '2d6 + @abilities.con.mod' } },
  'event horizon': { kind: 'use', roll: { label: 'Force to a hostile creature starting its turn within 30 feet (Strength save, half on success)', formula: '2d10' } },
  'violent attraction': { kind: 'use', roll: { label: "Extra damage to the attack's target (2d10 for a fall)", formula: '1d10' } },
  'bond of fang and scale': { kind: 'passive' },
  "drake's breath": { kind: 'use', roll: { label: 'Breath damage (Dexterity save, half on success)', formula: byLevel('ranger', [[15, '10d6'], [0, '8d6']]) } },
  'breath of the dragon': { kind: 'use', roll: { label: 'Breath damage (Dexterity save, half on success)', formula: MARTIAL((rd) => ((rd.classes?.monk?.levels ?? 0) >= 11 ? 3 : 2)) } },
  'group recovery': { kind: 'use', roll: { label: 'Healing for each chosen ally', formula: '1d4 + @classes.fighter.levels' } },
  'blessing of moonlight': { kind: 'use', roll: { label: 'Healing for another creature', formula: '2d4' } },
  "moon's inspiration": { kind: 'use', spend: BI, roll: { label: 'Extra healing (Lunar Vitality)', formula: BARDIC } },
  "eventide's splendor": { kind: 'use', roll: { label: 'Vibrance of the Full Moon: in place of a Bardic Inspiration die (Lunar Vitality)', formula: '1d6' } },
  'cold caster': { kind: 'use', roll: { label: 'Subtracted from its next saving throw (Frostbite)', formula: '1d4' } },
  'purple dragon commandant': { kind: 'use', roll: { label: "Ally's Temporary Hit Points (add the feat's ability modifier)", formula: '2d6' } },
  "efreeti's fury": { kind: 'rider', on: ['damage'], when: 'spell', formula: '2d4', note: 'with Divine Smite; a second creature within 30 feet takes 2d4 too; Fire' },
  'elemental rebuke': { kind: 'use', roll: { label: "Attacker's damage (Dexterity save, half on success)", formula: '2d10 + @abilities.cha.mod' } },
  'fortifying soul': { kind: 'use', roll: { label: 'Healing for each chosen creature', formula: '1d10 + @classes.ranger.levels' } },
  'frigid explorer': { kind: 'rider', on: ['damage'], when: 'weapon', formula: byLevel('ranger', [[11, '1d6'], [0, '1d4']]), label: 'Polar Strikes', note: 'Cold; a target takes it only once per turn' },
  'frozen haunt': { kind: 'use', roll: { label: 'Cold to each chosen creature within 15 feet', formula: '2d4' } },
  'dread ambusher': {
    kind: 'rider',
    on: ['damage'],
    when: 'weapon',
    spend: { item: 'Dread Ambusher' },
    formula: (rd) => (rd['scale.gloom-stalker.dreadful-strike'] ? '@scale.gloom-stalker.dreadful-strike' : '2d6'),
    label: 'Dreadful Strike',
    note: 'once per turn; Psychic',
    also: [{ on: ['initiative'], formula: '@abilities.wis.mod', label: 'Dread Ambusher', defaultOn: true, note: 'Initiative Bonus' }],
  },
  'uncanny metabolism': { kind: 'use', apply: 'heal', restore: FOCUS, roll: { label: 'Hit Points regained', formula: '@scale.monk.die + @classes.monk.levels' } },
  'searing vengeance': { kind: 'use', roll: { label: 'Radiant to each chosen creature within 30 feet', formula: '2d8 + @abilities.cha.mod' } },
  'surprise attack': { kind: 'rider', on: ['damage'], formula: '2d6', note: "a creature that hasn't taken a turn yet in this combat" },
  'empowered channeling': { kind: 'rider', on: ['damage'], when: 'spell', formula: '1d6', label: 'Power from Beyond', note: 'a Bard spell cast with a slot; once per turn' },
  'spirits from beyond': { kind: 'use', spend: BI, roll: { label: 'Spirits from Beyond table', formula: BARDIC } },
  'circle of mortality': { kind: 'rider', on: ['damage'], formula: byLevel('cleric', [[11, '1d6'], [0, '1d4']]), label: 'Pull of Death', note: 'a creature missing Hit Points; once per turn; Necrotic' },
  'hungering might': { kind: 'use', apply: 'heal', roll: { label: 'Hit Points regained (Bloodied, transformed)', formula: '1d10 + @abilities.wis.mod' } },
  'knowledge from a past life': { kind: 'rider', on: ['check'], spend: { item: 'Knowledge from a Past Life' }, formula: '1d6', note: 'after you fail the check' },
  'dread incarnate': { kind: 'rider', on: ['damage'], when: 'weapon', forgoableMin: 3, defaultOn: true, label: 'Murderous Intent (Sneak Attack: a 1 or 2 counts as 3)', note: 'only the Sneak Attack dice' },
  'raging elements': {
    kind: 'use',
    options: [
      { label: 'Icefury', roll: { label: 'Icefury: Cold on a hit (spell attack with Constitution); the next Fire damage it takes adds 1d10', formula: (rd) => `${rd['scale.barbarian.rage-damage'] ?? 2}d8` } },
      { label: 'Lava Burst', save: { ability: 'dex', dc: '8 + @prof + @abilities.con.mod' }, roll: { label: 'Lava Burst: Fire on a failed save; the next Lightning damage it takes adds 1d8', formula: (rd) => `${rd['scale.barbarian.rage-damage'] ?? 2}d4` } },
      { label: 'Lightning Bolt', save: { ability: 'dex', dc: '8 + @prof + @abilities.con.mod' }, roll: { label: 'Lightning Bolt: Lightning, half on a success; the next Cold damage it takes adds 1d6', formula: (rd) => `${rd['scale.barbarian.rage-damage'] ?? 2}d6` } },
    ],
  },
  'spiritual protectors': { kind: 'rider', on: ['damage'], when: 'weapon', needs: 'Rage', formula: '1d4', label: 'Spiritual Protectors: Strike', note: 'Cold, Fire or Lightning; or Distract or Hinder instead' },
  'experimental elixir': { kind: 'use', roll: { label: 'Experimental Elixir table (one roll for each elixir)', formula: '1d6' } },
  "adventurer's atlas": { kind: 'rider', on: ['initiative'], formula: '1d4', defaultOn: true, label: "Adventurer's Atlas: Awareness", note: 'while you carry your magical map' },
  'improved reanimation': { kind: 'use', roll: { label: 'Death Burst of the Reanimated Companion (Necrotic ignores Resistance)', formula: '4d4' } },
  'fortifying spell': { kind: 'use', roll: { label: 'Temporary Hit Points for one target of the spell', formula: '2d8 + @classes.cleric.levels' } },
  'tenacious spell': { kind: 'use', roll: { label: "Subtracted from the target's first save against the spell's effect", formula: '1d6' } },
  "lightbringer's aura": { kind: 'use', roll: { label: 'Extra healing for a Bloodied creature in your Aura of Protection', formula: '1d6' } },
  'aura of malevolence': { kind: 'use', roll: { label: 'Damage to each chosen creature near your teleport (ignores Resistance)', formula: '@abilities.int.mod' } },
  'radiant fire': { kind: 'use', roll: { label: 'Fire or Radiant to one creature within 30 feet', formula: byLevel('sorcerer', [[14, '1d8'], [0, '1d4']]) } },
  'absorb spells': { kind: 'use', roll: { label: 'Sorcery Points regained (a target failed the save against your Counterspell)', formula: '1d4' } },
  panache: {
    kind: 'rider', on: ['damage'], when: 'weapon', forgo: 1, label: 'Cunning Strike: Goad (1d6 of Sneak Attack)', note: (rd) => `with Sneak Attack; DC ${ROGUE_DC(rd)} Wisdom save or Disadvantage against others than you`,
    also: [{ on: ['damage'], when: 'weapon', forgo: 3, label: 'Cunning Strike: Awe (3d6 of Sneak Attack)', note: (rd) => `with Sneak Attack; each chosen creature within 30 feet makes a DC ${ROGUE_DC(rd)} Wisdom save or is Charmed` }],
  },
  'dashing strikes': {
    kind: 'rider', on: ['damage'], when: 'weapon', forgo: 2, label: 'Cunning Strike: Invigorate (2d6 of Sneak Attack)', note: 'a creature within 30 feet adds 1d6 to its attack rolls and saves until the end of its next turn',
    also: [{ on: ['damage'], when: 'weapon', forgo: 2, label: 'Cunning Strike: Parrying Stance (2d6 of Sneak Attack)', note: 'roll 1d6: a bonus to your AC until the start of your next turn' }],
  },
  'superior dread': { kind: 'toggle', modifier: () => ({ label: 'Superior Dread', source: 'feature', duration: 'manual', maxRounds: 10, resist: ['bludgeoning', 'piercing', 'slashing'], notes: ['while in your Form of Dread: Fly Speed equal to your Speed, hover; 1d10 Force if you end your turn inside a creature or object'], effects: [] }) },
  'form of dread': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points', formula: '1d10 + @classes.warlock.levels' } },
  'necrotic husk': { kind: 'use', roll: { label: 'Necrotic around you (Constitution save, half on success)', formula: '2d10 + @abilities.cha.mod' } },
  'beguiling arrow': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: ARROW, note: 'Psychic; Wisdom save or Charmed by an ally' },
  'grasping arrow': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: ARROW, note: 'Poison; Speed -10 and the same in Slashing when it moves' },
  'shadow arrow': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: ARROW, note: 'Psychic; Wisdom save or sees only 5 feet' },
  'piercing arrow': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: byLevel('fighter', [[18, '2d6'], [0, '1d6']]), note: 'a 30-foot line, Dexterity save instead of the attack; Piercing' },
  'banishing shot': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: SHOT_DIE(1), note: (rd) => `Psychic; DC ${SHOT_DC(rd)} Charisma save or banished until the end of its next turn` },
  'beguiling shot': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: SHOT_DIE(2), note: (rd) => `Psychic; DC ${SHOT_DC(rd)} Wisdom save or Charmed until the start of your next turn` },
  'bursting shot': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: SHOT_DIE(2), note: 'Force, to the target and each creature within 10 feet of it' },
  'enfeebling shot': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: SHOT_DIE(2), note: (rd) => `Necrotic; DC ${SHOT_DC(rd)} Constitution save or Poisoned, its hits deal one Arcane Shot Die less` },
  'grasping shot': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: SHOT_DIE(1), note: (rd) => `Slashing; DC ${SHOT_DC(rd)} Strength save or Restrained for 1 minute` },
  'piercing shot': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: SHOT_DIE(2), note: (rd) => `a 30-foot line instead of the attack roll, DC ${SHOT_DC(rd)} Dexterity save; Piercing` },
  'seeking shot': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: SHOT_DIE(2), note: (rd) => `no attack roll: DC ${SHOT_DC(rd)} Dexterity save; Force` },
  'shadow shot': { kind: 'rider', on: ['damage'], when: 'ranged', spend: SHOT, formula: SHOT_DIE(1), note: (rd) => `Psychic; DC ${SHOT_DC(rd)} Wisdom save or Blinded until the end of its next turn` },
  'agonizing blast': { kind: 'rider', on: ['damage'], when: 'cantrip', targets: true, defaultOn: true, formula: '@abilities.cha.mod', label: 'Agonizing Blast (Charisma)', note: 'the Warlock cantrip you chose for it' },
  'precision attack': { kind: 'rider', on: ['attack'], when: 'weapon', spend: SUP, formula: SUPERIORITY, note: 'after a miss, to turn it into a hit' },
  'trip attack': { kind: 'rider', on: ['damage'], when: 'weapon', spend: SUP, formula: SUPERIORITY, note: (rd) => `a Large or smaller target makes a DC ${BM_DC(rd)} Strength save or has the Prone condition` },
  'disarming attack': { kind: 'rider', on: ['damage'], when: 'weapon', spend: SUP, formula: SUPERIORITY, note: (rd) => `DC ${BM_DC(rd)} Strength save or it drops one object you choose` },
  'distracting strike': { kind: 'rider', on: ['damage'], when: 'weapon', spend: SUP, formula: SUPERIORITY, note: 'the next attack by someone else against the target has Advantage' },
  'maneuvering attack': { kind: 'rider', on: ['damage'], when: 'weapon', spend: SUP, formula: SUPERIORITY, note: 'an ally moves half its Speed without Opportunity Attacks from the target' },
  'pushing attack': { kind: 'rider', on: ['damage'], when: 'weapon', spend: SUP, formula: SUPERIORITY, note: (rd) => `a Large or smaller target makes a DC ${BM_DC(rd)} Strength save or is pushed up to 15 feet` },
  'mortal strike': { kind: 'rider', on: ['damage'], when: 'weapon', spend: SUP, formula: SUPERIORITY, note: "the target can't regain Hit Points until the end of your next turn" },
  'quick toss': { kind: 'rider', on: ['damage'], when: 'weapon', spend: SUP, formula: SUPERIORITY, note: 'the Bonus Action attack with a Thrown weapon' },
  'sweeping attack': { kind: 'use', spend: SUP, roll: { label: 'Damage to a second creature within 5 feet of the target (the type of the attack)', formula: SUPERIORITY } },
  'heroic leap': { kind: 'use', spend: SUP, roll: { label: 'Bludgeoning when you land (Strength save, half on success)', formula: SUPERIORITY } },
  'commanding presence': { kind: 'rider', on: ['check'], when: ['itm', 'prf', 'per'], spend: SUP, formula: SUPERIORITY, note: 'Intimidation, Performance or Persuasion' },
  'tactical assessment': { kind: 'rider', on: ['check'], when: ['his', 'inv', 'ins'], spend: SUP, formula: SUPERIORITY, note: 'History, Investigation or Insight' },
  'grappling strike': { kind: 'rider', on: ['check'], when: ['ath'], spend: SUP, formula: SUPERIORITY, note: 'the grapple right after a melee hit, as a Bonus Action' },
  'fire rune': { kind: 'rider', on: ['damage'], when: 'weapon', spend: { item: 'Fire Rune' }, formula: '2d6', note: (rd) => `Fire; DC ${RUNE_DC(rd)} Strength save or Restrained for 1 minute, taking 2d6 Fire at the start of each of its turns` },
  'gift of the ever-living ones': { kind: 'toggle', modifier: () => ({ label: 'Gift of the Ever-Living Ones', source: 'feature', duration: 'manual', healMax: true, notes: ['your familiar is within 100 feet: the dice of every healing you receive count as their maximum'], effects: [] }) },
  'health funnel': { kind: 'use', spend: { hitDie: 8 }, amount: { min: 1, max: (rd) => rd.classes?.warlock?.levels ?? 1 }, roll: { label: 'Temporary Hit Points for your familiar or a Fiend you command (its card on the Summons tab)', formula: (rd, n) => `${n}d8 + ${n * (rd.abilities?.cha?.mod ?? 0)}` } },
  "order's wrath": { kind: 'use', roll: { label: 'Psychic when an ally hits the creature your Divine Strike cursed (the curse ends)', formula: '2d8' } },
  'improved warding flare': { kind: 'use', apply: null, roll: { label: 'Temporary Hit Points for the target of the attack (with Warding Flare)', formula: '2d6 + @abilities.wis.mod' } },
  'eye for weakness': { kind: 'rider', on: ['damage'], when: 'weapon', formula: '3d6', label: 'Eye for Weakness (Sneak Attack)', note: 'with Sneak Attack, against the creature of your Insightful Fighting' },
  'psychic blades': { kind: 'rider', on: ['damage'], when: 'weapon', has: (c) => (c.features ?? []).includes('psychic blades') && (c.rollData?.classes?.bard?.levels ?? 0) > 0, spend: BI, formula: byLevel('bard', [[15, '8d6'], [10, '5d6'], [5, '3d6'], [0, '2d6']]), note: 'College of Whispers: Psychic, once per turn' },
  'dread lord': {
    kind: 'use',
    options: [
      { label: 'Aura: Psychic to a Frightened enemy that starts its turn in it', roll: { label: 'Psychic (Dread Lord aura)', formula: '4d10' } },
      { label: 'Shadows: a melee spell attack as a Bonus Action', roll: { label: 'Necrotic (Dread Lord shadows)', formula: '3d10 + @abilities.cha.mod' } },
    ],
  },
  'ascendant aspect': {
    kind: 'use',
    options: [
      { label: 'Augment Breath (1 Focus Point more on Breath of the Dragon)', roll: { label: 'Breath of the Dragon, augmented (Dexterity save, half on success)', formula: MARTIAL(4) } },
      { label: 'Explosive Fury (when you activate Draconic Presence)', roll: { label: 'Acid, Cold, Fire, Lightning or Poison (Dexterity save)', formula: '3d10' } },
    ],
  },
  'lunar phenomenon': {
    kind: 'use',
    spend: { item: 'Lunar Phenomenon' },
    options: [
      { label: 'Full Moon: Constitution save or Blinded, and one creature regains Hit Points', roll: { label: 'Hit Points one creature regains (Full Moon)', formula: '3d8' } },
      { label: 'New Moon: Dexterity save or Necrotic and Speed 0', roll: { label: 'Necrotic (New Moon, Dexterity save)', formula: '3d10' } },
      { label: 'Crescent Moon: teleport and Resistance (no roll)', roll: null },
    ],
  },
  'azerite surge': {
    kind: 'use',
    spend: { item: 'Azerite Surge' },
    options: [
      { label: 'Healing to each creature of your choice in the cone', roll: { label: 'Hit Points regained (Azerite Surge)', formula: AZERITE } },
      { label: 'Radiant to each other creature in the cone', roll: { label: 'Radiant (Dexterity save, half on success)', formula: AZERITE }, save: { ability: 'dex', dc: '8 + @abilities.con.mod + @prof' } },
    ],
  },
  'summon wildfire spirit': { kind: 'use', roll: { label: 'Fire to each creature within 10 feet when the spirit appears (Dexterity save, your spell save DC)', formula: '2d6' } },
  'animal enhancement': { kind: 'use', has: (c) => (c.optionPicks ?? []).includes('Acid Spit'), roll: { label: 'Acid Spit (Dexterity save, DC 8 + CON + PB)', formula: (rd) => `${2 + ((rd.details?.level ?? 1) >= 11) + ((rd.details?.level ?? 1) >= 17)}d10` } },
  'poisonous skin': { kind: 'use', roll: { label: 'Poison on a piercing weapon hit (DC 12 Constitution save)', formula: '2d4' } },
  'cohort of chaos': { kind: 'use', roll: { label: 'Chaotic Flare: the d4 of the table in the feature (after a 1 or a 20)', formula: '1d4' } },
  'spellfire spark': { kind: 'use', roll: { label: 'Damage reduced (Magic Absorption, once per turn)', formula: '1d4' } },
  'natural weapons': { kind: 'rider', on: ['damage'], when: 'unarmed', formula: '1d4', label: 'Bite poison', note: 'the bite only, if the target fails the Constitution save (8 + PB + CON)' },
  "hexblade's curse": { kind: 'rider', on: ['damage'], formula: '@prof', label: "Hexblade's Curse (cursed target)", note: 'against the cursed target; a d20 of 19 or 20 is a Critical Hit; regain Hit Points when it dies' },
  'elemental adept': { kind: 'rider', on: ['damage'], when: 'spell', typesFrom: 'damageTypePicks', defaultOn: true, diceMin: 2, label: 'Elemental Adept (a 1 counts as 2)', note: (rd, c) => `only a spell of ${(c?.damageTypePicks ?? []).join(' or ') || 'the chosen type'}; it ignores Resistance to it` },
  'aura of elemental shielding': {
    kind: 'toggle',
    options: ['acid', 'cold', 'fire', 'lightning', 'thunder'].map((t) => ({ label: t.charAt(0).toUpperCase() + t.slice(1), modifier: () => ({ label: `Aura of Elemental Shielding (${t})`, source: 'feature', duration: 'manual', resist: [t], notes: ['you and your allies in your Aura of Protection; change the type at the start of each of your turns'], effects: [] }) })),
  },
  'protection of the talisman': { kind: 'rider', on: ['save'], spend: { item: 'Protection of the Talisman' }, formula: '1d4', note: 'after a failed save, you or the wearer of your talisman' },
  'warding maneuver': { kind: 'use', roll: { label: 'AC bonus against the attack', formula: '1d8' } },
  'favored by the gods': { kind: 'rider', on: ['attack', 'save'], spend: { item: 'Favored by the Gods' }, formula: '2d4', note: 'after a failed save or a miss' },
  'defensive flourish': { kind: 'rider', on: ['damage'], when: 'weapon', spend: BI, formula: BARDIC, note: 'add the roll to your AC until your next turn' },
  'mobile flourish': { kind: 'rider', on: ['damage'], when: 'weapon', spend: BI, formula: BARDIC, note: 'push the target 5 feet plus the roll' },
  'slashing flourish': { kind: 'rider', on: ['damage'], when: 'weapon', spend: BI, formula: BARDIC, note: 'also to another creature within 5 feet of you' },
  'planar warrior': { kind: 'rider', on: ['damage'], when: 'weapon', formula: byLevel('ranger', [[11, '2d8'], [0, '1d8']]), note: 'the creature you chose this turn; all the damage becomes Force' },
  "slayer's prey": { kind: 'rider', on: ['damage'], when: 'weapon', formula: '1d6', note: 'your designated target; the first hit each turn' },
  "kensei's shot": { kind: 'rider', on: ['damage'], when: 'ranged', formula: '1d4', note: 'a kensei weapon, after the Bonus Action this turn' },
  'one with the blade': { kind: 'rider', on: ['damage'], when: 'weapon', spend: FOCUS, formula: '@scale.monk.die', label: 'Deft Strike', note: 'a kensei weapon; once per turn' },
  'searing sunburst': { kind: 'use', spend: FOCUS, save: { ability: 'con', dc: '8 + @prof + @abilities.wis.mod' }, amount: { min: 0, max: 3 }, roll: { label: 'Radiant (Constitution save): 2d6, +2d6 per Focus Point spent', formula: (rd, n) => `${2 + 2 * n}d6` } },
  'searing arc strike': { kind: 'use', spend: FOCUS, save: { ability: 'dex', dc: '8 + @prof + @abilities.wis.mod' }, amount: { min: 2, max: (rd) => Math.floor((rd.classes?.monk?.levels ?? 0) / 2) }, roll: { label: 'Burning Hands at level 1 + each point past 2 (Dexterity save, half on success)', formula: (rd, n) => `${1 + n}d6` } },
  'radiant sun bolt': { kind: 'use', spend: FOCUS, note: 'two Radiant Sun Bolts as a Bonus Action, after the Attack action' },
  'sharpen the blade': { kind: 'use', spend: FOCUS, amount: { min: 1, max: 3 }, note: 'a kensei weapon gets +1 to attack and damage per point spent, for 1 minute' },
  'halo of spores': { kind: 'use', roll: { label: 'Necrotic (Constitution save)', formula: byLevel('druid', [[14, '1d10'], [10, '1d8'], [6, '1d6'], [0, '1d4']]) } },
  'symbiotic entity': {
    kind: 'use',
    apply: 'temp',
    spend: { item: 'Wild Shape' },
    roll: { label: 'Temporary Hit Points', formula: '4 * @classes.druid.levels' },
    also: [{ on: ['damage'], when: 'melee', formula: '1d6', label: 'Symbiotic Entity', note: 'while it is active; Necrotic' }],
  },
  'cauterizing flames': { kind: 'use', roll: { label: 'Healing or Fire damage', formula: '2d10 + @abilities.wis.mod' } },
  'unsettling words': { kind: 'use', spend: BI, roll: { label: 'Subtracted from its next saving throw', formula: BARDIC } },
  brace: { kind: 'rider', on: ['damage'], when: 'weapon', spend: SUP, formula: SUPERIORITY, note: 'the reaction attack' },
  'spirit shield': { kind: 'use', roll: { label: 'Damage reduced', formula: byLevel('barbarian', [[14, '4d6'], [10, '3d6'], [0, '2d6']]) } },
  'infectious fury': { kind: 'use', roll: { label: 'Psychic (Wisdom save against 8 + CON + PB)', formula: '2d12' } },
  'wild surge': { kind: 'use', roll: { label: 'Wild Magic table', formula: '1d8' } },
  'unstable backlash': { kind: 'use', roll: { label: 'Wild Magic table (replaces the current effect)', formula: '1d8' } },
  'controlled surge': { kind: 'use', roll: { label: 'Second roll on the Wild Magic table (choose either; a double lets you choose any)', formula: '1d8' } },
  'bolstering magic': {
    kind: 'use',
    options: [
      { label: 'Bolster (a d3 on attack rolls and ability checks for 10 minutes)', roll: { label: 'd3 to add, this time', formula: '1d3' } },
      { label: 'Regain a spell slot (level 1d3 or lower)', roll: { label: 'Highest slot level regained', formula: '1d3' } },
    ],
  },
  'sun shield': { kind: 'use', roll: { label: 'Radiant to the attacker', formula: '5 + @abilities.wis.mod' } },
  "pyromancer's fury": { kind: 'use', roll: { label: 'Fire to the attacker (ignores fire resistance)', formula: '@classes.sorcerer.levels' } },
  "storm's fury": { kind: 'use', save: { ability: 'str', dc: '8 + @prof + @abilities.cha.mod' }, roll: { label: 'Lightning to the attacker (Strength save or pushed 20 feet)', formula: '@classes.sorcerer.levels' } },
  'heart of fire': { kind: 'use', roll: { label: 'Fire to each creature of your choice within 10 feet', formula: 'floor(@classes.sorcerer.levels / 2)' } },
  'scornful rebuke': { kind: 'use', roll: { label: 'Psychic to the creature that hit you', formula: 'max(1, @abilities.cha.mod)' } },
  'deflecting shroud': { kind: 'use', roll: { label: 'Force to up to three creatures within 60 feet', formula: 'floor(@classes.wizard.levels / 2)' } },
  'armor of hexes': { kind: 'use', roll: { label: 'On 4 or higher, the attack misses you', formula: '1d6' } },
  'spreading spores': { kind: 'use', roll: { label: 'Necrotic in the cube (Constitution save), your Halo of Spores damage', formula: byLevel('druid', [[14, '1d10'], [10, '1d8'], [6, '1d6'], [0, '1d4']]) } },
  'unearthly recovery': { kind: 'use', apply: 'heal', roll: { label: 'Healing (half your Hit Point maximum)', formula: 'floor(@attributes.hp.max / 2)' } },
  'balm of the summer court': {
    kind: 'use',
    apply: 'heal',
    spend: { item: 'Balm of the Summer Court' },
    amount: { min: 1, max: (rd) => Math.max(1, Math.floor((rd.classes?.druid?.levels ?? 2) / 2)) },
    roll: { label: 'Healing (also 1 Temporary Hit Point per die)', formula: (rd, n) => `${n}d6` },
  },
  'fighting spirit': {
    kind: 'use',
    apply: 'temp',
    roll: { label: 'Temporary Hit Points', formula: byLevel('fighter', [[15, '15'], [10, '10'], [0, '5']]) },
    modifier: () => ({ label: 'Fighting Spirit', source: 'feature', duration: 'manual', maxRounds: 1, effects: [{ targets: ['attack'], mode: 'advantage', when: 'weaponAttack', label: 'Fighting Spirit' }], notes: ['Advantage on weapon attack rolls until the end of the turn'] }),
  },
  'aspect of the wyrm': {
    kind: 'use',
    options: [
      { label: 'Frightful Presence', save: { ability: 'wis', dc: '8 + @prof + @abilities.wis.mod' } },
      ...['acid', 'cold', 'fire', 'lightning', 'poison'].map((t) => ({ label: `Resistance: ${t}`, modifier: () => ({ label: 'Aspect of the Wyrm', source: 'feature', duration: 'manual', maxRounds: 10, resist: [t], notes: ['You and your allies within 10 feet have the resistance'], effects: [] }) })),
    ],
  },
  "genie's wrath": { kind: 'rider', on: ['damage'], when: 'attackRoll', formula: '@prof', note: 'once on each of your turns, on a hit with an attack roll; Bludgeoning (dao), Thunder (djinni), Fire (efreeti) or Cold (marid)' },
  'maddening hex': { kind: 'use', roll: { label: 'Psychic to the cursed target and creatures of your choice within 5 feet of it', formula: 'max(1, @abilities.cha.mod)' } },
  'rebuke of the talisman': { kind: 'use', roll: { label: 'Psychic to the attacker (pushed up to 10 feet)', formula: '@prof' } },
  'call the hunt': {
    kind: 'use',
    apply: 'temp',
    amount: { min: 1, max: (rd) => Math.max(1, rd.abilities?.con?.mod ?? 1) },
    roll: { label: 'Temporary Hit Points (5 for each creature that joins; they deal +1d6 once per turn while you rage)', formula: (rd, n) => `${5 * n}` },
  },
  'mighty impel': { kind: 'use', save: { ability: 'str', dc: '8 + @prof + @abilities.str.mod' } },
  'ferocious charger': { kind: 'use', save: { ability: 'str', dc: '8 + @prof + @abilities.str.mod' } },
  'aura of conquest': { kind: 'use', roll: { label: 'Psychic to a Frightened creature that starts its turn in the aura', formula: 'floor(@classes.paladin.levels / 2)' } },
  'guardian spirit': { kind: 'use', roll: { label: 'Healing for a beast or fey you summoned that ends its turn in your Spirit Totem', formula: 'floor(@classes.druid.levels / 2)' } },
  'spiked retribution': { kind: 'use', roll: { label: 'Piercing to the creature that hit you (raging, in spiked armor)', formula: '3' } },
  'power surge': { kind: 'rider', on: ['damage'], when: 'spell', spend: { item: 'Power Surge' }, formula: 'floor(@classes.wizard.levels / 2)', note: 'once per turn, a wizard spell; Force' },
  'enhanced bond': { kind: 'rider', on: ['damage'], when: 'spell', formula: '1d8', note: 'while your wildfire spirit is summoned, a spell that deals Fire damage, one roll (also one healing roll)' },
  'channel divinity: balm of peace': { kind: 'use', spend: CD, roll: { label: 'Healing for each creature you pass', formula: '2d6 + @abilities.wis.mod' } },
  'channel divinity: twilight sanctuary': { kind: 'use', spend: CD, roll: { label: 'Temporary Hit Points for a creature ending its turn in the sphere', formula: '1d6 + @classes.cleric.levels' } },
  'guardian coil': { kind: 'use', roll: { label: 'Damage reduced', formula: byLevel('warlock', [[10, '2d8'], [0, '1d8']]) } },
  'tentacle of the deeps': { kind: 'use', roll: { label: 'Cold on a hit (melee spell attack)', formula: byLevel('warlock', [[10, '2d8'], [0, '1d8']]) } },
  "giant's might": {
    kind: 'toggle',
    modifier: (rd) => ({
      label: "Giant's Might",
      source: 'feature',
      duration: 'manual',
      maxRounds: 10,
      effects: [
        { targets: ['check:str', 'save:str'], mode: 'advantage', label: "Giant's Might" },
        { targets: ['damage'], formula: byLevel('fighter', [[18, '1d10'], [10, '1d8'], [0, '1d6']])(rd), when: 'weaponAttack', optional: true, label: "Giant's Might (once per turn)" },
      ],
    }),
  },
  'great stature': { kind: 'passive' },
  'storm aura: sea': { kind: 'use', save: { ability: 'dex', dc: '8 + @prof + @abilities.con.mod' }, roll: { label: 'Lightning to one creature in the aura (Dexterity save, half on success)', formula: byLevel('barbarian', [[20, '4d6'], [15, '3d6'], [10, '2d6'], [0, '1d6']]) } },
  'storm aura: tundra': { kind: 'use', apply: 'temp', roll: { label: 'Temporary Hit Points for each creature of your choice in the aura', formula: byLevel('barbarian', [[20, '6'], [15, '5'], [10, '4'], [5, '3'], [0, '2']]) } },
  "master's flourish": { kind: 'rider', on: ['damage'], when: 'weapon', formula: '1d6', note: 'a Blade Flourish that rolls this d6 instead of spending Bardic Inspiration' },
  'supernatural defense': { kind: 'rider', on: ['save', 'check'], formula: '1d6', note: "against the target of your Slayer's Prey (its saves, or a check to escape its grapple)" },
  lifedrinker: { kind: 'rider', on: ['damage'], when: 'pact', has: xphbOnly('Lifedrinker'), formula: '1d6', note: "your pact weapon, once per turn; Necrotic, Psychic or Radiant; spend a Hit Point Die on the HP card's Hit dice to heal" },
  'runic juggernaut': { kind: 'passive' },
  'arms of the astral self': { kind: 'use', spend: FOCUS, roll: { label: 'Force within 10 feet (Dexterity save)', formula: MARTIAL(2) } },
  'body of the astral self': { kind: 'use', roll: { label: 'Damage reduced (Deflect Energy)', formula: '1d10 + @abilities.wis.mod' } },
  'gathered swarm': { kind: 'rider', on: ['damage'], formula: byLevel('ranger', [[11, '1d8'], [0, '1d6']]), note: 'once per turn, Piercing (or push or move instead)' },
  'turn the tide': { kind: 'use', spend: CD, roll: { label: 'Healing for each creature at half its Hit Points or less', formula: '1d6 + @abilities.cha.mod' } },
  'touch of the long death': { kind: 'use', spend: FOCUS, save: { ability: 'con', dc: '8 + @prof + @abilities.wis.mod' }, amount: { min: 1, max: 10 }, roll: { label: 'Necrotic: 2d10 per Focus Point spent (Constitution save, half on success)', formula: (rd, n) => `${2 * n}d10` } },
  'mastery of death': { kind: 'use', spend: FOCUS, apply: 'heal', roll: { label: 'Back to 1 Hit Point instead of 0', formula: '1' } },
  'visage of the astral self': { kind: 'use', spend: FOCUS },
  'defy death': { kind: 'use', apply: 'heal', roll: { label: 'Hit Points regained', formula: '1d8 + @abilities.con.mod' } },
  'indestructible life': { kind: 'use', apply: 'heal', roll: { label: 'Hit Points regained', formula: '1d8 + @classes.warlock.levels' } },
  'wrath of the storm': { kind: 'use', roll: { label: 'Lightning or Thunder (Dexterity save, half on success)', formula: '2d8' } },
  'elemental cleaver': { kind: 'rider', on: ['damage'], when: 'weapon', needs: 'Rage', formula: byLevel('barbarian', [[14, '2d6'], [0, '1d6']]), note: 'the infused weapon; the type you chose when raging' },
  'demiurgic colossus': { kind: 'passive' },
  'guided strike': { kind: 'rider', on: ['attack'], spend: CD, formula: '10', note: 'after you see the roll, before you know if it hits' },
  'channel divinity: feat of strength': { kind: 'rider', on: ['attack', 'check', 'save'], when: 'strRoll', spend: CD, formula: '10', label: 'Feat of Strength', note: 'a roll that uses Strength' },
  'aura of hate': { kind: 'rider', on: ['damage'], when: 'melee', defaultOn: true, formula: 'max(1, @abilities.cha.mod)', note: 'Melee weapon damage; also for Fiends and Undead within 10 feet' },
  'alchemical savant': { kind: 'rider', on: ['damage'], when: 'spell', formula: 'max(1, @abilities.int.mod)', note: "one roll of a spell cast with Alchemist's Supplies; healing, or Acid, Fire or Poison damage" },
  'arcane firearm': { kind: 'rider', on: ['damage'], when: 'spell', formula: '1d8', note: 'one damage roll of an Artificer spell cast through the firearm' },
  'agile parry': { kind: 'toggle', modifier: () => ({ label: 'Agile Parry', source: 'feature', duration: 'manual', maxRounds: 1, ac: 2, effects: [] }) },
  'awakened astral self': { kind: 'toggle', spend: FOCUS, amount: 5, modifier: () => ({ label: 'Awakened Astral Self', source: 'feature', duration: 'manual', maxRounds: 100, endsOnIncapacitated: true, ac: 2, effects: [] }) },
  'revenant blade': { kind: 'toggle', modifier: () => ({ label: 'Revenant Blade', source: 'feature', duration: 'manual', ac: 1, notes: ['a double-bladed scimitar in two hands'], effects: [] }) },
  'devouring plague': { kind: 'use', apply: 'heal', spend: { item: 'Devouring Plague' }, roll: { label: 'Necrotic damage dealt, and Hit Points regained', formula: '1d10' } },
  'touch of the grave': { kind: 'use', apply: 'heal', roll: { label: 'Extra Necrotic damage, and Hit Points regained', formula: (rd) => `${rd.prof ?? 2}d4` } },
  'blood thirst': { kind: 'use', apply: 'heal', roll: { label: 'Necrotic damage dealt (on a hit), and Hit Points regained', formula: '1d6' } },
  'fists of fury': { kind: 'rider', on: ['damage'], when: 'weapon', diceMin: 2, label: 'Clean Hits (a 1 counts as 2)', note: 'an Unarmed Strike or a Light weapon; Combo Strikes: +1 per earlier melee hit on that creature this turn, in the Situational bonus' },
  'soul of artifice': { kind: 'rider', on: ['save', 'deathSave', 'concentration'], has: (c) => (c.featureList ?? []).some((f) => f.name === 'Soul of Artifice' && f.source === 'TCE'), defaultOn: true, formula: '@attunement.value', label: 'Soul of Artifice (+1 per attuned item)', note: 'one per magic item you are attuned to' },
  'conjuration adept': { kind: 'rider', on: ['concentration'], formula: (rd) => `@abilities.${rd.featAbility?.['conjuration adept'] ?? 'int'}.mod`, label: 'Persistent Conjuration', note: 'only on a Conjuration spell' },
  'savage attacker': { kind: 'rider', on: ['damage'], when: 'armed', twice: true, label: 'Savage Attacker (best of two)', note: "once per turn; the weapon's damage dice rolled twice (the 2014 feat: melee only)" },
  'vigilant rebuke': { kind: 'use', roll: { label: 'Force to the creature that forced the save', formula: '2d8 + @abilities.cha.mod' } },
  'great weapon fighting': {
    kind: 'rider', on: ['damage'], when: 'twoHandedMelee', defaultOn: true, diceMin: 3, label: 'Great Weapon Fighting (a 1 or 2 counts as 3)', note: 'a Melee weapon you hold with two hands',
    also: [{ on: ['damage'], when: 'versatileMelee', grip: 'two', diceMin: 3, label: 'Great Weapon Fighting (a 1 or 2 counts as 3)', note: 'only when you hold the weapon with two hands' }],
  },
};

const norm = (s) => String(s ?? '').trim().toLowerCase();
const slug = (s) => norm(s).replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A entrada do registro de uma feature, pelo nome, ou null. */
export function featureRollOf(name) {
  return FEATURE_ROLLS[norm(name)] ?? null;
}

/** A fórmula da entrada, resolvida pelo nível quando é função. */
export function formulaOf(entry, rollData = {}, amount = 1) {
  return typeof entry.formula === 'function' ? entry.formula(rollData, amount) : entry.formula;
}

/** Quanto a entrada gasta: um número, ou { min, max } que o jogador escolhe (o máximo pode depender do nível). */
export function amountOf(entry, rollData = {}) {
  const a = entry?.amount;
  if (a == null) return 1;
  if (typeof a === 'number') return a;
  const max = typeof a.max === 'function' ? a.max(rollData) : a.max;
  return { min: a.min ?? 1, max: Math.max(a.min ?? 1, max ?? a.min ?? 1) };
}

/** A nota, que pode citar uma CD calculada. */
export function noteOf(entry, rollData = {}, catalog = null) {
  return typeof entry.note === 'function' ? entry.note(rollData, catalog) : entry.note;
}

/** A chave do recurso que a entrada gasta, ou null. */
export function spendKeyOf(catalog, spend) {
  if (!spend) return null;
  const resources = catalog.resources ?? [];
  if (spend.pact) return resources.some((r) => r.key === 'pact') ? 'pact' : null;
  if (spend.hitDie) return (resources.find((r) => r.kind === 'hitDice' && r.faces === spend.hitDie) ?? resources.find((r) => r.kind === 'hitDice'))?.key ?? null;
  const byItem = (name) => resources.find((r) => r.kind === 'pool' && norm(r.item) === norm(name))?.key ?? null;
  return [spend.item, ...(spend.alt ?? [])].map(byItem).find(Boolean) ?? null;
}

/** Os extras de uma entrada: ela mesma, se for `rider`, e os `also`. */
export function ridersOf(entry) {
  return [...(entry.kind === 'rider' ? [entry] : []), ...(entry.also ?? [])];
}

/** A rolagem casa com o `when` da entrada? */
function fits(when, roll) {
  if (!when) return true;
  if (when === 'stealth') return roll.kind === 'initiative' || roll.skill === 'ste';
  if (when === 'social') return ['dec', 'itm', 'per'].includes(roll.skill);
  if (Array.isArray(when)) return when.includes(roll.skill);
  if (when === 'cantrip') return !!roll.spell && !!roll.cantrip;
  if (when === 'spell') return !!roll.spell;
  if (when === 'attackRoll') return !!roll.attackRoll;
  if (when === 'strRoll') return roll.attackAbility === 'str' || roll.ability === 'str';
  if (!roll.weapon) return false;
  if (when === 'unarmed') return !!roll.unarmed;
  if (when === 'armed') return !roll.unarmed;
  if (when === 'pact') return !!roll.pact;
  if (when === 'str') return roll.attackAbility === 'str';
  if (when === 'melee') return roll.melee !== false;
  if (when === 'ranged') return roll.melee === false;
  if (when === 'twoHandedMelee') return roll.melee !== false && !!roll.twoHanded;
  if (when === 'versatileMelee') return roll.melee !== false && !roll.twoHanded && !!roll.versatile;
  return true;
}

/** Os extras do registro que valem para uma rolagem, no formato de rollEffects. */
export function featureRiders(state, catalog, roll) {
  const features = new Set(catalog.features ?? []);
  const rd = catalog.rollData ?? {};
  const raging = (state.modifiers ?? []).some((m) => m.label === 'Rage');
  const out = [];
  for (const [name, entry] of Object.entries(FEATURE_ROLLS)) {
    if (!(entry.has ? entry.has(catalog) : features.has(name))) continue;
    const wantTypes = entry.typesFrom ? catalog[entry.typesFrom] ?? [] : [];
    if (wantTypes.length && roll.types && !roll.types.some((t) => wantTypes.includes(String(t).toLowerCase()))) continue;
    const targets = entry.targets ? catalog.optionTargets?.[name] ?? [] : [];
    if (targets.length && roll.spellName && !targets.includes(roll.spellName)) continue;
    ridersOf(entry).forEach((e, i) => {
      if (!e.on.includes(roll.kind)) return;
      if (e.needs === 'Rage' && !raging) return;
      if (!fits(e.when, roll)) return;
      const label = e.label ?? name.replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/ (Of|The|And|A|An|To|In|On)(?= )/g, (m) => m.toLowerCase());
      const key = spendKeyOf(catalog, e.spend);
      const max = key ? (catalog.resources ?? []).find((r) => r.key === key)?.max ?? 0 : 0;
      const none = e.spend && (!key || remainingOf(state, key, max) < 1);
      out.push({
        id: `rider:${slug(name)}${entry.kind === 'rider' ? (i ? `-${i}` : '') : `-${i + 1}`}`,
        label: none ? `${label} (none left)` : label,
        source: label,
        ...(e.twice ? { twice: true } : e.diceMin ? { diceMin: e.diceMin } : e.forgoableMin ? { forgoableMin: e.forgoableMin } : e.forgo ? { forgo: e.forgo } : { part: { label, formula: formulaOf(e, rd), ...(e.forgoable ? { forgoable: true } : {}) } }),
        note: noteOf(e, rd, catalog),
        defaultOn: !!e.defaultOn,
        ...(e.grip ? { grip: e.grip } : {}),
        ...(key ? { spend: { key, amount: 1 } } : {}),
      });
    });
  }
  return out;
}

/** As operações de gasto dos extras ligados (o `applied` de applyEffects) e as linhas do card. */
export function riderSpendOps(applied, catalog) {
  const spends = applied?.spends ?? [];
  const ops = spends.map((s) => ({ op: 'spend', key: s.key, amount: s.amount }));
  const lines = spends.map((s) => ({ name: (catalog.resources ?? []).find((r) => r.key === s.key)?.name ?? s.key, amount: s.amount }));
  return { ops, lines };
}

/**
 * O que o "Use" de uma feature `toggle` ou `use` faz: o modificador (sem id), a chave
 * do gasto, a salvaguarda, a rolagem, o `apply` e a chave do `restore`. Null para o resto.
 */
export function featureUseOf(feature, catalog, chosen = null, option = null) {
  const e = featureRollOf(feature?.name);
  if (!e && feature?.spendItem) return { modifier: null, spend: spendKeyOf(catalog, { item: feature.spendItem }), amount: 1, spent: 1, save: null, roll: null, apply: null, restore: null };
  if (!e) {
    const prose = (catalog.proseUses ?? []).find((u) => u.name === feature?.name);
    return prose ? { modifier: null, spend: null, save: null, roll: { label: prose.label, formula: prose.formula }, apply: prose.apply, restore: null } : null;
  }
  if (e.kind !== 'toggle' && e.kind !== 'use') return null;
  const rd = catalog.rollData ?? {};
  const src = e.options ? e.options[Math.max(0, Math.min(option ?? 0, e.options.length - 1))] : e;
  let save = null;
  if (src.save) {
    let dc;
    try {
      dc = rollFormula(src.save.dc, { data: rd }).total;
    } catch {
      dc = null;
    }
    save = { abilities: [src.save.ability], dc };
  }
  const amount = amountOf(e, rd);
  const n = typeof amount === 'number' ? amount : Math.min(amount.max, Math.max(amount.min, chosen ?? amount.min));
  const formula = src.roll ? formulaOf(src.roll, rd, n) : null;
  const roll = src.roll && formula && formula !== '0' ? { label: src.roll.label, formula } : null;
  return {
    modifier: src.modifier ? src.modifier(rd) : e.modifier ? e.modifier(rd) : null, spend: spendKeyOf(catalog, e.spend), amount, spent: n, save, roll, apply: e.apply ?? null, restore: spendKeyOf(catalog, e.restore), restoreUpTo: e.restoreUpTo ?? null,
    ...(e.options ? { options: e.options.map((o) => o.label) } : {}),
  };
}

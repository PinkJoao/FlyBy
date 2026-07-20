// =============================================================================
// ChoiceList - renderer GENÉRICO e RECURSIVO de sub-escolhas
// =============================================================================
// Recebe descritores `Choice[]` (de engine/choices.parseChoices ou
// engine/classFeatureChoices) + o "choice-bag" salvo, e renderiza cada escolha
// conforme o tipo de pool:
//   - list / any       → chips removíveis + "+ Add" (SelectorPanel)
//   - any [skill,tool] → MISTO (Skilled): "+ Add" por tipo, budget compartilhado
//   - expertise        → como skill, restrito às perícias PROFICIENTES
//   - weapon           → armas com mastery (Weapon Mastery)
//   - ability          → ASI embutido em talento (+2/um ou +1/dois no feat ASI)
//   - feat             → PickerField (categoria do pool: O/G/FS/EB); ao escolher
//                        um talento, RECURSA renderizando as escolhas DELE
//                        logo abaixo (Pathbuilder-style).
//
// DEDUP: recebe `owned` (tudo que a ficha já tem) e impede escolher a mesma
// coisa duas vezes. Feats `repeatable` (ex: Skilled, ASI) escapam do dedup.
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { parseChoices, LEGACY_ABILITY_CHOICE, weaponFilterAllows } from '../../engine/choices';
import { resolveFeat } from '../../engine/resolve';
import { skillCode } from '../../engine/classData';
import { spellChoosePredicate } from '../../engine/spells';
import { totalLevel } from '../../schema/character';
import { makeSpellEntity } from '../../selector/entities/spell';
import { prereqContext, prereqStatus } from '../../engine/prereq';
import PickerField from '../common/PickerField';
import ClearableSelect from '../common/ClearableSelect';
import SelectorPanel from '../../selector/SelectorPanel';
import EntryContent from '../common/EntryContent';
import { showDetailPopup } from '../common/detailPopup';
import { showRulePopup } from '../common/RulePopup';
import { makeFeatEntity, FEAT_CATEGORY_TITLE, hasFreeLegacyBonus } from '../../selector/entities/feat';
import skillEntity from '../../selector/entities/skill';
import toolEntity from '../../selector/entities/tool';
import languageEntity from '../../selector/entities/language';
import weaponEntity from '../../selector/entities/weapon';
import { makeOptionalFeatureEntity } from '../../selector/entities/optionalfeature';
import { SKILL_LABEL, ABILITY_FULL } from './labels';
import { kindRuleEntry } from './choiceRules';
import { confirm } from '../common/dialog';
import styles from './ChoiceList.module.css';

const ADD_ENTITY = {
  skill: skillEntity,
  tool: toolEntity,
  language: languageEntity,
  expertise: skillEntity, // expertise escolhe entre perícias
  weapon: weaponEntity,
  weaponProf: weaponEntity, // proficiência de arma individual (Kensei)
};
const OWNED_KEY = { skill: 'skills', tool: 'tools', language: 'languages', expertise: 'expertise' };

// Filtro pré-marcado "Prerequisites: Met" - esconde de saída o que o personagem
// não cumpre (o usuário ainda pode desmarcá-lo no painel). Usado sempre nas
// Eldritch Invocations e, só no guia, nos talentos (telas para novatos).
const PREREQ_MET_FILTER = { prereq: { ok: 'include' } };

// Confirmação ao escolher um talento/feature cujo pré-requisito falha (bad) ou
// não pode ser checado (unknown → confirme com o mestre). Resolve true p/ seguir.
function confirmPrereq(raw, status) {
  const message =
    status === 'bad'
      ? `${raw.name} has prerequisites your character does not meet. Select it anyway?`
      : `${raw.name} has prerequisites that cannot be checked automatically. Confirm with your Dungeon Master. Select it anyway?`;
  return confirm({ title: 'Prerequisite not met', message, confirmLabel: 'Select anyway' });
}

/** Kinds que guardam CÓDIGO de perícia (comparação sem normalizar caixa). */
const SKILL_LIKE = new Set(['skill', 'expertise']);

/** Normaliza um valor p/ comparação: skill = código; tool/language = minúsculas. */
function normVal(kind, v) {
  return SKILL_LIKE.has(kind) ? v : String(v).toLowerCase();
}

/** O valor já está na ficha (qualquer fonte)? */
function isOwned(owned, kind, value) {
  return owned?.[OWNED_KEY[kind]]?.has(normVal(kind, value)) ?? false;
}

// `guided`: renderizado dentro do guia de personagem (wizard/level-up). Ativa o
// filtro "Prerequisites: Met" por padrão nos seletores de talento - as telas do
// guia são para novatos, então escondem de saída o que não é elegível.
export default function ChoiceList({ choices, bag, onChange, db, owned, character, guided = false }) {
  if (!choices?.length) return null;

  const setEntry = (id, entry) => {
    const next = { ...(bag ?? {}) };
    const prev = bag?.[id];
    if (entry == null) delete next[id];
    else next[id] = entry;
    // Trocar a LISTA de magias (spellSet) descarta os picks de magia irmãos: as
    // escolhas `spell-N` do grupo antigo não valem para o novo (TC-0011).
    if ((entry?.kind === 'spellSet' || prev?.kind === 'spellSet') && prev?.picks?.[0] !== entry?.picks?.[0]) {
      const prefix = id.slice(0, id.lastIndexOf('spellSet-'));
      for (const k of Object.keys(next)) {
        if (k.startsWith(`${prefix}spell-`) && next[k]?.kind === 'spell') delete next[k];
      }
    }
    onChange(next);
  };

  // Magias já escolhidas nos OUTROS chooses de magia do mesmo bag: um par de
  // chooses irmãos (Lore, Magical Discoveries: 2× "Cleric/Druid/Wizard") não
  // pode escolher a MESMA magia duas vezes (TC-0025).
  const spellPicksElsewhere = (id) => {
    const out = new Set();
    for (const [k, e] of Object.entries(bag ?? {})) {
      if (k === id || e?.kind !== 'spell') continue;
      for (const p of e.picks ?? []) out.add(p);
    }
    return out;
  };

  return (
    <div className={styles.list}>
      {choices.map((c) => (
        <ChoiceRow
          key={c.id}
          choice={c}
          entry={bag?.[c.id]}
          onChange={(e) => setEntry(c.id, e)}
          db={db}
          owned={owned}
          character={character}
          guided={guided}
          siblingSpellPicks={c.pool?.type === 'spell' ? spellPicksElsewhere(c.id) : null}
        />
      ))}
    </div>
  );
}

function ChoiceRow({ choice, entry, onChange, db, owned, character, guided, siblingSpellPicks }) {
  const picks = entry?.picks ?? [];

  // Título → link do glossário: a feature que concede a escolha (ruleEntry,
  // anexado por buildClassChoices) vence; sem ela, cai na regra genérica do
  // KIND (Size/Skill/Tool Proficiencies… - DDL-0032). Sem regra → texto puro.
  const ruleEntry = choice.ruleEntry ?? kindRuleEntry(db, choice.kind);

  // Contador: no pool 'ability' o alvo depende da ALTERNATIVA escolhida
  // (+2 em um = 1 pick; +1 em dois = 2 picks); sem alternativa, oculto.
  let counter = `${picks.length}/${choice.count}`;
  // Select único (atributo de conjuração / tamanho / lista de magias): o campo
  // já mostra o estado.
  if (choice.pool.type === 'spellAbility' || choice.pool.type === 'size' || choice.pool.type === 'spellSet') counter = null;
  else if (choice.pool.type === 'ability') {
    const alts = choice.pool.alternatives;
    const alt = entry?.alt ?? (alts.length === 1 ? 0 : null);
    counter = alt == null ? null : `${picks.length}/${alts[alt].count}`;
  }

  return (
    <div className={styles.choice}>
      <div className={styles.head}>
        {ruleEntry ? (
          // Título tappável: abre o texto da feature que concede a escolha
          // (Weapon Mastery, Expertise, Eldritch Invocations…) ou a regra do
          // kind no MESMO popup dos links de glossário inline.
          <button type="button" className={styles.labelLink} onClick={() => showRulePopup(ruleEntry)}>
            {choice.label}
          </button>
        ) : (
          <span className={styles.label}>{choice.label}</span>
        )}
        {counter && <span className={styles.counter}>{counter}</span>}
      </div>
      {choice.pool.type === 'feat' ? (
        <FeatChoice choice={choice} entry={entry} picks={picks} onChange={onChange} db={db} owned={owned} character={character} guided={guided} />
      ) : choice.pool.type === 'optionalfeature' ? (
        <OptionalFeatureChoice choice={choice} picks={picks} onChange={onChange} db={db} character={character} />
      ) : choice.pool.type === 'featureoption' ? (
        <FeatureOptionChoice choice={choice} picks={picks} onChange={onChange} />
      ) : choice.pool.type === 'ability' ? (
        <AbilityChoice choice={choice} entry={entry} picks={picks} onChange={onChange} />
      ) : choice.pool.type === 'spellAbility' || choice.pool.type === 'size' || choice.pool.type === 'spellSet' ? (
        <SelectChoice choice={choice} picks={picks} onChange={onChange} />
      ) : choice.pool.type === 'spell' ? (
        <SpellChoice choice={choice} picks={picks} onChange={onChange} db={db} siblingPicks={siblingSpellPicks} />
      ) : PILL_KINDS.has(choice.kind) ? (
        <PillsChoice choice={choice} picks={picks} onChange={onChange} />
      ) : choice.pool.type === 'any' && Array.isArray(choice.pool.of) ? (
        <MixedChoice choice={choice} picks={picks} onChange={onChange} db={db} owned={owned} />
      ) : (
        // "any" OU "list" (skill/tool/language/expertise/weapon) → SelectorPanel
        // (mostra descrição); pool de LISTA fica restrito às suas opções.
        <TagChoice choice={choice} picks={picks} onChange={onChange} db={db} owned={owned} />
      )}
    </div>
  );
}

/** Escolha via SelectorPanel (com descrição): chips removíveis + "+ Add". Trata
 * "any" (todo o pool), "list" (restrito às opções), "expertise" (restrito às
 * perícias proficientes) e "weapon". Skills/expertise guardam o CÓDIGO. */
function TagChoice({ choice, picks, onChange, db, owned }) {
  const [open, setOpen] = useState(false);
  const kind = choice.kind;
  const entity = ADD_ENTITY[kind];
  const skillLike = SKILL_LIKE.has(kind);
  const allowed =
    choice.pool.type === 'list'
      ? new Set(choice.pool.options.map((o) => String(o.value).toLowerCase()))
      : null;
  const valueOf = (raw) => (skillLike ? skillCode(raw.name) : raw.name);
  const labelOf = (v) => (skillLike ? (SKILL_LABEL[v] ?? v) : v);
  const addLabel = kind === 'expertise' ? 'skill' : kind === 'weaponProf' ? 'weapon' : kind;

  const add = (raw) => {
    const value = valueOf(raw);
    if (!picks.includes(value) && picks.length < choice.count) {
      onChange({ kind, picks: [...picks, value] });
    }
    setOpen(false);
  };
  const remove = (value) => onChange({ kind, picks: picks.filter((p) => p !== value) });
  // Tocar no chip abre a descrição do que foi escolhido (a mesma ficha do
  // seletor) - resolve o raw pelo valor guardado (código de perícia ou nome).
  const openDetail = (value) => {
    if (!entity) return;
    const raw = entity.list(db).find((r) => valueOf(r) === value);
    if (raw) showDetailPopup({ entity, raw, db });
  };

  return (
    <div className={styles.tags}>
      {picks.map((value) => (
        <span key={value} className={styles.tagChip}>
          <button type="button" className={styles.tagLabel} onClick={() => openDetail(value)}>
            {labelOf(value)}
          </button>
          <button type="button" className={styles.tagRemove} onClick={() => remove(value)} aria-label={`Remove ${labelOf(value)}`}>
            ×
          </button>
        </span>
      ))}
      {picks.length < choice.count && (
        <button type="button" className={styles.addBtn} onClick={() => setOpen(true)}>
          + Add {addLabel}
        </button>
      )}
      {open && entity && (
        <SelectorPanel
          entity={entity}
          db={db}
          currentId={null}
          exclude={(raw) => {
            const v = valueOf(raw);
            if (allowed && !allowed.has(String(v).toLowerCase())) return true;
            // Já escolhido NESTA escolha → fora (impede duplicar, ex: a mesma arma
            // duas vezes no Weapon Mastery).
            if (picks.includes(v)) return true;
            // Pool de ferramenta com categoria (ex: anyArtisansTool → AT): restringe
            // às ferramentas daquela(s) categoria(s) (prefixo do baseitem.type).
            // Pode ser ARRAY (Monk: artesão OU instrumento → ['AT','INS']).
            if (kind === 'tool' && choice.pool.category && choice.pool.category.length) {
              const cats = Array.isArray(choice.pool.category) ? choice.pool.category : [choice.pool.category];
              if (!cats.includes(String(raw.type ?? '').split('|')[0])) return true;
            }
            // Proficiência de arma individual (Kensei) E Weapon Mastery com
            // restrição de classe (Barbarian = melee, TC-0021): aplica o filtro
            // do pool (melee/ranged, sem Heavy/Special, exceções nomeadas).
            if ((kind === 'weaponProf' || kind === 'weapon') && !weaponFilterAllows(choice.pool.weaponFilter, raw)) return true;
            // Dedup: expertise exclui perícias JÁ com expertise (owned.expertise);
            // skill/tool/language excluem o que a ficha já tem.
            return isOwned(owned, kind, v);
          }}
          onSelect={add}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Escolha de OPTIONAL FEATURES (invocations, metamagic, maneuvers, infusions…):
 * chips + "+ Add" via SelectorPanel (entity por featureType, ciente do
 * personagem p/ colorir pré-requisitos). Picks = "Nome|Fonte". De-dup pelo id;
 * confirma ao escolher uma opção cujo pré-requisito não é cumprido (como feats). */
function OptionalFeatureChoice({ choice, picks, onChange, db, character }) {
  const [open, setOpen] = useState(false);
  const ctx = character ? prereqContext(character, { db }) : null;
  const entity = makeOptionalFeatureEntity(choice.pool.featureType, choice.label, ctx);
  // Eldritch Invocations abrem com "Prerequisites: Met" pré-marcado (têm muitos
  // pré-requisitos de nível/pact/invocation). Outros tipos de optional feature
  // não têm pré-req, então o filtro não os afetaria - restringe-se a invocações.
  const isInvocation = (choice.pool.featureType ?? []).includes('EI');

  const nameOf = (id) => id.split('|')[0];
  const add = (raw) => {
    const id = `${raw.name}|${raw.source}`;
    if (!picks.includes(id) && picks.length < choice.count) {
      onChange({ kind: 'optionalfeature', picks: [...picks, id] });
    }
    setOpen(false);
  };
  const remove = (id) => onChange({ kind: 'optionalfeature', picks: picks.filter((p) => p !== id) });
  // Tocar no chip abre a descrição da optional feature escolhida (invocation,
  // metamagic, maneuver…) - resolve o raw pelo id "Nome|Fonte".
  const openDetail = (id) => {
    const raw = entity.list(db).find((f) => `${f.name}|${f.source}` === id);
    if (raw) showDetailPopup({ entity, raw, db });
  };

  const confirmAdd = async (raw) => {
    if (ctx) {
      const status = prereqStatus(raw, ctx);
      if ((status === 'bad' || status === 'unknown') && !(await confirmPrereq(raw, status))) return;
    }
    add(raw);
  };

  return (
    <div className={styles.tags}>
      {picks.map((id) => (
        <span key={id} className={styles.tagChip}>
          <button type="button" className={styles.tagLabel} onClick={() => openDetail(id)}>
            {nameOf(id)}
          </button>
          <button type="button" className={styles.tagRemove} onClick={() => remove(id)} aria-label={`Remove ${nameOf(id)}`}>
            ×
          </button>
        </span>
      ))}
      {picks.length < choice.count && (
        <button type="button" className={styles.addBtn} onClick={() => setOpen(true)}>
          + Add
        </button>
      )}
      {open && (
        <SelectorPanel
          entity={entity}
          db={db}
          currentId={null}
          initialFilterState={isInvocation ? PREREQ_MET_FILTER : undefined}
          exclude={(raw) => picks.includes(`${raw.name}|${raw.source}`)}
          onSelect={confirmAdd}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Escolha de sub-feature embutida (Divine/Primal Order, Elemental Fury): cards
 * selecionáveis com nome + descrição; toca p/ marcar até `count`. Picks = "Nome|Fonte".
 */
function FeatureOptionChoice({ choice, picks, onChange }) {
  const toggle = (value) => {
    if (picks.includes(value)) {
      onChange({ kind: 'featureoption', picks: picks.filter((p) => p !== value) });
    } else if (picks.length < choice.count) {
      onChange({ kind: 'featureoption', picks: [...picks, value] });
    } else if (choice.count === 1) {
      // count 1: tocar noutra opção TROCA a seleção.
      onChange({ kind: 'featureoption', picks: [value] });
    }
  };

  // Escolha COMPLETA colapsa as opções não escolhidas para só o nome (TC-0017:
  // com "Dreadnaught" marcado, os textos de Guardian/Infiltrator saem da frente).
  // Continuam tocáveis - com count 1, um toque troca a seleção e reabre o texto.
  const complete = picks.length >= choice.count;

  return (
    <div className={styles.optionCards}>
      {choice.pool.options.map((opt) => {
        const selected = picks.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            className={selected ? `${styles.optionCard} ${styles.optionCardSel}` : styles.optionCard}
            onClick={() => toggle(opt.value)}
            aria-pressed={selected}
          >
            <span className={styles.optionName}>{opt.label}</span>
            {(!complete || selected) && (
              <span className={styles.optionDesc}>
                <EntryContent entries={opt.entries} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * ASI embutido num talento (pool 'ability'). Com uma alternativa só (ex:
 * Athlete: +1 em Str ou Dex) mostra direto os selects; com várias (feat ASI:
 * +2 em um OU +1 em dois) mostra botões de modo antes. Picks: {ability, amount}.
 */
function AbilityChoice({ choice, entry, picks, onChange }) {
  const alts = choice.pool.alternatives;
  const alt = entry?.alt ?? (alts.length === 1 ? 0 : null);
  const spec = alt != null ? alts[alt] : null;

  const altLabel = (a) => `+${a.amount} to ${a.count === 1 ? 'one' : a.count === 2 ? 'two' : a.count} ${a.count === 1 ? 'ability' : 'abilities'}`;
  const setAlt = (i) => onChange({ kind: 'ability', alt: i, picks: [] });
  const setAbility = (slot, ability) => {
    const next = picks.slice(0, spec.count);
    next[slot] = ability ? { ability, amount: spec.amount } : null;
    onChange({ kind: 'ability', alt, picks: next.filter(Boolean) });
  };
  const used = new Set(picks.map((p) => p.ability));

  return (
    <div className={styles.abilityChoice}>
      {alts.length > 1 && (
        <div className={styles.modeRow}>
          {alts.map((a, i) => (
            <button
              key={i}
              type="button"
              className={alt === i ? `${styles.modeBtn} ${styles.modeActive}` : styles.modeBtn}
              onClick={() => setAlt(i)}
            >
              {altLabel(a)}
            </button>
          ))}
        </div>
      )}
      {spec && (
        <div className={styles.abilityRows}>
          {Array.from({ length: spec.count }).map((_, i) => {
            const current = picks[i]?.ability ?? '';
            return (
              <div className={styles.abilityRow} key={i}>
                <span className={styles.abilityAmount}>+{spec.amount}</span>
                <ClearableSelect value={current} onChange={(v) => setAbility(i, v)} placeholder="Choose ability…">
                  {spec.from
                    .filter((a) => !used.has(a) || a === current)
                    .map((a) => (
                      <option key={a} value={a}>
                        {ABILITY_FULL[a] ?? a}
                      </option>
                    ))}
                </ClearableSelect>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Escolha de UM valor num select simples (pools 'spellAbility' e 'size'):
 * o atributo de conjuração de uma origem que concede magias (linhagem élfica,
 * talento…) ou o TAMANHO da espécie (raças Small/Medium à escolha). O pick vai
 * no choice-bag com o kind do próprio descritor.
 */
function SelectChoice({ choice, picks, onChange }) {
  const current = picks[0] ?? '';
  const placeholder =
    choice.pool.type === 'size' ? 'Choose size…'
    : choice.pool.type === 'spellSet' ? 'Choose spell list…'
    : 'Choose ability…';
  const set = (v) => onChange(v ? { kind: choice.kind, picks: [v] } : null);
  return (
    <div className={styles.abilityRows}>
      <div className={styles.abilityRow}>
        <ClearableSelect value={current} onChange={set} placeholder={placeholder}>
          {choice.pool.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </ClearableSelect>
      </div>
    </div>
  );
}

/** Kinds de lista curta sem entity - renderizados como pills de toggle: traços
 * de dano (TC-0014) e proficiência de save (escolha condicional de subclasse,
 * TC-0012: Gloom Stalker/Samurai "Int ou Cha"). */
const PILL_KINDS = new Set(['resist', 'immune', 'vulnerable', 'save']);

/**
 * Escolha de LISTA CURTA sem entity (tipos de dano do `resist`/`immune`/
 * `vulnerable`, ex: Boon of Energy Resistance): pills de toggle até `count`;
 * com count 1, tocar noutra opção troca a seleção.
 */
function PillsChoice({ choice, picks, onChange }) {
  const toggle = (value) => {
    if (picks.includes(value)) {
      onChange({ kind: choice.kind, picks: picks.filter((p) => p !== value) });
    } else if (picks.length < choice.count) {
      onChange({ kind: choice.kind, picks: [...picks, value] });
    } else if (choice.count === 1) {
      onChange({ kind: choice.kind, picks: [value] });
    }
  };
  return (
    <div className={styles.pillsWrap}>
      {choice.pool.options.map((opt) => {
        const selected = picks.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            className={selected ? `${styles.modeBtn} ${styles.modeActive}` : styles.modeBtn}
            onClick={() => toggle(opt.value)}
            aria-pressed={selected}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Escolha de MAGIA de um `additionalSpells` (TC-0011 - Magic Initiate, High
 * Elf, Pact of the Tome…): chips + "+ Add" abrindo o seletor de magias
 * restrito ao filtro da folha `{choose}` (nível/classe/escola/ritual/ataque
 * ou lista fechada `{from}`). Picks = "Nome|Fonte".
 */
function SpellChoice({ choice, picks, onChange, db, siblingPicks }) {
  const [open, setOpen] = useState(false);
  // makeSpellEntity constrói o índice magia→classes (varre spell-sources);
  // memoizado por db para não recomputar a cada render.
  const entity = useMemo(() => makeSpellEntity(db), [db]);
  const eligible = useMemo(() => spellChoosePredicate(choice.pool, db), [choice.pool, db]);

  const nameOf = (id) => id.split('|')[0];
  const add = (raw) => {
    const id = `${raw.name}|${raw.source}`;
    if (!picks.includes(id) && !siblingPicks?.has(id) && picks.length < choice.count) {
      onChange({ kind: 'spell', picks: [...picks, id] });
    }
    setOpen(false);
  };
  const remove = (id) => onChange({ kind: 'spell', picks: picks.filter((p) => p !== id) });
  // Tocar no chip abre a ficha da magia escolhida (o mesmo DetailView do seletor).
  const openDetail = (id) => {
    const [name, source] = id.split('|');
    const raw = entity.list(db).find((s) => s.name === name && (!source || s.source === source));
    if (raw) showDetailPopup({ entity, raw, db });
  };

  return (
    <div className={styles.tags}>
      {picks.map((id) => (
        <span key={id} className={styles.tagChip}>
          <button type="button" className={styles.tagLabel} onClick={() => openDetail(id)}>
            {nameOf(id)}
          </button>
          <button type="button" className={styles.tagRemove} onClick={() => remove(id)} aria-label={`Remove ${nameOf(id)}`}>
            ×
          </button>
        </span>
      ))}
      {picks.length < choice.count && (
        <button type="button" className={styles.addBtn} onClick={() => setOpen(true)}>
          + Add spell
        </button>
      )}
      {open && (
        <SelectorPanel
          entity={entity}
          db={db}
          currentId={null}
          exclude={(raw) =>
            !eligible(raw) ||
            picks.includes(`${raw.name}|${raw.source}`) ||
            // Já escolhida num choose de magia IRMÃO (Magical Discoveries ×2 - TC-0025).
            (siblingPicks?.has(`${raw.name}|${raw.source}`) ?? false)
          }
          onSelect={add}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** Pool MISTO (ex: Skilled "3 skills or tools"): chips + um "+ Add" por tipo. */
function MixedChoice({ choice, picks, onChange, db, owned }) {
  const [addKind, setAddKind] = useState(null);

  const add = (kind, raw) => {
    const value = kind === 'skill' ? skillCode(raw.name) : raw.name;
    if (!picks.some((p) => p.value === value) && picks.length < choice.count) {
      onChange({ kind: choice.kind, picks: [...picks, { kind, value }] });
    }
    setAddKind(null);
  };
  const remove = (value) => onChange({ kind: choice.kind, picks: picks.filter((p) => p.value !== value) });
  const labelFor = (p) => (p.kind === 'skill' ? (SKILL_LABEL[p.value] ?? p.value) : p.value);
  // Tocar no chip abre a descrição do que foi escolhido (perícia ou ferramenta).
  const openDetail = (p) => {
    const ent = ADD_ENTITY[p.kind];
    if (!ent) return;
    const raw = ent.list(db).find((r) => (p.kind === 'skill' ? skillCode(r.name) : r.name) === p.value);
    if (raw) showDetailPopup({ entity: ent, raw, db });
  };

  return (
    <div className={styles.tags}>
      {picks.map((p) => (
        <span key={p.value} className={styles.tagChip}>
          <button type="button" className={styles.tagLabel} onClick={() => openDetail(p)}>
            {labelFor(p)}
          </button>
          <button type="button" className={styles.tagRemove} onClick={() => remove(p.value)} aria-label={`Remove ${labelFor(p)}`}>
            ×
          </button>
        </span>
      ))}
      {picks.length < choice.count &&
        choice.pool.of.map((kind) => (
          <button key={kind} type="button" className={styles.addBtn} onClick={() => setAddKind(kind)}>
            + Add {kind}
          </button>
        ))}
      {addKind && ADD_ENTITY[addKind] && (
        <SelectorPanel
          entity={ADD_ENTITY[addKind]}
          db={db}
          currentId={null}
          exclude={(raw) => {
            const v = addKind === 'skill' ? skillCode(raw.name) : raw.name;
            // `fromByKind` restringe as opções de um dos tipos (Cavalier/Samurai:
            // perícia SÓ da lista, idioma qualquer - TC-0012).
            const from = choice.fromByKind?.[addKind];
            if (from && !from.includes(v)) return true;
            return isOwned(owned, addKind, v);
          }}
          onSelect={(raw) => add(addKind, raw)}
          onClose={() => setAddKind(null)}
        />
      )}
    </div>
  );
}

/** Escolha de talento: PickerField por slot (entity da CATEGORIA do pool -
 * O/G/FS/EB, ciente do personagem p/ colorir pré-requisitos); cada talento
 * escolhido RECURSA (sub-escolhas, incl. ASI; legacy ganha +1 livre). */
function FeatChoice({ choice, entry, picks, onChange, db, owned, character, guided }) {
  const cats = choice.pool.category ?? ['O'];
  // TC-0029: `extraCategories` (ASI: O/EB; Epic Boon: G/O) entram na LISTA, mas
  // a categoria padrão vem pré-marcada como filtro removível - mesmo padrão dos
  // seletores de magia (DDL-0026). Os avisos de pré-requisito seguem valendo.
  const extraCats = choice.pool.extraCategories ?? [];
  // Pools de Fighting Style CONCEDEM a feature homônima - pré-requisito atendido.
  const granted = cats.some((c) => c.startsWith('FS')) ? ['Fighting Style'] : [];
  const ctx = character ? prereqContext(character, { db, grantedFeatures: granted }) : null;
  // `only` (opcional) restringe a nomes específicos - ex: fighting style de subclasse
  // (College of Swords → Dueling / Two-Weapon Fighting).
  const featEntity = makeFeatEntity(
    [...cats, ...extraCats],
    FEAT_CATEGORY_TITLE[cats[0]] ?? 'Feat',
    ctx,
    choice.pool.only ?? null,
    { categoryFilter: extraCats.length > 0 },
  );
  const initialFilters = {
    ...(guided ? PREREQ_MET_FILTER : {}),
    ...(extraCats.length > 0 ? { category: Object.fromEntries(cats.map((c) => [c, 'include'])) } : {}),
  };

  const setPick = (index, featId) => {
    const oldId = picks[index];
    const nextPicks = [...picks];
    if (featId == null) nextPicks.splice(index, 1);
    else nextPicks[index] = featId;
    const sub = { ...(entry?.sub ?? {}) };
    if (oldId && oldId !== featId) delete sub[oldId];
    onChange({ kind: 'feat', picks: nextPicks.filter(Boolean), sub });
  };
  const setSub = (featId, subBag) =>
    onChange({ kind: 'feat', picks, sub: { ...(entry?.sub ?? {}), [featId]: subBag } });

  // Selecionar sem cumprir pré-requisito pede confirmação; incerto manda
  // confirmar com o mestre.
  const confirmPick = async (index, raw) => {
    if (ctx) {
      const status = prereqStatus(raw, ctx);
      if ((status === 'bad' || status === 'unknown') && !(await confirmPrereq(raw, status))) return;
    }
    setPick(index, `${raw.name}|${raw.source}`);
  };

  return (
    <div className={styles.list}>
      {Array.from({ length: choice.count }).map((_, i) => {
        const featId = picks[i] ?? null;
        const featData = featId ? resolveFeat(db, featId) : null;
        // Feats LEGACY sem bônus próprio ganham +1 livre (adaptação DMG 2024).
        // Nível + sub-bag alimentam as escolhas de MAGIA do feat (TC-0011).
        const level = character ? totalLevel(character) : Infinity;
        const subChoices = featData
          ? [...parseChoices(featData, { level, bag: entry?.sub?.[featId] ?? null }), ...(hasFreeLegacyBonus(featData) ? [LEGACY_ABILITY_CHOICE] : [])]
          : [];
        const [name, source] = featId ? featId.split('|') : [];
        return (
          <div className={styles.featSlot} key={i}>
            <PickerField
              entity={featEntity}
              db={db}
              current={featId ? { label: name, source, id: featId } : null}
              placeholder="Choose feat…"
              initialFilterState={Object.keys(initialFilters).length ? initialFilters : undefined}
              // Esconde talentos já tomados na ficha - exceto o deste slot e os repeatable.
              exclude={(raw) => {
                const id = `${raw.name}|${raw.source}`;
                if (id === featId || raw.repeatable) return false;
                return owned?.feats?.has(id) ?? false;
              }}
              onSelect={(raw) => confirmPick(i, raw)}
              onClear={() => setPick(i, null)}
            />
            {subChoices.length > 0 && (
              <div className={styles.nested}>
                <ChoiceList
                  choices={subChoices}
                  bag={entry?.sub?.[featId] ?? {}}
                  db={db}
                  owned={owned}
                  character={character}
                  guided={guided}
                  onChange={(subBag) => setSub(featId, subBag)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

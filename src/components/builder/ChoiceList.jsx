// =============================================================================
// ChoiceList: o renderer genérico e recursivo de sub-escolhas
// =============================================================================
// O QUE FAZ
//   Recebe descritores Choice (de parseChoices ou classFeatureChoices) e o
//   choice-bag salvo, e renderiza cada escolha pelo tipo de pool:
//     list e any: chips removíveis e "+ Add" (SelectorPanel).
//     misto (Skilled): um "+ Add" por tipo, com o orçamento compartilhado.
//     expertise: como perícia, restrita às PROFICIENTES.
//     weapon e weaponProf: armas, com o filtro do pool.
//     optional features, sub-features (cards), ability (ASI embutido), select
//       (atributo de conjuração, tamanho), pills (tipos de dano, save), spell.
//     feat: um PickerField por slot; ao escolher um talento, RECURSA nas escolhas
//       DELE logo abaixo (estilo Pathbuilder).
//   É um dos dois choke-points do app (DDL-0042): deriva o que precisa aqui, em vez
//   de receber por prop de cada chamador.
//
// FUNÇÕES
//   confirmPrereq(raw, status): confirma ao escolher com pré-requisito falho ou
//     incerto ("confirme com o mestre").
//   normVal(kind, v), isOwned(owned, kind, value): o dedup contra a ficha.
//   ChoiceList(props): a lista.
//   ChoiceRow(props): uma escolha, com título e contador.
//   TagChoice, OptionalFeatureChoice, FeatureOptionChoice, AbilityChoice,
//     SelectChoice, PillsChoice, SpellChoice, MixedChoice, FeatChoice: os tipos.
//
// DECISÕES E ARMADILHAS
//   - DEDUP: `owned` (tudo que a ficha tem) impede escolher duas vezes; talentos
//     `repeatable` escapam. Expertise exclui as que já têm expertise.
//   - Tocar num chip abre a descrição do escolhido (DDL-0021).
//   - Escolha de mais de um (perícias, idiomas, optional features, magias, o
//     misto) abre o seletor em modo MÚLTIPLO (`multi`): ele segue aberto até a
//     escolha completar, com o "n of total" no título e a faixa do que já foi
//     escolhido. Cada `add` só fecha o painel quando a contagem fecha.
//   - O título é link para a feature que concede a escolha (`ruleEntry`), senão
//     para a regra do KIND (choiceRules, DDL-0032); sem regra, texto.
//   - `guided` (dentro do guia): "Prerequisites: Met" pré-marcado nos talentos.
//     As Eldritch Invocations o têm sempre (muitos pré-requisitos).
//   - TC-0034: as magias que a ficha JÁ tem viram o filtro "Already Prepared"
//     pré-marcado, o badge e a confirmação (o fluxo DDL-0040). Derivado só aqui, e
//     só com um picker de magia por perto (pool `spell`, ou `feat` que pode ter
//     Magic Initiate); a lista aninhada recebe o mapa pronto. Nenhuma origem é
//     excluída: o grant FIXO da mesma entidade ao lado do choose é o caso a avisar.
//   - Trocar a LISTA de magias (spellSet) descarta os picks de magia irmãos
//     (TC-0011); dois chooses irmãos não escolhem a mesma magia (TC-0025).
//   - Sub-feature completa colapsa as não escolhidas para o nome (TC-0017); com
//     count 1, tocar noutra troca.
//   - Talento: as `extraCategories` entram atrás do filtro padrão (TC-0029); o
//     pool de Fighting Style concede a feature homônima; `only` restringe nomes;
//     legacy ganha +1 livre; os já tomados somem, salvo o deste slot e os
//     repeatable.
//   - Ferramenta com categoria (anyArtisansTool) restringe ao prefixo do tipo, e
//     pode ser lista (o Monge: artesão OU instrumento). `fromByKind` restringe um
//     dos tipos do pool misto (Cavalier, Samurai).
// -----------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { parseChoices, LEGACY_ABILITY_CHOICE, weaponFilterAllows } from '../../engine/choices';
import { resolveFeat, deriveFromDb } from '../../engine/resolve';
import { preparedElsewhere } from '../../engine/spellcasting';
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
  expertise: skillEntity,
  weapon: weaponEntity,
  weaponProf: weaponEntity,
};
const OWNED_KEY = { skill: 'skills', tool: 'tools', language: 'languages', expertise: 'expertise' };

const PREREQ_MET_FILTER = { prereq: { ok: 'include' } };

function confirmPrereq(raw, status) {
  const message =
    status === 'bad'
      ? `${raw.name} has prerequisites your character does not meet. Select it anyway?`
      : `${raw.name} has prerequisites that cannot be checked automatically. Confirm with your Dungeon Master. Select it anyway?`;
  return confirm({ title: 'Prerequisite not met', message, confirmLabel: 'Select anyway' });
}

const SKILL_LIKE = new Set(['skill', 'expertise']);

/** Normaliza um valor para comparação (perícia em código, o resto em minúsculas). */
function normVal(kind, v) {
  return SKILL_LIKE.has(kind) ? v : String(v).toLowerCase();
}

/** O valor já está na ficha? */
function isOwned(owned, kind, value) {
  return owned?.[OWNED_KEY[kind]]?.has(normVal(kind, value)) ?? false;
}

export default function ChoiceList({ choices, bag, onChange, db, owned, character, guided = false, spellsOwned }) {
  const needsSpellsOwned =
    !spellsOwned &&
    !!character &&
    !!db &&
    (choices ?? []).some((c) => c.pool?.type === 'spell' || c.pool?.type === 'feat');
  const derivedSpellsOwned = useMemo(
    () => (needsSpellsOwned ? preparedElsewhere(deriveFromDb(character, db)?.spellcasting?.origins) : null),
    [needsSpellsOwned, character, db],
  );
  const owns = spellsOwned ?? derivedSpellsOwned;

  if (!choices?.length) return null;

  const setEntry = (id, entry) => {
    const next = { ...(bag ?? {}) };
    const prev = bag?.[id];
    if (entry == null) delete next[id];
    else next[id] = entry;
    if ((entry?.kind === 'spellSet' || prev?.kind === 'spellSet') && prev?.picks?.[0] !== entry?.picks?.[0]) {
      const prefix = id.slice(0, id.lastIndexOf('spellSet-'));
      for (const k of Object.keys(next)) {
        if (k.startsWith(`${prefix}spell-`) && next[k]?.kind === 'spell') delete next[k];
      }
    }
    onChange(next);
  };

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
          spellsOwned={owns}
        />
      ))}
    </div>
  );
}

function ChoiceRow({ choice, entry, onChange, db, owned, character, guided, siblingSpellPicks, spellsOwned }) {
  const picks = entry?.picks ?? [];

  const ruleEntry = choice.ruleEntry ?? kindRuleEntry(db, choice.kind);

  let counter = `${picks.length}/${choice.count}`;
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
          <button type="button" className={styles.labelLink} onClick={() => showRulePopup(ruleEntry)}>
            {choice.label}
          </button>
        ) : (
          <span className={styles.label}>{choice.label}</span>
        )}
        {counter && <span className={styles.counter}>{counter}</span>}
      </div>
      {choice.pool.type === 'feat' ? (
        <FeatChoice choice={choice} entry={entry} picks={picks} onChange={onChange} db={db} owned={owned} character={character} guided={guided} spellsOwned={spellsOwned} />
      ) : choice.pool.type === 'optionalfeature' ? (
        <OptionalFeatureChoice choice={choice} picks={picks} onChange={onChange} db={db} character={character} />
      ) : choice.pool.type === 'featureoption' ? (
        <FeatureOptionChoice choice={choice} picks={picks} onChange={onChange} />
      ) : choice.pool.type === 'ability' ? (
        <AbilityChoice choice={choice} entry={entry} picks={picks} onChange={onChange} />
      ) : choice.pool.type === 'spellAbility' || choice.pool.type === 'size' || choice.pool.type === 'spellSet' ? (
        <SelectChoice choice={choice} picks={picks} onChange={onChange} />
      ) : choice.pool.type === 'spell' ? (
        <SpellChoice choice={choice} picks={picks} onChange={onChange} db={db} siblingPicks={siblingSpellPicks} spellsOwned={spellsOwned} />
      ) : PILL_KINDS.has(choice.kind) ? (
        <PillsChoice choice={choice} picks={picks} onChange={onChange} />
      ) : choice.pool.type === 'any' && Array.isArray(choice.pool.of) ? (
        <MixedChoice choice={choice} picks={picks} onChange={onChange} db={db} owned={owned} />
      ) : (
        <TagChoice choice={choice} picks={picks} onChange={onChange} db={db} owned={owned} />
      )}
    </div>
  );
}

/** Escolha pelo SelectorPanel: chips removíveis e "+ Add". */
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
    let total = picks.length;
    if (!picks.includes(value) && picks.length < choice.count) {
      onChange({ kind, picks: [...picks, value] });
      total += 1;
    }
    if (total >= choice.count) setOpen(false);
  };
  const remove = (value) => onChange({ kind, picks: picks.filter((p) => p !== value) });
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
            if (picks.includes(v)) return true;
            if (kind === 'tool' && choice.pool.category && choice.pool.category.length) {
              const cats = Array.isArray(choice.pool.category) ? choice.pool.category : [choice.pool.category];
              if (!cats.includes(String(raw.type ?? '').split('|')[0])) return true;
            }
            if ((kind === 'weaponProf' || kind === 'weapon') && !weaponFilterAllows(choice.pool.weaponFilter, raw)) return true;
            return isOwned(owned, kind, v);
          }}
          onSelect={add}
          multi={{ total: choice.count, chosen: picks.map((v) => ({ key: v, label: labelOf(v) })), onRemove: remove }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** Escolha de optional features (invocations, metamagic...). */
function OptionalFeatureChoice({ choice, picks, onChange, db, character }) {
  const [open, setOpen] = useState(false);
  const ctx = character ? prereqContext(character, { db }) : null;
  const entity = makeOptionalFeatureEntity(choice.pool.featureType, choice.label, ctx);
  const isInvocation = (choice.pool.featureType ?? []).includes('EI');

  const nameOf = (id) => id.split('|')[0];
  const add = (raw) => {
    const id = `${raw.name}|${raw.source}`;
    let total = picks.length;
    if (!picks.includes(id) && picks.length < choice.count) {
      onChange({ kind: 'optionalfeature', picks: [...picks, id] });
      total += 1;
    }
    if (total >= choice.count) setOpen(false);
  };
  const remove = (id) => onChange({ kind: 'optionalfeature', picks: picks.filter((p) => p !== id) });
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
          multi={{ total: choice.count, chosen: picks.map((id) => ({ key: id, label: nameOf(id) })), onRemove: remove }}
        />
      )}
    </div>
  );
}

/** Escolha de sub-feature: cards selecionáveis até `count`. */
function FeatureOptionChoice({ choice, picks, onChange }) {
  const toggle = (value) => {
    if (picks.includes(value)) {
      onChange({ kind: 'featureoption', picks: picks.filter((p) => p !== value) });
    } else if (picks.length < choice.count) {
      onChange({ kind: 'featureoption', picks: [...picks, value] });
    } else if (choice.count === 1) {
      onChange({ kind: 'featureoption', picks: [value] });
    }
  };

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

/** O ASI embutido num talento. */
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

/** Um valor num select (atributo de conjuração, tamanho). */
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

const PILL_KINDS = new Set(['resist', 'immune', 'vulnerable', 'save']);

/** Lista curta sem entity, em pills de toggle. */
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

/** Escolha de magia de um `additionalSpells`. */
function SpellChoice({ choice, picks, onChange, db, siblingPicks, spellsOwned }) {
  const [open, setOpen] = useState(false);
  const entity = useMemo(() => makeSpellEntity(db, { preparedElsewhere: spellsOwned }), [db, spellsOwned]);
  const eligible = useMemo(() => spellChoosePredicate(choice.pool, db), [choice.pool, db]);

  const nameOf = (id) => id.split('|')[0];
  const add = async (raw) => {
    const id = `${raw.name}|${raw.source}`;
    if (!picks.includes(id) && !siblingPicks?.has(id) && picks.length < choice.count) {
      const from = spellsOwned?.get(raw.name.toLowerCase());
      if (from) {
        const ok = await confirm({
          title: 'Add this spell?',
          message: `You already have ${raw.name} from ${from}. Add it anyway?`,
          confirmLabel: 'Add anyway',
        });
        if (!ok) return;
      }
      onChange({ kind: 'spell', picks: [...picks, id] });
      if (picks.length + 1 >= choice.count) setOpen(false);
      return;
    }
    if (picks.length >= choice.count) setOpen(false);
  };
  const remove = (id) => onChange({ kind: 'spell', picks: picks.filter((p) => p !== id) });
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
            (siblingPicks?.has(`${raw.name}|${raw.source}`) ?? false)
          }
          initialFilterState={(spellsOwned?.size ?? 0) > 0 ? { owned: { yes: 'exclude' } } : undefined}
          onSelect={add}
          onClose={() => setOpen(false)}
          multi={{ total: choice.count, chosen: picks.map((id) => ({ key: id, label: nameOf(id) })), onRemove: remove }}
        />
      )}
    </div>
  );
}

/** Pool misto: um "+ Add" por tipo. */
function MixedChoice({ choice, picks, onChange, db, owned }) {
  const [addKind, setAddKind] = useState(null);

  const add = (kind, raw) => {
    const value = kind === 'skill' ? skillCode(raw.name) : raw.name;
    let total = picks.length;
    if (!picks.some((p) => p.value === value) && picks.length < choice.count) {
      onChange({ kind: choice.kind, picks: [...picks, { kind, value }] });
      total += 1;
    }
    if (total >= choice.count) setAddKind(null);
  };
  const remove = (value) => onChange({ kind: choice.kind, picks: picks.filter((p) => p.value !== value) });
  const labelFor = (p) => (p.kind === 'skill' ? (SKILL_LABEL[p.value] ?? p.value) : p.value);
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
            const from = choice.fromByKind?.[addKind];
            if (from && !from.includes(v)) return true;
            return isOwned(owned, addKind, v);
          }}
          onSelect={(raw) => add(addKind, raw)}
          onClose={() => setAddKind(null)}
          multi={{ total: choice.count, chosen: picks.map((p) => ({ key: p.value, label: labelFor(p) })), onRemove: remove }}
        />
      )}
    </div>
  );
}

/** Escolha de talento, recursiva nas sub-escolhas dele. */
function FeatChoice({ choice, entry, picks, onChange, db, owned, character, guided, spellsOwned }) {
  const cats = choice.pool.category ?? ['O'];
  const extraCats = choice.pool.extraCategories ?? [];
  const granted = cats.some((c) => c.startsWith('FS')) ? ['Fighting Style'] : [];
  const ctx = character ? prereqContext(character, { db, grantedFeatures: granted }) : null;
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
                  spellsOwned={spellsOwned}
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

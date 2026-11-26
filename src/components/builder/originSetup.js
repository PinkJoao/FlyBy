// =============================================================================
// originSetup: as contas das peças da origem (OriginParts, DDL-0328)
// =============================================================================
// O QUE FAZ
//   O que as peças da origem e os passos do guia perguntam sem desenhar nada: o modo dos
//   bônus, se o +1/+1/+1 é fixo, a entity e a trava do talento de origem e as
//   sub-escolhas que sobram para o jogador.
//
// FUNÇÕES
//   boostMode(boosts): o modo pelo array salvo.
//   classIdOf(character): a classe original, para a recomendação dos bônus.
//   isBoostFixed(origin, db): o +1/+1/+1 de um background pronto (nada a escolher)?
//   originFeatSetup(character, db): a entity do talento, o filtro inicial, se está
//     travado e os ids das sub-escolhas que o background já decide.
//   originFeatChoices(character, db): as sub-escolhas do talento que o jogador faz.
//   chooseBackground(character, db, raw): a origem com o background escolhido, ou null
//     se o jogador cancelou o aviso.
//   clearBackground(character): o X: a origem custom limpa, ou null se cancelou.
//
// DECISÕES E ARMADILHAS
//   - O X volta ao Custom e limpa os campos (`clearOrigin`), com uma confirmação só quando
//     há algo preenchido; escolher o Custom no seletor mantém tudo (`toCustomOrigin`).
//     Trocar para um background pronto confirma quando apaga uma escolha da origem custom
//     (`backgroundSwitchLosses`; §6.4: aviso com o motivo, nunca bloqueio).
//   - Num arquivo sem componente, para o fast refresh (react-refresh) do OriginParts.
//   - Os do Ravenloft dão o talento nomeado OU um Dark Gift: a entity recebe as duas
//     categorias e `only` com os nomes.
// -----------------------------------------------------------------------------

import {
  allowedBoostAbilities, applyBackground, backgroundFeat, backgroundOf, backgroundSwitchLosses, clearOrigin,
  presetFeatChoices, toCustomOrigin,
} from '../../engine/backgrounds';
import { confirm } from '../common/dialog';
import { parseChoices } from '../../engine/choices';
import { resolveFeat } from '../../engine/resolve';
import { prereqContext } from '../../engine/prereq';
import { totalLevel } from '../../schema/character';
import { makeFeatEntity, ORIGIN_FEAT_CATEGORIES } from '../../selector/entities/feat';

/** O modo de boost derivado do array salvo. */
export function boostMode(boosts) {
  if (!boosts || boosts.length === 0) return null;
  return boosts.some((b) => b.amount === 2) ? '2-1' : '1-1-1';
}

/** A classe original, para a recomendação dos bônus. */
export function classIdOf(character) {
  return (character.classes ?? []).find((c) => c.classId)?.classId ?? null;
}

/** O +1/+1/+1 de um background pronto: nada a escolher. */
export function isBoostFixed(origin, db) {
  return !!origin?.background && boostMode(origin.abilityBoosts) === '1-1-1' && allowedBoostAbilities(origin, db).length === 3;
}

/** A entity do talento de origem, o filtro inicial, a trava e as sub-escolhas decididas. */
export function originFeatSetup(character, db) {
  const bg = backgroundOf(character, db);
  const ctx = prereqContext(character, { db });
  if (!bg) {
    return {
      entity: makeFeatEntity(ORIGIN_FEAT_CATEGORIES, 'Origin Feat', ctx, null, { categoryFilter: true }),
      filters: { category: { O: 'include' } },
      locked: false,
      presetIds: [],
    };
  }
  const feat = backgroundFeat(db, bg);
  if (feat.fixed) {
    const preset = presetFeatChoices(db, feat.fixed, feat.fixed.preset);
    return { entity: makeFeatEntity(ORIGIN_FEAT_CATEGORIES, 'Origin Feat', ctx), filters: {}, locked: true, presetIds: preset.locked };
  }
  const names = new Set([
    ...feat.options.map((o) => o.id),
    ...(db?.feats?.feat ?? []).filter((f) => feat.categories.includes(f.category)).map((f) => f.name),
  ]);
  const cats = [...new Set([...feat.options.map(() => 'O'), ...feat.categories])];
  return { entity: makeFeatEntity(cats, 'Origin Feat', ctx, names), filters: {}, locked: false, presetIds: [] };
}

/** As sub-escolhas do talento que o jogador faz (sem as que o background decide). */
export function originFeatChoices(character, db) {
  const originFeat = character.origin?.originFeat;
  if (!originFeat) return [];
  const raw = resolveFeat(db, `${originFeat.id}|${originFeat.source}`);
  if (!raw) return [];
  const { presetIds } = originFeatSetup(character, db);
  return parseChoices(raw, { level: totalLevel(character), bag: originFeat.choices }).filter((c) => !presetIds.includes(c.id));
}

/** A origem com o background escolhido, ou null se o jogador cancelou o aviso. */
export async function chooseBackground(character, db, raw) {
  const origin = character.origin ?? {};
  if (raw.custom) return toCustomOrigin(origin);
  const next = applyBackground(origin, raw, db, { classId: classIdOf(character) });
  const losses = backgroundSwitchLosses(origin, next);
  if (losses.length) {
    const ok = await confirm({
      title: `Use ${raw.name}?`,
      message: `${raw.name} sets its own feat, skills and tool, so ${losses.join(' and ')} you chose will be replaced.`,
      confirmLabel: `Use ${raw.name}`,
    });
    if (!ok) return null;
  }
  return next;
}

/** O X: a origem custom limpa, ou null se o jogador cancelou. */
export async function clearBackground(character) {
  const origin = character.origin ?? {};
  const filled = !!origin.originFeat || Object.keys(origin.choices ?? {}).length > 0;
  if (filled || origin.background) {
    const ok = await confirm({
      title: 'Clear the background?',
      message: 'The background goes back to Custom and its feat, skills, tool and languages are cleared.',
      confirmLabel: 'Clear',
      danger: true,
    });
    if (!ok) return null;
  }
  return clearOrigin(origin, { classId: classIdOf(character) });
}

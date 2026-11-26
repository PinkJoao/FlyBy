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
//
// DECISÕES E ARMADILHAS
//   - Num arquivo sem componente, para o fast refresh (react-refresh) do OriginParts.
//   - Os do Ravenloft dão o talento nomeado OU um Dark Gift: a entity recebe as duas
//     categorias e `only` com os nomes.
// -----------------------------------------------------------------------------

import { allowedBoostAbilities, backgroundFeat, backgroundOf, presetFeatChoices } from '../../engine/backgrounds';
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

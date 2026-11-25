// =============================================================================
// copy: a herança _copy do 5etools
// =============================================================================
// O QUE FAZ
//   Muitas entradas (raças, sobretudo) herdam de um "pai" via `_copy`, com ajustes
//   em `_mod` e metadados preservados em `_preserve`. Sem resolver, size e speed
//   vêm undefined. Aqui a herança é resolvida para todo consumidor ver o objeto
//   completo (§6.2: resolva no caminho de DERIVAÇÃO também).
//
// FUNÇÕES
//   defaultIdOf(e), matchesName(entry, ref): identidade e casamento.
//   replaceTxtDeep(value, re, repl), applyOp(target, prop, op), applyMods(target,
//     modMap): os ops de `_mod` (replace, append, prepend, remove, replaceTxt).
//   stripCopy(entry), resolveOne(entry, byId, seen, idOf): uma entrada.
//   resolveCopies(list, idOf): a lista inteira.
//
// DECISÕES E ARMADILHAS
//   - Os metadados do pai (fonte, página, reprintedAs) não vazam para o filho,
//     salvo os listados em `_preserve`.
//   - Há guarda contra ciclo; pai ausente devolve o filho sem o marcador.
//   - SUBCLASSES precisam de um idOf com classSource: a cópia "compat" de uma
//     subclasse TCE anexada à classe nova colide com a original em name|source.
// -----------------------------------------------------------------------------

const PRESERVE_BLOCKLIST = ['_versions', 'reprintedAs', 'srd', 'basicRules', 'page'];

const defaultIdOf = (e) => `${e.name}|${e.source}`;

function matchesName(entry, ref) {
  const name = typeof ref === 'string' ? ref : ref?.name;
  return entry && typeof entry === 'object' && entry.name === name;
}

function replaceTxtDeep(value, re, repl) {
  if (typeof value === 'string') return value.replace(re, repl);
  if (Array.isArray(value)) return value.map((v) => replaceTxtDeep(v, re, repl));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceTxtDeep(v, re, repl);
    return out;
  }
  return value;
}

function applyOp(target, prop, op) {
  const arr = Array.isArray(target[prop]) ? target[prop] : [];
  switch (op.mode) {
    case 'appendArr':
      target[prop] = arr.concat(op.items);
      break;
    case 'prependArr':
      target[prop] = [].concat(op.items, arr);
      break;
    case 'replaceArr': {
      const idx = arr.findIndex((e) => matchesName(e, op.replace));
      if (idx >= 0) {
        target[prop] = [...arr.slice(0, idx), ...[].concat(op.items), ...arr.slice(idx + 1)];
      }
      break;
    }
    case 'removeArr': {
      const names = [].concat(op.names ?? op.items ?? []);
      target[prop] = arr.filter((e) => !names.some((n) => matchesName(e, n)));
      break;
    }
    case 'replaceTxt': {
      const flags = op.flags || '';
      const re = new RegExp(op.replace, flags.includes('g') ? flags : `${flags}g`);
      target[prop] = replaceTxtDeep(arr, re, op.with ?? '');
      break;
    }
    default:
      break;
  }
}

function applyMods(target, modMap) {
  for (const [prop, raw] of Object.entries(modMap)) {
    const ops = Array.isArray(raw) ? raw : [raw];
    for (const op of ops) {
      if (op && typeof op === 'object' && op.mode) applyOp(target, prop, op);
    }
  }
}

function stripCopy(entry) {
  const out = { ...entry };
  delete out._copy;
  return out;
}

function resolveOne(entry, byId, seen, idOf) {
  if (!entry._copy) return entry;
  const key = idOf(entry);
  if (seen.has(key)) return stripCopy(entry);
  seen.add(key);

  const ref = byId[idOf(entry._copy)];
  if (!ref) return stripCopy(entry);

  const parent = resolveOne(ref, byId, seen, idOf);
  const out = structuredClone(parent);

  const preserve = entry._copy._preserve ?? {};
  for (const k of PRESERVE_BLOCKLIST) if (!preserve[k]) delete out[k];

  for (const [k, v] of Object.entries(entry)) {
    if (k === '_copy') continue;
    out[k] = structuredClone(v);
  }

  if (entry._copy._mod) applyMods(out, entry._copy._mod);
  delete out._copy;
  return out;
}

/**
 * Resolve a herança `_copy` numa lista de entradas.
 * @param {object[]} list
 * @param {(e:object)=>string} [idOf]
 */
export function resolveCopies(list, idOf = defaultIdOf) {
  const arr = list ?? [];
  const byId = {};
  for (const e of arr) byId[idOf(e)] = e;
  return arr.map((e) => (e._copy ? resolveOne(e, byId, new Set(), idOf) : e));
}

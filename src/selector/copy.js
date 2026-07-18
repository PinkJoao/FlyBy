// =============================================================================
// _copy resolution - herança do 5etools
// =============================================================================
// Muitas entradas (raças, sobretudo) não repetem size/speed/traits: elas herdam
// de uma entrada "pai" via `_copy`, aplicando pequenos ajustes com `_mod` e
// preservando alguns metadados com `_preserve`. Sem resolver isso, campos como
// size e speed vêm `undefined`. Resolvemos a herança para que todo consumidor
// veja o objeto já completo.
//
// Escopo dos dados reais (races.json): sem cadeias (_copy de _copy), e `_mod` só
// mexe em `entries`, com os modos replaceArr / appendArr / replaceTxt. A
// implementação cobre também prepend/remove por robustez.
// -----------------------------------------------------------------------------

// Metadados do pai que NÃO devem vazar para o filho, salvo se listados em
// `_copy._preserve`.
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
  if (seen.has(key)) return stripCopy(entry); // guarda contra ciclos
  seen.add(key);

  const ref = byId[idOf(entry._copy)];
  if (!ref) return stripCopy(entry); // pai ausente: devolve o filho sem o marcador

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
 * @param {(e:object)=>string} [idOf]  id de unicidade - o padrão (name|source)
 *   serve p/ raças/feats; SUBCLASSES precisam incluir classSource (a cópia
 *   "compat" de uma subclasse TCE anexada à classe nova colide em name|source
 *   com a original).
 */
export function resolveCopies(list, idOf = defaultIdOf) {
  const arr = list ?? [];
  const byId = {};
  for (const e of arr) byId[idOf(e)] = e;
  return arr.map((e) => (e._copy ? resolveOne(e, byId, new Set(), idOf) : e));
}

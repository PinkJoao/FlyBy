// =============================================================================
// Configuração da camada de dados (5etools)
// =============================================================================
// O app NÃO guarda os JSONs pesados no repositório. Ele busca direto do mirror
// público da comunidade e cacheia no navegador (ver ./cache.js e
// ../hooks/useDataEngine.js).
//
// ATENÇÃO: os mirrors do 5etools migram periodicamente (takedowns por DMCA). Se
// o MIRROR principal cair, troque a ordem de MIRRORS ou adicione um novo. O
// engine tenta cada mirror em ordem até um responder.
// -----------------------------------------------------------------------------

/**
 * Bases de URL candidatas, em ordem de preferência. Cada uma deve terminar em
 * `/data/`. O fetcher tenta da primeira para a última.
 * Confirmado ativo em 2026-06-29: 5etools-mirror-3/5etools-src (branch main).
 */
export const MIRRORS = [
  'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/',
];

/** Arquivos da raiz de /data que carregamos sempre. */
export const GLOBAL_FILES = [
  'races.json',
  'skills.json',
  'items-base.json',
  'items.json',
  'fluff-items.json',
  'languages.json',
  'feats.json',
  'senses.json',
  'optionalfeatures.json',
  'fluff-races.json',
  'variantrules.json',
  // Só pelas tabelas "Suggested Characteristics" (traços/ideais/laços/defeitos)
  // que alimentam o randomizador de biografia. Arquivo core do 5etools (200 no
  // mirror). Não buscamos fluff-backgrounds (arte/lore, sem uso aqui).
  'backgrounds.json',
  // Glossário de regras (condições/status/doenças + ações). Verificados 200 no
  // mirror em 2026-07-15 - NUNCA adicione um caminho sem verificar (um 404
  // quebra o Promise.all do fetch inteiro).
  'conditionsdiseases.json',
  'actions.json',
  // Variantes genéricas de itens mágicos (+1 Weapon, Weapon of Warning…) - o
  // engine expande em variantes ESPECÍFICAS (+1 Longsword) sobre os itens base,
  // como o 5etools faz (engine/magicVariants.js). Verificado 200 em 2026-07-16.
  'magicvariants.json',
  // Overlay de mecânicas Foundry do 5etools (DDL-0009: é MIT, NÃO é Plutonium):
  // Active Effects curados upstream p/ feats, traços de raça e optional features
  // (engine/foundryOverlay.js). Verificados 200 no mirror em 2026-07-17 - os
  // bytes batem com o snapshot local. foundry-backgrounds.json NÃO existe no
  // mirror (404, Plutonium-only) e foundry-psionics.json é um {} vazio - fora.
  'foundry-feats.json',
  'foundry-races.json',
  'foundry-optionalfeatures.json',
];

/** Classes oficiais - baixadas de /data/class/class-${name}.json. */
export const CLASS_NAMES = [
  'artificer',
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'wizard',
  'warlock',
];

/**
 * Fontes de MAGIAS - baixadas de /data/spells/spells-${src}.json (uma por
 * livro). Enumeradas a partir de spells/index.json e confirmadas ativas no
 * mirror em 2026-07-09 (todas as 17 = HTTP 200). A magia carrega sua própria
 * `source` (ex: "XPHB"); o engine (engine/spells.js) concatena todos os arquivos
 * num só catálogo e deduplica reprints (PHB→XPHB) via latestOnly, como itens.
 * O mapa magia→classe NÃO fica na magia: vem de spells/sources.json
 * (SPELL_CLASS_MAP_FILE) - ver engine/spells.js `classSpellList`.
 */
export const SPELL_SOURCES = [
  'aag', 'ai', 'aitfr-avt', 'bmt', 'efa', 'egw', 'ftd', 'frhof', 'ggr',
  'idrotf', 'llk', 'phb', 'sato', 'scc', 'tce', 'xge', 'xphb',
];

/** Subconjunto de SPELL_SOURCES que tem arquivo de fluff (arte/lore) -
 * spells/fluff-spells-${src}.json. Só estes 9 existem no mirror (confirmado
 * 2026-07-09); incluir um inexistente quebraria o Promise.all inteiro. */
export const SPELL_FLUFF_SOURCES = [
  'aag', 'egw', 'ftd', 'frhof', 'ggr', 'phb', 'tce', 'xge', 'xphb',
];

/** Validade do cache: 30 dias em milissegundos. */
export const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

// --- Sync econômico por SHA (baixa só o que mudou) ---------------------------
// Em vez de re-baixar os ~65 arquivos a cada expiração, consultamos a API do
// GitHub o SHA de blob (hash do conteúdo) de cada arquivo e baixamos via raw só
// os que mudaram (ver data/fetcher.js `syncCompendium`). Isso reduz muito a
// banda consumida do GitHub deles quando o app tem muitos usuários. Só funciona
// se o mirror for o raw.githubusercontent.com (senão o sync se desliga e cai no
// download completo). O `raw` NÃO serve para isso: bloqueia por CORS ler o ETag
// e enviar If-None-Match (testado) - por isso usamos a API, cujo limite é 60
// req/h POR IP do usuário (fazemos ~5 req a cada 30 dias).

const GITHUB_API = 'https://api.github.com';

/**
 * Extrai `{ owner, repo, branch }` do MIRROR primário quando ele é o
 * raw.githubusercontent.com. Retorna null para qualquer outro host (aí o sync
 * por SHA fica desativado e o app usa o download completo).
 */
export function githubRepoFromMirror(mirror = MIRRORS[0]) {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\//.exec(mirror ?? '');
  return m ? { owner: m[1], repo: m[2], branch: m[3] } : null;
}

/** URL da Contents API para um diretório do repo (ex: 'data/class'); null se o
 * mirror não for github. Lista os arquivos do diretório com seus SHAs de blob. */
export function contentsApiUrl(dir, repo = githubRepoFromMirror()) {
  if (!repo) return null;
  return `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/contents/${dir}?ref=${repo.branch}`;
}

/** URL do commit mais recente que tocou `data/` (fast-path: se não mudou desde
 * o último sync, pulamos tudo); null se o mirror não for github. */
export function dataCommitApiUrl(repo = githubRepoFromMirror()) {
  if (!repo) return null;
  return `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/commits?path=data&sha=${repo.branch}&per_page=1`;
}

/** Diretórios do repo que o manifest usa (para listar os SHAs em poucas
 * requisições). Ex: ['data', 'data/class', 'data/spells', 'data/generated']. */
export function manifestDirs() {
  const dirs = new Set();
  for (const { path } of buildManifest()) {
    const slash = path.lastIndexOf('/');
    dirs.add(slash === -1 ? 'data' : `data/${path.slice(0, slash)}`);
  }
  return [...dirs];
}

/**
 * Monta a lista completa de caminhos relativos a serem buscados (em relação à
 * base do mirror). A chave de cada entrada é usada como chave no objeto `db`.
 */
export function buildManifest() {
  const globals = GLOBAL_FILES.map((file) => ({
    key: file.replace(/\.json$/, ''), // ex: "races"
    path: file,
  }));

  const classes = CLASS_NAMES.map((name) => ({
    key: `class-${name}`, // ex: "class-fighter"
    path: `class/class-${name}.json`,
  }));

  // Fluff das classes (texto "Info" + arte ilustrativa da classe e subclasses).
  const classFluff = CLASS_NAMES.map((name) => ({
    key: `fluff-class-${name}`, // ex: "fluff-class-fighter"
    path: `class/fluff-class-${name}.json`,
  }));

  // Magias: um arquivo por livro + o mapa magia→classe (sources.json) + fluff.
  const spells = SPELL_SOURCES.map((src) => ({
    key: `spells-${src}`, // ex: "spells-xphb"
    path: `spells/spells-${src}.json`,
  }));
  const spellFluff = SPELL_FLUFF_SOURCES.map((src) => ({
    key: `fluff-spells-${src}`, // ex: "fluff-spells-xphb"
    path: `spells/fluff-spells-${src}.json`,
  }));
  const spellClassMap = [{ key: 'spell-sources', path: 'spells/sources.json' }];

  // Regras extraídas dos LIVROS pelo build do 5etools (gendata) - é daqui que
  // vêm as regras do XDMG (Firearms, Explosives, Renown…): a página Rules
  // Glossary do 5etools carrega variantrules.json + este arquivo. Verificado
  // 200 no mirror em 2026-07-16.
  // gendata-tables.json: TODAS as tabelas extraídas dos livros (~2300, 2.8 MB -
  // na mesma ordem de grandeza de items.json). Só as marcadas `srd52` (as 49
  // tabelas das regras gratuitas do PHB/DMG/MM 2024) entram no glossário
  // navegável (engine/glossary.js glossaryTables); o resto fica só cacheado.
  // Verificado 200 no mirror em 2026-07-17 (um 404 quebra o Promise.all inteiro).
  const generated = [
    { key: 'gendata-variantrules', path: 'generated/gendata-variantrules.json' },
    { key: 'gendata-tables', path: 'generated/gendata-tables.json' },
  ];

  // Overlay Foundry das CLASSES (classFeature/subclassFeature com Active
  // Effects) - o pedaço por-classe do overlay DDL-0009, num arquivo único.
  // Verificado 200 no mirror em 2026-07-17.
  const foundryClass = [{ key: 'foundry-class', path: 'class/foundry.json' }];

  return [...globals, ...classes, ...classFluff, ...spells, ...spellFluff, ...spellClassMap, ...generated, ...foundryClass];
}

// =============================================================================
// config: a configuração da camada de dados (5etools)
// =============================================================================
// O QUE FAZ
//   O app não guarda os JSONs do 5etools no repositório (DDL-0036), salvo o
//   pacote SRD 5.2 embutido (DDL-0091): o resto vem da FONTE que o usuário
//   configura (dataSource.js) e é cacheado no navegador (cache.js e
//   hooks/useDataEngine.js). Aqui ficam a lista de arquivos (o manifest), a
//   validade do cache e as URLs da API do GitHub para o sync por SHA.
//   Nenhum endereço de fonte mora no código (Fase 5 do DDL-0091).
//
// FUNÇÕES
//   githubRepoFromMirror(base): { owner, repo, branch } quando a base é
//     raw.githubusercontent.com, senão null (e o sync por SHA se desliga).
//   contentsApiUrl(dir, repo): a Contents API de um diretório (arquivos e SHAs).
//   dataCommitApiUrl(repo): o commit mais recente que tocou data/.
//   manifestDirs(): os diretórios que o manifest usa, para listar os SHAs em
//     poucas requisições.
//   buildManifest(): todos os caminhos a buscar; a chave de cada entrada é a
//     chave no objeto db ("races", "class-fighter", "spells-xphb").
//
// DECISÕES E ARMADILHAS
//   - Caminho novo no manifest: confira que ele existe no formato 5etools (o
//     snapshot local serve). Desde o DDL-0091 um 404 não derruba mais o fetch
//     inteiro, mas some calado em `missing` para todo usuário.
//   - O que entra e por quê: backgrounds só pelas tabelas "Suggested
//     Characteristics" do randomizador de biografia (fluff-backgrounds não entra);
//     o glossário (condições, status, doenças, ações); as variantes genéricas de
//     item mágico, que o engine expande sobre os itens base
//     (engine/magicVariants.js); o overlay `foundry-*.json`, que é do 5etools e
//     MIT, não Plutonium (DDL-0009). foundry-backgrounds.json não existe no mirror
//     (404) e foundry-psionics.json é vazio: ficam fora.
//   - Magias: um arquivo por livro (17, de spells/index.json, todos 200 em
//     2026-07-09), concatenados e deduplicados por latestOnly em engine/spells.js.
//     O mapa magia para classe vem de spells/sources.json, não da magia. Só 9
//     livros têm fluff de magia.
//   - gendata: as regras extraídas dos livros (as do XDMG vêm daqui) e todas as
//     tabelas (~2300, 2.8 MB); só as 49 marcadas `srd52` entram no glossário
//     (engine/glossary.js), o resto só fica cacheado.
//   - O overlay Foundry das CLASSES vem num arquivo único.
//   - Sync por SHA: em vez de re-baixar os ~65 arquivos a cada expiração, a API do
//     GitHub diz o SHA de cada um e só o que mudou é baixado (fetcher.js). O raw
//     não serve para isso: o CORS bloqueia ler o ETag e mandar If-None-Match
//     (testado). A API tem limite de 60 req/h por IP; o app faz ~5 a cada 30 dias.
// -----------------------------------------------------------------------------
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
  'backgrounds.json',
  'conditionsdiseases.json',
  'actions.json',
  'magicvariants.json',
  'foundry-feats.json',
  'foundry-races.json',
  'foundry-optionalfeatures.json',
];

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

export const SPELL_SOURCES = [
  'aag', 'ai', 'aitfr-avt', 'bmt', 'efa', 'egw', 'ftd', 'frhof', 'ggr',
  'idrotf', 'llk', 'phb', 'sato', 'scc', 'tce', 'xge', 'xphb',
];

export const SPELL_FLUFF_SOURCES = [
  'aag', 'egw', 'ftd', 'frhof', 'ggr', 'phb', 'tce', 'xge', 'xphb',
];

export const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

const GITHUB_API = 'https://api.github.com';

/** Owner, repo e branch do mirror raw do GitHub, ou null. */
export function githubRepoFromMirror(mirror) {
  const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\//.exec(mirror ?? '');
  return m ? { owner: m[1], repo: m[2], branch: m[3] } : null;
}

/** URL da Contents API de um diretório, ou null fora do GitHub. */
export function contentsApiUrl(dir, repo) {
  if (!repo) return null;
  return `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/contents/${dir}?ref=${repo.branch}`;
}

/** URL do commit mais recente em data/, ou null fora do GitHub. */
export function dataCommitApiUrl(repo) {
  if (!repo) return null;
  return `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/commits?path=data&sha=${repo.branch}&per_page=1`;
}

/** Diretórios do repo que o manifest usa. */
export function manifestDirs() {
  const dirs = new Set();
  for (const { path } of buildManifest()) {
    const slash = path.lastIndexOf('/');
    dirs.add(slash === -1 ? 'data' : `data/${path.slice(0, slash)}`);
  }
  return [...dirs];
}

/** Todos os caminhos a buscar, com a chave de cada um no db. */
export function buildManifest() {
  const globals = GLOBAL_FILES.map((file) => ({
    key: file.replace(/\.json$/, ''),
    path: file,
  }));

  const classes = CLASS_NAMES.map((name) => ({
    key: `class-${name}`,
    path: `class/class-${name}.json`,
  }));

  const classFluff = CLASS_NAMES.map((name) => ({
    key: `fluff-class-${name}`,
    path: `class/fluff-class-${name}.json`,
  }));

  const spells = SPELL_SOURCES.map((src) => ({
    key: `spells-${src}`,
    path: `spells/spells-${src}.json`,
  }));
  const spellFluff = SPELL_FLUFF_SOURCES.map((src) => ({
    key: `fluff-spells-${src}`,
    path: `spells/fluff-spells-${src}.json`,
  }));
  const spellClassMap = [{ key: 'spell-sources', path: 'spells/sources.json' }];

  const generated = [
    { key: 'gendata-variantrules', path: 'generated/gendata-variantrules.json' },
    { key: 'gendata-tables', path: 'generated/gendata-tables.json' },
  ];

  const foundryClass = [{ key: 'foundry-class', path: 'class/foundry.json' }];

  return [...globals, ...classes, ...classFluff, ...spells, ...spellFluff, ...spellClassMap, ...generated, ...foundryClass];
}

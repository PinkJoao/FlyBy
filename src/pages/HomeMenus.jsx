// =============================================================================
// HomeMenus: os submenus do menu sanduíche da Home (Settings e Game data)
// =============================================================================
// O QUE FAZ
//   O conteúdo das janelinhas que o menu da Home abre (dialog.js, `menu()`),
//   montado com o MenuList. Settings junta as preferências do aparelho: o tema
//   (src/theme.js), a Character Guidance e os tutoriais. Game data junta a fonte
//   de dados (DDL-0091): trocar, atualizar e copiar o link da mesa.
//
// FUNÇÕES
//   SettingsMenu({ onReplayTutorials }): as preferências, vivas (lê os stores).
//   GameDataMenu({ source, onChooseSource, onUpdate, onCopyLink }): a fonte.
//
// DECISÕES E ARMADILHAS
//   - Tema, guia e ligar tutoriais são escolhas com keepOpen: o tema muda na hora,
//     com o submenu aberto, e serve de pré-visualização. "Replay tutorials" fecha,
//     porque o tour dispara nas telas, não aqui.
//   - Update e o link da mesa só existem com fonte por URL: o SRD embutido não tem
//     o que re-baixar nem endereço a passar.
// -----------------------------------------------------------------------------

import MenuList from '../components/common/MenuList';
import useSettingsStore from '../store/settingsStore';
import useTutorialStore from '../store/tutorialStore';
import { describeSource } from '../data/dataSource';
import { THEME_CHOICES } from '../theme';

const GUIDANCE_CHOICES = [
  { value: 'ask', label: 'Ask each time', sub: 'Choose when you create a character' },
  { value: 'on', label: 'Always guided', sub: 'The step-by-step creation guide' },
  { value: 'off', label: 'Never guided', sub: 'Go straight to the sheet' },
];

/** As preferências do aparelho: tema, guia e tutoriais. */
export function SettingsMenu({ onReplayTutorials }) {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const guidance = useSettingsStore((s) => s.guidance);
  const setGuidance = useSettingsStore((s) => s.setGuidance);
  const tutEnabled = useTutorialStore((s) => s.enabled);
  const setTutEnabled = useTutorialStore((s) => s.setEnabled);

  return (
    <MenuList
      items={[
        { heading: 'Theme' },
        ...THEME_CHOICES.map((t) => ({
          label: t.label,
          checked: theme === t.value,
          keepOpen: true,
          onClick: () => setTheme(t.value),
        })),
        { heading: 'Character Guidance' },
        ...GUIDANCE_CHOICES.map((g) => ({
          label: g.label,
          sub: g.sub,
          checked: guidance === g.value,
          keepOpen: true,
          onClick: () => setGuidance(g.value),
        })),
        { heading: 'Tutorials' },
        {
          label: 'Show tutorials',
          sub: 'Short walkthroughs the first time you see each screen',
          checked: tutEnabled,
          toggle: true,
          keepOpen: true,
          onClick: () => setTutEnabled(!tutEnabled),
        },
        { label: 'Replay tutorials', sub: 'Show them all again as you navigate', onClick: onReplayTutorials },
      ]}
    />
  );
}

/** A fonte de dados: trocar, atualizar e o link da mesa. */
export function GameDataMenu({ source, onChooseSource, onUpdate, onCopyLink }) {
  const byUrl = source?.kind === 'url';
  return (
    <MenuList
      items={[
        { label: 'Game data source', sub: describeSource(source), onClick: onChooseSource },
        ...(byUrl
          ? [
              { label: 'Update game data', sub: 'Re-download from the data source', onClick: onUpdate },
              { label: 'Copy setup link', sub: 'A link that sets up the same data for your players', onClick: onCopyLink },
            ]
          : []),
      ]}
    />
  );
}

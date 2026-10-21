// =============================================================================
// AppMenus: os submenus dos menus sanduíche (Home e ficha)
// =============================================================================
// O QUE FAZ
//   O conteúdo das janelinhas que os menus abrem (dialog.js, `menu()`), montado
//   com o MenuList. É o PADRÃO de menu do app (DDL-0098): o dropdown fica curto
//   (glossário, os grupos, feedback) e cada grupo abre uma janelinha.
//     Settings (Home e ficha): o tema (src/theme.js), a Character Guidance padrão
//       e os tutoriais.
//     Game data (Home): a fonte de dados (DDL-0091): trocar, atualizar e copiar o
//       link da mesa.
//     Export & import (ficha): Foundry, PDF e importar outro personagem.
//     Character guide (ficha): refazer o guia de criação e ligar o guia DESTE
//       personagem.
//
// FUNÇÕES
//   SettingsMenu({ onReplayTutorials }): as preferências, vivas (lê os stores).
//   GameDataMenu({ source, onChooseSource, onUpdate, onCopyLink }): a fonte.
//   SheetFilesMenu({ onExportFoundry, onExportPdf, onImport }): exportar e
//     importar.
//   SheetGuideMenu({ characterId, onRerun, onSetGuided }): o guia do
//     personagem, vivo (lê o personagem do store).
//
// DECISÕES E ARMADILHAS
//   - Tema, guia e ligar tutoriais são escolhas com keepOpen: o tema muda na hora,
//     com o submenu aberto, e serve de pré-visualização. "Replay tutorials" fecha,
//     porque o tour dispara nas telas, não aqui.
//   - Update e o link da mesa só existem com fonte por URL: o SRD embutido não tem
//     o que re-baixar nem endereço a passar.
//   - A Character Guidance aparece duas vezes, de propósito: em Settings é o
//     PADRÃO para personagens novos; em Character guide, o liga/desliga do
//     personagem aberto (`meta.guided`). Os subtítulos dizem qual é qual.
// -----------------------------------------------------------------------------

import MenuList from './MenuList';
import useSettingsStore from '../../store/settingsStore';
import useTutorialStore from '../../store/tutorialStore';
import useCharacterStore from '../../store/characterStore';
import { guidanceActive } from '../wizard/guidancePendencies';
import { describeSource } from '../../data/dataSource';
import { THEME_CHOICES } from '../../theme';

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
        { heading: 'Guide for new characters' },
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

/** Exportar a ficha (Foundry, PDF) e importar outro personagem. */
export function SheetFilesMenu({ onExportFoundry, onExportPdf, onImport }) {
  return (
    <MenuList
      items={[
        { label: 'Export to Foundry VTT', sub: 'Foundry actor JSON', onClick: onExportFoundry },
        { label: 'Export PDF', sub: 'Printable character sheet', onClick: onExportPdf },
        { label: 'Import character', sub: 'Opens a new character from a Foundry file', onClick: onImport },
      ]}
    />
  );
}

/** O guia deste personagem: refazer a criação e ligar ou desligar a ajuda. */
export function SheetGuideMenu({ characterId, onRerun, onSetGuided }) {
  const character = useCharacterStore((s) => s.getById(characterId));
  const guided = character ? guidanceActive(character) : false;
  return (
    <MenuList
      items={[
        { label: 'Re-run the creation guide', sub: 'The full step-by-step, from the start', onClick: onRerun },
        {
          label: 'Guide for this character',
          sub: 'The guide button and the level-up help on this sheet',
          checked: guided,
          toggle: true,
          keepOpen: true,
          onClick: () => onSetGuided(!guided),
        },
      ]}
    />
  );
}

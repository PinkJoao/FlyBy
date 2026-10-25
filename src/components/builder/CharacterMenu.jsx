// =============================================================================
// CharacterMenu: o menu sanduíche da página do personagem
// =============================================================================
// O QUE FAZ
//   O menu do topo da página do personagem (pages/Character), o MESMO nos modos
//   ficha e jogo (DDL-0120): glossário, Export & import (Foundry, PDF, abrir outro
//   personagem), Character guide, Settings, About e o feedback. Os submenus seguem
//   o padrão de menus do app (AppMenus, DDL-0098).
//
// FUNÇÕES
//   CharacterMenu(props): o botão do menu e o campo escondido do import.
//     setGuided(guided): liga ou desliga o guia do personagem.
//     replayTutorials(): liga e zera os tutoriais e abre o tour do modo aberto.
//     safeName(), download(data, suffix): o arquivo baixado.
//     openFiles(), openGuideMenu(), openSettings(): os submenus.
//     exportFoundry(), exportPdf(): os dois exports.
//
// DECISÕES E ARMADILHAS
//   - O que não mexe na jogatina não muda de um modo para o outro: o menu é um só,
//     e o único detalhe do modo é QUAL tour o "replay" abre (o da tela aberta).
//   - setGuided lê o personagem do store: o submenu fica aberto e ele muda embaixo.
//   - Foundry é o ÚNICO formato de export e import (DDL-0005). O PDF é importado
//     dinamicamente, fora do bundle principal.
// -----------------------------------------------------------------------------

import { useNavigate } from 'react-router-dom';
import useCharacterStore from '../../store/characterStore';
import useCharacterImport from '../../hooks/useCharacterImport';
import { assembleFoundryActor } from '../../engine/foundryActor';
import MenuButton from '../common/MenuButton';
import { SettingsMenu, SheetFilesMenu, SheetGuideMenu } from '../common/AppMenus';
import { menu } from '../common/dialog';
import { openGlossary } from '../../store/glossaryStore';
import { FEEDBACK_URL } from '../../feedback';
import useTutorialStore, { startTutorial } from '../../store/tutorialStore';
import { TUT } from '../../tutorial/anchors';
import { showPdfExport } from '../common/pdfExportDialog';
import Icon from '../common/Icon';
import styles from '../../pages/Builder.module.css';

/**
 * O menu sanduíche da página do personagem.
 * @param {{ character: object, db: object, derived: object, save: Function, mode: 'sheet'|'play' }} props
 */
export default function CharacterMenu({ character, db, derived, save, mode }) {
  const navigate = useNavigate();
  const { inputRef, onFileChange, pickFile } = useCharacterImport();
  const setTutEnabled = useTutorialStore((s) => s.setEnabled);
  const resetTutorials = useTutorialStore((s) => s.resetSeen);

  const setGuided = (guided) => {
    const latest = useCharacterStore.getState().getById(character.id) ?? character;
    save({ ...latest, meta: { ...latest.meta, guided } });
  };
  const replayTutorials = () => {
    setTutEnabled(true);
    resetTutorials();
    startTutorial(mode === 'play' ? 'play' : 'sheet');
  };

  const safeName = () => (character.meta.name || 'character').replace(/[^\w.-]+/g, '_');
  const download = (data, suffix) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName()}${suffix}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportFoundry = () => download(assembleFoundryActor(character, db), '.json');
  const exportPdf = () =>
    showPdfExport(async (options) => {
      const { exportCharacterPdf } = await import('../../pdf/exportPdf');
      await exportCharacterPdf(character, derived, db, options);
    });

  const openFiles = () =>
    menu({
      title: 'Export & import',
      content: <SheetFilesMenu onExportFoundry={exportFoundry} onExportPdf={exportPdf} onImport={pickFile} />,
    });
  const openGuideMenu = () =>
    menu({
      title: 'Character guide',
      content: (
        <SheetGuideMenu
          characterId={character.id}
          onRerun={() => {
            save({ ...character, meta: { ...character.meta, creating: true } });
            navigate(`/build/${character.id}/wizard`);
          }}
          onSetGuided={setGuided}
        />
      ),
    });
  const openSettings = () => menu({ title: 'Settings', content: <SettingsMenu onReplayTutorials={replayTutorials} /> });

  return (
    <>
      <MenuButton
        buttonClassName={styles.menuBtn}
        buttonTitle="Menu"
        dataTour={TUT.SHEET_MENU}
        items={[
          { label: 'Glossary', sub: 'Search every rule, spell, item and feature', onClick: openGlossary },
          { label: 'Export & import', sub: 'Foundry VTT, PDF, or open another character', onClick: openFiles },
          { label: 'Character guide', sub: 'Re-run the creation guide, guide on or off', onClick: openGuideMenu },
          { label: 'Settings', sub: 'Theme, creation guide, tutorials and play history', onClick: openSettings },
          { label: 'About FlyBy', sub: 'Version, credits and licenses', onClick: () => navigate('/about') },
          { label: 'Feedback / report a bug', sub: 'Sends an e-mail', href: FEEDBACK_URL },
        ]}
      >
        <span aria-hidden="true"><Icon name="menu" /></span>
      </MenuButton>
      <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={onFileChange} />
    </>
  );
}

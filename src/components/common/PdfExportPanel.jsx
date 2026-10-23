// =============================================================================
// PdfExportPanel: as opções da ficha PDF, antes de baixar
// =============================================================================
// O QUE FAZ
//   O corpo do diálogo "Export PDF" (DDL-0105). No alto, o que quase todo mundo
//   quer: o visual (pergaminho ou branco), o papel e o atalho de conteúdo
//   (Compact, Standard, Complete). "Customize" abre o resto: as seções, o detalhe por
//   grupo (desligado, só títulos, completo), o flavour e os campos da página de
//   combate. Cada mudança grava na hora no settingsStore; Export fecha e gera.
//
// FUNÇÕES
//   Seg(props): um controle segmentado (escolha única).
//   Check(props): uma caixa de marcar com rótulo.
//   PdfExportPanel(props): o painel (aberto por showPdfExport, pdfExportDialog.jsx).
//
// DECISÕES E ARMADILHAS
//   - O atalho "Custom" não é clicável: ele só ACENDE quando as escolhas não
//     batem com nenhum atalho, e então o Customize já vem aberto.
//   - O export roda DEPOIS de fechar o diálogo (ação fecha antes de rodar,
//     DDL-0098); a geração de uma ficha longa leva alguns segundos.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import useSettingsStore from '../../store/settingsStore';
import { applyPreset, presetOf, FEATURE_GROUPS } from '../../pdf/pdfOptions';
import { useDialogClose } from './dialogContext';
import Collapse from './Collapse';
import styles from './PdfExportPanel.module.css';

const FEATURE_LABEL = {
  classFeatures: 'Class features',
  subclassFeatures: 'Subclass features',
  speciesTraits: 'Species traits',
  feats: 'Feats',
};

const DETAIL = [['off', 'Off'], ['titles', 'Titles'], ['full', 'Full text']];

/** Um controle segmentado. */
function Seg({ value, options, onChange, small = false }) {
  return (
    <div className={`${styles.seg} ${small ? styles.segSmall : ''}`} role="radiogroup">
      {options.map(([v, label, disabled]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={value === v ? styles.segOn : undefined}
          disabled={disabled}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Uma caixa de marcar com rótulo. */
function Check({ checked, label, onChange }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/**
 * O painel de opções do PDF.
 * @param {{ onExport: (options: object) => void }} props
 */
export default function PdfExportPanel({ onExport }) {
  const opts = useSettingsStore((s) => s.pdf);
  const setOpts = useSettingsStore((s) => s.setPdfOptions);
  const close = useDialogClose();
  const preset = presetOf(opts);
  const [open, setOpen] = useState(preset === 'custom');

  const patch = (key, sub, value) => setOpts({ ...opts, [key]: { ...opts[key], [sub]: value } });

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <span className={styles.label}>Look</span>
        <Seg value={opts.theme} options={[['parchment', 'Parchment'], ['white', 'White']]} onChange={(v) => setOpts({ ...opts, theme: v })} />
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Paper</span>
        <Seg value={opts.pageSize} options={[['A4', 'A4'], ['LETTER', 'Letter']]} onChange={(v) => setOpts({ ...opts, pageSize: v })} />
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Content</span>
        <Seg
          value={preset}
          options={[['compact', 'Compact'], ['standard', 'Standard'], ['complete', 'Complete'], ['custom', 'Custom', true]]}
          onChange={(v) => setOpts(applyPreset(opts, v))}
        />
      </div>
      <p className={styles.hint}>
        {preset === 'compact' && 'Feature names, the spell table and item names: a few pages for the table.'}
        {preset === 'standard' && 'Full feature and spell text, magic item text and the species and subclass lore.'}
        {preset === 'complete' && 'Every description, spell cards and lore: a full reference, many pages at high level.'}
        {preset === 'custom' && 'Your own mix, below.'}
      </p>

      <button type="button" className={styles.more} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide options' : 'Customize'}
      </button>
      <Collapse open={open}>
        <div className={styles.custom}>
          <h4 className={styles.heading}>Sections</h4>
          <div className={styles.checks}>
            <Check checked={opts.sections.combat} label="Combat page" onChange={(v) => patch('sections', 'combat', v)} />
            <Check checked={opts.sections.features} label="Features & traits" onChange={(v) => patch('sections', 'features', v)} />
            <Check checked={opts.sections.spells} label="Spellcasting" onChange={(v) => patch('sections', 'spells', v)} />
            <Check checked={opts.sections.inventory} label="Equipment" onChange={(v) => patch('sections', 'inventory', v)} />
            <Check checked={opts.sections.biography} label="Biography" onChange={(v) => patch('sections', 'biography', v)} />
          </div>

          <h4 className={styles.heading}>Detail</h4>
          {FEATURE_GROUPS.map((g) => (
            <div key={g} className={styles.row}>
              <span className={styles.label}>{FEATURE_LABEL[g]}</span>
              <Seg small value={opts.detail[g]} options={DETAIL} onChange={(v) => patch('detail', g, v)} />
            </div>
          ))}
          <div className={styles.row}>
            <span className={styles.label}>Spells</span>
            <Seg small value={opts.detail.spells} options={[['table', 'Table'], ['cards', 'Table + cards']]} onChange={(v) => patch('detail', 'spells', v)} />
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Items</span>
            <Seg small value={opts.detail.items} options={[['names', 'Names'], ['magic', 'Magic text'], ['all', 'All text']]} onChange={(v) => patch('detail', 'items', v)} />
          </div>

          <h4 className={styles.heading}>Flavor text</h4>
          <div className={styles.checks}>
            <Check checked={opts.flavor.species} label="Species lore" onChange={(v) => patch('flavor', 'species', v)} />
            <Check checked={opts.flavor.classes} label="Class introduction" onChange={(v) => patch('flavor', 'classes', v)} />
            <Check checked={opts.flavor.subclasses} label="Subclass introduction" onChange={(v) => patch('flavor', 'subclasses', v)} />
            <Check checked={opts.flavor.items} label="Item lore" onChange={(v) => patch('flavor', 'items', v)} />
          </div>

          <h4 className={styles.heading}>Combat page</h4>
          <div className={styles.checks}>
            <Check checked={opts.fields.portrait} label="Portrait" onChange={(v) => patch('fields', 'portrait', v)} />
            <Check checked={opts.fields.skills} label="Skills" onChange={(v) => patch('fields', 'skills', v)} />
            <Check checked={opts.fields.attacks} label="Attacks" onChange={(v) => patch('fields', 'attacks', v)} />
            <Check checked={opts.fields.resources} label="Resources (uses to tick)" onChange={(v) => patch('fields', 'resources', v)} />
            <Check checked={opts.fields.proficiencies} label="Proficiencies" onChange={(v) => patch('fields', 'proficiencies', v)} />
            <Check checked={opts.fields.tableBoxes} label="Boxes for play (HP, saves, notes)" onChange={(v) => patch('fields', 'tableBoxes', v)} />
          </div>
        </div>
      </Collapse>

      <div className={styles.actions}>
        <button type="button" onClick={() => close()}>Cancel</button>
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            close();
            onExport(opts);
          }}
        >
          Export PDF
        </button>
      </div>
    </div>
  );
}

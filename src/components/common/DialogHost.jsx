// =============================================================================
// DialogHost: renderiza a fila de diálogos in-app
// =============================================================================
// O QUE FAZ
//   Montado UMA vez no App (DDL-0007). Cada diálogo aberto pela API (dialog.js)
//   vira um card centralizado sobre um overlay, por portal em document.body. Ele se
//   ajusta ao conteúdo (fit-content, capado por --dlg-max-width) sem passar da
//   viewport (o corpo rola); tem ações em botões (default, primary, danger) e
//   campos (select, texto); clique fora, Esc e um X opcionais (cancelam com
//   `dismissValue`); e é todo temável (as props de estilo viram --dlg-*). Um
//   conteúdo React no `message` recebe o "fechar" por DialogCloseContext
//   (dialogContext.js): é como o submenu (variant 'menu') se fecha. O voltar
//   do celular fecha o diálogo de cima como um clique fora (useBackLayer).
//   Todo fechamento passa por `finish`: a classe .closing anima a saída por
//   EXIT_MS e só então resolve a Promise; com "reduzir movimento", resolve na hora.
//
// FUNÇÕES
//   buildStyle(cfg): as props de estilo em CSS custom properties.
//   DialogHost(): a pilha.
//   DialogCard(props): um diálogo; foca o botão autoFocus (ou o card) e devolve o
//     foco ao fechar.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useDialogStore from '../../store/dialogStore';
import { DialogCloseContext } from './dialogContext';
import { reducedMotion } from '../../motion';
import Icon from './Icon';
import { useBackLayer } from '../../hooks/useBack';
import styles from './DialogHost.module.css';

const EXIT_MS = 120;

const STYLE_VARS = {
  accent: { var: '--dlg-accent' },
  bg: { var: '--dlg-bg' },
  border: { var: '--dlg-border' },
  radius: { var: '--dlg-radius', px: true },
  maxWidth: { var: '--dlg-max-width', px: true },
  titleColor: { var: '--dlg-title-color' },
  textColor: { var: '--dlg-text-color' },
  fontFamily: { var: '--dlg-font' },
};

function buildStyle(cfg) {
  const out = { ...(cfg.style || {}) };
  for (const [key, c] of Object.entries(STYLE_VARS)) {
    const v = cfg[key];
    if (v == null) continue;
    out[c.var] = c.px && typeof v === 'number' ? `${v}px` : String(v);
  }
  return out;
}

export default function DialogHost() {
  const dialogs = useDialogStore((s) => s.dialogs);
  const resolve = useDialogStore((s) => s.resolve);
  if (dialogs.length === 0) return null;
  return createPortal(
    dialogs.map((d) => <DialogCard key={d.id} dialog={d} onResolve={(r) => resolve(d.id, r)} />),
    document.body,
  );
}

function DialogCard({ dialog, onResolve }) {
  const {
    id,
    variant = 'confirm',
    title,
    message,
    actions = [],
    fields = [],
    dismissable = true,
    showClose = false,
    dismissValue,
  } = dialog;

  const [values, setValues] = useState(() =>
    Object.fromEntries(
      fields.map((f) => [f.name, f.type === 'checkbox' ? !!f.default : f.default ?? f.options?.[0]?.value ?? '']),
    ),
  );
  const cardRef = useRef(null);
  const autoRef = useRef(null);
  const [closing, setClosing] = useState(false);

  /** Fecha com a animação de saída e só então resolve (uma vez só). */
  const finish = (result) => {
    if (closing) return;
    if (reducedMotion()) {
      onResolve(result);
      return;
    }
    setClosing(true);
    setTimeout(() => onResolve(result), EXIT_MS);
  };

  useEffect(() => {
    const prev = document.activeElement;
    (autoRef.current || cardRef.current)?.focus();
    return () => {
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, []);

  const dismiss = () => {
    if (dismissable) finish(dismissValue);
  };

  useBackLayer(true, dismiss);

  const pick = (action) => {
    finish(fields.length ? { action: action.value, values } : action.value);
  };

  const primaryAction = () =>
    actions.find((a) => a.autoFocus) || actions.find((a) => a.tone === 'primary') || actions[actions.length - 1];

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      dismiss();
    } else if (e.key === 'Enter' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'TEXTAREA') {
      const primary = primaryAction();
      if (primary) {
        e.preventDefault(); // ATENÇÃO: evita o click nativo do botão focado (resolveria duas vezes).
        pick(primary);
      }
    }
  };

  return (
    <div
      className={closing ? `${styles.overlay} ${styles.closing}` : styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        className={`${styles.card} ornate-frame`}
        role={variant === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={title ? `${id}-title` : undefined}
        style={buildStyle(dialog)}
        ref={cardRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {showClose && (
          <button type="button" className={styles.close} aria-label="Close" onClick={dismiss}>
            <Icon name="close" />
          </button>
        )}
        {title && (
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
        )}
        {message != null && (
          <DialogCloseContext.Provider value={finish}>
            <div className={variant === 'menu' ? styles.menuBody : styles.message}>{message}</div>
          </DialogCloseContext.Provider>
        )}

        {fields.length > 0 && (
          <div className={styles.fields}>
            {fields.map((f) => (
              f.type === 'checkbox' ? (
                <label key={f.name} className={styles.checkField}>
                  <input
                    type="checkbox"
                    checked={!!values[f.name]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))}
                  />
                  {f.label && <span>{f.label}</span>}
                </label>
              ) : (
              <label key={f.name} className={styles.field}>
                {f.label && <span className={styles.fieldLabel}>{f.label}</span>}
                {f.type === 'select' ? (
                  <select
                    className={styles.select}
                    value={values[f.name]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  >
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={styles.input}
                    type="text"
                    value={values[f.name]}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                )}
              </label>
              )
            ))}
          </div>
        )}

        {actions.length > 0 && (
          <div className={styles.actions}>
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                ref={a.autoFocus ? autoRef : undefined}
                className={`${styles.btn} ${styles[a.tone] || styles.default}`}
                onClick={() => pick(a)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

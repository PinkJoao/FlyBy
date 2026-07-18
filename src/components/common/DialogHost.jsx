// =============================================================================
// DialogHost - renderiza a fila de diálogos in-app (dialogStore)
// =============================================================================
// Montado UMA vez no App. Cada diálogo aberto pela API (dialog.js) vira um card
// centralizado sobre um overlay, via portal em document.body. Recursos:
// - ajusta-se ao conteúdo (width: fit-content, capado por --dlg-max-width) e é
//   responsivo (nunca passa da viewport; corpo rola se for alto demais);
// - ações em botões (tons default/primary/danger) e/ou campos (select/texto);
// - opcionais: clique fora / Esc para fechar (cancela → dismissValue) e botão X;
// - totalmente temável: props de estilo viram CSS custom properties (--dlg-*).
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useDialogStore from '../../store/dialogStore';
import styles from './DialogHost.module.css';

// Props de estilo → CSS custom properties (px onde faz sentido).
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

  // Foca o botão marcado (autoFocus) ou o próprio card ao abrir; devolve o foco
  // ao elemento anterior ao fechar.
  useEffect(() => {
    const prev = document.activeElement;
    (autoRef.current || cardRef.current)?.focus();
    return () => {
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, []);

  const dismiss = () => {
    if (dismissable) onResolve(dismissValue);
  };

  const pick = (action) => {
    onResolve(fields.length ? { action: action.value, values } : action.value);
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
        e.preventDefault(); // evita disparar o click nativo do botão focado (double-resolve)
        pick(primary);
      }
    }
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        className={styles.card}
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
            ×
          </button>
        )}
        {title && (
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
        )}
        {message != null && <div className={styles.message}>{message}</div>}

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

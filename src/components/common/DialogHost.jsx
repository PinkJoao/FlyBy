// =============================================================================
// DialogHost: renderiza a pilha de janelas in-app
// =============================================================================
// O QUE FAZ
//   Montado UMA vez no App (DDL-0007). Cada diálogo aberto pela API (dialog.js e
//   os atalhos dos painéis) vira uma JANELA no centro da tela, por portal em
//   document.body, na moldura única de preview (PreviewFrame, PreviewShell): topo
//   fixo com o título e o X, corpo que rola, rodapé fixo com os botões dividindo a
//   largura (DDL-0303, fase U2 do docs/UI-STUDY.md). Vale para os avisos, as
//   confirmações, as perguntas com campos, os submenus, os painéis do jogo e os
//   previews. Clique fora, Esc, o X e o voltar do celular cancelam com
//   `dismissValue`. Um conteúdo React no `message` recebe o "fechar" por
//   DialogCloseContext (dialogContext.js): é como um painel ou um submenu se fecha.
//   Todo fechamento passa por `finish`: a janela anima a saída por EXIT_MS e só
//   então resolve a Promise; com "reduzir movimento", resolve na hora.
//
// FUNÇÕES
//   DialogHost(): a pilha. Só a janela de cima aparece; as de baixo ficam
//     guardadas (sem véu próprio) e a de cima ganha o voltar e os pontos da
//     profundidade quando há outra embaixo.
//   DialogCard(props): uma janela; foca o botão autoFocus (ou a janela) e devolve
//     o foco ao fechar. Enter escolhe a ação principal fora de um botão ou de um
//     texto longo.
//   Fields(props): os campos de uma pergunta (escolha em ChoiceChips, texto,
//     sim ou não no Toggle).
//
// DECISÕES E ARMADILHAS
//   - O preview, o aviso e o painel usam a MESMA moldura: antes eram dois desenhos
//     (o cartão do diálogo com os botões do tamanho do texto, e a moldura do
//     preview), e no celular o preview subia como gaveta enquanto o resto era
//     cartão. A gaveta ficou só onde a tela de trás importa (os filtros e o
//     detalhe do seletor), DDL-0303.
//   - O aviso, a confirmação, a pergunta e o painel ajustam a largura ao conteúdo
//     (`fit`, entre um mínimo legível e `maxWidth`); o preview tem largura fixa.
//   - A profundidade conta também as janelas vivas abertas antes (PreviewLayer, `live` do store,
//     DDL-0313): um diálogo por cima de uma delas ganha o voltar e entra pela direita.
//   - As props de tema antigas (accent, bg, radius...) saíram: nenhuma chamada
//     as usava.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useDialogStore from '../../store/dialogStore';
import { DialogCloseContext } from './dialogContext';
import { reducedMotion } from '../../motion';
import { useBackLayer } from '../../hooks/useBack';
import styles from './DialogHost.module.css';
import Toggle from './Toggle';
import Button from './Button';
import ChoiceChips from './ChoiceChips';
import { PreviewFrame } from './PreviewLayer';

const EXIT_MS = 160;

export default function DialogHost() {
  const dialogs = useDialogStore((s) => s.dialogs);
  const live = useDialogStore((s) => s.live);
  const resolve = useDialogStore((s) => s.resolve);
  if (dialogs.length === 0) return null;
  return createPortal(
    dialogs.map((d, i) => (
      <DialogCard
        key={d.id}
        dialog={d}
        depth={i + live.filter((l) => l.base <= i).length}
        buried={i < dialogs.length - 1}
        onResolve={(r) => resolve(d.id, r)}
      />
    )),
    document.body,
  );
}

function DialogCard({ dialog, depth, buried, onResolve }) {
  const {
    id,
    variant = 'confirm',
    title,
    kicker,
    source,
    note,
    message,
    actions = [],
    fields = [],
    dismissable = true,
    dismissValue,
    maxWidth,
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

  const preview = variant === 'preview';
  const primaryAction = () =>
    actions.find((a) => a.autoFocus) || actions.find((a) => a.tone === 'primary') || actions[actions.length - 1];

  const onKeyDown = (e) => {
    if (preview || variant === 'menu' || e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
    const primary = primaryAction();
    if (primary) {
      e.preventDefault(); // ATENÇÃO: evita o click nativo do botão focado (resolveria duas vezes).
      pick(primary);
    }
  };

  const footer = actions.length > 0 && (
    <>
      {actions.map((a, i) => (
        <Button
          key={i}
          ref={a.autoFocus ? autoRef : undefined}
          variant={a.tone === 'primary' || a.tone === 'danger' ? a.tone : 'default'}
          onClick={() => pick(a)}
        >
          {a.label}
        </Button>
      ))}
    </>
  );

  return (
    <PreviewFrame
      closing={closing}
      buried={buried}
      onDismiss={dismissable ? dismiss : undefined}
      onBack={depth > 0 && dismissable ? dismiss : undefined}
      depth={depth}
      z={1000}
      fit={!preview}
      maxWidth={maxWidth ?? (preview ? 560 : 440)}
      role={variant === 'alert' ? 'alertdialog' : 'dialog'}
      cardRef={cardRef}
      onKeyDown={onKeyDown}
      kicker={kicker}
      source={source}
      title={title}
      titleId={`${id}-title`}
      note={note}
      footer={footer}
    >
      <DialogCloseContext.Provider value={finish}>
        {message != null &&
          (preview || variant === 'menu' ? message : <div className={styles.message}>{message}</div>)}
        {fields.length > 0 && <Fields fields={fields} values={values} setValues={setValues} />}
      </DialogCloseContext.Provider>
    </PreviewFrame>
  );
}

/** Os campos de uma pergunta: escolha em Chips, texto, sim ou não. */
function Fields({ fields, values, setValues }) {
  const set = (name, v) => setValues((all) => ({ ...all, [name]: v }));
  return (
    <div className={styles.fields}>
      {fields.map((f) =>
        f.type === 'checkbox' ? (
          <Toggle key={f.name} className={styles.checkField} checked={!!values[f.name]} onChange={(on) => set(f.name, on)} label={f.label} />
        ) : f.type === 'select' ? (
          <div key={f.name} className={styles.field}>
            {f.label && <span className={styles.fieldLabel}>{f.label}</span>}
            <ChoiceChips ariaLabel={f.label} clearable={false} value={values[f.name]} onChange={(v) => set(f.name, v)} options={f.options} />
          </div>
        ) : (
          <label key={f.name} className={styles.field}>
            {f.label && <span className={styles.fieldLabel}>{f.label}</span>}
            <input
              className={styles.input}
              type="text"
              value={values[f.name]}
              placeholder={f.placeholder}
              onChange={(e) => set(f.name, e.target.value)}
            />
          </label>
        ),
      )}
    </div>
  );
}

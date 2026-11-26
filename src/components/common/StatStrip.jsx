// =============================================================================
// StatStrip: a faixa de números tocáveis no topo de uma aba
// =============================================================================
// O QUE FAZ
//   Uma linha de partes, cada uma um botão que abre a sua janela: um número com o
//   rótulo embaixo, ou um contador com uma barra fina. É o topo do inventário (Gold,
//   Carried, Attuned) e do grimório (Save DC, Attack, Slots; Cantrips, Prepared, Book),
//   no lugar dos cards de moedas, de espaços e de números (DDL-0320, DDL-0321).
//
// FUNÇÕES
//   StatStrip(props): `cells` (os números) e `bars` (os contadores), listas de
//     `{ key, value, label, title, onClick, icon, pct, tone, wide }`; `split` (cada
//     número no seu card); `dataTour`.
//   Bar(props): a barra fina.
//
// DECISÕES E ARMADILHAS
//   - No celular são duas linhas (números em cima, barras embaixo); a partir de 761 px
//     é uma só. Uma parte sem `onClick` é texto, não um botão morto.
//   - `split` (o inventário, DDL-0323): três cards em vez de um dividido em partes
//     iguais. O número curto (Gold, Attuned) fica na largura do conteúdo e o `wide`
//     (a barra de carga) leva o resto; dividido igual, o curto sobrava e a barra
//     encolhia, sobretudo no desktop.
//   - Os tons são os da ficha: `warning` (falta escolher) e `danger` (passou do limite);
//     nunca escondem o número (DDL-0026).
// -----------------------------------------------------------------------------

import styles from './StatStrip.module.css';

/** A barra fina de um contador. */
function Bar({ pct, tone }) {
  return (
    <span className={styles.bar} aria-hidden="true">
      <i className={tone ? `${styles.fill} ${styles[tone]}` : styles.fill} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

/** A faixa de números tocáveis. */
export default function StatStrip({ cells = [], bars = [], split = false, dataTour }) {
  const part = (item, className, body) =>
    item.onClick ? (
      <button key={item.key} type="button" className={className} onClick={item.onClick} title={item.title}>{body}</button>
    ) : (
      <span key={item.key} className={className} title={item.title}>{body}</span>
    );
  return (
    <div className={split ? styles.split : styles.strip} data-tour={dataTour}>
      {cells.length > 0 && (
        <div className={styles.cells}>
          {cells.map((c) =>
            part(c, [styles.cell, c.wide ? styles.wide : null, split ? styles.piece : null].filter(Boolean).join(' '), (
              <>
                <span className={c.tone ? `${styles.value} ${styles[`${c.tone}Text`]}` : styles.value}>
                  {c.icon}
                  {c.value}
                </span>
                {c.pct != null && <Bar pct={c.pct} tone={c.tone} />}
                <span className={styles.label}>{c.label}</span>
              </>
            )),
          )}
        </div>
      )}
      {bars.length > 0 && (
        <div className={styles.bars}>
          {bars.map((b) =>
            part(b, styles.limit, (
              <>
                <span className={styles.limitRow}>
                  <span className={styles.label}>{b.label}</span>
                  <span className={b.tone ? `${styles.limitValue} ${styles[`${b.tone}Text`]}` : styles.limitValue}>{b.value}</span>
                </span>
                <Bar pct={b.pct} tone={b.tone} />
              </>
            )),
          )}
        </div>
      )}
    </div>
  );
}

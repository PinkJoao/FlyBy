// =============================================================================
// Icon: um ícone do app, SVG inline na cor e no tamanho do texto
// =============================================================================
// O QUE FAZ
//   Desenha um ícone de iconsData.js (gerado por scripts/gen-icons.js) pelo NOME
//   que o app usa (`close`, `dice`, `itemWeapon`...). O SVG tem 1em de lado e
//   `currentColor`: herda o tamanho e a cor de onde está, e o tema vale sozinho.
//
// FUNÇÕES
//   Icon({ name, className, title }): o ícone; sem `title` é decorativo
//     (aria-hidden), com `title` é uma imagem com nome acessível.
//
// DECISÕES E ARMADILHAS
//   - O corpo vem do pacote Iconify pelo gerador, não de entrada do usuário, por
//     isso o dangerouslySetInnerHTML é seguro aqui.
//   - Nome desconhecido não quebra a tela: não desenha nada e, no dev, avisa no
//     console (o mais provável é um ícone que faltou no registro do gerador).
// -----------------------------------------------------------------------------

import { ICONS } from './iconsData';

/**
 * Um ícone do app pelo nome.
 * @param {{ name: string, className?: string, title?: string }} props
 */
export default function Icon({ name, className, title }) {
  const icon = ICONS[name];
  if (!icon) {
    if (import.meta.env.DEV) console.warn(`Icon: ícone desconhecido "${name}"`);
    return null;
  }
  const body = title ? `<title>${title}</title>${icon.body}` : icon.body;
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox={icon.viewBox}
      width="1em"
      height="1em"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

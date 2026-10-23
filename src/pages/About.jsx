// =============================================================================
// About: a página "sobre", com todos os créditos e licenças
// =============================================================================
// O QUE FAZ
//   Rota `/about`, aberta pelo menu (Home e ficha) e pelo rodapé da Home. Diz o
//   que é o FlyBy, a versão, o link do código e do feedback, e credita tudo o que
//   o app traz de terceiros: o SRD 5.2 e os extras do SRD 5.1 (CC BY 4.0,
//   DDL-0107), o formato de dados do
//   5etools (MIT), o sistema dnd5e do Foundry (MIT), os ícones (game-icons.net,
//   CC BY 3.0, por autor; Lucide, ISC), as fontes do tema papel (OFL 1.1) e as
//   bibliotecas. O NOTICE na raiz do repositório traz as licenças por extenso.
//
// FUNÇÕES
//   About(): a página.
//   Section({ title, children }): um bloco com título e filete.
//   ExtLink({ href, children }): link externo, em aba nova.
//
// DECISÕES E ARMADILHAS
//   - Os autores dos ícones vêm de ICON_CREDITS (gerado com o próprio ícone pelo
//     gen-icons): um ícone novo entra nos créditos sozinho.
//   - O texto do SRD é o de atribuição que a própria Wizards pede, igual ao do
//     NOTICE; mudar um exige mudar o outro.
//   - Nenhum endereço de fonte de dados aparece aqui (DDL-0091): o 5etools é
//     creditado como FORMATO.
//   - O voltar volta para a página de onde se veio (useLeaveTo sem destino).
// -----------------------------------------------------------------------------

import BackButton from '../components/common/BackButton';
import { ICON_CREDITS } from '../components/common/iconsData';
import { useLeaveTo } from '../hooks/useBack';
import { APP_VERSION } from '../version';
import { FEEDBACK_URL } from '../feedback';
import styles from './About.module.css';

const REPO_URL = 'https://github.com/PinkJoao/FlyBy';

/** Link externo, em aba nova. */
function ExtLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** Um bloco com título e filete. */
function Section({ title, children }) {
  return (
    <section className={`${styles.section} ornate-frame`}>
      <h2 className={`${styles.sectionTitle} ornate-rule`}>{title}</h2>
      {children}
    </section>
  );
}

export default function About() {
  const leave = useLeaveTo();
  return (
    <div className={`${styles.page} motion-page`}>
      <header className={styles.top}>
        <BackButton onClick={() => leave()} label="previous page" />
      </header>

      <div className={styles.hero}>
        <img src="/logo.svg" alt="" className={styles.logo} />
        <h1 className={`${styles.name} ornate-rule ornate-rule-center`}>FlyBy</h1>
        <p className={styles.version}>Version {APP_VERSION}</p>
        <p className={styles.lead}>
          A free, open-source character builder for the 5th edition fantasy roleplaying game (2024 rules), with PDF and
          Foundry VTT export. Everything runs and is stored on your device.
        </p>
        <p className={styles.links}>
          <ExtLink href={REPO_URL}>Source code on GitHub</ExtLink>
          <span aria-hidden="true"> · </span>
          <a href={FEEDBACK_URL}>Send feedback</a>
        </p>
      </div>

      <Section title="License">
        <p>
          The FlyBy source code is released under the <ExtLink href={`${REPO_URL}/blob/main/LICENSE`}>MIT License</ExtLink>.
          The third-party material below keeps its own license; the full texts are in the{' '}
          <ExtLink href={`${REPO_URL}/blob/main/NOTICE`}>NOTICE</ExtLink> file.
        </p>
      </Section>

      <Section title="Game content">
        <p>
          This work includes material from the System Reference Document 5.2 (&quot;SRD 5.2&quot;) by Wizards of the Coast
          LLC, available at <ExtLink href="https://www.dndbeyond.com/srd">https://www.dndbeyond.com/srd</ExtLink>. The SRD
          5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at{' '}
          <ExtLink href="https://creativecommons.org/licenses/by/4.0/legalcode">
            https://creativecommons.org/licenses/by/4.0/legalcode
          </ExtLink>
          .
        </p>
        <p>
          This work includes material taken from the System Reference Document 5.1 (&quot;SRD 5.1&quot;) by Wizards of the
          Coast LLC and available at{' '}
          <ExtLink href="https://dnd.wizards.com/resources/systems-reference-document">
            https://dnd.wizards.com/resources/systems-reference-document
          </ExtLink>
          . The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at{' '}
          <ExtLink href="https://creativecommons.org/licenses/by/4.0/legalcode">
            https://creativecommons.org/licenses/by/4.0/legalcode
          </ExtLink>
          . From the SRD 5.1, FlyBy includes only what the SRD 5.2 does not cover: the Half-Elf and Half-Orc, 13 Eldritch
          Invocations and some adventuring gear, marked as legacy content.
        </p>
        <p>
          FlyBy reads game data in the 5etools format (MIT, Copyright 2017 TheGiddyLimit and contributors). Any content
          beyond the SRD comes from a data source you configure; it is read on your device and is not distributed with
          FlyBy.
        </p>
      </Section>

      <Section title="Foundry VTT">
        <p>
          The Foundry export follows the data model of the{' '}
          <ExtLink href="https://github.com/foundryvtt/dnd5e">dnd5e system for Foundry Virtual Tabletop</ExtLink> (MIT,
          Copyright 2021 Andrew Clayton), and uses compendium references and activities generated from it.
        </p>
      </Section>

      <Section title="Icons">
        <p>
          Game icons from <ExtLink href="https://game-icons.net">game-icons.net</ExtLink>, licensed under{' '}
          <ExtLink href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</ExtLink>, by:
        </p>
        <ul className={styles.credits}>
          {ICON_CREDITS.map(({ author, icons }) => (
            <li key={author}>
              <strong>{author}</strong>: {icons.join(', ')}
            </li>
          ))}
        </ul>
        <p>
          Interface icons from <ExtLink href="https://lucide.dev">Lucide</ExtLink> (ISC License, Lucide Icons and
          Contributors), some of them derived from <ExtLink href="https://feathericons.com">Feather</ExtLink> (MIT
          License, Cole Bemis). License texts in the <ExtLink href="https://lucide.dev/license">Lucide license</ExtLink>.
        </p>
      </Section>

      <Section title="Fonts">
        <p>
          The Parchment theme uses <ExtLink href="https://github.com/NDISCOVER/Cinzel">Cinzel</ExtLink> (The Cinzel Project
          Authors) and <ExtLink href="https://github.com/huertatipografica/Alegreya">Alegreya</ExtLink> (The Alegreya
          Project Authors), both under the <ExtLink href="https://openfontlicense.org">SIL Open Font License 1.1</ExtLink>.
        </p>
      </Section>

      <Section title="Built with">
        <p>
          React, React Router, Vite, Zustand, Dexie and react-pdf, all under the MIT License.
        </p>
      </Section>

      <p className={styles.disclaimer}>
        FlyBy is an unofficial fan-made tool. It is not affiliated with, endorsed, sponsored or approved by Wizards of the
        Coast, 5etools or Foundry Gaming LLC.
      </p>
    </div>
  );
}

// =============================================================================
// feedback: o link de feedback do app
// =============================================================================
// O QUE FAZ
//   Sem backend: o feedback é um mailto: com assunto e corpo pré-preenchidos.
// -----------------------------------------------------------------------------

const FEEDBACK_EMAIL = 'pinktanjao@gmail.com';

const BODY = [
  'Type (bug / suggestion / question):',
  '',
  'What happened, or what would you like to see:',
  '',
  '',
  'Where in the app (species, class, inventory, spellbook, export...):',
  '',
  '',
  'Device / browser (optional):',
  '',
].join('\r\n');

export const FEEDBACK_URL = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('FlyBy feedback')}&body=${encodeURIComponent(BODY)}`;

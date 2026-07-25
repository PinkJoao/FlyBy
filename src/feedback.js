// Feedback e sugestões: sem backend, um mailto: com assunto/corpo pré-preenchidos.
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

// =============================================================================
// ORIGIN_CHOICES - as escolhas FIXAS de proficiência da origem custom 2024
// =============================================================================
// Descritores no mesmo formato que `parseChoices` gera (para o ChoiceList): a
// origem custom concede 2 perícias, 1 ferramenta e 1 idioma livres. Vive num
// módulo próprio (não num componente) para ser compartilhado entre a
// BackgroundTab e o passo de Proficiências do wizard sem quebrar o fast-refresh.
// -----------------------------------------------------------------------------

export const ORIGIN_CHOICES = [
  { id: 'skill', kind: 'skill', count: 2, label: 'Skill Proficiencies', pool: { type: 'any', of: 'skill' } },
  { id: 'tool', kind: 'tool', count: 1, label: 'Tool Proficiency', pool: { type: 'any', of: 'tool' } },
  { id: 'language', kind: 'language', count: 1, label: 'Language', pool: { type: 'any', of: 'language' } },
];

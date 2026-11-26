// =============================================================================
// originChoices: as escolhas fixas de proficiência da origem custom 2024
// =============================================================================
// O QUE FAZ
//   Os descritores no formato do parseChoices: 2 perícias, 1 ferramenta e 2 idiomas
//   livres (o XPHB: "Common plus two languages", DDL-0328; antes era 1). Num módulo próprio para a BackgroundTab e o passo de Proficiências do
//   wizard compartilharem, sem quebrar o fast-refresh.
// -----------------------------------------------------------------------------

export const ORIGIN_CHOICES = [
  { id: 'skill', kind: 'skill', count: 2, label: 'Skill Proficiencies', pool: { type: 'any', of: 'skill' } },
  { id: 'tool', kind: 'tool', count: 1, label: 'Tool Proficiency', pool: { type: 'any', of: 'tool' } },
  { id: 'language', kind: 'language', count: 2, label: 'Languages', pool: { type: 'any', of: 'language' } },
];

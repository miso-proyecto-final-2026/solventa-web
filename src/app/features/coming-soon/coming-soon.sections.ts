/** Pantallas que el menú ya enlaza pero que todavía no existen. Va aparte para no cargar la página con las rutas. */
export type ComingSoonSection = 'quote' | 'policies' | 'claims' | 'profile';

export const COMING_SOON_SECTIONS: readonly ComingSoonSection[] = [
  'quote',
  'policies',
  'claims',
  'profile',
];

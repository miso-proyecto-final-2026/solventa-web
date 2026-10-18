/** Idiomas con build propio. Debe coincidir con `i18n` en angular.json. */
export const APP_LOCALES = ['es-CO', 'en-US'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export function isAppLocale(value: unknown): value is AppLocale {
  return APP_LOCALES.includes(value as AppLocale);
}

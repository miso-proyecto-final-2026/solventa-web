export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
  /** Marca activo solo con la ruta exacta; el inicio no debe quedar activo en todas las páginas. */
  readonly exact: boolean;
  /** Si se indica, la opción solo se muestra a quien tenga alguno de estos roles. */
  readonly requiredRoles?: readonly string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: $localize`:@@nav.home:Inicio`, icon: '🏠', exact: true },
  { path: '/quote', label: $localize`:@@nav.quote:Cotizar`, icon: '📋', exact: false },
  {
    path: '/assisted-quote',
    label: $localize`:@@nav.assisted-quote:Cotización asistida`,
    icon: '🤝',
    exact: false,
    requiredRoles: ['ASESOR'],
  },
  {
    path: '/client-consent',
    label: $localize`:@@nav.client-consent:Consentimiento`,
    icon: '🔐',
    exact: false,
    requiredRoles: ['ASESOR'],
  },
  {
    path: '/failed-payments',
    label: $localize`:@@nav.failed-payments:Cobros fallidos`,
    icon: '💳',
    exact: false,
    requiredRoles: ['ASESOR', 'OPERADOR'],
  },
  {
    path: '/subscriptions',
    label: $localize`:@@nav.subscriptions:Suscripciones`,
    icon: '✍️',
    exact: false,
    requiredRoles: ['ASESOR'],
  },
  { path: '/policies', label: $localize`:@@nav.policies:Mis Pólizas`, icon: '🛡️', exact: false },
  { path: '/claims', label: $localize`:@@nav.claims:Siniestros`, icon: '⚡', exact: false },
  { path: '/profile', label: $localize`:@@nav.profile:Perfil`, icon: '👤', exact: false },
];

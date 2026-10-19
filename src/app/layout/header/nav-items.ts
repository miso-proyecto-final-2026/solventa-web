export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
  /** Marca activo solo con la ruta exacta; el inicio no debe quedar activo en todas las páginas. */
  readonly exact: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: $localize`:@@nav.home:Inicio`, icon: '🏠', exact: true },
  { path: '/quote', label: $localize`:@@nav.quote:Cotizar`, icon: '📋', exact: false },
  { path: '/policies', label: $localize`:@@nav.policies:Mis Pólizas`, icon: '🛡️', exact: false },
  { path: '/claims', label: $localize`:@@nav.claims:Siniestros`, icon: '⚡', exact: false },
  { path: '/profile', label: $localize`:@@nav.profile:Perfil`, icon: '👤', exact: false },
];

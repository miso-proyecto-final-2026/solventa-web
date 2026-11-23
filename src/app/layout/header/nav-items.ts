/** Una pantalla de la consola: ruta, etiqueta y, si se indica, los roles que la ven. */
export interface NavTab {
  readonly path: string;
  readonly label: string;
  /** Si se indica, la pestaña solo se muestra a quien tenga alguno de estos roles. */
  readonly requiredRoles?: readonly string[];
}

/** Una opción de la barra principal. Agrupa una o varias pantallas; con varias, la página muestra pestañas. */
export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly tabs: readonly NavTab[];
  /** Ruta a la que enlaza la opción si esa pestaña se muestra; si no, la primera pestaña visible. */
  readonly entryPath?: string;
  /** Marca activo solo con la ruta exacta; el inicio no debe quedar activo en todas las páginas. */
  readonly exact?: boolean;
}

/** Grupo con solo las pestañas que la persona puede ver, y el enlace de su opción en la barra. */
export interface VisibleNavGroup {
  readonly group: NavGroup;
  readonly tabs: readonly NavTab[];
  readonly href: string;
}

// Las rutas no cambian: solo se agrupan. Las etiquetas de las pestañas conservan sus claves @@nav.* de siempre.
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'home',
    label: $localize`:@@nav.home:Inicio`,
    exact: true,
    tabs: [{ path: '/', label: $localize`:@@nav.home:Inicio` }],
  },
  {
    id: 'quotes',
    label: $localize`:@@nav.group.quotes:Cotizaciones`,
    entryPath: '/assisted-quote',
    tabs: [
      { path: '/quote', label: $localize`:@@nav.quote:Cotizar` },
      {
        path: '/assisted-quote',
        label: $localize`:@@nav.assisted-quote:Cotización asistida`,
        requiredRoles: ['ASESOR'],
      },
      {
        path: '/assisted-review',
        label: $localize`:@@nav.assisted-review:Revisión asistida`,
        requiredRoles: ['ASESOR'],
      },
    ],
  },
  {
    id: 'consents',
    label: $localize`:@@nav.group.consents:Consentimientos`,
    tabs: [
      {
        path: '/client-consent',
        label: $localize`:@@nav.group.consents:Consentimientos`,
        requiredRoles: ['ASESOR'],
      },
    ],
  },
  {
    id: 'policies',
    label: $localize`:@@nav.group.policies:Pólizas`,
    tabs: [{ path: '/policies', label: $localize`:@@nav.group.policies:Pólizas` }],
  },
  {
    id: 'billing',
    label: $localize`:@@nav.group.billing:Cobros`,
    tabs: [
      {
        path: '/failed-payments',
        label: $localize`:@@nav.failed-payments:Cobros fallidos`,
        requiredRoles: ['ASESOR', 'OPERADOR'],
      },
      {
        path: '/subscriptions',
        label: $localize`:@@nav.subscriptions:Suscripciones`,
        requiredRoles: ['ASESOR'],
      },
      {
        path: '/reconciliation',
        label: $localize`:@@nav.reconciliation:Conciliación`,
        requiredRoles: ['OPERADOR'],
      },
    ],
  },
  {
    id: 'claims',
    label: $localize`:@@nav.claims:Siniestros`,
    tabs: [{ path: '/claims', label: $localize`:@@nav.claims:Siniestros` }],
  },
];

/** Perfil sale de la barra y vive en el menú de cuenta. */
export const PROFILE_PATH = '/profile';

/** Los grupos que la persona ve: un grupo aparece si al menos una de sus pestañas aparece. */
export function visibleGroups(
  hasAnyRole: (roles: readonly string[]) => boolean,
): VisibleNavGroup[] {
  return NAV_GROUPS.flatMap((group) => {
    const tabs = group.tabs.filter((tab) => !tab.requiredRoles || hasAnyRole(tab.requiredRoles));
    if (tabs.length === 0) return [];
    const entry = tabs.find((tab) => tab.path === group.entryPath) ?? tabs[0];
    return [{ group, tabs, href: entry.path }];
  });
}

/** Si la URL actual es la ruta indicada o una hija suya (sin contar parámetros ni fragmento). */
export function pathMatches(url: string, path: string, exact = false): boolean {
  const current = url.split(/[?#]/)[0] || '/';
  if (path === '/' || exact) return current === path;
  return current === path || current.startsWith(`${path}/`);
}

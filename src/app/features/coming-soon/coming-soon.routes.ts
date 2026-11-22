import { Routes } from '@angular/router';
import { ComingSoonPage } from './coming-soon-page';
import { ComingSoonSection } from './coming-soon.sections';

const NAMES: Readonly<Record<ComingSoonSection, string>> = {
  quote: $localize`:@@nav.quote:Cotizar`,
  policies: $localize`:@@nav.group.policies:Pólizas`,
  claims: $localize`:@@nav.claims:Siniestros`,
  profile: $localize`:@@nav.profile:Perfil`,
};

export function comingSoonRoutes(section: ComingSoonSection): Routes {
  const name = NAMES[section];
  return [
    {
      path: '',
      component: ComingSoonPage,
      data: { name },
      title: $localize`:@@comingSoon.document-title:Solventa — ${name}:name:`,
    },
  ];
}

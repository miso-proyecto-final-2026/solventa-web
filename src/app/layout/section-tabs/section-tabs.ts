import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavState } from '../header/nav-state';

/** Pestañas de los grupos con varias pantallas (Cotizaciones, Cobros). Enlazan a las rutas de siempre. */
@Component({
  selector: 'sol-section-tabs',
  imports: [RouterLink],
  templateUrl: './section-tabs.html',
  styleUrl: './section-tabs.scss',
})
export class SectionTabs {
  protected readonly nav = inject(NavState);

  /** Solo hay pestañas si el grupo activo tiene al menos dos que la persona pueda ver. */
  protected readonly section = computed(() => {
    const active = this.nav.active();
    return active && active.tabs.length > 1 ? active : null;
  });

  protected readonly label = computed(() => {
    const section = this.section();
    return section ? $localize`:@@nav.tabs.label:Secciones de ${section.group.label}:group:` : '';
  });
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { filter } from 'rxjs';
import { VisibleNavGroup, pathMatches, visibleGroups } from './nav-items';

/** Qué opciones ve la persona y cuál es la activa; lo comparten la barra y las pestañas de cada página. */
@Injectable({ providedIn: 'root' })
export class NavState {
  private readonly session = inject(SessionStore);
  private readonly url = signal(inject(Router).url);

  readonly groups = computed<VisibleNavGroup[]>(() =>
    visibleGroups((roles) => this.session.hasAnyRole(roles)),
  );

  /** El grupo al que pertenece la ruta actual; `null` si ninguno (por ejemplo, el inicio de sesión). */
  readonly active = computed(
    () =>
      this.groups().find((item) =>
        item.tabs.some((tab) => pathMatches(this.url(), tab.path, item.group.exact)),
      ) ?? null,
  );

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.url.set(event.urlAfterRedirects));
  }

  isTabActive(path: string): boolean {
    return pathMatches(this.url(), path);
  }
}

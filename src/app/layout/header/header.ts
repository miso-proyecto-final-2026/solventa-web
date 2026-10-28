import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { LanguageSelector } from '../language-selector/language-selector';
import { NAV_ITEMS } from './nav-items';

@Component({
  selector: 'sol-header',
  imports: [RouterLink, RouterLinkActive, LanguageSelector],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);

  /** Las opciones con rol solo las ve quien lo tiene. */
  protected readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.requiredRoles || this.session.hasAnyRole(item.requiredRoles)),
  );

  protected logout(): void {
    this.session.end();
    void this.router.navigateByUrl('/');
  }
}

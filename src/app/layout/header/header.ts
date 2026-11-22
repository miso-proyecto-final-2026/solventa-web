import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { LocaleSwitcher } from '@core/i18n/locale-switcher';
import { LanguageSelector, SWITCH_LABELS } from '../language-selector/language-selector';
import { NavState } from './nav-state';
import { PROFILE_PATH } from './nav-items';

@Component({
  selector: 'sol-header',
  imports: [RouterLink, RouterLinkActive, LanguageSelector],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly locale = inject(LocaleSwitcher);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly session = inject(SessionStore);
  protected readonly nav = inject(NavState);

  protected readonly profilePath = PROFILE_PATH;
  protected readonly menuOpen = signal(false);
  protected readonly canSwitchLanguage = this.locale.canSwitch;
  protected readonly otherLanguage = this.locale.other.split('-')[0].toUpperCase();
  protected readonly languageLabel = SWITCH_LABELS[this.locale.other];

  protected toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.menuOpen.set(true);
    afterNextRender(() => this.items()[0]?.focus(), { injector: this.injector });
  }

  protected closeMenu(restoreFocus = false): void {
    this.menuOpen.set(false);
    if (restoreFocus) this.trigger()?.nativeElement.focus();
  }

  /** Esc cierra y devuelve el foco al botón; las flechas recorren las opciones. */
  @HostListener('keydown', ['$event'])
  protected onMenuKeydown(event: KeyboardEvent): void {
    if (!this.menuOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu(true);
      return;
    }
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[(index + step + items.length) % items.length]?.focus();
  }

  /** Si el foco sale del menú de cuenta, se cierra. */
  @HostListener('focusout', ['$event'])
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (this.menuOpen() && next && !this.account()?.contains(next)) this.closeMenu();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (
      this.menuOpen() &&
      !this.host.nativeElement.querySelector('.account')?.contains(event.target as Node)
    ) {
      this.closeMenu();
    }
  }

  protected changeLanguage(): void {
    this.closeMenu();
    this.locale.switchTo(this.locale.other);
  }

  protected logout(): void {
    this.closeMenu();
    this.session.end();
    void this.router.navigateByUrl('/');
  }

  private account(): HTMLElement | null {
    return this.host.nativeElement.querySelector('.account');
  }

  private items(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }
}

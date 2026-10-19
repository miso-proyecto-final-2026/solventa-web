import { Component, inject } from '@angular/core';
import { LocaleSwitcher } from '@core/i18n/locale-switcher';
import { AppLocale } from '@core/i18n/locales';

/**
 * Nombre accesible del botón, por idioma de destino. Dice el idioma actual y la acción,
 * e incluye el código visible del botón (WCAG 2.5.3).
 */
const SWITCH_LABELS: Readonly<Record<AppLocale, string>> = {
  'es-CO': $localize`:@@language.switch.es-CO:Idioma de la aplicación: inglés. Cambiar a español (ES)`,
  'en-US': $localize`:@@language.switch.en-US:Idioma de la aplicación: español. Cambiar a inglés (EN)`,
};

@Component({
  selector: 'sol-language-selector',
  templateUrl: './language-selector.html',
  styleUrl: './language-selector.scss',
})
export class LanguageSelector {
  private readonly switcher = inject(LocaleSwitcher);

  protected readonly visible = this.switcher.canSwitch;
  protected readonly code = this.switcher.other.split('-')[0].toUpperCase();
  protected readonly label = SWITCH_LABELS[this.switcher.other];

  protected change(): void {
    this.switcher.switchTo(this.switcher.other);
  }
}

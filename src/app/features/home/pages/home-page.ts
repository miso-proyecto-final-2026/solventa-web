import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from '@shared/ui/card/card';

@Component({
  selector: 'sol-home-page',
  imports: [RouterLink, Card],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  protected readonly valueProps = [
    {
      icon: '⚡',
      title: $localize`:@@home.value.instant.title:Cotización instantánea`,
      text: $localize`:@@home.value.instant.text:Obtén tu prima personalizada en menos de 3 segundos, usando tus datos financieros con tu consentimiento.`,
    },
    {
      icon: '📱',
      title: $localize`:@@home.value.digital.title:100% digital`,
      text: $localize`:@@home.value.digital.text:Desde la cotización hasta el pago, todo desde tu celular o computador. Sin papeleos.`,
    },
    {
      icon: '🔄',
      title: $localize`:@@home.value.claims.title:Siniestro automático`,
      text: $localize`:@@home.value.claims.text:Eventos paramétricos procesados automáticamente. Recibe tu indemnización sin trámites.`,
    },
  ] as const;

  protected readonly partners = ['Fintech A', 'Banco B', 'Comercio C'] as const;
}

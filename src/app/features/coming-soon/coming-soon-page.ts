import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Card } from '@shared/ui/card/card';

/** Marcador de una pantalla que todavía no existe: dice cuál es y lleva de vuelta al inicio. */
@Component({
  selector: 'sol-coming-soon-page',
  imports: [RouterLink, Card],
  templateUrl: './coming-soon-page.html',
  styleUrl: './coming-soon-page.scss',
})
export class ComingSoonPage {
  protected readonly name: string = inject(ActivatedRoute).snapshot.data['name'] ?? '';
}

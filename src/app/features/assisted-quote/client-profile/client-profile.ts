import { Component, input, output } from '@angular/core';
import { Alert } from '@shared/ui/alert/alert';
import { ConsentStatus } from '../consent-status/consent-status';
import { levelLabel, profileSourceLabel, signalLabel } from '../domain/labels';
import { ClientIdentity, DocumentId, ProfileSummary } from '../domain/models';

/** Paso 2: perfil del cliente. El asesor lo revisa y aprueba cotizar (o continúa sin cuenta). */
@Component({
  selector: 'sol-client-profile',
  imports: [Alert, ConsentStatus],
  templateUrl: './client-profile.html',
  styleUrl: './client-profile.scss',
})
export class ClientProfile {
  readonly client = input<ClientIdentity | null>(null);
  readonly profile = input<ProfileSummary | null>(null);
  /** Documento buscado; se muestra cuando no existe un cliente con él. */
  readonly searched = input<DocumentId | null>(null);
  readonly busy = input(false);

  readonly approve = output<void>();
  readonly searchAnother = output<void>();

  protected readonly signalLabel = signalLabel;
  protected readonly levelLabel = levelLabel;
  protected readonly sourceLabel = profileSourceLabel;
}

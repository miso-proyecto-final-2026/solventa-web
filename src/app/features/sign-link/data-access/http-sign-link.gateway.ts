import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { PUBLIC_REQUEST } from '@core/http/interceptors';
import { environment } from '@env/environment';
import { SignatureSubmission } from '@shared/signature/signature-steps';
import { Observable, map } from 'rxjs';
import { LinkDocument } from '../domain/models';
import { SignLinkGateway } from './sign-link.gateway';

const BASE = `${environment.apiBaseUrl}/suscripcion/v1/suscripciones/enlace-firma`;

interface LinkDocumentDto {
  numero_poliza: string;
  documento_sha256: string;
  estado: 'PENDIENTE' | 'FIRMADA';
  vence_en: string | null;
}

/**
 * Contra MS Suscripción. El token va en una cabecera, no en la URL, para que no quede en los logs del
 * borde. `PUBLIC_REQUEST`: aquí no se usa ni se toca la sesión de un asesor en el mismo navegador.
 */
@Injectable()
export class HttpSignLinkGateway extends SignLinkGateway {
  private readonly http = inject(HttpClient);
  private readonly context = new HttpContext().set(PUBLIC_REQUEST, true);

  getDocument(token: string): Observable<LinkDocument> {
    return this.http
      .get<LinkDocumentDto>(`${BASE}/documento`, {
        headers: this.headers(token),
        context: this.context,
      })
      .pipe(
        map((d) => ({
          policyNumber: d.numero_poliza,
          hash: d.documento_sha256,
          state: d.estado === 'FIRMADA' ? 'SIGNED' : 'PENDING',
          expiresAt: d.vence_en ? new Date(d.vence_en) : null,
        })),
      );
  }

  getPdf(token: string): Observable<Blob> {
    return this.http.get(`${BASE}/documento/pdf`, {
      responseType: 'blob',
      headers: this.headers(token),
      context: this.context,
    });
  }

  requestCode(token: string): Observable<void> {
    return this.http.post<void>(`${BASE}/codigo`, null, {
      headers: this.headers(token),
      context: this.context,
    });
  }

  sign(token: string, submission: SignatureSubmission): Observable<void> {
    return this.http
      .post(
        `${BASE}/firma`,
        {
          documento_sha256: submission.hash,
          documento_revisado: submission.reviewed,
          codigo: submission.code,
        },
        { headers: this.headers(token), context: this.context },
      )
      .pipe(map(() => undefined));
  }

  private headers(token: string): Record<string, string> {
    return { 'Cache-Control': 'no-cache', 'X-Enlace-Firma': token };
  }
}

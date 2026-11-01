import { Injectable } from '@angular/core';
import { ApiError } from '@core/http/api-error';
import { SignatureSubmission } from '@shared/signature/signature-steps';
import { Observable, of, throwError } from 'rxjs';
import { LinkDocument } from '../domain/models';
import { SignLinkGateway } from './sign-link.gateway';

const DEMO_OTP = '123456';

/** Datos simulados: cualquier token sirve, salvo `vencido`, y el código es `123456`. */
@Injectable()
export class MockSignLinkGateway extends SignLinkGateway {
  private signed = false;

  getDocument(token: string): Observable<LinkDocument> {
    if (token === 'vencido')
      return throwError(() => new ApiError('validation', 410, 'ENLACE_VENCIDO'));
    return of<LinkDocument>({
      policyNumber: 'SOLV-DEMO',
      hash: 'a'.repeat(64),
      state: this.signed ? 'SIGNED' : 'PENDING',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
  }

  getPdf(): Observable<Blob> {
    return of(new Blob(['%PDF-1.4 demo'], { type: 'application/pdf' }));
  }

  requestCode(): Observable<void> {
    return of(undefined);
  }

  sign(_token: string, submission: SignatureSubmission): Observable<void> {
    if (submission.code !== DEMO_OTP) {
      return throwError(
        () =>
          new ApiError('forbidden', 403, 'OTP_INVALIDO', [
            { field: 'codigo', reason: 'intentos restantes: 2' },
          ]),
      );
    }
    this.signed = true;
    return of(undefined);
  }
}

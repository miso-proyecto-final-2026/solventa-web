import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { ApiError } from '../http/api-error';
import { AuthGateway } from './auth.gateway';
import { Session } from './session.store';

/** Credenciales del usuario de demostración del adaptador simulado. No existen en ningún backend. */
export const MOCK_ADVISOR = { email: 'asesor@solventa.test', password: 'Demo12345' } as const;

const MOCK_SESSION_MS = 30 * 60 * 1000;

/** Adaptador simulado para desarrollo sin backend y para Cypress. */
@Injectable()
export class MockAuthGateway extends AuthGateway {
  login(email: string, password: string): Observable<Session> {
    if (email.trim().toLowerCase() !== MOCK_ADVISOR.email || password !== MOCK_ADVISOR.password) {
      return throwError(() => new ApiError('unauthenticated', 401));
    }
    return of({
      token: 'mock-token',
      user: { id: 'mock-advisor', name: 'Asesor Demo', role: 'ASESOR' },
      expiresAt: Date.now() + MOCK_SESSION_MS,
    });
  }
}

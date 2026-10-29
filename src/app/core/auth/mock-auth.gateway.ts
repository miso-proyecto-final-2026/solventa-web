import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { ApiError } from '../http/api-error';
import { AuthGateway } from './auth.gateway';
import { Session } from './session.store';

/** Credenciales del usuario de demostración del adaptador simulado. No existen en ningún backend. */
export const MOCK_ADVISOR = { email: 'asesor@solventa.test', password: 'Demo12345' } as const;
export const MOCK_OPERATOR = { email: 'operador@solventa.test', password: 'Demo12345' } as const;

const MOCK_USERS = [
  { ...MOCK_ADVISOR, user: { id: 'mock-advisor', name: 'Asesor Demo', role: 'ASESOR' } },
  { ...MOCK_OPERATOR, user: { id: 'mock-operator', name: 'Operador Demo', role: 'OPERADOR' } },
];

const MOCK_SESSION_MS = 30 * 60 * 1000;

/** Adaptador simulado para desarrollo sin backend y para Cypress. */
@Injectable()
export class MockAuthGateway extends AuthGateway {
  login(email: string, password: string): Observable<Session> {
    const found = MOCK_USERS.find(
      (u) => u.email === email.trim().toLowerCase() && u.password === password,
    );
    if (!found) return throwError(() => new ApiError('unauthenticated', 401));
    return of({ token: 'mock-token', user: found.user, expiresAt: Date.now() + MOCK_SESSION_MS });
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthGateway } from './auth.gateway';
import { SessionStore } from './session.store';

/** Caso de uso de inicio y cierre de sesión: coordina el gateway con la sesión en memoria. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly gateway = inject(AuthGateway);
  private readonly session = inject(SessionStore);

  login(email: string, password: string): Observable<unknown> {
    return this.gateway.login(email.trim(), password).pipe(tap((s) => this.session.start(s)));
  }

  logout(): void {
    this.session.end();
  }
}

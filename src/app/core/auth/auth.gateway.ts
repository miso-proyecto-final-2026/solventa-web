import { Observable } from 'rxjs';
import { Session } from './session.store';

/** Lo que la app necesita del servicio de identidad del personal, en sus propios términos. */
export abstract class AuthGateway {
  abstract login(email: string, password: string): Observable<Session>;
}

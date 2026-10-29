import { Injectable, computed, signal } from '@angular/core';

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly role: string;
}

export interface Session {
  readonly token: string;
  readonly user: SessionUser;
  /** Instante (ms desde epoch) en que vence el token. */
  readonly expiresAt: number;
}

const STORAGE_KEY = 'solventa.session';

/**
 * Sesión del personal interno. El token vive en memoria y se respalda en `sessionStorage` para
 * sobrevivir al cambio de idioma (que recarga la app), pero no al cerrar la pestaña.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly current = signal<Session | null>(this.restore());
  private readonly expiredFlag = signal(false);

  readonly user = computed(() => this.current()?.user ?? null);
  readonly isAuthenticated = computed(() => this.current() !== null);
  /** Verdadero cuando la sesión venció (por tiempo o por un 401) y aún no se inició otra. */
  readonly expired = this.expiredFlag.asReadonly();

  /** Verifica el vencimiento por tiempo; si ya pasó, cierra la sesión marcándola vencida. */
  isActive(): boolean {
    const session = this.current();
    if (!session) return false;
    if (Date.now() >= session.expiresAt) {
      this.expire();
      return false;
    }
    return true;
  }

  hasRole(role: string): boolean {
    return this.user()?.role === role;
  }

  hasAnyRole(roles: readonly string[]): boolean {
    return roles.some((role) => this.hasRole(role));
  }

  token(): string | null {
    return this.isActive() ? (this.current()?.token ?? null) : null;
  }

  start(session: Session): void {
    this.expiredFlag.set(false);
    this.current.set(session);
    this.persist(session);
  }

  /** Cierre voluntario. */
  end(): void {
    this.expiredFlag.set(false);
    this.current.set(null);
    this.persist(null);
  }

  /** La sesión dejó de ser válida: la pantalla debe pedir iniciar sesión de nuevo. */
  expire(): void {
    if (!this.current()) return;
    this.current.set(null);
    this.expiredFlag.set(true);
    this.persist(null);
  }

  private restore(): Session | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as Session;
      return session.expiresAt > Date.now() ? session : null;
    } catch {
      return null; // almacenamiento bloqueado o dato dañado: se empieza sin sesión
    }
  }

  private persist(session: Session | null): void {
    try {
      if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // sin almacenamiento la sesión solo vive en memoria
    }
  }
}

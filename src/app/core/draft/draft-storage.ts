import { Injectable } from '@angular/core';

const PREFIX = 'solventa.draft.';

/**
 * Guarda el borrador de un formulario en `sessionStorage` para no perder lo ingresado cuando la
 * sesión vence o la app se recarga (por ejemplo, al cambiar de idioma). Es tolerante a fallos:
 * si el almacenamiento no está disponible, la app funciona y solo deja de recordar.
 */
@Injectable({ providedIn: 'root' })
export class DraftStorage {
  save<T>(key: string, value: T): void {
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // sin almacenamiento no se puede recordar
    }
  }

  load<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(PREFIX + key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null; // dato dañado o almacenamiento bloqueado
    }
  }

  clear(key: string): void {
    try {
      sessionStorage.removeItem(PREFIX + key);
    } catch {
      // nada que limpiar
    }
  }
}

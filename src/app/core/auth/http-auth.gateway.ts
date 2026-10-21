import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, map } from 'rxjs';
import { AuthGateway } from './auth.gateway';
import { Session } from './session.store';

interface LoginResponseDto {
  access_token: string;
  expira_en: number;
  usuario: { id: string; nombre: string; rol: string };
}

/** Adaptador contra MS Identidad (`POST /v1/sesiones-internas`). */
@Injectable()
export class HttpAuthGateway extends AuthGateway {
  private readonly http = inject(HttpClient);

  login(email: string, password: string): Observable<Session> {
    return this.http
      .post<LoginResponseDto>(`${environment.apiBaseUrl}/identidad/v1/sesiones-internas`, {
        email,
        password,
      })
      .pipe(
        map((dto) => ({
          token: dto.access_token,
          user: { id: dto.usuario.id, name: dto.usuario.nombre, role: dto.usuario.rol },
          expiresAt: Date.now() + dto.expira_en * 1000,
        })),
      );
  }
}

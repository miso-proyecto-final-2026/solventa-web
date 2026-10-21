import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { Alert } from '@shared/ui/alert/alert';
import { describedBy, FormField } from '@shared/ui/form-field/form-field';

type LoginFailure = 'credentials' | 'server' | 'network';

/** Solo se vuelve a rutas internas: evita que `returnUrl` lleve a otro sitio. */
function safeReturnUrl(url: string | null): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

@Component({
  selector: 'sol-login-page',
  imports: [ReactiveFormsModule, Alert, FormField],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly session = inject(SessionStore);
  protected readonly describedBy = describedBy;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly failure = signal<LoginFailure | null>(null);

  protected readonly failureMessage = computed(() => {
    switch (this.failure()) {
      case 'credentials':
        return $localize`:@@auth.login.error.credentials:El correo o la contraseña no son correctos.`;
      case 'network':
        return $localize`:@@auth.login.error.network:No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.`;
      case 'server':
        return $localize`:@@auth.login.error.server:No pudimos iniciar tu sesión por un problema del servidor. Inténtalo de nuevo en unos minutos.`;
      default:
        return null;
    }
  });

  /** Mensaje de un campo, solo después de tocarlo o de intentar enviar. */
  protected fieldError(name: 'email' | 'password'): string | null {
    const control = this.form.controls[name];
    if (!control.invalid || !(control.touched || this.submitted())) return null;
    if (control.hasError('required')) {
      return name === 'email'
        ? $localize`:@@auth.login.email.required:Escribe tu correo.`
        : $localize`:@@auth.login.password.required:Escribe tu contraseña.`;
    }
    return $localize`:@@auth.login.email.invalid:El correo no tiene un formato válido.`;
  }

  protected submit(): void {
    if (this.busy()) return; // evita enviar dos veces mientras se espera
    this.submitted.set(true);
    this.failure.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigateByUrl(
          safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        );
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const kind = error instanceof ApiError ? error.kind : 'server';
        this.failure.set(
          kind === 'unauthenticated' || kind === 'validation'
            ? 'credentials'
            : kind === 'network'
              ? 'network'
              : 'server',
        );
      },
    });
  }
}

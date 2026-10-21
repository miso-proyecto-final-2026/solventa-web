import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthGateway } from '@core/auth/auth.gateway';
import { MOCK_ADVISOR, MockAuthGateway } from '@core/auth/mock-auth.gateway';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { Observable, Subject, of, throwError } from 'rxjs';
import { Session } from '@core/auth/session.store';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let el: HTMLElement;
  let navigate: jasmine.Spy;

  const type = (id: string, value: string) => {
    const control = el.querySelector<HTMLInputElement>(`#${id}`)!;
    control.value = value;
    control.dispatchEvent(new Event('input'));
  };
  const submit = async () => {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  };
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';

  const create = async (returnUrl: string | null = null, gateway?: Partial<AuthGateway>) => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthGateway, useValue: gateway ?? new MockAuthGateway() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(LoginPage);
    el = fixture.nativeElement;
    await fixture.whenStable();
  };

  afterEach(() => sessionStorage.clear());

  it('should label both fields and have a single main heading', async () => {
    await create();

    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('label[for="login-email"]')?.textContent).toContain('Correo');
    expect(el.querySelector('label[for="login-password"]')?.textContent).toContain('Contraseña');
  });

  it('should ask for both fields before sending anything', async () => {
    await create();

    await submit();

    expect(el.querySelector('#login-email-error')?.textContent).toContain('Escribe tu correo');
    expect(el.querySelector('#login-password-error')?.textContent).toContain(
      'Escribe tu contraseña',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should reject a malformed email', async () => {
    await create();

    type('login-email', 'no-es-correo');
    type('login-password', 'x');
    await submit();

    expect(el.querySelector('#login-email-error')?.textContent).toContain('formato válido');
  });

  it('should sign in and go back to where the advisor was heading', async () => {
    await create('/assisted-quote');

    type('login-email', MOCK_ADVISOR.email);
    type('login-password', MOCK_ADVISOR.password);
    await submit();

    expect(TestBed.inject(SessionStore).hasRole('ASESOR')).toBeTrue();
    expect(navigate).toHaveBeenCalledWith('/assisted-quote');
  });

  it('should never follow a return URL that leaves the site', async () => {
    await create('//malo.example.com');

    type('login-email', MOCK_ADVISOR.email);
    type('login-password', MOCK_ADVISOR.password);
    await submit();

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('should say the credentials are wrong, without starting a session', async () => {
    await create();

    type('login-email', MOCK_ADVISOR.email);
    type('login-password', 'incorrecta');
    await submit();

    expect(el.querySelector('sol-alert [role="alert"]')?.textContent).toContain('no son correctos');
    expect(TestBed.inject(SessionStore).isAuthenticated()).toBeFalse();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('should tell a server failure apart from wrong credentials', async () => {
    await create(null, { login: () => throwError(() => new ApiError('server', 500)) });

    type('login-email', MOCK_ADVISOR.email);
    type('login-password', 'x');
    await submit();

    expect(text()).toContain('problema del servidor');
    expect(text()).not.toContain('no son correctos');
  });

  it('should tell a network failure apart', async () => {
    await create(null, { login: () => throwError(() => new ApiError('network', 0)) });

    type('login-email', MOCK_ADVISOR.email);
    type('login-password', 'x');
    await submit();

    expect(text()).toContain('No hay conexión');
  });

  it('should explain that the session expired and that the work is kept', async () => {
    await create();
    const session = TestBed.inject(SessionStore);
    session.start({
      token: 't',
      user: { id: '1', name: 'A', role: 'ASESOR' },
      expiresAt: Date.now() + 1000,
    });
    session.expire();
    await fixture.whenStable();

    expect(el.querySelector('sol-alert [role="status"]')?.textContent).toContain(
      'Tu sesión venció',
    );
  });

  it('should ignore a second submit while the first is running', async () => {
    const pending = new Subject<Session>();
    let calls = 0;
    await create(null, {
      login: (): Observable<Session> => {
        calls++;
        return pending;
      },
    });
    type('login-email', MOCK_ADVISOR.email);
    type('login-password', 'x');

    await submit();
    await submit();

    expect(calls).toBe(1);
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeTrue();
    pending.complete();
  });

  it('should accept any gateway that answers with a session', async () => {
    await create(null, {
      login: () =>
        of({
          token: 't',
          user: { id: '1', name: 'A', role: 'ASESOR' },
          expiresAt: Date.now() + 1000,
        }),
    });
    type('login-email', 'a@b.co');
    type('login-password', 'x');

    await submit();

    expect(navigate).toHaveBeenCalledWith('/');
  });
});

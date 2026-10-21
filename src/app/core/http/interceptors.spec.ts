import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../auth/session.store';
import { ApiError } from './api-error';
import { apiErrorInterceptor, authTokenInterceptor } from './interceptors';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authTokenInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => {
    backend.verify();
    sessionStorage.clear();
  });

  const signIn = () =>
    session.start({
      token: 'abc',
      user: { id: '1', name: 'Asesora', role: 'ASESOR' },
      expiresAt: Date.now() + 60_000,
    });

  it('should send the advisor token to our own API', () => {
    signIn();

    http.get('/api/cotizacion/v1/productos').subscribe();

    const req = backend.expectOne('/api/cotizacion/v1/productos');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    req.flush({});
  });

  it('should never send the token to another host', () => {
    signIn();

    http.get('https://otro.example.com/datos').subscribe();

    const req = backend.expectOne('https://otro.example.com/datos');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should send no header without a session', () => {
    http.get('/api/x').subscribe();

    const req = backend.expectOne('/api/x');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should turn HTTP failures into ApiError', () => {
    let failure: unknown;
    http.get('/api/x').subscribe({ error: (e: unknown) => (failure = e) });

    backend
      .expectOne('/api/x')
      .flush({ error: { code: 'VALIDATION_ERROR', details: [] } }, { status: 422, statusText: '' });

    expect(failure instanceof ApiError).toBeTrue();
    expect((failure as ApiError).kind).toBe('validation');
    expect((failure as ApiError).code).toBe('VALIDATION_ERROR');
  });

  it('should mark the session as expired on a 401 while signed in', () => {
    signIn();
    http.get('/api/x').subscribe({ error: () => undefined });

    backend.expectOne('/api/x').flush(null, { status: 401, statusText: '' });

    expect(session.expired()).toBeTrue();
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('should not flag an expiry when a 401 arrives without a session (wrong login)', () => {
    http.post('/api/identidad/v1/sesiones-internas', {}).subscribe({ error: () => undefined });

    backend
      .expectOne('/api/identidad/v1/sesiones-internas')
      .flush(null, { status: 401, statusText: '' });

    expect(session.expired()).toBeFalse();
  });
});

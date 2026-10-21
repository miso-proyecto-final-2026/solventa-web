import { TestBed } from '@angular/core/testing';
import {
  PartialMatchRouteSnapshot,
  Route,
  Router,
  UrlSegment,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { roleGuard } from './role.guard';
import { SessionStore } from './session.store';

describe('roleGuard', () => {
  let session: SessionStore;
  let router: Router;

  const run = () =>
    TestBed.runInInjectionContext(() =>
      roleGuard('ASESOR')(
        {} as Route,
        [new UrlSegment('assisted-quote', {})],
        {} as PartialMatchRouteSnapshot,
      ),
    );

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => sessionStorage.clear());

  it('should let an advisor with a valid session through', () => {
    session.start({
      token: 't',
      user: { id: '1', name: 'A', role: 'ASESOR' },
      expiresAt: Date.now() + 60_000,
    });

    expect(run()).toBeTrue();
  });

  it('should send a visitor to the login, remembering where they were going', () => {
    const result = run() as UrlTree;

    expect(router.serializeUrl(result)).toBe('/login?returnUrl=%2Fassisted-quote');
  });

  it('should send a user with another role to the home page', () => {
    session.start({
      token: 't',
      user: { id: '2', name: 'B', role: 'AUDITOR' },
      expiresAt: Date.now() + 60_000,
    });

    expect(router.serializeUrl(run() as UrlTree)).toBe('/');
  });

  it('should treat an expired session as no session', () => {
    session.start({
      token: 't',
      user: { id: '1', name: 'A', role: 'ASESOR' },
      expiresAt: Date.now() - 1,
    });

    expect(router.serializeUrl(run() as UrlTree)).toContain('/login');
  });
});

import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../http/api-error';
import { AuthGateway } from './auth.gateway';
import { AuthService } from './auth.service';
import { MOCK_ADVISOR, MockAuthGateway } from './mock-auth.gateway';
import { SessionStore } from './session.store';

describe('AuthService with the mock gateway', () => {
  let auth: AuthService;
  let session: SessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthGateway, useClass: MockAuthGateway }],
    });
    auth = TestBed.inject(AuthService);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => sessionStorage.clear());

  it('should start an advisor session with the demo credentials', async () => {
    await firstValueFrom(auth.login(` ${MOCK_ADVISOR.email} `, MOCK_ADVISOR.password));

    expect(session.hasRole('ASESOR')).toBeTrue();
  });

  it('should reject wrong credentials without starting a session', async () => {
    const attempt = firstValueFrom(auth.login(MOCK_ADVISOR.email, 'mala'));

    await expectAsync(attempt).toBeRejectedWithError(ApiError);
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('should end the session on logout', async () => {
    await firstValueFrom(auth.login(MOCK_ADVISOR.email, MOCK_ADVISOR.password));

    auth.logout();

    expect(session.isAuthenticated()).toBeFalse();
  });
});

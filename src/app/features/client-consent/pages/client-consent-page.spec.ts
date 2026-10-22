import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from '@core/auth/session.store';
import { ApiError } from '@core/http/api-error';
import { AssistedQuoteGateway } from '../../assisted-quote/data-access/assisted-quote.gateway';
import { ClientIdentity } from '../../assisted-quote/domain/models';
import { CLIENT } from '../../assisted-quote/testing/fixtures';
import { FakeAssistedQuoteGateway } from '../../assisted-quote/testing/fake-assisted-quote.gateway';
import { ClientConsentPage } from './client-consent-page';

describe('ClientConsentPage', () => {
  let fixture: ComponentFixture<ClientConsentPage>;
  let el: HTMLElement;
  let gateway: FakeAssistedQuoteGateway;

  const withConsent = (state: ClientIdentity['consent']['state']): ClientIdentity => ({
    ...CLIENT,
    consent: { state, grantedAt: state === 'GRANTED' ? CLIENT.consent.grantedAt : null },
  });
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const search = async (number = '1000000001') => {
    const input = el.querySelector<HTMLInputElement>('#lookup-number')!;
    input.value = number;
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await settle();
  };
  const text = () => el.textContent ?? '';

  beforeEach(async () => {
    sessionStorage.clear();
    gateway = new FakeAssistedQuoteGateway();
    TestBed.configureTestingModule({
      imports: [ClientConsentPage],
      providers: [provideRouter([{ path: 'login', children: [] }])],
    });
    TestBed.overrideComponent(ClientConsentPage, {
      set: { providers: [{ provide: AssistedQuoteGateway, useValue: gateway }] },
    });
    fixture = TestBed.createComponent(ClientConsentPage);
    el = fixture.nativeElement;
    await settle();
  });

  afterEach(() => sessionStorage.clear());

  it('should open with one main heading and the document form', () => {
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('#lookup-number')).not.toBeNull();
    expect(el.querySelector('.consent__badge')).toBeNull();
  });

  it('should show a granted consent with its date and no blocking', async () => {
    gateway.client = withConsent('GRANTED');

    await search();

    expect(gateway.searched).toEqual([{ type: 'CC', number: '1000000001' }]);
    expect(text()).toContain('Ana F.');
    expect(text()).toContain('Consentimiento otorgado');
    expect(text()).toContain('Otorgado el');
    expect(el.querySelector('sol-alert')).toBeNull();
  });

  it('should show a revoked consent and offer the default profile instead of Open Finance', async () => {
    gateway.client = withConsent('REVOKED');

    await search();

    expect(text()).toContain('Consentimiento revocado');
    expect(text()).toContain('No se puede cotizar con los datos de Open Finance');
    expect(el.querySelector('a[href="/assisted-quote"]')?.textContent).toContain(
      'Cotizar con perfil por defecto',
    );
  });

  it('should show a client who never decided as not requested and block the same way', async () => {
    gateway.client = withConsent('NOT_GRANTED');

    await search();

    expect(text()).toContain('Consentimiento no solicitado');
    expect(el.querySelector('a[href="/assisted-quote"]')).not.toBeNull();
  });

  it('should say so when the document has no client, without an error', async () => {
    gateway.client = null;

    await search('99999999');

    expect(text()).toContain('No encontramos un cliente con el documento CC 99999999');
    expect(el.querySelector('.consent__badge')).toBeNull();
  });

  it('should ask the server again on every search so a fresh revocation shows up', async () => {
    gateway.client = withConsent('GRANTED');
    await search();
    expect(text()).toContain('Consentimiento otorgado');

    gateway.client = withConsent('REVOKED');
    await search();

    expect(gateway.searched.length).toBe(2);
    expect(text()).toContain('Consentimiento revocado');
    expect(text()).not.toContain('Consentimiento otorgado');
  });

  it('should tell apart a server failure, a missing permission and a network failure', async () => {
    const cases: [ApiError, string][] = [
      [new ApiError('server', 500), 'problema del servidor'],
      [new ApiError('forbidden', 403), 'no tiene permiso'],
      [new ApiError('network', 0), 'No hay conexión'],
    ];
    for (const [error, expected] of cases) {
      gateway.failFind = error;
      await search();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(expected);
      expect(el.querySelector('.consent__badge')).toBeNull();
    }
  });

  it('should send the advisor to sign in again, coming back here, when the session expires', async () => {
    const session = TestBed.inject(SessionStore);
    const router = TestBed.inject(Router);
    session.start({
      token: 't',
      user: { id: 'u', name: 'Asesor', role: 'ASESOR' },
      expiresAt: Date.now() + 60_000,
    });

    session.expire();
    await settle();
    await fixture.whenStable();

    expect(router.url).toBe('/login?returnUrl=%2Fclient-consent');
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileSummary } from '../domain/models';
import { CLIENT, PROFILE } from '../testing/fixtures';
import { ClientProfile } from './client-profile';

describe('ClientProfile', () => {
  let fixture: ComponentFixture<ClientProfile>;
  let el: HTMLElement;
  let approved = 0;
  let searchedAgain = 0;
  let offers = 0;

  const render = async (inputs: Record<string, unknown>) => {
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
  };
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const buttons = () =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('.profile__actions button'));

  beforeEach(async () => {
    approved = 0;
    searchedAgain = 0;
    offers = 0;
    await TestBed.configureTestingModule({ imports: [ClientProfile] }).compileComponents();
    fixture = TestBed.createComponent(ClientProfile);
    fixture.componentInstance.approve.subscribe(() => approved++);
    fixture.componentInstance.searchAnother.subscribe(() => searchedAgain++);
    fixture.componentInstance.offerMortgage.subscribe(() => offers++);
    el = fixture.nativeElement;
  });

  it('should show who the client is, without personal contact data', async () => {
    await render({ client: CLIENT, profile: PROFILE });

    expect(text()).toContain('Ana F.');
    expect(text()).toContain('CC 1000000001');
    expect(text()).toContain('VERIFICADO');
  });

  it('should say the consent is valid and that the price uses the real profile', async () => {
    await render({ client: CLIENT, profile: PROFILE });

    expect(text()).toContain('Consentimiento vigente');
    expect(text()).toContain('perfil real del cliente');
  });

  it('should say the consent is revoked and that the price is an estimate', async () => {
    const profile: ProfileSummary = {
      ...PROFILE,
      hasConsent: false,
      source: 'DEFAULT',
      signals: [],
    };
    await render({
      client: { ...CLIENT, consent: { state: 'REVOKED', grantedAt: null } },
      profile,
    });

    expect(text()).toContain('Consentimiento revocado');
    expect(text()).toContain('perfil por defecto');
    expect(text()).toContain('Sin datos financieros del cliente');
  });

  it('should list the risk level of each indicator in an accessible table', async () => {
    await render({ client: CLIENT, profile: PROFILE });

    const table = el.querySelector('table')!;
    expect(table.querySelector('caption')).not.toBeNull();
    const rows = Array.from(table.querySelectorAll('tbody tr')).map((r) =>
      Array.from(r.querySelectorAll('th, td'))
        .map((c) => c.textContent?.trim())
        .join(' | '),
    );
    expect(rows).toEqual([
      'Nivel de endeudamiento | Bajo',
      'Reportes negativos | Bajo',
      'Ingresos mensuales | Medio',
    ]);
    expect(table.querySelectorAll('th[scope="row"]').length).toBe(3);
  });

  it('should explain an unknown document and offer to continue without an account', async () => {
    await render({ client: null, profile: null, searched: { type: 'CC', number: '99999999' } });

    expect(text()).toContain('No encontramos un cliente');
    expect(text()).toContain('CC 99999999');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual([
      'Continuar sin cuenta',
      'Buscar otro cliente',
    ]);
  });

  it('should emit approve and searchAnother from the buttons', async () => {
    await render({ client: CLIENT, profile: PROFILE });

    expect(buttons()[0].textContent).toContain('Aprobar y continuar');
    buttons()[0].click();
    buttons()[1].click();

    expect([approved, searchedAgain]).toEqual([1, 1]);
  });

  it('should block the approval while busy', async () => {
    await render({ client: CLIENT, profile: PROFILE, busy: true });

    expect(buttons()[0].disabled).toBeTrue();
    expect(buttons()[0].getAttribute('aria-busy')).toBe('true');
  });

  describe('mortgage life offer entry (HU26)', () => {
    const offerButton = () =>
      el.querySelector<HTMLButtonElement>('.profile__offer button') ?? undefined;

    it('should let the advisor open the offer for a client with consent', async () => {
      await render({ client: CLIENT, profile: PROFILE });

      offerButton()!.click();

      expect(offers).toBe(1);
    });

    it('should explain why there is no offer without consent, and not offer the button', async () => {
      const revoked = { ...CLIENT, consent: { state: 'REVOKED' as const, grantedAt: null } };
      await render({
        client: revoked,
        profile: { ...PROFILE, hasConsent: false, source: 'DEFAULT' },
      });

      expect(offerButton()).toBeUndefined();
      expect(text()).toContain(
        'No se puede generar la oferta: el cliente no ha otorgado el consentimiento',
      );
    });

    it('should not offer it to a prospect without an account', async () => {
      await render({ client: null, searched: { type: 'CC', number: '1000000099' } });

      expect(text()).not.toContain('vida hipotecario');
    });

    it('should disable the button while another call is running', async () => {
      await render({ client: CLIENT, profile: PROFILE, busy: true });

      expect(offerButton()!.disabled).toBeTrue();
    });
  });
});

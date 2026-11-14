import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error';
import { AssistedQuoteGateway } from '../data-access/assisted-quote.gateway';
import { CLIENT, LINEAGE } from '../testing/fixtures';
import { FakeAssistedQuoteGateway } from '../testing/fake-assisted-quote.gateway';
import { SourceLineage } from './source-lineage';

registerLocaleData(localeEsCo);

describe('SourceLineage', () => {
  let fixture: ComponentFixture<SourceLineage>;
  let gateway: FakeAssistedQuoteGateway;
  let el: HTMLElement;

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const rows = () =>
    Array.from(el.querySelectorAll('tbody tr')).map((r) =>
      r.textContent?.replace(/\s+/g, ' ').trim(),
    );

  const render = async () => {
    fixture = TestBed.createComponent(SourceLineage);
    fixture.componentRef.setInput('clientId', CLIENT.id);
    el = fixture.nativeElement;
    await fixture.whenStable();
  };

  beforeEach(() => {
    gateway = new FakeAssistedQuoteGateway();
    TestBed.configureTestingModule({
      imports: [SourceLineage],
      providers: [
        { provide: AssistedQuoteGateway, useValue: gateway },
        { provide: LOCALE_ID, useValue: 'es-CO' },
      ],
    });
  });

  it('should ask for the lineage of the given client', async () => {
    await render();

    expect(gateway.lineageRequests).toEqual([CLIENT.id]);
  });

  it('should show one row per source with data type, fields, date, cache validity, origin and consent', async () => {
    await render();

    expect(rows().length).toBe(2);
    expect(rows()[0]).toContain('Open Finance');
    expect(rows()[0]).toContain('Financiero');
    expect(rows()[0]).toContain('Ingresos mensuales, Nivel de endeudamiento, Puntaje crediticio');
    expect(rows()[0]).toContain('14/11/2026');
    expect(rows()[0]).toContain('1 h');
    expect(rows()[0]).toContain('Consulta en vivo');
    expect(rows()[0]).toContain('Otorgado');
  });

  it('should mark a source served by default, with no fields and no fetch date', async () => {
    await render();

    expect(rows()[1]).toContain('Open Data');
    expect(rows()[1]).toContain('Socioeconómico');
    expect(rows()[1]).toContain('Ninguno');
    expect(rows()[1]).toContain('Sin consulta');
    expect(rows()[1]).toContain('24 h');
    expect(rows()[1]).toContain('Por defecto: fuente no disponible');
    expect(el.querySelector('.lineage__origin--DEFAULT')).not.toBeNull();
  });

  it('should explain the missing fields with their reason', async () => {
    await render();

    expect(text()).toContain('Datos que faltaron');
    expect(text()).toContain('Estrato: La fuente no estaba disponible');
    expect(text()).toContain('Zona de riesgo: La fuente no estaba disponible');
  });

  it('should list the conflicts with the source that was used', async () => {
    gateway.lineage = {
      ...LINEAGE,
      conflicts: [{ field: 'estrato', winner: 'open_data', discarded: ['open_finance'] }],
    };

    await render();

    expect(text()).toContain('Datos que reportaron dos fuentes');
    expect(text()).toContain('Estrato: se usó Open Data');
  });

  it('should warn that it may not be the profile used for this price', async () => {
    await render();

    expect(text()).toContain('Puede no ser el perfil con el que se calculó este precio');
  });

  it('should say so when the client has no enriched profile yet', async () => {
    gateway.lineage = null;

    await render();

    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('sol-alert [role="status"]')?.textContent).toContain(
      'todavía no tiene un perfil enriquecido',
    );
  });

  it('should announce an unavailable lineage and retry on demand', async () => {
    gateway.failLineage = new ApiError('server', 503, 'LINAJE_NO_DISPONIBLE');

    await render();

    expect(el.querySelector('sol-alert [role="alert"]')?.textContent).toContain(
      'El linaje no está disponible en este momento',
    );
    gateway.failLineage = null;
    el.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();

    expect(gateway.lineageRequests.length).toBe(2);
    expect(rows().length).toBe(2);
  });

  it('should show the network message when there is no connection', async () => {
    gateway.failLineage = new ApiError('network', 0);

    await render();

    expect(text()).toContain('No hay conexión con el servidor');
  });
});

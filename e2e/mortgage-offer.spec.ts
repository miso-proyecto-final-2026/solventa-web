import type { Page } from '@playwright/test';
import { Failure } from './support/backend';
import { expectNoSeriousA11yViolations, ui } from './support/journey';
import { expect, signIn, test } from './support/test';

const UNAVAILABLE: Failure = {
  status: 503,
  body: {
    error: {
      code: 'OFERTA_NO_DISPONIBLE',
      message: 'La oferta no está disponible en este momento. Intente de nuevo más tarde.',
      details: [],
      trace_id: 't',
    },
  },
};

const CARD = '4242 4242 4242 4242';
/** Diciembre del año siguiente: válido sin depender de la fecha de hoy. */
const EXPIRY = `12${String((new Date().getFullYear() + 1) % 100).padStart(2, '0')}`;

async function openProfile(page: Page, document: string): Promise<void> {
  const controls = ui(page);
  await controls.documentNumber.fill(document);
  await controls.search.click();
  await expect(controls.stepHeading).toHaveText('Perfil del cliente');
}

const offerButton = (page: Page) => page.getByRole('button', { name: 'Ofrecer vida hipotecario' });
const sumField = (page: Page) => page.getByLabel('Suma asegurada (saldo del crédito)');

test.describe('Cotización asistida: oferta de vida hipotecario (HU26)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/assisted-quote');
  });

  test('del perfil a la suscripción asistida con la oferta, recalculando la suma', async ({
    page,
    backend,
  }) => {
    const controls = ui(page);
    await openProfile(page, '1000000001');
    await expectNoSeriousA11yViolations(page);

    await offerButton(page).click();

    // Criterio 1: el perfil se enriquece al abrir la oferta, sin otro paso del asesor.
    await expect(controls.stepHeading).toHaveText('Oferta de vida hipotecario');
    await expect(page.getByText(/Prima anual:\s*\$\s?162\.000/)).toBeVisible();
    await expect(page.locator('.offer__amount')).toHaveText(/\$\s?13\.500/);
    expect(backend.offerRequests).toEqual([
      { clientId: '00000000-0000-4000-8000-0000000000a1', body: { enriquecer: true } },
    ]);
    await expect(
      page.getByRole('row', {
        name: /Incapacidad total y permanente\s+\$\s?100\.000\.000\s+\$\s?10\.000\.000/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('row', {
        name: /Nivel de endeudamiento\s+0,90\s+-\$\s?18\.000\s+\$\s?162\.000/,
      }),
    ).toBeVisible();
    await expect(page.getByText('0.0018')).toHaveCount(0);
    await expectNoSeriousA11yViolations(page);

    // Al cambiar la suma no se vuelve a enriquecer el perfil.
    await expect(sumField(page)).toHaveValue('100000000');
    await sumField(page).fill('150000000');
    await page.getByRole('button', { name: 'Recalcular' }).click();
    await expect(page.getByText(/Prima anual:\s*\$\s?243\.000/)).toBeVisible();
    expect(backend.offerRequests[1].body).toEqual({
      suma_asegurada: 150_000_000,
      enriquecer: false,
    });

    // Criterio 5: el linaje de fuentes en su pestaña.
    await page.getByRole('tab', { name: 'Linaje de fuentes' }).click();
    const lineage = page.getByRole('tabpanel', { name: 'Linaje de fuentes' });
    await expect(lineage.getByRole('row', { name: /Open Finance\s+Financiero/ })).toBeVisible();
    await expect(page.locator('#panel-offer')).toBeHidden();
    await page.getByRole('tab', { name: 'Oferta' }).click();

    // Criterio 4: la suscripción asistida arranca con la cotización de la última oferta.
    await page.getByRole('link', { name: 'El cliente acepta: iniciar suscripción' }).click();
    await expect(page).toHaveURL(/\/subscriptions\/new\/cot-vh-e2e-2$/);
    await page.getByLabel('Número de tarjeta').fill(CARD);
    await page.getByLabel('Vencimiento (MMAA)').fill(EXPIRY);
    await page.getByLabel('Código de seguridad (CVC)').fill('123');
    await page.getByLabel('El cliente está al tanto de esta transacción').check();
    await page.getByRole('button', { name: 'Iniciar suscripción' }).click();
    await expect(page).toHaveURL(/\/subscriptions\/sus-e2e-1$/);
    expect(backend.startRequests[0].body).toMatchObject({ cotizacion_id: 'cot-vh-e2e-2' });
  });

  test('sin consentimiento no se ofrece y se explica por qué', async ({ page, backend }) => {
    await openProfile(page, '1000000004');

    await expect(offerButton(page)).toHaveCount(0);
    await expect(
      page.getByText(/No se puede generar la oferta: el cliente no ha otorgado el consentimiento/),
    ).toBeVisible();
    expect(backend.offerRequests).toEqual([]);
  });

  test('si el consentimiento se revocó mientras tanto, la oferta lo explica sin reintentar', async ({
    page,
    backend,
  }) => {
    await openProfile(page, '1000000001');
    backend.failNextOffer({
      status: 409,
      body: {
        error: { code: 'CONSENTIMIENTO_REQUERIDO', message: 'm', details: [], trace_id: 't' },
      },
    });

    await offerButton(page).click();

    await expect(
      page.getByText(/El cliente no ha otorgado el consentimiento de datos/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /El cliente acepta/ })).toHaveCount(0);
  });

  test('con Perfilamiento caído se puede reintentar, y el reintento vuelve a enriquecer', async ({
    page,
    backend,
  }) => {
    await openProfile(page, '1000000001');
    backend.failNextOffer(UNAVAILABLE);

    await offerButton(page).click();

    await expect(page.getByText(/No pudimos generar la oferta/)).toBeVisible();
    await expectNoSeriousA11yViolations(page);
    await page.getByRole('button', { name: 'Reintentar' }).click();

    await expect(page.getByText(/Prima anual:\s*\$\s?162\.000/)).toBeVisible();
    await expect(page.getByText(/No pudimos generar la oferta/)).toHaveCount(0);
    expect(backend.offerRequests.map((r) => r.body)).toEqual([
      { enriquecer: true },
      { enriquecer: true },
    ]);
  });

  test('una suma fuera de las reglas muestra el motivo junto al campo', async ({ page }) => {
    await openProfile(page, '1000000001');
    await offerButton(page).click();
    await expect(sumField(page)).toHaveValue('100000000');

    await sumField(page).fill('5000000');
    await page.getByRole('button', { name: 'Recalcular' }).click();

    await expect(page.getByText('debe estar entre 20,000,000 y 800,000,000')).toBeVisible();
    await expect(sumField(page)).toHaveAttribute('aria-invalid', 'true');
    // La oferta anterior sigue a la vista: la cotización registrada no cambió.
    await expect(page.getByText(/Prima anual:\s*\$\s?162\.000/)).toBeVisible();
  });

  test('en un celular la oferta cabe sin desplazar la página a lo ancho', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openProfile(page, '1000000001');
    await offerButton(page).click();
    await expect(page.getByText(/Prima anual:\s*\$\s?162\.000/)).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

import { fillLifeInsurance, ui } from './support/journey';
import { expect, signIn, test } from './support/test';

test.describe('Cotización asistida: camino feliz', () => {
  test('el asesor inicia sesión, identifica al cliente y presenta la cotización', async ({
    page,
    backend,
  }) => {
    // Sin sesión, la ruta protegida lleva al login y, tras ingresar, devuelve a la pantalla.
    await page.goto('/assisted-quote');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fassisted-quote/);
    await page.getByLabel('Correo').fill('asesor@solventa.test');
    await page.getByLabel('Contraseña').fill('Demo12345');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/assisted-quote$/);
    const controls = ui(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cotización asistida');
    await expect(controls.stepHeading).toHaveText('Buscar al cliente');

    // Paso 1 y 2: el cliente, su consentimiento y cómo afecta el precio.
    await controls.documentNumber.fill('1000000001');
    await controls.search.click();
    await expect(controls.stepHeading).toHaveText('Perfil del cliente');
    await expect(page.getByText('Ana F.')).toBeVisible();
    await expect(page.getByText('Consentimiento vigente')).toBeVisible();
    await expect(
      page.getByText('El precio se calcula con el perfil real del cliente.'),
    ).toBeVisible();
    await expect(page.getByRole('row', { name: /Nivel de endeudamiento\s+Bajo/ })).toBeVisible();

    // Paso 3: datos del seguro, armados desde el catálogo.
    await controls.approve.click();
    await expect(controls.stepHeading).toHaveText('Datos del seguro');
    await fillLifeInsurance(page);
    await controls.requestQuote.click();

    // Paso 4: prima, coberturas con deducible, vigencia y desglose.
    await expect(controls.stepHeading).toHaveText('Resultado');
    await expect(page.getByText(/\$\s?13\.162/).first()).toBeVisible();
    await expect(page.getByText(/Prima anual:\s*\$\s?157\.938/)).toBeVisible();
    await expect(
      page.getByRole('row', { name: /Muerte\s+\$\s?50\.000\.000\s+\$\s?0/ }),
    ).toBeVisible();
    await expect(page.getByText(/Válida hasta:\s*19 de noviembre de 2026/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cómo se calculó el precio' })).toBeVisible();
    await expect(
      page.getByRole('row', { name: /Ajuste por el perfil de riesgo\s+-\$\s?17\.062/ }),
    ).toBeVisible();
    await expect(page.getByText('Precio estimado')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Iniciar suscripción' })).toBeVisible();

    expect(backend.quoteRequests).toEqual([
      {
        cliente_id: '00000000-0000-4000-8000-0000000000a1',
        producto: 'microseguro_vida',
        datos: { edad: 35, suma_asegurada: 50_000_000 },
      },
    ]);

    // Nueva cotización vuelve al inicio del recorrido.
    await controls.newQuote.click();
    await expect(controls.stepHeading).toHaveText('Buscar al cliente');
  });

  // El precio es siempre un estimado cuando no hay perfil real (consentimiento revocado o ausente).
  const consents = [
    {
      document: '1000000004',
      label: 'Consentimiento revocado',
      effect:
        'El precio se calcula con el perfil por defecto y es un estimado: puede cambiar al comprar.',
    },
    {
      document: '1000000005',
      label: 'Sin consentimiento',
      effect:
        'El precio se calcula con el perfil por defecto y es un estimado: puede cambiar al comprar.',
    },
  ];
  for (const { document, label, effect } of consents) {
    test(`con «${label}» el precio se presenta como estimado`, async ({ page, backend }) => {
      await signIn(page);
      await page.goto('/assisted-quote');
      const controls = ui(page);

      await controls.documentNumber.fill(document);
      await controls.search.click();
      await expect(page.getByText(label)).toBeVisible();
      await expect(page.getByText(effect, { exact: true })).toBeVisible();

      await controls.approve.click();
      await fillLifeInsurance(page);
      await controls.requestQuote.click();

      await expect(controls.stepHeading).toHaveText('Resultado');
      await expect(page.getByText(/Precio estimado/)).toBeVisible();
      await expect(page.getByText(/Prima anual:\s*\$\s?175\.000/)).toBeVisible();
      expect(backend.quoteRequests).toHaveLength(1);
    });
  }
});

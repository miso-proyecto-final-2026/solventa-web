import { Locator, Page } from '@playwright/test';
import { expectNoSeriousA11yViolations, fillLifeInsurance, ui } from './support/journey';
import { expect, signIn, test } from './support/test';

/** Avanza con Tab hasta que el foco llegue al control; falla si no se puede llegar con teclado. */
async function tabTo(page: Page, target: Locator, maxPresses = 60): Promise<void> {
  for (let i = 0; i < maxPresses; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('No se llegó al control solo con Tab');
}

test.describe('Cotización asistida: teclado y accesibilidad (WCAG 2.1 AA)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('el recorrido completo se opera solo con teclado, con foco visible y orden lógico', async ({
    page,
    backend,
  }) => {
    await page.goto('/assisted-quote');
    const controls = ui(page);

    // El primer Tab ofrece saltar la navegación.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();

    // Paso 1: documento y Enter.
    await tabTo(page, controls.documentNumber);
    await expect(controls.documentNumber).toHaveCSS('outline-style', 'solid');
    await expect(controls.documentNumber).toHaveCSS('outline-width', '3px');
    await page.keyboard.type('1000000001');
    await page.keyboard.press('Enter');

    // Al cambiar de paso, el foco pasa al título.
    await expect(controls.stepHeading).toHaveText('Perfil del cliente');
    await expect(controls.stepHeading).toBeFocused();

    // Paso 2: aprobar con el teclado (el botón se alcanza antes que «Buscar otro cliente»).
    await tabTo(page, controls.approve);
    await expect(controls.approve).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect(controls.stepHeading).toHaveText('Datos del seguro');
    await expect(controls.stepHeading).toBeFocused();

    // Paso 3: el orden de los campos sigue el de la pantalla.
    await tabTo(page, controls.product);
    await tabTo(page, controls.age);
    await page.keyboard.type('35');
    await page.keyboard.press('Tab');
    await expect(controls.insuredSum).toBeFocused();
    await page.keyboard.type('50000000');
    await tabTo(page, controls.requestQuote);
    await page.keyboard.press('Space');

    // Paso 4: resultado y nueva cotización, también con teclado.
    await expect(controls.stepHeading).toHaveText('Resultado');
    await expect(controls.stepHeading).toBeFocused();
    await tabTo(page, controls.newQuote);
    await page.keyboard.press('Enter');
    await expect(controls.stepHeading).toHaveText('Buscar al cliente');

    expect(backend.quoteRequests).toHaveLength(1);
  });

  test('ningún paso tiene violaciones críticas o serias de accesibilidad', async ({
    page,
    backend,
  }) => {
    await page.goto('/assisted-quote');
    const controls = ui(page);

    // Paso 1, también con el error en línea visible.
    await expectNoSeriousA11yViolations(page);
    await controls.search.click();
    await expect(page.getByText('Escribe el número de documento.')).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // Paso 2.
    await controls.documentNumber.fill('1000000001');
    await controls.search.click();
    await expect(controls.stepHeading).toHaveText('Perfil del cliente');
    await expectNoSeriousA11yViolations(page);

    // Paso 3, también con el resumen de errores.
    await controls.approve.click();
    await expect(controls.stepHeading).toHaveText('Datos del seguro');
    await expectNoSeriousA11yViolations(page);
    await controls.requestQuote.click();
    await expect(
      page.getByRole('heading', { name: 'Revisa estos datos antes de continuar' }),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    // Paso 4, con el aviso de estimado y el desglose.
    await fillLifeInsurance(page);
    await controls.requestQuote.click();
    await expect(controls.stepHeading).toHaveText('Resultado');
    await expectNoSeriousA11yViolations(page);
    expect(backend.quoteRequests).toHaveLength(1);
  });

  test('el perfil sin cuenta y el resultado estimado también cumplen', async ({ page }) => {
    await page.goto('/assisted-quote');
    const controls = ui(page);

    await controls.documentNumber.fill('99999999');
    await controls.search.click();
    await expect(page.getByText(/No encontramos un cliente/)).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await controls.approve.click();
    await fillLifeInsurance(page);
    await controls.requestQuote.click();
    await expect(page.getByText(/Precio estimado/)).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test('el inicio de sesión cumple', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});

import { SERVER_ERROR, UNAUTHENTICATED } from './support/backend';
import { fillLifeInsurance, goToInsuranceStep, ui } from './support/journey';
import { expect, signIn, test } from './support/test';

test.describe('Cotización asistida: errores y sesión vencida', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/assisted-quote');
  });

  test('un error del servidor se informa sin perder lo ingresado y permite reintentar', async ({
    page,
    backend,
  }) => {
    const controls = ui(page);
    await goToInsuranceStep(page, '1000000001');
    await fillLifeInsurance(page);
    backend.failNextQuote(SERVER_ERROR);

    await controls.requestQuote.click();

    await expect(page.getByRole('alert')).toContainText('problema del servidor');
    await expect(controls.stepHeading).toHaveText('Datos del seguro');
    await expect(controls.age).toHaveValue('35');
    await expect(controls.insuredSum).toHaveValue('50000000');

    await controls.requestQuote.click();
    await expect(controls.stepHeading).toHaveText('Resultado');
  });

  test('una caída de red tiene su propio mensaje', async ({ page, backend }) => {
    const controls = ui(page);
    await goToInsuranceStep(page, '1000000001');
    await fillLifeInsurance(page);
    backend.failNextQuote('network');

    await controls.requestQuote.click();

    await expect(page.getByRole('alert')).toContainText('No hay conexión con el servidor');
    await expect(page.getByRole('alert')).not.toContainText('problema del servidor');
    await expect(controls.age).toHaveValue('35');
  });

  test('un error al buscar al cliente conserva el documento', async ({ page, backend }) => {
    const controls = ui(page);
    backend.failNextSearch(SERVER_ERROR);

    await controls.documentNumber.fill('1000000001');
    await controls.search.click();

    await expect(page.getByRole('alert')).toContainText('problema del servidor');
    await expect(controls.stepHeading).toHaveText('Buscar al cliente');
    await expect(controls.documentNumber).toHaveValue('1000000001');
  });

  test('si la sesión vence, pide ingresar de nuevo y recupera lo que se había escrito', async ({
    page,
    backend,
  }) => {
    const controls = ui(page);
    await controls.documentNumber.fill('1000000001');
    backend.failNextSearch(UNAUTHENTICATED);

    await controls.search.click();

    // Mensaje de sesión vencida (distinto al de credenciales o servidor) y vuelta al login.
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fassisted-quote/);
    await expect(page.getByText(/Tu sesión venció/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cotización asistida' })).toHaveCount(0);

    await page.getByLabel('Correo').fill('asesor@solventa.test');
    await page.getByLabel('Contraseña').fill('Demo12345');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    // De vuelta en la pantalla, el documento escrito sigue ahí.
    await expect(page).toHaveURL(/\/assisted-quote$/);
    await expect(controls.documentNumber).toHaveValue('1000000001');
  });
});

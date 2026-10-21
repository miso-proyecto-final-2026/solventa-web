import { SERVER_ERROR, UNAUTHENTICATED } from './support/backend';
import { expectNoSeriousA11yViolations } from './support/journey';
import { expect, signIn, test } from './support/test';

test.describe('Consentimiento del cliente (HU-08)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/client-consent');
  });

  const search = async (page: import('@playwright/test').Page, number: string) => {
    await page.getByLabel('Número de documento').fill(number);
    await page.getByRole('button', { name: 'Buscar cliente' }).click();
  };

  test('un consentimiento otorgado muestra la fecha y no bloquea', async ({ page, backend }) => {
    await search(page, '1000000001');

    await expect(page.getByText('Ana F.')).toBeVisible();
    await expect(page.getByText('Consentimiento otorgado')).toBeVisible();
    await expect(page.getByText(/Otorgado el/)).toBeVisible();
    await expect(page.getByText('No se puede cotizar con los datos de Open Finance')).toHaveCount(
      0,
    );
    expect(backend.searched).toEqual(['1000000001']);
  });

  test('un consentimiento revocado bloquea Open Finance y ofrece el perfil por defecto', async ({
    page,
  }) => {
    await search(page, '1000000004');

    await expect(page.getByText('Consentimiento revocado')).toBeVisible();
    await expect(page.getByText('No se puede cotizar con los datos de Open Finance')).toBeVisible();
    await page.getByRole('link', { name: 'Cotizar con perfil por defecto' }).click();
    await expect(page).toHaveURL(/\/assisted-quote$/);
  });

  test('un cliente que nunca decidió figura como no solicitado', async ({ page }) => {
    await search(page, '1000000005');

    await expect(page.getByText('Consentimiento no solicitado')).toBeVisible();
    await expect(page.getByText('No se puede cotizar con los datos de Open Finance')).toBeVisible();
  });

  test('un documento sin cliente y los fallos del servidor tienen mensajes distintos', async ({
    page,
    backend,
  }) => {
    await search(page, '99999999');
    await expect(
      page.getByText(/No encontramos un cliente con el documento CC 99999999/),
    ).toBeVisible();

    backend.failNextSearch(SERVER_ERROR);
    await search(page, '1000000001');
    await expect(page.getByRole('alert')).toContainText('problema del servidor');

    backend.failNextSearch('network');
    await search(page, '1000000001');
    await expect(page.getByRole('alert')).toContainText('No hay conexión');
  });

  test('una sesión vencida lleva al inicio de sesión y vuelve a la pantalla', async ({
    page,
    backend,
  }) => {
    backend.failNextSearch(UNAUTHENTICATED);

    await search(page, '1000000001');

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fclient-consent/);
  });

  test('sin fallos graves de accesibilidad con el resultado a la vista', async ({ page }) => {
    await search(page, '1000000004');
    await expect(page.getByText('Consentimiento revocado')).toBeVisible();

    await expectNoSeriousA11yViolations(page);
  });
});

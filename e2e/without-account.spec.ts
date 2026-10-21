import { fillLifeInsurance, ui } from './support/journey';
import { expect, signIn, test } from './support/test';

test('si el documento no existe, el asesor cotiza sin cuenta con precio estimado', async ({
  page,
  backend,
}) => {
  await signIn(page);
  await page.goto('/assisted-quote');
  const controls = ui(page);

  await controls.documentNumber.fill('99999999');
  await controls.search.click();

  // Se indica con claridad y se ofrece continuar (no es un error).
  await expect(controls.stepHeading).toHaveText('Perfil del cliente');
  await expect(page.getByText(/No encontramos un cliente con este documento/)).toBeVisible();
  await expect(page.getByText('CC 99999999')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await controls.approve.click();
  await expect(controls.stepHeading).toHaveText('Datos del seguro');
  await fillLifeInsurance(page);
  await controls.requestQuote.click();

  await expect(controls.stepHeading).toHaveText('Resultado');
  await expect(page.getByText(/Precio estimado/)).toBeVisible();
  await expect(
    page.getByText('Cotización sin cuenta: para comprar, el cliente debe registrarse.'),
  ).toBeVisible();
  await expect(page.getByText(/Prima anual:\s*\$\s?175\.000/)).toBeVisible();

  // La cotización viaja con el documento y sin cliente; no se pidió ningún perfil.
  expect(backend.quoteRequests).toEqual([
    {
      documento: { tipo: 'CC', numero: '99999999' },
      producto: 'microseguro_vida',
      datos: { edad: 35, suma_asegurada: 50_000_000 },
    },
  ]);
});

test('el asesor puede volver y buscar a otro cliente', async ({ page }) => {
  await signIn(page);
  await page.goto('/assisted-quote');
  const controls = ui(page);

  await controls.documentNumber.fill('99999999');
  await controls.search.click();
  await controls.searchAnother.click();

  await expect(controls.stepHeading).toHaveText('Buscar al cliente');
});

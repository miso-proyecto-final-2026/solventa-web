import { Page } from '@playwright/test';
import { fillLifeInsurance, goToInsuranceStep, ui } from './support/journey';
import { VALIDATION_ERROR } from './support/backend';
import { expect, signIn, test } from './support/test';

/** Mensajes de error en línea de los campos (sin contar los enlaces del resumen de errores). */
const inlineErrors = (page: Page, text: string | RegExp) =>
  page.locator('.field__error', { hasText: text });

test.describe('Cotización asistida: validación de campos', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/assisted-quote');
  });

  test('el documento se valida en línea antes de buscar', async ({ page, backend }) => {
    const controls = ui(page);

    await controls.search.click();
    await expect(page.getByText('Escribe el número de documento.')).toBeVisible();
    await expect(controls.documentNumber).toHaveAttribute('aria-invalid', 'true');
    await expect(controls.documentNumber).toHaveAccessibleDescription(/Escribe el número/);

    await controls.documentNumber.fill('12 3');
    await controls.search.click();
    await expect(
      page.getByText(/El número debe tener entre 5 y 15 letras o dígitos/),
    ).toBeVisible();

    // Nada se envió y el paso no avanzó.
    expect(backend.searched).toEqual([]);
    await expect(controls.stepHeading).toHaveText('Buscar al cliente');

    // Los espacios de los extremos no cuentan como error: se descartan al buscar.
    await controls.documentNumber.fill(' 1000000001 ');
    await controls.search.click();
    await expect(controls.stepHeading).toHaveText('Perfil del cliente');
    expect(backend.searched).toEqual(['1000000001']);
  });

  test('los datos del seguro muestran errores en línea y un resumen que lleva al campo', async ({
    page,
    backend,
  }) => {
    const controls = ui(page);
    await goToInsuranceStep(page, '1000000001');
    await expect(page.getByText('Rango permitido: 18 – 65')).toBeVisible();

    // Vacío: dos errores, resumen anunciado y foco en él.
    await controls.requestQuote.click();
    const summary = page.getByRole('heading', { name: 'Revisa estos datos antes de continuar' });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(inlineErrors(page, 'Este dato es obligatorio.')).toHaveCount(2);
    await expect(controls.age).toHaveAttribute('aria-invalid', 'true');

    // El enlace del resumen lleva el foco al campo con el problema.
    await page.getByRole('link', { name: /Edad: Este dato es obligatorio/ }).click();
    await expect(controls.age).toBeFocused();

    // Fuera de rango y con formato inválido, cada uno con su mensaje.
    await controls.age.fill('5');
    await controls.insuredSum.fill('1');
    await controls.requestQuote.click();
    await expect(inlineErrors(page, 'El valor es menor que el mínimo permitido.')).toHaveCount(2);
    await controls.age.fill('70');
    await expect(inlineErrors(page, 'El valor es mayor que el máximo permitido.')).toHaveCount(1);
    await controls.age.fill('35.5');
    await expect(inlineErrors(page, /Escribe solo números enteros/)).toHaveCount(1);

    expect(backend.quoteRequests).toEqual([]);

    // Corregidos los datos, la cotización sale.
    await fillLifeInsurance(page);
    await controls.requestQuote.click();
    await expect(controls.stepHeading).toHaveText('Resultado');
    expect(backend.quoteRequests).toHaveLength(1);
  });

  test('si el servidor rechaza un dato (422), marca el campo y no pierde lo escrito', async ({
    page,
    backend,
  }) => {
    const controls = ui(page);
    await goToInsuranceStep(page, '1000000001');
    backend.failNextQuote(VALIDATION_ERROR);

    // 30 es válido para el formulario; el servidor (simulado) lo rechaza igual.
    await fillLifeInsurance(page, '30');
    await controls.requestQuote.click();

    await expect(page.getByText('Revisa los datos marcados e inténtalo de nuevo.')).toBeVisible();
    await expect(inlineErrors(page, 'El valor no cumple las reglas del producto.')).toHaveCount(1);
    await expect(controls.age).toHaveAttribute('aria-invalid', 'true');
    await expect(controls.age).toHaveValue('30');
    await expect(controls.insuredSum).toHaveValue('50000000');
    await expect(controls.stepHeading).toHaveText('Datos del seguro');

    // Se corrige y se reenvía sin tener que volver a empezar.
    await controls.age.fill('35');
    await controls.requestQuote.click();
    await expect(controls.stepHeading).toHaveText('Resultado');
  });
});

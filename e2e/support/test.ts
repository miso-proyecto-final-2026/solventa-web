import { Page, expect, test as base } from '@playwright/test';
import { Backend } from './backend';

/**
 * Deja una sesión vigente antes de cargar la app (atajo para no pasar por el login). Por defecto
 * de asesor; HU19 también usa la de operador.
 */
export async function signIn(page: Page, role: 'ASESOR' | 'OPERADOR' = 'ASESOR'): Promise<void> {
  await page.addInitScript((role) => {
    // Solo en la primera carga: si la sesión vence durante la prueba, no se vuelve a crear.
    if (sessionStorage.getItem('e2e.seeded')) return;
    sessionStorage.setItem('e2e.seeded', '1');
    sessionStorage.setItem(
      'solventa.session',
      JSON.stringify({
        token: 'e2e-token',
        user: { id: 'a-1', name: role === 'ASESOR' ? 'Asesora Demo' : 'Operador Demo', role },
        expiresAt: Date.now() + 30 * 60 * 1000,
      }),
    );
  }, role);
}

/**
 * `backend` se instala solo en todas las pruebas (`auto`) para que ninguna llegue al proxy real y,
 * al terminar, verifica que no hubo llamadas sin simular.
 */
export const test = base.extend<{ backend: Backend }>({
  backend: [
    async ({ page }, use) => {
      const backend = new Backend(page);
      await backend.install();
      await use(backend);
      expect(backend.unhandled, 'llamadas al API que la prueba no simuló').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

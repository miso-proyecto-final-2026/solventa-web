import { Provider, Type } from '@angular/core';
import { environment } from '@env/environment';

/**
 * Elige el adaptador de un gateway según `environment.dataSource`: el backend real (`http`) o
 * datos simulados (`mock`). Es la única diferencia entre ambos modos para el resto de la app.
 */
export function provideGateway<T>(
  port: abstract new () => T,
  http: Type<T>,
  mock: Type<T>,
): Provider {
  return { provide: port, useClass: environment.dataSource === 'mock' ? mock : http };
}

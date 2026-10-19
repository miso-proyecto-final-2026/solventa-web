# solventa-web

Portal web de Solventa (MISW4501, Grupo 10): consola para asesores y portal del cliente de la plataforma insurtech sobre Open Finance. Primera historia en curso: **HU-38**, cotización asistida desde el portal.

- **Stack:** Angular 22 (componentes standalone, signals), TypeScript, SCSS.
- **Idiomas:** es-CO (base) y en-US, con `@angular/localize`.
- **Pruebas:** Jasmine + Karma (unitarias), Cypress (E2E, aún sin recorridos).
- **Backend:** MS Identidad y MS Cotización, en el repo [`solventa-backend`](https://github.com/miso-proyecto-final-2026/solventa-backend).

> **¿Vas a escribir código?** Lee antes la [guía de capas y plantilla de feature](src/app/README.md): explica dónde va cada cosa dentro de `src/app` y cómo se organiza una feature nueva.

## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | `^22.22.3`, `^24.15.0` o superior (el CI usa 22) |
| npm | 10 o superior |
| Google Chrome | Para `npm run test:ci` (Karma abre Chrome sin interfaz) |

Si Karma no encuentra Chrome, define `CHROME_BIN` con la ruta del ejecutable.

## Ejecutar el proyecto

```bash
git clone https://github.com/miso-proyecto-final-2026/solventa-web.git
cd solventa-web
npm ci            # instala exactamente lo que dice package-lock.json
npm start         # http://localhost:4200, en es-CO
```

Para ver la aplicación en inglés:

```bash
npm run start:en  # http://localhost:4200, en en-US
```

El servidor de desarrollo recarga solo al guardar cambios. Cada comando sirve un solo idioma; para cambiar de uno a otro se detiene y se vuelve a lanzar.

### Contra el backend local

El servidor de desarrollo redirige las llamadas a `/api/...` hacia los servicios locales (ver `proxy.conf.json`):

| Ruta del front | Servicio | Puerto local |
|---|---|---|
| `/api/identidad/v1/...` | MS Identidad | 8001 |
| `/api/cotizacion/v1/...` | MS Cotización | 8000 |

Para levantar los servicios sigue la sección «Levantar los servicios en local» del README de `postman/` en `solventa-backend`. No hace falta configurar CORS: el navegador solo habla con `localhost:4200`.

> **Supuesto por confirmar:** que el API Gateway de cada ambiente exponga las mismas rutas (`/api/identidad/...`, `/api/cotizacion/...`). Si no es así, se ajusta `apiBaseUrl` en `src/environments/` y el mapa de `proxy.conf.json`.

## Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor de desarrollo en es-CO. |
| `npm run start:en` | Servidor de desarrollo en en-US. |
| `npm run build` | Paquete de producción, con ambos idiomas (ver abajo). |
| `npm run build:dev` | Compilación sin optimizar, solo es-CO. |
| `npm run lint` | ESLint, incluida la regla de dependencias entre capas. |
| `npm test` | Pruebas unitarias en modo vigilancia (Chrome con interfaz). |
| `npm run test:ci` | Pruebas unitarias una vez, sin interfaz y con cobertura en `coverage/`. |
| `npm run i18n:extract` | Extrae los textos marcados para traducir a `src/locale/messages.xlf`. |
| `npm run format` / `format:check` | Aplica o verifica el formato con Prettier. |

## Generar el paquete de producción

```bash
npm ci
npm run build
```

El resultado queda en `dist/solventa-web/browser/`, **una carpeta por idioma**:

```
dist/solventa-web/browser/
├─ es-CO/    index.html con <base href="/es-CO/">
└─ en-US/    index.html con <base href="/en-US/">
```

Cada carpeta es un sitio estático completo y autocontenido. Para publicarlos:

1. Sube `dist/solventa-web/browser/` completa al servidor o bucket de archivos estáticos, conservando las dos carpetas.
2. Configura la ruta raíz (`/`) para que redirija a `/es-CO/` o a `/en-US/`, según la preferencia del usuario o el idioma del navegador.
3. Configura el servidor para que cualquier ruta que no sea un archivo devuelva el `index.html` **de su propio idioma** (por ejemplo, `/en-US/cotizar` devuelve `/en-US/index.html`). Sin esto, recargar una pantalla interna da error 404.

Notas:

- La compilación de producción falla si se pasan los presupuestos de tamaño de `angular.json` (inicial: aviso a 500 kB, error a 1 MB). Si falla, es una señal de revisar qué se importó, no de subir el límite.
- Las variables de ambiente van en `src/environments/`. `environment.ts` se usa en producción; `environment.development.ts` reemplaza a ese archivo al compilar en desarrollo. No guardes secretos ahí: todo lo que se compila queda visible para cualquier usuario del navegador.
- Para revisar el resultado en local: `npx http-server dist/solventa-web/browser -p 8080` y abre `http://localhost:8080/es-CO/`. Las pantallas internas dependen del punto 3, que este servidor no hace.
- El CI (`.github/workflows/ci.yml`) ya ejecuta lint, pruebas y este build en cada PR. El despliegue a un ambiente no está definido todavía en este repo.

## Estructura del proyecto

```
solventa-web/
├─ src/
│  ├─ main.ts
│  ├─ index.html
│  ├─ styles.scss                estilos globales
│  ├─ styles/                    parciales y tokens de diseño (color, tipografía, espaciado)
│  ├─ locale/                    traducciones: messages.xlf (es-CO) y messages.en-US.xlf
│  ├─ environments/              configuración por ambiente
│  └─ app/
│     ├─ app.ts / app.config.ts / app.routes.ts
│     ├─ core/                   servicios únicos de toda la app
│     │  ├─ auth/                sesión, rol, guards, interceptor del token
│     │  ├─ http/                interceptores y manejo de errores de red
│     │  ├─ config/              configuración de la app (URLs, valores por defecto)
│     │  ├─ preferences/         idioma y moneda elegidos por el usuario
│     │  ├─ i18n/                cambio de idioma
│     │  └─ money/               valor Money, formato y conversión de moneda
│     ├─ layout/                 estructura de página: encabezado, navegación, pie
│     ├─ shared/                 piezas reutilizables sin lógica de negocio
│     │  ├─ ui/                  componentes: botón, campo de formulario, alerta, etc.
│     │  ├─ pipes/
│     │  ├─ directives/
│     │  └─ models/
│     └─ features/               un área de negocio por carpeta (cotizar, pólizas, siniestros…)
├─ cypress/
│  ├─ e2e/                       recorridos de punta a punta
│  └─ fixtures/                  respuestas simuladas del contrato del backend
├─ proxy.conf.json               redirección de /api/* al backend local
├─ angular.json                  build, pruebas, lint e i18n
└─ eslint.config.js              reglas de código y de dependencias entre capas
```

Las carpetas vacías tienen un archivo `.gitkeep`; bórralo al agregar el primer archivo real. La guía de cada capa y la plantilla de una feature están en [`src/app/README.md`](src/app/README.md).

### Reglas de dependencia

```
features  →  layout  →  shared  →  core
```

Cada capa puede usar las que están a su derecha, nunca al revés, y **una feature nunca importa de otra feature**. `npm run lint` lo verifica a través de alias de importación:

| Alias | Carpeta |
|---|---|
| `@core/*` | `src/app/core/*` |
| `@shared/*` | `src/app/shared/*` |
| `@layout/*` | `src/app/layout/*` |
| `@features/*` | `src/app/features/*` |
| `@env/*` | `src/environments/*` |

Dentro de una misma capa o feature se usan rutas relativas.

## Idioma y moneda

El idioma base es **es-CO**: el texto en español se escribe directamente en las plantillas y en-US se traduce aparte.

**Marcar un texto para traducir**

```html
<h1 i18n="@@quote.title">Cotiza tu seguro</h1>
<input placeholder="Ciudad" i18n-placeholder="@@quote.city.placeholder" />
```

```ts
const message = $localize`:@@quote.error.generic:No pudimos calcular tu cotización.`;
```

Usa siempre un identificador explícito (`@@area.elemento`): así el texto en español puede mejorar sin romper la traducción.

**Traducir**

1. `npm run i18n:extract` actualiza `src/locale/messages.xlf` con los textos nuevos.
2. Copia las entradas nuevas a `src/locale/messages.en-US.xlf` y agrega su `<target>` en inglés.
3. `npm run start:en` para verlo, o `npm run build` para generar los dos idiomas.

**Agregar un idioma:** crea `src/locale/messages.<locale>.xlf` y regístralo en `angular.json`, bajo `projects.solventa-web.i18n.locales`.

Idioma y moneda son ajustes independientes. El idioma se resuelve en compilación (un build por idioma, por eso el cambio recarga la página). La moneda se resolverá en ejecución desde `core/preferences` y `core/money`; esas piezas se construyen junto con la primera historia que muestre montos.

Reglas para el código: ningún texto escrito a mano fuera de los mecanismos anteriores, y ningún monto o fecha formateado a mano. Los montos usarán `Money` y las fechas, el formato del idioma activo.

## Pruebas

| Tipo | Herramienta | Dónde |
|---|---|---|
| Unitarias | Jasmine + Karma | Junto al código, en archivos `*.spec.ts` |
| E2E | Cypress | `cypress/e2e/` |
| Accesibilidad | axe-core sobre Cypress | `cypress/e2e/` |

Cypress y axe-core se instalan al llegar los primeros recorridos E2E (el CI ya trae el job `e2e`, que se activa con la variable de repositorio `ENABLE_E2E=true`).

Todo `feat` o `fix` lleva pruebas. Escríbelas contra el comportamiento visible (textos, roles, etiquetas) y no contra detalles internos.

## Contribuir

La guía completa del equipo, válida para los cuatro repos, está en [`CONTRIBUTING.md`](CONTRIBUTING.md). Para saber dónde ubicar tu código, consulta la [guía de capas y plantilla de feature](src/app/README.md). Lo esencial para este repo:

1. **Parte de una historia** (HU-xx o HAxx). No hay trabajo sin historia en el tablero.
2. **Nunca hagas push directo a `main`.** Crea una rama corta desde `main`:
   ```bash
   git switch main && git pull
   git switch -c feature/HU-38-cotizacion-asistida
   ```
   Formato: `<tipo>/<ID>-<descripcion-en-kebab-case>`, con tipo `feature`, `fix`, `docs`, `chore`…
3. **Commits en Conventional Commits** con el ID de la historia como alcance:
   ```
   feat(HU-38): agregar paso de datos del inmueble
   test(HU-38): cubrir validación del plazo del crédito
   ```
   Tipos permitidos: `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `build`, `chore`.
4. **Antes de abrir el PR**, corre lo mismo que corre el CI y confirma que pasa:
   ```bash
   npm run lint && npm run format:check && npm run test:ci && npm run build
   ```
5. **Abre el PR hacia `main`** con la plantilla del repo. El título también sigue Conventional Commits, porque es el mensaje del *squash and merge*. Incluye `Closes #n`.
6. **Necesitas al menos 1 aprobación** de otro integrante y el CI en verde. Quien abre el PR no se aprueba a sí mismo.

### Convenciones de código

- **Componentes standalone** con prefijo `sol` (`sol-quote-wizard`) y estado con signals. Sigue la [guía de estilo de Angular](https://angular.dev/style-guide): los archivos se nombran por lo que son, sin el sufijo `.component`.
- **Identificadores en inglés** (clases, variables, archivos). Los textos para el usuario, en español, y siempre por i18n.
- **Una feature no conoce HTTP.** Habla con un contrato abstracto y el adaptador HTTP traduce a las rutas del backend. Detalle en la [guía de capas](src/app/README.md).
- **Accesibilidad (WCAG 2.1 AA).** Etiqueta asociada a cada control, foco visible, uso completo con teclado y contraste suficiente. Los componentes de `shared/ui` deben traerla resuelta.
- **Estados de carga, vacío y error** en cada pantalla que consulte datos.
- **Sin secretos** en el código, los commits ni los entornos.
- **Dependencias nuevas:** justifícalas en el PR. Se prefiere lo que ya trae Angular.

### Definición de terminado

- [ ] Criterios de aceptación de la historia cumplidos.
- [ ] Pruebas escritas y en verde en CI.
- [ ] Sin textos ni formatos escritos a mano; traducciones es-CO y en-US al día.
- [ ] Accesibilidad verificada en el recorrido (teclado, foco, contraste).
- [ ] PR aprobado por al menos 1 compañero y mergeado a `main`.
- [ ] Estado y Story Points actualizados en el tablero.

## Versiones

SemVer, un tag por sprint (`v0.1.0`, `v0.2.0`…), creado sobre `main` al cerrar el sprint. Al subir el tag, `release.yml` publica la GitHub Release. El detalle está en `CONTRIBUTING.md`, sección 4.

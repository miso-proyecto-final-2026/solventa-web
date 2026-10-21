# Capas de `src/app`

Guía corta de qué va en cada carpeta. Las reglas de dependencia y los alias de importación están en el [README de la raíz](../../README.md#reglas-de-dependencia) y las hace cumplir `npm run lint`.

| Capa | Qué contiene | Qué NO contiene |
|---|---|---|
| `core/` | Servicios que existen una sola vez en toda la app: sesión y rol, interceptores HTTP, configuración, preferencias del usuario, cambio de idioma, `Money`. | Pantallas ni lógica de un área de negocio. |
| `layout/` | La estructura de página que envuelve a las features: encabezado con navegación, pie, selectores de idioma y moneda. | Lógica de negocio. |
| `shared/` | Piezas reutilizables: componentes de `ui/` (botón, campo de formulario, alerta, paso a paso), `pipes/`, `directives/`, tipos comunes en `models/`. | Nada que conozca una feature o hable con el backend. |
| `features/` | Un área de negocio por carpeta, cargada de forma diferida (lazy) desde `app.routes.ts`. | Imports de otras features. |

## Plantilla de una feature

Toda feature repite la misma forma, para que quien conozca una sepa dónde buscar en las demás:

```
features/<area>/
├─ <area>.routes.ts          rutas internas y guards (por ejemplo, por rol)
├─ pages/                    contenedores: conectan la pantalla con el estado
├─ <partes de la pantalla>/  componentes de presentación: reciben datos y emiten eventos
├─ state/                    store (signals) y fachada con los casos de uso que la UI invoca
├─ domain/                   modelos, reglas y validaciones puras, fáciles de probar
└─ data-access/
   ├─ <area>.gateway.ts      clase abstracta: lo que la feature necesita del backend, en sus términos
   ├─ http-<area>.gateway.ts adaptador real contra el API Gateway
   ├─ mock-<area>.gateway.ts adaptador simulado para desarrollo sin backend
   ├─ dto/                   formas exactas que usa el backend
   └─ mappers/               traducen DTO ⇄ modelo de dominio
```

Las ideas que sostienen la plantilla:

- **La pantalla no conoce HTTP.** Habla con la fachada; la fachada, con el contrato abstracto (`gateway`). Cambiar de adaptador es cambiar un proveedor de inyección.
- **El backend no dicta el modelo del front.** Si el backend renombra un campo, cambia el DTO y el mapper, nada más.
- **Los componentes de presentación no hacen llamadas.** Así se prueban sin backend.

Crea carpetas solo cuando haya algo que poner en ellas: una feature pequeña puede no necesitar `domain/` todavía.

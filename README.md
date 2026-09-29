# MaquinesSurMall

PWA móvil interna para gestionar bares, máquinas recreativas, averías y recaudaciones.

## Objetivo

La aplicación está pensada para instalarse en Android como una **Progressive Web App (PWA)**, del mismo modo que una aplicación móvil. Después de la primera carga, el service worker permite abrir la interfaz instalada sin depender de un PC.

## Privacidad: datos solo en el teléfono

GitHub contiene **solo el código de la aplicación**. Los datos reales de la empresa no se guardan en GitHub ni en ningún backend.

La base `MaquinesSurMallDB` usa IndexedDB del dispositivo y contiene:

- bares;
- máquinas tipo A y tipo B;
- averías e historial;
- recaudaciones, tasas y campo B;
- calendario de actividad.

No hay Supabase, Firebase, API propia, analítica ni sincronización cloud.

> Los datos pertenecen al dispositivo y al origen web instalado. Si se borran los datos de la aplicación/navegador o se cambia de móvil, se perderán salvo que exista una copia de seguridad.

## PWA

La aplicación incluye:

- manifest instalable;
- service worker con caché para uso offline;
- modo `standalone`;
- botón de instalación cuando Android/Chrome lo permite;
- navegación adaptada a móvil;
- exportación y restauración de backup JSON.

## Desarrollo

~~~bash
npm install
npm run dev
~~~

Build de producción:

~~~bash
npm run build
~~~

## V1

- Panel general.
- Alta de bares.
- Alta de máquinas A/B por bar.
- Registro y resolución de averías.
- Recaudaciones por bar con tasas y detalle por máquina.
- Campo "Hubo B" y valor B para máquinas tipo B.
- Vista mensual de actividad.
- Exportación/restauración de backup JSON.
- PWA instalable en móvil.

## Seguridad del repositorio

Los archivos de datos, bases locales, backups y variables de entorno están excluidos mediante `.gitignore`. Nunca deben subirse copias reales, recaudaciones, listados de bares/máquinas ni credenciales.

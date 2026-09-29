# MaquinesSurMall

Aplicación interna para gestionar bares, máquinas recreativas, averías y recaudaciones.

## Principio de privacidad

El repositorio contiene **solo código**. Los datos reales de la empresa no se guardan en GitHub ni en ningún backend.

La V1 usa **IndexedDB** en el navegador:

- bares;
- máquinas tipo A y tipo B;
- averías e historial;
- recaudaciones, tasas y campo B;
- calendario de actividad;
- copias de seguridad manuales en JSON.

No hay Supabase, Firebase, API propia, analítica ni sincronización cloud.

> Importante: los datos locales dependen del perfil del navegador. Si se borran los datos del sitio o se cambia de dispositivo, se perderán salvo que exista una copia de seguridad.

## Desarrollo local

Requisitos: Node.js 20 o superior.

~~~bash
npm install
npm run dev
~~~

Para generar una versión de producción:

~~~bash
npm run build
npm run preview
~~~

## Estructura de datos

La base local se llama `MaquinesSurMallDB` y contiene cinco tablas:

- `bars`
- `machines`
- `incidents`
- `collections`
- `collectionEntries`

Las máquinas mantienen identidad propia mediante UUID, por lo que más adelante podremos añadir historial de traslados entre bares sin perder sus averías o recaudaciones históricas.

## V1

- Panel general.
- Alta de bares.
- Alta de máquinas A/B por bar.
- Registro y resolución de averías.
- Recaudaciones por bar con tasas y detalle por máquina.
- Indicador "Hubo B" y valor B para máquinas tipo B.
- Vista mensual de actividad.
- Exportación/restauración de backup JSON.
- Diseño responsive para ordenador y móvil.

## Seguridad del repositorio

Los archivos de datos, bases locales, backups y variables de entorno están excluidos mediante `.gitignore`.

Nunca subir al repositorio:

- copias reales de la base;
- exportaciones de recaudaciones;
- listados reales de bares o máquinas;
- credenciales o claves.

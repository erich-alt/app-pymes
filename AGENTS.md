# Instrucciones para Codex

Este proyecto es una app local para administracion financiera de pymes en Chile.

## Preferencias del proyecto

- Mantener funcionamiento local, sin depender de servicios externos salvo integraciones explicitamente configuradas.
- No reemplazar datos del usuario en `data/app-data.json` sin confirmacion.
- Priorizar cambios pequenos y verificables.
- Mantener lenguaje de interfaz en espanol.
- Preferir formatos simples e importables: CSV, XLSX, PDF con texto.
- Para integraciones con SII o bancos, separar la interfaz de usuario del conector real.
- No guardar credenciales bancarias o tributarias en texto plano.

## Como probar

```powershell
npm start
```

Abrir:

```text
http://127.0.0.1:8899
```

Validar al menos:

- Panel principal carga.
- Centro de gestion diaria muestra rutina, estados y alertas.
- Reportes permite imprimir reporte diario o flujo 60 dias con idioma, moneda e indicadores financieros.
- Ventas permite filtrar por cliente, fechas y tipo, y muestra reporte por cliente.
- Reportes incluye tipo "Ventas por cliente".
- Selector multiempresa aparece y permite crear empresas.
- Dashboard muestra indicadores economicos y permite actualizarlos.
- Creditos muestra cuadro de desarrollo.
- Cuentas muestra movimientos.
- Al agregar cuenta corriente se puede elegir moneda.
- Inversiones aparece en la navegacion y permite registrar DAP, pactos y fondos mutuos.
- Inversiones muestra interes estimado y vencimientos integrados al flujo.
- Al tomar una inversion debe descontar la cuenta seleccionada; al liquidar o rescatar debe abonar en la cuenta elegida.
- Fondos mutuos no tienen tasa conocida; el rescate calcula ganancia real e interes mensual.
- Cheques aparece en la navegacion.
- Tarjetas aparece en la navegacion y muestra movimientos clasificados.
- Tarjetas muestran cupo CLP y cupo USD.
- SII permite importar compras/ventas y calcula IVA mensual.
- Reportes y SII muestran ventas/costos netos mensual y anual.
- IVA mensual se proyecta como pago antes del 20 del mes siguiente cuando da a pagar.
- Comercio exterior permite registrar importaciones/exportaciones con moneda, tipo de cambio, IVA y derechos/gastos.
- Hay una maqueta iPhone estatica en `modelo-iphone/app-pymes-modelo-iphone.html` y una copia en iCloud.
- Importacion CSV de creditos y cartolas responde.

## Archivos principales

- `src/server.mjs`: servidor local, API, importacion de archivos.
- `public/index.html`: estructura de pantalla.
- `public/app.js`: logica de interfaz, flujo, conciliacion y formularios.
- `public/styles.css`: estilos.
- `data/app-data.json`: datos reales locales.
- `data/seed.json`: datos iniciales.

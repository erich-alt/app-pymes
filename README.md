# Pyme Local

Base de una app local para administracion financiera de pymes en Chile.

## Que incluye

- App servida desde el computador en `http://127.0.0.1:8899`.
- Datos persistidos localmente en `data/app-data.json`.
- Administracion multiempresa con selector de empresa activa.
- Panel de caja, ventas, compras, cuentas por cobrar y pagar.
- Modulo de ventas con filtros por cliente, fecha y tipo de operacion.
- Reporte de ventas por cliente con venta total, venta promedio y plazo de pago promedio.
- Centro de gestion diaria con rutina automatizada, estado de sincronizaciones y alertas.
- Reportes imprimibles diarios y de flujo de caja, con idioma, moneda destino e indicadores financieros.
- Indicadores economicos compactos en el dashboard: dolar, euro, UF y ultima actualizacion.
- Proyeccion de flujo de caja a 60 dias.
- Registro inicial de bancos/cuentas corrientes.
- Cuentas corrientes con moneda configurable: CLP, USD, EUR o UF.
- Registro de creditos con cuotas futuras.
- Importacion de cuadros de desarrollo de creditos desde CSV, TXT, XLSX y PDF.
- Detalle completo del credito al apretar cada credito.
- Movimientos de cuenta corriente al apretar cada cuenta.
- Importacion de cartolas desde CSV, TXT, XLSX y PDF.
- Importacion manual SII para compras y ventas desde CSV, TXT, XLSX y PDF.
- Integracion preparada con Fintoc para conectar bancos y SII por empresa desde el dashboard o por token en cada cuenta bancaria.
- Calculo de ventas y costos netos mensual y anual desde documentos SII.
- Calculo mensual de IVA debito, IVA credito y resultado a pagar o recuperar, con pago antes del 20 del mes siguiente.
- Identificacion basica de importaciones y exportaciones en documentos SII.
- Registro manual de importaciones y exportaciones con moneda, tipo de cambio, IVA, derechos/gastos y efecto en cuentas por cobrar o pagar.
- Modulo visual separado para comercio exterior, pensado para ingreso simple de importaciones y exportaciones.
- Registro de cheques por cobrar y por pagar, con plazo conocido o desconocido.
- Conciliacion inicial por monto entre cartolas importadas, facturas y cheques pendientes.
- Configuracion de hora para sincronizacion bancaria diaria mientras la app este abierta.
- Administracion de tarjetas de credito.
- Tarjetas con cupo separado en CLP y USD.
- Movimientos de tarjeta clasificados como gasto o costo.
- Pago futuro de tarjeta integrado al flujo de caja segun fecha de pago.
- Configuracion de hora para descarga diaria de tarjetas mientras la app este abierta.
- Administracion de inversiones: depositos a plazo, pactos y fondos mutuos.
- Calculo de interes estimado para inversiones con tasa 30 dias o tasa anual.
- Toma de inversiones descontada automaticamente desde la cuenta seleccionada.
- Vencimientos de DAP y pactos integrados al flujo de caja.
- Liquidacion o rescate de inversiones desde el panel, con abono en la cuenta elegida, ganancia real e interes mensual.
- Modulo preparado para futura sincronizacion diaria con SII.

## Ubicacion recomendada

La copia activa para seguir trabajando esta en:

```text
C:\Users\Erich Harseim Diaz\OneDrive\Escritorio\app pymes
```

## Como abrir

Desde esta carpeta:

```powershell
npm start
```

Luego abrir:

```text
http://127.0.0.1:8899
```

Tambien puedes usar el archivo `Abrir App Pymes.bat`.

## Ruta de datos

Los datos reales de uso quedan en:

```text
app pymes/data/app-data.json
```

Ese archivo se crea automaticamente la primera vez que se inicia la app.

## Siguientes etapas sugeridas

1. Ajustar importadores SII con archivos reales descargados desde cada empresa.
2. Conectores reales para cada banco, segun credenciales y mecanismo disponible.
3. Conectores reales para tarjetas de credito o importacion de estados de cuenta por emisor.
4. Conciliacion bancaria avanzada por RUT, folio, fecha y reglas configurables.
5. Integracion automatica SII validada con mecanismo autorizado. Ver `docs/SII-CONEXION.md`.
6. Usuarios locales, cifrado de credenciales y respaldos.

## Notas de importacion

- Excel soportado: `.xlsx`.
- Excel antiguo `.xls`: convertir a `.xlsx` o CSV antes de importar.
- PDF: se intenta leer el texto del documento. Algunos bancos generan PDF escaneados como imagen; esos requeriran OCR en una etapa posterior.
- La sincronizacion bancaria puede usar Fintoc si se configuran `FINTOC_SECRET_KEY` y `FINTOC_PUBLIC_KEY` en `.env`.
- La sincronizacion de tarjetas actual registra la descarga en la app, pero no descarga movimientos reales hasta configurar conectores por banco/emisor.
- La version GitHub Pages es estatica: sirve para revisar, trabajar con datos de ejemplo y actualizar indicadores economicos desde el navegador. Fintoc real requiere la app local o un backend seguro. Ver `docs/FINTOC-CONEXION.md`.

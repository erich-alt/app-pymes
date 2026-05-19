# App Pymes

Proyecto local para administracion financiera de pymes en Chile.

## Ubicacion

```text
C:\Users\Erich Harseim Diaz\OneDrive\Escritorio\app pymes
```

## Como abrir

Usar doble clic en:

```text
Abrir App Pymes.bat
```

O ejecutar:

```powershell
npm start
```

Luego abrir:

```text
http://127.0.0.1:8899
```

## Estado actual

- App local funcionando en el computador.
- Datos guardados en `data/app-data.json`.
- Administracion multiempresa con selector de empresa activa.
- Panel financiero con caja, cuentas por cobrar, cuentas por pagar, creditos y cheques.
- Modulo de ventas con filtros por cliente, fecha y tipo de operacion.
- Reporte de ventas por cliente con venta total, venta promedio y plazo de pago promedio.
- Centro de gestion diaria con rutina automatizada, estado de sincronizaciones y alertas.
- Reportes imprimibles diarios y de flujo de caja, con idioma, moneda destino e indicadores financieros.
- Dashboard con indicadores economicos compactos: dolar, euro, UF y ultima actualizacion.
- Cuentas corrientes con moneda configurable: CLP, USD, EUR o UF.
- Flujo de caja proyectado a 60 dias.
- Importacion de creditos desde CSV, TXT, XLSX y PDF.
- Vista de cuadro de desarrollo al apretar un credito.
- Vista de movimientos al apretar una cuenta corriente.
- Importacion de cartolas desde CSV, TXT, XLSX y PDF.
- Importacion manual SII para compras y ventas desde CSV, TXT, XLSX y PDF.
- Calculo de ventas y costos netos mensual/anual desde documentos SII.
- Calculo mensual de IVA debito, IVA credito y resultado a pagar o recuperar, con vencimiento antes del 20 del mes siguiente.
- Identificacion basica de importaciones y exportaciones en documentos SII.
- Registro manual de importaciones/exportaciones con moneda, tipo de cambio, IVA, derechos/gastos y creacion de cobros/pagos pendientes.
- Comercio exterior separado como modulo visual para ingreso simple.
- Cheques por cobrar y por pagar con plazo conocido o desconocido.
- Cheques con plazo integrado al flujo de caja.
- Administracion de tarjetas de credito.
- Tarjetas con cupo separado en CLP y USD.
- Movimientos de tarjeta clasificados como gasto o costo.
- Pago de tarjetas integrado al flujo de caja por fecha de pago.
- Administracion de inversiones: depositos a plazo, pactos y fondos mutuos.
- Inversiones con moneda, plazo, cuenta de caja, tasa 30 dias o anual, interes estimado y vencimiento en flujo.
- Al tomar una inversion se descuenta caja; al liquidar o rescatar se abona en la cuenta elegida y se calcula ganancia real e interes mensual.
- Hora configurable para descarga diaria de movimientos de tarjeta mientras la app este abierta.
- Hora configurable para sincronizacion bancaria diaria mientras la app este abierta.
- Boton de sincronizacion bancaria preparado, todavia sin conector real.
- Modulo SII preparado, todavia sin conexion real. Para descargar RCV puede bastar Clave Tributaria/Clave Unica con usuario autorizado; certificado digital queda principalmente para emision/firma DTE. La ruta de implementacion esta documentada en `docs/SII-CONEXION.md`.

## Formatos soportados ahora

- Creditos: `.csv`, `.txt`, `.xlsx`, `.pdf`.
- Cartolas: `.csv`, `.txt`, `.xlsx`, `.pdf`.
- Excel antiguo `.xls`: convertir a `.xlsx` o CSV antes de importar.
- PDF: funciona mejor si el PDF contiene texto seleccionable. Si es escaneado, falta agregar OCR.

## Pendientes importantes

1. Definir banco o bancos prioritarios para sincronizacion real.
2. Diseñar almacenamiento seguro de credenciales/certificados.
3. Crear conectores bancarios reales o flujo de importacion asistida por banco.
4. Crear conectores reales o importadores por emisor para tarjetas de credito.
5. Mejorar conciliacion por RUT, folio, fecha, monto y reglas configurables.
6. Ajustar importadores SII contra archivos reales de RCV por empresa.
7. Luego evaluar automatizacion SII con usuario autorizado, Clave Tributaria/Clave Unica y mecanismo permitido; certificado digital solo si emitiremos o firmaremos DTE. Ver `docs/SII-CONEXION.md`.
8. Agregar respaldos y restauracion de datos.

## Nota para continuar en Codex

Abrir esta carpeta como workspace/proyecto:

```text
C:\Users\Erich Harseim Diaz\OneDrive\Escritorio\app pymes
```

Contexto breve para continuar:

```text
Estamos construyendo una app local de gestion financiera para pymes chilenas. Ya existe base local Node + HTML/CSS/JS, datos en JSON, importacion de creditos/cartolas, cheques, tarjetas de credito, flujo de caja y modulos preparados para SII y bancos. Continuar manteniendo la app local, simple y progresiva.
```

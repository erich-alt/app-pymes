# Conexion Fintoc

La app queda preparada para usar Fintoc con bancos y SII por empresa.

## Configuracion local

1. Copia `.env.example` como `.env`.
2. Completa:
   - `FINTOC_SECRET_KEY`: clave secreta live o test de Fintoc.
   - `FINTOC_PUBLIC_KEY`: clave publica correspondiente.
   - `FINTOC_WEBHOOK_URL`: opcional si se publica un backend con HTTPS.
3. Reinicia la app local con `npm start`.

La clave secreta no debe ir al frontend ni a GitHub. Por eso `.env` esta en `.gitignore`.

## Flujo esperado

- En el dashboard, `Conectar banco` abre el widget de Fintoc para la empresa seleccionada.
- En cada cuenta bancaria tambien se puede guardar manualmente `Fintoc link token` y `Fintoc account id`.
- La primera vez se ingresan las credenciales del banco.
- La app guarda el `link_token` en el archivo local `data/app-data.json`, que no se sube al repositorio.
- Luego, `Actualizar todo` descarga movimientos bancarios y documentos SII conectados.
- La rutina diaria ejecuta la misma descarga automatica cuando existan claves y links configurados.
- Si el banco pide segunda clave, Fintoc puede requerir MFA mediante refresh intents.

## SII con Fintoc

Fintoc expone links fiscales con producto `invoices` y permite consultar facturas emitidas y recibidas con el endpoint de invoices. La app mapea:

- `issued` a ventas.
- `received` a compras.

Estos documentos alimentan ventas, compras, IVA, cuentas por cobrar y cuentas por pagar.

## Limitacion de GitHub Pages

La version publicada en GitHub Pages es estatica. Sirve para revisar la interfaz, guardar datos de prueba en el navegador, actualizar indicadores economicos desde internet y registrar llaves de prueba por navegador.

Para sincronizacion real de bancos y SII se debe usar la app local o desplegar un backend con HTTPS. Si se configura `Backend seguro` en el dashboard, la app online llamara ese backend y enviara las llaves en headers para pruebas controladas. No se recomienda usar llaves productivas directamente desde GitHub Pages.

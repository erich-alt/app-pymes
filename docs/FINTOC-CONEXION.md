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
- La primera vez se ingresan las credenciales del banco.
- La app guarda el `link_token` en el archivo local `data/app-data.json`, que no se sube al repositorio.
- Luego, `Actualizar todo` descarga movimientos bancarios y documentos SII conectados.
- Si el banco pide segunda clave, Fintoc puede requerir MFA mediante refresh intents.

## SII con Fintoc

Fintoc expone links fiscales con producto `invoices` y permite consultar facturas emitidas y recibidas con el endpoint de invoices. La app mapea:

- `issued` a ventas.
- `received` a compras.

Estos documentos alimentan ventas, compras, IVA, cuentas por cobrar y cuentas por pagar.

## Limitacion de GitHub Pages

La version publicada en GitHub Pages es estatica y no puede guardar claves secretas ni llamar Fintoc directamente. Para sincronizacion real se debe usar la app local o desplegar un backend con HTTPS.

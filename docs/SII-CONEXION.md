# Conexion SII

Este proyecto ya puede importar manualmente archivos de compras y ventas descargados desde el SII en CSV, TXT, XLSX o PDF. Para bajar compras, ventas y facturas asociadas desde el Registro de Compras y Ventas no necesariamente se requiere certificado digital: el acceso al RCV puede hacerse con RUT y Clave Tributaria, Clave Unica o Certificado Digital, dependiendo del flujo y autorizaciones del usuario.

## Estado actual de la app

- El modulo SII importa ventas y compras desde archivos locales.
- Los documentos importados alimentan ventas, costos, IVA mensual, cuentas por cobrar y cuentas por pagar.
- El boton "Sincronizar ahora" todavia registra una sincronizacion simulada.
- Los datos reales quedan en `data/app-data.json`, que no debe subirse a GitHub.

## Requisitos SII a considerar

Segun informacion publica del SII, el Registro de Compras y Ventas se abastece de los documentos tributarios electronicos recibidos por el SII y permite operar sobre compras y ventas. Las guias de acceso al RCV indican autenticacion con RUT y Clave Tributaria, Clave Unica o Certificado Digital.

El certificado digital sigue siendo relevante para emision y firma de documentos tributarios electronicos, y para opciones protegidas del sistema de facturacion electronica. Por eso la app debe separar claramente:

- Descarga/consulta de RCV: puede operar con Clave Tributaria/Clave Unica si el usuario esta autorizado.
- Emision/firma DTE: requiere certificado digital vigente.
- Automatizacion completa: requiere validar el mecanismo permitido por SII y guardar credenciales de forma segura.

Fuentes oficiales consultadas:

- https://www.sii.cl/destacados/factura_electronica/certificado_digital.htm
- https://www.sii.cl/factura_electronica/factura_mercado/menu_certificacion.html
- https://www.sii.cl/factura_electronica/tecnica.htm
- https://www.sii.cl/factura_electronica/factura_sii.htm

## Ruta recomendada

1. Mantener primero la importacion manual asistida.
   - Descargar desde el SII el Registro de Compras y Ventas de cada empresa.
   - Importar ventas y compras en la pestaña SII.
   - Ajustar el parser con archivos reales de muestra, borrando datos sensibles si se usan para pruebas.

2. Preparar seguridad local.
   - No guardar Clave Tributaria, Clave Unica ni claves de certificado en texto plano.
   - No subir certificados digitales ni `data/app-data.json` a GitHub.
   - Definir roles: titular, representante legal o usuario autorizado por empresa.

3. Disenar conector automatico.
   - Crear un modulo separado `src/sii-client.mjs`.
   - Mantener un modo `demo`, un modo `manual` y luego un modo `conector-real`.
   - Guardar trazabilidad: empresa, periodo, hora de sincronizacion, archivo o respuesta recibida y resultado.

4. Validar legal y operativamente.
   - Confirmar que la empresa tenga usuario autorizado.
   - Confirmar mecanismo permitido por SII para el tipo de descarga buscada.
   - Probar primero con una empresa demo o con datos de un periodo acotado.

## Siguiente mejora tecnica sugerida

Agregar a la pestaña SII un selector de "Modo de conexion":

- Manual: importar archivo descargado desde SII.
- Simulado: crear una marca de sincronizacion para pruebas.
- Real RCV: pendiente hasta configurar usuario autorizado y manejo seguro de credenciales.
- Real DTE: pendiente hasta configurar certificado digital, solo si la app emitira o firmara documentos.

Esto permite avanzar en la interfaz sin exponer credenciales antes de tiempo.

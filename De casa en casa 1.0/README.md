# De casa en casa 1.0

Aplicación web (PWA) para organizar los territorios de predicación de una congregación.
Funciona en celular y computadora, se puede instalar en la pantalla de inicio y los datos se guardan en el propio dispositivo.

## Funciones

- **Territorios**: número, nombre/zona, notas, búsqueda y filtros (disponibles, asignados, +4 meses, sin trabajar +1 año).
- **Asignación y devolución** a publicadores, con historial completo por territorio.
- **Mapa** (OpenStreetMap): dibuja los límites de cada territorio; colores por estado.
- **Direcciones** por territorio, con marca "No pasar".
- **Publicadores** y los territorios que tiene cada uno.
- **Tarjeta imprimible** con mapa, direcciones y historial.
- **Respaldo** JSON, importación y registro CSV de asignaciones (tipo S-13).

## Uso

Debe servirse por HTTP para que funcione sin conexión:

```bash
cd "De casa en casa 1.0"
python3 -m http.server 8080
```

Abre <http://localhost:8080>. Para usarlo en el celular, publícalo en cualquier hosting estático (GitHub Pages, Netlify…) con HTTPS.

## Notas

- Los datos viven en `localStorage` de cada dispositivo; usa **Datos → Exportar respaldo** para compartirlos.
- Leaflet se carga desde unpkg la primera vez; después queda en caché.
- La información de direcciones es personal: protégela y úsala solo con fines de la congregación.

## Ideas para siguientes versiones

Sincronización entre dispositivos con inicio de sesión, importación de direcciones desde CSV, campañas especiales, rol de siervo vs. publicador.

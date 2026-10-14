---
name: web-frontend
description: Desarrollo frontend en React/Vite con TypeScript, diseño UX/UI, componentes modulares y estilos adaptados al sistema nomina-ccsa. Usar cuando el usuario pida interfaces, componentes, layouts o estilos.
---

# Directrices de Frontend & UX/UI (nomina-ccsa)

1. **Diseño y Estilos:**
   - Estilos híbridos: Clases CSS globales en `index.css`/`App.css` combinadas con estilos en línea (`style={{ ... }}`) para control exacto de layouts (flexbox, grid, anchos de selectores y espaciados).
   - Paleta corporativa oscura (Dark Theme): Fondo (`#0f172a`), Superficies (`#1e293b`), Bordes (`#475569`), Textos principales (`#f8fafc`) y secundarios (`#cbd5e1`).
   - Todos los elementos interactivos deben incluir estados de hover y feedback visual claro.

2. **Calidad de Componentes:**
   - Componentes pequeños, desacoplados y reutilizables en `src/components/`.
   - TypeScript estricto para Props e interfaces de datos (ej. `IncidentItem`, `Worker`, `Turno`).
   - Comentarios en código en idioma español.

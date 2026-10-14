---
name: web-backend
description: Diseño de APIs en Node.js (Express), esquemas de base de datos SQLite con better-sqlite3, servicios de asistencia y lógica de negocio. Usar cuando se trabaje en el servidor o endpoints.
---

# Directrices de Backend & APIs (nomina-ccsa)

1. **Arquitectura:**
   - Separación entre lógica de negocio (Servicios en `server/services/`) y controladores de rutas (`server/index.cjs`).
   - Conexión persistente mediante SQLite (`server/database.cjs`).

2. **Seguridad y Robustez:**
   - Consultas preparadas para prevenir inyección SQL.
   - Manejo adecuado de errores HTTP y respuestas JSON consistentes.
   - Código documentado con comentarios en español.

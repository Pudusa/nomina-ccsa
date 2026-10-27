# Sistema de Diseño y Experiencia de Usuario (UX/UI) - Nómina CCSA (Escritorio Pro & Accesibilidad)

Este documento define la identidad visual, paleta de colores, tipografía, componentes y lineamientos de UX/UI para el sistema de escritorio **Nómina CCSA**, optimizado para el uso exclusivo en equipos de escritorio y diseñado con un enfoque accesible para adultos mayores (alto contraste, tamaños de fuente grandes y espacios amplios).

---

## 1. Fundamentos Tipográficos y Accesibilidad

- **Tipografía Principal:** Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- **Tamaños y Pesos:**
  - Tamaños de fuente aumentados (`16px` a `1.3rem`) para garantizar legibilidad óptima.
  - Pesos fuertes (`font-semibold`, `font-bold`, `font-extrabold`) en textos principales, horas y nombres para evitar fatiga visual.

---

## 2. Paleta de Colores (Gris Suave & Verde Profesional de Alto Contraste)

### Fondo y Superficies
- **Fondo General (`#f1f5f9`):** Gris suave que elimina los deslumbramientos y evita la fatiga visual.
- **Tarjetas y Superficies (`#ffffff`):** Blanco puro de alto contraste.
- **Bordes y Divisorios (`#cbd5e1`):** Gris claro definido para delimitar claramente los elementos y controles.

### Texto y Legibilidad
- **Texto Principal (`#0f172a` / `#1e293b`):** Tonalidad oscura de alto contraste para máxima legibilidad.
- **Texto Secundario (`#334155` / `#475569`):** Gris oscuro sólido.

### Colores de Estado y Acentos (Verde Profesional)
- **Color Principal / Acento (`#16a34a` / `#15803d`):** Verde corporativo para botones principales, indicadores de éxito y bordes activos.
- **Asistencia Completa / Entrada:** Verde esmeralda (`#16a34a`).
- **Alerta / Salida / Turnos:** Púrpura/Violeta intenso (`#9333ea`).
- **Ausencia / Peligro:** Rojo de alta visibilidad (`#dc2626`).
- **Descanso / Neutro:** Gris pizarra (`#64748b`).

---

## 3. Componentes y Patrones UI de Escritorio

### Botones (`button`)
- **Primario:** `bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-lg shadow-sm transition-colors text-base flex items-center gap-2`
- **Secundario:** `bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold px-6 py-3 rounded-lg border border-slate-300 transition-colors text-base`

### Tablas Amplias y Espaciadas (Estándar Escritorio Accesible)
- **Contenedor:** `bg-white border-2 border-slate-300 rounded-xl shadow-md overflow-hidden`
- **Cabecera:** `bg-slate-200 text-slate-900 font-extrabold text-sm uppercase tracking-wider px-6 py-4`
- **Filas:** `border-b-2 border-slate-200 hover:bg-green-50 transition-colors`
- **Celdas:** `px-6 py-5 text-base text-slate-900 font-semibold`

### Modales Centrados de Alta Visibilidad
- **Overlay:** `fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4`
- **Contenedor:** `bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-slate-300 p-8`

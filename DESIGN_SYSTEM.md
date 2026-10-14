# Sistema de Diseño y Experiencia de Usuario (UX/UI) - Nómina CCSA

Este documento define la identidad visual, paleta de colores, tipografía, componentes y lineamientos de UX/UI para el sistema de nómina y asistencia **Nómina CCSA**, tras la migración a **Tailwind CSS v4** y la eliminación de estilos en línea.

---

## 1. Fundamentos Tipográficos

- **Tipografía Principal (Sans):** Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- **Tipografía Monospaced (Mono):** JetBrains Mono, ui-monospace, Consolas, monospace.
- **Escala Modular:**
  - `text-xs`: 12px / 16px (Badges, etiquetas secundarias)
  - `text-sm`: 14px / 20px (Texto de tablas, inputs, botones secundarios)
  - `text-base`: 16px / 24px (Texto general, párrafos)
  - `text-lg`: 18px / 28px (Subtítulos de tarjetas)
  - `text-xl`: 20px / 28px (Encabezados de sección)
  - `text-2xl`: 24px / 32px (Títulos de vistas)
  - `text-3xl`: 30px / 36px (Títulos principales / modales)

---

## 2. Paleta de Colores (Modo Claro y Oscuro)

La paleta está diseñada con un enfoque profesional, corporativo y accesible (cumpliendo con WCAG AA).

### Modo Claro (Light Mode)
- **Fondo General (`bg-slate-50`):** `#f8fafc`
- **Fondo de Superficies/Tarjetas (`bg-white`):** `#ffffff`
- **Bordes (`border-slate-200`):** `#e2e8f0`
- **Texto Principal (`text-slate-800`):** `#1e293b`
- **Texto Secundario (`text-slate-500`):** `#64748b`
- **Color Primario / Acento (`indigo-600`):** `#4f46e5` (Hover: `indigo-700` `#4338ca`)
- **Éxito / Asistencia (`emerald-600`):** `#059669` (Fondo: `emerald-50` `#ecfdf5`)
- **Alerta / Incidencia (`amber-600`):** `#d97706` (Fondo: `amber-50` `#fffbeb`)
- **Peligro / Falta (`rose-600`):** `#e11d48` (Fondo: `rose-50` `#fff1f2`)

### Modo Oscuro (Dark Mode)
- **Fondo General (`dark:bg-slate-950`):** `#020617`
- **Fondo de Superficies/Tarjetas (`dark:bg-slate-900`):** `#0f172a`
- **Bordes (`dark:border-slate-800`):** `#1e293b`
- **Texto Principal (`dark:text-slate-100`):** `#f1f5f9`
- **Texto Secundario (`dark:text-slate-400`):** `#94a3b8`
- **Color Primario / Acento (`dark:bg-indigo-500`):** `#6366f1`

---

## 3. Componentes y Patrones UI

### Botones (`button`)
- **Primario:** `bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-2`
- **Secundario:** `bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium px-4 py-2 rounded-lg transition-colors`
- **Peligro / Destructivo:** `bg-rose-600 hover:bg-rose-700 text-white font-medium px-4 py-2 rounded-lg transition-colors`

### Tarjetas y Contenedores (`card`)
- `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6`

### Tablas y Listados
- Cabecera: `bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider px-6 py-3`
- Filas: `border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors`

### Inputs y Selectores
- `w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all`

---

## 4. Estrategia de Migración y Plan de Acción

1. **Instalación de Tailwind CSS:**
   - Instalar `tailwindcss` y `@tailwindcss/vite` (o PostCSS si aplica).
   - Configurar `vite.config.ts` y actualizar `src/index.css` con `@import "tailwindcss";`.
2. **Limpieza de Estilos Globales:**
   - Eliminar reglas CSS redundantes en `src/index.css` y `src/App.css` que entren en conflicto con Tailwind.
3. **Refactorización de Componentes:**
   - Reemplazar estilos en línea (`style={{ ... }}`) en todos los componentes (`AsistenciasView`, `IncidenciasView`, `TrabajadoresView`, `TurnosView`, modales, etc.) por clases utilitarias de Tailwind.
4. **Verificación Estricta:**
   - Ejecutar `npm run build` para validar tipados de TypeScript y ausencia de errores de compilación.

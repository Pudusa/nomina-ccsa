# Informe de Auditoría Arquitectónica: Esquema de Datos y Acoplamiento (`nomina-ccsa`)

Como Arquitecto de Bases de Datos y Desarrollador Backend Senior, este documento sintetiza el análisis exhaustivo del esquema DDL en SQLite (`server/database.cjs`) y de la capa de acceso a datos distribuida en el código fuente del monolito y los microservicios.

---

## 1. Inspección del Esquema (DDL & Índices)

El sistema utiliza **SQLite** gestionado mediante el motor síncrono de alto rendimiento `better-sqlite3`. A continuación se detalla el esquema relacional completo:

### Tablas Principales
1. **`workers` (Trabajadores)**
   - `no` (TEXT, **PRIMARY KEY**): Número de identificación único del trabajador.
   - `nombre` (TEXT): Nombre completo.
   - `default_turno` (TEXT): Turno base asignado por defecto (ej. `'Sin turno'`).

2. **`attendance` (Asistencias / Marcaciones)**
   - `id` (INTEGER, **PRIMARY KEY AUTOINCREMENT**): Identificador de marcación.
   - `worker_no` (TEXT, **FOREIGN KEY** -> `workers(no)`): Relación con el trabajador.
   - `timestamp` (TEXT): Fecha y hora ISO de la marcación biométrica/manual.
   - `location_id` (TEXT): Identificador del dispositivo o ubicación.
   - `verification` (TEXT): Método de verificación.

3. **`shift_rules` (Reglas de Turnos Excepcionales)**
   - `id` (INTEGER, **PRIMARY KEY AUTOINCREMENT**).
   - `worker_no` (TEXT, **FOREIGN KEY** -> `workers(no)`).
   - `type` (TEXT): Tipo de regla (`total` o `parcial`).
   - `turno` (TEXT): Nombre del turno aplicable.
   - `start_date` (TEXT), `end_date` (TEXT): Rango de vigencia de la regla.

4. **`shift_templates` (Plantillas de Turnos)**
   - `id` (INTEGER, **PRIMARY KEY AUTOINCREMENT**).
   - `name` (TEXT, **UNIQUE NOT NULL**): Nombre de la plantilla de turno.

5. **`shift_monthly_distributions` (Distribución Mensual de Turnos - JSON)**
   - `id` (INTEGER, **PRIMARY KEY AUTOINCREMENT**).
   - `shift_id` (INTEGER, **FOREIGN KEY** -> `shift_templates(id)` con `ON DELETE CASCADE`).
   - `year_month` (TEXT NOT NULL): Período (ej. `'2026-10'` o `'BASE'`).
   - `days_json` (TEXT NOT NULL): Estructura serializada en JSON con los días y turnos.
   - **Restricción:** `UNIQUE(shift_id, year_month)`.

6. **`users` (Usuarios del Sistema & RBAC)**
   - `id` (INTEGER, **PRIMARY KEY AUTOINCREMENT**).
   - `username` (TEXT, **UNIQUE NOT NULL**).
   - `password_hash` (TEXT NOT NULL): Hash bcrypt.
   - `role` (TEXT NOT NULL DEFAULT `'operator'`): Rol de autorización (`admin`, `operator`).

### Índices de Rendimiento (`Indexes`)
- `idx_attendance_worker_timestamp` ON `attendance(worker_no, timestamp)` (Optimiza consultas de asistencia por empleado y rango temporal).
- `idx_attendance_timestamp` ON `attendance(timestamp)` (Optimiza filtros globales por fecha).
- `idx_shift_rules_worker` ON `shift_rules(worker_no)` (Acelera la resolución de turnos por trabajador).
- `idx_shift_monthly_dist` ON `shift_monthly_distributions(shift_id, year_month)` (Búsqueda eficiente de calendarios mensuales).

---

## 2. Mapeo de Consultas (Capa de Acceso a Datos por Dominio)

| Dominio / Módulo | Tablas Involucradas | Archivos de Acceso (`Data Access`) | Operaciones SQL Principales |
| :--- | :--- | :--- | :--- |
| **Autenticación (Auth)** | `users` | `server/services/auth.service.cjs`, `services/auth-service/services/auth.service.cjs` | `SELECT * FROM users WHERE username = ?`, `INSERT INTO users (...)` |
| **Trabajadores (Workers)** | `workers`, `shift_rules`, `attendance` | `server/controllers/workers.controller.cjs`, `server/services/workers.service.cjs` | `SELECT * FROM workers`, `UPDATE workers`, `SELECT * FROM attendance WHERE worker_no = ?` |
| **Asistencia (Attendance)** | `attendance`, `workers`, `shift_rules`, `shift_templates`, `shift_monthly_distributions` | `server/controllers/attendance.controller.cjs`, `server/services/attendance.service.cjs` | `INSERT INTO attendance`, `SELECT FROM shift_templates`, joins complejos de cálculo de nómina. |
| **Turnos (Shifts)** | `shift_templates`, `shift_monthly_distributions` | `server/controllers/shifts.controller.cjs` | CRUD de plantillas y UPSERT en distribuciones JSON mensuales. |

---

## 3. Informe de Acoplamiento de Datos (Data Coupling Report)

1. **Nivel de Acoplamiento Actual (Patrón Strangler Fig en Transición):**
   - **Dominio de Auth:** Completamente modularizado en código para residir en el microservicio (`auth-service`), pero actualmente acoplado a nivel de infraestructura física por compartir el volumen Docker/K8s (`db_data`) y apuntar al mismo archivo `nomina.db` en SQLite.
   - **Dominio de Operaciones (Workers, Attendance, Shifts):** Altamente cohesionado y acoplado dentro del monolito (`nomina-monolith`). Las consultas cruzan frecuentemente `workers`, `attendance` y `shift_rules` en una sola transacción local de SQLite.

2. **Cuellos de Botella y Puntos de Fricción Identificados:**
   - **Concurrencia de Escritura en SQLite:** Dado que SQLite bloquea la base de datos durante operaciones de escritura (`BEGIN EXCLUSIVE`), las peticiones masivas concurrentes de marcaje biométrico y consultas de nómina desde el monolito hacia la misma base que consulta el `auth-service` pueden generar contención de I/O a escala masiva.
   - **Dependencias Cruzadas en Controladores:** Algunos controladores del monolito (`workers.controller.cjs`) consultan simultáneamente tablas de trabajadores, reglas de turnos y asistencias, lo que dificulta extraer el dominio de trabajadores a un microservicio independiente sin introducir una API interna de comunicación inter-servicio (gRPC o HTTP REST).

3. **Recomendación Arquitectónica (Siguientes Pasos):**
   - **Fase de Transición Actual:** Mantener SQLite con volumen compartido y respaldos automáticos diarios (`server/backups/`) funciona perfectamente para cargas medianas.
   - **Escalamiento Futuro (Si se requiere separación total de bases de datos):** Migrar el microservicio de autenticación a su propia base de datos dedicada (ej. PostgreSQL o una instancia SQLite independiente) y exponer endpoints gRPC/REST para la validación de tokens, aislando completamente las credenciales del dominio operativo de nómina.

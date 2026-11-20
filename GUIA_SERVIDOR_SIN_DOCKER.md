# Guía de despliegue en servidor SIN Docker

Esta guía asume que el servidor tiene **Node.js 20+** y **nginx** instalados, y que
ya hiciste `git fetch origin && git reset --hard origin/main` (ver guía anterior).
El historial fue reescrito: **nunca uses `git pull`**.

---

## 0. Respaldo (las BDs no están en Git)

```bash
cd /ruta/al/proyecto
mkdir -p ~/backup-nomina
cp -a data/ ~/backup-nomina/
cp .env ~/backup-nomina/ 2>/dev/null || true
```

---

## 1. Variables de entorno

El `.env` real no viene de Git. Si ya existe, déjalo. Si es servidor nuevo:

```bash
cp .env.example .env
nano .env    # JWT_SECRET + contraseñas seed
```

Además, sin Docker las llamadas internas **no** resuelven `workers-service` ni
`shifts-service` (eso es DNS de Docker). Exporta estas variables antes de
arrancar (o añádelas al `.env`):

```bash
export WORKERS_SERVICE_URL=http://127.0.0.1:3002
export SHIFTS_SERVICE_URL=http://127.0.0.1:3004
```

> `internal-api.cjs` ya lee estas variables; por defecto apunta a los nombres
> de contenedor, que sin Docker fallarían.

---

## 2. Instalar dependencias (una vez)

Cada microservicio tiene su propio `package.json`:

```bash
for s in auth-service workers-service attendance-service shifts-service; do
  (cd services/$s && npm install --omit=dev)
done

# Dependencias del frontend para compilarlo
npm install
```

Nota: `better-sqlite3` necesita compilar un módulo nativo. En el servidor debe
haber `python3`, `make` y un compilador C++ (`g++` / `build-essential`).

---

## 3. Base de datos

No hay auto-seed: los servicios leen lo que haya en `data/`. Verifica que los
archivos estén ahí:

```bash
ls -la data/
# attendance.sqlite  auth.sqlite  shifts.sqlite  workers.sqlite
```

Si es un servidor nuevo, carga los datos con tu **script de población masiva**
antes de arrancar.

---

## 4. Arrancar los 4 microservicios

Cada `server.cjs` escucha en `0.0.0.0`. Arráncalos en background con logs:

```bash
mkdir -p logs

JWT_SECRET="TU_SECRETO" \
  node services/auth-service/server.cjs > logs/auth.log 2>&1 &

JWT_SECRET="TU_SECRETO" \
  node services/workers-service/server.cjs > logs/workers.log 2>&1 &

JWT_SECRET="TU_SECRETO" \
  WORKERS_SERVICE_URL=http://127.0.0.1:3002 \
  SHIFTS_SERVICE_URL=http://127.0.0.1:3004 \
  node services/attendance-service/server.cjs > logs/attendance.log 2>&1 &

JWT_SECRET="TU_SECRETO" \
  node services/shifts-service/server.cjs > logs/shifts.log 2>&1 &
```

Puertos: auth 3001, workers 3002, attendance 3003, shifts 3004.

> Para que sobrevivan a un reinicio, usa `systemd` o `pm2`. Ejemplo con pm2:
> `pm2 start services/auth-service/server.cjs --name auth --env JWT_SECRET=...`

Verifica que respondan:

```bash
for p in 3001 3002 3003 3004; do curl -s localhost:$p/health; echo; done
```

---

## 5. Compilar el frontend

```bash
npm run build      # genera dist/
```

---

## 6. Configurar nginx (reemplaza al gateway)

El `gateway/nginx.conf` usa nombres de contenedor. Cópialo y cambia los `upstream`:

```bash
sudo cp gateway/nginx.conf /etc/nginx/sites-available/nomina
sudo nano /etc/nginx/sites-available/nomina
```

Cambia estos bloques:

```
upstream workers_service    { server 127.0.0.1:3002; }
upstream shifts_service     { server 127.0.0.1:3004; }
upstream auth_service       { server 127.0.0.1:3001; }
upstream attendance_service { server 127.0.0.1:3003; }
```

Y asegúrate de que la raíz estática apunte al build:

```
root /ruta/al/proyecto/dist;
```

Activa el sitio:

```bash
sudo ln -s /etc/nginx/sites-available/nomina /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

El sitio queda en `http://TU_SERVIDOR:4000` (o el puerto que configures).

---

## 7. Verificación final

```bash
curl http://localhost:4000/health
# {"status":"ok","gateway":"nginx"}

for p in 3001 3002 3003 3004; do curl -s localhost:$p/ready; echo; done
tail -f logs/*.log
```

---

## Resumen rápido

```bash
cd /ruta/al/proyecto
git fetch origin && git reset --hard origin/main
for s in auth-service workers-service attendance-service shifts-service; do (cd services/$s && npm install --omit=dev); done
npm install && npm run build
# exportar JWT_SECRET, WORKERS_SERVICE_URL, SHIFTS_SERVICE_URL
# arrancar los 4 node ... & ; configurar nginx ; sudo nginx -t && sudo systemctl reload nginx
```

---

## Diferencias respecto a Docker (para no olvidar)

| Con Docker | Sin Docker (esta guía) |
|---|---|
| `docker compose up -d --build` | `node services/*/server.cjs &` (o pm2/systemd) |
| DNS `workers-service:3002` | `127.0.0.1:3002` vía variables de entorno |
| Gateway nginx en contenedor | nginx del host apuntando a `dist/` y a 127.0.0.1 |
| `env_file: .env` de compose | exportar variables en la shell / servicio |
| `restart: unless-stopped` | pm2/systemd para reiniciar |

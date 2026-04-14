# SGIAC-ISC
**Sistema de Gestión de Inventarios de Activos y Consumibles**  
Área de Ingeniería en Sistemas Computacionales — Tecnológico Superior de Jalisco, Unidad Académica La Huerta

---

## ¿Qué es este sistema?

SGIAC-ISC es una aplicación web para administrar, controlar y dar seguimiento a los recursos materiales del Área de ISC. Permite gestionar activos, consumibles, solicitudes de préstamo, reservas de laboratorio y generar reportes de actividad.

### Funcionalidades principales

- Registro y clasificación de activos y consumibles por categoría
- Control de préstamos y devoluciones con seguimiento de estado
- Gestión de solicitudes con flujo de aprobación/rechazo
- Reserva de laboratorios de cómputo
- Bitácoras de actividad y reportes administrativos
- Actualizaciones en tiempo real vía Server-Sent Events
- Control de acceso por roles (Administrador, Docente, Alumno)

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML, CSS, JavaScript vanilla |
| Backend | Node.js + Express |
| Base de datos | Supabase (PostgreSQL) |
| Servidor web | Nginx |
| Contenedores | Docker + Docker Compose |

---

## Requisitos previos

Antes de clonar el proyecto necesitas tener instalado:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — incluye Docker y Docker Compose
- [Git](https://git-scm.com/downloads)
- Una cuenta en [Supabase](https://supabase.com) con un proyecto creado

> No necesitas instalar Node.js ni Nginx por separado — Docker los maneja automáticamente.

---

## Instalación y configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/Inventario-Activos-ISC-Victor.git
cd Inventario-Activos-ISC-Victor
```

### 2. Configurar las variables de entorno

```bash
cp .env.example backend/.env
```

Abre el archivo `backend/.env` y rellena tus credenciales de Supabase:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_service_role_key_aqui
```

> **¿Dónde encuentro estas llaves?**  
> En tu proyecto de Supabase ve a: **Project Settings → API**  
> - `SUPABASE_URL` → Project URL  
> - `SUPABASE_KEY` → service_role (secret)

### 3. Levantar el proyecto con Docker

```bash
docker-compose up --build
```

La primera vez tarda unos minutos mientras descarga las imágenes. Las siguientes veces es más rápido.

### 4. Acceder al sistema

Una vez que Docker termine de levantar los contenedores, abre tu navegador en:

```
http://localhost:8080
```

Para detener el sistema:

```bash
docker-compose down
```

---

## Credenciales de prueba

El sistema incluye usuarios de demostración para probar cada rol:

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Administrador | adminOmar@gmail.com | Admin123 |
| Docente | juan.rodriguez@lahuerta.tecmm.edu.mx | Docente123 |
| Alumno | hu230111608@lahuerta.tecmm.edu.mx | Alumno123 |

> Estas credenciales funcionan sobre la base de datos de Supabase configurada en tu `.env`. Si usas tu propia instancia de Supabase, necesitas crear estos usuarios desde el panel o ejecutar `backend/db/schema.sql`.

---

## Estructura del proyecto

```
Inventario-Activos-ISC-Victor/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── supabase.js
│   │   ├── middlewares/
│   │   │   └── auth.middleware.js
│   │   └── modules/
│   │       ├── auth/
│   │       ├── assets/
│   │       ├── categories/
│   │       ├── consumibles/
│   │       ├── events/
│   │       ├── requests/
│   │       ├── reservations/
│   │       ├── stats/
│   │       └── users/
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── public/         ← HTML y assets estáticos
│   │   └── js/             ← Scripts por página
│   ├── nginx.conf
│   └── Dockerfile
├── .env.example            ← Plantilla de variables de entorno
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

## Solución de problemas comunes

**El contenedor del backend no levanta**  
Verifica que `backend/.env` existe y tiene las variables correctas. Puedes ver el error exacto con:
```bash
docker-compose logs backend
```

**La página no carga en localhost:8080**  
Asegúrate de que Docker Desktop esté corriendo y que el puerto 8080 no esté ocupado por otra aplicación.

**Error de conexión con Supabase**  
Confirma que `SUPABASE_URL` y `SUPABASE_KEY` son correctas. La `SUPABASE_KEY` debe ser la `service_role`, no la `anon`.

---

## Alcance del sistema

> **Fuera del alcance:** gestión financiera, procesos de compra institucional e integración con sistemas externos ajenos al control académico del área.

---

## Institución

Tecnológico Superior de Jalisco — Unidad Académica La Huerta  
Área de Ingeniería en Sistemas Computacionales
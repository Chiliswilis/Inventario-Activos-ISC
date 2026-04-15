
# Inventario-Activos-ISC
Sistema de inventario de activos y consumibles para el área de Ingeniería en Sistemas 
=======
# SGIAC-ISC
**Sistema de Gestión de Inventarios de Activos y Consumibles**  
Área de Ingeniería en Sistemas Computacionales — Tecnológico Superior de Jalisco, Unidad Académica La Huerta

---

## Introducción

Este repositorio contiene la Especificación de Requerimientos de Software (ERS) del **SGIAC-ISC**. El documento establece de manera clara y precisa los requerimientos funcionales y no funcionales del sistema, sirviendo como base para su análisis, diseño, desarrollo y validación.

Está dirigido a estudiantes desarrolladores, docentes responsables del proyecto y personal administrativo del área, quienes utilizarán este documento como referencia durante el ciclo de vida del sistema.

---

## Propósito

Definir y detallar los requerimientos del sistema SGIAC-ISC, especificando de forma estructurada las funcionalidades, restricciones y atributos de calidad que el sistema debe cumplir, garantizando una correcta interpretación durante las etapas de:

- Diseño
- Desarrollo
- Pruebas
- Implementación

---

## Alcance

El sistema abarca la **administración, control y seguimiento** de los recursos materiales del Área de ISC, incluyendo:

- Registro y clasificación de activos y consumibles
- Control de entradas y salidas de inventario
- Gestión de solicitudes y préstamos de materiales
- Reserva de laboratorios de cómputo
- Generación de bitácoras y reportes académicos/administrativos

> **Fuera del alcance:** gestión financiera, procesos de compra institucional e integración con sistemas externos ajenos al control académico.

---

## Audiencia

| Rol | Uso del documento |
|-----|-------------------|
| Estudiantes desarrolladores | Referencia técnica para desarrollo |
| Docentes responsables | Supervisión y validación del sistema |
| Personal administrativo | Consulta de funcionalidades y alcance |
<<<<<<< HEAD
>>>>>>> d66b2a9 (WIP: cambios iniciales antes de ir a mi rama personal)
=======

## Credenciales de acceso

<<<<<<< HEAD
| Rol | Usuario | Contraseña |
| Administrador | adminOmar@gmail.com | Admin123 |
| Docente | juan.rodriguez@lahuerta.tecmm.edu.mx | Docente123 |
| Alumno | hu230111608@lahuerta.tecmm.edu.mx | Alumno123 |
=======
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
| Administrador | admin.example@gmail.com | Admin123 |
| Docente | docente.example@gmail.com | Docente123 |
| Alumno | alumno.example@gmail.com | Alumno123 |

# Para clonar el repositorio, las instrucciones serán:
cp .env.example backend/.env
# Editar backend/.env con sus propias llaves de Supabase
docker-compose up --build

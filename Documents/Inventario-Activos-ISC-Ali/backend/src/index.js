// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

// Routers
const assetsRouter = require("./assets"); // tu CRUD de activos
const authRouter = require("./auth");     // tu login
// const otrosRouters = ... si tienes

// Middleware
app.use(cors());
app.use(express.json());

// Rutas
app.use("/assets", assetsRouter);
app.use("/auth", authRouter);
// app.use("/usuarios", usersRouter), etc.

// Servir frontend (opcional si quieres)
app.use(express.static("public")); // si pones tus HTML en public/

// Levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
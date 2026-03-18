require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const path    = require("path");

const authRoutes         = require("./src/auth");
const assetsRoutes       = require("./src/assets");
const categoriesRoutes   = require("./src/categories");
const usersRoutes        = require("./src/users");
const consumiblesRoutes  = require("./src/consumibles");
const statsRoutes        = require("./src/stats");
const requestsRoutes     = require("./src/requests");
const reservationsRoutes = require("./src/reservations");

const app = express();

app.use(cors());
app.use(express.json());

// ── API ROUTES ──
app.use("/api/auth",         authRoutes);
app.use("/api/assets",       assetsRoutes);
app.use("/api/categories",   categoriesRoutes);
app.use("/api/users",        usersRoutes);
app.use("/api/consumibles",  consumiblesRoutes);
app.use("/api/stats",        statsRoutes);
app.use("/api/requests",     requestsRoutes);
app.use("/api/reservations", reservationsRoutes);

// ── SERVIR FRONTEND ESTÁTICO ──
// Express sirve los archivos del frontend desde ../frontend/src
app.use(express.static(path.join(__dirname, "../frontend/src")));
app.use("/public", express.static(path.join(__dirname, "../frontend/public")));

// Cualquier ruta que no sea /api/ devuelve el login
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/src/login.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
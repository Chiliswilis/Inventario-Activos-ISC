require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const supabase = require("./src/config/supabase");


const assetsRoutes       = require("./src/assets");


const consumiblesRoutes  = require("./src/consumibles");

const requestsRoutes     = require("./src/requests");
const reservationsRoutes = require("./src/reservations");

//Nuevos
const eventsRouter = require("./src/modules/events/events.routes");
const usersRoutes  = require("./src/modules/users/users.routes");
const categoriesRoutes = require("./src/modules/categories/categories.routes");
const authRoutes = require("./src/modules/auth/auth.routes");


const statsRoutes = require("./src/modules/stats/stats.routes");


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
app.use("/api/events",       eventsRouter);

// ── LABS (catálogo dinámico de laboratorios) ──
app.get("/api/labs", async (req, res) => {
  const { data, error } = await supabase
    .from("labs")
    .select("id, edificio, nombre, capacidad, open_time, close_time")
    .eq("activo", true)
    .order("edificio")
    .order("nombre");
  if (error) return res.status(500).json(error);
  res.json(data);
});

// ── FRONTEND ESTÁTICO ──
app.use(express.static(path.join(__dirname, "../frontend/src")));
app.use("/public", express.static(path.join(__dirname, "../frontend/public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/src/login.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
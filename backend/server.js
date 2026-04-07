require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const supabase = require("./src/config/supabase");

// ── Middlewares ──
const { requireAuth, requireRole } = require("./src/middlewares/auth.middleware");

// ── Módulos ──
const authRoutes         = require("./src/modules/auth/auth.routes");
const assetsRoutes       = require("./src/modules/assets/assets.routes");
const categoriesRoutes   = require("./src/modules/categories/categories.routes");
const consumiblesRoutes  = require("./src/modules/consumibles/consumibles.routes");
const eventsRouter       = require("./src/modules/events/events.routes");
const requestsRoutes     = require("./src/modules/requests/requests.routes");
const reservationsRoutes = require("./src/modules/reservations/reservations.routes");
const statsRoutes        = require("./src/modules/stats/stats.routes");
const usersRoutes        = require("./src/modules/users/users.routes");

const app = express();
app.use(cors());
app.use(express.json());

// ── Rutas públicas (sin auth) ──
app.use("/api/auth", authRoutes);

// ── Rutas protegidas ──
app.use("/api/assets",       requireAuth, assetsRoutes);
app.use("/api/categories",   requireAuth, categoriesRoutes);
app.use("/api/consumibles",  requireAuth, consumiblesRoutes);
app.use("/api/requests",     requireAuth, requestsRoutes);
app.use("/api/reservations", requireAuth, reservationsRoutes);
app.use("/api/stats",        requireAuth, statsRoutes);
app.use("/api/users",        requireAuth, requireRole("administrador"), usersRoutes);
app.use("/api/events",       eventsRouter);

// ── Labs (catálogo dinámico) ──
app.get("/api/labs", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("labs")
    .select("id, edificio, nombre, capacidad, open_time, close_time")
    .eq("activo", true)
    .order("edificio")
    .order("nombre");
  if (error) return res.status(500).json(error);
  res.json(data);
});

// ── Frontend estático ──
app.use(express.static(path.join(__dirname, "../frontend/src")));
app.use("/public", express.static(path.join(__dirname, "../frontend/public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/src/login.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
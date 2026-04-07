const express  = require("express");
const router   = express.Router();
const supabase = require("./config/supabase");

router.get("/", async (req, res) => {
  try {

    // Total activos
    const { count: totalAssets } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true });

    // Total consumibles
    const { count: totalConsumables } = await supabase
      .from("consumables")
      .select("*", { count: "exact", head: true });

    // Total solicitudes pendientes
    const { count: totalRequests } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // Reservas de hoy
    const today     = new Date();
    const startDay  = new Date(today.setHours(0,0,0,0)).toISOString();
    const endDay    = new Date(today.setHours(23,59,59,999)).toISOString();

    const { count: todayReservations } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .gte("start_time", startDay)
      .lte("start_time", endDay);

    // Últimos movimientos (últimos 5 activos modificados)
    const { data: lastMovements } = await supabase
      .from("assets")
      .select("id, name, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5);

    // Actividad reciente (últimos 5 logs)
    const { data: recentActivity } = await supabase
      .from("logs")
      .select("id, action, table_name, timestamp")
      .order("timestamp", { ascending: false })
      .limit(5);

    res.json({
      totalAssets:        totalAssets      || 0,
      totalConsumables:   totalConsumables || 0,
      totalRequests:      totalRequests    || 0,
      todayReservations:  todayReservations|| 0,
      lastMovements:      lastMovements    || [],
      recentActivity:     recentActivity   || []
    });

  } catch (err) {
    console.error("Error stats:", err);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

module.exports = router;
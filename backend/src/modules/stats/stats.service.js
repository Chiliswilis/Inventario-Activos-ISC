const supabase = require("../../config/supabase");

const getStats = async () => {
  const { count: totalAssets } = await supabase
    .from("assets")
    .select("*", { count: "exact", head: true });

  const { count: totalConsumables } = await supabase
    .from("consumables")
    .select("*", { count: "exact", head: true });

  const { count: totalRequests } = await supabase
    .from("requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const today    = new Date();
  const startDay = new Date(today.setHours(0,0,0,0)).toISOString();
  const endDay   = new Date(today.setHours(23,59,59,999)).toISOString();

  const { count: todayReservations } = await supabase
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .gte("start_time", startDay)
    .lte("start_time", endDay);

  // ── Últimos activos modificados ──────────────────────────────────────────
  const { data: rawAssets } = await supabase
    .from("assets")
    .select("id, name, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  // Para activos "borrowed", buscar qué alumno tiene la solicitud aprobada
  const borrowedIds = (rawAssets || [])
    .filter(a => a.status === "borrowed")
    .map(a => a.id);

  // Mapa { asset_id → username }
  const userByAsset = {};

  if (borrowedIds.length > 0) {
    // 1) Solicitudes multi-ítem (tabla request_items)
    const { data: itemRows } = await supabase
      .from("request_items")
      .select("asset_id, requests!inner(status, users!requests_user_id_fkey(id, username))")
      .in("asset_id", borrowedIds)
      .eq("requests.status", "approved");

    (itemRows || []).forEach(row => {
      const username = row.requests?.users?.username;
      if (username) userByAsset[row.asset_id] = username;
    });

    // 2) Solicitudes directas con asset_id (legacy)
    const missingIds = borrowedIds.filter(id => !userByAsset[id]);
    if (missingIds.length > 0) {
      const { data: directRows } = await supabase
        .from("requests")
        .select("asset_id, users!requests_user_id_fkey(id, username)")
        .in("asset_id", missingIds)
        .eq("status", "approved");

      (directRows || []).forEach(row => {
        const username = row.users?.username;
        if (username) userByAsset[row.asset_id] = username;
      });
    }
  }

  // Combinar: cada activo lleva el username si está prestado
  const lastMovements = (rawAssets || []).map(a => ({
    ...a,
    username: userByAsset[a.id] || null
  }));
  // ────────────────────────────────────────────────────────────────────────

  const { data: recentActivity } = await supabase
    .from("logs")
    .select("id, action, table_name, timestamp")
    .order("timestamp", { ascending: false })
    .limit(5);

  return {
    totalAssets:       totalAssets       || 0,
    totalConsumables:  totalConsumables  || 0,
    totalRequests:     totalRequests     || 0,
    todayReservations: todayReservations || 0,
    lastMovements:     lastMovements     || [],
    recentActivity:    recentActivity    || []
  };
};

module.exports = { getStats };
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

  const { data: lastMovements } = await supabase
    .from("assets")
    .select("id, name, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

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
const supabase = require("../../config/supabase");

/**
 * GET /api/audit-logs
 * Query params: module, action, userId, from, to, limit (default 200)
 * Solo accesible por administrador (verificado en routes)
 */
async function getAll(req, res) {
  try {
    const { module, action, userId, from, to, limit = 200 } = req.query;

    let query = supabase
      .from("audit_logs")
      .select(`
        id, created_at, action, module, record_id,
        description, old_value, new_value,
        ip_address, user_agent, user_role,
        users ( id, username, email, role )
      `)
      .order("created_at", { ascending: false })
      .limit(Number(limit));

    if (module) query = query.eq("module", module);
    if (action) query = query.eq("action", action);
    if (userId) query = query.eq("user_id", userId);
    if (from)   query = query.gte("created_at", from);
    if (to)     query = query.lte("created_at", to);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error("Error audit-logs:", err);
    res.status(500).json({ message: "Error al obtener logs" });
  }
}

module.exports = { getAll };
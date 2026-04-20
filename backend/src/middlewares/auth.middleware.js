const supabase = require("../config/supabase");

async function requireAuth(req, res, next) {
  try {
    const userId = req.headers["x-user-id"];

    if (!userId)
      return res.status(401).json({ error: "No autenticado" });

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, email, role")
      .eq("id", userId)
      .single();

    if (error || !user)
      return res.status(401).json({ error: "Sesión inválida" });

    req.user = user;
    next();
  } catch (err) {
    console.error("Error middleware auth:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
}

/**
 * Middleware de autorización por rol.
 * Uso: requireRole("administrador")
 *      requireRole(["administrador", "docente"])
 * Siempre debe ir DESPUÉS de requireAuth.
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ error: "No autenticado" });

    if (!allowed.includes(req.user.role))
      return res.status(403).json({ error: "No tienes permiso para esta acción" });

    next();
  };
}

module.exports = { requireAuth, requireRole };
const supabase = require("../../config/supabase");

/**
 * Registra una acción en la tabla audit_logs.
 * @param {Object} opts
 * @param {number}  opts.userId     - ID del usuario que realiza la acción
 * @param {string}  opts.userRole   - Rol del usuario
 * @param {string}  opts.action     - 'LOGIN'|'LOGOUT'|'CREATE'|'UPDATE'|'DELETE'|'STATUS_CHANGE'
 * @param {string}  opts.module     - 'auth'|'solicitudes'|'reservas'|'activos'|'consumibles'
 * @param {number}  [opts.recordId] - ID del registro afectado
 * @param {string}  opts.description- Texto legible del evento
 * @param {Object}  [opts.oldValue] - Estado anterior (para UPDATE/STATUS_CHANGE)
 * @param {Object}  [opts.newValue] - Estado nuevo
 * @param {Object}  [opts.req]      - Express request (para IP y user-agent)
 */
async function logAction({ userId, userRole, action, module, recordId, description, oldValue, newValue, req }) {
  try {
    await supabase.from("audit_logs").insert({
      user_id:     userId     || null,
      user_role:   userRole   || null,
      action,
      module,
      record_id:   recordId   || null,
      description,
      old_value:   oldValue   ? oldValue   : null,
      new_value:   newValue   ? newValue   : null,
      ip_address:  req?.ip    || req?.headers?.["x-forwarded-for"] || null,
      user_agent:  req?.headers?.["user-agent"] || null,
    });
  } catch (err) {
    // Los logs nunca deben romper el flujo principal
    console.error("[AUDIT] Error al registrar log:", err.message);
  }
}

module.exports = { logAction };
const requestsService = require("./requests.service");
const { logAction }   = require("../audit/audit.service");

/* ── LISTAR ── */
async function getAll(req, res) {
  try {
    const data = await requestsService.getAll(req.query);
    res.json(data);
  } catch (err) {
    console.error("Error listar solicitudes:", err);
    res.status(err.status || 500).json(err);
  }
}

/* ── OBTENER POR ID ── */
async function getById(req, res) {
  try {
    const data = await requestsService.getById(req.params.id);
    res.json(data);
  } catch (err) {
    console.error("Error obtener solicitud:", err);
    res.status(err.status || 500).json({ message: err.message });
  }
}

/* ── CREAR ── */
async function create(req, res) {
  try {
    const { user_id, fecha_solicitud, hora_solicitud } = req.body;
    if (!user_id)         return res.status(400).json({ message: "user_id es obligatorio" });
    if (!fecha_solicitud) return res.status(400).json({ message: "La fecha de solicitud es obligatoria" });
    if (!hora_solicitud)  return res.status(400).json({ message: "La hora de solicitud es obligatoria" });

    const data = await requestsService.create(req.body);

    const items = req.body.items?.map(i => i.name || i.asset_id || i.consumable_id).join(", ") || "—";
    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "CREATE",
      module:      "solicitudes",
      recordId:    data?.id,
      description: `Nueva solicitud #${data?.id} creada por usuario ${user_id} — Propósito: "${req.body.purpose || "—"}" — Ítems: ${items}`,
      newValue:    { user_id, purpose: req.body.purpose, fecha_solicitud, items: req.body.items },
      req,
    });

    res.json(data);
  } catch (err) {
    console.error("Error crear solicitud:", err);
    res.status(err.status || 500).json({ message: err.message });
  }
}

/* ── APROBAR ── */
async function approve(req, res) {
  try {
    const { pickup_date, pickup_location } = req.body;
    if (!pickup_date || !pickup_location)
      return res.status(400).json({ message: "pickup_date y pickup_location son obligatorios" });

    const data = await requestsService.approve(req.params.id, req.body);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "STATUS_CHANGE",
      module:      "solicitudes",
      recordId:    Number(req.params.id),
      description: `Aprobó solicitud #${req.params.id} — Entrega: ${pickup_date} en ${pickup_location}`,
      oldValue:    { status: "pending_admin" },
      newValue:    { status: "approved", pickup_date, pickup_location },
      req,
    });

    res.json(data);
  } catch (err) {
    console.error("Error aprobar solicitud:", err);
    res.status(err.status || 500).json(err);
  }
}

/* ── RECHAZAR ── */
async function reject(req, res) {
  try {
    const data = await requestsService.reject(req.params.id, req.body);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "STATUS_CHANGE",
      module:      "solicitudes",
      recordId:    Number(req.params.id),
      description: `Rechazó solicitud #${req.params.id} — Motivo: "${req.body.reason || req.body.admin_message || "—"}"`,
      oldValue:    { status: "pending_admin" },
      newValue:    { status: "rejected", reason: req.body.reason || req.body.admin_message },
      req,
    });

    res.json(data);
  } catch (err) {
    console.error("Error rechazar solicitud:", err);
    res.status(err.status || 500).json(err);
  }
}

/* ── DEVOLUCIÓN ── */
async function returnRequest(req, res) {
  try {
    const data = await requestsService.returnRequest(req.params.id, req.body);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "STATUS_CHANGE",
      module:      "solicitudes",
      recordId:    Number(req.params.id),
      description: `Marcó devolución de solicitud #${req.params.id}${req.body.notes ? ` — Notas: "${req.body.notes}"` : ""}`,
      oldValue:    { status: "approved" },
      newValue:    { status: "returned" },
      req,
    });

    res.json(data);
  } catch (err) {
    console.error("Error devolución:", err);
    res.status(err.status || 500).json(err);
  }
}

/* ── ACTUALIZAR ── */
async function update(req, res) {
  try {
    const { status, purpose, notes, items, fecha_solicitud } = req.body;
    const hasContentEdit = purpose !== undefined || notes !== undefined || items !== undefined || fecha_solicitud !== undefined;
    if (!hasContentEdit && !status)
      return res.status(400).json({ message: "status o campos editables son obligatorios" });

    const data = await requestsService.update(req.params.id, req.body);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      status ? "STATUS_CHANGE" : "UPDATE",
      module:      "solicitudes",
      recordId:    Number(req.params.id),
      description: status
        ? `Cambió estado de solicitud #${req.params.id} a "${status}"`
        : `Editó solicitud #${req.params.id}${purpose ? ` — Propósito: "${purpose}"` : ""}`,
      newValue:    req.body,
      req,
    });

    res.json(data);
  } catch (err) {
    console.error("Error actualizar solicitud:", err);
    res.status(err.status || 500).json({ message: err.message });
  }
}

/* ── ELIMINAR ── */
async function remove(req, res) {
  try {
    // Obtener datos antes de eliminar para el log
    const existing = await requestsService.getById(req.params.id).catch(() => null);
    const result   = await requestsService.remove(req.params.id);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "DELETE",
      module:      "solicitudes",
      recordId:    Number(req.params.id),
      description: `Eliminó solicitud #${req.params.id}${existing?.purpose ? ` — "${existing.purpose}"` : ""}`,
      oldValue:    existing ? { status: existing.status, purpose: existing.purpose } : null,
      req,
    });

    res.json(result);
  } catch (err) {
    console.error("Error eliminar solicitud:", err);
    res.status(err.status || 500).json(err);
  }
}

module.exports = { getAll, getById, create, approve, reject, returnRequest, update, remove };
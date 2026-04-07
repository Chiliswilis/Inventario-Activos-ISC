const requestsService = require("./requests.service");

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
    if (!user_id)          return res.status(400).json({ message: "user_id es obligatorio" });
    if (!fecha_solicitud)  return res.status(400).json({ message: "La fecha de solicitud es obligatoria" });
    if (!hora_solicitud)   return res.status(400).json({ message: "La hora de solicitud es obligatoria" });

    const data = await requestsService.create(req.body);
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
    res.json(data);
  } catch (err) {
    console.error("Error actualizar solicitud:", err);
    res.status(err.status || 500).json({ message: err.message });
  }
}

/* ── ELIMINAR ── */
async function remove(req, res) {
  try {
    const result = await requestsService.remove(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("Error eliminar solicitud:", err);
    res.status(err.status || 500).json(err);
  }
}

module.exports = { getAll, getById, create, approve, reject, returnRequest, update, remove };
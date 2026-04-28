const service       = require("./reservations.service");
const { logAction } = require("../audit/audit.service");

const getAll = async (req, res) => {
  try { res.json(await service.getAll(req.query)); }
  catch (err) { res.status(500).json(err); }
};

const getById = async (req, res) => {
  try { res.json(await service.getById(req.params.id)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const create = async (req, res) => {
  const { alumno_id, docente_id, lab_id, fecha_uso, hora_inicio, hora_fin, proposito } = req.body;
  if (!alumno_id)  return res.status(400).json({ message: "alumno_id es obligatorio" });
  if (!docente_id) return res.status(400).json({ message: "docente_id es obligatorio" });
  if (!lab_id)     return res.status(400).json({ message: "lab_id es obligatorio" });
  if (!fecha_uso || !hora_inicio || !hora_fin)
    return res.status(400).json({ message: "Fecha y horario son obligatorios" });
  if (!proposito)  return res.status(400).json({ message: "El propósito es obligatorio" });

  try {
    const data = await service.create(req.body);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "CREATE",
      module:      "reservas",
      recordId:    data?.id,
      description: `Nueva reserva #${data?.id} — Lab ID: ${lab_id} · ${fecha_uso} ${hora_inicio}–${hora_fin} — Propósito: "${proposito}" — Alumno ID: ${alumno_id}`,
      newValue:    { alumno_id, docente_id, lab_id, fecha_uso, hora_inicio, hora_fin, proposito },
      req,
    });

    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "UPDATE",
      module:      "reservas",
      recordId:    Number(req.params.id),
      description: `Editó reserva #${req.params.id}${req.body.fecha_uso ? ` — Nueva fecha: ${req.body.fecha_uso} ${req.body.hora_inicio || ""}–${req.body.hora_fin || ""}` : ""}`,
      newValue:    req.body,
      req,
    });

    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const approve = async (req, res) => {
  const { grupo, semestre } = req.body;
  if (!grupo || !semestre)
    return res.status(400).json({ message: "grupo y semestre son obligatorios" });

  try {
    const data = await service.approve(req.params.id, req.body);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "STATUS_CHANGE",
      module:      "reservas",
      recordId:    Number(req.params.id),
      description: `Aprobó reserva #${req.params.id} — Grupo: ${grupo}, Semestre: ${semestre}`,
      oldValue:    { status: "pending" },
      newValue:    { status: "approved", grupo, semestre },
      req,
    });

    res.json(data);
  } catch (err) { res.status(500).json(err); }
};

const occupy = async (req, res) => {
  try {
    const data = await service.occupy(req.params.id);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "STATUS_CHANGE",
      module:      "reservas",
      recordId:    Number(req.params.id),
      description: `Marcó reserva #${req.params.id} como EN USO (entrada al laboratorio)`,
      oldValue:    { status: "approved" },
      newValue:    { status: "occupied" },
      req,
    });

    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const release = async (req, res) => {
  try {
    const data = await service.release(req.params.id, req.body);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "STATUS_CHANGE",
      module:      "reservas",
      recordId:    Number(req.params.id),
      description: `Liberó (firma de salida) reserva #${req.params.id}${req.body.observaciones ? ` — Observaciones: "${req.body.observaciones}"` : ""}`,
      oldValue:    { status: "occupied" },
      newValue:    { status: "released", ...req.body },
      req,
    });

    res.json(data);
  } catch (err) { res.status(500).json(err); }
};

const cancel = async (req, res) => {
  try {
    const data = await service.cancel(req.params.id, req.body);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "STATUS_CHANGE",
      module:      "reservas",
      recordId:    Number(req.params.id),
      description: `Canceló/rechazó reserva #${req.params.id}${req.body.docente_message ? ` — Motivo: "${req.body.docente_message}"` : ""}`,
      oldValue:    { status: "pending" },
      newValue:    { status: "cancelled", motivo: req.body.docente_message },
      req,
    });

    res.json(data);
  } catch (err) { res.status(500).json(err); }
};

const remove = async (req, res) => {
  try {
    // Capturar datos antes de eliminar
    const existing = await service.getById(req.params.id).catch(() => null);
    await service.remove(req.params.id);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "DELETE",
      module:      "reservas",
      recordId:    Number(req.params.id),
      description: `Eliminó reserva #${req.params.id}${existing?.lab?.nombre ? ` — Lab: ${existing.lab.nombre} · ${existing.fecha_uso || ""}` : ""}`,
      oldValue:    existing ? { status: existing.status, lab_id: existing.lab_id, fecha_uso: existing.fecha_uso } : null,
      req,
    });

    res.json({ message: "Reserva eliminada" });
  } catch (err) { res.status(500).json(err); }
};

module.exports = { getAll, getById, create, update, approve, occupy, release, cancel, remove };
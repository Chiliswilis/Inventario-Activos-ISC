const service = require("./reservations.service");

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
  if (!fecha_uso || !hora_inicio || !hora_fin) return res.status(400).json({ message: "Fecha y horario son obligatorios" });
  if (!proposito)  return res.status(400).json({ message: "El propósito es obligatorio" });
  try { res.json(await service.create(req.body)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const approve = async (req, res) => {
  const { grupo, semestre } = req.body;
  if (!grupo || !semestre) return res.status(400).json({ message: "grupo y semestre son obligatorios" });
  try { res.json(await service.approve(req.params.id, req.body)); }
  catch (err) { res.status(500).json(err); }
};

const occupy = async (req, res) => {
  try { res.json(await service.occupy(req.params.id)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const release = async (req, res) => {
  try { res.json(await service.release(req.params.id, req.body)); }
  catch (err) { res.status(500).json(err); }
};

const cancel = async (req, res) => {
  try { res.json(await service.cancel(req.params.id, req.body)); }
  catch (err) { res.status(500).json(err); }
};

const remove = async (req, res) => {
  try { await service.remove(req.params.id); res.json({ message: "Reserva eliminada" }); }
  catch (err) { res.status(500).json(err); }
};

module.exports = { getAll, getById, create, approve, occupy, release, cancel, remove };
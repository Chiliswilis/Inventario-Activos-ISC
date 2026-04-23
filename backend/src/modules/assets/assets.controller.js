const service = require("./assets.service");
//verificacion de token se hace en el router, no aquí, para que los endpoints públicos (getAll, getSummary) sigan funcionando sin auth
const getAll    = async (req, res) => {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json(err); }
};

const getSummary = async (req, res) => {
  try { res.json(await service.getSummary()); }
  catch (err) { res.status(500).json(err); }
};

const getLogs = async (req, res) => {
  try { res.json(await service.getLogs(req.params.id)); }
  catch (err) { res.status(500).json(err); }
};

const getById = async (req, res) => {
  try { res.json(await service.getById(req.params.id)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const create = async (req, res) => {
  const { name, category_id, location, area } = req.body;
  const needsSerial = area !== "laboratorio";
  if (!name || !category_id || !location)
    return res.status(400).json({ message: "Campos obligatorios: name, category_id, location" });
  if (needsSerial && !req.body.serial_number)
    return res.status(400).json({ message: "El número de serie es obligatorio para activos de Sistemas" });
  try { res.json(await service.create(req.body, req.user?.id)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const update = async (req, res) => {
  const { name, category_id, location, area } = req.body;
  const needsSerial = area !== "laboratorio";
  if (!name || !category_id || !location)
    return res.status(400).json({ message: "Campos obligatorios: name, category_id, location" });
  if (needsSerial && !req.body.serial_number)
    return res.status(400).json({ message: "El número de serie es obligatorio para activos de Sistemas" });
  try { res.json(await service.update(req.params.id, req.body, req.user?.id)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const remove = async (req, res) => {
  try { await service.remove(req.params.id); res.json({ message: "Activo eliminado" }); }
  catch (err) { res.status(500).json(err); }
};

module.exports = { getAll, getSummary, getLogs, getById, create, update, remove };
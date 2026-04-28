const service       = require("./assets.service");
const { logAction } = require("../audit/audit.service");

const getAll = async (req, res) => {
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

  try {
    const data = await service.create(req.body, req.user?.id);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "CREATE",
      module:      "activos",
      recordId:    data?.id,
      description: `Nuevo activo creado: "${name}" — Serie: ${req.body.serial_number || "N/A"} · Ubicación: ${location} · Área: ${area || "—"}`,
      newValue:    { name, category_id, location, area, serial_number: req.body.serial_number },
      req,
    });

    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const update = async (req, res) => {
  const { name, category_id, location, area } = req.body;
  const needsSerial = area !== "laboratorio";
  if (!name || !category_id || !location)
    return res.status(400).json({ message: "Campos obligatorios: name, category_id, location" });
  if (needsSerial && !req.body.serial_number)
    return res.status(400).json({ message: "El número de serie es obligatorio para activos de Sistemas" });

  try {
    const before = await service.getById(req.params.id).catch(() => null);
    const data   = await service.update(req.params.id, req.body, req.user?.id);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "UPDATE",
      module:      "activos",
      recordId:    Number(req.params.id),
      description: `Editó activo #${req.params.id}: "${name}" — Ubicación: ${location}`,
      oldValue:    before ? { name: before.name, location: before.location, status: before.status } : null,
      newValue:    { name, category_id, location, area, serial_number: req.body.serial_number },
      req,
    });

    res.json(data);
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const remove = async (req, res) => {
  try {
    const before = await service.getById(req.params.id).catch(() => null);
    await service.remove(req.params.id);

    await logAction({
      userId:      req.user?.id,
      userRole:    req.user?.role,
      action:      "DELETE",
      module:      "activos",
      recordId:    Number(req.params.id),
      description: `Eliminó activo #${req.params.id}: "${before?.name || "—"}" — Serie: ${before?.serial_number || "N/A"}`,
      oldValue:    before ? { name: before.name, serial_number: before.serial_number, status: before.status } : null,
      req,
    });

    res.json({ message: "Activo eliminado" });
  } catch (err) { res.status(500).json(err); }
};

module.exports = { getAll, getSummary, getLogs, getById, create, update, remove };
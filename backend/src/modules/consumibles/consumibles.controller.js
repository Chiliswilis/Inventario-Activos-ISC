const consumiblesService = require("./consumibles.service");

/* ── LISTAR ── */
async function getAll(req, res) {
  try {
    const data = await consumiblesService.getAll();
    res.json(data);
  } catch (err) {
    console.error("Error listar consumibles:", err);
    res.status(err.status || 500).json(err);
  }
}

/* ── OBTENER POR ID ── */
async function getById(req, res) {
  try {
    const data = await consumiblesService.getById(req.params.id);
    res.json(data);
  } catch (err) {
    console.error("Error obtener consumible:", err);
    res.status(err.status || 500).json({ message: err.message });
  }
}

/* ── CREAR ── */
async function create(req, res) {
  try {
    const { name, category_id, unit } = req.body;
    if (!name || !category_id || !unit)
      return res.status(400).json({ message: "name, category_id y unit son obligatorios" });

    const data = await consumiblesService.create(req.body);
    res.json(data);
  } catch (err) {
    console.error("Error crear consumible:", err);
    res.status(err.status || 500).json(err);
  }
}

/* ── ACTUALIZAR ── */
async function update(req, res) {
  try {
    const { name, category_id, unit } = req.body;
    if (!name || !category_id || !unit)
      return res.status(400).json({ message: "name, category_id y unit son obligatorios" });

    const data = await consumiblesService.update(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    console.error("Error actualizar consumible:", err);
    res.status(err.status || 500).json({ message: err.message });
  }
}

/* ── ELIMINAR ── */
async function remove(req, res) {
  try {
    const result = await consumiblesService.remove(req.params.id);
    res.json(result);
  } catch (err) {
    console.error("Error eliminar consumible:", err);
    res.status(err.status || 500).json(err);
  }
}

module.exports = { getAll, getById, create, update, remove };
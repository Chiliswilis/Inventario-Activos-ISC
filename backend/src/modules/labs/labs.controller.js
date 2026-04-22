// labs.controller.js
const service = require("./labs.service");

const getAll = async (req, res) => {
  try { res.json(await service.getAll()); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

const getById = async (req, res) => {
  try { res.json(await service.getById(req.params.id)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const create = async (req, res) => {
  try { res.status(201).json(await service.create(req.body)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const update = async (req, res) => {
  try { res.json(await service.update(req.params.id, req.body)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
};

const remove = async (req, res) => {
  try { await service.remove(req.params.id); res.json({ message: "Laboratorio eliminado" }); }
  catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getAll, getById, create, update, remove };
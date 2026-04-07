const service = require("./users.service");

const getAll = async (req, res) => {
  try {
    const data = await service.getAllUsers();
    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getUserById(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const create = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "username, email y password son obligatorios" });
  try {
    const data = await service.createUser(req.body);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const update = async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email)
    return res.status(400).json({ message: "username y email son obligatorios" });
  try {
    const data = await service.updateUser(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    await service.deleteUser(req.params.id);
    res.json({ message: "Usuario eliminado" });
  } catch (err) {
    res.status(500).json(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
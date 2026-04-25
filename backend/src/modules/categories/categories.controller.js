const service = require("./categories.service");

const getAll = async (req, res) => {
  try {
    const data = await service.getAllCategories();
    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
};

const getAssets = async (req, res) => {
  try {
    const data = await service.getAssetCategories();
    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
};

const getConsumables = async (req, res) => {
  try {
    const data = await service.getConsumableCategories();
    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
};

const create = async (req, res) => {
  try {
    const data = await service.createCategory(req.body);
    res.json(data);
  } catch (err) {
    res.status(500).json(err);
  }
};

const update = async (req, res) => {
  try {
    const data = await service.updateCategory(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    await service.deleteCategory(req.params.id);
    res.json({ message: "Categoría eliminada" });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

module.exports = { getAll, getAssets, getConsumables, create, update, remove };
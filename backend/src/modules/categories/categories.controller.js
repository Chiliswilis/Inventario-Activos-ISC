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

module.exports = { getAll, getAssets, getConsumables };
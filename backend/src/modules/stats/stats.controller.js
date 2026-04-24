const service = require("./stats.service");

const getStats = async (req, res) => {
  try {
    const data = await service.getStats();
    res.json(data);
  } catch (err) {
    console.error("Error stats:", err);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
};

const getMyStats = async (req, res) => {
  try {
    const data = await service.getMyStats(req.user.id);
    res.json(data);
  } catch (err) {
    console.error("Error my stats:", err);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
};

module.exports = { getStats, getMyStats };
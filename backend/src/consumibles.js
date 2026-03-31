const express  = require("express");
const router   = express.Router();
const supabase = require("./supabase");
const { broadcast } = require("./events");   // <-- NUEVO

/* LISTAR */
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("consumables")
    .select("id, name, description, category_id, quantity, min_quantity, unit, categories(name)")
    .order("name");
  if (error) return res.status(500).json(error);
  res.json(data);
});

/* OBTENER POR ID */
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("consumables")
    .select("id, name, description, category_id, quantity, min_quantity, unit, categories(name)")
    .eq("id", req.params.id)
    .single();
  if (error) return res.status(404).json({ message: "Consumible no encontrado" });
  res.json(data);
});

/* CREAR */
router.post("/", async (req, res) => {
  const { name, description, category_id, quantity, min_quantity, unit } = req.body;
  if (!name || !category_id || !unit)
    return res.status(400).json({ message: "name, category_id y unit son obligatorios" });

  const { data, error } = await supabase
    .from("consumables")
    .insert([{
      name,
      description: description || null,
      category_id: parseInt(category_id),
      quantity:    parseInt(quantity)     || 0,
      min_quantity: parseInt(min_quantity) || 0,
      unit
    }])
    .select("id, name, description, category_id, quantity, min_quantity, unit, categories(name)");

  if (error) return res.status(500).json(error);

  // Broadcast
  broadcast("consumables", "INSERT", data[0]);

  res.json(data[0]);
});

/* ACTUALIZAR */
router.put("/:id", async (req, res) => {
  const { name, description, category_id, quantity, min_quantity, unit } = req.body;
  if (!name || !category_id || !unit)
    return res.status(400).json({ message: "name, category_id y unit son obligatorios" });

  const { data, error } = await supabase
    .from("consumables")
    .update({
      name,
      description: description || null,
      category_id: parseInt(category_id),
      quantity:    parseInt(quantity)     || 0,
      min_quantity: parseInt(min_quantity) || 0,
      unit
    })
    .eq("id", req.params.id)
    .select("id, name, description, category_id, quantity, min_quantity, unit, categories(name)");

  if (error) return res.status(500).json(error);
  if (!data || data.length === 0) return res.status(404).json({ message: "No encontrado" });

  // Broadcast
  broadcast("consumables", "UPDATE", data[0]);

  res.json(data[0]);
});

/* ELIMINAR */
router.delete("/:id", async (req, res) => {
  const { error } = await supabase
    .from("consumables")
    .delete()
    .eq("id", req.params.id);
  if (error) return res.status(500).json(error);
  // Broadcast
  broadcast("consumables", "DELETE", { id: req.params.id });
  res.json({ message: "Consumible eliminado" });
});

module.exports = router;
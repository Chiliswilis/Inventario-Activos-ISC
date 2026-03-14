const express = require("express");
const router = express.Router();
const supabase = require("./supabase");


/* LISTAR ACTIVOS */
router.get("/", async (req, res) => {

  const { data, error } = await supabase
    .from("assets")
    .select("*");

  if (error) return res.status(500).json(error);

  res.json(data);

});
/* OBTENER ACTIVO POR ID */
router.get("/:id", async (req, res) => {

  const { id } = req.params;

  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116" || error.code === "PGRST102") return res.status(404).json({ message: "Activo no encontrado" });
    return res.status(500).json(error);
  }

  res.json(data);

});


/* CREAR ACTIVO */
router.post("/", async (req, res) => {

  const {
    name,
    description,
    category_id,
    serial_number,
    location,
    status,
    quantity
  } = req.body;

  if (!name || !category_id || !serial_number || !location) {
    return res.status(400).json({ message: "Campos obligatorios: name, category_id, serial_number, location" });
  }

  const { data, error } = await supabase
    .from("assets")
    .insert([{
      name,
      description,
      category_id,
      serial_number,
      location,
      status: status || "available",
      quantity: Number.isInteger(quantity) ? quantity : (quantity ? parseInt(quantity, 10) : 1)
    }])
    .select();

  if (error) return res.status(500).json(error);

  res.json(data);

});


/* ACTUALIZAR ACTIVO */
router.put("/:id", async (req, res) => {

  const { id } = req.params;
  const {
    name,
    description,
    category_id,
    serial_number,
    location,
    status,
    quantity
  } = req.body;

  if (!name || !category_id || !serial_number || !location) {
    return res.status(400).json({ message: "Campos obligatorios: name, category_id, serial_number, location" });
  }

  const updateData = {
    name,
    description,
    category_id,
    serial_number,
    location,
    status,
    quantity: Number.isInteger(quantity) ? quantity : (quantity ? parseInt(quantity, 10) : undefined)
  };

  // Eliminar undefined para evitar reescribir con null no intencional
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) delete updateData[key];
  });

  const { data, error } = await supabase
    .from("assets")
    .update(updateData)
    .eq("id", id)
    .select();

  if (error) return res.status(500).json(error);

  if (!data || data.length === 0) return res.status(404).json({ message: "Activo no encontrado" });

  res.json(data[0]);

});


/* ELIMINAR ACTIVO */
router.delete("/:id", async (req, res) => {

  const { id } = req.params;

  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json(error);

  res.json({ message: "Activo eliminado" });

});


module.exports = router;
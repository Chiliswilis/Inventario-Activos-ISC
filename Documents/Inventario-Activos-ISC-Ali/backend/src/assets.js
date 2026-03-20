const express  = require("express");
const router   = express.Router();
const supabase = require("./supabase");

/* LISTAR ACTIVOS con categoría */
router.get("/", async (req, res) => {

  const { data, error } = await supabase
    .from("assets")
    .select("*, categories(name)")
    .order("id");
  if (error) return res.status(500).json(error);

  res.json(data);

});

/* OBTENER POR ID */
router.get("/:id", async (req, res) => {
  

  const { data, error } = await supabase
    .from("assets")
    .select("*, categories(name)")
    .eq("id", req.params.id)
    .single();
  if (error) return res.status(404).json({ message: "Activo no encontrado" });
  res.json(data);

});

/* CREAR */
router.post("/", async (req, res) => {
  const { name, description, category_id, serial_number, location, status, quantity } = req.body;
  if (!name || !category_id || !serial_number || !location)
    return res.status(400).json({ message: "Campos obligatorios: name, category_id, serial_number, location" });


  const { data, error } = await supabase
    .from("assets")
    .insert([{
      name, description, category_id,
      serial_number, location,
      status: status || "available",
      quantity: parseInt(quantity) || 1
    }])
    .select("*, categories(name)");

  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

/* ACTUALIZAR */
router.put("/:id", async (req, res) => {
  const { name, description, category_id, serial_number, location, status, quantity } = req.body;
  if (!name || !category_id || !serial_number || !location)
    return res.status(400).json({ message: "Campos obligatorios: name, category_id, serial_number, location" });


  const { data, error } = await supabase
    .from("assets")
    .update({ name, description, category_id, serial_number, location, status, quantity: parseInt(quantity) || 1 })
    .eq("id", req.params.id)
    .select("*, categories(name)");

  if (error) return res.status(500).json(error);
  if (!data || data.length === 0) return res.status(404).json({ message: "No encontrado" });
  res.json(data[0]);

});

/* ELIMINAR */
router.delete("/:id", async (req, res) => {
  const { error } = await supabase.from("assets").delete().eq("id", req.params.id);
  if (error) return res.status(500).json(error);

  res.json({ message: "Activo eliminado" });

});


module.exports = router;
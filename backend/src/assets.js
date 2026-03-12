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


/* CREAR ACTIVO */
router.post("/", async (req, res) => {

  const { name, category_id, serial_number, location } = req.body;

  const { data, error } = await supabase
    .from("assets")
    .insert([{
      name,
      category_id,
      serial_number,
      location
    }])
    .select();

  if (error) return res.status(500).json(error);

  res.json(data);

});


/* ACTUALIZAR ACTIVO */
router.put("/:id", async (req, res) => {

  const { id } = req.params;
  const { name, location, status } = req.body;

  const { data, error } = await supabase
    .from("assets")
    .update({
      name,
      location,
      status
    })
    .eq("id", id)
    .select();

  if (error) return res.status(500).json(error);

  res.json(data);

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
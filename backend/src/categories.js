const express = require("express");
const router = express.Router();
const supabase = require("./supabase");

/* LISTAR TODAS LAS CATEGORÍAS */
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description, type, area")  // ✅ Agregado: description y area
    .order("type")
    .order("name");

  if (error) return res.status(500).json(error);
  res.json(data);
});

/* LISTAR SOLO CATEGORÍAS DE ACTIVOS */
router.get("/assets", async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description, type, area")  // ✅ Incluido: description y area
    .eq("type", "asset")
    .order("name");

  if (error) return res.status(500).json(error);
  res.json(data);
});

/* LISTAR SOLO CATEGORÍAS DE CONSUMIBLES */
router.get("/consumables", async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, description, type, area")  // ✅ Incluido: description y area
    .eq("type", "consumable")
    .order("name");

  if (error) return res.status(500).json(error);
  res.json(data);
});

module.exports = router;
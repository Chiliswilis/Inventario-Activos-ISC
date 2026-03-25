const express  = require("express");
const router   = express.Router();
const supabase = require("./supabase");

/* ── LISTAR ── */
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("assets").select("*, categories(name)").order("id");
  if (error) return res.status(500).json(error);
  res.json(data);
});

/* ── RESUMEN DE ESTADO (para dashboard/bitácora) ── */
router.get("/summary", async (req, res) => {
  const { data, error } = await supabase
    .from("assets")
    .select("status");
  if (error) return res.status(500).json(error);
  const summary = { available: 0, borrowed: 0, maintenance: 0, damaged: 0 };
  data.forEach(a => { if (summary[a.status] !== undefined) summary[a.status]++; });
  res.json(summary);
});

/* ── BITÁCORA DE UN ACTIVO ── */
router.get("/:id/logs", async (req, res) => {
  const { data, error } = await supabase
    .from("logs")
    .select("*, users(username, role)")
    .eq("item_type", "asset")
    .eq("item_id", req.params.id)
    .order("timestamp", { ascending: false })
    .limit(50);
  if (error) return res.status(500).json(error);
  res.json(data);
});

/* ── OBTENER POR ID ── */
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("assets").select("*, categories(name)").eq("id", req.params.id).single();
  if (error) return res.status(404).json({ message: "Activo no encontrado" });
  res.json(data);
});

/* ── CREAR ── */
router.post("/", async (req, res) => {
  const { name, description, category_id, serial_number, location, status, quantity } = req.body;
  if (!name || !category_id || !serial_number || !location)
    return res.status(400).json({ message: "Campos obligatorios: name, category_id, serial_number, location" });

  const { data, error } = await supabase
    .from("assets")
    .insert([{ name, description, category_id, serial_number, location, status: status || "available", quantity: parseInt(quantity) || 1 }])
    .select("*, categories(name)");
  if (error) return res.status(500).json(error);

  await supabase.from("logs").insert([{
    action: "Activo creado", table_name: "assets", record_id: data[0].id,
    item_type: "asset", item_id: data[0].id, details: `${name} (${serial_number})`
  }]);

  res.json(data[0]);
});

/* ── ACTUALIZAR ── */
router.put("/:id", async (req, res) => {
  const { name, description, category_id, serial_number, location, status, quantity, condition_notes } = req.body;
  if (!name || !category_id || !serial_number || !location)
    return res.status(400).json({ message: "Campos obligatorios: name, category_id, serial_number, location" });

  const validStatus = ["available", "borrowed", "maintenance", "damaged"];
  if (status && !validStatus.includes(status))
    return res.status(400).json({ message: "Status inválido" });

  const { data, error } = await supabase
    .from("assets")
    .update({ name, description, category_id, serial_number, location, status, quantity: parseInt(quantity) || 1, condition_notes: condition_notes || null })
    .eq("id", req.params.id)
    .select("*, categories(name)");
  if (error) return res.status(500).json(error);
  if (!data || data.length === 0) return res.status(404).json({ message: "No encontrado" });

  await supabase.from("logs").insert([{
    action: "Activo actualizado", table_name: "assets", record_id: parseInt(req.params.id),
    item_type: "asset", item_id: parseInt(req.params.id), details: `Status: ${status}`
  }]);

  res.json(data[0]);
});

/* ── ELIMINAR ── */
router.delete("/:id", async (req, res) => {
  const { error } = await supabase.from("assets").delete().eq("id", req.params.id);
  if (error) return res.status(500).json(error);
  res.json({ message: "Activo eliminado" });
});

module.exports = router;
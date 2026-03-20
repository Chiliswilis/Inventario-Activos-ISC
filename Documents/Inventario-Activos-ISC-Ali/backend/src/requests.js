const express  = require("express");
const router   = express.Router();
const supabase = require("./supabase");

/* ── LISTAR ── */
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("requests")
    .select(`
      id, status, request_date, quantity_requested, notes, request_type,
      pickup_date, pickup_location, admin_message,
      incident, incident_cause, incident_solution,
      user_id, docente_id,
      users!requests_user_id_fkey(id, username, role),
      docente:users!requests_docente_id_fkey(id, username),
      assets(id, name), consumables(id, name)
    `)
    .order("request_date", { ascending: false });

  if (error) return res.status(500).json(error);
  res.json(data);
});

/* ── OBTENER POR ID ── */
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("requests")
    .select(`
      id, status, request_date, quantity_requested, notes, request_type,
      pickup_date, pickup_location, admin_message,
      incident, incident_cause, incident_solution,
      user_id, docente_id,
      users!requests_user_id_fkey(id, username, role),
      docente:users!requests_docente_id_fkey(id, username),
      assets(id, name), consumables(id, name)
    `)
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ message: "No encontrada" });
  res.json(data);
});

/* ── CREAR (alumno o docente) ── */
router.post("/", async (req, res) => {
  const {
    user_id, docente_id, asset_id, consumable_id,
    quantity_requested, notes, request_type
  } = req.body;

  if (!user_id) return res.status(400).json({ message: "user_id es obligatorio" });

  const { data, error } = await supabase
    .from("requests")
    .insert([{
      user_id,
      docente_id:    docente_id    || null,
      asset_id:      asset_id      || null,
      consumable_id: consumable_id || null,
      quantity_requested: parseInt(quantity_requested) || 1,
      notes:        notes        || null,
      request_type: request_type || "asset",
      status: "pending"
    }])
    .select(`id, status, request_date, quantity_requested, notes, request_type,
      users!requests_user_id_fkey(id, username, role),
      assets(id, name), consumables(id, name)`);

  if (error) return res.status(500).json(error);

  // Log
  await supabase.from("logs").insert([{
    user_id,
    action: "Solicitud creada",
    table_name: "requests",
    record_id: data[0].id,
    details: `Solicitud de ${request_type} creada`
  }]);

  res.json(data[0]);
});

/* ── ADMIN RESPONDE: aprueba + fecha/lugar ── */
router.put("/:id/approve", async (req, res) => {
  const { pickup_date, pickup_location, admin_message } = req.body;
  if (!pickup_date || !pickup_location)
    return res.status(400).json({ message: "pickup_date y pickup_location son obligatorios" });

  const { data, error } = await supabase
    .from("requests")
    .update({
      status: "approved",
      pickup_date,
      pickup_location,
      admin_message: admin_message || null,
      approval_date: new Date().toISOString()
    })
    .eq("id", req.params.id)
    .select("id, status, pickup_date, pickup_location, admin_message");

  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

/* ── ADMIN RECHAZA ── */
router.put("/:id/reject", async (req, res) => {
  const { admin_message } = req.body;
  const { data, error } = await supabase
    .from("requests")
    .update({ status: "rejected", admin_message: admin_message || "Solicitud rechazada" })
    .eq("id", req.params.id)
    .select("id, status, admin_message");

  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

/* ── DOCENTE DEVUELVE + reporte de incidente ── */
router.put("/:id/return", async (req, res) => {
  const { incident, incident_cause, incident_solution } = req.body;

  // Obtener la solicitud para saber qué consumible/activo actualizar
  const { data: req_data } = await supabase
    .from("requests")
    .select("consumable_id, quantity_requested, request_type")
    .eq("id", req.params.id)
    .single();

  const update = {
    status: "returned",
    return_date: new Date().toISOString(),
    incident: incident || false,
    incident_cause:    incident ? (incident_cause    || null) : null,
    incident_solution: incident ? (incident_solution || null) : null
  };

  const { data, error } = await supabase
    .from("requests")
    .update(update)
    .eq("id", req.params.id)
    .select("id, status, incident");

  if (error) return res.status(500).json(error);

  // Si es consumible, descontar stock
  if (req_data?.request_type === "consumable" && req_data?.consumable_id) {
    const { data: cons } = await supabase
      .from("consumables")
      .select("quantity")
      .eq("id", req_data.consumable_id)
      .single();

    if (cons) {
      const newQty = Math.max(0, cons.quantity - req_data.quantity_requested);
      await supabase
        .from("consumables")
        .update({ quantity: newQty })
        .eq("id", req_data.consumable_id);
    }
  }

  res.json(data[0]);
});

/* ── ELIMINAR ── */
router.delete("/:id", async (req, res) => {
  const { error } = await supabase.from("requests").delete().eq("id", req.params.id);
  if (error) return res.status(500).json(error);
  res.json({ message: "Solicitud eliminada" });
});

module.exports = router;
const express  = require("express");
const router   = express.Router();
const supabase = require("./supabase");
const { broadcast } = require("./events");   // <-- NUEVO

const SELECT_FULL = `
  id, status, request_date, notes, request_type, purpose,
  pickup_date, pickup_location, admin_message,
  incident, incident_cause, incident_solution,
  rejected_by, rejected_reason, rejected_at,
  approval_date, return_date,
  user_id, docente_id,
  users!requests_user_id_fkey(id, username, role),
  docente:users!requests_docente_id_fkey(id, username),
  rejected_user:users!requests_rejected_by_fkey(id, username),
  assets(id, name), consumables(id, name),
  request_items(
    id, quantity, return_condition, replacement_serial,
    assets(id, name, serial_number),
    consumables(id, name, unit)
  )
`;

/* ── LISTAR ── */
router.get("/", async (req, res) => {
  const { status, user_id, docente_id } = req.query;
  let q = supabase.from("requests").select(SELECT_FULL).order("request_date", { ascending: false });
  if (status)     q = q.eq("status", status);
  if (user_id)    q = q.eq("user_id", user_id);
  if (docente_id) q = q.eq("docente_id", docente_id);
  const { data, error } = await q;
  if (error) return res.status(500).json(error);
  res.json(data);
});

/* ── OBTENER POR ID ── */
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("requests").select(SELECT_FULL).eq("id", req.params.id).single();
  if (error) return res.status(404).json({ message: "No encontrada" });
  res.json(data);
});

/* ── CREAR (soporta multi-ítem via items[]) ── */
router.post("/", async (req, res) => {
  const {
    user_id, docente_id, request_type, purpose, notes,
    // legacy single-item (retrocompatibilidad)
    asset_id, consumable_id, quantity_requested,
    // multi-item nuevo
    items = []
  } = req.body;

  if (!user_id) return res.status(400).json({ message: "user_id es obligatorio" });

  const { data: req_data, error } = await supabase
    .from("requests")
    .insert([{
      user_id,
      docente_id:    docente_id || null,
      asset_id:      items.length ? null : (asset_id      || null),
      consumable_id: items.length ? null : (consumable_id || null),
      quantity_requested: items.length ? 1 : (parseInt(quantity_requested) || 1),
      notes:        notes        || null,
      purpose:      purpose      || null,
      request_type: request_type || "asset",
      status: "pending"
    }])
    .select("id, status, request_date, request_type")
    .single();

  if (error) return res.status(500).json(error);

  // Insertar items si vienen en el array nuevo
  if (items.length > 0) {
    const itemRows = items.map(it => ({
      request_id:    req_data.id,
      asset_id:      it.asset_id      || null,
      consumable_id: it.consumable_id || null,
      quantity:      parseInt(it.quantity) || 1
    }));
    const { error: itemErr } = await supabase.from("request_items").insert(itemRows);
    if (itemErr) return res.status(500).json(itemErr);
  }

  // Log
  await supabase.from("logs").insert([{
    user_id,
    action: "Solicitud creada",
    table_name: "requests",
    record_id: req_data.id,
    item_type: request_type || "asset",
    details: `Solicitud de ${request_type || "asset"} creada`
  }]);

  // Broadcast
  broadcast("requests", "INSERT", req_data);

  res.json(req_data);
});

/* ── ADMIN APRUEBA ── */
router.put("/:id/approve", async (req, res) => {
  const { pickup_date, pickup_location, admin_message } = req.body;
  if (!pickup_date || !pickup_location)
    return res.status(400).json({ message: "pickup_date y pickup_location son obligatorios" });

  // 1. Actualizar el status de la solicitud — traer también los ítems para procesar activos
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
    .select(`
      id, status, pickup_date, pickup_location, admin_message,
      request_type, asset_id,
      request_items(id, asset_id, consumable_id, quantity)
    `);

  if (error) return res.status(500).json(error);
  const solicitud = data[0];

  // 2. ✅ Marcar activos involucrados como "borrowed" (prestado)
  const assetsToMark = [];

  // Legacy: campo directo asset_id en la solicitud
  if (solicitud.request_type === "asset" && solicitud.asset_id) {
    assetsToMark.push(solicitud.asset_id);
  }
  // Multi-item: activos dentro de request_items
  for (const item of (solicitud.request_items || [])) {
    if (item.asset_id) assetsToMark.push(item.asset_id);
  }

  for (const assetId of assetsToMark) {
    await supabase
      .from("assets")
      .update({ status: "borrowed" })
      .eq("id", assetId);
  }

  // 3. ✅ Log de aprobación
  await supabase.from("logs").insert([{
    action: "Solicitud aprobada",
    table_name: "requests",
    record_id: parseInt(req.params.id),
    details: assetsToMark.length
      ? `Aprobada. Activos marcados como prestados: [${assetsToMark.join(", ")}]`
      : "Aprobada (consumibles / sin activos directos)"
  }]);

  // Broadcast
  broadcast("requests", "UPDATE", solicitud);

  res.json(solicitud);
});

/* ── ADMIN RECHAZA (con razón + quién + cuándo) ── */
router.put("/:id/reject", async (req, res) => {
  const { admin_message, rejected_by, rejected_reason } = req.body;

  const { data, error } = await supabase
    .from("requests")
    .update({
      status: "rejected",
      admin_message:   admin_message   || "Solicitud rechazada",
      rejected_by:     rejected_by     || null,
      rejected_reason: rejected_reason || admin_message || null,
      rejected_at:     new Date().toISOString()
    })
    .eq("id", req.params.id)
    .select("id, status, admin_message, rejected_at");

  if (error) return res.status(500).json(error);

  // Log
  await supabase.from("logs").insert([{
    user_id: rejected_by || null,
    action: "Solicitud rechazada",
    table_name: "requests",
    record_id: parseInt(req.params.id),
    details: rejected_reason || "Sin razón especificada"
  }]);

  // Broadcast
  broadcast("requests", "UPDATE", data[0]);

  res.json(data[0]);
});

/* ── DEVOLUCIÓN + condición del ítem ── */
router.put("/:id/return", async (req, res) => {
  const { incident, incident_cause, incident_solution, items_condition = [] } = req.body;

  // Obtener solicitud con todos los ítems para saber qué descontar/restaurar
  const { data: req_data } = await supabase
    .from("requests")
    .select("consumable_id, asset_id, request_type, request_items(id, asset_id, consumable_id, quantity)")
    .eq("id", req.params.id)
    .single();

  // Actualizar status de la solicitud
  const { data, error } = await supabase
    .from("requests")
    .update({
      status: "returned",
      return_date: new Date().toISOString(),
      incident: incident || false,
      incident_cause:    incident ? (incident_cause    || null) : null,
      incident_solution: incident ? (incident_solution || null) : null
    })
    .eq("id", req.params.id)
    .select("id, status, incident");

  if (error) return res.status(500).json(error);

  // ── Actualizar condición de cada ítem devuelto ──
  for (const ic of items_condition) {
    await supabase.from("request_items")
      .update({
        return_condition:   ic.return_condition   || null,
        replacement_serial: ic.replacement_serial || null
      })
      .eq("id", ic.item_id);

    // ✅ Actualizar estado del activo según la condición devuelta
    if (ic.asset_id) {
      if (ic.return_condition === "dañado") {
        await supabase.from("assets")
          .update({ status: "damaged" })
          .eq("id", ic.asset_id);
      } else if (ic.return_condition === "perdido") {
        await supabase.from("assets")
          .update({ status: "maintenance" })
          .eq("id", ic.asset_id);
      } else {
        // ✅ Buen estado → regresar a disponible
        await supabase.from("assets")
          .update({ status: "available" })
          .eq("id", ic.asset_id);
      }
    }
  }

  // ✅ Caso legacy: si no vinieron items_condition pero hay asset_id directo → regresar a available
  if (items_condition.length === 0 && req_data?.asset_id) {
    await supabase.from("assets")
      .update({ status: "available" })
      .eq("id", req_data.asset_id);
  }

  // ── Descontar consumibles al devolver (se gastaron, no regresan) ──
  const consumablesToDiscount = [];

  // Legacy: campo directo consumable_id
  if (req_data?.request_type === "consumable" && req_data?.consumable_id) {
    consumablesToDiscount.push({ id: req_data.consumable_id, qty: 1 });
  }
  // Multi-item: consumables dentro de request_items
  for (const ri of (req_data?.request_items || [])) {
    if (ri.consumable_id) {
      consumablesToDiscount.push({ id: ri.consumable_id, qty: ri.quantity });
    }
  }

  for (const c of consumablesToDiscount) {
    const { data: cons } = await supabase
      .from("consumables").select("quantity").eq("id", c.id).single();
    if (cons) {
      await supabase.from("consumables")
        .update({ quantity: Math.max(0, cons.quantity - c.qty) })
        .eq("id", c.id);
    }
  }

  // ✅ Log de devolución
  await supabase.from("logs").insert([{
    action: "Devolución registrada",
    table_name: "requests",
    record_id: parseInt(req.params.id),
    details: incident
      ? `Con incidente: ${incident_cause || "Sin descripción"}`
      : "Sin incidentes"
  }]);

  // Broadcast
  broadcast("requests", "UPDATE", data[0]);

  res.json(data[0]);
});

/* ── DOCENTE ENVÍA AL ADMIN (status: pending_admin) ── */
router.put("/:id", async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "status es obligatorio" });
  const valid = ["pending", "pending_admin", "approved", "rejected", "returned"];
  if (!valid.includes(status)) return res.status(400).json({ message: "status inválido" });

  const { data, error } = await supabase
    .from("requests").update({ status }).eq("id", req.params.id).select("id, status");
  if (error) return res.status(500).json(error);

  // Broadcast
  broadcast("requests", "UPDATE", data[0]);

  res.json(data[0]);
});

/* ── ELIMINAR ── */
router.delete("/:id", async (req, res) => {
  const { error } = await supabase.from("requests").delete().eq("id", req.params.id);
  if (error) return res.status(500).json(error);
  // Broadcast
  broadcast("requests", "DELETE", { id: req.params.id });
  res.json({ message: "Solicitud eliminada" });
});

module.exports = router;
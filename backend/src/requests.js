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
  fecha_solicitud, hora_solicitud,
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
    fecha_solicitud, hora_solicitud,
    asset_id, consumable_id, quantity_requested,
    items = []
  } = req.body;

  if (!user_id) return res.status(400).json({ message: "user_id es obligatorio" });
  if (!fecha_solicitud) return res.status(400).json({ message: "La fecha de solicitud es obligatoria" });
  if (!hora_solicitud)  return res.status(400).json({ message: "La hora de solicitud es obligatoria" });

  // ── Validar día (no domingo) ──
  const dow = new Date(fecha_solicitud + "T12:00:00").getDay();
  if (dow === 0) return res.status(400).json({ message: "No se permiten solicitudes los domingos" });

  // ── Validar rango horario 7:30–15:00 L–V, 7:30–13:00 Sáb ──
  const normT  = t => (t || "").substring(0, 5);
  const hNorm  = normT(hora_solicitud);
  const maxH   = dow === 6 ? "13:00" : "15:00";
  if (hNorm < "07:30") return res.status(400).json({ message: "Hora mínima de solicitud: 07:30 AM" });
  if (hNorm > maxH)    return res.status(400).json({ message: `Hora máxima de solicitud: ${dow === 6 ? "1:00 PM (sábado)" : "3:00 PM"}` });

  const { data: req_data, error } = await supabase
    .from("requests")
    .insert([{
      user_id,
      docente_id:         docente_id || null,
      asset_id:           items.length ? null : (asset_id      || null),
      consumable_id:      items.length ? null : (consumable_id || null),
      quantity_requested: items.length ? 1    : (parseInt(quantity_requested) || 1),
      notes:              notes           || null,
      purpose:            purpose         || null,
      request_type:       request_type    || "asset",
      fecha_solicitud:    fecha_solicitud,
      hora_solicitud:     normT(hora_solicitud),
      status: "pending"
    }])
    .select("id, status, request_date, request_type, fecha_solicitud, hora_solicitud")
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

  // 1. Actualizar el status de la solicitud — traer también los ítems para procesar activos y consumibles
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
      request_type, asset_id, consumable_id, quantity_requested,
      request_items(id, asset_id, consumable_id, quantity)
    `);

  if (error) return res.status(500).json(error);
  const solicitud = data[0];

  // 2. ✅ Marcar activos involucrados como "borrowed"
  const assetsToMark = [];

  // Legacy: campo directo asset_id
  if (solicitud.asset_id) assetsToMark.push(solicitud.asset_id);
  // Multi-item
  for (const item of (solicitud.request_items || [])) {
    if (item.asset_id) assetsToMark.push(item.asset_id);
  }

  for (const assetId of assetsToMark) {
    const { data: updatedAsset } = await supabase
      .from("assets")
      .update({ status: "borrowed" })
      .eq("id", assetId)
      .select("*")
      .single();
    if (updatedAsset) broadcast("assets", "UPDATE", updatedAsset);
  }

  // 3. ✅ Descontar consumibles al aprobar (se entregan en este momento)
  const consumablesToDiscount = [];

  // Legacy: campo directo consumable_id
  if (solicitud.consumable_id) {
    consumablesToDiscount.push({
      id:  solicitud.consumable_id,
      qty: parseInt(solicitud.quantity_requested) || 1
    });
  }
  // Multi-item: consumables dentro de request_items
  for (const item of (solicitud.request_items || [])) {
    if (item.consumable_id) {
      consumablesToDiscount.push({ id: item.consumable_id, qty: parseInt(item.quantity) || 1 });
    }
  }

  for (const c of consumablesToDiscount) {
    const { data: cons } = await supabase
      .from("consumables").select("quantity").eq("id", c.id).single();
    if (cons) {
      const newQty = Math.max(0, cons.quantity - c.qty);
      const { data: updatedCons } = await supabase
        .from("consumables")
        .update({ quantity: newQty })
        .eq("id", c.id)
        .select("id, name, quantity, unit, category_id, categories(name)")
        .single();
      if (updatedCons) broadcast("consumables", "UPDATE", updatedCons);
    }
  }

  // 4. ✅ Log de aprobación
  const logDetails = [];
  if (assetsToMark.length)
    logDetails.push(`Activos prestados: [${assetsToMark.join(", ")}]`);
  if (consumablesToDiscount.length)
    logDetails.push(`Consumibles descontados: [${consumablesToDiscount.map(c => `id:${c.id} x${c.qty}`).join(", ")}]`);

  await supabase.from("logs").insert([{
    action: "Solicitud aprobada",
    table_name: "requests",
    record_id: parseInt(req.params.id),
    details: logDetails.length ? logDetails.join(" | ") : "Aprobada sin ítems directos"
  }]);

  // Broadcast solicitud
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

  // Obtener solicitud con todos los ítems
  const { data: req_data } = await supabase
    .from("requests")
    .select("consumable_id, asset_id, request_type, quantity_requested, request_items(id, asset_id, consumable_id, quantity)")
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
      let newStatus = "available";
      if (ic.return_condition === "dañado")  newStatus = "damaged";
      else if (ic.return_condition === "perdido") newStatus = "maintenance";

      const { data: updatedAsset } = await supabase
        .from("assets")
        .update({ status: newStatus })
        .eq("id", ic.asset_id)
        .select("*")
        .single();
      if (updatedAsset) broadcast("assets", "UPDATE", updatedAsset);
    }
  }

  // ✅ Caso legacy: si no vinieron items_condition pero hay asset_id directo → regresar a available
  if (items_condition.length === 0 && req_data?.asset_id) {
    const { data: updatedAsset } = await supabase
      .from("assets")
      .update({ status: "available" })
      .eq("id", req_data.asset_id)
      .select("*")
      .single();
    if (updatedAsset) broadcast("assets", "UPDATE", updatedAsset);
  }

  // ── NOTA: los consumibles ya se descontaron al APROBAR la solicitud.
  //    Al devolver NO se vuelven a descontar. Solo se loguea la devolución. ──

  // ✅ Log de devolución
  await supabase.from("logs").insert([{
    action: "Devolución registrada",
    table_name: "requests",
    record_id: parseInt(req.params.id),
    details: incident
      ? `Con incidente: ${incident_cause || "Sin descripción"}`
      : "Sin incidentes"
  }]);

  // Broadcast solicitud
  broadcast("requests", "UPDATE", data[0]);

  res.json(data[0]);
});

/* ── ACTUALIZAR SOLICITUD (status, o edición de purpose/notes/items) ── */
router.put("/:id", async (req, res) => {
  const { status, purpose, notes, items, fecha_solicitud, hora_solicitud } = req.body;

  // ── Caso edición de contenido (alumno/docente edita su solicitud pending) ──
  if (purpose !== undefined || notes !== undefined || items !== undefined || fecha_solicitud !== undefined) {
    const { data: current } = await supabase
      .from("requests").select("id, status, request_type").eq("id", req.params.id).single();
    if (!current) return res.status(404).json({ message: "Solicitud no encontrada" });
    if (current.status !== "pending")
      return res.status(400).json({ message: "Solo se pueden editar solicitudes en estado 'pending'" });

    const updateFields = {};
    if (purpose          !== undefined) updateFields.purpose          = purpose          || null;
    if (notes            !== undefined) updateFields.notes            = notes            || null;
    if (fecha_solicitud  !== undefined) updateFields.fecha_solicitud  = fecha_solicitud  || null;
    if (hora_solicitud   !== undefined) updateFields.hora_solicitud   = hora_solicitud   ? hora_solicitud.substring(0,5) : null;

    const { data, error } = await supabase
      .from("requests")
      .update(updateFields)
      .eq("id", req.params.id)
      .select("id, status, purpose, notes, request_type, fecha_solicitud, hora_solicitud");
    if (error) return res.status(500).json(error);

    if (Array.isArray(items) && items.length > 0) {
      await supabase.from("request_items").delete().eq("request_id", req.params.id);
      const newItemRows = items.map(it => ({
        request_id:    parseInt(req.params.id),
        asset_id:      it.asset_id      || null,
        consumable_id: it.consumable_id || null,
        quantity:      parseInt(it.quantity) || 1
      }));
      const { error: itemErr } = await supabase.from("request_items").insert(newItemRows);
      if (itemErr) return res.status(500).json(itemErr);
    }

    broadcast("requests", "UPDATE", data[0]);
    return res.json(data[0]);
  }

  // ── Caso cambio de status ──
  if (!status) return res.status(400).json({ message: "status o campos editables son obligatorios" });
  const valid = ["pending", "pending_admin", "approved", "rejected", "returned"];
  if (!valid.includes(status)) return res.status(400).json({ message: "status inválido" });

  const { data, error } = await supabase
    .from("requests").update({ status }).eq("id", req.params.id).select("id, status");
  if (error) return res.status(500).json(error);

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
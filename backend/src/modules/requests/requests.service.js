const supabase      = require("../../config/supabase");
const { broadcast } = require("../events/events.service");

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
async function getAll(filters = {}) {
  const { status, user_id, docente_id } = filters;
  let q = supabase.from("requests").select(SELECT_FULL).order("request_date", { ascending: false });
  if (status)     q = q.eq("status", status);
  if (user_id)    q = q.eq("user_id", user_id);
  if (docente_id) q = q.eq("docente_id", docente_id);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/* ── OBTENER POR ID ── */
async function getById(id) {
  const { data, error } = await supabase
    .from("requests").select(SELECT_FULL).eq("id", id).single();
  if (error) {
    const err = new Error("No encontrada");
    err.status = 404;
    throw err;
  }
  return data;
}

/* ── CREAR ── */
async function create(body) {
  const {
    user_id, docente_id, request_type, purpose, notes,
    fecha_solicitud, hora_solicitud,
    asset_id, consumable_id, quantity_requested,
    items = []
  } = body;

  // Validar día (no domingo)
  const dow = new Date(fecha_solicitud + "T12:00:00").getDay();
  if (dow === 0) {
    const err = new Error("No se permiten solicitudes los domingos");
    err.status = 400;
    throw err;
  }

  // Validar rango horario (admin tiene ventana ampliada hasta 18:00)
  const normT = t => (t || "").substring(0, 5);
  const hNorm = normT(hora_solicitud);
  const isAdmin = body.role === "administrador"; // se puede pasar role en body opcionalmente
  const maxH  = dow === 6 ? "13:00" : (isAdmin ? "18:00" : "15:00");
  if (hNorm < "07:30") {
    const err = new Error("Hora mínima de solicitud: 07:30 AM");
    err.status = 400;
    throw err;
  }
  if (hNorm > maxH) {
    const err = new Error(`Hora máxima de solicitud: ${dow === 6 ? "1:00 PM (sábado)" : (isAdmin ? "6:00 PM" : "3:00 PM")}`);
    err.status = 400;
    throw err;
  }

  const { data: req_data, error } = await supabase
    .from("requests")
    .insert([{
      user_id,
      docente_id:         docente_id || null,
      asset_id:           items.length ? null : (asset_id      || null),
      consumable_id:      items.length ? null : (consumable_id || null),
      quantity_requested: items.length ? 1    : (parseInt(quantity_requested) || 1),
      notes:              notes        || null,
      purpose:            purpose      || null,
      request_type:       request_type || "asset",
      fecha_solicitud,
      hora_solicitud:     normT(hora_solicitud),
      status: "pending"
    }])
    .select("id, status, request_date, request_type, fecha_solicitud, hora_solicitud")
    .single();

  if (error) throw error;

  // Insertar items multi-ítem
  if (items.length > 0) {
    const itemRows = items.map(it => ({
      request_id:    req_data.id,
      asset_id:      it.asset_id      || null,
      consumable_id: it.consumable_id || null,
      quantity:      parseInt(it.quantity) || 1
    }));
    const { error: itemErr } = await supabase.from("request_items").insert(itemRows);
    if (itemErr) throw itemErr;
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

  broadcast("requests", "INSERT", req_data);
  return req_data;
}

/* ── APROBAR ── */
async function approve(id, body) {
  const { pickup_date, pickup_location, admin_message } = body;

  const { data, error } = await supabase
    .from("requests")
    .update({
      status: "approved",
      pickup_date,
      pickup_location,
      admin_message: admin_message || null,
      approval_date: new Date().toISOString()
    })
    .eq("id", id)
    .select(`
      id, status, pickup_date, pickup_location, admin_message,
      request_type, asset_id, consumable_id, quantity_requested,
      request_items(id, asset_id, consumable_id, quantity)
    `);

  if (error) throw error;
  const solicitud = data[0];

  // Marcar activos como "borrowed"
  const assetsToMark = [];
  if (solicitud.asset_id) assetsToMark.push(solicitud.asset_id);
  for (const item of (solicitud.request_items || [])) {
    if (item.asset_id) assetsToMark.push(item.asset_id);
  }
  for (const assetId of assetsToMark) {
    const { data: updatedAsset } = await supabase
      .from("assets").update({ status: "borrowed" }).eq("id", assetId).select("*").single();
    if (updatedAsset) broadcast("assets", "UPDATE", updatedAsset);
  }

  // Descontar consumibles
  const consumablesToDiscount = [];
  if (solicitud.consumable_id) {
    consumablesToDiscount.push({ id: solicitud.consumable_id, qty: parseInt(solicitud.quantity_requested) || 1 });
  }
  for (const item of (solicitud.request_items || [])) {
    if (item.consumable_id) {
      consumablesToDiscount.push({ id: item.consumable_id, qty: parseInt(item.quantity) || 1 });
    }
  }
  for (const c of consumablesToDiscount) {
    const { data: cons } = await supabase.from("consumables").select("quantity").eq("id", c.id).single();
    if (cons) {
      const newQty = Math.max(0, cons.quantity - c.qty);
      const { data: updatedCons } = await supabase
        .from("consumables").update({ quantity: newQty }).eq("id", c.id)
        .select("id, name, quantity, unit, category_id, categories(name)").single();
      if (updatedCons) broadcast("consumables", "UPDATE", updatedCons);
    }
  }

  // Log aprobación
  const logDetails = [];
  if (assetsToMark.length)
    logDetails.push(`Activos prestados: [${assetsToMark.join(", ")}]`);
  if (consumablesToDiscount.length)
    logDetails.push(`Consumibles descontados: [${consumablesToDiscount.map(c => `id:${c.id} x${c.qty}`).join(", ")}]`);

  await supabase.from("logs").insert([{
    action: "Solicitud aprobada",
    table_name: "requests",
    record_id: parseInt(id),
    details: logDetails.length ? logDetails.join(" | ") : "Aprobada sin ítems directos"
  }]);

  broadcast("requests", "UPDATE", solicitud);
  return solicitud;
}

/* ── RECHAZAR ── */
async function reject(id, body) {
  const { admin_message, rejected_by, rejected_reason } = body;

  const { data, error } = await supabase
    .from("requests")
    .update({
      status: "rejected",
      admin_message:   admin_message   || "Solicitud rechazada",
      rejected_by:     rejected_by     || null,
      rejected_reason: rejected_reason || admin_message || null,
      rejected_at:     new Date().toISOString()
    })
    .eq("id", id)
    .select("id, status, admin_message, rejected_at");

  if (error) throw error;

  await supabase.from("logs").insert([{
    user_id: rejected_by || null,
    action: "Solicitud rechazada",
    table_name: "requests",
    record_id: parseInt(id),
    details: rejected_reason || "Sin razón especificada"
  }]);

  broadcast("requests", "UPDATE", data[0]);
  return data[0];
}

/* ── DEVOLUCIÓN ── */
async function returnRequest(id, body) {
  const { incident, incident_cause, incident_solution, items_condition = [] } = body;

  // Obtener solicitud con ítems
  const { data: req_data } = await supabase
    .from("requests")
    .select("consumable_id, asset_id, request_type, quantity_requested, request_items(id, asset_id, consumable_id, quantity)")
    .eq("id", id).single();

  const { data, error } = await supabase
    .from("requests")
    .update({
      status: "returned",
      return_date: new Date().toISOString(),
      incident: incident || false,
      incident_cause:    incident ? (incident_cause    || null) : null,
      incident_solution: incident ? (incident_solution || null) : null
    })
    .eq("id", id)
    .select("id, status, incident");

  if (error) throw error;

  // Actualizar condición de cada ítem
  for (const ic of items_condition) {
    await supabase.from("request_items")
      .update({
        return_condition:   ic.return_condition   || null,
        replacement_serial: ic.replacement_serial || null
      })
      .eq("id", ic.item_id);

    if (ic.asset_id) {
      let newStatus = "available";
      if (ic.return_condition === "dañado")  newStatus = "damaged";
      else if (ic.return_condition === "perdido") newStatus = "maintenance";

      const { data: updatedAsset } = await supabase
        .from("assets").update({ status: newStatus }).eq("id", ic.asset_id).select("*").single();
      if (updatedAsset) broadcast("assets", "UPDATE", updatedAsset);
    }
  }

  // Caso legacy: sin items_condition pero con asset_id directo
  if (items_condition.length === 0 && req_data?.asset_id) {
    const { data: updatedAsset } = await supabase
      .from("assets").update({ status: "available" }).eq("id", req_data.asset_id).select("*").single();
    if (updatedAsset) broadcast("assets", "UPDATE", updatedAsset);
  }

  await supabase.from("logs").insert([{
    action: "Devolución registrada",
    table_name: "requests",
    record_id: parseInt(id),
    details: incident
      ? `Con incidente: ${incident_cause || "Sin descripción"}`
      : "Sin incidentes"
  }]);

  broadcast("requests", "UPDATE", data[0]);
  return data[0];
}

/* ── ACTUALIZAR (edición o cambio de status) ── */
async function update(id, body) {
  const { status, purpose, notes, items, fecha_solicitud, hora_solicitud } = body;

  // Edición de contenido
  if (purpose !== undefined || notes !== undefined || items !== undefined || fecha_solicitud !== undefined) {
    const { data: current } = await supabase
      .from("requests").select("id, status, request_type").eq("id", id).single();
    if (!current) {
      const err = new Error("Solicitud no encontrada");
      err.status = 404;
      throw err;
    }
    if (current.status !== "pending") {
      const err = new Error("Solo se pueden editar solicitudes en estado 'pending'");
      err.status = 400;
      throw err;
    }

    const updateFields = {};
    if (purpose         !== undefined) updateFields.purpose         = purpose         || null;
    if (notes           !== undefined) updateFields.notes           = notes           || null;
    if (fecha_solicitud !== undefined) updateFields.fecha_solicitud = fecha_solicitud || null;
    if (hora_solicitud  !== undefined) updateFields.hora_solicitud  = hora_solicitud  ? hora_solicitud.substring(0, 5) : null;

    const { data, error } = await supabase
      .from("requests").update(updateFields).eq("id", id)
      .select("id, status, purpose, notes, request_type, fecha_solicitud, hora_solicitud");
    if (error) throw error;

    if (Array.isArray(items) && items.length > 0) {
      await supabase.from("request_items").delete().eq("request_id", id);
      const newItemRows = items.map(it => ({
        request_id:    parseInt(id),
        asset_id:      it.asset_id      || null,
        consumable_id: it.consumable_id || null,
        quantity:      parseInt(it.quantity) || 1
      }));
      const { error: itemErr } = await supabase.from("request_items").insert(newItemRows);
      if (itemErr) throw itemErr;
    }

    broadcast("requests", "UPDATE", data[0]);
    return data[0];
  }

  // Cambio de status
  const valid = ["pending", "pending_admin", "approved", "rejected", "returned"];
  if (!valid.includes(status)) {
    const err = new Error("status inválido");
    err.status = 400;
    throw err;
  }

  const { data, error } = await supabase
    .from("requests").update({ status }).eq("id", id).select("id, status");
  if (error) throw error;

  broadcast("requests", "UPDATE", data[0]);
  return data[0];
}

/* ── ELIMINAR ── */
async function remove(id) {
  const { error } = await supabase.from("requests").delete().eq("id", id);
  if (error) throw error;
  broadcast("requests", "DELETE", { id });
  return { message: "Solicitud eliminada" };
}

module.exports = { getAll, getById, create, approve, reject, returnRequest, update, remove };
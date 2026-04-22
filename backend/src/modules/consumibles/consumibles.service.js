const supabase      = require("../../config/supabase");
const { broadcast } = require("../events/events.service");

const SELECT_FIELDS = "id, name, description, category_id, quantity, min_quantity, unit, expiry_date, location, area, categories(id, name)";

/* ── LISTAR ── */
async function getAll() {
  const { data, error } = await supabase
    .from("consumables")
    .select(SELECT_FIELDS)
    .order("name");
  if (error) {
    console.error("[consumibles.service] getAll error:", error);
    throw error;
  }
  return data;
}

/* ── OBTENER POR ID ── */
async function getById(id) {
  const { data, error } = await supabase
    .from("consumables")
    .select(SELECT_FIELDS)
    .eq("id", id)
    .single();
  if (error) {
    const err = new Error("Consumible no encontrado");
    err.status = 404;
    throw err;
  }
  return data;
}

/* ── CREAR ── */
async function create(fields) {
  const { name, description, category_id, quantity, min_quantity, unit, expiry_date, location, area } = fields;

  // Validar fecha de caducidad: no puede ser anterior a hoy
  if (expiry_date) {
    const today = new Date(); today.setHours(0,0,0,0);
    const exp   = new Date(expiry_date + "T00:00:00");
    if (exp < today) {
      const err = new Error("La fecha de caducidad no puede ser anterior a hoy");
      err.status = 400; throw err;
    }
  }

  const { data, error } = await supabase
    .from("consumables")
    .insert([{
      name,
      description:  description  || null,
      category_id:  parseInt(category_id),
      quantity:     parseFloat(quantity)     || 0,
      min_quantity: parseFloat(min_quantity) || 0,
      unit,
      expiry_date:  expiry_date  || null,
      location:     location     || null,
      area:         area         || null,
    }])
    .select(SELECT_FIELDS);

  if (error) throw error;
  broadcast("consumables", "INSERT", data[0]);
  return data[0];
}

/* ── ACTUALIZAR ── */
async function update(id, fields) {
  const { name, description, category_id, quantity, min_quantity, unit, expiry_date, location, area } = fields;

  // Validar fecha de caducidad
  if (expiry_date) {
    const today = new Date(); today.setHours(0,0,0,0);
    const exp   = new Date(expiry_date + "T00:00:00");
    if (exp < today) {
      const err = new Error("La fecha de caducidad no puede ser anterior a hoy");
      err.status = 400; throw err;
    }
  }

  const { data, error } = await supabase
    .from("consumables")
    .update({
      name,
      description:  description  || null,
      category_id:  parseInt(category_id),
      quantity:     parseFloat(quantity)     || 0,
      min_quantity: parseFloat(min_quantity) || 0,
      unit,
      expiry_date:  expiry_date  || null,
      location:     location     || null,
      area:         area         || null,
    })
    .eq("id", id)
    .select(SELECT_FIELDS);

  if (error) throw error;
  if (!data || data.length === 0) {
    const err = new Error("No encontrado"); err.status = 404; throw err;
  }
  broadcast("consumables", "UPDATE", data[0]);
  return data[0];
}

/* ── ELIMINAR ── */
async function remove(id) {
  // Verificar si hay solicitudes ACTIVAS (no terminadas) que referencian este consumible
  const { data: activeRequests, error: checkError } = await supabase
    .from("request_items")
    .select("request_id, requests!inner(id, status)")
    .eq("consumable_id", id)
    .not("requests.status", "in", '("returned","rejected")');

  if (checkError) throw checkError;

  if (activeRequests && activeRequests.length > 0) {
    const statuses = [...new Set(activeRequests.map(r => r.requests?.status).filter(Boolean))].join(", ");
    const err = new Error(`No se puede eliminar: este consumible tiene solicitudes activas (${statuses}). Solo se puede eliminar cuando todas sus solicitudes estén devueltas o rechazadas.`);
    err.status = 409;
    throw err;
  }

  // Sin solicitudes activas — borrar primero los request_items históricos para liberar la FK
  await supabase.from("request_items").delete().eq("consumable_id", id);

  const { error } = await supabase
    .from("consumables")
    .delete()
    .eq("id", id);

  if (error) throw error;

  broadcast("consumables", "DELETE", { id });
  return { message: "Consumible eliminado" };
}

module.exports = { getAll, getById, create, update, remove };
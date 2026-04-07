const supabase      = require("../../config/supabase");
const { broadcast } = require("../events/events.service");

const SELECT_FIELDS = "id, name, description, category_id, quantity, min_quantity, unit, categories(name)";

/* ── LISTAR ── */
async function getAll() {
  const { data, error } = await supabase
    .from("consumables")
    .select(SELECT_FIELDS)
    .order("name");
  if (error) throw error;
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
  const { name, description, category_id, quantity, min_quantity, unit } = fields;

  const { data, error } = await supabase
    .from("consumables")
    .insert([{
      name,
      description:  description || null,
      category_id:  parseInt(category_id),
      quantity:     parseInt(quantity)     || 0,
      min_quantity: parseInt(min_quantity) || 0,
      unit,
    }])
    .select(SELECT_FIELDS);

  if (error) throw error;

  broadcast("consumables", "INSERT", data[0]);
  return data[0];
}

/* ── ACTUALIZAR ── */
async function update(id, fields) {
  const { name, description, category_id, quantity, min_quantity, unit } = fields;

  const { data, error } = await supabase
    .from("consumables")
    .update({
      name,
      description:  description || null,
      category_id:  parseInt(category_id),
      quantity:     parseInt(quantity)     || 0,
      min_quantity: parseInt(min_quantity) || 0,
      unit,
    })
    .eq("id", id)
    .select(SELECT_FIELDS);

  if (error) throw error;
  if (!data || data.length === 0) {
    const err = new Error("No encontrado");
    err.status = 404;
    throw err;
  }

  broadcast("consumables", "UPDATE", data[0]);
  return data[0];
}

/* ── ELIMINAR ── */
async function remove(id) {
  const { error } = await supabase
    .from("consumables")
    .delete()
    .eq("id", id);

  if (error) throw error;

  broadcast("consumables", "DELETE", { id });
  return { message: "Consumible eliminado" };
}

module.exports = { getAll, getById, create, update, remove };
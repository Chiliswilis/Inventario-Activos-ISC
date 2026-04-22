const supabase      = require("../../config/supabase");
const { broadcast } = require("../events/events.service");

const getAll = async () => {
  const { data, error } = await supabase
    .from("assets").select("*, categories(name)").order("id");
  if (error) throw error;
  return data;
};

const getSummary = async () => {
  const { data, error } = await supabase.from("assets").select("status");
  if (error) throw error;
  const summary = { available: 0, borrowed: 0, maintenance: 0, damaged: 0 };
  data.forEach(a => { if (summary[a.status] !== undefined) summary[a.status]++; });
  return summary;
};

const getLogs = async (id) => {
  const { data, error } = await supabase
    .from("logs").select("*, users(username, role)")
    .eq("item_type", "asset").eq("item_id", id)
    .order("timestamp", { ascending: false }).limit(50);
  if (error) throw error;
  return data;
};

const getById = async (id) => {
  const { data, error } = await supabase
    .from("assets").select("*, categories(name)").eq("id", id).single();
  if (error) throw { status: 404, message: "Activo no encontrado" };
  return data;
};

const create = async (body) => {
  const { name, description, category_id, location, status, quantity, area } = body;
  // Para laboratorio el serial es opcional — generamos uno interno si no viene
  let serial_number = body.serial_number || null;
  if (!serial_number && area === "laboratorio") {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const block  = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
    serial_number = `LAB-${block()}-${block()}`;
  }
  const { data, error } = await supabase
    .from("assets")
    .insert([{ name, description, category_id, serial_number, location, area: area || null, status: status || "available", quantity: parseInt(quantity) || 1 }])
    .select("*, categories(name)");
  if (error) throw error;

  await supabase.from("logs").insert([{
    action: "Activo creado", table_name: "assets", record_id: data[0].id,
    item_type: "asset", item_id: data[0].id, details: `${name} (${serial_number})`
  }]);

  broadcast("assets", "INSERT", data[0]);
  return data[0];
};

const update = async (id, body) => {
  const { name, description, category_id, serial_number, location, status, quantity, condition_notes } = body;
  const validStatus = ["available", "borrowed", "maintenance", "damaged"];
  if (status && !validStatus.includes(status)) throw { status: 400, message: "Status inválido" };

  const { data, error } = await supabase
    .from("assets")
    .update({ name, description, category_id, serial_number, location, status, quantity: parseInt(quantity) || 1, condition_notes: condition_notes || null })
    .eq("id", id).select("*, categories(name)");
  if (error) throw error;
  if (!data || data.length === 0) throw { status: 404, message: "No encontrado" };

  await supabase.from("logs").insert([{
    action: "Activo actualizado", table_name: "assets", record_id: parseInt(id),
    item_type: "asset", item_id: parseInt(id), details: `Status: ${status}`
  }]);

  broadcast("assets", "UPDATE", data[0]);
  return data[0];
};

const remove = async (id) => {
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) throw error;
  broadcast("assets", "DELETE", { id });
};

module.exports = { getAll, getSummary, getLogs, getById, create, update, remove };
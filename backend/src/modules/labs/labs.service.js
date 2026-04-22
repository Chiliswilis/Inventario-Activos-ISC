// labs.service.js  –  Módulo de laboratorios con soporte de estado (activo / mantenimiento / inactivo)
const supabase      = require("../../config/supabase");
const { broadcast } = require("../events/events.service");

const getAll = async () => {
  const { data, error } = await supabase
    .from("labs")
    .select("id, edificio, nombre, capacidad, open_time, close_time, activo, status")
    .order("edificio", { ascending: true })
    .order("nombre",   { ascending: true });
  if (error) throw error;
  return data;
};

const getById = async (id) => {
  const { data, error } = await supabase
    .from("labs")
    .select("id, edificio, nombre, capacidad, open_time, close_time, activo, status")
    .eq("id", id).single();
  if (error) throw { status: 404, message: "Laboratorio no encontrado" };
  return data;
};

const create = async (body) => {
  const { edificio, nombre, capacidad, open_time, close_time, activo, status } = body;
  if (!edificio || !nombre) throw { status: 400, message: "edificio y nombre son obligatorios" };

  // Validar edificio
  const edificiosValidos = ["Edificio A", "Edificio B", "Edificio C"];
  if (!edificiosValidos.includes(edificio))
    throw { status: 400, message: `Edificio inválido. Opciones: ${edificiosValidos.join(", ")}` };

  const { data, error } = await supabase
    .from("labs")
    .insert([{
      edificio,
      nombre,
      capacidad: capacidad || null,
      open_time:  open_time  || "07:30",
      close_time: close_time || "15:00",
      activo: activo !== false && activo !== "false",
      status: status || "active"
    }])
    .select("id, edificio, nombre, activo, status")
    .single();
  if (error) throw error;

  broadcast("labs", "INSERT", data);
  return data;
};

const update = async (id, body) => {
  const { edificio, nombre, capacidad, open_time, close_time, activo, status: labStatus } = body;

  if (edificio) {
    const edificiosValidos = ["Edificio A", "Edificio B", "Edificio C"];
    if (!edificiosValidos.includes(edificio))
      throw { status: 400, message: `Edificio inválido. Opciones: ${edificiosValidos.join(", ")}` };
  }

  const payload = {};
  if (edificio   !== undefined) payload.edificio   = edificio;
  if (nombre     !== undefined) payload.nombre     = nombre;
  if (capacidad  !== undefined) payload.capacidad  = capacidad;
  if (open_time  !== undefined) payload.open_time  = open_time;
  if (close_time !== undefined) payload.close_time = close_time;
  if (activo     !== undefined) payload.activo     = activo !== false && activo !== "false";
  if (labStatus  !== undefined) payload.status     = labStatus;

  const { data, error } = await supabase
    .from("labs")
    .update(payload)
    .eq("id", id)
    .select("id, edificio, nombre, activo, status")
    .single();
  if (error) throw error;

  broadcast("labs", "UPDATE", data);
  return data;
};

const remove = async (id) => {
  const { error } = await supabase.from("labs").delete().eq("id", id);
  if (error) throw error;
  broadcast("labs", "DELETE", { id });
};

module.exports = { getAll, getById, create, update, remove };
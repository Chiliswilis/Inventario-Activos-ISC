const express  = require("express");
const router   = express.Router();
const supabase = require("./supabase");

// Laboratorios válidos por edificio
const LABS = {
  "Edificio A": ["Laboratorio de Ciencias Básicas", "Laboratorio A"],
  "Edificio B": ["Laboratorio A", "Laboratorio B"]
};

/* ── LISTAR (con filtros opcionales por query params) ── */
router.get("/", async (req, res) => {
  const { alumno_id, docente_id, status, fecha } = req.query;

  let query = supabase
    .from("reservations")
    .select(`
      id, edificio, laboratorio, grupo, semestre, encargado_grupo,
      fecha_solicitud, fecha_uso, hora_inicio, hora_fin,
      proposito, status, docente_message,
      entrada_fecha, entrada_nota, salida_fecha, salida_nota,
      consumable_id, consumable_cantidad, consumable_entrega,
      alumno_id, docente_id,
      alumno:users!reservations_alumno_id_fkey(id, username, email),
      docente:users!reservations_docente_id_fkey(id, username),
      consumables(id, name, unit)
    `)
    .order("fecha_uso", { ascending: false })
    .order("hora_inicio", { ascending: true });

  if (alumno_id) query = query.eq("alumno_id", alumno_id);
  if (docente_id) query = query.eq("docente_id", docente_id);
  if (status) query = query.eq("status", status);
  if (fecha) query = query.eq("fecha_uso", fecha);

  const { data, error } = await query;
  if (error) return res.status(500).json(error);
  res.json(data);
});

/* ── OBTENER POR ID ── */
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("reservations")
    .select(`
      id, edificio, laboratorio, grupo, semestre, encargado_grupo,
      fecha_solicitud, fecha_uso, hora_inicio, hora_fin,
      proposito, status, docente_message,
      entrada_fecha, entrada_nota, salida_fecha, salida_nota,
      consumable_id, consumable_cantidad, consumable_entrega,
      alumno_id, docente_id,
      alumno:users!reservations_alumno_id_fkey(id, username, email),
      docente:users!reservations_docente_id_fkey(id, username),
      consumables(id, name, unit)
    `)
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ message: "Reserva no encontrada" });
  res.json(data);
});

/* ── CREAR (alumno solicita) ── */
router.post("/", async (req, res) => {
  const {
    alumno_id, docente_id,
    edificio, laboratorio,
    fecha_uso, hora_inicio, hora_fin,
    proposito,
    consumable_id, consumable_cantidad
  } = req.body;

  // Validaciones
  if (!alumno_id || !docente_id)
    return res.status(400).json({ message: "alumno_id y docente_id son obligatorios" });
  if (!edificio || !laboratorio)
    return res.status(400).json({ message: "Edificio y laboratorio son obligatorios" });
  if (!LABS[edificio] || !LABS[edificio].includes(laboratorio))
    return res.status(400).json({ message: `Laboratorio inválido para ${edificio}` });
  if (!fecha_uso || !hora_inicio || !hora_fin)
    return res.status(400).json({ message: "Fecha y horario son obligatorios" });
  if (!proposito)
    return res.status(400).json({ message: "El propósito de la solicitud es obligatorio" });

  const { data, error } = await supabase
    .from("reservations")
    .insert([{
      alumno_id,
      docente_id,
      edificio,
      laboratorio,
      fecha_uso,
      hora_inicio,
      hora_fin,
      proposito,
      consumable_id:      consumable_id      || null,
      consumable_cantidad: consumable_cantidad || null,
      status: "pending"
    }])
    .select(`
      id, edificio, laboratorio, fecha_uso, hora_inicio, hora_fin,
      proposito, status,
      alumno:users!reservations_alumno_id_fkey(id, username),
      docente:users!reservations_docente_id_fkey(id, username)
    `);

  if (error) return res.status(500).json(error);

  // Log
  await supabase.from("logs").insert([{
    user_id: alumno_id,
    action: "Reserva solicitada",
    table_name: "reservations",
    record_id: data[0].id,
    details: `${edificio} - ${laboratorio} para ${fecha_uso}`
  }]);

  res.json(data[0]);
});

/* ── DOCENTE APRUEBA + LLENA BITÁCORA DE ENTRADA ── */
router.put("/:id/approve", async (req, res) => {
  const { grupo, semestre, encargado_grupo, docente_message, entrada_nota } = req.body;

  if (!grupo || !semestre)
    return res.status(400).json({ message: "grupo y semestre son obligatorios para la bitácora" });

  const { data, error } = await supabase
    .from("reservations")
    .update({
      status: "approved",
      grupo,
      semestre,
      encargado_grupo: encargado_grupo || null,
      docente_message: docente_message || null,
      entrada_fecha: new Date().toISOString(),
      entrada_nota: entrada_nota || null
    })
    .eq("id", req.params.id)
    .select("id, status, grupo, semestre, entrada_fecha");

  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

/* ── DOCENTE MARCA COMO OCUPADO (inicio de práctica) ── */
router.put("/:id/occupy", async (req, res) => {
  const { data, error } = await supabase
    .from("reservations")
    .update({ status: "occupied" })
    .eq("id", req.params.id)
    .select("id, status");

  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

/* ── DOCENTE FIRMA SALIDA (libera el laboratorio) ── */
router.put("/:id/release", async (req, res) => {
  const { salida_nota } = req.body;

  const { data, error } = await supabase
    .from("reservations")
    .update({
      status: "released",
      salida_fecha: new Date().toISOString(),
      salida_nota: salida_nota || null
    })
    .eq("id", req.params.id)
    .select("id, status, salida_fecha, salida_nota");

  if (error) return res.status(500).json(error);

  // Log de liberación
  const { data: res_data } = await supabase
    .from("reservations")
    .select("alumno_id, edificio, laboratorio")
    .eq("id", req.params.id)
    .single();

  if (res_data) {
    await supabase.from("logs").insert([{
      user_id: res_data.alumno_id,
      action: "Laboratorio liberado",
      table_name: "reservations",
      record_id: parseInt(req.params.id),
      details: `${res_data.edificio} - ${res_data.laboratorio} liberado`
    }]);
  }

  res.json(data[0]);
});

/* ── ADMIN DEFINE HORA DE ENTREGA DE CONSUMIBLE ── */
router.put("/:id/consumable-schedule", async (req, res) => {
  const { consumable_entrega } = req.body;
  if (!consumable_entrega)
    return res.status(400).json({ message: "consumable_entrega es obligatorio" });

  const { data, error } = await supabase
    .from("reservations")
    .update({ consumable_entrega })
    .eq("id", req.params.id)
    .select("id, consumable_entrega");

  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

/* ── CANCELAR (docente o admin) ── */
router.put("/:id/cancel", async (req, res) => {
  const { docente_message } = req.body;

  const { data, error } = await supabase
    .from("reservations")
    .update({
      status: "cancelled",
      docente_message: docente_message || "Solicitud cancelada"
    })
    .eq("id", req.params.id)
    .select("id, status, docente_message");

  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

/* ── ELIMINAR (solo admin) ── */
router.delete("/:id", async (req, res) => {
  const { error } = await supabase.from("reservations").delete().eq("id", req.params.id);
  if (error) return res.status(500).json(error);
  res.json({ message: "Reserva eliminada" });
});

module.exports = router;
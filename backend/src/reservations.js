const express  = require("express");
const router   = express.Router();
const supabase = require("./supabase");

const SELECT_FULL = `
  id, grupo, semestre, encargado_grupo,
  fecha_solicitud, fecha_uso, hora_inicio, hora_fin,
  proposito, status, docente_message, created_at,
  alumno_id, docente_id, lab_id,
  alumno:users!reservations_alumno_id_fkey(id, username, email),
  docente:users!reservations_docente_id_fkey(id, username),
  lab:labs(id, edificio, nombre, capacidad, open_time, close_time),
  reservation_consumables(
    id, quantity_requested, quantity_delivered, leftover_qty,
    consumables(id, name, unit)
  )
`;

/* ── LISTAR ── */
router.get("/", async (req, res) => {
  const { alumno_id, docente_id, status, fecha } = req.query;
  let q = supabase.from("reservations").select(SELECT_FULL)
    .order("fecha_uso", { ascending: false })
    .order("hora_inicio", { ascending: true });

  if (alumno_id)  q = q.eq("alumno_id",  alumno_id);
  if (docente_id) q = q.eq("docente_id", docente_id);
  if (status)     q = q.eq("status",     status);
  if (fecha)      q = q.eq("fecha_uso",  fecha);

  const { data, error } = await q;
  if (error) return res.status(500).json(error);
  res.json(data);
});

/* ── OBTENER POR ID ── */
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("reservations").select(SELECT_FULL).eq("id", req.params.id).single();
  if (error) return res.status(404).json({ message: "Reserva no encontrada" });
  res.json(data);
});

/* ── CREAR ── */
router.post("/", async (req, res) => {
  const {
    alumno_id, docente_id, lab_id,
    fecha_uso, hora_inicio, hora_fin,
    proposito,
    consumables = [],   // [{ consumable_id, quantity_requested }]
    assets      = []    // [{ asset_id }]  — activos adicionales para la práctica
  } = req.body;

  // Validaciones obligatorias
  if (!alumno_id)
    return res.status(400).json({ message: "alumno_id es obligatorio" });
  if (!docente_id)
    return res.status(400).json({ message: "docente_id es obligatorio" });
  if (!lab_id)
    return res.status(400).json({ message: "lab_id es obligatorio" });
  if (!fecha_uso || !hora_inicio || !hora_fin)
    return res.status(400).json({ message: "Fecha y horario son obligatorios" });
  if (!proposito)
    return res.status(400).json({ message: "El propósito es obligatorio" });

  // Validar que no sea fin de semana
  const dow = new Date(fecha_uso + "T12:00:00").getDay(); // 0=Dom, 6=Sab
  if (dow === 0 || dow === 6)
    return res.status(400).json({ message: "No se pueden hacer reservas en fines de semana" });

  // Validar laboratorio activo y horario
  const { data: lab } = await supabase
    .from("labs").select("edificio,nombre,open_time,close_time,activo").eq("id", lab_id).single();
  if (!lab || !lab.activo)
    return res.status(400).json({ message: "Laboratorio no disponible" });
  if (hora_inicio < lab.open_time || hora_fin > lab.close_time)
    return res.status(400).json({
      message: `Horario fuera del rango permitido (${lab.open_time}–${lab.close_time})`
    });

  // Verificar traslape de horario
  const { data: overlap } = await supabase
    .from("reservations")
    .select("id")
    .eq("lab_id",   lab_id)
    .eq("fecha_uso", fecha_uso)
    .in("status", ["approved", "occupied"])
    .lt("hora_inicio", hora_fin)
    .gt("hora_fin",    hora_inicio);

  if (overlap && overlap.length > 0)
    return res.status(400).json({
      message: "El laboratorio ya tiene una reserva aprobada en ese horario"
    });

  // Insertar reserva
  const { data: resv, error } = await supabase
    .from("reservations")
    .insert([{
      alumno_id:   parseInt(alumno_id),
      docente_id:  parseInt(docente_id),
      lab_id:      parseInt(lab_id),
      edificio:    lab.edificio,
      laboratorio: lab.nombre,
      fecha_uso, hora_inicio, hora_fin, proposito,
      status: "pending"
    }])
    .select("id, status, fecha_uso, hora_inicio, hora_fin")
    .single();

  if (error) return res.status(500).json(error);

  // Insertar consumibles
  if (consumables.length > 0) {
    const rows = consumables.map(c => ({
      reservation_id:     resv.id,
      consumable_id:      parseInt(c.consumable_id),
      quantity_requested: parseInt(c.quantity_requested) || 1
    }));
    const { error: consErr } = await supabase.from("reservation_consumables").insert(rows);
    if (consErr) return res.status(500).json(consErr);
  }

  // Marcar activos como "borrowed" si se enviaron
  if (assets.length > 0) {
    for (const a of assets) {
      if (a.asset_id) {
        await supabase
          .from("assets")
          .update({ status: "borrowed" })
          .eq("id", parseInt(a.asset_id));
      }
    }
  }

  // Log
  await supabase.from("logs").insert([{
    user_id:    parseInt(alumno_id),
    action:     "Reserva solicitada",
    table_name: "reservations",
    record_id:  resv.id,
    item_type:  "lab",
    item_id:    parseInt(lab_id),
    details:    `Lab ID ${lab_id} para ${fecha_uso} ${hora_inicio}–${hora_fin}`
  }]);

  res.json(resv);
});

/* ── DOCENTE APRUEBA ── */
router.put("/:id/approve", async (req, res) => {
  const { grupo, semestre, encargado_grupo, docente_message } = req.body;
  if (!grupo || !semestre)
    return res.status(400).json({ message: "grupo y semestre son obligatorios" });

  const { data, error } = await supabase
    .from("reservations")
    .update({
      status: "approved",
      grupo, semestre,
      encargado_grupo: encargado_grupo || null,
      docente_message: docente_message || null
    })
    .eq("id", req.params.id)
    .select("id, status, grupo, semestre");

  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

/* ── MARCAR EN USO ── */
router.put("/:id/occupy", async (req, res) => {
  const { data, error } = await supabase
    .from("reservations")
    .update({ status: "occupied", entrada_fecha: new Date().toISOString() })
    .eq("id", req.params.id)
    .select("id, status");
  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

/* ── LIBERAR (fin de práctica) + sobrante de consumibles ── */
router.put("/:id/release", async (req, res) => {
  const { leftover_items = [] } = req.body;

  const { data, error } = await supabase
    .from("reservations")
    .update({ status: "released", salida_fecha: new Date().toISOString() })
    .eq("id", req.params.id)
    .select("id, status, alumno_id, lab_id");

  if (error) return res.status(500).json(error);

  // Registrar sobrantes
  for (const li of leftover_items) {
    await supabase.from("reservation_consumables")
      .update({ leftover_qty: li.leftover_qty })
      .eq("id", li.reservation_consumable_id);
  }

  // Liberar activos que estaban borrowed por esta reserva
  // (Se restauran a "available" al liberar el laboratorio)
  // Para hacerlo correctamente obtener los asset_ids del request si se guardaron en logs/tablas auxiliares.
  // Como el esquema actual no tiene tabla reservation_assets, se libera basado en el log.
  // Si se desea persistencia completa, agregar tabla reservation_assets.

  // Log
  await supabase.from("logs").insert([{
    user_id:    data[0].alumno_id,
    action:     "Laboratorio liberado",
    table_name: "reservations",
    record_id:  parseInt(req.params.id),
    item_type:  "lab",
    item_id:    data[0].lab_id
  }]);

  res.json(data[0]);
});

/* ── CANCELAR ── */
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

/* ── ELIMINAR ── */
router.delete("/:id", async (req, res) => {
  const { error } = await supabase.from("reservations").delete().eq("id", req.params.id);
  if (error) return res.status(500).json(error);
  res.json({ message: "Reserva eliminada" });
});

module.exports = router;
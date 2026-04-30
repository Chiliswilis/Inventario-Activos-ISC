const supabase      = require("../../config/supabase");
const { broadcast } = require("../events/events.service");

const SELECT_FULL = `
  id, grupo, semestre, encargado_grupo,
  fecha_solicitud, fecha_uso, hora_inicio, hora_fin,
  proposito, status, docente_message, created_at,
  alumno_id, docente_id, lab_id,
  alumno:users!reservations_alumno_id_fkey(id, username, email),
  docente:users!reservations_docente_id_fkey(id, username),
  lab:labs(id, edificio, nombre, capacidad, open_time, close_time, activo, status),
  reservation_consumables(
    id, quantity_requested, quantity_delivered, leftover_qty,
    consumables(id, name, unit)
  ),
  reservation_assets(
    id, asset_id,
    assets(id, name, serial_number)
  )
`;

const getAll = async (filters = {}) => {
  const { alumno_id, docente_id, status, fecha } = filters;
  let q = supabase.from("reservations").select(SELECT_FULL)
    .order("fecha_uso", { ascending: false })
    .order("hora_inicio", { ascending: true });

  if (alumno_id)  q = q.eq("alumno_id",  alumno_id);
  if (docente_id) q = q.eq("docente_id", docente_id);
  if (status)     q = q.eq("status",     status);
  if (fecha)      q = q.eq("fecha_uso",  fecha);

  const { data, error } = await q;
  if (error) throw error;
  return data;
};

const getById = async (id) => {
  const { data, error } = await supabase
    .from("reservations").select(SELECT_FULL).eq("id", id).single();
  if (error) throw { status: 404, message: "Reserva no encontrada" };
  return data;
};

const create = async (body) => {
  const {
    alumno_id, docente_id, lab_id,
    fecha_uso, hora_inicio, hora_fin,
    proposito, num_alumnos,
    consumables = [],
    assets = []
  } = body;

  const dow = new Date(fecha_uso + "T12:00:00").getDay();
  if (dow === 0) throw { status: 400, message: "No se pueden hacer reservas los domingos" };

  const { data: lab } = await supabase
    .from("labs").select("edificio,nombre,open_time,close_time,activo,status").eq("id", lab_id).single();
  if (!lab || !lab.activo) throw { status: 400, message: "Laboratorio no disponible" };
  if (lab.status === "maintenance") throw { status: 400, message: "El laboratorio está en mantenimiento" };

  const normTime = t => (t || "").substring(0, 5);
  const horaIniN = normTime(hora_inicio);
  const horaFinN = normTime(hora_fin);
  const isSat    = dow === 6;
  const maxPermit = isSat ? "13:00" : "15:00";

  if (horaIniN < "07:30") throw { status: 400, message: "Hora mínima de inicio: 7:30 AM" };
  if (horaFinN > maxPermit) throw { status: 400, message: `Hora máxima de fin: ${isSat ? "1:00 PM (sábado)" : "3:00 PM"}` };
  if (horaFinN <= horaIniN) throw { status: 400, message: "La hora de fin debe ser mayor que la de inicio" };

  const [hI, mI] = horaIniN.split(":").map(Number);
  const [hF, mF] = horaFinN.split(":").map(Number);
  if ((hF * 60 + mF) - (hI * 60 + mI) < 60)
    throw { status: 400, message: "La reserva debe durar al menos 1 hora" };

  const { data: overlap } = await supabase
    .from("reservations").select("id")
    .eq("lab_id", lab_id).eq("fecha_uso", fecha_uso)
    .in("status", ["approved", "occupied"])
    .lt("hora_inicio", hora_fin).gt("hora_fin", hora_inicio);

  if (overlap && overlap.length > 0)
    throw { status: 400, message: "El laboratorio ya tiene una reserva aprobada en ese horario" };

  const { data: resv, error } = await supabase
    .from("reservations")
    .insert([{
      alumno_id: parseInt(alumno_id), docente_id: parseInt(docente_id),
      lab_id: parseInt(lab_id), edificio: lab.edificio, laboratorio: lab.nombre,
      fecha_uso, hora_inicio, hora_fin, proposito,
      num_alumnos: parseInt(num_alumnos) || 0,
      status: "pending"
    }])
    .select("id, status, fecha_uso, hora_inicio, hora_fin").single();

  if (error) throw error;

  if (consumables.length > 0) {
    const rows = consumables.map(c => ({
      reservation_id: resv.id,
      consumable_id: parseInt(c.consumable_id),
      quantity_requested: parseInt(c.quantity_requested) || 1
    }));
    const { error: consErr } = await supabase.from("reservation_consumables").insert(rows);
    if (consErr) throw consErr;
  }

  if (assets.length > 0) {
    const assetRows = [];
    for (const a of assets) {
      if (!a.asset_id) continue;
      const aid = parseInt(a.asset_id);
      assetRows.push({ reservation_id: resv.id, asset_id: aid });
      await supabase.from("assets").update({ status: "borrowed" }).eq("id", aid);
    }
    if (assetRows.length > 0) await supabase.from("reservation_assets").insert(assetRows);
  }

  await supabase.from("logs").insert([{
    user_id: parseInt(alumno_id), action: "Reserva solicitada",
    table_name: "reservations", record_id: resv.id,
    item_type: "lab", item_id: parseInt(lab_id),
    details: `Lab ID ${lab_id} para ${fecha_uso} ${hora_inicio}–${hora_fin}`
  }]);

  broadcast("reservations", "INSERT", resv);
  return resv;
};

// FIX: función para editar reserva en estado pending
const update = async (id, body) => {
  const { lab_id, fecha_uso, hora_inicio, hora_fin, proposito } = body;

  if (!lab_id || !fecha_uso || !hora_inicio || !hora_fin || !proposito)
    throw { status: 400, message: "Todos los campos son obligatorios" };

  const { data: lab } = await supabase
    .from("labs").select("edificio,nombre,activo,status").eq("id", lab_id).single();
  if (!lab) throw { status: 400, message: "Laboratorio no encontrado" };
  if (!lab.activo) throw { status: 400, message: "Laboratorio no disponible" };
  if (lab.status === "maintenance") throw { status: 400, message: "El laboratorio está en mantenimiento" };

  const normTime = t => (t || "").substring(0, 5);
  const horaIniN = normTime(hora_inicio);
  const horaFinN = normTime(hora_fin);

  if (horaFinN <= horaIniN) throw { status: 400, message: "La hora de fin debe ser mayor que la de inicio" };
  const [hI, mI] = horaIniN.split(":").map(Number);
  const [hF, mF] = horaFinN.split(":").map(Number);
  if ((hF * 60 + mF) - (hI * 60 + mI) < 60)
    throw { status: 400, message: "La reserva debe durar al menos 1 hora" };

  // Verificar traslape excluyendo la reserva actual
  const { data: overlap } = await supabase
    .from("reservations").select("id")
    .eq("lab_id", lab_id).eq("fecha_uso", fecha_uso)
    .in("status", ["approved", "occupied"])
    .lt("hora_inicio", hora_fin).gt("hora_fin", hora_inicio)
    .neq("id", id);

  if (overlap && overlap.length > 0)
    throw { status: 400, message: "El laboratorio ya tiene una reserva aprobada en ese horario" };

  const { data, error } = await supabase
    .from("reservations")
    .update({
      lab_id: parseInt(lab_id),
      edificio: lab.edificio,
      laboratorio: lab.nombre,
      fecha_uso, hora_inicio, hora_fin, proposito
    })
    .eq("id", id)
    .select("id, status, fecha_uso, hora_inicio, hora_fin")
    .single();

  if (error) throw error;
  broadcast("reservations", "UPDATE", data);
  return data;
};

const approve = async (id, body) => {
  const { grupo, semestre, encargado_grupo, docente_message, approval_date } = body;
  const { data, error } = await supabase
    .from("reservations")
    .update({
      status: "approved",
      grupo,
      semestre,
      encargado_grupo:  encargado_grupo  || null,
      docente_message:  docente_message  || null,
      approval_date:    approval_date    || new Date().toISOString().split("T")[0]
    })
    .eq("id", id).select("id, status, grupo, semestre");
  if (error) throw error;
  broadcast("reservations", "UPDATE", data[0]);
  return data[0];
};

// BUG 4 FIX: El servidor corre en UTC. La zona horaria de México es UTC-6
// (UTC-5 en horario de verano). Para que la validación de hora funcione
// correctamente se obtiene la hora local de México a partir de UTC.
const getMexicoNow = () => {
  // Intenta usar la zona horaria oficial de México (CDT/CST automático)
  try {
    const mxStr = new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" });
    return new Date(mxStr);
  } catch {
    // Fallback: UTC-6 fijo si la zona no está disponible en el entorno
    const now = new Date();
    now.setHours(now.getHours() - 6);
    return now;
  }
};

const occupy = async (id) => {
  const { data: resv } = await supabase
    .from("reservations").select("id, fecha_uso, hora_inicio, hora_fin, status").eq("id", id).single();

  if (!resv) throw { status: 404, message: "Reserva no encontrada" };
  if (resv.status !== "approved") throw { status: 400, message: "La reserva no está en estado aprobado" };

  // BUG 4 FIX: Usar hora de México, no UTC del servidor
  const nowMx    = getMexicoNow();
  const todayStr = `${nowMx.getFullYear()}-${String(nowMx.getMonth() + 1).padStart(2,"0")}-${String(nowMx.getDate()).padStart(2,"0")}`;

  if (resv.fecha_uso !== todayStr)
    throw { status: 400, message: `Solo se puede marcar en uso el día de la reserva (${resv.fecha_uso})` };

  const nowMin   = nowMx.getHours() * 60 + nowMx.getMinutes();
  const [hI, mI] = (resv.hora_inicio || "00:00").split(":").map(Number);
  const [hF, mF] = (resv.hora_fin    || "23:59").split(":").map(Number);
  const inicioMin = hI * 60 + mI;
  const finMin    = hF * 60 + mF;

  if (nowMin < inicioMin - 10 || nowMin > finMin)
    throw { status: 400, message: `Solo se puede marcar en uso entre ${resv.hora_inicio} y ${resv.hora_fin}` };

  const { data, error } = await supabase
    .from("reservations")
    .update({ status: "occupied", entrada_fecha: new Date().toISOString() })
    .eq("id", id).select("id, status");
  if (error) throw error;
  broadcast("reservations", "UPDATE", data[0]);
  return data[0];
};

const release = async (id, body) => {
  const { leftover_items = [] } = body;
  const reservationId = parseInt(id);

  const { data, error } = await supabase
    .from("reservations")
    .update({ status: "released", salida_fecha: new Date().toISOString() })
    .eq("id", reservationId).select("id, status, alumno_id, lab_id");
  if (error) throw error;

  for (const li of leftover_items) {
    const updatePayload = { leftover_qty: li.leftover_qty ?? 0 };
    if (li.damaged_qty !== undefined) updatePayload.damaged_qty = li.damaged_qty;
    await supabase.from("reservation_consumables")
      .update(updatePayload)
      .eq("id", li.reservation_consumable_id);
  }

  const { data: resAssets } = await supabase
    .from("reservation_assets").select("asset_id").eq("reservation_id", reservationId);

  if (resAssets && resAssets.length > 0) {
    for (const ra of resAssets) {
      const { data: updatedAsset } = await supabase
        .from("assets").update({ status: "available" }).eq("id", ra.asset_id).select("*").single();
      if (updatedAsset) broadcast("assets", "UPDATE", updatedAsset);
    }
  }

  await supabase.from("logs").insert([{
    user_id: data[0].alumno_id, action: "Laboratorio liberado",
    table_name: "reservations", record_id: reservationId,
    item_type: "lab", item_id: data[0].lab_id,
    details: resAssets?.length ? `Activos liberados: [${resAssets.map(r => r.asset_id).join(", ")}]` : "Sin activos adicionales"
  }]);

  broadcast("reservations", "UPDATE", data[0]);
  return data[0];
};

const cancel = async (id, body) => {
  const { docente_message } = body;
  const { data, error } = await supabase
    .from("reservations")
    .update({ status: "cancelled", docente_message: docente_message || "Solicitud cancelada" })
    .eq("id", id).select("id, status, docente_message");
  if (error) throw error;
  broadcast("reservations", "UPDATE", data[0]);
  return data[0];
};

const remove = async (id) => {
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) throw error;
  broadcast("reservations", "DELETE", { id });
};

module.exports = { getAll, getById, create, update, approve, occupy, release, cancel, remove };
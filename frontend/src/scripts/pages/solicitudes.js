const API        = "/api/requests";
const USERS_URL  = "/api/users";
const ASSETS_URL = "/api/assets";
const CONS_URL   = "/api/consumibles";
const LABS_URL   = "/api/labs";

let allRequests  = [];
let allUsers     = [];
let allAssets    = [];
let allCons      = [];
let allLabs      = [];
let currentUser  = null;

// For the new request modal
let itemRows     = [];   // [{rowId, type, itemId, qty}]
let rowCounter   = 0;

const statusMap = {
  pending:       { text:"Pendiente (docente)", cls:"badge-pending",  icon:"fa-clock"        },
  pending_admin: { text:"Pendiente (admin)",   cls:"badge-info",     icon:"fa-paper-plane"  },
  approved:      { text:"Aprobada",            cls:"badge-approved", icon:"fa-check-circle" },
  rejected:      { text:"Rechazada",           cls:"badge-rejected", icon:"fa-times-circle" },
  returned:      { text:"Devuelta",            cls:"badge-returned", icon:"fa-undo"         }
};

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  await Promise.all([loadUsers(), loadAssets(), loadCons(), loadLabs()]);
  await loadRequests();
});

// ── CATÁLOGOS ─────────────────────────────────────────────────
async function loadUsers()  { try { const r = await fetch(USERS_URL);  allUsers  = await r.json(); } catch {} }
async function loadAssets() { try { const r = await fetch(ASSETS_URL); allAssets = await r.json(); } catch {} }
async function loadCons()   { try { const r = await fetch(CONS_URL);   allCons   = await r.json(); } catch {} }
async function loadLabs()   { try { const r = await fetch(LABS_URL);   allLabs   = await r.json(); } catch {} }

// ── LISTAR ───────────────────────────────────────────────────
async function loadRequests() {
  showLoading();
  try {
    const res  = await fetch(API);
    if (!res.ok) throw new Error();
    let data   = await res.json();

    const uid = Number(currentUser.id);
    if (currentUser.role === "alumno") {
      // Solicitudes donde el alumno es el solicitante
      data = data.filter(r => Number(r.user_id) === uid);
    } else if (currentUser.role === "docente") {
      // Solicitudes donde el docente es el responsable O donde él mismo es el solicitante
      data = data.filter(r => Number(r.docente_id) === uid || Number(r.user_id) === uid);
    }

    allRequests = data;
    applyFilters();
  } catch { showError("No se pudieron cargar las solicitudes"); }
}

// ── FILTROS ──────────────────────────────────────────────────
function applyFilters() {
  const st      = document.getElementById("filterStatus")?.value || "";
  const type    = document.getElementById("filterType")?.value   || "";
  const search  = (document.getElementById("searchAlumno")?.value || "").toLowerCase().trim();

  let data = [...allRequests];
  if (st)     data = data.filter(r => r.status === st);
  if (type)   data = data.filter(r => r.request_type === type);
  if (search) data = data.filter(r => (r.users?.username || "").toLowerCase().includes(search));

  renderTable(data);
}

// ── TABLA ─────────────────────────────────────────────────────
function renderTable(data) {
  const wrap = document.getElementById("tableWrapper");
  if (!data.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-clipboard"></i><p>Sin solicitudes registradas</p></div>`;
    return;
  }

  const role = currentUser.role;

  const rows = data.map(r => {
    const st      = statusMap[r.status] || { text: r.status, cls:"badge-pending", icon:"fa-clock" };
    const usuario = r.users?.username   || "—";
    const docente = r.docente?.username || "—";

    // ── Fecha y hora sin bug de zona horaria ──
    // Usamos fecha_solicitud (date) y hora_solicitud (time) que son exactos.
    // Si no existen (registros viejos), caemos al request_date como fallback.
    let fechaStr, horaStr;
    if (r.fecha_solicitud) {
      const [y,m,d] = r.fecha_solicitud.split("-");
      fechaStr = `${d}/${m}/${y}`;
      horaStr  = r.hora_solicitud ? r.hora_solicitud.substring(0,5) : "";
    } else {
      // Fallback: request_date en UTC, mostramos solo la fecha local
      const dt = r.request_date ? new Date(r.request_date) : null;
      fechaStr = dt ? dt.toLocaleDateString("es-MX",{dateStyle:"short"}) : "—";
      horaStr  = dt ? dt.toLocaleTimeString("es-MX",{timeStyle:"short"}) : "";
    }

    // Ítems (multi o legacy)
    let itemText = "—";
    if (r.request_items?.length) {
      itemText = r.request_items.map(it => {
        const n = it.assets?.name || it.consumables?.name || "Ítem";
        return `${n} ×${it.quantity}`;
      }).join(", ");
    } else if (r.assets)      itemText = r.assets.name;
    else if (r.consumables)  itemText = r.consumables.name;

    const typeLabel = { asset:"Activo", consumable:"Consumible", laboratorio:"Laboratorio" }[r.request_type] || r.request_type;
    const typeCls   = { asset:"background:#f0fdf4;color:#15803d", consumable:"background:#fef9c3;color:#a16207", laboratorio:"background:#ede9fe;color:#7c3aed" }[r.request_type] || "";

    // Rechazo
    let rejInfo = "";
    if (r.status === "rejected" && r.rejected_reason) {
      rejInfo = `<br><small style="color:#dc2626;font-size:11px;"><i class="fas fa-times-circle"></i> ${r.rejected_reason}</small>`;
      if (r.rejected_at) rejInfo += `<br><small style="color:#9ca3af;font-size:10px;">${new Date(r.rejected_at).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"})}</small>`;
    }

    // Acciones
    let acciones = "";

    // Docente: aprobar/rechazar las solicitudes pending directamente
    if (role === "docente" && r.status === "pending") {
      acciones += `<button class="action-btn action-approve" title="Aprobar" onclick="openApproveModal(${r.id})"><i class="fas fa-check"></i></button>`;
      acciones += `<button class="action-btn action-reject" title="Rechazar" onclick="openRejectModal(${r.id})"><i class="fas fa-times"></i></button>`;
    }

    // Alumno: editar o eliminar sus propias solicitudes en estado pending
    if (role === "alumno" && r.status === "pending" && String(r.user_id) === String(currentUser.id)) {
      acciones += `<button class="action-btn action-info" title="Editar solicitud" onclick="openEditRequest(${r.id})"><i class="fas fa-edit"></i></button>`;
      acciones += `<button class="action-btn action-delete" title="Eliminar solicitud" onclick="deleteRequest(${r.id})"><i class="fas fa-trash"></i></button>`;
    }

    // Docente: editar sus propias solicitudes pending
    if (role === "docente" && r.status === "pending" && String(r.user_id) === String(currentUser.id)) {
      acciones += `<button class="action-btn action-info" title="Editar solicitud" onclick="openEditRequest(${r.id})"><i class="fas fa-edit"></i></button>`;
    }

    // Admin: aprobar/rechazar las pending (si llega alguna sin docente)
    if (role === "administrador" && (r.status === "pending" || r.status === "pending_admin")) {
      acciones += `<button class="action-btn action-approve" title="Aprobar" onclick="openApproveModal(${r.id})"><i class="fas fa-check"></i></button>`;
      acciones += `<button class="action-btn action-reject" title="Rechazar" onclick="openRejectModal(${r.id})"><i class="fas fa-times"></i></button>`;
    }

    // Docente/Admin: devolución en aprobadas
    if ((role === "docente" || role === "administrador") && r.status === "approved") {
      acciones += `<button class="action-btn action-return" title="Registrar devolución" onclick="openReturnModal(${r.id})"><i class="fas fa-undo"></i></button>`;
    }

    // Ver respuesta admin
    if (r.admin_message || r.pickup_date) {
      acciones += `<button class="action-btn action-info" title="Ver detalle" onclick="showAdminResponse(${r.id})"><i class="fas fa-info-circle"></i></button>`;
    }

    // Eliminar: admin puede eliminar rechazadas, devueltas y cualquiera
    if (role === "administrador" && ["rejected","returned","pending","pending_admin","approved"].includes(r.status)) {
      acciones += `<button class="action-btn action-delete" title="Eliminar" onclick="deleteRequest(${r.id})"><i class="fas fa-trash"></i></button>`;
    }

    const incident = r.incident
      ? `<span title="Incidente reportado" style="color:#f59e0b;margin-left:4px;"><i class="fas fa-exclamation-triangle"></i></span>`
      : "";

    return ` <tr>
      <td>
        <strong>#${r.id}</strong>
        <br><small style="color:#9ca3af;font-size:11px;">${fechaStr}</small>
        ${horaStr ? `<br><small style="color:#4f46e5;font-size:11px;"><i class="fas fa-clock"></i> ${horaStr}</small>` : ""}
      </td>
      <td>${usuario}<br><small style="color:#9ca3af;font-size:11px;">${r.users?.role||""}</small></td>
      <td>${docente}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:10px;${typeCls}">${typeLabel}</span><br><small style="color:#6b7280;font-size:11px;">${r.purpose||""}</small></td>
      <td>${itemText}${incident}${rejInfo}</td>
      <td><span class="badge ${st.cls}"><i class="fas ${st.icon}"></i> ${st.text}</span></td>
      <td style="white-space:nowrap;">${acciones || "—"}</td>
    </tr>`;
  }).join("");

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#/Fecha</th><th>Solicitante</th><th>Docente</th>
        <th>Tipo</th><th>Ítems</th><th>Estado</th><th>Acciones</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── MODAL NUEVA SOLICITUD ─────────────────────────────────────
function openModal() {
  itemRows   = [];
  rowCounter = 0;
  _solArea   = "";

  // Limpiar filtro de área previo
  const prevFilter = document.getElementById("solAreaFilter");
  if (prevFilter) prevFilter.remove();

  const selUser    = document.getElementById("reqUser");
  const grpDocente = document.getElementById("docenteGroup");
  const selDocente = document.getElementById("reqDocente");

  selUser.innerHTML = "";

  if (currentUser.role === "alumno") {
    const self = document.createElement("option");
    self.value = currentUser.id;
    self.textContent = `${currentUser.username} (tú)`;
    selUser.appendChild(self);
    selUser.disabled = true;
    grpDocente.style.display = "block";
    selDocente.innerHTML = `<option value="">-- Selecciona docente encargado --</option>`;
    allUsers.filter(u => u.role === "docente").forEach(u => {
      const o = document.createElement("option"); o.value = u.id; o.textContent = u.username;
      selDocente.appendChild(o);
    });
  } else if (currentUser.role === "docente") {
    const self = document.createElement("option");
    self.value = currentUser.id;
    self.textContent = `${currentUser.username} (yo)`;
    selUser.appendChild(self);
    allUsers.filter(u => u.role === "alumno").forEach(u => {
      const o = document.createElement("option"); o.value = u.id; o.textContent = `${u.username} (alumno)`;
      selUser.appendChild(o);
    });
    selUser.disabled = false;
    grpDocente.style.display = "none";
  } else {
    allUsers.filter(u => ["administrador","docente","alumno"].includes(u.role)).forEach(u => {
      const o = document.createElement("option");
      o.value = u.id; o.textContent = `${u.username} (${u.role})`;
      selUser.appendChild(o);
    });
    selUser.disabled = false;
    grpDocente.style.display = "none";
  }

  document.getElementById("reqType").value    = "asset";
  document.getElementById("reqPurpose").value = "";
  document.getElementById("reqNotes").value   = "";

  // Limpiar y preparar campos de fecha/hora de solicitud
  const todayStr   = new Date().toISOString().split("T")[0];
  const fechaSolEl = document.getElementById("reqFechaSol");
  const horaSolEl  = document.getElementById("reqHoraSol");
  if (fechaSolEl) { fechaSolEl.min = todayStr; fechaSolEl.value = todayStr; }
  if (horaSolEl) {
    // Si es hoy, la hora mínima es la hora actual + 30 min redondeada al cuarto
    const now    = new Date();
    const mRound = Math.ceil((now.getMinutes() + 30) / 15) * 15;
    const hMin   = now.getHours() + Math.floor(mRound / 60);
    const mMin   = mRound % 60;
    const minNow = `${String(hMin).padStart(2,"0")}:${String(mMin).padStart(2,"0")}`;
    const minAllowed = minNow > "07:30" ? minNow : "07:30";
    horaSolEl.value = "";
    horaSolEl.min   = minAllowed;
    horaSolEl.max   = "15:00";
    horaSolEl.step  = "900";
  }

  onTypeChange();
  document.getElementById("requestModal").classList.add("open");
}

function closeModal() {
  document.getElementById("requestModal").classList.remove("open");
}

// ── CAMBIO DE TIPO ────────────────────────────────────────────
function onTypeChange() {
  const type      = document.getElementById("reqType").value;
  const itemsSec  = document.getElementById("itemsSection");
  const labSec    = document.getElementById("labSection");

  if (type === "laboratorio") {
    itemsSec.style.display = "none";
    labSec.style.display   = "block";
    buildLabSelector();
  } else {
    itemsSec.style.display = "block";
    labSec.style.display   = "none";
    // Limpiar y agregar selector de área
    _solArea = "";
    document.getElementById("itemsContainer").innerHTML = "";
    itemRows = []; rowCounter = 0;

    // Inyectar selector de área si no existe
    let areaFilter = document.getElementById("solAreaFilter");
    if (!areaFilter) {
      areaFilter = document.createElement("div");
      areaFilter.id = "solAreaFilter";
      areaFilter.style.cssText = "margin-bottom:10px;display:flex;align-items:center;gap:8px;";
      areaFilter.innerHTML = `
        <label style="font-size:13px;font-weight:600;color:#374151;white-space:nowrap;">Área / Depto:</label>
        <select id="solAreaSelect" onchange="onSolAreaChange(this)"
          style="padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;color:#374151;flex:1;">
          <option value="">🌐 Todas las áreas</option>
          <option value="sistemas">🖥 Sistemas</option>
          <option value="laboratorio">🔬 Laboratorio / Alimentos</option>
        </select>`;
      itemsSec.insertBefore(areaFilter, document.getElementById("itemsContainer"));
    } else {
      document.getElementById("solAreaSelect").value = "";
    }
    addItemRow();
  }
}

function onSolAreaChange(sel) {
  _solArea = sel.value;
  // Refrescar todos los selects de ítems existentes
  const type = document.getElementById("reqType").value;
  document.querySelectorAll("#itemsContainer .item-row select").forEach(s => {
    const cur = s.value;
    const list = type === "asset" ? buildAssetOptions() : buildConsOptions();
    s.innerHTML = `<option value="">-- ${type === "asset" ? "Activo" : "Consumible"} --</option>${list}`;
    if ([...s.options].some(o => o.value === cur)) s.value = cur;
  });
}

// ── LABS ──────────────────────────────────────────────────────
function buildLabSelector() {
  const sel = document.getElementById("reqLab");
  sel.innerHTML = `<option value="">-- Selecciona laboratorio --</option>`;
  const grouped = allLabs.reduce((acc, l) => {
    (acc[l.edificio] = acc[l.edificio] || []).push(l); return acc;
  }, {});
  for (const [edif, ls] of Object.entries(grouped)) {
    const og = document.createElement("optgroup"); og.label = edif;
    ls.forEach(l => {
      const op = document.createElement("option"); op.value = l.id;
      op.textContent = l.nombre;
      op.dataset.open  = l.open_time;
      op.dataset.close = l.close_time;
      og.appendChild(op);
    });
    sel.appendChild(og);
  }
  sel.onchange = () => {
    const fechaVal = document.getElementById("reqFecha").value;
    updateSolicitudHourLimits(fechaVal);
  };

  // Fecha mínima = hoy, sin fines de semana
  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("reqFecha").min = todayStr;
}

function validateWeekend(input) {
  if (!input.value) return;
  const d = new Date(input.value + "T12:00:00");
  if (d.getDay() === 0) {
    showToast("No se permiten reservas los domingos", "error");
    input.value = "";
    return;
  }
  updateSolicitudHourLimits(input.value);
}

function updateSolicitudHourLimits(fechaVal) {
  const role  = currentUser?.role;
  const d     = fechaVal ? new Date(fechaVal + "T12:00:00") : null;
  const isSat = d ? d.getDay() === 6 : false;

  let openTime, closeTime;
  if (role === "docente" || role === "administrador") {
    openTime  = "07:30";
    closeTime = isSat ? "13:00" : "17:00";
  } else {
    openTime  = "08:00";
    closeTime = isSat ? "13:00" : "15:00";
  }

  ["reqHoraInicio", "reqHoraFin"].forEach(fid => {
    const el = document.getElementById(fid);
    if (!el) return;
    el.min  = openTime;
    el.max  = closeTime;
    el.step = "3600";
  });
}

// ── ROWS DE ÍTEMS (multi-ítem) ────────────────────────────────
function addItemRow() {
  const type = document.getElementById("reqType").value;
  const id   = `row_${++rowCounter}`;
  itemRows.push({ rowId: id });

  const container = document.getElementById("itemsContainer");
  const div = document.createElement("div");
  div.className = "item-row"; div.id = id;

  // Build initial options (all assets/consumables)
  const list = type === "asset" ? buildAssetOptions() : buildConsOptions();

  div.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 90px 28px;gap:8px;align-items:center;margin-bottom:8px;">
      <select id="sel_${id}" onchange="onItemSelect('${id}','${type}')" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;color:#374151;">
        <option value="">-- ${type === "asset" ? "Activo" : "Consumible"} --</option>
        ${list}
      </select>
      <input type="number" id="qty_${id}" value="1" min="1" max="1"
        style="padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;text-align:center;"
        ${type === "asset" ? 'readonly title="Cada activo es único por serie"' : ''}>
      <button onclick="removeItemRow('${id}')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:16px;padding:4px;">
        <i class="fas fa-times"></i></button>
    </div>
    <div id="info_${id}" style="font-size:11px;color:#9ca3af;margin-bottom:4px;display:none;padding:0 0 6px 4px;"></div>`;

  container.appendChild(div);
}

// ── Estado de área activa en solicitudes ──
let _solArea = "";

function buildAssetOptions(excludeIds = []) {
  return allAssets
    .filter(a => a.status === "available" && !excludeIds.includes(a.id) && (!_solArea || a.area === _solArea))
    .map(a => {
      const areaIcon = a.area === "sistemas" ? "\uD83D\uDDA5" : a.area === "laboratorio" ? "\uD83D\uDD2C" : "";
      const catName  = a.categories?.name || "";
      return `<option value="${a.id}" data-serial="${a.serial_number||""}" data-name="${a.name}">${areaIcon} ${a.name}${catName ? " \u00B7 "+catName : ""} — Serie: ${a.serial_number||"S/N"}</option>`;
    })
    .join("");
}

function buildConsOptions() {
  return allCons
    .filter(c => c.quantity > 0 && (!_solArea || c.area === _solArea))
    .map(c => {
      const areaIcon = c.area === "sistemas" ? "\uD83D\uDDA5" : c.area === "laboratorio" ? "\uD83D\uDD2C" : "";
      const catName  = (c.categories?.name || "").toLowerCase();
      return `<option value="${c.id}" data-qty="${c.quantity}" data-unit="${c.unit||"u"}" data-area="${c.area||""}" data-cat="${catName}">${areaIcon} ${c.name} (Disp: ${c.quantity} ${c.unit||"u"})</option>`;
    })
    .join("");
}

function onItemSelect(rowId, type) {
  const sel     = document.getElementById(`sel_${rowId}`);
  const qtyInp  = document.getElementById(`qty_${rowId}`);
  const infoDiv = document.getElementById(`info_${rowId}`);
  const opt     = sel.selectedOptions[0];
  if (!opt?.value) { infoDiv.style.display = "none"; return; }

  if (type === "asset") {
    qtyInp.value = "1"; qtyInp.max = "1";
    infoDiv.style.display = "block";
    infoDiv.innerHTML = `<i class="fas fa-info-circle" style="color:#4f46e5;"></i> Serie: <strong>${opt.dataset.serial||"S/N"}</strong> · Para pedir más unidades del mismo modelo, agrega otra fila.`;

    // Remove this asset from other dropdowns to avoid duplicate selection
    const selectedId = parseInt(opt.value);
    document.querySelectorAll("#itemsContainer .item-row select").forEach(otherSel => {
      if (otherSel.id !== sel.id) {
        const otherOptions = otherSel.querySelectorAll("option");
        otherOptions.forEach(opt => {
          if (parseInt(opt.value) === selectedId) opt.remove();
        });
      }
    });
  } else {
    // Consumible: cantidad máxima = stock disponible
    const maxQty   = parseInt(opt.dataset.qty) || 1;
    const unit     = (opt.dataset.unit || "").toLowerCase();
    const area     = (opt.dataset.area || "").toLowerCase();
    const cat      = (opt.dataset.cat  || "").toLowerCase();
    const isComputo = area === "sistemas" && (cat.includes("cómputo") || cat.includes("computo"));

    // Límite especial Sistemas > Cómputo: máx 5 metros o 5 piezas
    let efectiveMax = maxQty;
    let limitNote   = "";
    if (isComputo) {
      if (unit === "metros") {
        efectiveMax = Math.min(maxQty, 5);
        limitNote   = ` <span style="color:#d97706;font-size:11px;">⚠ Máx 5 m por solicitud</span>`;
      } else if (unit === "pieza") {
        efectiveMax = Math.min(maxQty, 5);
        limitNote   = ` <span style="color:#d97706;font-size:11px;">⚠ Máx 5 piezas por solicitud</span>`;
      }
    }

    qtyInp.max      = efectiveMax;
    qtyInp.readOnly = false;
    infoDiv.style.display = "block";
    infoDiv.innerHTML = `<i class="fas fa-boxes" style="color:#10b981;"></i> Disponible: <strong>${maxQty} ${opt.dataset.unit||"u"}</strong>${limitNote}`;
    qtyInp.oninput = () => {
      const v = parseFloat(qtyInp.value);
      if (v > efectiveMax) qtyInp.value = efectiveMax;
      if (v < 1) qtyInp.value = 1;
    };
  }
}

function removeItemRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    const sel = row.querySelector("select");
    const removedId = parseInt(sel.value);
    row.remove();
    itemRows = itemRows.filter(r => r.rowId !== rowId);
    // Re-add the removed asset to all other dropdowns (if asset type)
    if (document.getElementById("reqType").value === "asset" && removedId) {
      const asset = allAssets.find(a => a.id === removedId);
      if (asset) {
        const option = `<option value="${asset.id}" data-serial="${asset.serial_number||""}" data-name="${asset.name}">${asset.name} — Serie: ${asset.serial_number||"S/N"}</option>`;
        document.querySelectorAll("#itemsContainer .item-row select").forEach(otherSel => {
          otherSel.insertAdjacentHTML("beforeend", option);
        });
      }
    }
  }
}

// ── GUARDAR SOLICITUD ─────────────────────────────────────────
async function saveRequest() {
  const user_id = document.getElementById("reqUser").value;
  const type    = document.getElementById("reqType").value;
  const purpose = document.getElementById("reqPurpose").value.trim();
  const notes   = document.getElementById("reqNotes").value.trim();

  if (!user_id) { showToast("Selecciona un solicitante", "error"); return; }
  if (!purpose) { showToast("El propósito es obligatorio", "error"); return; }

  // ── Validar fecha y hora de solicitud ──
  const fechaSol = document.getElementById("reqFechaSol")?.value || "";
  const horaSol  = document.getElementById("reqHoraSol")?.value  || "";

  if (!fechaSol) { showToast("La fecha de solicitud es obligatoria", "error"); return; }
  if (!horaSol)  { showToast("La hora de solicitud es obligatoria", "error"); return; }

  const dowSol  = new Date(fechaSol + "T12:00:00").getDay();
  if (dowSol === 0) { showToast("No se permiten solicitudes los domingos", "error"); return; }

  const [hS, mS] = horaSol.split(":").map(Number);
  const minsSol  = hS * 60 + mS;
  const isSatSol = dowSol === 6;
  const minSol   = 7 * 60 + 30;               // 07:30
  const maxSol   = isSatSol ? 13 * 60 : 15 * 60; // 13:00 sáb / 15:00 resto

  if (minsSol < minSol) { showToast("Hora mínima: 7:30 AM", "error"); return; }
  if (minsSol > maxSol) {
    showToast(`Hora máxima: ${isSatSol ? "1:00 PM (sábado)" : "3:00 PM"}`, "error"); return;
  }

  // Validar que si es hoy, la hora no sea pasada
  const todayCheck = new Date().toISOString().split("T")[0];
  if (fechaSol === todayCheck) {
    const now     = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    if (minsSol < nowMins) {
      showToast("No puedes seleccionar una hora que ya pas\xf3", "error");
      return;
    }
  }

  // Docente encargado
  let docente_id = null;
  if (currentUser.role === "alumno") {
    docente_id = document.getElementById("reqDocente").value || null;
    if (!docente_id) { showToast("Selecciona un docente encargado", "error"); return; }
  } else if (currentUser.role === "docente") {
    docente_id = currentUser.id;
  }

  // ── LABORATORIO → crear reserva directa ──
  if (type === "laboratorio") {
    const lab_id     = document.getElementById("reqLab").value;
    const fecha_uso  = document.getElementById("reqFecha").value;
    const horaInicio = document.getElementById("reqHoraInicio").value;
    const horaFin    = document.getElementById("reqHoraFin").value;

    if (!lab_id || !fecha_uso || !horaInicio || !horaFin) {
      showToast("Completa laboratorio, fecha y horario", "error"); return;
    }

    const [hI, mI] = horaInicio.split(":").map(Number);
    const [hF, mF] = horaFin.split(":").map(Number);
    const tIni = hI * 60 + mI;
    const tFin = hF * 60 + mF;

    if (tFin <= tIni) { showToast("La hora de fin debe ser mayor que la de inicio", "error"); return; }
    if (tFin - tIni < 60) { showToast("La reserva debe durar al menos 1 hora", "error"); return; }

    const dowLab  = new Date(fecha_uso + "T12:00:00").getDay();
    const isSatL  = dowLab === 6;
    const minOpen = 7 * 60 + 30;
    const maxClose= isSatL ? 13 * 60 : 15 * 60;

    if (tIni < minOpen)  { showToast("Hora mínima de inicio: 7:30 AM", "error"); return; }
    if (tFin > maxClose) { showToast(`Hora máxima de fin: ${isSatL ? "1:00 PM" : "3:00 PM"}`, "error"); return; }

    const labItems = collectLabItems();

    const body = {
      alumno_id:  parseInt(user_id),
      docente_id: docente_id ? parseInt(docente_id) : null,
      lab_id:     parseInt(lab_id),
      fecha_uso, hora_inicio: horaInicio, hora_fin: horaFin,
      proposito:       purpose,
      fecha_solicitud: fechaSol,
      hora_solicitud:  horaSol,
      consumables: labItems.filter(i => i.consumable_id).map(i => ({ consumable_id: i.consumable_id, quantity_requested: i.quantity })),
      assets:      labItems.filter(i => i.asset_id).map(i => ({ asset_id: i.asset_id }))
    };

    const res = await fetch("/api/reservations", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    if (!res.ok) { const e = await res.json(); showToast(e.message || "Error", "error"); return; }
    showToast("Reserva de laboratorio creada ✅", "success");
    closeModal(); await loadRequests(); return;
  }

  // ── ACTIVOS / CONSUMIBLES ──
  const items = collectItems(type);
  if (!items) return;

  const body = {
    user_id:         parseInt(user_id),
    docente_id:      docente_id ? parseInt(docente_id) : null,
    request_type:    type,
    purpose, notes,
    fecha_solicitud: fechaSol,
    hora_solicitud:  horaSol,
    items
  };

  try {
    const res = await fetch(API, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify(body)
    });
    if (!res.ok) { const e = await res.json(); showToast("Error: "+(e.message||"No se pudo guardar"), "error"); return; }
    showToast("Solicitud creada exitosamente ✅", "success");
    closeModal(); await loadRequests();
  } catch { showToast("No se pudo conectar con el servidor", "error"); }
}

function collectItems(type) {
  const rows = document.querySelectorAll("#itemsContainer .item-row");
  if (!rows.length) { showToast("Agrega al menos un ítem", "error"); return null; }

  const items = [];
  // Verificar que no se repita el mismo activo en otra fila
  const usedAssets = new Set();

  for (const row of rows) {
    const sel = row.querySelector("select");
    const qty = parseInt(row.querySelector("input[type=number]").value) || 1;
    if (!sel.value) { showToast("Selecciona un ítem en todas las filas", "error"); return null; }

    if (type === "asset") {
      if (usedAssets.has(sel.value)) {
        showToast("No puedes repetir el mismo activo. Agrega una nueva fila para cada unidad.", "error"); return null;
      }
      usedAssets.add(sel.value);
      items.push({ asset_id: parseInt(sel.value), quantity: 1 });
    } else {
      // Validación límite Sistemas > Cómputo
      const opt2     = sel.selectedOptions[0];
      const unit2    = (opt2?.dataset.unit || "").toLowerCase();
      const area2    = (opt2?.dataset.area  || "").toLowerCase();
      const cat2     = (opt2?.dataset.cat   || "").toLowerCase();
      const isComp   = area2 === "sistemas" && (cat2.includes("cómputo") || cat2.includes("computo"));
      if (isComp) {
        if (unit2 === "metros" && qty > 5) {
          showToast(`Límite: máximo 5 metros por consumible de Sistemas/Cómputo`, "error");
          return null;
        }
        if (unit2 === "pieza" && qty > 5) {
          showToast(`Límite: máximo 5 piezas por consumible de Sistemas/Cómputo`, "error");
          return null;
        }
      }
      items.push({ consumable_id: parseInt(sel.value), quantity: qty });
    }
  }
  return items;
}

// Ítems adicionales cuando el tipo es laboratorio
function collectLabItems() {
  const rows = document.querySelectorAll("#labItemsContainer .item-row");
  const items = [];
  rows.forEach(row => {
    const sel  = row.querySelector("select");
    const qty  = parseInt(row.querySelector("input[type=number]").value) || 1;
    const typ  = row.dataset.type;
    if (!sel?.value) return;
    if (typ === "asset")      items.push({ asset_id:      parseInt(sel.value), quantity: 1 });
    if (typ === "consumable") items.push({ consumable_id: parseInt(sel.value), quantity: qty });
  });
  return items;
}

let labRowCounter = 0;
function addLabItemRow(type) {
  const id  = `lrow_${++labRowCounter}`;
  const con = document.getElementById("labItemsContainer");
  const list = type === "asset" ? buildAssetOptions() : buildConsOptions();
  const div = document.createElement("div");
  div.className = "item-row"; div.id = id; div.dataset.type = type;
  div.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 90px 28px;gap:8px;align-items:center;margin-bottom:8px;">
      <select id="sel_${id}" onchange="onItemSelect('${id}','${type}')" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;color:#374151;">
        <option value="">-- ${type === "asset" ? "Activo" : "Consumible"} --</option>${list}
      </select>
      <input type="number" id="qty_${id}" value="1" min="1" max="${type==="asset"?1:9999}"
        ${type==="asset"?"readonly":""}
        style="padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:'Poppins',sans-serif;outline:none;text-align:center;">
      <button onclick="document.getElementById('${id}').remove()" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:16px;padding:4px;">
        <i class="fas fa-times"></i></button>
    </div>
    <div id="info_${id}" style="font-size:11px;color:#9ca3af;margin-bottom:4px;display:none;padding:0 0 6px 4px;"></div>`;
  con.appendChild(div);
}

// ── DOCENTE ENVÍA AL ADMIN ────────────────────────────────────
async function sendToAdmin(id) {
  if (!confirm("¿Enviar esta solicitud al Administrador?")) return;
  try {
    const res = await fetch(`${API}/${id}`, {
      method: "PUT", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ status: "pending_admin" })
    });
    if (!res.ok) throw new Error();
    showToast("Solicitud enviada al administrador ✅", "success");
    await loadRequests();
  } catch { showToast("Error al enviar la solicitud", "error"); }
}

// ── RECHAZAR ─────────────────────────────────────────────────
function openRejectModal(id) {
  let modal = document.getElementById("rejectModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "rejectModal"; modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" onclick="document.getElementById('rejectModal').classList.remove('open')">&times;</button>
        <h3><i class="fas fa-times-circle" style="color:#dc2626;margin-right:8px;"></i>Rechazar Solicitud</h3>
        <input type="hidden" id="rejectId">
        <div id="rejectSolicitudInfo" style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:10px;margin-bottom:12px;font-size:13px;color:#374151;display:none;"></div>
        <div class="form-group">
          <label>Motivo del rechazo *</label>
          <textarea id="rejectReason" placeholder="Explica el motivo del rechazo..." style="height:80px;resize:none;width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:'Poppins',sans-serif;outline:none;"></textarea>
        </div>
        <div style="background:#f8f9fc;border-radius:6px;padding:9px 12px;margin-bottom:12px;font-size:12px;color:#6b7280;">
          <i class="fas fa-clock" style="color:#4f46e5;margin-right:6px;"></i>
          Hora del rechazo: <strong id="rejectTimestamp"></strong>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="document.getElementById('rejectModal').classList.remove('open')">Cancelar</button>
          <button class="btn" style="flex:1;background:#dc2626;" onclick="submitReject()"><i class="fas fa-times"></i> Rechazar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
  }
  document.getElementById("rejectId").value    = id;
  document.getElementById("rejectReason").value = "";
  document.getElementById("rejectTimestamp").textContent = new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  // Mostrar info de la solicitud
  const r = allRequests.find(x => x.id === id);
  const infoEl = document.getElementById("rejectSolicitudInfo");
  if (r) {
    const typeLabel = { asset:"Activo", consumable:"Consumible", laboratorio:"Laboratorio" }[r.request_type] || r.request_type;
    infoEl.style.display = "block";
    infoEl.innerHTML = `<strong>#${r.id}</strong> · ${typeLabel} · Solicitante: <strong>${r.users?.username || "—"}</strong><br><span style="color:#9ca3af;font-size:12px;">${r.purpose || ""}</span>`;
  } else {
    infoEl.style.display = "none";
  }
  modal.classList.add("open");
}

async function submitReject() {
  const id     = document.getElementById("rejectId").value;
  const reason = document.getElementById("rejectReason").value.trim();
  if (!reason) { showToast("La razón del rechazo es obligatoria", "error"); return; }
  try {
    const res = await fetch(`${API}/${id}/reject`, {
      method: "PUT", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ rejected_by: currentUser.id, rejected_reason: reason, admin_message: reason, rejected_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error();
    showToast("Solicitud rechazada", "info");
    document.getElementById("rejectModal").classList.remove("open");
    await loadRequests();
  } catch { showToast("Error al rechazar", "error"); }
}

// ── APROBAR (Admin) ───────────────────────────────────────────
function openApproveModal(id) {
  let modal = document.getElementById("approveModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "approveModal"; modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box">
        <button class="modal-close" onclick="document.getElementById('approveModal').classList.remove('open')">&times;</button>
        <h3>Aprobar Solicitud</h3>
        <input type="hidden" id="approveId">
        <div class="form-group">
          <label>Fecha de entrega *</label>
          <input type="date" id="approvePickupDate" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:'Poppins',sans-serif;outline:none;">
        </div>
        <div class="form-group">
          <label>Hora de entrega * <small style="color:#9ca3af;">(7:30 AM – 6:00 PM, Lun–Sáb)</small></label>
          <input type="time" id="approvePickupTime" min="07:30" max="18:00" step="900" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:'Poppins',sans-serif;outline:none;">
        </div>
        <div class="form-group">
          <label>Lugar de entrega *</label>
          <input type="text" id="approvePickupLocation" placeholder="Ej. Laboratorio de Sistemas" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:'Poppins',sans-serif;outline:none;">
        </div>
        <div class="form-group">
          <label>Mensaje al solicitante</label>
          <textarea id="approveMessage" placeholder="Indicaciones adicionales..." style="width:100%;height:64px;resize:none;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:'Poppins',sans-serif;outline:none;"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="document.getElementById('approveModal').classList.remove('open')">Cancelar</button>
          <button class="btn" style="flex:1;background:#16a34a;" onclick="submitApprove()"><i class="fas fa-check"></i> Aprobar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
  }
  document.getElementById("approveId").value              = id;
  document.getElementById("approvePickupLocation").value  = "";
  document.getElementById("approveMessage").value         = "";
  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("approvePickupDate").min   = todayStr;
  document.getElementById("approvePickupDate").value = "";
  if (document.getElementById("approvePickupTime"))
    document.getElementById("approvePickupTime").value = "";
  modal.classList.add("open");
}

async function submitApprove() {
  const id  = document.getElementById("approveId").value;
  const pd  = document.getElementById("approvePickupDate").value;
  const pt  = document.getElementById("approvePickupTime").value;
  const pl  = document.getElementById("approvePickupLocation").value.trim();
  const msg = document.getElementById("approveMessage").value.trim();
  if (!pd || !pt || !pl) { showToast("Fecha, hora y lugar son obligatorios", "error"); return; }

  // Validar que no sea domingo
  const dow = new Date(pd + "T12:00:00").getDay();
  if (dow === 0) { showToast("No se permiten entregas los domingos", "error"); return; }

  // Validar rango horario 7:30 - 18:00
  const [h, m] = pt.split(":").map(Number);
  const mins   = h * 60 + m;
  if (mins < 7*60+30) { showToast("Hora mínima: 7:30 AM", "error"); return; }
  if (mins > 18*60)   { showToast("Hora máxima: 6:00 PM", "error"); return; }

  const pickup_date = `${pd}T${pt}:00`;

  try {
    const res = await fetch(`${API}/${id}/approve`, {
      method: "PUT", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ pickup_date, pickup_location: pl, admin_message: msg })
    });
    if (!res.ok) throw new Error();
    showToast("Solicitud aprobada con éxito ✅", "success");
    document.getElementById("approveModal").classList.remove("open");
    await loadRequests();
  } catch { showToast("Error al aprobar", "error"); }
}

// ── DEVOLUCIÓN ────────────────────────────────────────────────
function openReturnModal(id) {
  const r = allRequests.find(x => x.id === id);
  let modal = document.getElementById("returnModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "returnModal"; modal.className = "modal";
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
  }

  const items = r?.request_items || [];
  const itemsHtml = items.map(it => {
    const name = it.assets?.name || it.consumables?.name || "Ítem";
    const isAsset = !!it.assets;
    return `<div style="background:#f8f9fc;border-radius:6px;padding:8px;margin-bottom:6px;display:grid;grid-template-columns:1fr 1fr;gap:8px;" data-item-id="${it.id}" data-asset-id="${it.assets?.id||""}">
      <span style="font-size:13px;font-weight:500;color:#374151;">${name}</span>
      ${isAsset ? `<select style="padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:'Poppins',sans-serif;">
        <option value="bueno">Bueno</option><option value="dañado">Dañado</option><option value="perdido">Perdido</option>
      </select>` : `<span style="font-size:12px;color:#9ca3af;">Consumible</span>`}
    </div>`;
  }).join("") || `<p style="font-size:13px;color:#9ca3af;">Sin ítems registrados</p>`;

  modal.innerHTML = `
    <div class="modal-box">
      <button class="modal-close" onclick="document.getElementById('returnModal').classList.remove('open')">&times;</button>
      <h3>Registrar Devolución</h3>
      <input type="hidden" id="returnId" value="${id}">
      ${items.length ? `<div style="margin-bottom:12px;"><p style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Condición de ítems</p>${itemsHtml}</div>` : ""}
      <div class="form-group">
        <label><input type="checkbox" id="returnIncident" onchange="document.getElementById('incidentFields').style.display=this.checked?'block':'none'"> Reportar incidente</label>
      </div>
      <div id="incidentFields" style="display:none;">
        <div class="form-group">
          <label>Causa</label>
          <textarea id="incidentCause" placeholder="Describe lo ocurrido..." style="width:100%;height:60px;resize:none;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:'Poppins',sans-serif;outline:none;"></textarea>
        </div>
        <div class="form-group">
          <label>Solución</label>
          <textarea id="incidentSolution" placeholder="Cómo se resolvió..." style="width:100%;height:60px;resize:none;padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:'Poppins',sans-serif;outline:none;"></textarea>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick="document.getElementById('returnModal').classList.remove('open')">Cancelar</button>
        <button class="btn" style="flex:1;" onclick="submitReturn()"><i class="fas fa-undo"></i> Confirmar devolución</button>
      </div>
    </div>`;
  modal.classList.add("open");
}

async function submitReturn() {
  const id        = document.getElementById("returnId").value;
  const incident  = document.getElementById("returnIncident").checked;
  const cause     = document.getElementById("incidentCause")?.value.trim();
  const solution  = document.getElementById("incidentSolution")?.value.trim();
  if (incident && (!cause || !solution)) { showToast("Describe causa y solución del incidente", "error"); return; }

  const items_condition = [];
  document.querySelectorAll("#returnModal [data-item-id]").forEach(row => {
    const sel = row.querySelector("select");
    if (!sel) return;
    items_condition.push({
      item_id:          parseInt(row.dataset.itemId),
      asset_id:         parseInt(row.dataset.assetId)||null,
      return_condition: sel.value
    });
  });

  try {
    const res = await fetch(`${API}/${id}/return`, {
      method: "PUT", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ incident, incident_cause: cause, incident_solution: solution, items_condition })
    });
    if (!res.ok) throw new Error();
    showToast(incident ? "Devolución con incidente ⚠️" : "Devolución registrada ✅", "success");
    document.getElementById("returnModal").classList.remove("open");
    await loadRequests();
  } catch { showToast("Error al registrar devolución", "error"); }
}

// ── VER DETALLE / RESPUESTA ADMIN ────────────────────────────
function showAdminResponse(id) {
  const r = allRequests.find(x => x.id === id);
  if (!r) return;
  let modal = document.getElementById("infoModal");
  if (!modal) {
    modal = document.createElement("div"); modal.id = "infoModal"; modal.className = "modal";
    modal.innerHTML = `<div class="modal-box">
      <button class="modal-close" onclick="document.getElementById('infoModal').classList.remove('open')">&times;</button>
      <h3><i class="fas fa-info-circle" style="color:#4f46e5;margin-right:8px;"></i>Detalle</h3>
      <div id="infoContent"></div>
      <div class="modal-actions" style="margin-top:16px;">
        <button class="btn" style="width:100%;" onclick="document.getElementById('infoModal').classList.remove('open')">Cerrar</button>
      </div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
  }
  const pickupDate = r.pickup_date ? new Date(r.pickup_date).toLocaleString("es-MX",{dateStyle:"long",timeStyle:"short"}) : null;
  const rejAt      = r.rejected_at ? new Date(r.rejected_at).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"}) : null;

  document.getElementById("infoContent").innerHTML = `
    ${r.status === "rejected" ? `<div style="background:#fff1f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:12px;">
      <p style="font-size:13px;color:#dc2626;font-weight:600;margin-bottom:8px;"><i class="fas fa-times-circle"></i> Rechazado</p>
      <p style="font-size:13px;color:#374151;margin-bottom:4px;"><strong>Razón:</strong> ${r.rejected_reason||r.admin_message||"—"}</p>
      ${r.rejected_user ? `<p style="font-size:13px;"><strong>Por:</strong> ${r.rejected_user.username}</p>` : ""}
      ${rejAt ? `<p style="font-size:12px;color:#9ca3af;margin-top:4px;">${rejAt}</p>` : ""}
    </div>` : ""}
    ${pickupDate ? `<div style="background:#f0fdf4;border-radius:8px;padding:14px;margin-bottom:12px;">
      <p style="font-size:13px;color:#15803d;font-weight:600;margin-bottom:8px;"><i class="fas fa-check-circle"></i> Aprobado</p>
      <p style="font-size:13px;color:#374151;margin-bottom:4px;"><i class="fas fa-calendar" style="color:#4f46e5;width:18px;"></i> <strong>Fecha:</strong> ${pickupDate}</p>
      ${r.pickup_location ? `<p style="font-size:13px;color:#374151;margin-bottom:4px;"><i class="fas fa-map-marker-alt" style="color:#4f46e5;width:18px;"></i> <strong>Lugar:</strong> ${r.pickup_location}</p>` : ""}
      ${r.admin_message ? `<p style="font-size:13px;color:#374151;margin-top:8px;"><i class="fas fa-comment" style="color:#4f46e5;width:18px;"></i> ${r.admin_message}</p>` : ""}
    </div>` : ""}
    ${r.incident ? `<div style="background:#fef9c3;border-radius:8px;padding:14px;">
      <p style="font-size:13px;color:#a16207;font-weight:600;margin-bottom:8px;"><i class="fas fa-exclamation-triangle"></i> Incidente</p>
      <p style="font-size:13px;color:#374151;margin-bottom:4px;"><strong>Causa:</strong> ${r.incident_cause||"—"}</p>
      <p style="font-size:13px;color:#374151;"><strong>Solución:</strong> ${r.incident_solution||"—"}</p>
    </div>` : ""}`;
  modal.classList.add("open");
}

// ── EDITAR SOLICITUD (alumno/docente en pending) ──────────────
function openEditRequest(id) {
  const r = allRequests.find(x => x.id === id);
  if (!r) return;

  openModal();

  setTimeout(() => {
    const selType = document.getElementById("reqType");
    if (selType) { selType.value = r.request_type; selType.dispatchEvent(new Event("change")); }

    const inpPurpose = document.getElementById("reqPurpose");
    const inpNotes   = document.getElementById("reqNotes");
    if (inpPurpose) inpPurpose.value = r.purpose || "";
    if (inpNotes)   inpNotes.value   = r.notes   || "";

    // Prellenar fecha y hora de solicitud si existen
    const fechaSolEl = document.getElementById("reqFechaSol");
    const horaSolEl  = document.getElementById("reqHoraSol");
    if (fechaSolEl && r.fecha_solicitud) fechaSolEl.value = r.fecha_solicitud;
    if (horaSolEl  && r.hora_solicitud)  horaSolEl.value  = r.hora_solicitud.substring(0,5);

    const title = document.querySelector("#requestModal h3");
    if (title) title.innerHTML = `<i class="fas fa-edit" style="color:#4f46e5;margin-right:8px;"></i>Editar Solicitud #${r.id}`;

    const saveBtn = document.querySelector("#requestModal .btn[onclick='saveRequest()']");
    if (saveBtn) {
      saveBtn.setAttribute("onclick", `updateRequest(${id})`);
      saveBtn.innerHTML = `<i class="fas fa-save"></i> Guardar cambios`;
    }
  }, 60);
}

async function updateRequest(id) {
  const purpose  = document.getElementById("reqPurpose").value.trim();
  const notes    = document.getElementById("reqNotes").value.trim();
  const type     = document.getElementById("reqType").value;
  const fechaSol = document.getElementById("reqFechaSol")?.value || "";
  const horaSol  = document.getElementById("reqHoraSol")?.value  || "";

  if (!purpose) { showToast("El propósito es obligatorio", "error"); return; }
  if (!fechaSol) { showToast("La fecha de solicitud es obligatoria", "error"); return; }
  if (!horaSol)  { showToast("La hora de solicitud es obligatoria", "error"); return; }

  // Validar rango horario
  const dowSol  = new Date(fechaSol + "T12:00:00").getDay();
  if (dowSol === 0) { showToast("No se permiten solicitudes los domingos", "error"); return; }
  const [hS, mS] = horaSol.split(":").map(Number);
  const minsSol  = hS * 60 + mS;
  const isSatSol = dowSol === 6;
  if (minsSol < 7*60+30) { showToast("Hora mínima: 7:30 AM", "error"); return; }
  if (minsSol > (isSatSol ? 13*60 : 15*60)) {
    showToast(`Hora máxima: ${isSatSol ? "1:00 PM (sábado)" : "3:00 PM"}`, "error"); return;
  }

  const items = type !== "laboratorio" ? collectItems(type) : null;
  if (type !== "laboratorio" && !items) return;

  try {
    const res = await fetch(`${API}/${id}`, {
      method: "PUT", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ purpose, notes, fecha_solicitud: fechaSol, hora_solicitud: horaSol, items })
    });
    if (!res.ok) throw new Error();
    showToast("Solicitud actualizada ✅", "success");
    closeModal(); await loadRequests();
  } catch { showToast("Error al actualizar la solicitud", "error"); }
}

// ── ELIMINAR ─────────────────────────────────────────────────
function deleteRequest(id) {
  // Crear modal de confirmación si no existe
  let modal = document.getElementById("deleteConfirmModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "deleteConfirmModal"; modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box" style="max-width:420px;">
        <button class="modal-close" onclick="document.getElementById('deleteConfirmModal').classList.remove('open')">&times;</button>
        <h3 style="display:flex;align-items:center;gap:10px;">
          <span style="background:#ef4444;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="fas fa-trash" style="color:white;font-size:15px;"></i>
          </span>
          ¿Eliminar esta solicitud?
        </h3>
        <input type="hidden" id="deleteConfirmId">
        <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:14px;margin:16px 0;">
          <p style="font-size:13px;color:#7f1d1d;margin:0;">
            <i class="fas fa-exclamation-triangle" style="color:#dc2626;margin-right:6px;"></i>
            Esta acción es <strong>irreversible</strong>. La solicitud será eliminada permanentemente y no podrá recuperarse.
          </p>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="document.getElementById('deleteConfirmModal').classList.remove('open')">
            <i class="fas fa-times" style="margin-right:6px;"></i>Cancelar
          </button>
          <button class="btn" style="flex:1;background:#ef4444;" onclick="confirmDeleteRequest()">
            <i class="fas fa-trash" style="margin-right:6px;"></i>Sí, eliminar
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
  }
  document.getElementById("deleteConfirmId").value = id;
  modal.classList.add("open");
}

async function confirmDeleteRequest() {
  const id = document.getElementById("deleteConfirmId").value;
  document.getElementById("deleteConfirmModal").classList.remove("open");
  try {
    const res = await fetch(`${API}/${id}`, { method:"DELETE" });
    if (!res.ok) throw new Error();
    showToast("Solicitud eliminada", "success");
    await loadRequests();
  } catch { showToast("No se pudo eliminar", "error"); }
}

// ── EXPORTAR CSV ──────────────────────────────────────────────
function exportCSV() {
  let csv = "ID,Solicitante,Docente,Tipo,Propósito,Estado,Fecha\n";
  allRequests.forEach(r => {
    const fecha = r.request_date ? new Date(r.request_date).toLocaleDateString("es-MX") : "";
    csv += `${r.id},"${r.users?.username||""}","${r.docente?.username||""}","${r.request_type}","${r.purpose||""}","${statusMap[r.status]?.text||r.status}","${fecha}"\n`;
  });
  const blob = new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "solicitudes.csv"; a.click();
  showToast("Exportado ✅", "success");
}

// ── UTILS ─────────────────────────────────────────────────────
function showLoading() {
  document.getElementById("tableWrapper").innerHTML =
    `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Cargando...</p></div>`;
}
function showError(msg) {
  document.getElementById("tableWrapper").innerHTML =
    `<div class="empty-state"><i class="fas fa-exclamation-circle" style="color:#ef4444"></i><p>${msg}</p></div>`;
}
function showToast(msg, type="success") {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3500);
}

  // ── Tiempo real ──
  document.addEventListener("DOMContentLoaded", () => {
    REALTIME.on("requests", (event) => {
      if (!document.querySelector(".modal.open")) {
        loadRequests();
      }
    });
    // También si cambia el estado de un activo (prestado/disponible)
    REALTIME.on("assets", () => {
      loadAssets();   // recarga catálogo de activos disponibles
    });
  });
const apiUrl = "/api/assets";
const catUrl = "/api/categories/assets";

let allAssets     = [];
let allCategories = [];
let currentRole   = "alumno";
let activeArea    = "";

// ── Paginación ──
let _currentPage = 1;
let _pageSize    = 20;

try {
  const u = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  if (u && u.role) currentRole = u.role;
} catch {}
const isAdmin = currentRole === "administrador";

/* ── TOAST ── */
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3500);
}

/* ──────────────────────────────────────────
   CATEGORÍAS
────────────────────────────────────────── */
async function loadCategories() {
  try {
    const res = await fetch(catUrl);
    if (!res.ok) throw new Error();
    allCategories = await res.json();
    populateCategoryFilter(activeArea);
  } catch {
    console.warn("Categorías no disponibles");
  }
}

function populateCategoryFilter(area = "") {
  const sel = document.getElementById("filterCategory");
  const prev = sel.value;
  sel.innerHTML = '<option value="">Todas las categorías</option>';

  const filtered = area
    ? allCategories.filter(c => c.area === area)
    : allCategories;

  filtered.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

/* ──────────────────────────────────────────
   GENERAR NÚMERO DE SERIE (Sistemas)
────────────────────────────────────────── */
function generateSerial() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block  = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  return `${block()}-${block()}-${block()}-${block()}`;
}

function onAreaChangeModal() {
  const area = document.getElementById("assetArea").value;
  const sel  = document.getElementById("assetCategory");
  sel.innerHTML = '<option value="" disabled selected>Selecciona categoría</option>';

  const filtered = area
    ? allCategories.filter(c => c.area === area)
    : allCategories;

  if (area && !filtered.length) {
    sel.innerHTML = '<option value="" disabled selected>Sin categorías para esta área</option>';
  } else {
    filtered.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
  }

  const lblEdificio    = document.getElementById("lblEdificio");
  const lblLaboratorio = document.getElementById("lblLaboratorio");
  const inpEdificio    = document.getElementById("assetEdificio");
  const inpLab         = document.getElementById("assetLaboratorio");
  const serialRow      = document.getElementById("serialRow");
  const inpSerial      = document.getElementById("assetSerial");

  if (area === "laboratorio") {
    if (serialRow)      serialRow.style.display    = "none";
    if (inpSerial)      inpSerial.value            = "";
    if (lblEdificio)    lblEdificio.textContent    = "Edificio / Área";
    if (lblLaboratorio) lblLaboratorio.textContent = "Laboratorio / Sala";
    if (inpEdificio)    inpEdificio.placeholder    = "Ej. Edificio Ciencias";
    if (inpLab)         inpLab.placeholder         = "Ej. Lab. Química 1";
  } else if (area === "sistemas") {
    if (serialRow)      serialRow.style.display    = "";
    if (inpSerial && !inpSerial.value) inpSerial.value = generateSerial();
    if (lblEdificio)    lblEdificio.textContent    = "Edificio";
    if (lblLaboratorio) lblLaboratorio.textContent = "Laboratorio";
    if (inpEdificio)    inpEdificio.placeholder    = "Ej. Edificio Principal";
    if (inpLab)         inpLab.placeholder         = "Ej. Laboratorio de Sistemas";
  } else {
    if (serialRow)      serialRow.style.display    = "";
    if (lblEdificio)    lblEdificio.textContent    = "Edificio";
    if (lblLaboratorio) lblLaboratorio.textContent = "Laboratorio";
    if (inpEdificio)    inpEdificio.placeholder    = "";
    if (inpLab)         inpLab.placeholder         = "";
  }
}

/* ──────────────────────────────────────────
   FILTRO DE ÁREA (pill buttons)
────────────────────────────────────────── */
function setAreaFilter(btn, area) {
  activeArea = area;
  _currentPage = 1;

  document.querySelectorAll(".area-pill").forEach(p => {
    p.className = "area-pill";
    if (p.dataset.area === area) {
      if (area === "") p.classList.add("active-all");
      else if (area === "sistemas") p.classList.add("active-sistemas");
      else if (area === "laboratorio") p.classList.add("active-laboratorio");
    }
  });

  populateCategoryFilter(area);
  populateLocationFilter(area);
  applyFilters();
}

/* ──────────────────────────────────────────
   FILTRO DE UBICACIÓN (dinámico)
────────────────────────────────────────── */
function populateLocationFilter(area = "") {
  const sel = document.getElementById("filterLocation");
  const prev = sel.value;
  sel.innerHTML = '<option value="">Todas las ubicaciones</option>';

  let data = [...allAssets];
  if (area) data = data.filter(a => a.area === area);

  const locations = [...new Set(data.map(a => a.location).filter(Boolean))].sort();
  locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    sel.appendChild(opt);
  });
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

/* ──────────────────────────────────────────
   LISTAR ACTIVOS
────────────────────────────────────────── */
async function loadAssets() {
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error();
    allAssets = await res.json();
    populateLocationFilter(activeArea);
    applyFilters();
  } catch {
    document.getElementById("tableWrapper").innerHTML =
      `<div class="empty-state">
         <i class="fas fa-exclamation-circle" style="color:#dc2626;"></i>
         <p>Error al conectar con el servidor</p>
       </div>`;
  }
}

/* ──────────────────────────────────────────
   APLICAR TODOS LOS FILTROS
────────────────────────────────────────── */
function applyFilters() {
  const search   = document.getElementById("searchInput").value.toLowerCase().trim();
  const status   = document.getElementById("filterStatus").value;
  const catId    = document.getElementById("filterCategory").value;
  const location = document.getElementById("filterLocation").value;

  let data = [...allAssets];

  if (activeArea) data = data.filter(a => a.area === activeArea);
  if (search)     data = data.filter(a => a.name.toLowerCase().includes(search));
  if (status)     data = data.filter(a => a.status === status);
  if (catId)      data = data.filter(a => String(a.category_id) === String(catId));
  if (location)   data = data.filter(a => a.location === location);

  renderActiveFilterChips({ search, status, catId, location });
  renderTable(data);
}

/* ──────────────────────────────────────────
   CHIPS DE FILTROS ACTIVOS
────────────────────────────────────────── */
function renderActiveFilterChips({ search, status, catId, location }) {
  const container = document.getElementById("activeFilters");
  const chips = [];

  const statusLabel = { available:"Disponible", borrowed:"Prestado", maintenance:"En Mantenimiento", damaged:"Dañado" };
  const areaLabel   = { sistemas:"Sistemas", laboratorio:"Laboratorio / Alimentos" };

  if (activeArea)  chips.push({ label: `Área: ${areaLabel[activeArea]}`,    clear: () => { setAreaFilter(document.querySelector(`.area-pill[data-area=""]`), ""); } });
  if (search)      chips.push({ label: `Buscar: "${search}"`,                clear: () => { document.getElementById("searchInput").value = ""; applyFilters(); } });
  if (status)      chips.push({ label: `Estado: ${statusLabel[status]}`,     clear: () => { document.getElementById("filterStatus").value = ""; applyFilters(); } });
  if (catId) {
    const cat = allCategories.find(c => String(c.id) === String(catId));
    chips.push({ label: `Categoría: ${cat ? cat.name : catId}`,              clear: () => { document.getElementById("filterCategory").value = ""; applyFilters(); } });
  }
  if (location)    chips.push({ label: `Ubicación: ${location}`,             clear: () => { document.getElementById("filterLocation").value = ""; applyFilters(); } });

  container.innerHTML = chips.map((c, i) =>
    `<span class="filter-chip">
       ${c.label}
       <button onclick="clearChip(${i})" title="Quitar filtro">&times;</button>
     </span>`
  ).join("");

  window._chipClearFns = chips.map(c => c.clear);
}

function clearChip(index) {
  if (window._chipClearFns && window._chipClearFns[index]) {
    window._chipClearFns[index]();
  }
}

/* ──────────────────────────────────────────
   RENDER TABLA CON PAGINACIÓN
────────────────────────────────────────── */
function renderTable(data) {
  const wrap = document.getElementById("tableWrapper");

  if (!data.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>Sin activos registrados</p></div>`;
    return;
  }

  // ── Paginación ──
  const totalPages = Math.ceil(data.length / _pageSize);
  _currentPage     = Math.min(_currentPage, Math.max(1, totalPages));
  const pageData   = data.slice((_currentPage - 1) * _pageSize, _currentPage * _pageSize);

  const pageSizeOpts = [10, 20, 50, 100].map(n =>
    `<option value="${n}" ${n === _pageSize ? "selected" : ""}>${n}</option>`).join("");

  const paginationBar = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;
                gap:8px;padding:10px 4px;font-size:13px;color:#6b7280;">
      <div style="display:flex;align-items:center;gap:6px;">
        Mostrar
        <select onchange="_pageSize=parseInt(this.value);_currentPage=1;applyFilters()"
          style="padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;">${pageSizeOpts}</select>
        por página &nbsp;·&nbsp; <strong>${data.length}</strong> resultado${data.length !== 1 ? "s" : ""}
      </div>
      <div style="display:flex;align-items:center;gap:4px;">
        <button onclick="if(_currentPage>1){_currentPage--;applyFilters();}"
          ${_currentPage === 1 ? "disabled" : ""}
          style="padding:4px 10px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;font-size:12px;">‹</button>
        <span style="padding:4px 12px;background:#f3f4f6;border-radius:4px;">${_currentPage} / ${totalPages}</span>
        <button onclick="if(_currentPage<${totalPages}){_currentPage++;applyFilters();}"
          ${_currentPage === totalPages ? "disabled" : ""}
          style="padding:4px 10px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;font-size:12px;">›</button>
      </div>
    </div>`;

  const badgeMap = {
    available:   '<span class="badge badge-available">● Disponible</span>',
    borrowed:    '<span class="badge badge-borrowed">● Prestado / Ocupado</span>',
    maintenance: '<span class="badge badge-maintenance">● En Mantenimiento</span>',
    damaged:     '<span class="badge badge-damaged">● Dañado</span>'
  };

  const areaBadgeMap = {
    sistemas:    '<span class="badge badge-sistemas"><i class="fas fa-desktop" style="font-size:10px;"></i> Sistemas</span>',
    laboratorio: '<span class="badge badge-laboratorio"><i class="fas fa-flask" style="font-size:10px;"></i> Lab / Alimentos</span>'
  };

  const rows = pageData.map(a => {
    const catName   = a.categories ? a.categories.name : "—";
    const badge     = badgeMap[a.status] || `<span class="badge">${a.status}</span>`;
    const areaBadge = areaBadgeMap[a.area] || `<span class="badge" style="background:#f3f4f6;color:#6b7280;">${a.area || "—"}</span>`;
    const safeName  = (a.name || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    const acciones = isAdmin
      ? `<button class="action-btn action-edit"   onclick="editAsset(${a.id})" title="Editar">
           <i class="fas fa-edit"></i>
         </button>
         <button class="action-btn action-delete" onclick="openDeleteModal(${a.id}, '${safeName}')" title="Eliminar">
           <i class="fas fa-trash"></i>
         </button>`
      : `<span style="color:#9ca3af;font-size:12px;">Solo lectura</span>`;

    return `<tr>
      <td>${a.id}</td>
      <td><strong>${a.name}</strong></td>
      <td>${areaBadge}</td>
      <td>${catName}</td>
      <td><code style="font-size:12px;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${a.serial_number || "—"}</code></td>
      <td>${a.location || "—"}</td>
      <td>${badge}</td>
      <td style="text-align:center;">${a.quantity ?? 1}</td>
      <td><div style="display:flex;gap:4px;">${acciones}</div></td>
    </tr>`;
  }).join("");

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Nombre</th>
          <th>Área</th>
          <th>Categoría</th>
          <th>Serie</th>
          <th>Ubicación</th>
          <th>Estado</th>
          <th style="text-align:center;">Cant.</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${paginationBar}`;
}

/* ──────────────────────────────────────────
   ABRIR MODAL AGREGAR
────────────────────────────────────────── */
function openModal() {
  document.getElementById("modalTitle").textContent    = "Agregar Activo";
  document.getElementById("assetId").value             = "";
  document.getElementById("assetName").value           = "";
  document.getElementById("assetDescription").value   = "";
  document.getElementById("assetArea").value           = "";
  document.getElementById("assetCategory").innerHTML   = '<option value="" disabled selected>Selecciona categoría</option>';
  document.getElementById("assetSerial").value         = "";
  const _sr = document.getElementById("serialRow");
  if (_sr) _sr.style.display = "";
  document.getElementById("assetEdificio").value       = "";
  document.getElementById("assetLaboratorio").value    = "";
  document.getElementById("assetStatus").value         = "available";
  document.getElementById("assetQuantity").value       = "1";

  const lblEdificio    = document.getElementById("lblEdificio");
  const lblLaboratorio = document.getElementById("lblLaboratorio");
  if (lblEdificio)    lblEdificio.textContent    = "Edificio";
  if (lblLaboratorio) lblLaboratorio.textContent = "Laboratorio";

  document.getElementById("assetModal").classList.add("open");
}

function closeModal() {
  document.getElementById("assetModal").classList.remove("open");
}

/* ──────────────────────────────────────────
   GUARDAR
────────────────────────────────────────── */
async function saveAsset() {
  const id            = document.getElementById("assetId").value;
  const name          = document.getElementById("assetName").value.trim();
  const description   = document.getElementById("assetDescription").value.trim();
  const area          = document.getElementById("assetArea").value;
  const category_id   = document.getElementById("assetCategory").value;
  const serial_number = document.getElementById("assetSerial").value.trim();
  const edificio      = document.getElementById("assetEdificio").value.trim();
  const laboratorio   = document.getElementById("assetLaboratorio").value.trim();
  const status        = document.getElementById("assetStatus").value;
  const quantity      = parseInt(document.getElementById("assetQuantity").value, 10) || 1;

  const needsSerial = area !== "laboratorio";
  if (!name || !area || !category_id || !edificio || !laboratorio) {
    showToast("Nombre, área, categoría, edificio y laboratorio son obligatorios", "error");
    return;
  }
  if (needsSerial && !serial_number) {
    showToast("El número de serie es obligatorio para activos de Sistemas", "error");
    return;
  }

  const serialExists = allAssets.some(a =>
    a.serial_number &&
    a.serial_number.trim().toLowerCase() === serial_number.trim().toLowerCase() &&
    String(a.id) !== String(id)
  );
  if (serialExists) {
    showToast(`El número de serie "${serial_number}" ya está registrado en otro activo`, "error");
    return;
  }

  const location = `${edificio}, ${laboratorio}`;
  const body     = { name, description, area, category_id, serial_number, location, status, quantity };
  const url      = id ? `${apiUrl}/${id}` : apiUrl;
  const method   = id ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const e = await res.json();
      showToast("Error: " + (e.message || "No se pudo guardar"), "error");
      return;
    }
    closeModal();
    showToast(id ? "Activo actualizado" : "Activo agregado", "success");
    loadAssets();
  } catch {
    showToast("No se pudo conectar con el servidor", "error");
  }
}

/* ──────────────────────────────────────────
   EDITAR
────────────────────────────────────────── */
async function editAsset(id) {
  try {
    const res = await fetch(`${apiUrl}/${id}`);
    if (!res.ok) throw new Error();
    const a = await res.json();

    let edificio = "", laboratorio = "";
    if (a.location && a.location.includes(",")) {
      const parts = a.location.split(",");
      edificio    = parts[0].trim();
      laboratorio = parts.slice(1).join(",").trim();
    } else {
      edificio = a.location || "";
    }

    document.getElementById("modalTitle").textContent    = "Editar Activo";
    document.getElementById("assetId").value             = a.id;
    document.getElementById("assetName").value           = a.name;
    document.getElementById("assetDescription").value   = a.description || "";
    document.getElementById("assetArea").value           = a.area || "";

    onAreaChangeModal();
    document.getElementById("assetCategory").value       = a.category_id;
    document.getElementById("assetSerial").value         = a.serial_number || "";
    document.getElementById("assetEdificio").value       = edificio;
    document.getElementById("assetLaboratorio").value    = laboratorio;
    document.getElementById("assetStatus").value         = a.status;
    document.getElementById("assetQuantity").value       = a.quantity || 1;
    document.getElementById("assetModal").classList.add("open");
  } catch {
    showToast("No se pudo cargar el activo", "error");
  }
}

/* ──────────────────────────────────────────
   MODAL CONFIRMAR ELIMINAR
────────────────────────────────────────── */
function openDeleteModal(id, name) {
  document.getElementById("deleteAssetId").value         = id;
  document.getElementById("deleteAssetName").textContent = `"${name}" será eliminado permanentemente.`;
  document.getElementById("deleteModal").classList.add("open");
}

function closeDeleteModal() {
  document.getElementById("deleteModal").classList.remove("open");
}

async function confirmDelete() {
  const id = document.getElementById("deleteAssetId").value;
  try {
    const res = await fetch(`${apiUrl}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    closeDeleteModal();
    showToast("Activo eliminado", "info");
    loadAssets();
  } catch {
    showToast("No se pudo eliminar el activo", "error");
  }
}

/* ──────────────────────────────────────────
   EXPORTAR CSV
────────────────────────────────────────── */
function exportCSV() {
  const search   = document.getElementById("searchInput").value.toLowerCase().trim();
  const status   = document.getElementById("filterStatus").value;
  const catId    = document.getElementById("filterCategory").value;
  const location = document.getElementById("filterLocation").value;

  let data = [...allAssets];
  if (activeArea) data = data.filter(a => a.area === activeArea);
  if (search)     data = data.filter(a => a.name.toLowerCase().includes(search));
  if (status)     data = data.filter(a => a.status === status);
  if (catId)      data = data.filter(a => String(a.category_id) === String(catId));
  if (location)   data = data.filter(a => a.location === location);

  if (!data.length) { showToast("No hay datos para exportar", "info"); return; }

  const headers = ["ID","Nombre","Área","Categoría","Serie","Ubicación","Estado","Cantidad"];
  const statusLabel = { available:"Disponible", borrowed:"Prestado", maintenance:"En Mantenimiento", damaged:"Dañado" };
  const areaLabel   = { sistemas:"Sistemas", laboratorio:"Laboratorio / Alimentos" };

  const rows = data.map(a => [
    a.id,
    `"${(a.name || "").replace(/"/g, '""')}"`,
    areaLabel[a.area] || a.area || "—",
    `"${(a.categories?.name || "").replace(/"/g, '""')}"`,
    `"${(a.serial_number || "").replace(/"/g, '""')}"`,
    `"${(a.location || "").replace(/"/g, '""')}"`,
    statusLabel[a.status] || a.status,
    a.quantity ?? 1
  ].join(","));

  const csv  = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "activos.csv"; link.click();
  URL.revokeObjectURL(url);
  showToast("CSV exportado", "success");
}

// ── Tiempo real ──
document.addEventListener("DOMContentLoaded", () => {
  REALTIME.on("assets", (event) => {
    if (!document.querySelector(".modal.open, #assetModal.open")) {
      loadAssets();
    }
  });
});

/* ──────────────────────────────────────────
   INIT
────────────────────────────────────────── */
loadCategories();
loadAssets();
// ============================================
// SGIAC-ISC | consumibles.js
// ============================================

const API_URL = "/api/consumibles";
const CAT_URL = "/api/categories/consumables";

let allConsumables = [];
let categories     = [];
let activeArea     = "";

let currentRole = "alumno";
try {
  const u = JSON.parse(localStorage.getItem("user"));
  if (u && u.role) currentRole = u.role;
} catch {}
const isAdmin = currentRole === "administrador";

/* ─────────────────── INIT ─────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  await loadConsumables();
});

/* ─────────────────── CATEGORÍAS ─────────────────── */
async function loadCategories() {
  try {
    const res = await fetch(CAT_URL);
    if (!res.ok) throw new Error("Error cargando categorías");
    categories = await res.json();
    buildCategoryFilter();
  } catch (e) {
    console.warn("No se pudieron cargar categorías:", e.message);
  }
}

/** Rellena el filtro superior de categorías según el área activa */
function buildCategoryFilter() {
  const sel  = document.getElementById("categoryFilter");
  const prev = sel.value;
  sel.innerHTML = `<option value="">Todas las categorías</option>`;
  const lista = activeArea
    ? categories.filter(c => c.area === activeArea)
    : categories;
  lista.forEach(cat => {
    const opt       = document.createElement("option");
    opt.value       = cat.id;
    opt.textContent = cat.name;
    if (String(cat.id) === String(prev)) opt.selected = true;
    sel.appendChild(opt);
  });
}

/** Rellena el select de Categoría del modal, filtrado por área elegida */
function updateCategoryOptions() {
  const area = document.getElementById("consumibleArea").value;
  const sel  = document.getElementById("consumibleCategory");
  sel.innerHTML = `<option value="" disabled selected>Seleccione categoría</option>`;
  if (!area) return;
  const lista = categories.filter(c => c.area === area);
  if (!lista.length) {
    sel.innerHTML = `<option value="" disabled selected>Sin categorías para esta área</option>`;
    return;
  }
  lista.forEach(cat => {
    const opt       = document.createElement("option");
    opt.value       = cat.id;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}

/* ─────────────────── ÁREA TABS ─────────────────── */
function selectArea(btn, area) {
  document.querySelectorAll(".area-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  activeArea = area;
  buildCategoryFilter();
  applyFilters();
}

/* ─────────────────── CARGAR ─────────────────── */
async function loadConsumables() {
  showLoading();
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Error al cargar consumibles");
    allConsumables = await res.json();
    updateStats(allConsumables);
    renderTable(allConsumables);
  } catch (e) {
    showError("No se pudieron cargar los consumibles: " + e.message);
  }
}

/* ─────────────────── ESTADÍSTICAS ─────────────────── */
function updateStats(data) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in30  = new Date(today); in30.setDate(in30.getDate() + 30);

  const low      = data.filter(c => c.quantity <= c.min_quantity).length;
  const expiring = data.filter(c => {
    if (!c.expiry_date) return false;
    const ed = new Date(c.expiry_date);
    return ed >= today && ed <= in30;
  }).length;
  const ok = data.filter(c => c.quantity > c.min_quantity).length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("statTotal",  data.length);
  set("statLow",    low);
  set("statExpiry", expiring);
  set("statOk",     ok);
}

/* ─────────────────── RENDER TABLA ─────────────────── */
function renderTable(data) {
  const wrap  = document.getElementById("tableWrapper");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in30  = new Date(today); in30.setDate(in30.getDate() + 30);

  if (!data.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>No hay consumibles para los filtros seleccionados</p>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th>
        <th>Nombre</th>
        <th>Área</th>
        <th>Categoría</th>
        <th>Cant. existente</th>
        <th>Unidad</th>
        <th>Caducidad</th>
        <th>Ubicación</th>
        <th>Estado</th>
        <th>Acciones</th>
      </tr></thead>
      <tbody id="consumablesBody"></tbody>
    </table>`;

  const tbody = document.getElementById("consumablesBody");

  data.forEach(c => {
    const low = c.quantity <= c.min_quantity;

    const catName = c.categories?.name
      || categories.find(x => String(x.id) === String(c.category_id))?.name
      || "—";

    const area = c.area
      || categories.find(x => String(x.id) === String(c.category_id))?.area
      || "";

    const areaBadge = area === "sistemas"
      ? `<span class="badge badge-sistemas"><i class="fas fa-desktop"></i> Sistemas</span>`
      : area === "lab"
      ? `<span class="badge badge-lab"><i class="fas fa-microscope"></i> Lab/Alimentos</span>`
      : `<span style="color:#9ca3af;font-size:12px;">—</span>`;

    // Caducidad semáforo
    let expiryHtml = `<span class="expiry-none">Sin registro</span>`;
    if (c.expiry_date) {
      const ed  = new Date(c.expiry_date);
      const fmt = ed.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
      if      (ed < today)  expiryHtml = `<span class="expiry-expired"><i class="fas fa-times-circle"></i> ${fmt}</span>`;
      else if (ed <= in30)  expiryHtml = `<span class="expiry-soon"><i class="fas fa-clock"></i> ${fmt}</span>`;
      else                  expiryHtml = `<span class="expiry-ok">${fmt}</span>`;
    }

    // Estado con texto claro
    const estadoBadge = low
      ? `<span class="badge badge-low"><i class="fas fa-arrow-down"></i> Bajo</span>`
      : `<span class="badge badge-ok"><i class="fas fa-check"></i> Suficiente</span>`;

    const cantDisplay = `<strong style="color:${low ? "#dc2626" : "#374151"}">${c.quantity}</strong>`;

    // Acciones — eliminar llama a confirmDelete con modal personalizado
    const acciones = isAdmin
      ? `<i class="fas fa-edit edit-btn"    title="Editar"   onclick="openEdit(${c.id})"></i>
         <i class="fas fa-trash delete-btn" title="Eliminar" onclick="confirmDelete(${c.id}, '${esc(c.name)}')"></i>`
      : `<span style="color:#9ca3af;font-size:11px;">Solo lectura</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="color:#9ca3af;font-size:12px;">${c.id}</td>
      <td>
        <strong>${esc(c.name)}</strong>
        ${c.description ? `<br><small style="color:#9ca3af;font-size:11px;">${esc(c.description)}</small>` : ""}
      </td>
      <td>${areaBadge}</td>
      <td><span style="font-size:12.5px;">${esc(catName)}</span></td>
      <td>${cantDisplay}</td>
      <td style="color:#6b7280;font-size:12.5px;">${esc(c.unit)}</td>
      <td>${expiryHtml}</td>
      <td style="font-size:12px;color:#6b7280;">${esc(c.location || "Lab. Ciencias Básicas")}</td>
      <td>${estadoBadge}</td>
      <td class="actions">${acciones}</td>`;
    tbody.appendChild(tr);
  });
}

/* ─────────────────── FILTROS ─────────────────── */
function applyFilters() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const catId  = document.getElementById("categoryFilter").value;
  const stock  = document.getElementById("stockFilter").value;
  const expiry = document.getElementById("expiryFilter").value;
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const in30   = new Date(today); in30.setDate(in30.getDate() + 30);

  const filtered = allConsumables.filter(c => {
    const cArea = c.area
      || categories.find(x => String(x.id) === String(c.category_id))?.area || "";

    const matchSearch = c.name.toLowerCase().includes(search)
                     || (c.description || "").toLowerCase().includes(search);
    const matchArea   = !activeArea || cArea === activeArea;
    const matchCat    = !catId || String(c.category_id) === String(catId);
    const matchStock  = !stock
                     || (stock === "low" && c.quantity <= c.min_quantity)
                     || (stock === "ok"  && c.quantity >  c.min_quantity);

    let matchExpiry = true;
    if (expiry) {
      const ed = c.expiry_date ? new Date(c.expiry_date) : null;
      if      (expiry === "none")    matchExpiry = !ed;
      else if (expiry === "expired") matchExpiry = !!ed && ed < today;
      else if (expiry === "soon")    matchExpiry = !!ed && ed >= today && ed <= in30;
      else if (expiry === "ok")      matchExpiry = !!ed && ed > in30;
    }

    return matchSearch && matchArea && matchCat && matchStock && matchExpiry;
  });

  renderTable(filtered);
}

/* ─────────────────── UNIDAD → TIPO DE INPUT ─────────────────── */
function onUnitChange() {
  const unit      = document.getElementById("consumibleUnit").value;
  const wrapper   = document.getElementById("quantityWrapper");
  const isDecimal = unit === "kg" || unit === "litros";

  wrapper.innerHTML = `
    <input type="number" id="consumibleQuantity"
           placeholder="${isDecimal ? "0.00" : "0"}"
           min="0" step="${isDecimal ? "0.01" : "1"}" value="0"
           style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:7px;
                  font-size:13.5px;font-family:'Poppins',sans-serif;color:#374151;outline:none;transition:0.2s;"
           onfocus="this.style.borderColor='#4f46e5';this.style.boxShadow='0 0 0 3px rgba(79,70,229,0.08)'"
           onblur="this.style.borderColor='#d1d5db';this.style.boxShadow='none'">`;
}

/* ─────────────────── MODAL CONFIRMAR ELIMINAR ─────────────────── */
function confirmDelete(id, name) {
  let overlay = document.getElementById("deleteOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "deleteOverlay";
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(15,23,42,0.55);backdrop-filter:blur(3px);
      z-index:2000;display:flex;align-items:center;justify-content:center;`;
    overlay.innerHTML = `
      <div id="deleteCard" style="
        background:white;border-radius:14px;padding:28px 26px;width:360px;max-width:92vw;
        box-shadow:0 16px 48px rgba(0,0,0,0.2);text-align:center;">
        <div style="width:52px;height:52px;background:#fee2e2;border-radius:50%;
          display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
          <i class="fas fa-trash-alt" style="color:#dc2626;font-size:20px;"></i>
        </div>
        <h3 style="color:#1f2a3a;font-size:17px;margin-bottom:8px;">Eliminar consumible</h3>
        <p id="deleteMsg" style="color:#6b7280;font-size:13.5px;margin-bottom:22px;line-height:1.5;"></p>
        <div style="display:flex;gap:10px;">
          <button onclick="document.getElementById('deleteOverlay').remove()" style="
            flex:1;padding:10px;background:#f3f4f6;color:#374151;border:none;
            border-radius:8px;font-size:13.5px;font-family:'Poppins',sans-serif;cursor:pointer;">
            Cancelar
          </button>
          <button id="deleteConfirmBtn" style="
            flex:1;padding:10px;background:#dc2626;color:white;border:none;
            border-radius:8px;font-size:13.5px;font-family:'Poppins',sans-serif;cursor:pointer;">
            Sí, eliminar
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  }

  document.getElementById("deleteMsg").textContent =
    `¿Seguro que deseas eliminar "${name}"? Esta acción no se puede deshacer.`;
  document.getElementById("deleteConfirmBtn").onclick = () => {
    overlay.remove();
    deleteConsumable(id);
  };
}

/* ─────────────────── ELIMINAR ─────────────────── */
async function deleteConsumable(id) {
  try {
    const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    showToast("Consumible eliminado", "success");
    await loadConsumables();
  } catch {
    showToast("No se pudo eliminar", "error");
  }
}

/* ─────────────────── MODAL AGREGAR ─────────────────── */
function openModal() {
  document.getElementById("modalTitle").innerHTML =
    `<i class="fas fa-plus-circle" style="color:#4f46e5;margin-right:8px;"></i>Agregar Consumible`;
  document.getElementById("consumibleId").value          = "";
  document.getElementById("consumibleName").value        = "";
  document.getElementById("consumibleDescription").value = "";
  document.getElementById("consumibleArea").value        = "";
  document.getElementById("consumibleCategory").innerHTML =
    `<option value="" disabled selected>Seleccione área primero</option>`;
  document.getElementById("consumibleUnit").value        = "";
  document.getElementById("consumibleExpiry").value      = "";
  document.getElementById("consumibleLocation").value    = "Lab. Ciencias Básicas";
  // Input de cantidad por defecto (entero)
  document.getElementById("quantityWrapper").innerHTML = `
    <input type="number" id="consumibleQuantity" placeholder="0"
           min="0" step="1" value="0"
           style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:7px;
                  font-size:13.5px;font-family:'Poppins',sans-serif;color:#374151;outline:none;transition:0.2s;"
           onfocus="this.style.borderColor='#4f46e5';this.style.boxShadow='0 0 0 3px rgba(79,70,229,0.08)'"
           onblur="this.style.borderColor='#d1d5db';this.style.boxShadow='none'">`;
  document.getElementById("consumibleModal").classList.add("open");
}

/* ─────────────────── MODAL EDITAR ─────────────────── */
function openEdit(id) {
  const c = allConsumables.find(x => x.id === id);
  if (!c) return;

  const cArea = c.area
    || categories.find(x => String(x.id) === String(c.category_id))?.area
    || "";

  document.getElementById("modalTitle").innerHTML =
    `<i class="fas fa-edit" style="color:#4f46e5;margin-right:8px;"></i>Editar Consumible`;
  document.getElementById("consumibleId").value          = c.id;
  document.getElementById("consumibleName").value        = c.name;
  document.getElementById("consumibleDescription").value = c.description || "";
  document.getElementById("consumibleArea").value        = cArea;
  updateCategoryOptions();
  document.getElementById("consumibleCategory").value    = c.category_id || "";
  document.getElementById("consumibleUnit").value        = c.unit || "";
  document.getElementById("consumibleExpiry").value      = c.expiry_date || "";
  document.getElementById("consumibleLocation").value    = c.location || "Lab. Ciencias Básicas";

  // Regenerar input según la unidad guardada
  const isDecimal = c.unit === "kg" || c.unit === "litros";
  document.getElementById("quantityWrapper").innerHTML = `
    <input type="number" id="consumibleQuantity"
           placeholder="${isDecimal ? "0.00" : "0"}"
           min="0" step="${isDecimal ? "0.01" : "1"}" value="${c.quantity}"
           style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:7px;
                  font-size:13.5px;font-family:'Poppins',sans-serif;color:#374151;outline:none;transition:0.2s;"
           onfocus="this.style.borderColor='#4f46e5';this.style.boxShadow='0 0 0 3px rgba(79,70,229,0.08)'"
           onblur="this.style.borderColor='#d1d5db';this.style.boxShadow='none'">`;

  document.getElementById("consumibleModal").classList.add("open");
}

function closeModal() {
  document.getElementById("consumibleModal").classList.remove("open");
}

/* ─────────────────── GUARDAR ─────────────────── */
async function saveConsumible() {
  const id          = document.getElementById("consumibleId").value;
  const name        = document.getElementById("consumibleName").value.trim();
  const description = document.getElementById("consumibleDescription").value.trim();
  const category_id = document.getElementById("consumibleCategory").value;
  const unit        = document.getElementById("consumibleUnit").value;
  const expiry_date = document.getElementById("consumibleExpiry").value || null;
  const location    = document.getElementById("consumibleLocation").value.trim();

  const qRaw      = document.getElementById("consumibleQuantity").value;
  const isDecimal = unit === "kg" || unit === "litros";
  const quantity  = isDecimal ? parseFloat(qRaw) : parseInt(qRaw);

  if (!name || !category_id || !unit || isNaN(quantity)) {
    showToast("Completa todos los campos obligatorios", "error");
    return;
  }

  const body   = { name, description, category_id, quantity, min_quantity: 0, unit, expiry_date, location };
  const url    = id ? `${API_URL}/${id}` : API_URL;
  const method = id ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json();
      showToast("Error: " + (err.message || "No se pudo guardar"), "error");
      return;
    }
    showToast(id ? "Consumible actualizado ✅" : "Consumible agregado ✅", "success");
    closeModal();
    await loadConsumables();
  } catch {
    showToast("No se pudo conectar con el servidor", "error");
  }
}

/* ─────────────────── EXPORTAR CSV ─────────────────── */
function exportCSV() {
  let csv = "ID,Nombre,Descripción,Área,Categoría,Cantidad,Unidad,Caducidad,Ubicación,Estado\n";
  allConsumables.forEach(c => {
    const catName = c.categories?.name
      || categories.find(x => String(x.id) === String(c.category_id))?.name || "";
    const area   = c.area
      || categories.find(x => String(x.id) === String(c.category_id))?.area || "";
    const estado = c.quantity <= c.min_quantity ? "Bajo" : "Suficiente";
    csv += `${c.id},"${(c.name||"").replace(/"/g,'""')}","${(c.description||"").replace(/"/g,'""')}",`
         + `"${area}","${catName}",${c.quantity},"${c.unit}","${c.expiry_date||""}","${c.location||""}","${estado}"\n`;
  });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = "consumibles.csv"; a.click();
  URL.revokeObjectURL(url);
  showToast("Exportado correctamente ✅", "success");
}

/* ─────────────────── UTILS ─────────────────── */
function toggleMenu() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("show");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("show");
}
function showLoading() {
  document.getElementById("tableWrapper").innerHTML =
    `<div class="loading"><i class="fas fa-spinner"></i>
     <p style="margin-top:8px;font-size:13px;color:#9ca3af;">Cargando consumibles...</p></div>`;
}
function showError(msg) {
  document.getElementById("tableWrapper").innerHTML =
    `<div class="empty-state">
       <i class="fas fa-exclamation-circle" style="color:#ef4444"></i>
       <p>${msg}</p>
     </div>`;
}
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3200);
}
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/'/g,"&#39;");
}

document.getElementById("consumibleModal").addEventListener("click", function (e) {
  if (e.target === this) closeModal();
});
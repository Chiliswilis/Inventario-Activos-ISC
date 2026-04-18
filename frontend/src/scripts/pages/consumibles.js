const API_URL = "/api/consumibles";
const CAT_URL = "/api/categories/consumables";

let allConsumables = [];
let categories     = [];
let activeArea     = "";

// ── Paginación ──
let _currentPage  = 1;
let _pageSize     = 20;  // elementos por página por defecto

let currentRole = "alumno";
try {
  const u = JSON.parse(sessionStorage.getItem("user"));
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
  // Actualizar unidades y caducidad según la primera categoría disponible
  onCategoryChange();
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

  const low      = data.filter(c => getStockLevel(c) === "low").length;
  const expiring = data.filter(c => {
    if (!c.expiry_date) return false;
    const ed = new Date(c.expiry_date);
    return ed >= today && ed <= in30;
  }).length;
  const ok = data.filter(c => getStockLevel(c) === "ok").length;

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
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>No hay consumibles para los filtros seleccionados</p></div>`;
    return;
  }

  // ── Paginación ──
  const totalPages = Math.ceil(data.length / _pageSize);
  _currentPage     = Math.min(_currentPage, totalPages);
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

  wrap.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th><th>Nombre</th><th>Área</th><th>Categoría</th>
        <th>Cant.</th><th>Unidad</th><th>Caducidad</th>
        <th>Ubicación</th><th>Estado</th><th>Acciones</th>
      </tr></thead>
      <tbody id="consumablesBody"></tbody>
    </table>
    ${paginationBar}`;

  const tbody = document.getElementById("consumablesBody");

  pageData.forEach(c => {
    const stockLevel = getStockLevel(c);
    const low = stockLevel === "low";
    const mid = stockLevel === "mid";

    const catName = c.categories?.name
      || categories.find(x => String(x.id) === String(c.category_id))?.name || "—";

    const area = c.area
      || categories.find(x => String(x.id) === String(c.category_id))?.area || "";

    const areaBadge = area === "sistemas"
      ? `<span class="badge badge-sistemas"><i class="fas fa-desktop"></i> Sistemas</span>`
      : area === "laboratorio"
      ? `<span class="badge badge-lab"><i class="fas fa-microscope"></i> Lab / Alimentos</span>`
      : `<span style="color:#9ca3af;font-size:12px;">—</span>`;

    let expiryHtml = `<span class="expiry-none">Sin registro</span>`;
    if (c.expiry_date) {
      const ed  = new Date(c.expiry_date);
      const fmt = ed.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
      if      (ed < today)  expiryHtml = `<span class="expiry-expired"><i class="fas fa-times-circle"></i> ${fmt}</span>`;
      else if (ed <= in30)  expiryHtml = `<span class="expiry-soon"><i class="fas fa-clock"></i> ${fmt}</span>`;
      else                  expiryHtml = `<span class="expiry-ok">${fmt}</span>`;
    }

    const estadoBadge = low
      ? `<span class="badge badge-low"><i class="fas fa-arrow-down"></i> Bajo stock</span>`
      : mid
      ? `<span class="badge badge-mid"><i class="fas fa-exclamation-triangle"></i> Stock medio</span>`
      : `<span class="badge badge-ok"><i class="fas fa-check"></i> Suficiente</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="color:#9ca3af;font-size:12px;">${c.id}</td>
      <td><strong>${esc(c.name)}</strong>${c.description ? `<br><small style="color:#9ca3af;font-size:11px;">${esc(c.description)}</small>` : ""}</td>
      <td>${areaBadge}</td>
      <td><span style="font-size:12.5px;">${esc(catName)}</span></td>
      <td><strong style="color:${low ? "#dc2626" : "#374151"}">${c.quantity}</strong></td>
      <td style="color:#6b7280;font-size:12.5px;">${esc(c.unit)}</td>
      <td>${expiryHtml}</td>
      <td style="font-size:12px;color:#6b7280;">${esc(c.location || "—")}</td>
      <td>${estadoBadge}</td>
      <td class="actions">${isAdmin
        ? `<i class="fas fa-edit edit-btn" title="Editar" onclick="openEdit(${c.id})"></i>
           <i class="fas fa-trash delete-btn" title="Eliminar" onclick="confirmDelete(${c.id},'${esc(c.name)}')"></i>`
        : `<span style="color:#9ca3af;font-size:11px;">Solo lectura</span>`}</td>`;
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
                     || (stock === "low" && getStockLevel(c) === "low")
                     || (stock === "mid" && getStockLevel(c) === "mid")
                     || (stock === "ok"  && getStockLevel(c) === "ok");

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

  _currentPage = 1;  // reset al filtrar
  updateStats(filtered);
  renderTable(filtered);
}

/** Se ejecuta cuando el usuario cambia la categoría en el modal.
 *  Actualiza las opciones de Unidad según área + categoría:
 *  - Sistemas > Cómputo  → Pieza, Metros
 *  - Laboratorio/Alimentos → Pieza, Litros, Kilogramos
 *  - Otros                → Pieza, Litros, Kilogramos
 */
function onCategoryChange() {
  const area    = document.getElementById("consumibleArea").value;
  const catSel  = document.getElementById("consumibleCategory");
  const catText = (catSel.options[catSel.selectedIndex]?.text || "").toLowerCase();
  const unitSel = document.getElementById("consumibleUnit");
  const prev    = unitSel.value;

  // Fix: paréntesis correctos — antes faltaban y "computo" siempre era true
  const isComputo = area === "sistemas" && (catText.includes("cómputo") || catText.includes("computo"));

  if (isComputo) {
    unitSel.innerHTML = `
      <option value="" disabled selected>Seleccione unidad</option>
      <option value="pieza">Pieza</option>
      <option value="metros">Metros</option>`;
  } else if (area === "sistemas") {
    unitSel.innerHTML = `
      <option value="" disabled selected>Seleccione unidad</option>
      <option value="pieza">Pieza</option>`;
  } else {
    // Laboratorio / Alimentos y otros — incluye gramos
    unitSel.innerHTML = `
      <option value="" disabled selected>Seleccione unidad</option>
      <option value="pieza">Pieza</option>
      <option value="litros">Litros</option>
      <option value="kg">Kilogramos (kg)</option>
      <option value="gramos">Gramos (g)</option>
      <option value="metros">Metros</option>`;
  }

  // Restaurar valor previo si sigue siendo válido
  if (prev && [...unitSel.options].some(o => o.value === prev)) {
    unitSel.value = prev;
  }

  onUnitChange();
}


/* ─────────────────── STOCK HELPERS ─────────────────── */
/**
 * Devuelve el nivel de stock:
 *  "low" → cantidad ≤ 2  (piezas/metros)
 *  "mid" → cantidad 3–7  (zona de alerta)
 *  "ok"  → cantidad > 7
 * Para kg/litros usa min_quantity de la BD.
 */
function getStockLevel(c) {
  const unit = (c.unit || "").toLowerCase();
  if (unit === "kg" || unit === "litros") {
    return c.quantity <= c.min_quantity ? "low" : "ok";
  }
  if (c.quantity <= 2) return "low";
  if (c.quantity <= 7) return "mid";
  return "ok";
}

/* ─────────────────── UNIDAD → TIPO DE INPUT ─────────────────── */
function onUnitChange() {
  const unit      = document.getElementById("consumibleUnit").value;
  const wrapper   = document.getElementById("quantityWrapper");
  const isDecimal = unit === "kg" || unit === "litros" || unit === "gramos";
  const isEditing = !!document.getElementById("consumibleId").value;

  // Al editar, conservar el valor actual del input antes de regenerarlo
  const prevQty = isEditing
    ? (document.getElementById("consumibleQuantity")?.value || "0")
    : "0";

  wrapper.innerHTML = `
    <input type="number" id="consumibleQuantity"
           placeholder="${isDecimal ? "0.00" : "0"}"
           min="0" step="${isDecimal ? "0.01" : "1"}" value="${prevQty}"
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

  // Ajustar unidades según categoría ANTES de poner el valor guardado
  onCategoryChange();
  // Ahora restaurar la unidad guardada (si existe en las opciones)
  const unitSel = document.getElementById("consumibleUnit");
  if ([...unitSel.options].some(o => o.value === (c.unit || ""))) {
    unitSel.value = c.unit || "";
  }

  document.getElementById("consumibleExpiry").value      = c.expiry_date || "";
  document.getElementById("consumibleLocation").value    = c.location || "Lab. Ciencias Básicas";

  // Regenerar input de cantidad con el step correcto
  const isDecimal = ["kg","litros","metros"].includes(c.unit);
  const step      = c.unit === "metros" ? "0.01" : isDecimal ? "0.01" : "1";
  document.getElementById("quantityWrapper").innerHTML = `
    <input type="number" id="consumibleQuantity"
           placeholder="${isDecimal ? "0.00" : "0"}"
           min="0" step="${step}" value="${c.quantity}"
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
  const area        = document.getElementById("consumibleArea").value;
  const category_id = document.getElementById("consumibleCategory").value;
  const unit        = document.getElementById("consumibleUnit").value;
  const expiry_date = document.getElementById("consumibleExpiry").value || null;
  const location    = document.getElementById("consumibleLocation").value.trim();

  const qRaw      = document.getElementById("consumibleQuantity").value;
  const isDecimal = unit === "kg" || unit === "litros" || unit === "metros";
  const quantity  = isDecimal ? parseFloat(qRaw) : parseInt(qRaw);

  if (!name || !area || !category_id || !unit || isNaN(quantity)) {
    showToast("Completa todos los campos obligatorios (incluyendo área)", "error");
    return;
  }

  // ✅ Incluir área en el body para que se guarde en la BD
  const body   = { name, description, area, category_id, quantity, min_quantity: 0, unit, expiry_date, location };
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
    const areaLabel = { sistemas: "Sistemas", laboratorio: "Laboratorio / Alimentos" };
    const estado = getStockLevel(c) === "low" ? "Bajo stock" : getStockLevel(c) === "mid" ? "Stock medio" : "Suficiente";
    csv += `${c.id},"${(c.name||"").replace(/"/g,'""')}","${(c.description||"").replace(/"/g,'""')}",`
         + `"${areaLabel[area]||area}","${catName}",${c.quantity},"${c.unit}","${c.expiry_date||""}","${c.location||""}","${estado}"\n`;
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

  // ── Tiempo real ──
  document.addEventListener("DOMContentLoaded", () => {
    REALTIME.on("consumables", (event) => {
      // Recargar solo si no hay un modal abierto (para no interrumpir al admin)
      if (!document.querySelector(".modal.open")) {
        loadConsumables();
      }
    });
  });
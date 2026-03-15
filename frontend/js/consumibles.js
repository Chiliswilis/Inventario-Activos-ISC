const API_URL = "http://localhost:3000/api/consumibles";
const CAT_URL = "http://localhost:3000/api/categories/consumables";

let allConsumables = [];
let categories     = [];
let activeCategory = "";

/* INIT */
document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  await loadConsumables();
});

/* CATEGORÍAS */
async function loadCategories() {
  try {
    const res = await fetch(CAT_URL);
    if (!res.ok) throw new Error();
    categories = await res.json();
    buildCategoryTabs();
    buildCategorySelect();
  } catch {
    console.warn("No se pudieron cargar categorías");
  }
}

function buildCategoryTabs() {
  const tabs = document.getElementById("categoryTabs");
  tabs.innerHTML = `<button class="tab-btn active" data-cat="" onclick="selectTab(this,'')">Todas</button>`;
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className   = "tab-btn";
    btn.dataset.cat = cat.id;
    btn.textContent = cat.name;
    btn.onclick     = () => selectTab(btn, cat.id);
    tabs.appendChild(btn);
  });
}

function buildCategorySelect() {
  const sel = document.getElementById("consumibleCategory");
  sel.innerHTML = `<option value="" disabled selected>Seleccione una categoría</option>`;
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value       = cat.id;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
}

/* LISTAR */
async function loadConsumables() {
  showLoading();
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Error al cargar");
    allConsumables = await res.json();
    renderTable(allConsumables);
  } catch (e) {
    showError("No se pudieron cargar los consumibles: " + e.message);
  }
}

/* RENDER */
function renderTable(data) {
  const wrap = document.getElementById("tableWrapper");
  if (!data.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>No hay consumibles registrados</p></div>`;
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Nombre</th><th>Categoría</th>
          <th>Cantidad</th><th>Mínimo</th><th>Unidad</th>
          <th>Estado</th><th>Acciones</th>
        </tr>
      </thead>
      <tbody id="consumablesBody"></tbody>
    </table>`;

  const tbody = document.getElementById("consumablesBody");
  data.forEach(c => {
    const low     = c.quantity <= c.min_quantity;
    const catName = c.categories ? c.categories.name
                  : (categories.find(x => x.id == c.category_id)?.name || "—");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.id}</td>
      <td><strong>${esc(c.name)}</strong>
        ${c.description ? `<br><small style="color:#9ca3af">${esc(c.description)}</small>` : ""}
      </td>
      <td>${esc(catName)}</td>
      <td>${c.quantity}</td>
      <td>${c.min_quantity}</td>
      <td>${esc(c.unit)}</td>
      <td>${low
        ? `<span class="badge-low"><i class="fas fa-exclamation-triangle"></i> Stock bajo</span>`
        : `<span class="badge-ok"><i class="fas fa-check"></i> OK</span>`}</td>
      <td class="actions">
        <i class="fas fa-edit edit-btn"    title="Editar"   onclick="openEdit(${c.id})"></i>
        <i class="fas fa-trash delete-btn" title="Eliminar" onclick="deleteConsumable(${c.id})"></i>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* FILTROS */
function selectTab(btn, catId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  activeCategory = catId;
  applyFilters();
}

function applyFilters() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const stock  = document.getElementById("stockFilter").value;
  const filtered = allConsumables.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search) ||
                        (c.description || "").toLowerCase().includes(search);
    const matchCat    = !activeCategory || String(c.category_id) === String(activeCategory);
    const matchStock  = !stock ||
                        (stock === "low" && c.quantity <= c.min_quantity) ||
                        (stock === "ok"  && c.quantity >  c.min_quantity);
    return matchSearch && matchCat && matchStock;
  });
  renderTable(filtered);
}

/* MODAL AGREGAR */
function openModal() {
  document.getElementById("modalTitle").textContent         = "Agregar Consumible";
  document.getElementById("consumibleId").value             = "";
  document.getElementById("consumibleName").value           = "";
  document.getElementById("consumibleDescription").value    = "";
  document.getElementById("consumibleCategory").value       = "";
  document.getElementById("consumibleQuantity").value       = "0";
  document.getElementById("consumibleMinQuantity").value    = "0";
  document.getElementById("consumibleUnit").value           = "";
  document.getElementById("consumibleModal").classList.add("open");
}

/* MODAL EDITAR */
function openEdit(id) {
  const c = allConsumables.find(x => x.id === id);
  if (!c) return;
  document.getElementById("modalTitle").textContent         = "Editar Consumible";
  document.getElementById("consumibleId").value             = c.id;
  document.getElementById("consumibleName").value           = c.name;
  document.getElementById("consumibleDescription").value    = c.description || "";
  document.getElementById("consumibleCategory").value       = c.category_id || "";
  document.getElementById("consumibleQuantity").value       = c.quantity;
  document.getElementById("consumibleMinQuantity").value    = c.min_quantity;
  document.getElementById("consumibleUnit").value           = c.unit;
  document.getElementById("consumibleModal").classList.add("open");
}

function closeModal() {
  document.getElementById("consumibleModal").classList.remove("open");
}

/* GUARDAR */
async function saveConsumible() {
  const id          = document.getElementById("consumibleId").value;
  const name        = document.getElementById("consumibleName").value.trim();
  const description = document.getElementById("consumibleDescription").value.trim();
  const category_id = document.getElementById("consumibleCategory").value;
  const quantity    = parseInt(document.getElementById("consumibleQuantity").value);
  const min_quantity= parseInt(document.getElementById("consumibleMinQuantity").value);
  const unit        = document.getElementById("consumibleUnit").value.trim();

  if (!name || !category_id || !unit || isNaN(quantity) || isNaN(min_quantity)) {
    showToast("Completa todos los campos obligatorios", "error"); return;
  }

  const body   = { name, description, category_id, quantity, min_quantity, unit };
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
      showToast("Error: " + (err.message || "No se pudo guardar"), "error"); return;
    }
    showToast(id ? "Consumible actualizado ✅" : "Consumible agregado ✅", "success");
    closeModal();
    await loadConsumables();
  } catch {
    showToast("No se pudo conectar con el servidor", "error");
  }
}

/* ELIMINAR */
async function deleteConsumable(id) {
  if (!confirm("¿Seguro que deseas eliminar este consumible?")) return;
  try {
    const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    showToast("Consumible eliminado", "success");
    await loadConsumables();
  } catch {
    showToast("No se pudo eliminar", "error");
  }
}

/* EXPORTAR CSV */
function exportCSV() {
  let csv = "ID,Nombre,Descripción,Categoría,Cantidad,Mínimo,Unidad\n";
  allConsumables.forEach(c => {
    const cat = c.categories ? c.categories.name : "";
    csv += `${c.id},"${(c.name||"").replace(/"/g,'""')}","${(c.description||"").replace(/"/g,'""')}","${cat}",${c.quantity},${c.min_quantity},"${c.unit}"\n`;
  });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "consumibles.csv"; a.click();
  URL.revokeObjectURL(url);
  showToast("Exportado correctamente", "success");
}

/* UTILS */
function toggleMenu() { document.getElementById("sidebar").classList.toggle("hide"); }

function showLoading() {
  document.getElementById("tableWrapper").innerHTML =
    `<div class="loading"><i class="fas fa-spinner"></i><p style="margin-top:8px;font-size:13px;">Cargando...</p></div>`;
}

function showError(msg) {
  document.getElementById("tableWrapper").innerHTML =
    `<div class="empty-state"><i class="fas fa-exclamation-circle" style="color:#ef4444"></i><p>${msg}</p></div>`;
}

function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3000);
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

document.getElementById("consumibleModal").addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});
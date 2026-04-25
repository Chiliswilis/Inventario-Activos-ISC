const CAT_API = "/api/categories";

/* ── Estado local ── */
let _catList     = [];   // todas las categorías cargadas
let _catEditId   = null; // null = crear, number = editar

/* ═══════════════ ABRIR MODAL ═══════════════ */
function openCatManager() {
  _fetchAndRenderCats();
  document.getElementById("catManagerModal").classList.add("open");
  _showCatForm(false); // empezar en vista lista
}

function closeCatManager() {
  document.getElementById("catManagerModal").classList.remove("open");
}

/* ═══════════════ FETCH + RENDER LISTA ═══════════════ */
async function _fetchAndRenderCats() {
  const listEl = document.getElementById("catList");
  listEl.innerHTML = `<div style="text-align:center;padding:24px;color:#9ca3af;">
    <i class="fas fa-spinner fa-spin"></i> Cargando…</div>`;
  try {
    const res = await fetch(CAT_API);
    if (!res.ok) throw new Error();
    const all = await res.json();
    // filtrar por tipo de la página actual
    _catList = all.filter(c => c.type === (pageType === "asset" ? "asset" : "consumable"));
    _renderCatList();
  } catch {
    listEl.innerHTML = `<div style="text-align:center;padding:24px;color:#ef4444;">
      Error al cargar categorías</div>`;
  }
}

function _renderCatList() {
  const listEl = document.getElementById("catList");
  if (!_catList.length) {
    listEl.innerHTML = `<div style="text-align:center;padding:24px;color:#9ca3af;">
      Sin categorías registradas</div>`;
    return;
  }

  const areaLabel = { sistemas: "Sistemas", laboratorio: "Lab / Alimentos" };
  const areaColor = { sistemas: "#4f46e5", laboratorio: "#059669" };

  listEl.innerHTML = _catList.map(c => `
    <div class="cat-item" id="cat-item-${c.id}">
      <div class="cat-item-info">
        <span class="cat-item-name">${_esc(c.name)}</span>
        <span class="cat-item-area" style="background:${areaColor[c.area] || "#6b7280"}15;
              color:${areaColor[c.area] || "#6b7280"};">
          ${areaLabel[c.area] || c.area || "—"}
        </span>
        ${c.description ? `<span class="cat-item-desc">${_esc(c.description)}</span>` : ""}
      </div>
      <div class="cat-item-actions">
        <button class="cat-btn-edit" onclick="_openCatForm(${c.id})" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button class="cat-btn-delete" onclick="_deleteCat(${c.id}, '${_esc(c.name)}')" title="Eliminar">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`).join("");
}

/* ═══════════════ FORMULARIO ADD / EDIT ═══════════════ */
function _showCatForm(show) {
  document.getElementById("catFormSection").style.display = show ? "" : "none";
  document.getElementById("catListSection").style.display = show ? "none" : "";
}

function openAddCat() {
  _catEditId = null;
  document.getElementById("catFormTitle").textContent   = "Nueva categoría";
  document.getElementById("catInputName").value         = "";
  document.getElementById("catInputDesc").value         = "";
  document.getElementById("catInputArea").value         = "";
  _showCatForm(true);
  document.getElementById("catInputName").focus();
}

function _openCatForm(id) {
  const cat = _catList.find(c => c.id === id);
  if (!cat) return;
  _catEditId = id;
  document.getElementById("catFormTitle").textContent   = "Editar categoría";
  document.getElementById("catInputName").value         = cat.name;
  document.getElementById("catInputDesc").value         = cat.description || "";
  document.getElementById("catInputArea").value         = cat.area || "";
  _showCatForm(true);
  document.getElementById("catInputName").focus();
}

function cancelCatForm() {
  _showCatForm(false);
}

/* ═══════════════ GUARDAR (POST / PUT) ═══════════════ */
async function saveCat() {
  const name = document.getElementById("catInputName").value.trim();
  const desc = document.getElementById("catInputDesc").value.trim();
  const area = document.getElementById("catInputArea").value;

  if (!name || !area) {
    _catToast("Nombre y área son obligatorios", "error"); return;
  }

  const body = {
    name,
    description: desc || null,
    type: pageType === "asset" ? "asset" : "consumable",
    area
  };

  const url    = _catEditId ? `${CAT_API}/${_catEditId}` : CAT_API;
  const method = _catEditId ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      _catToast("Error: " + (e.message || "No se pudo guardar"), "error"); return;
    }
    _catToast(_catEditId ? "Categoría actualizada" : "Categoría creada", "success");
    _showCatForm(false);
    await _fetchAndRenderCats();
    // Refrescar el select de categorías de la página principal
    if (typeof loadCategories === "function") loadCategories();
  } catch {
    _catToast("Sin conexión con el servidor", "error");
  }
}

/* ═══════════════ ELIMINAR ═══════════════ */
async function _deleteCat(id, name) {
  // Mini confirm inline
  const item = document.getElementById(`cat-item-${id}`);
  if (!item) return;

  // Evitar doble confirmación
  if (item.querySelector(".cat-confirm-row")) return;

  const confirmRow = document.createElement("div");
  confirmRow.className = "cat-confirm-row";
  confirmRow.innerHTML = `
    <span>¿Eliminar "<strong>${_esc(name)}</strong>"?</span>
    <button class="cat-btn-confirm-yes" onclick="_doCatDelete(${id})">Sí, eliminar</button>
    <button class="cat-btn-confirm-no"  onclick="this.closest('.cat-confirm-row').remove()">Cancelar</button>`;
  item.appendChild(confirmRow);
}

async function _doCatDelete(id) {
  try {
    const res = await fetch(`${CAT_API}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      _catToast("No se pudo eliminar: " + (e.message || "error"), "error"); return;
    }
    _catToast("Categoría eliminada", "success");
    await _fetchAndRenderCats();
    if (typeof loadCategories === "function") loadCategories();
  } catch {
    _catToast("Sin conexión con el servidor", "error");
  }
}

/* ═══════════════ UTILS ═══════════════ */
function _esc(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/'/g,"&#39;");
}

function _catToast(msg, type = "success") {
  // Reusar el toast existente de la página si existe
  const t = document.getElementById("toast");
  if (t) {
    t.textContent = msg;
    t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove("show"), 3200);
  }
}

/* ── Cerrar con clic en backdrop ── */
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("catManagerModal");
  if (modal) {
    modal.addEventListener("click", e => {
      if (e.target === modal) closeCatManager();
    });
  }
});
const apiUrl = "/api/assets";
const catUrl = "/api/categories/assets";

let allAssets   = [];
let currentRole = "alumno";
try {
  const u = JSON.parse(localStorage.getItem("user"));
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

/* ── CATEGORÍAS ── */
async function loadCategories() {
  try {
    const res = await fetch(catUrl);
    if (!res.ok) throw new Error();
    const cats = await res.json();
    const sel  = document.getElementById("assetCategory");
    sel.innerHTML = '<option value="" disabled selected>Selecciona categoría</option>';
    cats.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id; opt.textContent = c.name;
      sel.appendChild(opt);
    });
  } catch { console.warn("Categorías no disponibles"); }
}

/* ── LISTAR ── */
async function loadAssets() {
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error();
    allAssets = await res.json();
    applyFilters();
  } catch {
    document.getElementById("tableWrapper").innerHTML =
      `<div class="empty-state"><i class="fas fa-exclamation-circle" style="color:#dc2626;"></i><p>Error al conectar con el servidor</p></div>`;
  }
}

/* ── FILTROS ── */
function applyFilters() {
  const search = document.getElementById("searchInput").value.toLowerCase().trim();
  const status = document.getElementById("filterStatus").value;
  let data = [...allAssets];
  if (search) data = data.filter(a => a.name.toLowerCase().includes(search));
  if (status) data = data.filter(a => a.status === status);
  renderTable(data);
}

/* ── RENDER TABLA ── */
function renderTable(data) {
  const wrap = document.getElementById("tableWrapper");

  if (!data.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>Sin activos registrados</p></div>`;
    return;
  }

  const badgeMap = {
    available:   '<span class="badge badge-available"><i class="fas fa-circle" style="font-size:7px;"></i> Disponible</span>',
    borrowed:    '<span class="badge badge-borrowed"><i class="fas fa-circle" style="font-size:7px;"></i> Prestado</span>',
    maintenance: '<span class="badge badge-maintenance"><i class="fas fa-circle" style="font-size:7px;"></i> En Mantenimiento</span>',
    damaged:     '<span class="badge badge-damaged"><i class="fas fa-circle" style="font-size:7px;"></i> Dañado</span>'
  };

  const rows = data.map(a => {
    const catName = a.categories ? a.categories.name : "—";
    const badge   = badgeMap[a.status] || `<span class="badge">${a.status}</span>`;
    const safeName = (a.name || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const acciones = isAdmin
      ? `<button class="action-btn action-edit"   onclick="editAsset(${a.id})"   title="Editar"><i class="fas fa-edit"></i></button>
         <button class="action-btn action-delete" onclick="openDeleteModal(${a.id}, '${safeName}')" title="Eliminar"><i class="fas fa-trash"></i></button>`
      : `<span style="color:#9ca3af;font-size:12px;">Solo lectura</span>`;

    return `<tr>
      <td>${a.id}</td>
      <td><strong>${a.name}</strong></td>
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
      <thead><tr>
        <th>ID</th><th>Nombre</th><th>Categoría</th><th>Serie</th>
        <th>Ubicación</th><th>Estado</th><th style="text-align:center;">Cant.</th><th>Acciones</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ── ABRIR MODAL AGREGAR ── */
function openModal() {
  document.getElementById("modalTitle").textContent    = "Agregar Activo";
  document.getElementById("assetId").value             = "";
  document.getElementById("assetName").value           = "";
  document.getElementById("assetDescription").value   = "";
  document.getElementById("assetCategory").value       = "";
  document.getElementById("assetSerial").value         = "";
  document.getElementById("assetEdificio").value       = "";
  document.getElementById("assetLaboratorio").value    = "";
  document.getElementById("assetStatus").value         = "available";
  document.getElementById("assetQuantity").value       = "1";
  document.getElementById("assetModal").classList.add("open");
}

function closeModal() {
  document.getElementById("assetModal").classList.remove("open");
}

/* ── GUARDAR ── */
async function saveAsset() {
  const id            = document.getElementById("assetId").value;
  const name          = document.getElementById("assetName").value.trim();
  const description   = document.getElementById("assetDescription").value.trim();
  const category_id   = document.getElementById("assetCategory").value;
  const serial_number = document.getElementById("assetSerial").value.trim();
  const edificio      = document.getElementById("assetEdificio").value.trim();
  const laboratorio   = document.getElementById("assetLaboratorio").value.trim();
  const status        = document.getElementById("assetStatus").value;
  const quantity      = parseInt(document.getElementById("assetQuantity").value, 10) || 1;

  if (!name || !category_id || !serial_number || !edificio || !laboratorio) {
    showToast("Nombre, categoría, serie, edificio y laboratorio son obligatorios", "error");
    return;
  }

  const location = `${edificio}, ${laboratorio}`;
  const body     = { name, description, category_id, serial_number, location, status, quantity };
  const url      = id ? `${apiUrl}/${id}` : apiUrl;
  const method   = id ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const e = await res.json();
      showToast("Error: " + (e.message || "No se pudo guardar"), "error");
      return;
    }
    closeModal();
    showToast(id ? "Activo actualizado ✅" : "Activo agregado ✅", "success");
    loadAssets();
  } catch {
    showToast("No se pudo conectar con el servidor", "error");
  }
}

/* ── EDITAR ── */
async function editAsset(id) {
  try {
    const res = await fetch(`${apiUrl}/${id}`);
    if (!res.ok) throw new Error();
    const a = await res.json();

    // Separar "Edificio A, Laboratorio de Sistemas" en dos campos
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

/* ── MODAL CONFIRMAR ELIMINAR ── */
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

/* ── EXPORTAR CSV ── */
function exportCSV() {
  if (!allAssets.length) { showToast("No hay datos para exportar", "info"); return; }
  const headers = ["ID","Nombre","Categoría","Serie","Ubicación","Estado","Cantidad"];
  const statusLabel = {
    available:   "Disponible",
    borrowed:    "Prestado",
    maintenance: "En Mantenimiento",
    damaged:     "Dañado"
  };
  const rows = allAssets.map(a => [
    a.id,
    `"${(a.name || "").replace(/"/g,'""')}"`,
    `"${(a.categories?.name || "").replace(/"/g,'""')}"`,
    `"${(a.serial_number || "").replace(/"/g,'""')}"`,
    `"${(a.location || "").replace(/"/g,'""')}"`,
    statusLabel[a.status] || a.status,
    a.quantity ?? 1
  ].join(","));
  const csv  = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv, { type: "text/csv;charset=utf-8;" }]);
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "activos.csv"; link.click();
  URL.revokeObjectURL(url);
  showToast("CSV exportado ✅", "success");
}

/* ── INIT ── */
loadCategories();
loadAssets();
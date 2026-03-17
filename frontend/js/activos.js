const apiUrl = "http://localhost:3000/api/assets";
const catUrl = "http://localhost:3000/api/categories/assets";

const assetsTableBody = document.getElementById("assetsTableBody");
const assetCategory   = document.getElementById("assetCategory");

/* ── CATEGORÍAS ── */
async function loadCategories() {
  try {
    const res = await fetch(catUrl);
    if (!res.ok) throw new Error();
    const categories = await res.json();
    assetCategory.innerHTML = '<option value="" disabled selected>Seleccione una categoría</option>';
    categories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      assetCategory.appendChild(opt);
    });
  } catch {
    console.warn("Categorías no disponibles");
  }
}

/* ── LISTAR ── */
async function loadAssets() {
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error();
    const assets = await res.json();
    assetsTableBody.innerHTML = "";

    // Determinar rol del usuario actual
    let userRole = "alumno";
    try {
      const u = JSON.parse(localStorage.getItem("user"));
      if (u && u.role) userRole = u.role;
    } catch {}

    const canEdit = userRole === "administrador" || userRole === "docente";

    if (!assets.length) {
      assetsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#9ca3af;">Sin activos registrados</td></tr>`;
      return;
    }

    assets.forEach(a => {
      const estadoColor = { available:"#16a34a", borrowed:"#d97706", maintenance:"#dc2626" }[a.status] || "#6b7280";
      const estadoLabel = { available:"Disponible", borrowed:"Prestado", maintenance:"Mantenimiento" }[a.status] || a.status;
      const catName     = a.categories ? a.categories.name : (a.category_id || "—");

      // Acciones: solo para docentes y admins
      const acciones = canEdit
        ? `<i class="fas fa-edit"  title="Editar"   onclick="editAsset(${a.id})"></i>
           <i class="fas fa-trash" title="Eliminar" onclick="deleteAsset(${a.id})" style="color:#dc2626;"></i>`
        : `<span style="color:#9ca3af;font-size:12px;">Solo lectura</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.id}</td>
        <td>${a.name}</td>
        <td>${catName}</td>
        <td>${a.serial_number || "—"}</td>
        <td>${a.location || "—"}</td>
        <td><span style="color:${estadoColor};font-weight:500;">${estadoLabel}</span></td>
        <td>${a.quantity}</td>
        <td class="actions">${acciones}</td>`;
      assetsTableBody.appendChild(tr);
    });
  } catch {
    assetsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#dc2626;">Error al conectar con el servidor</td></tr>`;
  }
}

/* ── GUARDAR ── */
async function saveAsset() {
  const id            = document.getElementById("assetId").value;
  const name          = document.getElementById("assetName").value.trim();
  const description   = document.getElementById("assetDescription").value.trim();
  const category_id   = document.getElementById("assetCategory").value;
  const serial_number = document.getElementById("assetSerial").value.trim();
  const location      = document.getElementById("assetLocation").value.trim();
  const status        = document.getElementById("assetStatus").value;
  const quantity      = parseInt(document.getElementById("assetQuantity").value, 10);

  if (!name || !category_id || !serial_number || !location) {
    alert("Nombre, Categoría, Número de serie y Ubicación son obligatorios."); return;
  }

  const body   = { name, description, category_id, serial_number, location, status, quantity };
  const url    = id ? `${apiUrl}/${id}` : apiUrl;
  const method = id ? "PUT" : "POST";

  try {
    const res = await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
    if (!res.ok) { const e = await res.json(); alert("Error: " + (e.message || "No se pudo guardar")); return; }
    closeModal();
    loadAssets();
  } catch { alert("No se pudo conectar con el servidor."); }
}

/* ── EDITAR ── */
async function editAsset(id) {
  try {
    const res = await fetch(`${apiUrl}/${id}`);
    if (!res.ok) throw new Error();
    const a = await res.json();
    
    openModal();
    document.getElementById("modalTitle").innerText   = "Editar Activo";
    document.getElementById("assetId").value          = a.id;
    document.getElementById("assetName").value        = a.name;
    document.getElementById("assetDescription").value = a.description || "";
    document.getElementById("assetCategory").value    = a.category_id;
    document.getElementById("assetSerial").value      = a.serial_number;
    document.getElementById("assetLocation").value    = a.location;
    document.getElementById("assetStatus").value      = a.status;
    document.getElementById("assetQuantity").value    = a.quantity || 1;
  } catch { alert("No se pudo cargar el activo."); }
}

/* ── ELIMINAR ── */
async function deleteAsset(id) {
  if (!confirm("¿Seguro que deseas eliminar este activo?")) return;
  try {
    const res = await fetch(`${apiUrl}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    loadAssets();
  } catch { alert("No se pudo eliminar."); }
}

/* ── INIT ── */
loadCategories();
loadAssets();
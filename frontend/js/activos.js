const apiUrl = "http://localhost:3000/api/assets";
const catUrl = "http://localhost:3000/api/categories/assets";
 
const assetsTableBody = document.getElementById("assetsTableBody");
const assetCategory   = document.getElementById("assetCategory");
 
/* ── CATEGORÍAS ── */
async function loadCategories() {
  try {
    const res = await fetch(catUrl);
    if (!res.ok) throw new Error("No se pudieron cargar categorías");
    const categories = await res.json();
    assetCategory.innerHTML = '<option value="" disabled selected>Seleccione una categoría</option>';
    categories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      assetCategory.appendChild(opt);
    });
  } catch(err) {
    console.warn("Categorías no disponibles, usando las del HTML por defecto.");
  }
}
 
/* ── LISTAR ACTIVOS ── */
async function loadAssets() {
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error("Error al cargar activos");
    const assets = await res.json();
    assetsTableBody.innerHTML = "";
 
    if (assets.length === 0) {
      assetsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#9ca3af;">Sin activos registrados</td></tr>`;
      return;
    }
 
    assets.forEach(a => {
      const estadoColor = {
        available:   "#16a34a",
        borrowed:    "#d97706",
        maintenance: "#dc2626"
      }[a.status] || "#6b7280";
 
      const estadoLabel = {
        available:   "Disponible",
        borrowed:    "Prestado",
        maintenance: "Mantenimiento"
      }[a.status] || a.status;
 
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.id}</td>
        <td>${a.name}</td>
        <td>${a.category_name || a.category_id || "—"}</td>
        <td>${a.serial_number}</td>
        <td>${a.location}</td>
        <td><span style="color:${estadoColor};font-weight:500;">${estadoLabel}</span></td>
        <td>${a.quantity}</td>
        <td class="actions">
          <i class="fas fa-edit"  title="Editar"   onclick="editAsset(${a.id})"></i>
          <i class="fas fa-trash" title="Eliminar" onclick="deleteAsset(${a.id})" style="color:#dc2626;"></i>
        </td>
      `;
      assetsTableBody.appendChild(tr);
    });
  } catch(err) {
    console.error("loadAssets:", err);
    assetsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#dc2626;">Error al conectar con el servidor</td></tr>`;
  }
}
 
/* ── GUARDAR (crear o actualizar) ── */
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
    alert("Los campos Nombre, Categoría, Número de serie y Ubicación son obligatorios.");
    return;
  }
 
  const body = { name, description, category_id, serial_number, location, status, quantity };
 
  try {
    const url    = id ? `${apiUrl}/${id}` : apiUrl;
    const method = id ? "PUT" : "POST";
 
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
 
    if (!res.ok) {
      const err = await res.json();
      alert("Error: " + (err.message || "No se pudo guardar"));
      return;
    }
 
    closeModal();
    loadAssets();
  } catch(err) {
    console.error("saveAsset:", err);
    alert("No se pudo conectar con el servidor.");
  }
}
 
/* ── EDITAR ── */
async function editAsset(id) {
  try {
    const res = await fetch(`${apiUrl}/${id}`);
    if (!res.ok) throw new Error("No encontrado");
    const a = await res.json();
 
    openModal();
    document.getElementById("modalTitle").innerText        = "Editar Activo";
    document.getElementById("assetId").value               = a.id;
    document.getElementById("assetName").value             = a.name;
    document.getElementById("assetDescription").value      = a.description || "";
    document.getElementById("assetCategory").value         = a.category_id;
    document.getElementById("assetSerial").value           = a.serial_number;
    document.getElementById("assetLocation").value         = a.location;
    document.getElementById("assetStatus").value           = a.status;
    document.getElementById("assetQuantity").value         = a.quantity || 1;
  } catch(err) {
    alert("No se pudo cargar el activo para editar.");
  }
}
 
/* ── ELIMINAR ── */
async function deleteAsset(id) {
  if (!confirm("¿Seguro que deseas eliminar este activo?")) return;
  try {
    const res = await fetch(`${apiUrl}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
    loadAssets();
  } catch(err) {
    alert("No se pudo eliminar el activo.");
  }
}
 
/* ── INIT ── */
loadCategories();
loadAssets();
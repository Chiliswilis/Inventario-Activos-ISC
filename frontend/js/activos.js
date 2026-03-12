const apiUrl = "http://localhost:3000/assets";
const catUrl = "http://localhost:3000/categories";

const assetsTableBody = document.getElementById("assetsTableBody");
const assetCategory = document.getElementById("assetCategory");

async function loadCategories() {
  try {
    const res = await fetch(catUrl);
    const categories = await res.json();
    assetCategory.innerHTML = '<option value="">Seleccionar categoría</option>';
    categories.forEach(c=>{
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      assetCategory.appendChild(opt);
    });
  } catch(err){console.error(err);}
}

async function loadAssets() {
  try {
    const res = await fetch(apiUrl);
    const assets = await res.json();
    assetsTableBody.innerHTML = "";
    assets.forEach(a=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.id}</td>
        <td>${a.name}</td>
        <td>${a.category_name || a.category_id}</td>
        <td>${a.serial_number}</td>
        <td>${a.location}</td>
        <td>${a.status}</td>
        <td>${a.quantity}</td>
        <td class="actions">
          <i class="fas fa-edit" onclick="editAsset(${a.id})"></i>
          <i class="fas fa-trash" onclick="deleteAsset(${a.id})"></i>
        </td>
      `;
      assetsTableBody.appendChild(tr);
    });
  } catch(err){console.error(err);}
}

async function saveAsset() {
  const id = document.getElementById("assetId").value;
  const name = document.getElementById("assetName").value;
  const description = document.getElementById("assetDescription").value;
  const category_id = document.getElementById("assetCategory").value;
  const serial_number = document.getElementById("assetSerial").value;
  const location = document.getElementById("assetLocation").value;
  const status = document.getElementById("assetStatus").value;
  const quantity = document.getElementById("assetQuantity").value;

  if(!name || !category_id || !serial_number || !location || !quantity){
    alert("Todos los campos son obligatorios");
    return;
  }

  const body = { name, description, category_id, serial_number, location, status, quantity };

  try {
    if(id){
      await fetch(`${apiUrl}/${id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    } else {
      await fetch(apiUrl, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    }
    closeModal();
    loadAssets();
  } catch(err){console.error(err);}
}

async function editAsset(id){
  const res = await fetch(`${apiUrl}/${id}`);
  const a = await res.json();
  openModal();
  document.getElementById("modalTitle").innerText="Editar Activo";
  document.getElementById("assetId").value = a.id;
  document.getElementById("assetName").value = a.name;
  document.getElementById("assetDescription").value = a.description || "";
  document.getElementById("assetCategory").value = a.category_id;
  document.getElementById("assetSerial").value = a.serial_number;
  document.getElementById("assetLocation").value = a.location;
  document.getElementById("assetStatus").value = a.status;
  document.getElementById("assetQuantity").value = a.quantity || 1;
}

async function deleteAsset(id){
  if(!confirm("¿Deseas eliminar este activo?")) return;
  await fetch(`${apiUrl}/${id}`, { method:"DELETE" });
  loadAssets();
}

loadCategories();
loadAssets();
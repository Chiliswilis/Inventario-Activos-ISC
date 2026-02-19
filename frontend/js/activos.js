// Activos management functions

// Sample data (in a real app, this would come from the backend)
let assets = [
    { id: 1, name: 'Laptop Dell XPS', category: 'electrónicos', serial: 'DELL-001', location: 'Lab 1', status: 'available' },
    { id: 2, name: 'Proyector Epson', category: 'electrónicos', serial: 'EPS-002', location: 'Aula 101', status: 'borrowed' },
    { id: 3, name: 'Silla de oficina', category: 'mobiliario', serial: 'CHAIR-003', location: 'Oficina', status: 'available' }
];

// DOM elements
const assetsTable = document.getElementById('assetsTable').getElementsByTagName('tbody')[0];
const assetModal = document.getElementById('assetModal');
const assetForm = document.getElementById('assetForm');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    renderAssets();
    assetForm.addEventListener('submit', handleFormSubmit);
});

// Render assets table
function renderAssets(filteredAssets = assets) {
    assetsTable.innerHTML = '';
    filteredAssets.forEach(asset => {
        const row = assetsTable.insertRow();
        row.innerHTML = `
            <td>${asset.id}</td>
            <td>${asset.name}</td>
            <td>${capitalizeFirst(asset.category)}</td>
            <td>${asset.serial}</td>
            <td>${asset.location}</td>
            <td><span class="status-badge status-${asset.status}">${getStatusText(asset.status)}</span></td>
            <td>
                <button class="btn-action edit" onclick="editAsset(${asset.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-action delete" onclick="deleteAsset(${asset.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}

// Filter assets
function filterAssets() {
    const searchTerm = document.getElementById('searchAsset').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    const filtered = assets.filter(asset => {
        const matchesSearch = asset.name.toLowerCase().includes(searchTerm) ||
                             asset.serial.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter || asset.category === categoryFilter;
        const matchesStatus = !statusFilter || asset.status === statusFilter;
        return matchesSearch && matchesCategory && matchesStatus;
    });

    renderAssets(filtered);
}

// Open modal for add/edit
function openModal(mode, assetId = null) {
    const modalTitle = document.getElementById('modalTitle');
    const assetIdField = document.getElementById('assetId');

    if (mode === 'addAsset') {
        modalTitle.textContent = 'Agregar Activo';
        assetForm.reset();
        assetIdField.value = '';
    } else if (mode === 'editAsset' && assetId) {
        const asset = assets.find(a => a.id === assetId);
        if (asset) {
            modalTitle.textContent = 'Editar Activo';
            document.getElementById('assetId').value = asset.id;
            document.getElementById('assetName').value = asset.name;
            document.getElementById('assetCategory').value = asset.category;
            document.getElementById('assetSerial').value = asset.serial;
            document.getElementById('assetLocation').value = asset.location;
            document.getElementById('assetStatus').value = asset.status;
        }
    }

    assetModal.style.display = 'block';
}

// Close modal
function closeModal() {
    assetModal.style.display = 'none';
}

// Handle form submit
function handleFormSubmit(e) {
    e.preventDefault();

    const assetId = document.getElementById('assetId').value;
    const assetData = {
        name: document.getElementById('assetName').value,
        category: document.getElementById('assetCategory').value,
        serial: document.getElementById('assetSerial').value,
        location: document.getElementById('assetLocation').value,
        status: document.getElementById('assetStatus').value
    };

    if (assetId) {
        // Edit existing asset
        const index = assets.findIndex(a => a.id == assetId);
        if (index !== -1) {
            assets[index] = { ...assets[index], ...assetData };
            showNotification('Activo actualizado exitosamente', 'success');
        }
    } else {
        // Add new asset
        const newId = Math.max(...assets.map(a => a.id)) + 1;
        assets.push({ id: newId, ...assetData });
        showNotification('Activo agregado exitosamente', 'success');
    }

    renderAssets();
    closeModal();
}

// Edit asset
function editAsset(id) {
    openModal('editAsset', id);
}

// Delete asset
function deleteAsset(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este activo?')) {
        assets = assets.filter(a => a.id !== id);
        renderAssets();
        showNotification('Activo eliminado exitosamente', 'success');
    }
}

// Export data
function exportData(type) {
    // Simple CSV export simulation
    let csv = 'ID,Nombre,Categoría,Serial,Ubicación,Estado\n';
    assets.forEach(asset => {
        csv += `${asset.id},${asset.name},${asset.category},${asset.serial},${asset.location},${asset.status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification('Datos exportados exitosamente', 'success');
}

// Utility functions
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getStatusText(status) {
    const statusMap = {
        'available': 'Disponible',
        'borrowed': 'Prestado',
        'maintenance': 'Mantenimiento'
    };
    return statusMap[status] || status;
}

function showNotification(message, type) {
    // Simple notification (in a real app, use a proper notification library)
    alert(`${type.toUpperCase()}: ${message}`);
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target === assetModal) {
        closeModal();
    }
}
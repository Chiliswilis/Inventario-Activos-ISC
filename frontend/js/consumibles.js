// Consumibles management functions

let consumables = [
    { id: 1, name: 'Papel A4', category: 'papel', quantity: 500, minQuantity: 100, unit: 'Hojas' },
    { id: 2, name: 'Tinta Negra', category: 'tintas', quantity: 20, minQuantity: 5, unit: 'Cartuchos' },
    { id: 3, name: 'Detergente', category: 'limpieza', quantity: 10, minQuantity: 2, unit: 'Botellas' }
];

const consumablesTable = document.getElementById('consumablesTable').getElementsByTagName('tbody')[0];
const consumableModal = document.getElementById('consumableModal');
const consumableForm = document.getElementById('consumableForm');

document.addEventListener('DOMContentLoaded', function() {
    renderConsumables();
    consumableForm.addEventListener('submit', handleFormSubmit);
});

function renderConsumables(filteredConsumables = consumables) {
    consumablesTable.innerHTML = '';
    filteredConsumables.forEach(consumable => {
        const lowStock = consumable.quantity <= consumable.minQuantity;
        const row = consumablesTable.insertRow();
        row.innerHTML = `
            <td>${consumable.id}</td>
            <td>${consumable.name}</td>
            <td>${capitalizeFirst(consumable.category)}</td>
            <td class="${lowStock ? 'low-stock' : ''}">${consumable.quantity}</td>
            <td>${consumable.minQuantity}</td>
            <td>${consumable.unit}</td>
            <td>
                <button class="btn-action edit" onclick="editConsumable(${consumable.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-action delete" onclick="deleteConsumable(${consumable.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
    });
}

function filterConsumables() {
    const searchTerm = document.getElementById('searchConsumable').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;

    const filtered = consumables.filter(consumable => {
        const matchesSearch = consumable.name.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter || consumable.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    renderConsumables(filtered);
}

function openModal(mode, consumableId = null) {
    const modalTitle = document.getElementById('modalTitle');
    const consumableIdField = document.getElementById('consumableId');

    if (mode === 'addConsumable') {
        modalTitle.textContent = 'Agregar Consumible';
        consumableForm.reset();
        consumableIdField.value = '';
    } else if (mode === 'editConsumable' && consumableId) {
        const consumable = consumables.find(c => c.id === consumableId);
        if (consumable) {
            modalTitle.textContent = 'Editar Consumible';
            document.getElementById('consumableId').value = consumable.id;
            document.getElementById('consumableName').value = consumable.name;
            document.getElementById('consumableCategory').value = consumable.category;
            document.getElementById('consumableQuantity').value = consumable.quantity;
            document.getElementById('consumableMinQuantity').value = consumable.minQuantity;
            document.getElementById('consumableUnit').value = consumable.unit;
        }
    }

    consumableModal.style.display = 'block';
}

function closeModal() {
    consumableModal.style.display = 'none';
}

function handleFormSubmit(e) {
    e.preventDefault();

    const consumableId = document.getElementById('consumableId').value;
    const consumableData = {
        name: document.getElementById('consumableName').value,
        category: document.getElementById('consumableCategory').value,
        quantity: parseInt(document.getElementById('consumableQuantity').value),
        minQuantity: parseInt(document.getElementById('consumableMinQuantity').value),
        unit: document.getElementById('consumableUnit').value
    };

    if (consumableId) {
        const index = consumables.findIndex(c => c.id == consumableId);
        if (index !== -1) {
            consumables[index] = { ...consumables[index], ...consumableData };
            showNotification('Consumible actualizado exitosamente', 'success');
        }
    } else {
        const newId = Math.max(...consumables.map(c => c.id)) + 1;
        consumables.push({ id: newId, ...consumableData });
        showNotification('Consumible agregado exitosamente', 'success');
    }

    renderConsumables();
    closeModal();
}

function editConsumable(id) {
    openModal('editConsumable', id);
}

function deleteConsumable(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este consumible?')) {
        consumables = consumables.filter(c => c.id !== id);
        renderConsumables();
        showNotification('Consumible eliminado exitosamente', 'success');
    }
}

function exportData(type) {
    let csv = 'ID,Nombre,Categoría,Cantidad,Mínimo,Unidad\n';
    consumables.forEach(consumable => {
        csv += `${consumable.id},${consumable.name},${consumable.category},${consumable.quantity},${consumable.minQuantity},${consumable.unit}\n`;
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

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showNotification(message, type) {
    alert(`${type.toUpperCase()}: ${message}`);
}

window.onclick = function(event) {
    if (event.target === consumableModal) {
        closeModal();
    }
}
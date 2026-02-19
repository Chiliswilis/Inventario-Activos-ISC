// Usuarios management functions

let users = [
    { id: 1, name: 'Williams Díaz', email: 'williams@example.com', role: 'admin' }
];

const usersTable = document.getElementById('usersTable').getElementsByTagName('tbody')[0];

document.addEventListener('DOMContentLoaded', function() {
    renderUsers();
});

function renderUsers() {
    usersTable.innerHTML = '';
    users.forEach(user => {
        const row = usersTable.insertRow();
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="badge badge-${user.role}">${getRoleText(user.role)}</span></td>
            <td>
                <button class="btn-action edit" onclick="editUser(${user.id})"><i class="fas fa-edit"></i></button>
            </td>
        `;
    });
}

function getRoleText(role) {
    return role === 'admin' ? 'Administrador' : 'Usuario';
}

function editUser(id) {
    // Placeholder for edit functionality
    showNotification('Funcionalidad de edición próximamente', 'info');
}

function showNotification(message, type) {
    alert(`${type.toUpperCase()}: ${message}`);
}
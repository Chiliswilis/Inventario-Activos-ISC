// Solicitudes management functions

let requests = [
    { id: 1, user: 'Maria García', item: 'Laptop Dell XPS', date: '2024-04-20', status: 'pending' },
    { id: 2, user: 'Juan Pérez', item: 'Proyector Epson', date: '2024-04-19', status: 'approved' }
];

const requestsTable = document.getElementById('requestsTable').getElementsByTagName('tbody')[0];

document.addEventListener('DOMContentLoaded', function() {
    renderRequests();
});

function renderRequests(filteredRequests = requests) {
    requestsTable.innerHTML = '';
    filteredRequests.forEach(request => {
        const row = requestsTable.insertRow();
        row.innerHTML = `
            <td>${request.id}</td>
            <td>${request.user}</td>
            <td>${request.item}</td>
            <td>${request.date}</td>
            <td><span class="status-badge status-${request.status}">${getStatusText(request.status)}</span></td>
            <td>
                ${request.status === 'pending' ? 
                    `<button class="btn-action approve" onclick="approveRequest(${request.id})"><i class="fas fa-check"></i></button>
                     <button class="btn-action reject" onclick="rejectRequest(${request.id})"><i class="fas fa-times"></i></button>` :
                    '<span class="completed">Completada</span>'
                }
            </td>
        `;
    });
}

function filterRequests() {
    const statusFilter = document.getElementById('statusFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;

    const filtered = requests.filter(request => {
        const matchesStatus = !statusFilter || request.status === statusFilter;
        const matchesDate = !dateFilter || request.date === dateFilter;
        return matchesStatus && matchesDate;
    });

    renderRequests(filtered);
}

function approveRequest(id) {
    const request = requests.find(r => r.id === id);
    if (request) {
        request.status = 'approved';
        renderRequests();
        showNotification('Solicitud aprobada exitosamente', 'success');
    }
}

function rejectRequest(id) {
    const request = requests.find(r => r.id === id);
    if (request) {
        request.status = 'rejected';
        renderRequests();
        showNotification('Solicitud rechazada', 'info');
    }
}

function exportData(type) {
    let csv = 'ID,Usuario,Item,Fecha,Estado\n';
    requests.forEach(request => {
        csv += `${request.id},${request.user},${request.item},${request.date},${request.status}\n`;
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

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'approved': 'Aprobada',
        'rejected': 'Rechazada',
        'returned': 'Devuelta'
    };
    return statusMap[status] || status;
}

function showNotification(message, type) {
    alert(`${type.toUpperCase()}: ${message}`);
}
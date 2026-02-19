// Reservas management functions

let reservations = [
    { id: 1, user: 'Juan Pérez', lab: 'Lab 1', start: '2024-04-25 10:00', end: '2024-04-25 12:00', status: 'pending', purpose: 'Clase de programación' }
];

const reservationsTable = document.getElementById('reservationsTable').getElementsByTagName('tbody')[0];

document.addEventListener('DOMContentLoaded', function() {
    renderReservations();
});

function renderReservations(filteredReservations = reservations) {
    reservationsTable.innerHTML = '';
    filteredReservations.forEach(reservation => {
        const row = reservationsTable.insertRow();
        row.innerHTML = `
            <td>${reservation.id}</td>
            <td>${reservation.user}</td>
            <td>${reservation.lab}</td>
            <td>${reservation.start}</td>
            <td>${reservation.end}</td>
            <td><span class="status-badge status-${reservation.status}">${getStatusText(reservation.status)}</span></td>
            <td>
                ${reservation.status === 'pending' ? 
                    `<button class="btn-action confirm" onclick="confirmReservation(${reservation.id})"><i class="fas fa-check"></i></button>
                     <button class="btn-action cancel" onclick="cancelReservation(${reservation.id})"><i class="fas fa-times"></i></button>` :
                    '<span class="completed">Completada</span>'
                }
            </td>
        `;
    });
}

function filterReservations() {
    const statusFilter = document.getElementById('statusFilter').value;
    const labFilter = document.getElementById('labFilter').value.toLowerCase();

    const filtered = reservations.filter(reservation => {
        const matchesStatus = !statusFilter || reservation.status === statusFilter;
        const matchesLab = !labFilter || reservation.lab.toLowerCase().includes(labFilter);
        return matchesStatus && matchesLab;
    });

    renderReservations(filtered);
}

function confirmReservation(id) {
    const reservation = reservations.find(r => r.id === id);
    if (reservation) {
        reservation.status = 'confirmed';
        renderReservations();
        showNotification('Reserva confirmada exitosamente', 'success');
    }
}

function cancelReservation(id) {
    const reservation = reservations.find(r => r.id === id);
    if (reservation) {
        reservation.status = 'cancelled';
        renderReservations();
        showNotification('Reserva cancelada', 'info');
    }
}

function exportData(type) {
    let csv = 'ID,Usuario,Laboratorio,Inicio,Fin,Estado,Propósito\n';
    reservations.forEach(reservation => {
        csv += `${reservation.id},${reservation.user},${reservation.lab},${reservation.start},${reservation.end},${reservation.status},"${reservation.purpose}"\n`;
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
        'confirmed': 'Confirmada',
        'cancelled': 'Cancelada'
    };
    return statusMap[status] || status;
}

function showNotification(message, type) {
    alert(`${type.toUpperCase()}: ${message}`);
}
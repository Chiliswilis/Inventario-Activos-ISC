// Reportes functions

function generateReport(type) {
    // Simulate PDF generation
    showNotification(`Generando reporte de ${type}...`, 'info');
    setTimeout(() => {
        showNotification(`Reporte de ${type} generado exitosamente`, 'success');
        // In a real app, this would trigger a download
    }, 2000);
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize chart
    const ctx = document.getElementById('usageChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'],
            datasets: [{
                label: 'Solicitudes de Activos',
                data: [12, 19, 3, 5, 2, 3],
                backgroundColor: 'rgba(75, 31, 162, 0.6)',
                borderColor: 'rgba(75, 31, 162, 1)',
                borderWidth: 1
            }, {
                label: 'Reservas de Laboratorios',
                data: [2, 3, 20, 5, 1, 4],
                backgroundColor: 'rgba(46, 107, 255, 0.6)',
                borderColor: 'rgba(46, 107, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
});

function showNotification(message, type) {
    alert(`${type.toUpperCase()}: ${message}`);
}
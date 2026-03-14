// Configuración functions

document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.querySelector('.settings-form');
    settingsForm.addEventListener('submit', saveSettings);
});

function saveSettings(e) {
    e.preventDefault();
    // Simulate saving settings
    showNotification('Configuración guardada exitosamente', 'success');
}

function testConnection() {
    // Simulate testing database connection
    showNotification('Probando conexión a la base de datos...', 'info');
    setTimeout(() => {
        showNotification('Conexión exitosa a Supabase', 'success');
    }, 2000);
}

function showNotification(message, type) {
    alert(`${type.toUpperCase()}: ${message}`);
}
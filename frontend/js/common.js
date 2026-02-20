// Common utilities for role-based access

function getUserRole() {
    return localStorage.getItem('userRole') || 'alumno';
}

function getUsername() {
    return localStorage.getItem('username') || 'Usuario';
}

function hasPermission(permission) {
    const role = getUserRole();
    const permissions = {
        'administrador': ['read', 'write', 'delete', 'manage_users', 'manage_assets', 'approve_requests'],
        'docente': ['read', 'write', 'view_reports', 'create_requests'],
        'alumno': ['read', 'create_requests', 'view_own_requests']
    };
    
    return permissions[role]?.includes(permission) || false;
}

function applyRoleRestrictions() {
    const role = getUserRole();
    
    // Hide admin-only elements
    if (role !== 'administrador') {
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => el.style.display = 'none');
    }
    
    // Hide docente restrictions
    if (role === 'alumno') {
        const docenteElements = document.querySelectorAll('.docente-plus');
        docenteElements.forEach(el => el.style.display = 'none');
    }
    
    // Update username display
    const usernameElements = document.querySelectorAll('.username-display');
    usernameElements.forEach(el => el.textContent = getUsername());
}

// Call on page load
document.addEventListener('DOMContentLoaded', applyRoleRestrictions);
document.getElementById('logoutBtn').addEventListener('click', function() {
    localStorage.clear();
    window.location.href = 'login.html';
});
document.getElementById('homeBtn').addEventListener('click', function() {
    window.location.href = 'index.html';
});
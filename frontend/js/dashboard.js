// Dashboard specific functions

document.addEventListener('DOMContentLoaded', function() {
    // Update username in dashboard
    const usernameElement = document.querySelector('h1');
    if (usernameElement) {
        usernameElement.innerHTML = `<i class="fas fa-home"></i> Bienvenido, ${getUsername()}`;
    }
});
// Main game controller
const app = document.getElementById('app');

// Template loading function
async function loadTemplate(templatePath) {
    try {
        const response = await fetch(templatePath);
        const html = await response.text();
        app.innerHTML = html;
    } catch (error) {
        console.error('Error loading template:', error);
    }
}

// Navigation functions
function goBackToLauncher() {
    window.location.href = 'launcher.html';
}

function startGame() {
    loadTemplate('templates/screens/game.html');
}

// Keyboard event handling
document.addEventListener('keydown', (event) => {
    const currentScreen = getCurrentScreen();
    
    if (currentScreen === 'game-load') {
        if (event.key === 'Enter') {
            startGame();
        } else if (event.key === 'Escape') {
            goBackToLauncher();
        }
    }
});

// Helper function to determine current screen
function getCurrentScreen() {
    if (app.innerHTML.includes('game-load-screen')) {
        return 'game-load';
    }
    if (app.innerHTML.includes('game-screen')) {
        return 'game';
    }
    return 'unknown';
}

// Initialize game-load screen on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTemplate('templates/screens/load-game.html');
});
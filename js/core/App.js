// Main application controller - initialization only
class App {
    constructor() {
        console.log('🚀 App: Initializing...');
        this.eventBus = new EventBus();
        this.uiRenderer = new UIRenderer(this.eventBus);
        this.gameSession = new GameSession(this.eventBus, this.uiRenderer);
        this.navigation = new Navigation(this.eventBus);
    }
}

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Global wrapper functions for template onclick handlers
function startGame() {
    window.app.gameSession.startGame();
}

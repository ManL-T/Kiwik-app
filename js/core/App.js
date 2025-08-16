// Main application controller - initialization only
class App {
    constructor() {
        console.log('🚀 App: Initializing...');
        this.eventBus = new EventBus();
        this.uiRenderer = new UIRenderer(this.eventBus);
        this.gameData = new GameData(this.eventBus);
        this.timer = new Timer(this.eventBus);
        this.challengeManager = new ChallengeManager(this.eventBus, this.uiRenderer, this.gameData);
        this.gameSession = new GameSession(this.eventBus, this.uiRenderer, this.challengeManager);        
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

function startNewGame() {
    // Reload the page to start fresh
    window.location.reload();
}

function backToSite() {
    // Go back to launcher
    window.location.href = 'launcher.html';
}
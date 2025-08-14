// Game Session controller - handles all game logic and flow
class GameSession {
    constructor(eventBus, uiRenderer) {
        console.log('🎮 GameSession: Initializing...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        
        // Challenge instance
        this.p1Challenge = null;
        
        // Initialize
        this.setupEventHandlers();
        this.loadGameLoadScreen();
        
        console.log('✅ GameSession: Initialization complete');
    }
    
    // Event handling
    setupEventHandlers() {
        document.addEventListener('keydown', (event) => {
            const currentScreen = this.getCurrentScreen();
            
            if (currentScreen === 'game-load') {
                if (event.key === 'Enter') {
                    this.startGame();
                } else if (event.key === 'Escape') {
                    this.goBackToLauncher();
                }
            } else if (currentScreen === 'game') {
                if (event.key === 'Escape') {
                    this.goBackToLauncher();
                }
                // P1Challenge handles spacebar navigation
            }
        });
    }
    
    // Navigation functions
    goBackToLauncher() {
        window.location.href = 'launcher.html';
    }
    
    async loadGameLoadScreen() {
        this.eventBus.emit('ui:loadTemplate', 'templates/screens/load-game.html');
    }
    
    async startGame() {
        this.eventBus.emit('ui:loadTemplate', 'templates/screens/game.html');
        this.p1Challenge = new P1Challenge(this.eventBus, this.uiRenderer);
        this.eventBus.emit('challenge:start');
    }
    
    // Helper function to determine current screen
    getCurrentScreen() {
        const app = document.getElementById('app');
        if (app.innerHTML.includes('game-load-screen')) {
            return 'game-load';
        }
        if (app.innerHTML.includes('game-screen')) {
            return 'game';
        }
        return 'unknown';
    }
}
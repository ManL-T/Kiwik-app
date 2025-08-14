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
        this.eventBus.on('navigation:enterPressed:gameLoad', () => {
            this.startGame();
        });
    }
    
    
    async loadGameLoadScreen() {
        this.eventBus.emit('ui:loadTemplate', 'templates/screens/load-game.html');
    }
    
    async startGame() {
        this.eventBus.emit('ui:loadTemplate', 'templates/screens/game.html');
        this.p1Challenge = new P1Challenge(this.eventBus, this.uiRenderer);
        this.eventBus.emit('challenge:start');
    }
    
}
// Game Session controller - handles all game logic and flow
class GameSession {
    constructor(eventBus, uiRenderer) {
        console.log('🎮 GameSession: Initializing...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        
        // Challenge instance
        this.p1Challenge = null;
        
        // Load screen key handler reference
        this.loadScreenKeyHandler = null;
        
        // Initialize
        this.loadGameLoadScreen();
        
        console.log('✅ GameSession: Initialization complete');
    }
    
    async loadGameLoadScreen() {
        this.eventBus.emit('ui:loadTemplate', 'templates/screens/load-game.html');
        this.setupLoadScreenKeyHandler();
    }
    
    setupLoadScreenKeyHandler() {
        this.loadScreenKeyHandler = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.startGame();
            }
        };
        
        document.addEventListener('keydown', this.loadScreenKeyHandler);
    }
    
    removeLoadScreenKeyHandler() {
        if (this.loadScreenKeyHandler) {
            document.removeEventListener('keydown', this.loadScreenKeyHandler);
            this.loadScreenKeyHandler = null;
        }
    }
    
    async startGame() {
        // Remove load screen key handler
        this.removeLoadScreenKeyHandler();
        
        // Load game screen and start challenge
        this.eventBus.emit('ui:loadTemplate', 'templates/screens/game.html');
        this.p1Challenge = new P1Challenge(this.eventBus, this.uiRenderer);
        this.eventBus.emit('challenge:start');
    }
}
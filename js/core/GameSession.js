// Game Session controller - handles all game logic and flow
class GameSession {
    constructor(eventBus, uiRenderer, challengeManager) {
        console.log('🎮 GameSession: Initializing...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        this.challengeManager = challengeManager;
        
        // Challenge instance
        this.p1Challenge = null;
        
        // Game state
        this.gameStarted = false;
        
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
        // Prevent multiple starts
        if (this.gameStarted) {
            console.log('🎮 GameSession: Game already started, ignoring');
            return;
        }
        this.gameStarted = true;
        
        // Remove load screen key handler
        this.removeLoadScreenKeyHandler();
        
        // Start the game logic - no template loading
        console.log('🎮 GameSession: Starting game logic...');
        
        // TODO: Create ChallengeSequencer to decide which challenge to load
        // For now, directly create P1Challenge
        this.challengeManager.startSession();
    }
}
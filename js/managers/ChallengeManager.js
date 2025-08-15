// js/managers/ChallengeManager.js
class ChallengeManager {
    constructor(eventBus, uiRenderer, gameData) {
        console.log('🎯 ChallengeManager: Initializing...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        this.gameData = gameData;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ ChallengeManager: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Event listeners will go here
    }
    
    // Start the challenge session
    startSession() {
        console.log('🎯 ChallengeManager: Starting challenge session...');
        
        // Create first challenge (for now, still hardcoded to P1Challenge)
        this.currentChallenge = new P1Challenge(this.eventBus, this.uiRenderer);
        this.eventBus.emit('challenge:start');
        
        console.log('🎯 ChallengeManager: First challenge created and started');
    }
}
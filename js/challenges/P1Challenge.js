// P1Challenge - handles all logic for phrase navigation challenge
class P1Challenge {
    constructor(eventBus, uiRenderer) {
        console.log('🎯 P1Challenge: Initializing...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        
        // Challenge data
        this.targetPhraseId = 'text_1_p1'; // First phrase, first text
        this.fullSentence = null;
        this.states = [];
        
        // Navigation state
        this.currentState = 0;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ P1Challenge: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        this.eventBus.on('challenge:start', () => {
            this.start();
        });
        
        this.eventBus.on('gameData:phraseDataReady', (phraseData) => {
            this.loadChallengeData(phraseData);
        });
        
        this.eventBus.on('ui:templateLoaded', (templatePath) => {
            if (templatePath.includes('game.html')) {
                // Now it's safe to update the UI
                this.updateGameContent();
            }
        });
        
        // Listen to simplified navigation events
        this.eventBus.on('navigation:enterPressed', () => {
            // Handle Enter based on current phase
            this.handleEnterKey();
        });
        
        this.eventBus.on('navigation:spacePressed', () => {
            // Handle Spacebar based on current phase
            this.handleSpaceKey();
        });
    }

    requestChallengeData() {
        this.eventBus.emit('gameData:requestPhraseData', this.targetPhraseId);
    }

    loadChallengeData(phraseData) {
        console.log('🎯 P1Challenge: Loading challenge data:', phraseData.phraseTarget);
        
        this.fullSentence = phraseData.phraseTarget;
        this.states = phraseData.semanticUnits.map(unit => ({
            unitTarget: unit.unitTarget,
            translations: unit.translations
        }));
        
        // Now ready to update content when template is loaded
        this.updateGameContent();
    }
        
    // Start the challenge
    start() {
        console.log('🎯 P1Challenge: Starting challenge...');
        this.requestChallengeData(); // Request data first, then everything else follows
    }
    
    // Key handling methods
    handleEnterKey() {
        // TODO: Implement based on current phase
        console.log('🎯 P1Challenge: Enter pressed');
    }
    
    handleSpaceKey() {
        // For now, keep existing spacebar behavior (cycling through states)
        this.nextState();
    }
    
    // Challenge logic
    nextState() {
        this.currentState = (this.currentState + 1) % this.states.length;
        this.updateGameContent();
    }
    
    updateGameContent() {
        console.log('🎯 P1Challenge: updateGameContent called');
        if (!this.fullSentence || !this.states.length) return;
        
        this.updateHighlightedText();
        this.updateTranslations();
    }
    
    updateHighlightedText() {
        console.log('🎯 P1Challenge: updateHighlightedText called');
        const currentUnitTarget = this.states[this.currentState].unitTarget;
        this.eventBus.emit('ui:updateHighlightedText', {
            fullSentence: this.fullSentence, 
            unitTarget: currentUnitTarget
        });
    }
    
    updateTranslations() {
        console.log('🎯 P1Challenge: updateTranslations called');
        const translations = this.states[this.currentState].translations;
        this.eventBus.emit('ui:updateTranslations', translations);
    }
}
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
        
        // Phase management
        this.currentPhase = 'pre-revision';
        
        // Navigation state
        this.currentState = 0;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ P1Challenge: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        this.eventBus.on('challenge:start', () => {
            console.log('🎯 P1Challenge: Received challenge:start event');
            this.start();
        });
        
        this.eventBus.on('gameData:phraseDataReady', (phraseData) => {
            this.loadChallengeData(phraseData);
        });
        
        this.eventBus.on('ui:templateLoaded', (templatePath) => {
            console.log('🎯 P1Challenge: Template loaded:', templatePath);
            if (templatePath.includes('pre-revision.html')) {
                console.log('🎯 P1Challenge: Pre-revision template ready');
                this.isActive = true; // Activate challenge when pre-revision loads
                this.injectPhraseIntoTemplate();
            } else if (templatePath.includes('post-revision.html')) {
                console.log('🎯 P1Challenge: Post-revision template ready');
                this.injectPhraseIntoTemplate();
            } else if (templatePath.includes('game.html')) {
                console.log('🎯 P1Challenge: Game template ready');
                if (this.currentPhase === 'revision') {
                    this.setupRevisionPhase();
                } else if (this.currentPhase === 'solution') {
                    this.setupSolutionPhase();
                }
            }
        });
        
        // Listen to simplified navigation events
        this.eventBus.on('navigation:enterPressed', () => {
            this.handleEnterKey();
        });
        
        this.eventBus.on('navigation:spacePressed', () => {
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
        
        // Inject phrase into template if it's already loaded
        this.injectPhraseIntoTemplate();
    }
        
    // Start the challenge
    start() {
        console.log('🎯 P1Challenge: Starting challenge...');
        this.currentPhase = 'pre-revision';
        console.log('🎯 P1Challenge: Current phase:', this.currentPhase);
        console.log('🎯 P1Challenge: Loading pre-revision template...');
        
        // P1Challenge controls its own templates
        console.log('🎯 P1Challenge: About to emit ui:loadTemplate...');
        this.eventBus.emit('ui:loadTemplate', 'templates/screens/pre-revision.html');
        console.log('🎯 P1Challenge: Template load request sent');
        
        // Request challenge data
        this.requestChallengeData();
    }

    // Inject phrase into decision templates
    injectPhraseIntoTemplate() {
        console.log('🎯 P1Challenge: Injecting phrase into template');
        if (!this.fullSentence) {
            console.log('🎯 P1Challenge: No phrase data yet, waiting...');
            return;
        }
        
        const phraseElement = document.querySelector('.phrase-text');
        if (phraseElement) {
            phraseElement.textContent = this.fullSentence;
            console.log('🎯 P1Challenge: Phrase injected:', this.fullSentence);
        } else {
            console.error('🎯 P1Challenge: .phrase-text element not found');
        }
    }
    
    // Key handling methods
    handleEnterKey() {
        if (!this.isActive) {
            console.log('🎯 P1Challenge: Ignoring Enter - challenge not active yet');
            return;
        }
        
        console.log('🎯 P1Challenge: Enter pressed, current phase:', this.currentPhase);
        
        if (this.currentPhase === 'pre-revision' || this.currentPhase === 'post-revision') {
            console.log('🎯 P1Challenge: Moving to solution phase...');
            this.currentPhase = 'solution';
            this.eventBus.emit('ui:loadTemplate', 'templates/screens/game.html');
        }
    }
    
    handleSpaceKey() {
        if (!this.isActive) {
            console.log('🎯 P1Challenge: Ignoring Spacebar - challenge not active yet');
            return;
        }
        
        console.log('🎯 P1Challenge: Space pressed, current phase:', this.currentPhase);
        
        if (this.currentPhase === 'pre-revision' || this.currentPhase === 'post-revision') {
            console.log('🎯 P1Challenge: Transitioning to revision phase...');
            this.currentPhase = 'revision';
            this.eventBus.emit('ui:loadTemplate', 'templates/screens/game.html');
        } else if (this.currentPhase === 'revision') {
            // NEW REVISION LOGIC: Navigate through semantic units
            this.handleRevisionSpacebar();
        }
    }
    
    // NEW REVISION SPACEBAR LOGIC
    handleRevisionSpacebar() {
        console.log('🎯 P1Challenge: Handling revision spacebar navigation');
        
        // Move to next semantic unit
        this.currentState++;
        console.log('🎯 P1Challenge: Current state:', this.currentState);
        
        // Check if we've seen all semantic units
        if (this.currentState >= this.states.length) {
            console.log('🎯 P1Challenge: Completed all semantic units, moving to post-revision');
            this.currentPhase = 'post-revision';
            this.eventBus.emit('ui:loadTemplate', 'templates/screens/post-revision.html');
        } else {
            // Show current semantic unit
            console.log('🎯 P1Challenge: Showing semantic unit:', this.currentState);
            this.showCurrentSemanticUnit();
        }
    }

    // Set up revision phase
    setupRevisionPhase() {
        console.log('🎯 P1Challenge: Setting up revision phase content');
        if (!this.fullSentence || !this.states.length) {
            console.log('🎯 P1Challenge: No data available for revision phase');
            return;
        }
        
        // REVISION CONTENT: Show phrase only, no highlighting, no translations
        this.showPlainPhrase();
        this.clearDisplayArea();
        this.resetRevisionState();
        
        console.log('🎯 P1Challenge: Revision phase ready - waiting for first spacebar press');
    }

    // NEW REVISION METHODS - NO translations displayed
    showPlainPhrase() {
        console.log('🎯 P1Challenge: Showing plain phrase');
        // Show phrase without any highlighting
        this.eventBus.emit('ui:updateHighlightedText', {
            fullSentence: this.fullSentence, 
            unitTarget: '' // No highlighting
        });
    }
    
    clearDisplayArea() {
        console.log('🎯 P1Challenge: Clearing display area');
        // Show instruction text instead of empty area
        const instructionHTML = `
            <div class="translation-option">Tap the spacebar to circle through the translations</div>
        `;
        this.eventBus.emit('ui:updateDisplayContainer', instructionHTML);
    }
    
    resetRevisionState() {
        console.log('🎯 P1Challenge: Resetting revision state');
        this.currentState = -1; // Start at -1, first spacebar press will go to 0
    }
    

    
    // Display area methods
    showCurrentSemanticUnit() {
        console.log('🎯 P1Challenge: Showing semantic unit:', this.currentState);
        
        const currentUnit = this.states[this.currentState];
        console.log('🎯 P1Challenge: Unit target:', currentUnit.unitTarget);
        console.log('🎯 P1Challenge: Translations:', currentUnit.translations);
        
        // Show phrase with yellow border around semantic unit
        this.eventBus.emit('ui:updateHighlightedText', {
            fullSentence: this.fullSentence, 
            unitTarget: currentUnit.unitTarget // This gets yellow border in header
        });
        
        // Show ONLY translations in display area (no repeated semantic unit)
        const translationsHTML = currentUnit.translations.map(t => 
            `<div class="translation-option">${t}</div>`
        ).join('');
        
        this.eventBus.emit('ui:updateDisplayContainer', translationsHTML);
    }
    
    // SOLUTION PHASE SETUP
    setupSolutionPhase() {
        console.log('🎯 P1Challenge: Setting up solution phase');
        
        // Show plain phrase in header
        this.eventBus.emit('ui:updateHighlightedText', {
            fullSentence: this.fullSentence, 
            unitTarget: '' // No highlighting in solution phase
        });
        
        // Show basic solution content for testing
        const solutionHTML = `
            <div class="translation-option">Solution Phase - Testing</div>
            <div class="translation-option">Full phrase: ${this.fullSentence}</div>
            <div class="translation-option">TODO: Multiple choice answers will go here</div>
        `;
        
        this.eventBus.emit('ui:updateDisplayContainer', solutionHTML);
        
        console.log('🎯 P1Challenge: Solution phase ready');
    }
    
    // Challenge logic
    nextState() {
        this.currentState = (this.currentState + 1) % this.states.length;
        this.updateGameContent();
    }
    
    updateGameContent() {
        console.log('🎯 P1Challenge: updateGameContent called');
        console.log('🎯 P1Challenge: Current phase during updateGameContent:', this.currentPhase);
        if (!this.fullSentence || !this.states.length) return;
        
        // Always show the phrase in header
        this.updateHeaderText();
        
        // Only show translations in revision phase
        if (this.currentPhase === 'revision') {
            this.updateTranslations();
        } else {
            console.log('🎯 P1Challenge: Skipping translations - not in revision phase');
        }
    }
    
    updateHeaderText() {
        console.log('🎯 P1Challenge: updateHeaderText called');
        
        if (this.currentPhase === 'revision') {
            // Show with highlighting
            this.updateHighlightedText();
        } else {
            // Show plain text (no highlighting)
            this.eventBus.emit('ui:updateHighlightedText', {
                fullSentence: this.fullSentence, 
                unitTarget: '' // Empty unitTarget = no highlighting
            });
        }
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
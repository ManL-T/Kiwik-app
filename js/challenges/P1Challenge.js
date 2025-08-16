// P1Challenge - handles all logic for phrase navigation challenge
class P1Challenge {
    constructor(eventBus, uiRenderer, phraseId) {
        console.log('🎯 P1Challenge: Received phraseId parameter:', phraseId);
        console.log('🎯 P1Challenge: Initializing...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        
        // Challenge data
        this.targetPhraseId = phraseId
        this.fullSentence = null;
        this.states = [];
        
        // Solution data
        this.primaryTranslation = null;
        this.alternatives = [];
        this.distractors = [];
        
        // Solution phase state
        this.solutionOptions = []; // Randomized array of 4 options
        this.correctIndex = -1;    // Index of correct answer in solutionOptions
        this.selectedIndex = 0;    // Currently selected option (0-3)
        
        // Phase management
        this.currentPhase = 'pre-revision';
        
        // Navigation state
        this.currentState = 0;
        this.isActive = true;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ P1Challenge: Initialization complete');
    }
    
   // Setup event listeners with stored handler references
    setupEventListeners() {
        // Store handler references for cleanup
        this.challengeStartHandler = () => {
            console.log('🎯 P1Challenge: Received challenge:start event');
            this.start();
        };
        
        this.phraseDataHandler = (challengeData) => {
            this.loadChallengeData(challengeData);
        };
        
        this.templateLoadedHandler = (templatePath) => {
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
        };
        
        this.enterHandler = () => {
            this.handleEnterKey();
        };
        
        this.spaceHandler = () => {
            this.handleSpaceKey();
        };
        
        // Register all event listeners
        this.eventBus.on('challenge:start', this.challengeStartHandler);
        this.eventBus.on('gameData:phraseDataReady', this.phraseDataHandler);
        this.eventBus.on('ui:templateLoaded', this.templateLoadedHandler);
        this.eventBus.on('navigation:enterPressed', this.enterHandler);
        this.eventBus.on('navigation:spacePressed', this.spaceHandler);
    }

    requestChallengeData() {
        this.eventBus.emit('gameData:requestPhraseData', this.targetPhraseId);
    }

    loadChallengeData(challengeData) {
        console.log('🎯 P1Challenge: Loading complete challenge data:', challengeData.phraseTarget);
        
        // Extract phrase data for revision phase
        this.fullSentence = challengeData.phraseTarget;
        this.states = challengeData.semanticUnits.map(unit => ({
            unitTarget: unit.unitTarget,
            translations: unit.translations
        }));
        
        // Extract solution data for solution phase
        this.primaryTranslation = challengeData.primaryTranslation;
        this.alternatives = challengeData.alternatives;
        this.distractors = challengeData.distractors;
        
        console.log('🎯 P1Challenge: Phrase data loaded:', this.fullSentence);
        console.log('🎯 P1Challenge: Solution data loaded:', this.primaryTranslation);
        console.log('🎯 P1Challenge: Distractors loaded:', this.distractors.length, 'items');
        
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
        
        // Request complete challenge data
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
        } else if (this.currentPhase === 'solution') {
            // SOLUTION LOGIC: Submit current selection
            this.handleSolutionEnter();
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
        } else if (this.currentPhase === 'solution') {
            // SOLUTION LOGIC: Navigate through answer options
            this.handleSolutionSpacebar();
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
        
        if (!this.primaryTranslation || !this.distractors.length) {
            console.log('🎯 P1Challenge: No solution data available');
            return;
        }
        
        // Show plain phrase in header
        this.eventBus.emit('ui:updateHighlightedText', {
            fullSentence: this.fullSentence, 
            unitTarget: '' // No highlighting in solution phase
        });
        
        // Prepare solution options
        this.prepareSolutionOptions();
        
        // Render multiple choice interface
        this.renderSolutionInterface();
        
        console.log('🎯 P1Challenge: Solution phase ready with', this.solutionOptions.length, 'options');
    }
    
    prepareSolutionOptions() {
        console.log('🎯 P1Challenge: Preparing solution options');
        
        // Create array with correct answer + 3 distractors
        const allOptions = [this.primaryTranslation, ...this.distractors.slice(0, 3)];
        
        // Shuffle the options
        this.solutionOptions = this.shuffleArray([...allOptions]);
        
        // Find where the correct answer ended up
        this.correctIndex = this.solutionOptions.indexOf(this.primaryTranslation);
        
        // Reset selection to first option
        this.selectedIndex = 0;
        
        console.log('🎯 P1Challenge: Options prepared, correct answer at index:', this.correctIndex);
        console.log('🎯 P1Challenge: Solution options:', this.solutionOptions);
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    renderSolutionInterface() {
        console.log('🎯 P1Challenge: Rendering solution interface');
        
        const solutionHTML = this.solutionOptions.map((option, index) => {
            const isSelected = index === this.selectedIndex;
            const cssClass = isSelected ? 'solution-option solution-option-selected' : 'solution-option';
            return `<div class="${cssClass}">${option}</div>`;
        }).join('');
        
        this.eventBus.emit('ui:multipleChoice', solutionHTML);
    }
    
    // SOLUTION NAVIGATION
    handleSolutionSpacebar() {
        console.log('🎯 P1Challenge: Solution spacebar - cycling selection');
        
        // Move to next option (cycle 0→1→2→3→0)
        this.selectedIndex = (this.selectedIndex + 1) % this.solutionOptions.length;
        
        console.log('🎯 P1Challenge: Selected index now:', this.selectedIndex);
        
        // Update visual selection
        this.renderSolutionInterface();
    }
    
    handleSolutionEnter() {
        console.log('🎯 P1Challenge: Solution enter - submitting answer');
        console.log('🎯 P1Challenge: Selected index:', this.selectedIndex, 'Correct index:', this.correctIndex);
        
        const isCorrect = this.selectedIndex === this.correctIndex;
        
        if (isCorrect) {
            console.log('🎯 P1Challenge: Correct answer! Showing green feedback');
            this.showAnswerFeedback('correct');
        } else {
            console.log('🎯 P1Challenge: Incorrect answer! Showing red feedback');
            this.showAnswerFeedback('incorrect');
        }
    }
    
    showAnswerFeedback(feedbackType) {
        console.log('🎯 P1Challenge: Showing feedback:', feedbackType);

        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
            this.feedbackTimeout = null;
        }
        
        // Render interface with feedback colors
        const solutionHTML = this.solutionOptions.map((option, index) => {
            let cssClass = 'solution-option';
            
            if (index === this.selectedIndex) {
                // Color the selected option based on correctness
                cssClass += feedbackType === 'correct' ? ' solution-option-correct' : ' solution-option-incorrect';
            }
            
            return `<div class="${cssClass}">${option}</div>`;
        }).join('');
        
        this.eventBus.emit('ui:multipleChoice', solutionHTML);
        
        // FIXED: Store timeout reference properly and check isActive in callback
        this.feedbackTimeout = setTimeout(() => {
            if (!this.isActive) {
                console.log('🎯 P1Challenge: Timeout fired but challenge is inactive - exiting');
                return; // Exit if challenge was cleaned up
            }
            
            if (feedbackType === 'correct') {
                this.proceedToNextChallenge();
            } else {
                this.eventBus.emit('challenge:wrongAnswer');
                this.resetToSelection();
            }
        }, 1000);
    }

    
    proceedToNextChallenge() {
        console.log('🎯 P1Challenge: Proceeding to next challenge');
        // TODO: Implement next phrase loading
        // changed to challenge: complete
       this.eventBus.emit('challenge:complete');

    }

    // Cleanup method - remove event listeners
    cleanup() {
        console.log('🎯 P1Challenge: Cleaning up...');

        // Disable this challenge instance
        this.isActive = false;
        
        // Clear timeout
        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
        }
    

        // Clear any pending timeouts
        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
            this.feedbackTimeout = null;
        }
        
        this.eventBus.off('challenge:start', this.challengeStartHandler);
        this.eventBus.off('gameData:phraseDataReady', this.phraseDataHandler);
        this.eventBus.off('ui:templateLoaded', this.templateLoadedHandler);
        this.eventBus.off('navigation:enterPressed', this.enterHandler);
        this.eventBus.off('navigation:spacePressed', this.spaceHandler);
        
        console.log('✅ P1Challenge: Cleanup complete');
    }

    
    resetToSelection() {
        console.log('🎯 P1Challenge: Resetting to selection mode (same positions)');
        
        // FIXED: Add isActive check
        if (!this.isActive) {
            console.log('🎯 P1Challenge: resetToSelection called after cleanup - ignoring');
            return;
        }
        
        // Keep same positions, just remove feedback colors
        this.renderSolutionInterface();
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
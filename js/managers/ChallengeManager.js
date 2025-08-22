// js/managers/ChallengeManager.js - New Assembly Architecture with Timer Orchestration
class ChallengeManager {
    constructor(eventBus, uiRenderer, gameData) {
        console.log('🎯 ChallengeManager: Initializing with assembly architecture...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        this.gameData = gameData;
        
        // Assembly recipes for different challenge types
        this.recipes = {
            P1: ['Presentation', 'Revision', 'ReadyOrNot', 'Solution'],
            P2: ['Presentation', 'Retrieval', 'ReadyOrNot', 'Solution']
        };
        
        // Current challenge state
        this.currentChallengeType = 'P1'; // For testing, always start with P1
        this.currentRecipe = null;
        this.currentPhaseIndex = 0;
        this.currentPhrase = null;
        this.challengeData = null;
        
        // Timer state tracking
        this.timerWasStarted = false;
        
        // Phase instances - created once, reused
        this.phases = {};
        this.currentPhase = null;
        
        // Sequence tracking (simplified for testing)
        this.currentTextIndex = 0;
        this.currentPhraseIndex = 0;
        this.sequenceData = [];
        
        // Initialize phase modules
        this.initializePhases();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ ChallengeManager: Assembly architecture ready');
    }
    
    // Initialize all phase modules
    initializePhases() {
        console.log('🎯 ChallengeManager: Initializing phase modules...');
        
        this.phases = {
            Presentation: new Presentation(this.eventBus),
            Revision: new Revision(this.eventBus),
            Retrieval: new Retrieval(this.eventBus),
            ReadyOrNot: new ReadyOrNot(this.eventBus),
            Solution: new Solution(this.eventBus)
        };
        
        console.log('✅ ChallengeManager: All phase modules initialized');
    }
    
    // Setup event listeners for phase transitions
    setupEventListeners() {
        // Phase completion events
        this.eventBus.on('presentation:skipToSolution', () => {
            this.jumpToPhase('Solution');
        });
        
        this.eventBus.on('presentation:proceedToRevision', () => {
            this.proceedToNextPhase();
        });
        
        this.eventBus.on('revision:completed', () => {
            this.proceedToNextPhase();
        });
        
        this.eventBus.on('retrieval:completed', () => {
            this.proceedToNextPhase();
        });
        
        this.eventBus.on('readyOrNot:proceedToSolution', () => {
            this.proceedToNextPhase();
        });
        
        this.eventBus.on('readyOrNot:returnToRevision', () => {
            this.returnToRevisionPhase();
        });
        
        this.eventBus.on('solution:correct', () => {
            console.log('🎯 ChallengeManager: Correct answer - stopping timer immediately');
            this.eventBus.emit('timer:stop');
            this.handleChallengeComplete();
        });
        
        this.eventBus.on('solution:incorrect', () => {
            this.handleIncorrectAnswer();
        });
        
        // Data loading
        this.eventBus.on('gameData:loaded', () => {
            this.buildSequenceFromData();
        });
        
        this.eventBus.on('gameData:phraseDataReady', (challengeData) => {
            this.handlePhraseDataReady(challengeData);
        });
        
        // Challenge creation request
        this.eventBus.on('challenge:start', () => {
            this.createChallenge();
        });

        // handle timer expiration
        this.eventBus.on('solution:timerExpired', () => {
            console.log('🎯 ChallengeManager: Timer expired - energy loss and progression');
            this.eventBus.emit('challenge:timerExpired'); 
        });

        this.eventBus.on('session:progressToNextChallenge', () => {
            console.log('🎯 ChallengeManager: Session requesting next challenge progression');
            this.handleChallengeComplete();
        });
                
        // Debug logging for template loads
        this.eventBus.on('ui:templateLoaded', (templatePath) => {
            console.log('🎯 ChallengeManager: Received ui:templateLoaded event for:', templatePath);
            console.log('🎯 ChallengeManager: Current phase is:', this.currentPhase?.constructor.name);
        });
    }
    
    // Build sequence from game data (simplified for testing)
    buildSequenceFromData() {
        console.log('🎯 ChallengeManager: Building sequence from GameData...');
        
        const allTexts = this.gameData.getAllTexts();
        allTexts.sort((a, b) => {
            const numA = parseInt(a.textId.split('_')[1]);
            const numB = parseInt(b.textId.split('_')[1]);
            return numA - numB;
        });
        
        this.sequenceData = [];
        allTexts.forEach(text => {
            const phrases = this.gameData.getPhrasesForText(text.textId);
            const phraseIds = phrases.map(phrase => phrase.phraseId);
            this.sequenceData.push(phraseIds);
        });
        
        console.log('✅ ChallengeManager: Sequence built with', this.sequenceData.length, 'texts');
    }
    
    // Create a new challenge (entry point)
    createChallenge() {
        console.log('🎯 ChallengeManager: Creating new challenge...');
        
        // Reset timer for every new challenge
        console.log('🎯 ChallengeManager: Resetting timer for new challenge');
        this.eventBus.emit('timer:reset');
        this.timerWasStarted = false;
        
        // Get current phrase ID
        const phraseId = this.getCurrentPhraseId();
        if (!phraseId) {
            console.log('🎯 ChallengeManager: No more phrases available');
            return;
        }
        
        console.log('🎯 ChallengeManager: Creating challenge for phrase:', phraseId);
        
        // For testing: always use P1 recipe
        this.currentChallengeType = 'P1';
        this.currentRecipe = [...this.recipes[this.currentChallengeType]];
        this.currentPhaseIndex = 0;
        this.currentPhrase = phraseId;
        
        // Request challenge data
        this.eventBus.emit('gameData:requestPhraseData', phraseId);
    }
    
    // Handle phrase data response
    handlePhraseDataReady(challengeData) {
        console.log('🎯 ChallengeManager: Received phrase data for:', challengeData.phraseTarget);
        this.challengeData = challengeData;
        this.startFirstPhase();
    }
    
    // Start the first phase of current recipe
    startFirstPhase() {
        console.log('🎯 ChallengeManager: Starting first phase of', this.currentChallengeType, 'challenge');
        console.log('🎯 ChallengeManager: Recipe:', this.currentRecipe);
        
        this.currentPhaseIndex = 0;
        this.activateCurrentPhase();
    }
    
    // Activate the current phase in the recipe
    activateCurrentPhase() {
        const phaseName = this.currentRecipe[this.currentPhaseIndex];
        console.log('🎯 ChallengeManager: Activating phase:', phaseName, '(index:', this.currentPhaseIndex + ')');
        
        // Cleanup previous phase
        if (this.currentPhase) {
            this.currentPhase.cleanup();
        }
        
        // Load template for this phase
        this.loadPhaseTemplate(phaseName);
        
        // Activate new phase
        this.currentPhase = this.phases[phaseName];
        const phaseData = this.getPhaseData(phaseName);
        this.currentPhase.start(phaseData);
        
        console.log('🎯 ChallengeManager: Phase data passed to', phaseName + ':', phaseData);
        console.log('🎯 ChallengeManager: Phase', phaseName, 'start() completed');
        
        // Manage timer based on phase and challenge type
        this.manageTimerForPhase(phaseName);
    }
    
    // Load template for phase
    loadPhaseTemplate(phaseName) {
        console.log('🎯 ChallengeManager: Loading template for phase:', phaseName);
        
        const templateMap = {
            'Presentation': 'templates/screens/presentation.html',
            'Revision': 'templates/screens/game.html',
            'Retrieval': 'templates/screens/game.html',
            'ReadyOrNot': 'templates/screens/ready-or-not.html',
            'Solution': 'templates/screens/game.html'
        };
        
        const templatePath = templateMap[phaseName];
        console.log('🎯 ChallengeManager: Template path resolved to:', templatePath);
        
        if (templatePath) {
            console.log('🎯 ChallengeManager: Emitting ui:loadTemplate for:', templatePath);
            this.eventBus.emit('ui:loadTemplate', templatePath);
        } else {
            console.error('🎯 ChallengeManager: No template found for phase:', phaseName);
        }
    }
    
    // Get data needed for specific phase
    getPhaseData(phaseName) {
        if (!this.challengeData) return {};
        
        const dataMap = {
            'Presentation': {
                phraseTarget: this.challengeData.phraseTarget
            },
            'Revision': {
                phraseTarget: this.challengeData.phraseTarget,
                semanticUnits: this.challengeData.semanticUnits
            },
            'Retrieval': {
                phraseTarget: this.challengeData.phraseTarget,
                semanticUnits: this.challengeData.semanticUnits
            },
            'ReadyOrNot': {
                // No data needed
            },
            'Solution': {
                phraseTarget: this.challengeData.phraseTarget,
                primaryTranslation: this.challengeData.primaryTranslation,
                distractors: this.challengeData.distractors
            }
        };
        
        return dataMap[phaseName] || {};
    }
    
    // Get previous phase in recipe
    getPreviousPhase() {
        if (this.currentPhaseIndex > 0) {
            return this.currentRecipe[this.currentPhaseIndex - 1];
        }
        return null;
    }
    
    // Manage timer based on challenge type and phase
    manageTimerForPhase(phaseName) {
        const challengeType = this.currentChallengeType;
        const previousPhase = this.getPreviousPhase();
        
        console.log(`🎯 ChallengeManager: Managing timer for ${challengeType} - ${phaseName} (previous: ${previousPhase})`);
        
        if (challengeType === 'P1') {
            if (phaseName === 'Solution') {
                console.log('🎯 ChallengeManager: Starting timer for P1 Solution phase');
                this.eventBus.emit('timer:start');
                this.timerWasStarted = true;
            }
        } else if (challengeType === 'P2') {
            if (phaseName === 'Retrieval') {
                console.log('🎯 ChallengeManager: Starting timer for P2 Retrieval phase');
                this.eventBus.emit('timer:start');
                this.timerWasStarted = true;
            } else if (phaseName === 'ReadyOrNot') {
                if (previousPhase === 'Retrieval') {
                    console.log('🎯 ChallengeManager: Pausing timer - ReadyOrNot after Retrieval');
                    this.eventBus.emit('timer:pause');
                } else {
                    console.log('🎯 ChallengeManager: No timer action - ReadyOrNot after Revision');
                }
            } else if (phaseName === 'Solution') {
                if (this.timerWasStarted) {
                    console.log('🎯 ChallengeManager: Resuming timer for P2 Solution phase');
                    this.eventBus.emit('timer:resume');
                } else {
                    console.log('🎯 ChallengeManager: Starting timer for P2 Solution phase (skipped from Presentation)');
                    this.eventBus.emit('timer:start');
                    this.timerWasStarted = true;
                }
            }
        }
    }
    
    // Proceed to next phase in recipe
    proceedToNextPhase() {
        console.log('🎯 ChallengeManager: Proceeding to next phase...');
        
        this.currentPhaseIndex++;
        
        if (this.currentPhaseIndex >= this.currentRecipe.length) {
            console.log('🎯 ChallengeManager: Recipe completed!');
            this.handleChallengeComplete();
        } else {
            this.activateCurrentPhase();
        }
    }
    
    // Jump to specific phase (e.g., skip to solution)
    jumpToPhase(phaseName) {
        console.log('🎯 ChallengeManager: Jumping to phase:', phaseName);
        
        const phaseIndex = this.currentRecipe.indexOf(phaseName);
        if (phaseIndex !== -1) {
            this.currentPhaseIndex = phaseIndex;
            this.activateCurrentPhase();
        } else {
            console.error('🎯 ChallengeManager: Phase not found in recipe:', phaseName);
        }
    }
    
    // Return to revision phase (P1) or retrieval phase (P2)
    returnToRevisionPhase() {
        console.log('🎯 ChallengeManager: Returning to revision/retrieval phase...');
        
        const revisionPhase = this.currentChallengeType === 'P1' ? 'Revision' : 'Retrieval';
        this.jumpToPhase(revisionPhase);
    }
    
    // Handle challenge completion
    handleChallengeComplete() {
        console.log('🎯 ChallengeManager: Challenge completed successfully!');
        
        // Move to next phrase
        this.currentPhraseIndex++;
        
        // Check if there's a next phrase
        let nextPhraseId = this.getCurrentPhraseId();
        
        if (!nextPhraseId) {
            // Try next text
            this.currentTextIndex++;
            this.currentPhraseIndex = 0;
            nextPhraseId = this.getCurrentPhraseId();
        }
        
        if (nextPhraseId) {
            console.log('🎯 ChallengeManager: Next phrase available:', nextPhraseId);
            this.createChallenge();
        } else {
            console.log('🎯 ChallengeManager: No more phrases - session complete');
        }
    }
    
    // Handle incorrect answer
    handleIncorrectAnswer() {
        console.log('🎯 ChallengeManager: Handling incorrect answer...');
        // TODO: Emit energy loss event and handle accordingly
        this.eventBus.emit('challenge:wrongAnswer');
    }
    
    // Get current phrase ID (simplified for testing)
    getCurrentPhraseId() {
        if (!this.sequenceData.length) return null;
        if (this.currentTextIndex >= this.sequenceData.length) return null;
        
        const currentTextPhrases = this.sequenceData[this.currentTextIndex];
        if (this.currentPhraseIndex >= currentTextPhrases.length) return null;
        
        return currentTextPhrases[this.currentPhraseIndex];
    }
    
    // Cleanup all phases (called during game over)
    cleanupCurrentChallenge() {
        console.log('🎯 ChallengeManager: Cleaning up current challenge...');
        
        if (this.currentPhase) {
            this.currentPhase.cleanup();
            this.currentPhase = null;
        }
        
        console.log('✅ ChallengeManager: Cleanup complete');
    }
}
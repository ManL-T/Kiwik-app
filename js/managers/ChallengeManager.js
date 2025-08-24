// js/managers/ChallengeManager.js - New Assembly Architecture with Text Cover Integration
class ChallengeManager {
    constructor(eventBus, uiRenderer, gameData) {
        console.log('🎯 ChallengeManager: Initializing with assembly architecture...');
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        this.gameData = gameData;
        
        // Assembly recipes for different challenge levels
        this.recipes = {
            LEVEL_1: ['Presentation', 'Revision', 'ReadyOrNot', 'Solution'],
            LEVEL_2: ['Presentation', 'Retrieval', 'ReadyOrNot', 'Solution']
        };
        
        // Current challenge state
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



        // Batch Management System
        this.currentBatch = [1, 2];     // textIds in current batch (hardcoded pairs for now)
        this.currentLevel = 'LEVEL_1';  // Level for current batch (changed from hardcoded LEVEL_2)
        this.batchCompletionState = {   // Track progress within batch
            level1: { text_1: false, text_2: false },
            level2: { text_1: false, text_2: false }
};
        
        // Text cover state
        this.isShowingTextCover = false;
        
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

        // Handle timer expiration
        this.eventBus.on('solution:timerExpired', () => {
            console.log('🎯 ChallengeManager: Timer expired - energy loss and progression');
            this.eventBus.emit('challenge:timerExpired'); 
        });

        this.eventBus.on('session:progressToNextChallenge', () => {
            console.log('🎯 ChallengeManager: Session requesting next challenge progression');
            this.handleChallengeComplete();
        });
        
        // Text cover spacebar handling
        this.eventBus.on('navigation:spacePressed', () => {
            if (this.isShowingTextCover) {
                this.handleTextCoverSpacebar();
            }
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
        console.log('🐛 DEBUG: this.sequenceData =', this.sequenceData);
        console.log('🐛 DEBUG: this.currentTextIndex =', this.currentTextIndex);
        console.log('🐛 DEBUG: this.currentPhraseIndex =', this.currentPhraseIndex);
        
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
    
    // Create a new challenge (entry point) - now with text cover integration
    createChallenge() {
        const currentTextId = this.getCurrentTextId();
        const detectedBatch = this.getBatchForText(currentTextId);
        console.log('🐛 DEBUG: Current text:', currentTextId, 'Detected batch:', detectedBatch, 'Current batch:', this.currentBatch);
        console.log('🎯 ChallengeManager: Creating new challenge...');
        
        // Get current phrase ID
        const phraseId = this.getCurrentPhraseId();
        if (!phraseId) {
            console.log('🎯 ChallengeManager: No more phrases available');
            return;
        }
        
        console.log('🎯 ChallengeManager: Creating challenge for phrase:', phraseId);
        
        // Check if this is the first phrase of a text (show text cover)
        if (this.currentPhraseIndex === 0) {
            console.log('🎯 ChallengeManager: First phrase of text - showing text cover');
            this.showTextCover(phraseId);
            return; // Exit here, wait for spacebar to proceed
        }
        
        // Otherwise proceed with normal challenge creation
        this.startChallengeAssembly(phraseId);
    }
    
    // Show text cover for first phrase of text
    showTextCover(phraseId) {
        console.log('🎯 ChallengeManager: Showing text cover for phrase:', phraseId);
        
        this.isShowingTextCover = true;
        
        // Extract textId from phraseId (e.g., "text_1_p3" → "text_1")  
        const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
        console.log('🎯 ChallengeManager: Extracted textId:', textId);
        
        this.eventBus.emit('ui:loadTextCover', textId);
    }
    
    // Handle spacebar press during text cover display
    handleTextCoverSpacebar() {
        console.log('🎯 ChallengeManager: Text cover spacebar pressed - proceeding to challenge');
        
        this.isShowingTextCover = false;
        
        // Get current phrase ID and start challenge assembly
        const phraseId = this.getCurrentPhraseId();
        this.startChallengeAssembly(phraseId);
    }
    
    // Start the challenge assembly process (extracted from createChallenge)
    startChallengeAssembly(phraseId) {
        console.log('🎯 ChallengeManager: Starting challenge assembly for phrase:', phraseId);
        
        // Reset timer for every new challenge
        console.log('🎯 ChallengeManager: Resetting timer for new challenge');
        this.eventBus.emit('timer:reset');
        this.timerWasStarted = false;
        
        // For testing: always use LEVEL_1 recipe
        // this.currentLevel = 'LEVEL_1';
        this.currentRecipe = [...this.recipes[this.currentLevel]];
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
        console.log('🎯 ChallengeManager: Starting first phase of Level', this.currentLevel, 'challenge');
        console.log('🎯 ChallengeManager: Recipe:', this.currentRecipe);
        
        this.currentPhaseIndex = 0;
        this.activateCurrentPhase();
    }
    
    // Activate the current phase in the recipe
    activateCurrentPhase() {
        console.log('🎯 ChallengeManager: Current recipe array:', this.currentRecipe);
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
        const challengeLevel = this.currentLevel;
        const previousPhase = this.getPreviousPhase();
        
        console.log(`🎯 ChallengeManager: Managing timer for ${challengeLevel} - ${phaseName} (previous: ${previousPhase})`);
        
        if (challengeLevel === 'LEVEL_1') {
            if (phaseName === 'Solution') {
                console.log('🎯 ChallengeManager: Starting timer for LEVEL-1 Solution phase');
                this.eventBus.emit('timer:start');
                this.timerWasStarted = true;
            }
        } else if (challengeLevel === 'LEVEL_2') {
            if (phaseName === 'Retrieval') {
                console.log('🎯 ChallengeManager: Starting timer for LEVEL-2 Retrieval phase');
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
                    console.log('🎯 ChallengeManager: Resuming timer for LEVEL_2 Solution phase');
                    this.eventBus.emit('timer:resume');
                } else {
                    console.log('🎯 ChallengeManager: Starting timer for LEVEL_2 Solution phase (skipped from Presentation)');
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
    
    // Return to revision phase (LEVEL_1) or retrieval phase (LEVEL_2)
    returnToRevisionPhase() {
        console.log('🎯 ChallengeManager: Returning to revision/retrieval phase...');
        
        const revisionPhase = this.currentLevel === 'LEVEL_1' ? 'Revision' : 'Retrieval';
        this.jumpToPhase(revisionPhase);
    }
    
    // Handle challenge completion
    handleChallengeComplete() {
        console.log('🐛 DEBUG handleChallengeComplete: currentTextIndex =', this.currentTextIndex);
        console.log('🐛 DEBUG handleChallengeComplete: currentPhraseIndex =', this.currentPhraseIndex);
        console.log('🐛 DEBUG handleChallengeComplete: currentLevel =', this.currentLevel);
        console.log('🐛 DEBUG handleChallengeComplete: currentBatch =', this.currentBatch);
        console.log('🎯 ChallengeManager: Challenge completed successfully!');
        
        // Check if this was the last phrase of current text
        const currentTextId = this.getCurrentTextId();
        const currentTextPhrases = this.sequenceData[this.currentTextIndex];

        if (this.currentPhraseIndex + 1 >= currentTextPhrases.length) {
            // Last phrase of current text - mark text complete
            this.markTextComplete(currentTextId);
            return; // Let batch completion logic handle what's next
        }

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
        this.eventBus.emit('challenge:wrongAnswer');
    }

    // Determine which batch a textId belongs to (1-2, 3-4, 5-6, etc.)
    getBatchForText(textId) {
        const textNumber = parseInt(textId.split('_')[1]); // Extract number from "text_1" -> 1
        const batchIndex = Math.ceil(textNumber / 2); // 1,2->1  3,4->2  5,6->3
        const batchStart = (batchIndex - 1) * 2 + 1;   // batch 1: start=1, batch 2: start=3
        const batchEnd = batchStart + 1;                // batch 1: end=2, batch 2: end=4
        return [batchStart, batchEnd];
    }

    // Check if current batch is complete at current level
    isCurrentBatchComplete() {
        const levelKey = this.currentLevel === 'LEVEL_1' ? 'level1' : 'level2';
        const batch = this.currentBatch;
        
        console.log('🐛 DEBUG isCurrentBatchComplete: levelKey =', levelKey);
        console.log('🐛 DEBUG isCurrentBatchComplete: batch =', batch);
        console.log('🐛 DEBUG isCurrentBatchComplete: batchCompletionState =', this.batchCompletionState);
        
        // Check if all texts in current batch are complete at current level
        const result = batch.every(textNum => {
            const textId = `text_${textNum}`;
            const isComplete = this.batchCompletionState[levelKey][textId] === true;
            console.log('🐛 DEBUG isCurrentBatchComplete: checking', textId, '=', isComplete);
            return isComplete;
        });
        
        console.log('🐛 DEBUG isCurrentBatchComplete: final result =', result);
        return result;
    }

    // Get current text from current position (helper method)
    getCurrentTextId() {
        return `text_${this.currentTextIndex + 1}`; // Convert 0-based index to 1-based textId
    }

    // Mark a text as complete at current level
    markTextComplete(textId) {
        const levelKey = this.currentLevel === 'LEVEL_1' ? 'level1' : 'level2';
        console.log('🎯 ChallengeManager: Marking', textId, 'complete at', levelKey)
        console.log('🐛 DEBUG markTextComplete: Batch completion state before:', this.batchCompletionState);

        this.batchCompletionState[levelKey][textId] = true;

        console.log('🐛 DEBUG markTextComplete: Batch completion state after:', this.batchCompletionState);
        
        // Check if this completes the current batch at current level
        if (this.isCurrentBatchComplete()) {
            console.log('🎯 ChallengeManager: Batch', this.currentBatch, 'complete at', this.currentLevel);
            this.handleBatchComplete();
        } else {
        console.log('🎯 ChallengeManager: Batch not complete - moving to next text in batch');
        this.moveToNextTextInBatch();
        }
    }

    // Move to next text in current batch
    moveToNextTextInBatch() {
        // Move to next text
        this.currentTextIndex++;
        this.currentPhraseIndex = 0;
        
        console.log('🎯 ChallengeManager: Moved to next text - textIndex:', this.currentTextIndex, 'phraseIndex:', this.currentPhraseIndex);
        
        // Create challenge for first phrase of next text
        this.createChallenge();
    }

    // Handle batch completion - decide next level or next batch
    handleBatchComplete() {
        if (this.currentLevel === 'LEVEL_1') {
            console.log('🎯 ChallengeManager: Moving from Level 1 to Level 2 for same batch');
            this.currentLevel = 'LEVEL_2';
            // Reset to first text of current batch
            this.currentTextIndex = this.currentBatch[0] - 1; // Convert to 0-based index
            this.currentPhraseIndex = 0;

            // CREATE THE NEXT CHALLENGE
            this.createChallenge();

        } else {
            // LEVEL_2 complete - move to next batch at LEVEL_1
            console.log('🎯 ChallengeManager: LEVEL_2 complete - moving to next batch at LEVEL_1');
            
            // Calculate next batch: [1,2] → [3,4], [3,4] → [5,6], etc.
            const nextBatchStart = this.currentBatch[1] + 1;  // 2 + 1 = 3
            const nextBatchEnd = nextBatchStart + 1;          // 3 + 1 = 4
            this.currentBatch = [nextBatchStart, nextBatchEnd];
            
            console.log('🎯 ChallengeManager: New batch:', this.currentBatch);
            
            this.currentLevel = 'LEVEL_1';
            this.currentTextIndex = nextBatchStart - 1;  // Convert to 0-based: 3-1=2
            this.currentPhraseIndex = 0;
            
            // Initialize completion state for new batch
            this.batchCompletionState.level1[`text_${nextBatchStart}`] = false;
            this.batchCompletionState.level1[`text_${nextBatchEnd}`] = false;
            this.batchCompletionState.level2[`text_${nextBatchStart}`] = false;
            this.batchCompletionState.level2[`text_${nextBatchEnd}`] = false;
            
            console.log('🎯 ChallengeManager: Initialized completion state for new batch');
            
            // Create the first challenge of new batch
            this.createChallenge();
        }
    }


    
    // Get current phrase ID (simplified for testing)
    getCurrentPhraseId() {
        console.log('🐛 DEBUG getCurrentPhraseId: sequenceData.length =', this.sequenceData.length);
        console.log('🐛 DEBUG getCurrentPhraseId: currentTextIndex =', this.currentTextIndex);
        console.log('🐛 DEBUG getCurrentPhraseId: currentPhraseIndex =', this.currentPhraseIndex);
        if (!this.sequenceData.length) return null;
        if (this.currentTextIndex >= this.sequenceData.length) return null;
        
        const currentTextPhrases = this.sequenceData[this.currentTextIndex];
        console.log('🐛 DEBUG getCurrentPhraseId: currentTextPhrases =', currentTextPhrases);


        if (this.currentPhraseIndex >= currentTextPhrases.length) return null;

        const result = currentTextPhrases[this.currentPhraseIndex];
        console.log('🐛 DEBUG getCurrentPhraseId: returning =', result);
        return result;
        
        // return currentTextPhrases[this.currentPhraseIndex];
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
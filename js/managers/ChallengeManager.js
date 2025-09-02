// js/managers/ChallengeManager.js - Updated with UserProgress Integration
class ChallengeManager {
    constructor(eventBus, uiRenderer, gameData, userProgress) {
        console.log(`🎯 ChallengeManager: [${new Date().toISOString()}] Initializing with UserProgress integration...`);
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        this.gameData = gameData;
        this.userProgress = userProgress;
        
        // Assembly recipes for different challenge levels
        this.recipes = {
            LEVEL_1: ['Presentation', 'Revision', 'ReadyOrNot', 'Solution'],
            LEVEL_2: ['Presentation', 'Retrieval', 'ReadyOrNot', 'Solution']
        };

        // Round management
        this.textCurrentLevels = {}; // Locked levels for current round per text
        this.currentRoundTexts = new Set(); // Tracks which texts are in current round
        
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
        
        // Sequence tracking
        this.currentTextIndex = 0;
        this.currentPhraseIndex = 0;
        this.sequenceData = [];

        // Batch Management System - will be set from UserProgress ?????
        this.currentLevel = null;
        
        // Text cover state
        this.isShowingTextCover = false;
        this.lastTextId = null; // Track which text we were showing last
        
        // OPTION B: Initialization coordination flags (following project pattern)
        this.gameDataReady = false;
        this.userProgressReady = false;
        this.initializationComplete = false;
        
        // Initialize phase modules
        this.initializePhases();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log(`✅ ChallengeManager: [${new Date().toISOString()}] UserProgress integration constructor complete`);
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
            this.eventBus.emit('userProgress:phraseSkipped', this.currentPhrase);
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
            this.eventBus.emit('userProgress:correctAnswer', this.currentPhrase);
            this.handleChallengeComplete();
        });
        
        this.eventBus.on('solution:incorrect', () => {
            console.log('🎯 ChallengeManager: DEBUG - solution:incorrect received, currentPhrase is:', this.currentPhrase);
            this.handleIncorrectAnswer();
        });
        
        // Data loading - OPTION B: Wait for both events before proceeding
        this.eventBus.on('gameData:loaded', () => {
            const timestamp = new Date().toISOString();
            console.log(`🎯 ChallengeManager: [${timestamp}] gameData:loaded event received`);
            this.gameDataReady = true;
            this.checkInitializationReadiness(timestamp);
        });
        
        // After GameData is ready, set starting position
        this.eventBus.on('userProgress:ready', () => {
            const resumePosition = this.userProgress.getResumePosition();
            const allTexts = this.gameData.getAllTexts();
            const startIndex = allTexts.findIndex(t => t.textId === resumePosition.startTextId);
            this.currentTextIndex = startIndex >= 0 ? startIndex : 0;
            console.log(`🎯 ChallengeManager: Starting from ${resumePosition.startTextId} at index ${this.currentTextIndex}`);
        });
        
        // OPTION B: Check current state immediately (established pattern)
        const timestamp = new Date().toISOString();
        console.log(`🎯 ChallengeManager: [${timestamp}] Checking if UserProgress is already ready...`);
        if (this.userProgress && this.userProgress.isReady) {
            console.log(`🎯 ChallengeManager: [${timestamp}] UserProgress already ready - updating flag`);
            this.userProgressReady = true;
            this.checkInitializationReadiness(timestamp);
        } else {
            console.log(`🎯 ChallengeManager: [${timestamp}] UserProgress not ready yet - will wait for event`);
        }
        
        this.eventBus.on('gameData:phraseDataReady', (challengeData) => {
            this.handlePhraseDataReady(challengeData);
        });
        
        // Challenge creation request
        this.eventBus.on('challenge:start', () => {
            this.createChallenge();
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

        // Handle text level up events
        this.eventBus.on('userProgress:textLeveledUp', (data) => {
            const { textId, oldLevel, newLevel } = data;
            console.log(`🎉 ChallengeManager: ${textId} leveled up from ${oldLevel} to ${newLevel}!`);
            
            // TODO: Show congratulations overlay/animation
            // For now, just log the achievement
            console.log(`🎉 ChallengeManager: TODO - Show level up congratulations for ${textId}`);
        });

        // Handle text mastery events  
        this.eventBus.on('userProgress:textMastered', (textId) => {
            console.log(`🎉 ChallengeManager: ${textId} is now fully MASTERED!`);
            
            // Text is now fully mastered - it will be automatically skipped by getCurrentPhraseId()
            // No immediate action needed, just log the achievement
            console.log(`🎉 ChallengeManager: ${textId} will no longer appear in challenges`);
            
            // TODO: Show mastery celebration
            console.log(`🎉 ChallengeManager: TODO - Show text mastery celebration for ${textId}`);
        });

        // Handle text level up events to expand pool
        this.eventBus.on('userProgress:textLeveledUp', (data) => {
            const { textId, oldLevel, newLevel } = data;
            console.log(`🎯 ChallengeManager: ${textId} leveled up from ${oldLevel} to ${newLevel} - expanding pool`);
            this.handleTextLevelUp(data);
        });         
               
        // Debug logging for template loads
        this.eventBus.on('ui:templateLoaded', (templatePath) => {
            console.log('🎯 ChallengeManager: Received ui:templateLoaded event for:', templatePath);
            console.log('🎯 ChallengeManager: Current phase is:', this.currentPhase?.constructor.name);
        });
    }
    
    // Check if both dependencies are ready before initialization
    checkInitializationReadiness(timestamp) {
        console.log(`🎯 ChallengeManager: [${timestamp}] Checking initialization readiness...`);
        console.log(`🎯 ChallengeManager: [${timestamp}] gameDataReady: ${this.gameDataReady}`);
        console.log(`🎯 ChallengeManager: [${timestamp}] userProgressReady: ${this.userProgressReady}`);
        console.log(`🎯 ChallengeManager: [${timestamp}] initializationComplete: ${this.initializationComplete}`);
        
        if (this.gameDataReady && this.userProgressReady && !this.initializationComplete) {
            console.log(`✅ ChallengeManager: [${timestamp}] Both dependencies ready - proceeding with initialization`);
            this.initializationComplete = true;
            this.buildSequenceFromData(timestamp);
        } else {
            console.log(`⏳ ChallengeManager: [${timestamp}] Still waiting for dependencies or already initialized`);
        }
    }
    
    // Build sequence from game data and set up batch structure - OPTION A: Comprehensive logging
    buildSequenceFromData(timestamp = new Date().toISOString()) {
        console.log(`🎯 ChallengeManager: [${timestamp}] buildSequenceFromData called`);
        
        console.log(`🎯 ChallengeManager: [${timestamp}] Getting all texts from GameData...`);
        const allTexts = this.gameData.getAllTexts();
        console.log(`🎯 ChallengeManager: [${timestamp}] Found ${allTexts.length} texts:`, allTexts.map(t => t.textId));
        
        allTexts.sort((a, b) => {
            const numA = parseInt(a.textId.split('_')[1]);
            const numB = parseInt(b.textId.split('_')[1]);
            return numA - numB;
        });
        console.log(`🎯 ChallengeManager: [${timestamp}] Texts sorted by number`);
        
        // Build sequence data (phrase counts per text)
        this.sequenceData = [];
        const textPhraseCounts = [];
        
        console.log(`🎯 ChallengeManager: [${timestamp}] Building sequence data and phrase counts...`);
        allTexts.forEach((text, index) => {
            console.log(`🎯 ChallengeManager: [${timestamp}] Processing text ${index + 1}: ${text.textId}`);
            
            const phrases = this.gameData.getPhrasesForText(text.textId);
            const phraseIds = phrases.map(phrase => phrase.phraseId);
            
            console.log(`🎯 ChallengeManager: [${timestamp}] Text ${text.textId} has ${phraseIds.length} phrases:`, phraseIds);
            
            this.sequenceData.push(phraseIds);
            textPhraseCounts.push(phraseIds.length);
        });
        
        console.log(`🎯 ChallengeManager: [${timestamp}] Sequence built with ${this.sequenceData.length} texts`);
        console.log(`🎯 ChallengeManager: [${timestamp}] Text phrase counts: [${textPhraseCounts.join(', ')}]`);
        console.log(`🎯 ChallengeManager: [${timestamp}] Total phrases across all texts: ${textPhraseCounts.reduce((a, b) => a + b, 0)}`);
        
    }

    // Replace getCurrentPhraseId() completely
    getCurrentPhraseId() {
        console.log('🎯 ChallengeManager: Finding next phrase with simple logic...');
        
        const roundState = this.userProgress.data.roundState;
        const { activeTexts, currentTextIndex } = roundState;
        
        console.log('🎯 ChallengeManager: Current round state:', roundState);
        
        // Get current text
        const currentTextId = activeTexts[currentTextIndex];
        console.log('🎯 ChallengeManager: Current text:', currentTextId);
        
        // Get all phrases for current text in sequential order
        const allPhrasesInText = this.gameData.getPhrasesForText(currentTextId);
        console.log('🎯 ChallengeManager: All phrases in', currentTextId + ':', allPhrasesInText.map(p => p.phraseId));
        
        // Find first incomplete phrase
        for (const phrase of allPhrasesInText) {
            if (!this.isPhraseCompleted(phrase.phraseId)) {
                console.log('🎯 ChallengeManager: Found incomplete phrase:', phrase.phraseId);
                return phrase.phraseId;
            }
        }
        
        // Current text is complete, move to next text
        console.log('🎯 ChallengeManager: Current text complete, advancing to next text...');
        this.advanceToNextText();
        
        // Try again with new current text (recursive call)
        return this.getCurrentPhraseId();
    }

    lockTextLevelsForRound() {
        console.log('🎯 ChallengeManager: Locking text levels for current round...');
        
        const roundState = this.userProgress.data.roundState;
        roundState.lockedTextLevels = {};
        
        // Lock current level for each active text
        roundState.activeTexts.forEach(textId => {
            const currentLevel = this.userProgress.getTextLevel(textId);
            roundState.lockedTextLevels[textId] = currentLevel;
            console.log(`🎯 ChallengeManager: Locked ${textId} at level ${currentLevel} for this round`);
        });
        
        this.userProgress.saveUserProgress();
    }



    // New method: advance to next text in sequence
    advanceToNextText() {
        console.log('🎯 ChallengeManager: Advancing to next text...');
        
        const roundState = this.userProgress.data.roundState;
        const oldTextIndex = roundState.currentTextIndex;
        const oldTextId = roundState.activeTexts[oldTextIndex];
        
        // Move to next text
        roundState.currentTextIndex = (roundState.currentTextIndex + 1) % roundState.activeTexts.length;
        
        const newTextIndex = roundState.currentTextIndex;
        const newTextId = roundState.activeTexts[newTextIndex];
        
        console.log(`🎯 ChallengeManager: Advanced from ${oldTextId} (index ${oldTextIndex}) to ${newTextId} (index ${newTextIndex})`);
        
        // If we're back to index 0, we completed a round
        if (newTextIndex === 0) {
            roundState.currentRound++;
            console.log(`🎯 ChallengeManager: Round completed! Starting round ${roundState.currentRound}`);
            
            // CRITICAL FIX: Reset completion tracking for new round
            this.startNewRound();
        }
        
        // Save the updated state
        this.userProgress.saveUserProgress();
    }

    // New method: check if phrase is completed (for this round)
    isPhraseCompleted(phraseId) {
        console.log(`🎯 ChallengeManager: Checking if ${phraseId} is completed for current round...`);
        
        const textId = this.extractTextId(phraseId);
        
        // Use LOCKED text level, not current level
        const roundState = this.userProgress.data.roundState;
        const lockedTextLevel = roundState.lockedTextLevels[textId];
        const phraseLevel = this.userProgress.getPhraseLevel(phraseId);
        
        console.log(`🎯 ChallengeManager: ${phraseId} - phrase level: ${phraseLevel}, locked text level: ${lockedTextLevel}`);
        
        // Condition 1: Mastered phrases are always completed
        if (phraseLevel === 'mastered') {
            console.log(`🎯 ChallengeManager: ${phraseId} is mastered - completed`);
            return true;
        }
        
        // Condition 2: Phrases above text level are completed for this round
        if (typeof phraseLevel === 'number' && phraseLevel > lockedTextLevel) {
            console.log(`🎯 ChallengeManager: ${phraseId} level ${phraseLevel} > text level ${lockedTextLevel} - completed`);
            return true;
        }
        
        // Condition 3: Already played in current session
        const sessionData = this.userProgress.sessionData;
        if (sessionData.attemptsByText[textId]) {
            const hasCompletedAttempt = sessionData.attemptsByText[textId].some(attempt => 
                attempt.phraseId === phraseId && attempt.correct === true
            );
            
            if (hasCompletedAttempt) {
                console.log(`🎯 ChallengeManager: ${phraseId} already completed in session - completed`);
                return true;
            }
        }
        
        console.log(`🎯 ChallengeManager: ${phraseId} is available for play - not completed`);
        return false;
    }

    // Helper method: extract textId from phraseId
    extractTextId(phraseId) {
        return phraseId.substring(0, phraseId.lastIndexOf('_'));
    }

    // Replace handleChallengeComplete() - simplified version
    handleChallengeComplete() {
        console.log('🎯 ChallengeManager: Challenge completed - moving to next phrase');
        
        // Simply create next challenge - getCurrentPhraseId() will handle the sequencing
        this.createChallenge();
    }

    handleTextLevelUp(data) {
        const { textId, oldLevel, newLevel } = data;
        console.log(`🎯 ChallengeManager: ${textId} leveled up from ${oldLevel} to ${newLevel} - adding new text to round`);
        
        // Get next available text to add
        const nextTextId = this.getNextAvailableText();
        
        if (nextTextId) {
            const roundState = this.userProgress.data.roundState;
            
            // Add to active texts
            roundState.activeTexts.push(nextTextId);
            console.log(`🎯 ChallengeManager: Added ${nextTextId} to round. Active texts now:`, roundState.activeTexts);
            
            // Lock the new text's level for this round
            const newTextLevel = this.userProgress.getTextLevel(nextTextId);
            roundState.lockedTextLevels[nextTextId] = newTextLevel;
            console.log(`🎯 ChallengeManager: Locked ${nextTextId} at level ${newTextLevel} for this round`);
            
            // Save changes
            this.userProgress.saveUserProgress();
        } else {
            console.log(`🎯 ChallengeManager: No more texts available to add`);
        }
    }

    getNextAvailableText() {
        const allTexts = this.gameData.getAllTexts();
        const activeTexts = this.userProgress.data.roundState.activeTexts;
        
        // Find first text not in active texts
        for (const text of allTexts) {
            if (!activeTexts.includes(text.textId)) {
                console.log(`🎯 ChallengeManager: Next available text: ${text.textId}`);
                return text.textId;
            }
        }
        
        return null; // No more texts available
    }
    
    // Create a new challenge (entry point) - now with text cover integration
    createChallenge() {
        // Check if this is the first challenge and levels need to be locked
        const roundState = this.userProgress.data.roundState;
        if (!roundState.lockedTextLevels || Object.keys(roundState.lockedTextLevels).length === 0) {
            console.log('🎯 ChallengeManager: First challenge - locking text levels for round');
            this.lockTextLevelsForRound();
        }
        const phraseId = this.getCurrentPhraseId();
        
        if (!phraseId) {
            console.log('🎯 ChallengeManager: No more phrases available - game complete?');
            // TODO: Handle game completion
            return;
        }
        
        // Extract textId from phraseId
        const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
        
        // Check if we should show text cover (switching to different text)
        if (this.shouldShowTextCover(textId)) {
            this.showTextCover(phraseId);
            return;
        }
        
        // Otherwise proceed with normal challenge
        this.startChallengeAssembly(phraseId);
    }

    shouldShowTextCover(textId) {
        console.log(`🎯 ChallengeManager: Checking text cover - lastTextId: ${this.lastTextId}, currentTextId: ${textId}`);
        
        // Don't show for fully mastered texts
        if (this.userProgress.isTextMastered(textId)) {
            console.log(`🎯 ChallengeManager: ${textId} is fully mastered - no text cover`);
            return false;
        }
        
        // Show cover when switching to a different text
        const switchingText = (this.lastTextId !== textId);
        console.log(`🎯 ChallengeManager: Switching texts? ${switchingText}`);
        
        return switchingText;
    }


    // Show text cover for first phrase of text
    showTextCover(phraseId) {
        console.log('🎯 ChallengeManager: Showing text cover for phrase:', phraseId);
        
        this.isShowingTextCover = true;
        
        // Extract textId from phraseId (e.g., "text_1_p3" → "text_1")  
        const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
        console.log('🎯 ChallengeManager: Extracted textId:', textId);
        
        // Update lastTextId to track current text
        this.lastTextId = textId;
        console.log(`🎯 ChallengeManager: Updated lastTextId to: ${this.lastTextId}`);
        
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
        this.currentPhaseIndex = 0;
        this.currentPhrase = phraseId;
        console.log('🎯 ChallengeManager: DEBUG - Set this.currentPhrase to:', this.currentPhrase);

        // CREATE FRESH ATTEMPT FOR THIS PHRASE
        this.userProgress.createFreshAttempt(phraseId);
        console.log('🎯 ChallengeManager: Fresh attempt created for:', phraseId);
        
        const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
        
        // Use LOCKED text level, not current level
        const roundState = this.userProgress.data.roundState;
        const lockedTextLevel = roundState.lockedTextLevels[textId];
        
        console.log(`🎯 ChallengeManager: Text ${textId} locked level: ${lockedTextLevel}`);
        
        // Determine challenge level based on LOCKED level
        this.currentLevel = lockedTextLevel === 1 ? 'LEVEL_1' : 'LEVEL_2';
        console.log('🎯 ChallengeManager: Current level:', this.currentLevel);
        console.log('🎯 ChallengeManager: Available recipes:', Object.keys(this.recipes));
        console.log('🎯 ChallengeManager: Recipe for level:', this.recipes[this.currentLevel]);

        this.currentRecipe = this.recipes[this.currentLevel];
        console.log(`🎯 ChallengeManager: Recipe set to:`, this.currentRecipe);
        
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
        console.log('🎯 ChallengeManager: Challenge completed successfully!');
        
        // Continue with next challenge
        this.createChallenge();
    }

    
    // Handle incorrect answer
    handleIncorrectAnswer() {
        console.log('🎯 ChallengeManager: Handling incorrect answer...');
        console.log('🎯 ChallengeManager: DEBUG - this.currentPhrase:', this.currentPhrase);
        console.log('🎯 ChallengeManager: DEBUG - typeof this.currentPhrase:', typeof this.currentPhrase);
        console.log('🎯 ChallengeManager: DEBUG - this.currentPhrase === undefined:', this.currentPhrase === undefined);
        this.eventBus.emit('challenge:wrongAnswer', this.currentPhrase);
    }



    // Get locked text level (or lock it if first encounter)
    getLockedTextLevel(textId) {
        if (!this.textCurrentLevels[textId]) {
            // First encounter - lock the current level
            this.textCurrentLevels[textId] = this.userProgress.getTextLevel(textId);
            this.currentRoundTexts.add(textId);
            console.log(`🔒 ChallengeManager: Locked ${textId} at level ${this.textCurrentLevels[textId]} for this round`);
        }
        return this.textCurrentLevels[textId];
    }

    startNewRound() {
        console.log('🎯 ChallengeManager: Starting new round - resetting completion tracking');
        
        // Clear the session attempts to reset "completed" status for new round
        this.userProgress.sessionData.attemptsByText = {};
        
        // Lock text levels for the new round
        this.lockTextLevelsForRound();
        
        console.log('🎯 ChallengeManager: Round completion tracking reset and levels locked');
    }

    // End round for a specific text
    endRoundForText(textId) {
        if (this.textCurrentLevels[textId]) {
            console.log(`🏁 ChallengeManager: Ending round for ${textId} - releasing level lock`);
            delete this.textCurrentLevels[textId];
            this.currentRoundTexts.delete(textId);
        }
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
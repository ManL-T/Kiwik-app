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
            this.expandChallengePool('levelUp', textId);
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

    getCurrentPhraseId() {
        console.log('🎯 ChallengeManager: Finding next available phrase using challenge flow...');
        
        // Get challenge flow data from UserProgress
        const challengeFlow = this.userProgress.data.challengeFlow;
        const { activeTexts, currentTextIndex } = challengeFlow;
        
        console.log('🎯 ChallengeManager: Current flow state:', challengeFlow);
        console.log('🎯 ChallengeManager: Active texts:', activeTexts);
        console.log('🎯 ChallengeManager: Current text index:', currentTextIndex);
        console.log('🎯 ChallengeManager: Last completed phrase:', this.currentPhrase);
        
        // Cycle through active texts starting from current position
        for (let i = 0; i < activeTexts.length; i++) {
            const textIndex = (currentTextIndex + i) % activeTexts.length;
            const textId = activeTexts[textIndex];
            
            console.log(`🎯 ChallengeManager: Checking ${textId} for available phrases`);
            
            const isTextMasteredResult = this.userProgress.isTextMastered(textId);
            console.log(`🎯 ChallengeManager: ${textId} isTextMastered result: ${isTextMasteredResult}`);
            
            // Skip fully mastered texts
            if (isTextMasteredResult) {
                console.log(`🎯 ChallengeManager: Skipping ${textId} - fully mastered`);
                continue;
            }
            
            // Get available phrases for this text (filtered by text level)
            const availablePhrases = this.getAvailablePhrasesForText(textId);
            
            if (availablePhrases.length > 0) {
                let nextPhrase;
                
                // FIX: Find next phrase in sequence after the last completed phrase
                if (this.currentPhrase && this.currentPhrase.startsWith(textId + '_')) {
                    // We're continuing in the same text - find next phrase after current one
                    const currentPhraseIndex = availablePhrases.indexOf(this.currentPhrase);
                    
                    if (currentPhraseIndex >= 0 && currentPhraseIndex < availablePhrases.length - 1) {
                        // Move to next phrase in the same text
                        nextPhrase = availablePhrases[currentPhraseIndex + 1];
                        console.log(`🎯 ChallengeManager: Moving to next phrase in ${textId}: ${nextPhrase}`);
                    } else {
                        // Current phrase was last in this text, or not found - start from beginning
                        nextPhrase = availablePhrases[0];
                        console.log(`🎯 ChallengeManager: Starting from first phrase in ${textId}: ${nextPhrase}`);
                    }
                } else {
                    // Different text or no previous phrase - start from first available
                    nextPhrase = availablePhrases[0];
                    console.log(`🎯 ChallengeManager: Starting with first available phrase in ${textId}: ${nextPhrase}`);
                }
                
                console.log(`🎯 ChallengeManager: Found next phrase: ${nextPhrase}`);
                
                // Update current text index in UserProgress data
                this.updateChallengeFlowPosition(textIndex);
                
                return nextPhrase;
            } else {
                console.log(`🎯 ChallengeManager: ${textId} has no available phrases`);
            }
        }
        
        console.log('🎯 ChallengeManager: No available phrases in active texts - game complete?');
        return null;
    }

    getAvailablePhrasesForText(textId) {
        console.log(`🎯 ChallengeManager: Getting available phrases for ${textId}`);
        
        // Get all phrases for this text
        const textPhrases = this.gameData.getPhrasesForText(textId);
        const textLevel = this.userProgress.getTextLevel(textId);
        
        console.log(`🎯 ChallengeManager: ${textId} is at level ${textLevel}, has ${textPhrases.length} total phrases`);
        
        // FIX: Add detailed logging for each phrase filtering decision
        const availablePhrases = textPhrases
            .filter(phrase => {
                const phraseLevel = this.userProgress.getPhraseLevel(phrase.phraseId);
                
                console.log(`🎯 ChallengeManager: Checking phrase ${phrase.phraseId} - level: ${phraseLevel}, text level: ${textLevel}`);
                
                // Skip mastered phrases
                if (phraseLevel === 'mastered') {
                    console.log(`🎯 ChallengeManager: Skipping ${phrase.phraseId} - mastered`);
                    return false;
                }
                
                // Skip phrases that are above the text's current level
                if (typeof phraseLevel === 'number' && phraseLevel > textLevel) {
                    console.log(`🎯 ChallengeManager: Skipping ${phrase.phraseId} - phrase level ${phraseLevel} > text level ${textLevel}`);
                    return false;
                }
                
                console.log(`🎯 ChallengeManager: Including ${phrase.phraseId} - available for play`);
                return true;
            })
            .map(phrase => phrase.phraseId);
        
        console.log(`🎯 ChallengeManager: ${textId} has ${availablePhrases.length} available phrases:`, availablePhrases);
        return availablePhrases;
    }

    updateChallengeFlowPosition(newTextIndex) {
        console.log(`🎯 ChallengeManager: Updating challenge flow position to text index ${newTextIndex}`);
        
        this.userProgress.data.challengeFlow.currentTextIndex = newTextIndex;
        this.userProgress.saveUserProgress();
        
        console.log('🎯 ChallengeManager: Challenge flow position updated and saved');
    }

    expandChallengePool(reason, triggerTextId = null) {
        console.log(`🎯 ChallengeManager: Expanding challenge pool - reason: ${reason}, trigger: ${triggerTextId}`);
        
        const challengeFlow = this.userProgress.data.challengeFlow;
        const currentRound = challengeFlow.currentRound;
        
        console.log(`🎯 ChallengeManager: Current round: ${currentRound}`);
        console.log(`🎯 ChallengeManager: Current pool:`, challengeFlow.activeTexts);
        
        let newTextsToAdd = [];
        
        if (reason === 'levelUp') {
            // Always add one text for level up
            const nextTextId = this.getNextAvailableTextId();
            if (nextTextId) {
                newTextsToAdd.push(nextTextId);
                console.log(`🎯 ChallengeManager: Adding ${nextTextId} for text level up`);
            }
        } else if (reason === 'roundTwo') {
            // Round 2 gets guaranteed expansion
            const nextTextId = this.getNextAvailableTextId();
            if (nextTextId) {
                newTextsToAdd.push(nextTextId);
                console.log(`🎯 ChallengeManager: Adding ${nextTextId} for round 2 expansion`);
            }
        }
        
        // Add new texts to active pool
        if (newTextsToAdd.length > 0) {
            challengeFlow.activeTexts.push(...newTextsToAdd);
            console.log(`🎯 ChallengeManager: Pool expanded to:`, challengeFlow.activeTexts);
            this.userProgress.saveUserProgress();
        } else {
            console.log(`🎯 ChallengeManager: No new texts to add`);
        }
    }

    getNextAvailableTextId() {
        const allTexts = this.gameData.getAllTexts();
        const activeTexts = this.userProgress.data.challengeFlow.activeTexts;
        
        // Find first text not in active pool
        for (const text of allTexts) {
            if (!activeTexts.includes(text.textId)) {
                console.log(`🎯 ChallengeManager: Next available text: ${text.textId}`);
                return text.textId;
            }
        }
        
        console.log(`🎯 ChallengeManager: No more texts available for expansion`);
        return null; // No more texts available
    }


    
    // Create a new challenge (entry point) - now with text cover integration
    createChallenge() {
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
        
        // FIX: Add level detection logic that was missing
        const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
        const textLevel = this.userProgress.getTextLevel(textId);
        console.log(`🎯 ChallengeManager: Text ${textId} is at level ${textLevel}`);
        
        // Determine challenge level and recipe
        this.currentLevel = textLevel === 1 ? 'LEVEL_1' : 'LEVEL_2';
        this.currentRecipe = this.recipes[this.currentLevel];
        
        console.log(`🎯 ChallengeManager: Challenge level set to: ${this.currentLevel}`);
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
        
        // Check if current text has more available phrases
        this.checkTextCompletionAndAdvance();
        
        // Continue with next challenge
        this.createChallenge();
    }

    checkTextCompletionAndAdvance() {
        console.log('🎯 ChallengeManager: Checking text completion and advance logic');
        
        const challengeFlow = this.userProgress.data.challengeFlow;
        const { activeTexts, currentTextIndex } = challengeFlow;
        const currentTextId = activeTexts[currentTextIndex];
        
        console.log(`🎯 ChallengeManager: Current text: ${currentTextId}`);
        console.log(`🎯 ChallengeManager: Just completed phrase: ${this.currentPhrase}`);
        
        // Check if current text has more available phrases
        const availablePhrases = this.getAvailablePhrasesForText(currentTextId);
        console.log(`🎯 ChallengeManager: Available phrases in ${currentTextId}:`, availablePhrases);
        
        // Check if we just completed the last phrase in this text
        if (this.currentPhrase && this.currentPhrase.startsWith(currentTextId + '_')) {
            const currentPhraseIndex = availablePhrases.indexOf(this.currentPhrase);
            const isLastPhrase = currentPhraseIndex >= 0 && currentPhraseIndex === availablePhrases.length - 1;
            
            console.log(`🎯 ChallengeManager: Current phrase index: ${currentPhraseIndex}, is last phrase: ${isLastPhrase}`);
            
            if (availablePhrases.length === 0 || isLastPhrase) {
                console.log(`🎯 ChallengeManager: ${currentTextId} exhausted - advancing to next text`);
                
                // Move to next text in cycle
                const nextTextIndex = (currentTextIndex + 1) % activeTexts.length;
                challengeFlow.currentTextIndex = nextTextIndex;
                
                // Check if we completed a full cycle (back to index 0)
                if (nextTextIndex === 0) {
                    this.completeRound();
                }
                
                challengeFlow.lastCompletedTextId = currentTextId;
                this.userProgress.saveUserProgress();
                
                console.log(`🎯 ChallengeManager: Advanced to text index ${nextTextIndex} (${activeTexts[nextTextIndex]})`);
            } else {
                console.log(`🎯 ChallengeManager: ${currentTextId} has more phrases - staying on same text`);
            }
        } else {
            console.log(`🎯 ChallengeManager: Phrase from different text or no current phrase - no advancement needed`);
        }
    }

    completeRound() {
        console.log('🎯 ChallengeManager: Completing round', this.userProgress.data.challengeFlow.currentRound);
        
        this.userProgress.data.challengeFlow.currentRound++;
        const newRound = this.userProgress.data.challengeFlow.currentRound;
        
        // Special logic for round 2
        if (newRound === 2) {
            console.log('🎯 ChallengeManager: Starting round 2 - guaranteed expansion');
            this.expandChallengePool('roundTwo');
        }
        
        console.log(`🎯 ChallengeManager: Now starting round ${newRound}`);
        this.userProgress.saveUserProgress();
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
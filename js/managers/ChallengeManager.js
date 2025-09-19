// js/managers/ChallengeManager.js - Updated with UserProgress Integration
class ChallengeManager {
    constructor(eventBus, uiRenderer, gameData, UserProgress) {
        console.log(`🎯 ChallengeManager: [${new Date().toISOString()}] Initializing with UserProgress integration...`);
        
        // Store references
        this.eventBus = eventBus;
        this.uiRenderer = uiRenderer;
        this.gameData = gameData;
        this.UserProgress = UserProgress;
        
        // Assembly recipes for different challenge levels
        this.recipes = {
            LEVEL_1: ['Presentation', 'Revision', 'ReadyOrNot', 'Solution'],
            LEVEL_2: ['Presentation', 'Retrieval', 'ReadyOrNot', 'Solution'],
            LEVEL_3: ['Solution']
        };

        this.stageSystem = {
            currentTexts: ['text_1', 'text_2', 'text_3'],  // Texts in current stage
            stageNumber: 1,
            newTextsAddedThisStage: 0,
            maxNewTextsPerStage: 1
        };

        // Stage management
        this.textCurrentLevels = {}; // Locked levels for current stage per text
        this.currentStageTexts = new Set(); // Tracks which texts are in current stage
        
        // Current challenge state
        this.currentRecipe = null;
        this.currentPhaseIndex = 0;
        this.currentPhrase = null;
        this.challengeData = null;
        this.newTextsAddedThisStage = 0;
        
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

        // Round state tracking (prevents consecutive phrase repetition)
        this.currentRoundPlayedPhrases = new Set();
        
        // Initialization coordination flags (following project pattern)
        this.gameDataReady = false;
        this.userProgressReady = false;
        this.initializationComplete = false;

        // Current attempt tracking
        this.currentAttempt = {
            wasSkipped: false,
            hasIncorrectAnswers: false,
            hasCorrectAnswer: false
        };
        
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
            // this.eventBus.emit('userProgress:phraseSkipped', this.currentPhrase);
            this.currentAttempt.wasSkipped = true; // ✅ Just track it
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

            // NOW determine the final outcome
            if (this.currentAttempt.wasSkipped && !this.currentAttempt.hasIncorrectAnswers) {
                // Skipped cleanly = mastered
                this.eventBus.emit('userProgress:phraseMastered', this.currentPhrase);
            } else if (!this.currentAttempt.hasIncorrectAnswers) {
                // Normal correct progression
                this.eventBus.emit('userProgress:phraseCorrect', this.currentPhrase);
            }
            // If has incorrect answers, no progression (already handled)

            this.handleChallengeComplete();

        });
        
        this.eventBus.on('solution:incorrect', () => {
            console.log('🎯 ChallengeManager: DEBUG - solution:incorrect received, currentPhrase is:', this.currentPhrase);
            this.currentAttempt.hasIncorrectAnswers = true;
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
            const resumePosition = this.UserProgress.getResumePosition();
            const allTexts = this.gameData.getAllTexts();
            const startIndex = allTexts.findIndex(t => t.textId === resumePosition.startTextId);
            this.currentTextIndex = startIndex >= 0 ? startIndex : 0;
            console.log(`🎯 ChallengeManager: Starting from ${resumePosition.startTextId} at index ${this.currentTextIndex}`);
        });
        
        // OPTION B: Check current state immediately (established pattern)
        const timestamp = new Date().toISOString();
        console.log(`🎯 ChallengeManager: [${timestamp}] Checking if UserProgress is already ready...`);
        if (this.UserProgress && this.UserProgress.isReady) {
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

    // gets the id of the phrase that's about to be used?
    getCurrentPhraseId() {
        console.log('🎯 ChallengeManager: Finding next phrase with simple logic...');
        
        const stageState = this.UserProgress.data.stageState;
        const { activeTexts, currentTextIndex } = stageState;
        
        console.log('🎯 ChallengeManager: Current stage state:', stageState);
        
        // Get current text
        const currentTextId = activeTexts[currentTextIndex];
        console.log('🎯 ChallengeManager: Current text:', currentTextId);
        
        // Get all phrases for current text in sequential order
        const allPhrasesInText = this.gameData.getPhrasesForText(currentTextId);
        console.log('🎯 ChallengeManager: All phrases in', currentTextId + ':', allPhrasesInText.map(p => p.phraseId));
        
        // Filter out phrases already played in current round
        const unplayedInCurrentRound = allPhrasesInText.filter(phrase => 
            !this.currentRoundPlayedPhrases.has(phrase.phraseId)
        );

        console.log('🎯 ChallengeManager: Phrases played this round:', Array.from(this.currentRoundPlayedPhrases));
        console.log('🎯 ChallengeManager: Unplayed phrases in current round:', unplayedInCurrentRound.map(p => p.phraseId));

        // Find first incomplete phrase from unplayed phrases
        for (const phrase of unplayedInCurrentRound) {
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

    lockTextLevelsForStage() {
        console.log(`🎯 ChallengeManager: Locking text levels for stage ${this.stageSystem.stageNumber}...`);
        
        const stageState = this.UserProgress.data.stageState;
        stageState.lockedTextLevels = {};
        
        // Lock current level for each text in the stage
        this.stageSystem.currentTexts.forEach(textId => {
            const currentLevel = this.UserProgress.getTextLevel(textId);
            stageState.lockedTextLevels[textId] = currentLevel;
            console.log(`🎯 ChallengeManager: Locked ${textId} at level ${currentLevel} for stage ${this.stageSystem.stageNumber}`);
        });
        
        // Sync UserProgress stageState with ChallengeManager stageSystem
        stageState.activeTexts = [...this.stageSystem.currentTexts];
        stageState.currentStage = this.stageSystem.stageNumber;
        
        this.UserProgress.saveUserProgress();
    }

    // New method: advance to next text in sequence
    advanceToNextText() {
        // Clear round state for new text/round
        this.currentRoundPlayedPhrases.clear();
        console.log('🎯 ChallengeManager: Cleared round state for new text/round');

        console.log('🎯 ChallengeManager: Advancing to next text...');
        
        const stageState = this.UserProgress.data.stageState;
        const oldTextIndex = stageState.currentTextIndex;
        const oldTextId = stageState.activeTexts[oldTextIndex];

        // Get the level that was just completed (locked level for this stage)
        const completedLevel = stageState.lockedTextLevels[oldTextId];


        // Increment round count for completed text
        this.UserProgress.incrementRoundForText(oldTextId, completedLevel);
        
        // Move to next text
        stageState.currentTextIndex = (stageState.currentTextIndex + 1) % stageState.activeTexts.length;
        
        const newTextIndex = stageState.currentTextIndex;
        const newTextId = stageState.activeTexts[newTextIndex];
        
        console.log(`🎯 ChallengeManager: Advanced from ${oldTextId} (index ${oldTextIndex}) to ${newTextId} (index ${newTextIndex})`);
        
        // If we're back to index 0, we completed a stage
        if (newTextIndex === 0) {
            stageState.currentStage++;
            console.log(`🎯 ChallengeManager: Stage completed! Starting stage ${stageState.currentStage}`);
            
            // CRITICAL FIX: Reset completion tracking for new stage
            this.startNewStage();
        }
        
        // Save the updated state
        this.UserProgress.saveUserProgress();
    }

    // check if phrase is completed (for this stage)
    isPhraseCompleted(phraseId) {
        console.log(`🎯 ChallengeManager: Checking if ${phraseId} is completed for current stage...`);
        
        const textId = this.extractTextId(phraseId);
        
        // Use LOCKED text level, not current level
        const stageState = this.UserProgress.data.stageState;
        const lockedTextLevel = stageState.lockedTextLevels[textId];
        const phraseLevel = this.UserProgress.getPhraseLevel(phraseId);
        
        console.log(`🎯 ChallengeManager: ${phraseId} - phrase level: ${phraseLevel}, locked text level: ${lockedTextLevel}`);
        
        // Condition 1: Mastered phrases are always completed
        if (phraseLevel === 'mastered') {
            console.log(`🎯 ChallengeManager: ${phraseId} is mastered - completed`);
            return true;
        }
        
        // Condition 2: Phrases above text level are completed for this stage
        if (typeof phraseLevel === 'number' && phraseLevel > lockedTextLevel) {
            console.log(`🎯 ChallengeManager: ${phraseId} level ${phraseLevel} > text level ${lockedTextLevel} - completed`);
            return true;
        }
        
        // Condition 3: Already played in current session
        const sessionData = this.UserProgress.sessionData;
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
        console.log(`🎯 ChallengeManager: ${textId} leveled up from ${oldLevel} to ${newLevel} - checking stage limits`);
        
        // Check if we've already added the maximum number of texts this stage
        if (this.stageSystem.newTextsAddedThisStage >= this.stageSystem.maxNewTextsPerStage) {
            console.log(`🎯 ChallengeManager: Already added ${this.stageSystem.newTextsAddedThisStage} text(s) in stage ${this.stageSystem.stageNumber} - skipping addition`);
            return;
        }
        
        // Get next available text to add
        const nextTextId = this.getNextAvailableText();
        
        if (nextTextId) {
            // Add to current stage
            this.stageSystem.currentTexts.push(nextTextId);
            console.log(`🎯 ChallengeManager: Added ${nextTextId} to stage ${this.stageSystem.stageNumber}`);
            
            // Update UserProgress stageState to match
            const stageState = this.UserProgress.data.stageState;
            stageState.activeTexts = [...this.stageSystem.currentTexts];
            
            // Lock the new text's level for this stage
            const newTextLevel = this.UserProgress.getTextLevel(nextTextId);
            stageState.lockedTextLevels[nextTextId] = newTextLevel;
            console.log(`🎯 ChallengeManager: Locked ${nextTextId} at level ${newTextLevel} for stage ${this.stageSystem.stageNumber}`);
            
            // Increment the counter
            this.stageSystem.newTextsAddedThisStage++;
            console.log(`🎯 ChallengeManager: Stage ${this.stageSystem.stageNumber} now has texts:`, this.stageSystem.currentTexts);
            console.log(`🎯 ChallengeManager: New texts added this stage: ${this.stageSystem.newTextsAddedThisStage}`);
            
            // Save changes
            this.UserProgress.saveUserProgress();
        } else {
            console.log(`🎯 ChallengeManager: No more texts available to add to stage ${this.stageSystem.stageNumber}`);
        }
    }

    getNextAvailableText() {
        const allTexts = this.gameData.getAllTexts();
        const activeTexts = this.UserProgress.data.stageState.activeTexts;
        
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
        const stageState = this.UserProgress.data.stageState;
        if (!stageState.lockedTextLevels || Object.keys(stageState.lockedTextLevels).length === 0) {
            console.log('🎯 ChallengeManager: First challenge - locking text levels for stage');
            this.lockTextLevelsForStage();
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

    resetAttemptTracking() {
        this.currentAttempt = {
            wasSkipped: false,
            hasIncorrectAnswers: false,
            hasCorrectAnswer: false
        };
    }

    shouldShowTextCover(textId) {
        console.log(`🎯 ChallengeManager: Checking text cover - lastTextId: ${this.lastTextId}, currentTextId: ${textId}`);
        
        // Don't show for fully mastered texts
        if (this.UserProgress.isTextMastered(textId)) {
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
        
        // Collect data for dynamic text cover
        const textCoverData = this.collectTextCoverData(textId);
        
        this.eventBus.emit('ui:loadTextCover', { textId, data: textCoverData });
    }

    collectTextCoverData(textId) {
        console.log('🎯 ChallengeManager: Collecting text cover data for:', textId);
        
        // Get round display data
        const roundDisplayData = this.UserProgress.getTextRoundDisplay(textId);
        const level = roundDisplayData.level;
        const round = roundDisplayData.round;
        
        // Extract text number from textId (e.g., "text_5" → "5")
        const textNumber = textId.split('_')[1];
                
        // Get text info
        const textData = this.gameData.getTextById(textId);
        const title = textData ? textData.title : textId.replace('_', ' ').toUpperCase();
        
        // Get all phrases for this text
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        
        // Generate phrases with status
        const phrasesData = allPhrasesInText.map(phrase => {
            const phraseLevel = this.UserProgress.getPhraseLevel(phrase.phraseId);
            const status = this.determinePhraseStatus(phraseLevel, level, round);
            const icon = this.getStatusIcon(status);
            
            return {
                text: phrase.phraseTarget,
                status: status,
                icon: icon
            };
        });
        
        const data = {
            text_number: textNumber,  // NEW: Add text number
            level: level,
            round: round,
            title: title,
            phrases: phrasesData
        };
        
        console.log('🎯 ChallengeManager: Text cover data collected:', data);
        return data;
    }

    // New method to determine phrase status
    determinePhraseStatus(phraseLevel, lockedTextLevel, currentRound) {
         // On round 1, show no icons - clean display
        if (currentRound === 1) {
            return 'untested';
        }

        if (phraseLevel === 'mastered') {
            return 'mastered';
        }
        
        if (typeof phraseLevel === 'number' && phraseLevel > lockedTextLevel) {
            return 'completed';
        }
        
        return 'pending';
    }

    // New method to get status icon
    getStatusIcon(status) {
        const iconMap = {
            'untested': '',      // No icon for round 1
            'pending': '❌',
            'completed': '✅', 
            'mastered': 'M'
        };
        
        return iconMap[status] || '';
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

        this.resetAttemptTracking();
        
        // CREATE FRESH ATTEMPT FOR THIS PHRASE
        this.UserProgress.createFreshAttempt(phraseId);
        console.log('🎯 ChallengeManager: Fresh attempt created for:', phraseId);

        // Track that this phrase is now played in current round
        this.currentRoundPlayedPhrases.add(phraseId);
        console.log('🎯 ChallengeManager: Added', phraseId, 'to current round. Round phrases:', Array.from(this.currentRoundPlayedPhrases));
                
        const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
        
        // Use LOCKED text level, not current level
        const stageState = this.UserProgress.data.stageState;
        const lockedTextLevel = stageState.lockedTextLevels[textId];
        
        console.log(`🎯 ChallengeManager: Text ${textId} locked level: ${lockedTextLevel}`);
        
        // Determine challenge level based on LOCKED level
        if (lockedTextLevel === 1) {
            this.currentLevel = 'LEVEL_1';
        } else if (lockedTextLevel === 2) {
            this.currentLevel = 'LEVEL_2';
        } else if (lockedTextLevel === 3) {
            this.currentLevel = 'LEVEL_3';
        }
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
                // If Level 3, send reversed data
                // If Levels 1 & 2, send normal data
                phraseTarget: this.currentLevel === 'LEVEL_3' ? 
                    this.challengeData.primaryTranslation : 
                    this.challengeData.phraseTarget,
                primaryTranslation: this.currentLevel === 'LEVEL_3' ? 
                    this.challengeData.phraseTarget : 
                    this.challengeData.primaryTranslation,
                distractors: this.currentLevel === 'LEVEL_3' ? 
                    this.challengeData.targetDistractors : 
                    this.challengeData.distractors
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
            this.textCurrentLevels[textId] = this.UserProgress.getTextLevel(textId);
            this.currentStageTexts.add(textId);
            console.log(`🔒 ChallengeManager: Locked ${textId} at level ${this.textCurrentLevels[textId]} for this stage`);
        }
        return this.textCurrentLevels[textId];
    }

    startNewStage() {
        console.log(`🎯 ChallengeManager: Stage ${this.stageSystem.stageNumber} completed! Starting stage ${this.stageSystem.stageNumber + 1}`);
        
        // Increment stage count in UserProgress BEFORE updating internal counter
        if (this.UserProgress.data.currentGame) {
            this.UserProgress.data.currentGame.stages++;
            console.log(`🎯 ChallengeManager: Incremented stage count to ${this.UserProgress.data.currentGame.stages} for game ${this.UserProgress.data.currentGame.gameNumber}`);
        }
        
        // Create new stage inheriting all texts from previous stage
        this.stageSystem = {
            currentTexts: [...this.stageSystem.currentTexts], // Keep all texts
            stageNumber: this.stageSystem.stageNumber + 1,
            newTextsAddedThisStage: 0, // Reset counter
            maxNewTextsPerStage: 1
        };
        
        console.log(`🎯 ChallengeManager: Stage ${this.stageSystem.stageNumber} starting with texts:`, this.stageSystem.currentTexts);
        
        // Clear the session attempts to reset "completed" status for new stage
        this.UserProgress.sessionData.attemptsByText = {};

        // add analytics event for new stage start
        this.eventBus.emit('analytics:stageStarted', {
            stageNumber: this.stageSystem.stageNumber,
            activeTexts: [...this.stageSystem.currentTexts],
            lockedTextLevels: {...this.UserProgress.data.stageState.lockedTextLevels}
        });
        
        // Lock text levels for the new stage
        this.lockTextLevelsForStage();
        
        console.log(`🎯 ChallengeManager: Stage ${this.stageSystem.stageNumber} initialization complete`);
    }

    // End stage for a specific text
    endStageForText(textId) {
        if (this.textCurrentLevels[textId]) {
            console.log(`🏁 ChallengeManager: Ending stage for ${textId} - releasing level lock`);
            delete this.textCurrentLevels[textId];
            this.currentStageTexts.delete(textId);
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
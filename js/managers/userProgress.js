// js/managers/UserProgress.js - Phase 1: Add New Systems
class UserProgress {
    constructor(eventBus, gameData) {
        console.log(`📊 UserProgress: [${new Date().toISOString()}] Initializing user progress???`);
        
        // Store references
        this.eventBus = eventBus;
        this.gameData = gameData;
        
        // localStorage key
        this.storageKey = 'kiwik_userProgress';
        
        // Content tracking
        this.currentContentId = null;
        this.allContentData = {}; // Will hold all content progress data
        this.data = null; // Current content data reference
        
        // Ready state
        this.isReady = false;

        // Current attempt tracking (temporary, per-phrase)
        this.currentAttempt = null;

        // Session data (accumulates during gameplay)
        this.sessionData = {
            startTime: new Date().toISOString(),
            endTime: null,
            lastActiveText: null,
            attemptsByText: {},  // Will accumulate all attempts grouped by text
            currentLevels: {}    // Will track level changes during session
        };

        // Setup event listeners
        this.setupEventListeners();
        
        // Load or initialize progress
        this.loadUserProgress();
        
        // Mark as ready and emit event (following project pattern)
        // this.isReady = true;
        // this.eventBus.emit('userProgress:ready');
        
        console.log(`✅ UserProgress: [${new Date().toISOString()}] Batch cycling support complete and ready`);
    }
    
    // Setup event listeners
    setupEventListeners() {
        console.log('📊 UserProgress: Setting up event listeners...');
        
        // Wait for GameData to load before initializing phrases
        this.eventBus.on('gameData:loaded', (projectMetadata) => {
            console.log('📊 UserProgress: GameData loaded, initializing phrase progress...');
            this.setCurrentContent(projectMetadata);
            this.initializePhraseProgress();

            // NOW mark as ready and emit event
            this.isReady = true;
            this.eventBus.emit('userProgress:ready');
            console.log(`✅ UserProgress: Ready for content: ${this.currentContentId}`);
        });
        
        // Handle game start
        this.eventBus.on('userProgress:gameStarted', () => {
            console.log('📊 UserProgress: Game started');
            this.initializeNewSession();
        });

        // Track skipped phrases
        this.eventBus.on('userProgress:phraseSkipped', (phraseId) => {
            console.log(`📊 UserProgress: Phrase skipped: ${phraseId}`);
            this.markCurrentAttemptSkipped();
        });

        // Track incorrect attempts  
        this.eventBus.on('challenge:wrongAnswer', (phraseId) => {
            console.log(`📊 UserProgress: Wrong answer for: ${phraseId}`);
            this.incrementCurrentAttemptIncorrect();
        });

        // Track correct answers and complete attempt
        this.eventBus.on('userProgress:correctAnswer', (phraseId) => {
            console.log(`📊 UserProgress: Correct answer for: ${phraseId}`);
            this.markCurrentAttemptCorrect();
            this.completeCurrentAttempt();
        });

        // Track text level ups for current game
        this.eventBus.on('userProgress:textLeveledUp', (data) => {
            if (this.data.currentGame) {
                this.data.currentGame.levelUps++;
                console.log(`📊 UserProgress: Level up tracked for game ${this.data.currentGame.gameNumber}. Total: ${this.data.currentGame.levelUps}`);
            }
        });

        // Save session on game over
        this.eventBus.on('userProgress:saveProgress', () => {
            this.saveCompletedSession();
        });

    }

    // NEW: Set current content and switch data context
    setCurrentContent(projectMetadata) {
        this.currentContentId = projectMetadata.title;
        console.log(`📊 UserProgress: Switched to content: ${this.currentContentId}`);
        
        // Initialize content data if doesn't exist
        if (!this.allContentData[this.currentContentId]) {
            console.log(`📊 UserProgress: Creating fresh data for new content: ${this.currentContentId}`);
            this.allContentData[this.currentContentId] = this.createFreshProgressData();
        }
        
        // Set current data reference to this content
        this.data = this.allContentData[this.currentContentId];
        console.log(`📊 UserProgress: Data context set for ${this.currentContentId}:`, this.data);
    }

// 1. Update createFreshProgressData() in UserProgress.js to include new tracking
createFreshProgressData() {
    console.log('📊 UserProgress: Creating fresh progress data structure...');
    
    return {
        gamesPlayed: 0,
        phraseProgress: {},
        textLevels: {},
        stageState: {
            activeTexts: [],
            currentStage: 1,
            currentTextIndex: 0,
            lastCompletedTextId: null,
            lockedTextLevels: {
                'text_1': 1,
                'text_2': 1, 
                'text_3': 1
            }
        },
        textStats: {},
        // NEW: Game tracking data
        gamesHistory: [],
        currentGame: null,
        lastStage: null
    };
    
    console.log('📊 UserProgress: Fresh data created:', this.data);
}

// 2. Update initializeNewSession() to start game tracking
initializeNewSession() {
    console.log('📊 UserProgress: Initializing new session');
    
    // Increment games played
    this.data.gamesPlayed++;
    
    // Start new game tracking
    this.data.currentGame = {
        gameNumber: this.data.gamesPlayed,
        stages: 0,
        textsPlayed: 0,
        levelUps: 0
    };
    
    // Load levels from previous session if exists
    const resumeData = this.loadLevelsFromLastSession();
    
    // Reset session data for new session
    this.sessionData = {
        startTime: new Date().toISOString(),
        endTime: null,
        lastActiveText: resumeData.lastActiveText || null,
        attemptsByText: {},
        currentLevels: {},
        textsPlayedThisGame: new Set() // Track which texts we've played this game
    };
    
    console.log('📊 UserProgress: New game started:', this.data.currentGame);
}

    loadLevelsFromLastSession() {
        const sessions = this.loadSessionHistory();
        if (!sessions || sessions.length === 0) {
            console.log('📊 UserProgress: No previous sessions to load from');
            return {};
        }
        
        const lastSession = sessions[sessions.length - 1];
        
        // ONLY load the resume position, NOT the phrase/text levels
        return {
            lastActiveText: lastSession.lastActiveText
            // Remove all the level loading logic - let phrases stay at their initialized levels
        };
    }
    
    // Load progress from localStorage or create default
    loadUserProgress() {
        console.log('📊 UserProgress: Loading user progress from localStorage...');
        
        try {
            const stored = localStorage.getItem(this.storageKey);
            console.log('📊 UserProgress: Raw localStorage data:', stored);
            
            if (stored) {
                const parsedData = JSON.parse(stored);
                console.log('📊 UserProgress: Parsed localStorage data:', parsedData);
                
                // Check if it's the new multi-content structure
                if (this.isMultiContentData(parsedData)) {
                    this.allContentData = parsedData;
                    console.log('✅ UserProgress: Loaded existing multi-content data');
                } else {
                    // Legacy single-content data - clear it as requested
                    console.log('📊 UserProgress: Found legacy data - clearing as requested');
                    this.allContentData = {};
                }
            } else {
                console.log('📊 UserProgress: No existing data');
                this.allContentData = {};
            }
            
        } catch (error) {
            console.error('❌ UserProgress: Error loading progress:', error);
            this.allContentData = {};
        }
    }

    // Validate progress data structure
    isValidProgressData(data) {
        console.log('📊 UserProgress: Validating data structure...');
        
        const isValid = data && 
                    typeof data.gamesPlayed === 'number' &&
                    data.phraseProgress &&
                    typeof data.phraseProgress === 'object';
                    
        console.log('📊 UserProgress: Data validation result:', isValid);
        return isValid;
    }

    // Check if data is the new multi-content structure
    isMultiContentData(data) {
        // Multi-content data should have content names as top-level keys
        // and each should contain the expected progress structure
        if (!data || typeof data !== 'object') return false;
        
        // Check if any top-level key contains a valid progress structure
        const keys = Object.keys(data);
        if (keys.length === 0) return false;
        
        // Sample first key to see if it has progress structure
        const firstKey = keys[0];
        const firstContent = data[firstKey];
        
        return firstContent && 
               typeof firstContent.gamesPlayed === 'number' &&
               firstContent.phraseProgress &&
               typeof firstContent.phraseProgress === 'object';
    }
    
    // NEW: Initialize new systems if missing from existing data
    initializeNewSystems() {
        console.log('📊 UserProgress: Checking for new systems in existing data...');
        
        let needsSave = false;

        // add Game History data
        if (!this.data.gamesHistory) {
            console.log('📊 UserProgress: Adding gamesHistory system to existing data');
            this.data.gamesHistory = [];
            needsSave = true;
        }

        // add current Game data
        if (!this.data.currentGame) {
            console.log('📊 UserProgress: Adding currentGame system to existing data');  
            this.data.currentGame = null;
            needsSave = true;
        }

        // add last stage data
        if (!this.data.lastStage) {
            console.log('📊 UserProgress: Adding lastStage system to existing data');
            this.data.lastStage = null;
            needsSave = true;
        }
        
        // Add text level tracking if missing
        if (!this.data.textLevels) {
            console.log('📊 UserProgress: Adding textLevels system to existing data');
            this.data.textLevels = {};
            needsSave = true;
        }

        // Add textStats tracking if missing
        if (!this.data.textStats) {
            console.log('📊 UserProgress: Adding textStats tracking to existing data');
            this.data.textStats = {};
            needsSave = true;
        }

        // RENAMED: challengeFlow -> stageState
        if (!this.data.stageState) {
            console.log('📊 UserProgress: Adding stageState system to existing data');
            this.data.stageState = {
                activeTexts: [],
                currentStage: 1,
                currentTextIndex: 0,
                lastCompletedTextId: null,
                textStats: {} 
            };
            needsSave = true;
        }
        
        // MIGRATION: If old challengeFlow exists, migrate it
        if (this.data.challengeFlow && !this.data.stageState) {
            console.log('📊 UserProgress: Migrating challengeFlow to stageState');
            this.data.stageState = this.data.challengeFlow;
            delete this.data.challengeFlow;
            needsSave = true;
        }
        
        if (needsSave) {
            console.log('📊 UserProgress: Saving updated data with new systems');
            this.saveUserProgress();
        }
    }
    

    
    // Initialize phrase progress from GameData (upfront approach)
    initializePhraseProgress() {
        console.log('📊 UserProgress: Initializing phrase progress upfront...');
        
        if (!this.gameData || !this.gameData.data) {
            console.error('❌ UserProgress: GameData not available for phrase initialization');
            return;
        }
        
        const phrases = this.gameData.data.phrases;
        console.log('📊 UserProgress: Found', phrases.length, 'phrases to initialize');
        
        let newPhrasesCount = 0;
        let newTextsCount = 0;
        
        phrases.forEach(phrase => {
            // Initialize phrase progress if missing
            if (!this.data.phraseProgress[phrase.phraseId]) {
                this.data.phraseProgress[phrase.phraseId] = {
                    level: 1, // All phrases start at level 1
                    attempts: []
                };
                newPhrasesCount++;
            }
            
            // Initialize text levels if missing
            const textId = phrase.phraseId.substring(0, phrase.phraseId.lastIndexOf('_'));
            if (!this.data.textLevels[textId]) {
                this.data.textLevels[textId] = 1; // All texts start at level 1
                newTextsCount++;
            }
        });
        
        console.log('📊 UserProgress: Initialized', newPhrasesCount, 'new phrases');
        console.log('📊 UserProgress: Initialized', newTextsCount, 'new text levels');
        console.log('📊 UserProgress: Total phrases in progress:', Object.keys(this.data.phraseProgress).length);
        
        // NEW: Initialize challenge flow if empty
        this.initializeStageState();

        // Initialize textStats for all texts
        this.initializeAllTextStats();
        
        // Save after initialization
        this.saveUserProgress();
    }


    initializeStageState() {  // RENAMED from initializeChallengeFlow
        console.log('📊 UserProgress: Initializing stage  state...');
        
        // Only initialize if activeTexts is empty
        if (!this.data.stageState.activeTexts || this.data.stageState.activeTexts.length === 0) {
            console.log('📊 UserProgress: Setting up initial text pool for stage  1');
            
            const allTexts = this.gameData.getAllTexts();
            const initialTexts = allTexts.slice(0, 3).map(text => text.textId); // First 3 texts
            
            this.data.stageState = {
                activeTexts: initialTexts,
                currentStage: 1,
                currentTextIndex: 0,
                lastCompletedTextId: null
            };
            
            console.log('📊 UserProgress: Initial stage  state setup:', this.data.stageState);
        } else {
            console.log('📊 UserProgress: Stage state already initialized:', this.data.stageState);
        }
    }

    
    //get phrase level
    getPhraseLevel(phraseId) {
        if (!this.data.phraseProgress[phraseId]) {
            return 1; // Default level
        }
        return this.data.phraseProgress[phraseId].level;
    }
    
    // NEW: Get current level for a specific text
    getTextLevel(textId) {
        // Get all phrases for this text
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        
        // Find the minimum level among non-mastered phrases
        let minLevel = Infinity;
        
        for (const phrase of allPhrasesInText) {
            const phraseLevel = this.data.phraseProgress[phrase.phraseId]?.level || 1;
            
            if (phraseLevel !== 'mastered' && typeof phraseLevel === 'number') {
                minLevel = Math.min(minLevel, phraseLevel);
            }
        }
        
        // If all phrases are mastered, text level doesn't matter
        return minLevel === Infinity ? 3 : minLevel;
    }
    
    // NEW: Set level for a specific text
    setTextLevel(textId, level) {
        console.log(`📊 UserProgress: Setting ${textId} to level ${level}`);
        
        if (!this.data.textLevels) {
            this.data.textLevels = {};
        }
        
        this.data.textLevels[textId] = level;
        this.saveUserProgress();
    }
    

    
    // NEW: Check if text is fully mastered (all phrases mastered)
    isTextMastered(textId) {
        console.log(`📊 UserProgress: Checking if ${textId} is mastered...`);
        
        // Get all phrases for this text from GameData
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        
        const allMastered = allPhrasesInText.every(phrase => {
            return this.isPhraseMastered(phrase.phraseId);
        });
        
        console.log(`📊 UserProgress: ${textId} mastery status: ${allMastered}`);
        return allMastered;
    }

    // Create fresh attempt for new phrase encounter
    createFreshAttempt(phraseId) {
        console.log(`📊 UserProgress: Creating fresh attempt for ${phraseId}`);
        this.currentAttempt = {
            phraseId: phraseId,
            timestamp: new Date().toISOString(),
            skipped: false,
            correct: false,
            incorrectCount: 0,
            peekedUnits: []  // For future Level 2 implementation
        };
        return this.currentAttempt;
    }

    // Track skip action on current attempt
    markCurrentAttemptSkipped() {
        if (!this.currentAttempt) {
            console.error('📊 UserProgress: No current attempt to mark as skipped');
            return;
        }
        this.currentAttempt.skipped = true;
        console.log(`📊 UserProgress: Marked ${this.currentAttempt.phraseId} as skipped`);
    }

    // Track incorrect answer on current attempt
    incrementCurrentAttemptIncorrect() {
        if (!this.currentAttempt) {
            console.error('📊 UserProgress: No current attempt to increment incorrect');
            return;
        }
        this.currentAttempt.incorrectCount++;
        console.log(`📊 UserProgress: Incorrect count for ${this.currentAttempt.phraseId}: ${this.currentAttempt.incorrectCount}`);
    }

    // Track correct answer on current attempt
    markCurrentAttemptCorrect() {
        if (!this.currentAttempt) {
            console.error('📊 UserProgress: No current attempt to mark correct');
            return;
        }
        this.currentAttempt.correct = true;
        console.log(`📊 UserProgress: Marked ${this.currentAttempt.phraseId} as correct`);
    }

    // Complete current attempt and save to session
    completeCurrentAttempt() {
        if (!this.currentAttempt) {
            console.error('📊 UserProgress: No current attempt to complete');
            return;
        }
        
        console.log(`📊 UserProgress: Completing attempt for ${this.currentAttempt.phraseId}`);
        
        // Determine outcome based on fresh attempt data
        const outcome = this.determineAttemptOutcome(this.currentAttempt);
        
        // Process the outcome (update levels if needed)
        const resultingLevel = this.processAttemptOutcome(this.currentAttempt.phraseId, outcome);
        
        // Add resulting level to attempt record
        const completedAttempt = {
            ...this.currentAttempt,
            resultingLevel: resultingLevel
        };
        
        // Save to session data (grouped by text)
        this.saveAttemptToSession(completedAttempt);
        
        // Update lastActiveText
        const textId = this.extractTextId(this.currentAttempt.phraseId);
        this.sessionData.lastActiveText = textId;
        
        // Clear current attempt
        this.currentAttempt = null;
        
        console.log(`📊 UserProgress: Attempt completed and saved to session`);
    }

    // Determine outcome based on attempt data
    determineAttemptOutcome(attempt) {
        // Mastery: skip + correct + no incorrect IN THIS ATTEMPT
        if (attempt.skipped && attempt.correct && attempt.incorrectCount === 0) {
            return 'mastered';
        }
        
        // Level advancement: correct + no incorrect IN THIS ATTEMPT
        if (attempt.correct && attempt.incorrectCount === 0) {
            return 'advance';
        }
        
        // No progression: had errors or didn't complete
        return 'incomplete';
    }

    // Save completed attempt to session data
    saveAttemptToSession(attempt) {
        const textId = this.extractTextId(attempt.phraseId);
        
        // Initialize text array if needed
        if (!this.sessionData.attemptsByText[textId]) {
            this.sessionData.attemptsByText[textId] = [];
        }
        
        // Add attempt to session history
        this.sessionData.attemptsByText[textId].push(attempt);
        
        console.log(`📊 UserProgress: Saved attempt to session for ${textId}`);
    }

    // Helper to extract textId from phraseId
    extractTextId(phraseId) {
        return phraseId.substring(0, phraseId.lastIndexOf('_'));
    }

    processAttemptOutcome(phraseId, outcome) {
        console.log(`📊 UserProgress: Processing outcome '${outcome}' for ${phraseId}`);
        
        let resultingLevel; // Declare variable to track the resulting level
        
        if (outcome === 'mastered') {
            console.log(`🎉 UserProgress: Phrase ${phraseId} MASTERED!`);
            this.setPhraseLevel(phraseId, "mastered");
            this.updateSessionCurrentLevels(phraseId, "mastered");
            this.checkTextLevelProgression(phraseId);
            resultingLevel = "mastered";
        } else if (outcome === 'advance') {
            console.log(`✅ UserProgress: Phrase ${phraseId} advancing level`);
            const newLevel = this.advancePhraseLevel(phraseId);
            this.updateSessionCurrentLevels(phraseId, newLevel);
            this.checkTextLevelProgression(phraseId);
            resultingLevel = newLevel;
        } else {
            console.log(`📊 UserProgress: Phrase ${phraseId} incomplete - no progression`);
            const currentLevel = this.getPhraseLevel(phraseId);
            resultingLevel = currentLevel;
        }
        
        // Record the attempt result in textStats
        this.recordAttemptResult(phraseId, resultingLevel);
        
        return resultingLevel;
    }

    // Update current levels in session data
    updateSessionCurrentLevels(phraseId, newLevel) {
        const textId = this.extractTextId(phraseId);
        
        if (!this.sessionData.currentLevels[textId]) {
            this.sessionData.currentLevels[textId] = {
                textLevel: this.getTextLevel(textId),
                phrases: {}
            };
        }
        
        this.sessionData.currentLevels[textId].phrases[phraseId] = newLevel;
        
        // Update text level in session if it changed
        const currentTextLevel = this.getTextLevel(textId);
        this.sessionData.currentLevels[textId].textLevel = currentTextLevel;
    }

    advancePhraseLevel(phraseId) {
        if (!this.data.phraseProgress[phraseId]) {
            this.initializeSinglePhrase(phraseId);
        }
        
        const currentLevel = this.data.phraseProgress[phraseId].level;
        console.log(`📊 UserProgress: Advancing ${phraseId} from level ${currentLevel}`);
        
        if (currentLevel === 1) {
            this.setPhraseLevel(phraseId, 2);
            return 2;
        } else if (currentLevel === 2) {
            this.setPhraseLevel(phraseId, 3);
            return 3; 
        } else if (currentLevel === 3) {
            this.setPhraseLevel(phraseId, "mastered");
            return "mastered";
        } else {
            console.warn(`📊 UserProgress: Cannot advance ${phraseId} from level ${currentLevel}`);
            return currentLevel; 
        }
    }

    setPhraseLevel(phraseId, level) {
        if (!this.data.phraseProgress[phraseId]) {
            this.initializeSinglePhrase(phraseId);
        }
        
        const oldLevel = this.data.phraseProgress[phraseId].level;
        this.data.phraseProgress[phraseId].level = level;
        this.saveUserProgress();
        
        console.log(`📊 UserProgress: ${phraseId} level changed from ${oldLevel} to ${level}`);
    }

    checkTextLevelProgression(phraseId) {
        console.log(`📊 UserProgress: Checking text level progression for phrase: ${phraseId}`);
        
        // Extract textId from phraseId
        const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
        console.log(`📊 UserProgress: Checking text: ${textId}`);
        
        // Get all phrases for this text
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        console.log(`📊 UserProgress: Found ${allPhrasesInText.length} phrases in ${textId}`);
        
        // Get current text level
        const currentTextLevel = this.getTextLevel(textId);
        console.log(`📊 UserProgress: Current text level: ${currentTextLevel}`);
        
        // Check if all non-mastered phrases are at the same level
        const phraseLevels = allPhrasesInText.map(phrase => {
            const phraseLevel = this.data.phraseProgress[phrase.phraseId]?.level || 1;
            console.log(`📊 UserProgress: Phrase ${phrase.phraseId} is at level ${phraseLevel}`);
            return phraseLevel;
        });
        

        // Check if ALL phrases are now at the next level
        const targetLevel = currentTextLevel + 1;
        const allPhrasesAtTargetLevel = allPhrasesInText.every(phrase => {
            const phraseLevel = this.data.phraseProgress[phrase.phraseId]?.level || 1;
            return phraseLevel === "mastered" || phraseLevel >= targetLevel;
        });

        if (allPhrasesAtTargetLevel) {
            console.log(`🎉 UserProgress: Text ${textId} leveled up from ${currentTextLevel} to ${targetLevel}!`);
            this.setTextLevel(textId, targetLevel);
        }

        // Filter out mastered phrases
        const nonMasteredLevels = phraseLevels.filter(level => level !== "mastered");

        if (nonMasteredLevels.length > 0) {
            // Check if ALL non-mastered phrases are above current text level
            const allAboveTextLevel = nonMasteredLevels.every(level => level > currentTextLevel);
            
            if (allAboveTextLevel) {
                // Text levels up to currentTextLevel + 1
                const newLevel = currentTextLevel + 1;
                this.setTextLevel(textId, newLevel);
                this.eventBus.emit('userProgress:textLeveledUp', { textId, oldLevel: currentTextLevel, newLevel });
            }
        } else {
            // All phrases mastered - text becomes mastered
            this.eventBus.emit('userProgress:textMastered', textId);
            this.eventBus.emit('userProgress:textLeveledUp', { textId, oldLevel: currentTextLevel, newLevel: 'mastered' });
        }
    }

    // Check if all phrases in a text are mastered
    checkTextMastery(phraseId) {
        console.log(`📊 UserProgress: Checking text mastery for phrase: ${phraseId}`);
        
        // Extract textId from phraseId (e.g., "text_1_p3" → "text_1")
        const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
        console.log(`📊 UserProgress: Extracted textId: ${textId}`);
        
        // Get all phrases for this text from GameData
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        console.log(`📊 UserProgress: Found ${allPhrasesInText.length} phrases in ${textId}`);
        
        // Check if all phrases in this text are mastered
        const allMastered = allPhrasesInText.every(phrase => {
            const isMastered = this.isPhraseMastered(phrase.phraseId);
            console.log(`📊 UserProgress: Phrase ${phrase.phraseId} mastered: ${isMastered}`);
            return isMastered;
        });
        
        if (allMastered) {
            console.log(`🎉 UserProgress: Text ${textId} is now MASTERED! All phrases mastered.`);
            this.eventBus.emit('userProgress:textMastered', textId);
        } else {
            console.log(`📊 UserProgress: Text ${textId} not yet mastered`);
        }
    }

    // Check if phrase is mastered (for ChallengeManager)
    isPhraseMastered(phraseId) {
        if (!this.data.phraseProgress[phraseId]) return false;
        const level = this.data.phraseProgress[phraseId].level;
        const isMastered = level === "mastered";
        console.log(`📊 UserProgress: Checking ${phraseId} mastery - level: ${level}, mastered: ${isMastered}`);
        return isMastered;
    }
    
    // NEW: Get current level for a specific text
    getTextLevel(textId) {
        if (!this.data.textLevels) {
            console.warn('📊 UserProgress: textLevels not initialized, returning default level 1');
            return 1;
        }
        
        return this.data.textLevels[textId] || 1;
    }
    
    // NEW: Set level for a specific text
    setTextLevel(textId, level) {
        console.log(`📊 UserProgress: Setting ${textId} to level ${level}`);
        
        if (!this.data.textLevels) {
            this.data.textLevels = {};
        }
        
        this.data.textLevels[textId] = level;
        this.saveUserProgress();
    }
    

    
    // NEW: Check if text is fully mastered (all phrases mastered)
    isTextMastered(textId) {
        console.log(`📊 UserProgress: Checking if ${textId} is mastered...`);
        
        // Get all phrases for this text from GameData
        const allPhrasesInText = this.gameData.getPhrasesForText(textId);
        
        const allMastered = allPhrasesInText.every(phrase => {
            return this.isPhraseMastered(phrase.phraseId);
        });
        
        console.log(`📊 UserProgress: ${textId} mastery status: ${allMastered}`);
        return allMastered;
    }

    getResumePosition() {
        console.log('📊 UserProgress: Getting resume position...');
        
        const sessions = this.loadSessionHistory();
        if (!sessions || sessions.length === 0) {
            console.log('📊 UserProgress: No previous sessions');
            return { startTextId: 'text_1' };
        }
        
        const lastSession = sessions[sessions.length - 1];
        const lastActiveText = lastSession.lastActiveText;
        
        if (!lastActiveText) {
            return { startTextId: 'text_1' };
        }
        
        // Get next text after the last active one
        const allTexts = this.gameData.getAllTexts();
        const lastTextIndex = allTexts.findIndex(t => t.textId === lastActiveText);
        
        if (lastTextIndex === -1 || lastTextIndex === allTexts.length - 1) {
            return { startTextId: 'text_1' }; // Wrap around or not found
        }
        
        const nextText = allTexts[lastTextIndex + 1];
        console.log(`📊 UserProgress: Resume from ${nextText.textId} (after ${lastActiveText})`);
        
        return { startTextId: nextText.textId };
    }
    
    // Save progress to localStorage
    saveUserProgress() {
        const timestamp = new Date().toISOString();
        console.log(`📊 UserProgress: [${timestamp}] saveUserProgress called`);
        console.log(`📊 UserProgress: [${timestamp}] Data to save:`, this.data);
        
        try {
            console.log(`📊 UserProgress: [${timestamp}] Attempting JSON.stringify...`);
            const jsonString = JSON.stringify(this.allContentData, null, 2);
            console.log(`📊 UserProgress: [${timestamp}] JSON.stringify successful, length: ${jsonString.length}`);
            console.log(`📊 UserProgress: [${timestamp}] First 500 chars of JSON:`, jsonString.substring(0, 500));
            
            console.log(`📊 UserProgress: [${timestamp}] Attempting localStorage.setItem with key '${this.storageKey}'...`);
            localStorage.setItem(this.storageKey, jsonString);
            console.log(`✅ UserProgress: [${timestamp}] localStorage.setItem completed`);
            
            // Verify the save by reading it back immediately
            console.log(`📊 UserProgress: [${timestamp}] Verifying save by reading back from localStorage...`);
            const readBack = localStorage.getItem(this.storageKey);
            
            if (!readBack) {
                console.error(`❌ UserProgress: [${timestamp}] CRITICAL: localStorage.getItem returned null immediately after save!`);
                return false;
            }
            
            console.log(`✅ UserProgress: [${timestamp}] Read-back successful, length: ${readBack.length}`);
            
            // Parse to ensure it's valid JSON
            try {
                const parsed = JSON.parse(readBack);
                console.log(`✅ UserProgress: [${timestamp}] Read-back JSON parsing successful`);
                return true;
            } catch (parseError) {
                console.error(`❌ UserProgress: [${timestamp}] Read-back JSON parsing failed:`, parseError);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ UserProgress: [${timestamp}] Error saving progress:`, error);
            console.error(`📊 UserProgress: [${timestamp}] Error details - message:`, error.message);
            console.error(`📊 UserProgress: [${timestamp}] Error details - stack:`, error.stack);
            console.error(`📊 UserProgress: [${timestamp}] localStorage available:`, typeof Storage !== 'undefined');
            console.error(`📊 UserProgress: [${timestamp}] localStorage quota info:`, this.getStorageInfo());
            return false;
        }
    }

    // helper method to initialize phrase progress
    initializeSinglePhrase(phraseId) {
        console.log(`📊 UserProgress: Initializing phrase ${phraseId} at level 1`);
        this.data.phraseProgress[phraseId] = {
            level: 1, // All phrases start at level 1
            attempts: []
        };
    }
    
    // Helper method to get storage information for debugging
    getStorageInfo() {
        try {
            const used = new Blob(Object.values(localStorage)).size;
            return {
                used: used,
                usedMB: (used / (1024 * 1024)).toFixed(2),
                available: typeof navigator.storage !== 'undefined'
            };
        } catch (e) {
            return { error: e.message };
        }
    }

    // Initialize textStats for all texts upfront
initializeAllTextStats() {
    console.log('📊 UserProgress: Initializing textStats for all texts...');
    
    const phrases = this.gameData.data.phrases;
    const textsProcessed = new Set();
    
    phrases.forEach(phrase => {
        const textId = this.extractTextId(phrase.phraseId);
        
        if (!textsProcessed.has(textId)) {
            textsProcessed.add(textId);
            
            // Initialize for levels 1, 2, 3
            for (let level = 1; level <= 3; level++) {
                this.initializeTextStats(textId, level);
            }
        }
    });
    
    console.log('📊 UserProgress: TextStats initialized for', textsProcessed.size, 'texts');
    this.saveUserProgress();
}

// Initialize tracking for a specific text/level
initializeTextStats(textId, level) {
    if (!this.data.textStats[textId]) {
        this.data.textStats[textId] = {};
    }
    
    if (!this.data.textStats[textId][`level${level}`]) {
        this.data.textStats[textId][`level${level}`] = {
            rounds: 0,
            attempts: {}
        };
        console.log(`📊 UserProgress: Initialized textStats for ${textId} level${level}`);
    }
}

    // Record attempt result for a phrase
    recordAttemptResult(phraseId, resultingLevel) {
        const textId = this.extractTextId(phraseId);
        
        // Use the LOCKED level (level where attempt was actually made)
        const stageState = this.data.stageState;
        const playedLevel = stageState.lockedTextLevels[textId];
        const levelKey = `level${playedLevel}`;
        
        // Ensure textStats exists for this text/level
        this.initializeTextStats(textId, playedLevel);
        
        // Initialize attempts array for this phrase if needed
        if (!this.data.textStats[textId][levelKey].attempts[phraseId]) {
            this.data.textStats[textId][levelKey].attempts[phraseId] = [];
        }
        
        // Record the resulting level
        this.data.textStats[textId][levelKey].attempts[phraseId].push(resultingLevel);
        
        console.log(`📊 UserProgress: Recorded attempt for ${phraseId} at ${levelKey}: result ${resultingLevel}`);
        this.saveUserProgress();
    }

// Increment round count for a text at its current level
incrementRoundForText(textId, completedLevel) {
    const levelKey = `level${completedLevel}`;
    
    // Ensure textStats exists
    this.initializeTextStats(textId, completedLevel);
    
    this.data.textStats[textId][levelKey].rounds++;
    
    console.log(`📊 UserProgress: Incremented round for ${textId} ${levelKey} to ${this.data.textStats[textId][levelKey].rounds}`);
    this.saveUserProgress();
}

// Get round display data for text cover
getTextRoundDisplay(textId) {
    const textLevel = this.getTextLevel(textId);
    const levelKey = `level${textLevel}`;
    
    // Ensure textStats exists
    this.initializeTextStats(textId, textLevel);
    
    const completedRounds = this.data.textStats[textId][levelKey].rounds;
    const upcomingRound = completedRounds + 1;
    
    return {
        level: textLevel,
        round: upcomingRound
    };
}

// Get formatted debug data
getTextStatsDebug() {
    let debugText = '<strong style="color: #00ffff;">📈 TEXT STATS:</strong><br>';
    
    // Group by text first
    const textIds = Object.keys(this.data.textStats).sort();
    const textDisplays = [];
    
    textIds.forEach(textId => {
        const textData = this.data.textStats[textId];
        const levelDisplays = [];
        
        // Check levels 1, 2, 3 in order
        for (let level = 1; level <= 3; level++) {
            const levelKey = `level${level}`;
            const levelData = textData[levelKey];
            
            // Skip levels with no rounds (not yet played)
            if (!levelData || levelData.rounds === 0) {
                continue;
            }
            
            // Build level display: L1 R2 p1(1,2) p2(M)
            let levelDisplay = `L${level} R${levelData.rounds}`;
            
            // Sort phrase attempts by phrase number for consistent display
            const sortedAttempts = Object.entries(levelData.attempts).sort((a, b) => {
                const numA = parseInt(a[0].split('_')[2].substring(1)); // Extract number from p1, p2, etc
                const numB = parseInt(b[0].split('_')[2].substring(1));
                return numA - numB;
            });
            
            // Add attempt details for each phrase in sorted order
            sortedAttempts.forEach(([phraseId, attempts]) => {
                const phraseNum = phraseId.split('_')[2]; // Extract p1, p2, etc
                const attemptStr = attempts.join(',');
                levelDisplay += ` ${phraseNum}(${attemptStr})`;
            });
            
            levelDisplays.push(levelDisplay);
        }
        
        // Only add text if it has any level data
        if (levelDisplays.length > 0) {
            textDisplays.push(`${textId} ${levelDisplays.join(', ')}`);
        }
    });
    
    // Join all texts with semicolons AND line breaks for readability
    debugText += textDisplays.join(';<br>');
    
    return debugText;
}
    
    // Debug method - clear all progress
    clearProgress() {
        console.log('🧹 UserProgress: Clearing all progress data...');
        localStorage.removeItem(this.storageKey);
        this.createFreshProgressData();
        console.log('✅ UserProgress: Progress cleared, fresh data created');
        
        // Re-initialize phrase progress if GameData is available
        if (this.gameData && this.gameData.data) {
            console.log('🧹 UserProgress: Re-initializing phrase progress after clear...');
            this.initializePhraseProgress();
        }
    }

    // Helper method to get next text
    getNextTextForChallenge() {
        const stageState = this.data.stageState;
        if (stageState.activeTexts && stageState.activeTexts.length > 0) {
            return stageState.activeTexts[stageState.currentTextIndex] || 'Unknown';
        }
        return 'Not set';
    }

    // helper method to count total unique texts
    getTotalUniqueTexts() {
        const uniqueTexts = new Set();
        Object.keys(this.data.phraseProgress).forEach(phraseId => {
            const textId = phraseId.substring(0, phraseId.lastIndexOf('_'));
            uniqueTexts.add(textId);
        });
        return uniqueTexts.size;
    }

    saveCompletedSession() {
        console.log('📊 UserProgress: Saving completed session');
        
        // Mark session as ended
        this.sessionData.endTime = new Date().toISOString();
        
        // Store last stage info
        const stageState = this.data.stageState;
        this.data.lastStage = {
            stageNumber: stageState.currentStage,
            texts: [...stageState.activeTexts]
        };
        
        // Finalize current game and move to history
        if (this.data.currentGame) {
            // FIXED: Set cumulative text count based on stage state active texts
            // This represents texts that were active when this game ended
            this.data.currentGame.textsPlayed = stageState.activeTexts.length;
            
            this.data.gamesHistory.push({...this.data.currentGame});
            this.data.currentGame = null; // Clear for next game
        }
        
        // Save user progress first
        this.saveUserProgress();
        
        // Load existing sessions array or create new
        const existingSessions = this.loadSessionHistory();
        
        // Add current session to history
        existingSessions.push(this.sessionData);
        
        // Save to localStorage
        try {
            localStorage.setItem('kiwik_sessions', JSON.stringify(existingSessions));
            console.log('✅ UserProgress: Session saved successfully');
        } catch (error) {
            console.error('❌ UserProgress: Error saving session:', error);
        }
    }

    loadSessionHistory() {
        try {
            const stored = localStorage.getItem('kiwik_sessions');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('❌ UserProgress: Error loading session history:', error);
            return [];
        }
    }
    
    // Get current data (for debugging)
    getCurrentData() {
        return this.data;
    }

    // Debug info for load-game screen
    getDebugInfo() {
        // Calculate stats
        const totalPhrases = Object.keys(this.data.phraseProgress).length;
        const masteredPhrases = Object.values(this.data.phraseProgress).filter(p => p.level === 'mastered').length;
        const masteredPercentage = totalPhrases > 0 ? Math.round((masteredPhrases / totalPhrases) * 100) : 0;
        
        // Get unique texts count
        const totalTexts = this.getTotalUniqueTexts();
        
        // Get project metadata (game content info)
        const projectMetadata = this.gameData.getProjectMetadata();
        const gameTitle = projectMetadata ? projectMetadata.title : 'La fièvre';
        
        // Build debug display with new structure
        let debugText = '';
        
        // CONTENT SECTION (Fixed game data - moved to top)
        debugText += `<strong style="color: #ffffff;">${gameTitle}: ${totalTexts} texts, ${totalPhrases} phrases</strong><br><br>`;
        
        // PROGRESS SECTION (Player progress data only)
        debugText += '<strong style="color: #00ffff;">📊 PROGRESS:</strong><br>';
        debugText += `Total Games: ${this.data.gamesPlayed}<br>`;
        debugText += `Total Mastered Phrases: ${masteredPhrases} (${masteredPercentage}%)<br>`;
        
        // Last stage info
        if (this.data.lastStage) {
            debugText += `Last Stage: Stage ${this.data.lastStage.stageNumber} [${this.data.lastStage.texts.join(', ')}]<br>`;
        } else {
            debugText += `Last Stage: None<br>`;
        }
        
        // Next text
        debugText += `Next Text: ${this.getNextTextForChallenge()}<br><br>`;
        
        // GAMES SECTION (Per-game tracking)
        debugText += '<strong style="color: #ffff00;">🎮 GAMES:</strong><br>';
        this.data.gamesHistory.forEach(game => {
            debugText += `Game ${game.gameNumber}: ${game.stages} stages, ${game.textsPlayed} texts, ${game.levelUps} level ups<br>`;
        });
        
        // Current game if active
        if (this.data.currentGame) {
            const currentTexts = this.getTotalUniqueTexts();
            debugText += `Game ${this.data.currentGame.gameNumber} (active): ${this.data.currentGame.stages} stages, ${currentTexts} texts, ${this.data.currentGame.levelUps} level ups<br>`;
        }
        
        return debugText;
    }


}
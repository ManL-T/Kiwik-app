// js/managers/UserProgress.js - Complete Async Implementation
class UserProgress {
    constructor(eventBus, gameData, firebaseAdapter) {
    console.log('🔍 DEBUG: UserProgress constructor called with:', 
        eventBus ? 'eventBus exists' : 'no eventBus', 
        gameData ? 'gameData exists' : 'no gameData',
        firebaseAdapter ? 'firebaseAdapter exists' : 'no firebaseAdapter');        
    console.log(`📊 UserProgress: [${new Date().toISOString()}] Initializing user progress???`);
        
        // Store references
        this.eventBus = eventBus;
        this.gameData = gameData;
        
        // localStorage key
        this.storageKey = 'kiwik_userProgress';

        // use firebase adapter
        this.firebaseAdapter = firebaseAdapter;        

        // Content tracking
        this.currentGameId = null;
        this.allContentData = {}; // Will hold all content, all different songs' content, played so far by the user
        this.data = null; // Current content data (the current song's content) reference
        
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
        
        // Start async initialization - don't wait for it in constructor
        this.initializeAsync();
        
        console.log(`✅ UserProgress: [${new Date().toISOString()}] Constructor complete, async initialization started`);
    }

    async initializeAsync() {
        try {
            await this.loadUserProgressAsync();
            this.isReady = true;
            this.eventBus.emit('userProgress:ready');
            console.log('✅ UserProgress: Async initialization complete');
        } catch (error) {
            console.error('❌ UserProgress: Async initialization failed:', error);
            // Initialize with defaults on error
            this.allContentData = {};
            this.data = this.createFreshProgressData();
            this.isReady = true;
            this.eventBus.emit('userProgress:ready');
        }
    }

    async loadUserProgressAsync() {
        console.log('🔍 DEBUG: loadUserProgressAsync called');
        
        try {
            // Wait for FirebaseAdapter to be fully ready
            await this.firebaseAdapter.waitUntilReady();
            
            const stored = this.firebaseAdapter.getItem(this.storageKey);
            console.log('🔍 DEBUG: Raw stored data:', stored);
            console.log('🔍 DEBUG: Type of stored:', typeof stored);
            console.log('🔍 DEBUG: Storage key used:', this.storageKey);
            
            if (stored) {
                const parsedData = JSON.parse(stored);
                console.log('📊 UserProgress: Parsed localStorage data:', parsedData);

                // Write Firestore data to actual localStorage
                console.log('📊 UserProgress: Transferring Firestore data to localStorage...');
                localStorage.setItem(this.storageKey, stored);
                console.log('✅ UserProgress: Data successfully transferred to localStorage');
                
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

                // 🆕 NEW: Clear localStorage when no Firestore data exists
                // localStorage.removeItem(this.storageKey);
                // console.log('📊 UserProgress: Cleared localStorage (no Firestore data)');
            
            // Initialize data with defaults - will be populated when GameData loads
            // this.data = this.createFreshProgressData();
            
        } catch (error) {
            console.error('❌ UserProgress: Error loading progress:', error);
            this.allContentData = {};
            this.data = this.createFreshProgressData();
        }
    }

    getTextRoundDisplay(textId) {
    const textLevel = this.getTextLevel(textId);
    const levelKey = `level${textLevel}`;
    
    if (!this.data.textStats[textId] || !this.data.textStats[textId][levelKey]) {
        return 1; // Default round
    }
    
    return this.data.textStats[textId][levelKey].rounds || 1;
}
    
    // Setup event listeners
    setupEventListeners() {
        console.log('📊 UserProgress: Setting up event listeners...');
        
        // Wait for GameData to load before initializing phrases
        this.eventBus.on('gameData:loaded', async (projectMetadata) => {
            console.log('📊 UserProgress: GameData loaded, initializing phrase progress...');
            await this.setCurrentContent(projectMetadata);
            this.initializePhraseProgress();
            console.log(`✅ UserProgress: Ready for content: ${this.currentGameId}`);
        });
        
        // Handle game start
        this.eventBus.on('userProgress:gameStarted', () => {
            console.log('📊 UserProgress: Game started');
            this.initializeNewSession();
        });

        // Track skipped phrases
        // this.eventBus.on('userProgress:phraseSkipped', (phraseId) => {
        //     console.log(`📊 UserProgress: Phrase skipped: ${phraseId}`);
        //     this.markCurrentAttemptSkipped();
        // });

        // Track mastered phrases
        this.eventBus.on('userProgress:phraseMastered', (phraseId) => {
            this.setPhraseLevel(phraseId, 'mastered');
            this.checkTextLevelProgression(phraseId);
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

    async setCurrentContent(projectMetadata) {
        this.currentGameId = projectMetadata.gameId;
        console.log(`📊 UserProgress: Switching to game: ${this.currentGameId}`);
        
        // Always create fresh data first (fallback)
        const freshData = this.createFreshProgressData();
        
        try {
            // Try to load existing data from Firestore
            const existingData = await this.firebaseAdapter.loadGameDocument(this.currentGameId);
            
            if (existingData) {
                this.allContentData[this.currentGameId] = JSON.parse(existingData);
                console.log(`✅ UserProgress: Loaded existing data for ${this.currentGameId}`);
            } else {
                this.allContentData[this.currentGameId] = freshData;
                console.log(`📊 UserProgress: No existing data, using fresh for ${this.currentGameId}`);
            }
        } catch (error) {
            console.error(`❌ UserProgress: Error loading ${this.currentGameId}:`, error);
            this.allContentData[this.currentGameId] = freshData;
            console.log(`📊 UserProgress: Using fresh data due to error for ${this.currentGameId}`);
        }
        
        // This ALWAYS gets set, no matter what happens above
        this.data = this.allContentData[this.currentGameId];
        console.log(`📊 UserProgress: Data context set for ${this.currentGameId}`);
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
        // this.saveUserProgress();
    }

    initializeStageState() {
        console.log('📊 UserProgress: Initializing stage  state...');
        
        // Only initialize if empty
        if (this.data.stageState.activeTexts.length === 0) {
            console.log('📊 UserProgress: Setting up initial text pool for stage  1');
            
            // Start with first 3 texts
            this.data.stageState.activeTexts = ['text_1', 'text_2', 'text_3'];
            this.data.stageState.currentStage = 1;
            this.data.stageState.currentTextIndex = 0;
            this.data.stageState.lastCompletedTextId = null;
        }
        
        console.log('📊 UserProgress: Initial stage  state setup:', this.data.stageState);
    }

    // Update initializeNewSession() to start game tracking
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

    createFreshAttempt(phraseId) {
        console.log(`📊 UserProgress: Creating fresh attempt for ${phraseId}`);
        
        this.currentAttempt = {
            phraseId: phraseId,
            startTime: new Date().toISOString(),
            endTime: null,
            incorrectCount: 0,
            correct: false,
            skipped: false,
            resultingLevel: null
        };
        
        return this.currentAttempt;
    }

    markCurrentAttemptSkipped() {
        if (this.currentAttempt) {
            this.currentAttempt.skipped = true;
            console.log(`📊 UserProgress: Marked ${this.currentAttempt.phraseId} as skipped`);
        }
    }

    incrementCurrentAttemptIncorrect() {
        if (this.currentAttempt) {
            this.currentAttempt.incorrectCount++;
            console.log(`📊 UserProgress: Incorrect count for ${this.currentAttempt.phraseId}: ${this.currentAttempt.incorrectCount}`);
        }
    }

    markCurrentAttemptCorrect() {
        if (this.currentAttempt) {
            this.currentAttempt.correct = true;
            console.log(`📊 UserProgress: Marked ${this.currentAttempt.phraseId} as correct`);
        }
    }

    completeCurrentAttempt() {
        if (!this.currentAttempt) {
            console.error('❌ UserProgress: No current attempt to complete');
            return;
        }
        
        console.log(`📊 UserProgress: Completing attempt for ${this.currentAttempt.phraseId}`);
        
        // End the attempt
        this.currentAttempt.endTime = new Date().toISOString();
        
        // Process the result and update phrase level
        const phraseId = this.currentAttempt.phraseId;
        const currentLevel = this.data.phraseProgress[phraseId].level;
        
        let outcome;
        
        if (this.currentAttempt.skipped) {
            outcome = 'skipped';
            this.currentAttempt.resultingLevel = currentLevel; // No change
        } else if (this.currentAttempt.correct) {
            if (this.currentAttempt.incorrectCount === 0) {
                // Perfect - either advance or master
                if (currentLevel >= 3) {
                    outcome = 'mastered';
                    this.currentAttempt.resultingLevel = 'mastered';
                } else {
                    outcome = 'advance';
                    this.currentAttempt.resultingLevel = currentLevel + 1;
                }
            } else {
                // Correct but with errors - advance
                outcome = 'advance';
                if (currentLevel >= 3) {
                    this.currentAttempt.resultingLevel = 'mastered';
                } else {
                    this.currentAttempt.resultingLevel = currentLevel + 1;
                }
            }
        } else {
            // Incorrect final answer
            outcome = 'incomplete';
            this.currentAttempt.resultingLevel = currentLevel; // No change
        }
        
        console.log(`📊 UserProgress: Processing outcome '${outcome}' for ${phraseId}`);
        
        // Update phrase level based on outcome
        if (outcome === 'mastered') {
            this.data.phraseProgress[phraseId].level = 'mastered';
            console.log(`🎉 UserProgress: Phrase ${phraseId} MASTERED!`);
        } else if (outcome === 'advance') {
            console.log(`✅ UserProgress: Phrase ${phraseId} advancing level`);
            this.advancePhraseLevel(phraseId);
        } else {
            console.log(`📊 UserProgress: Phrase ${phraseId} ${outcome} - no progression`);
        }

        // Record the attempt:
        const textId = this.extractTextId(phraseId);
        const playedLevel = this.data.stageState.lockedTextLevels[textId];
        this.eventBus.emit('analytics:attemptRecorded', {
            phraseId: phraseId,
            playedLevel: playedLevel,
            resultingLevel: this.currentAttempt.resultingLevel
        });
        
        // Save attempt to session data
        this.saveAttemptToSession();
        
        // Clear current attempt
        this.currentAttempt = null;
        
        console.log(`📊 UserProgress: Attempt completed and saved to session`);
    }

    saveAttemptToSession() {
        if (!this.currentAttempt) return;
        
        const textId = this.extractTextId(this.currentAttempt.phraseId);
        
        // Initialize text array if needed
        if (!this.sessionData.attemptsByText[textId]) {
            this.sessionData.attemptsByText[textId] = [];
        }
        
        // Add attempt to session
        this.sessionData.attemptsByText[textId].push({...this.currentAttempt});
        
        console.log(`📊 UserProgress: Saved attempt to session for ${textId}`);
    }

    advancePhraseLevel(phraseId) {
        const currentLevel = this.data.phraseProgress[phraseId].level;
        
        if (currentLevel === 'mastered') {
            console.log(`📊 UserProgress: ${phraseId} already mastered`);
            return;
        }
        
        console.log(`📊 UserProgress: Advancing ${phraseId} from level ${currentLevel}`);
        
        let newLevel;
        if (typeof currentLevel === 'number') {
            if (currentLevel >= 3) {
                newLevel = 'mastered';
            } else {
                newLevel = currentLevel + 1;
            }
        } else {
            console.error(`❌ UserProgress: Invalid level for ${phraseId}: ${currentLevel}`);
            return;
        }
        
        // Update the level
        const oldLevel = this.data.phraseProgress[phraseId].level;
        this.data.phraseProgress[phraseId].level = newLevel;
        
        console.log(`📊 UserProgress: ${phraseId} level changed from ${oldLevel} to ${newLevel}`);
        
        // Check if this advances the text level
        this.checkTextLevelProgression(phraseId);
        
        // Save progress
        // this.saveUserProgress();
    }

    checkTextLevelProgression(phraseId) {
        console.log(`📊 UserProgress: Checking text level progression for phrase: ${phraseId}`);
        
        const textId = this.extractTextId(phraseId);
        console.log(`📊 UserProgress: Checking text: ${textId}`);
        
        // Get all phrases for this text
        const textPhrases = Object.keys(this.data.phraseProgress).filter(id => 
            this.extractTextId(id) === textId
        );
        console.log(`📊 UserProgress: Found ${textPhrases.length} phrases in ${textId}`);
        
        const currentTextLevel = this.data.textLevels[textId];
        console.log(`📊 UserProgress: Current text level: ${currentTextLevel}`);
        
        // Check each phrase level
        textPhrases.forEach(id => {
            const level = this.data.phraseProgress[id].level;
            console.log(`📊 UserProgress: Phrase ${id} is at level ${level}`);
        });
        
        // Get all phrase levels
        const phraseLevels = textPhrases.map(id => this.data.phraseProgress[id].level);
        
        // Check for all possible level progressions
        const allMastered = phraseLevels.every(level => level === 'mastered');
        const allAtLevel3Plus = phraseLevels.every(level => 
            level === 'mastered' || (typeof level === 'number' && level >= 3)
        );
        const allAtLevel2Plus = phraseLevels.every(level => 
            level === 'mastered' || (typeof level === 'number' && level >= 2)
        );
        
        let newTextLevel = currentTextLevel;
        
        // Check all possible progressions
        if (allMastered && currentTextLevel < 'mastered') {
            newTextLevel = 'mastered';
        } else if (allAtLevel3Plus && currentTextLevel < 3) {
            newTextLevel = 3;
        } else if (allAtLevel2Plus && currentTextLevel < 2) {
            newTextLevel = 2;
        }
        
        if (newTextLevel > currentTextLevel || (newTextLevel === 'mastered' && currentTextLevel !== 'mastered')) {
            console.log(`🎉 UserProgress: Text ${textId} leveled up from ${currentTextLevel} to ${newTextLevel}!`);
            this.setTextLevel(textId, newTextLevel);
            
            // Emit level up event for game tracking
            this.eventBus.emit('userProgress:textLeveledUp', {
                textId: textId,
                oldLevel: currentTextLevel,
                newLevel: newTextLevel
            });
        }
    }

    setTextLevel(textId, level) {
        console.log(`📊 UserProgress: Setting ${textId} to level ${level}`);
        this.data.textLevels[textId] = level;
        // this.saveUserProgress();
    }

    isTextMastered(textId) {
        console.log(`📊 UserProgress: Checking if ${textId} is mastered...`);
        
        // Get all phrases for this text
        const textPhrases = Object.keys(this.data.phraseProgress).filter(id => 
            this.extractTextId(id) === textId
        );
        
        // Check if all phrases are mastered
        const allMastered = textPhrases.every(phraseId => {
            const level = this.data.phraseProgress[phraseId].level;
            const isMastered = level === 'mastered';
            console.log(`📊 UserProgress: Checking ${phraseId} mastery - level: ${level}, mastered: ${isMastered}`);
            return isMastered;
        });
        
        console.log(`📊 UserProgress: ${textId} mastery status: ${allMastered}`);
        return allMastered;
    }

    getResumePosition() {
        console.log('📊 UserProgress: Getting resume position...');
        
        const sessions = this.loadSessionHistory();
        if (!sessions || sessions.length === 0) {
            console.log('📊 UserProgress: No previous sessions');
            return { startTextId: 'text_1', startTextIndex: 0 };
        }
        
        const lastSession = sessions[sessions.length - 1];
        const lastActiveText = lastSession.lastActiveText;
        
        if (!lastActiveText) {
            return { startTextId: 'text_1', startTextIndex: 0 };
        }
        
        // Get next text after the last active one
        const allTexts = this.gameData.getAllTexts();
        const lastTextIndex = allTexts.findIndex(t => t.textId === lastActiveText);
        
        if (lastTextIndex === -1 || lastTextIndex === allTexts.length - 1) {
            return { startTextId: 'text_1', startTextIndex: 0 }; // Wrap around or not found
        }
        
        const nextText = allTexts[lastTextIndex + 1];
        console.log(`📊 UserProgress: Resume from ${nextText.textId} (after ${lastActiveText})`);
        
        return { startTextId: nextText.textId, startTextIndex: lastTextIndex + 1 };
    }
    
    // Save progress to Firebase
    // Replace the existing saveUserProgress() method in UserProgress.js with this fixed version
    saveUserProgress() {
        const timestamp = new Date().toISOString();
        console.log(`📊 UserProgress: [${timestamp}] saveUserProgress called`);
        
        // Check if we have current content set
        if (!this.currentGameId || !this.data) {
            console.error(`❌ UserProgress: [${timestamp}] Cannot save - no current content set`);
            return false;
        }
        
        console.log(`📊 UserProgress: [${timestamp}] Saving data for content: ${this.currentGameId}`);
        console.log(`📊 UserProgress: [${timestamp}] Data to save:`, this.data);
        
        try {
            console.log(`📊 UserProgress: [${timestamp}] Attempting JSON.stringify...`);
            const jsonString = JSON.stringify(this.data, null, 2);
            console.log(`📊 UserProgress: [${timestamp}] JSON.stringify successful, length: ${jsonString.length}`);
            console.log(`📊 UserProgress: [${timestamp}] First 500 chars of JSON:`, jsonString.substring(0, 500));
            
            // Use gameId as document key (once you add it to JSON files)
            // For now, we'll use currentGameId but this will change to gameId
            const documentKey = this.currentGameId; // This will become projectMetadata.gameId
            
            console.log(`📊 UserProgress: [${timestamp}] Saving to document: ${documentKey}`);
            this.firebaseAdapter.setItem(documentKey, jsonString);
            console.log(`✅ UserProgress: [${timestamp}] Save completed`);
            return true;
            
        } catch (error) {
            console.error(`❌ UserProgress: [${timestamp}] Error saving progress:`, error);
            console.error(`📊 UserProgress: [${timestamp}] Error details - message:`, error.message);
            console.error(`📊 UserProgress: [${timestamp}] Error details - stack:`, error.stack);
            return false;
        }
    }

    saveToFirestore() {
        if (!this.currentGameId || !this.data) {
            console.error('❌ UserProgress: Cannot save to Firestore - no game data');
            return false;
        }
        
        console.log(`📊 UserProgress: Saving ${this.currentGameId} to Firestore`);
        
        const jsonString = JSON.stringify(this.data, null, 2);
        this.firebaseAdapter.persistToFirestore(this.currentGameId, jsonString);
        return true;
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
        // this.saveUserProgress();
    }

    // Initialize tracking for a specific text/level
    initializeTextStats(textId, level) {
        if (!this.data.textStats[textId]) {
            this.data.textStats[textId] = {};
        }
        
        if (!this.data.textStats[textId][`level${level}`]) {
            this.data.textStats[textId][`level${level}`] = {
                rounds: 0,
                attempts: []
            };
            
            console.log(`📊 UserProgress: Initialized textStats for ${textId} level${level}`);
        }
    }


    // Record an attempt result for textStats
    recordAttemptInTextStats(phraseId, level, result) {
        const textId = this.extractTextId(phraseId);
        
        // Ensure textStats exists
        this.initializeTextStats(textId, level);
        
        // Record the attempt
        this.data.textStats[textId][`level${level}`].attempts.push({
            phraseId: phraseId,
            result: result,
            timestamp: new Date().toISOString()
        });
        
        console.log(`📊 UserProgress: Recorded attempt for ${phraseId} at level${level}: result ${result}`);
        // this.saveUserProgress();
    }

    // Increment round for a text/level
    incrementTextStatsRound(textId, level) {
        this.initializeTextStats(textId, level);
        this.data.textStats[textId][`level${level}`].rounds++;
        console.log(`📊 UserProgress: Incremented round for ${textId} level${level} to ${this.data.textStats[textId][`level${level}`].rounds}`);
        // this.saveUserProgress();
    }

    // Helper method to extract textId from phraseId
    extractTextId(phraseId) {
        return phraseId.substring(0, phraseId.lastIndexOf('_'));
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
        
        // Save sessions to Firebase
        try {
            this.firebaseAdapter.persistToFirestore(this.currentGameId, JSON.stringify(this.data));
            console.log('✅ UserProgress: Session saved successfully');
        } catch (error) {
            console.error('❌ UserProgress: Error saving session:', error);
        }
    }

    loadSessionHistory() {
        try {
            const stored = this.firebaseAdapter.getItem('kiwik_sessions');
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
        if (!this.isReady || !this.data) {
            return 'UserProgress not ready yet';
        }

        // Calculate stats
        const totalPhrases = Object.keys(this.data.phraseProgress).length;
        const masteredPhrases = Object.values(this.data.phraseProgress).filter(p => p.level === 'mastered').length;
        const masteredPercentage = totalPhrases > 0 ? Math.round((masteredPhrases / totalPhrases) * 100) : 0;
        
        const totalTexts = Object.keys(this.data.textLevels).length;
        const maxLevelTexts = Object.values(this.data.textLevels).filter(level => level >= 3).length;
        
        return {
            gamesPlayed: this.data.gamesPlayed,
            totalPhrases: totalPhrases,
            masteredPhrases: masteredPhrases,
            masteredPercentage: masteredPercentage,
            totalTexts: totalTexts,
            maxLevelTexts: maxLevelTexts,
            currentStage: this.data.stageState.currentStage,
            activeTexts: this.data.stageState.activeTexts.length,
            nextText: this.getNextTextForChallenge(),
            totalUniqueTexts: this.getTotalUniqueTexts()
        };
    }

    // Debug method for textStats
    getTextStatsDebug() {
        if (!this.isReady || !this.data || !this.data.textStats) {
            return 'UserProgress not ready yet';
        }
        
        return this.data.textStats;
    }

    // Clear all progress (for debugging)
    clearProgress() {
        console.log('🧹 UserProgress: Clearing all progress...');
        this.allContentData = {};
        this.data = this.createFreshProgressData();
        // this.saveUserProgress();
        console.log('✅ UserProgress: Progress cleared');
    }

    // Get phrase level
    getPhraseLevel(phraseId) {
        if (!this.data || !this.data.phraseProgress[phraseId]) {
            return 1; // Default level
        }
        return this.data.phraseProgress[phraseId].level;
    }

    // Get text level
    getTextLevel(textId) {
        if (!this.data || !this.data.textLevels[textId]) {
            return 1; // Default level
        }
        return this.data.textLevels[textId];
    }

    // Set phrase level
    setPhraseLevel(phraseId, level) {
        if (!this.data || !this.data.phraseProgress[phraseId]) {
            this.initializeSinglePhrase(phraseId);
        }
        this.data.phraseProgress[phraseId].level = level;
        // this.saveUserProgress();
    }

    // Get all phrase IDs for a text
    getPhrasesForText(textId) {
        if (!this.data) return [];
        
        return Object.keys(this.data.phraseProgress).filter(phraseId => 
            this.extractTextId(phraseId) === textId
        );
    }

    // increments round for text
    incrementRoundForText(textId) {
        const level = this.getTextLevel(textId);
        this.incrementTextStatsRound(textId, level);
        // add round to Game Analytics
        this.eventBus.emit('analytics:roundCompleted', {
            textId: textId,
            level: level
        });
    }

    // Check if phrase is completed for current stage
    isPhraseCompletedForStage(phraseId) {
        const phraseLevel = this.getPhraseLevel(phraseId);
        const textId = this.extractTextId(phraseId);
        const lockedLevel = this.data.stageState.lockedTextLevels[textId] || 1;
        
        if (phraseLevel === 'mastered') {
            return true;
        }
        
        if (typeof phraseLevel === 'number' && phraseLevel > lockedLevel) {
            return true;
        }
        
        return false;
    }

    // Get session attempts for a text
    getSessionAttemptsForText(textId) {
        if (!this.sessionData.attemptsByText[textId]) {
            return [];
        }
        return this.sessionData.attemptsByText[textId];
    }

    // Get current session data
    getCurrentSessionData() {
        return this.sessionData;
    }

    // Update stage state
    updateStageState(newState) {
        this.data.stageState = { ...this.data.stageState, ...newState };
        // this.saveUserProgress();
    }

    // Get stage state
    getStageState() {
        return this.data.stageState;
    }



}
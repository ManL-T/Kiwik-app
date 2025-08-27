// js/managers/UserProgress.js - Updated with Comprehensive Logging and Ready Event
class UserProgress {
    constructor(eventBus, gameData) {
        console.log(`📊 UserProgress: [${new Date().toISOString()}] Initializing with batch structure support...`);
        
        // Store references
        this.eventBus = eventBus;
        this.gameData = gameData;
        
        // localStorage key
        this.storageKey = 'kiwik_userProgress';
        
        // Data structure
        this.data = null;
        
        // Ready state
        this.isReady = false;

        // Session tracking for current gameplay session
        this.currentSession = {
            phraseAttempts: {} // Tracks current session data per phrase
        };
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load or initialize progress
        this.loadUserProgress();
        
        // Mark as ready and emit event (following project pattern)
        this.isReady = true;
        this.eventBus.emit('userProgress:ready');
        
        console.log(`✅ UserProgress: [${new Date().toISOString()}] Batch structure support complete and ready`);
    }
    
    // Setup event listeners
    setupEventListeners() {
        console.log('📊 UserProgress: Setting up event listeners...');
        
        // Wait for GameData to load before initializing phrases
        this.eventBus.on('gameData:loaded', () => {
            console.log('📊 UserProgress: GameData loaded, initializing phrase progress...');
            this.initializePhraseProgress();
        });
        
        // Handle game start
        this.eventBus.on('userProgress:gameStarted', () => {
            console.log('📊 UserProgress: Game started');
            // Could create new session here if needed
        });
        
        // Handle progress updates
        this.eventBus.on('userProgress:updatePhrase', (data) => {
            this.updatePhraseProgress(data);
        });

        // Track skipped phrases
        this.eventBus.on('userProgress:phraseSkipped', (phraseId) => {
            try {
                console.log(`📊 UserProgress: RECEIVED userProgress:phraseSkipped with phraseId: ${phraseId}`);
                this.initSessionPhrase(phraseId);  // THIS METHOD DOESN'T EXIST YET
                this.currentSession.phraseAttempts[phraseId].skipped = true;
                console.log(`📊 UserProgress: Tracked skip for ${phraseId}`);
            } catch (error) {
                console.error('📊 UserProgress: ERROR in skipToSolution handler:', error);
            }
        });

        // Track incorrect attempts  
        this.eventBus.on('challenge:wrongAnswer', (phraseId) => {
            console.log(`📊 UserProgress: RECEIVED challenge:wrongAnswer with phraseId: ${phraseId}`);
            this.initSessionPhrase(phraseId);
            this.currentSession.phraseAttempts[phraseId].incorrectCount++;
            console.log(`📊 UserProgress: Tracked incorrect attempt for ${phraseId}, total: ${this.currentSession.phraseAttempts[phraseId].incorrectCount}`);
        });

        // Track correct answers and check mastery
        this.eventBus.on('userProgress:correctAnswer', (phraseId) => {
            console.log(`📊 UserProgress: RECEIVED userProgress:correctAnswer with phraseId: ${phraseId}`);
            this.initSessionPhrase(phraseId);
            this.currentSession.phraseAttempts[phraseId].correct = true;
            console.log(`📊 UserProgress: Tracked correct answer for ${phraseId}`);
            this.checkAndProcessMastery(phraseId);
        });
                
        // Handle saving
        this.eventBus.on('userProgress:saveProgress', () => {
            this.saveUserProgress();
        });
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
                
                // Validate structure
                if (this.isValidProgressData(parsedData)) {
                    this.data = parsedData;
                    console.log('✅ UserProgress: Loaded existing valid progress data');
                } else {
                    console.log('⚠️ UserProgress: Invalid data structure, creating fresh data');
                    this.createFreshProgressData();
                }
            } else {
                console.log('📊 UserProgress: No existing data, creating fresh data');
                this.createFreshProgressData();
            }
            
            console.log('📊 UserProgress: Final data structure:', this.data);
            
        } catch (error) {
            console.error('❌ UserProgress: Error loading progress:', error);
            this.createFreshProgressData();
        }
    }
    
    // Validate progress data structure
    isValidProgressData(data) {
        console.log('📊 UserProgress: Validating data structure...');
        
        const isValid = data && 
                       typeof data.gamesPlayed === 'number' &&
                       data.currentPosition &&
                       data.currentPosition.batch &&
                       data.currentPosition.level &&
                       data.phraseProgress &&
                       typeof data.phraseProgress === 'object';
                       // Note: batchStructure is optional for migration
                       
        console.log('📊 UserProgress: Data validation result:', isValid);
        return isValid;
    }
    
    // Create fresh progress data structure
    createFreshProgressData() {
        console.log('📊 UserProgress: Creating fresh progress data structure...');
        
        this.data = {
            gamesPlayed: 0,
            currentPosition: {
                batch: [1, 2],
                level: "LEVEL_1",
                lastUpdated: new Date().toISOString()
            },
            batchStructure: null, // Will be generated by ChallengeManager
            phraseProgress: {}, // Will be populated when GameData loads
            sessions: [] // Keep for historical tracking
        };
        
        console.log('📊 UserProgress: Fresh data created:', this.data);
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
        phrases.forEach(phrase => {
            if (!this.data.phraseProgress[phrase.phraseId]) {
                this.data.phraseProgress[phrase.phraseId] = {
                    level: 1, // All phrases start at LEVEL_1
                    attempts: []
                };
                newPhrasesCount++;
            }
        });
        
        console.log('📊 UserProgress: Initialized', newPhrasesCount, 'new phrases');
        console.log('📊 UserProgress: Total phrases in progress:', Object.keys(this.data.phraseProgress).length);
        
        // Save after initialization
        this.saveUserProgress();
    }
    
    // Get batch structure
    getBatchStructure() {
        console.log('📊 UserProgress: Getting batch structure...');
        
        if (!this.data || !this.data.batchStructure) {
            console.log('📊 UserProgress: No batch structure found');
            return null;
        }
        
        console.log('📊 UserProgress: Returning batch structure:', this.data.batchStructure);
        return this.data.batchStructure;
    }
    
    // Set batch structure (called by ChallengeManager when first generated)
    setBatchStructure(batchStructure) {
        const timestamp = new Date().toISOString();
        console.log(`📊 UserProgress: [${timestamp}] setBatchStructure called with:`, batchStructure);
        
        if (!this.data) {
            console.error(`❌ UserProgress: [${timestamp}] CRITICAL ERROR - No data structure to update!`);
            console.error(`📊 UserProgress: [${timestamp}] this.data is:`, this.data);
            return false;
        }
        
        if (!this.isReady) {
            console.error(`❌ UserProgress: [${timestamp}] CRITICAL ERROR - UserProgress not ready when setBatchStructure called!`);
            return false;
        }
        
        console.log(`📊 UserProgress: [${timestamp}] Data structure exists, proceeding with batch structure save...`);
        console.log(`📊 UserProgress: [${timestamp}] Current data.batchStructure before update:`, this.data.batchStructure);
        
        this.data.batchStructure = batchStructure;
        
        console.log(`📊 UserProgress: [${timestamp}] Batch structure assigned to data.batchStructure:`, this.data.batchStructure);
        
        // Initialize batchCompletionState based on batch structure
        this.data.batchCompletionState = {
            level1: {},
            level2: {}
        };
        
        console.log(`📊 UserProgress: [${timestamp}] Initializing completion state for all batches...`);
        
        // Initialize completion state for all texts in all batches
        let textCount = 0;
        batchStructure.forEach((batch, batchIndex) => {
            console.log(`📊 UserProgress: [${timestamp}] Processing batch ${batchIndex + 1}:`, batch);
            batch.forEach(textNum => {
                const textId = `text_${textNum}`;
                this.data.batchCompletionState.level1[textId] = false;
                this.data.batchCompletionState.level2[textId] = false;
                textCount++;
                console.log(`📊 UserProgress: [${timestamp}] Initialized completion state for ${textId}`);
            });
        });
        
        console.log(`📊 UserProgress: [${timestamp}] Batch structure set, completion state initialized for ${textCount} texts`);
        console.log(`📊 UserProgress: [${timestamp}] Final batchCompletionState:`, this.data.batchCompletionState);
        
        // Save immediately after setting batch structure
        console.log(`📊 UserProgress: [${timestamp}] About to save to localStorage...`);
        const saveResult = this.saveUserProgress();
        
        if (!saveResult) {
            console.error(`❌ UserProgress: [${timestamp}] Save failed after setBatchStructure!`);
            return false;
        }
        
        // Validation after save
        console.log(`📊 UserProgress: [${timestamp}] Validating saved batch structure...`);
        const validationResult = this.validateBatchStructureSave(batchStructure, timestamp);
        
        if (!validationResult.success) {
            console.error(`❌ UserProgress: [${timestamp}] Validation failed:`, validationResult.error);
            console.log(`📊 UserProgress: [${timestamp}] Attempting one retry...`);
            
            // One retry attempt
            const retryResult = this.saveUserProgress();
            if (retryResult) {
                const retryValidation = this.validateBatchStructureSave(batchStructure, timestamp);
                if (retryValidation.success) {
                    console.log(`✅ UserProgress: [${timestamp}] Retry successful!`);
                    return true;
                } else {
                    console.error(`❌ UserProgress: [${timestamp}] Retry validation also failed:`, retryValidation.error);
                    return false;
                }
            } else {
                console.error(`❌ UserProgress: [${timestamp}] Retry save also failed`);
                return false;
            }
        }
        
        console.log(`✅ UserProgress: [${timestamp}] setBatchStructure completed successfully`);
        return true;
    }
    
    // Validation method
    validateBatchStructureSave(expectedBatchStructure, timestamp) {
        console.log(`📊 UserProgress: [${timestamp}] Starting validation...`);
        
        // Get what was actually saved
        const savedBatchStructure = this.getBatchStructure();
        
        console.log(`📊 UserProgress: [${timestamp}] Expected:`, expectedBatchStructure);
        console.log(`📊 UserProgress: [${timestamp}] Actually saved:`, savedBatchStructure);
        
        // Check if savedBatchStructure is null
        if (!savedBatchStructure) {
            return {
                success: false,
                error: 'getBatchStructure returned null after save',
                details: {
                    expected: expectedBatchStructure,
                    actual: savedBatchStructure,
                    dataStructure: this.data,
                    localStorage: localStorage.getItem(this.storageKey)
                }
            };
        }
        
        // Deep comparison
        const expectedStr = JSON.stringify(expectedBatchStructure);
        const actualStr = JSON.stringify(savedBatchStructure);
        
        if (expectedStr !== actualStr) {
            return {
                success: false,
                error: 'Saved batch structure differs from expected',
                details: {
                    expected: expectedBatchStructure,
                    actual: savedBatchStructure,
                    expectedStr,
                    actualStr
                }
            };
        }
        
        console.log(`✅ UserProgress: [${timestamp}] Validation successful - structures match`);
        return { success: true };
    }
    
    // Get resume position for ChallengeManager
    getResumePosition() {
        console.log('📊 UserProgress: Getting resume position...');
        
        if (!this.data || !this.data.currentPosition) {
            console.log('📊 UserProgress: No position data, returning default');
            return { batch: [1, 2], level: "LEVEL_1" };
        }
        
        const position = {
            batch: this.data.currentPosition.batch,
            level: this.data.currentPosition.level
        };
        
        console.log('📊 UserProgress: Returning resume position:', position);
        return position;
    }
    
    // Update phrase progress
    updatePhraseProgress(data) {
        console.log('📊 UserProgress: Updating phrase progress for:', data.phraseId);
        console.log('📊 UserProgress: Update data:', data);
        
        if (!this.data.phraseProgress[data.phraseId]) {
            console.log('📊 UserProgress: Phrase not found, creating new entry');
            this.data.phraseProgress[data.phraseId] = {
                level: 1,
                attempts: []
            };
        }
        const phrase = this.data.phraseProgress[data.phraseId];

        if (data.level === "mastered") {
            phrase.level = "mastered";
        }
        
        // Add new attempt
        const attempt = {
            timestamp: new Date().toISOString(),
            skipped: data.skipped || false,
            incorrectCount: data.incorrectCount || 0,
            peeked: data.peeked || false,
            peekedUnits: data.peekedUnits || [],
            correctAnswer: data.correctAnswer || false
        };
        
        phrase.attempts.push(attempt);
        console.log('📊 UserProgress: Added attempt:', attempt);
        console.log('📊 UserProgress: Updated phrase data:', phrase);

        
        // TODO: Add skip detection logic here
        // TODO: Add level advancement logic here
    }
    
    // Update current position (called after batch completion)
    updateCurrentPosition(batch, level) {
        console.log('📊 UserProgress: Updating current position to batch:', batch, 'level:', level);
        
        this.data.currentPosition = {
            batch: batch,
            level: level,
            lastUpdated: new Date().toISOString()
        };
        
        console.log('📊 UserProgress: Updated position:', this.data.currentPosition);
        this.saveUserProgress();
    }

    // Save current session attempt to phraseProgress (called after each challenge)
    saveSessionAttempt(phraseId) {
        const sessionData = this.currentSession.phraseAttempts[phraseId];
        if (!sessionData) return; // No session data to save
        
        // Create attempt record from session data
        const attempt = {
            timestamp: new Date().toISOString(),
            skipped: sessionData.skipped,
            incorrectCount: sessionData.incorrectCount,
            peeked: false, // TODO: Will need this for LEVEL_2
            peekedUnits: [], // TODO: Will need this for LEVEL_2  
            correctAnswer: sessionData.correct
        };
        
        // Add to phraseProgress attempts
        if (!this.data.phraseProgress[phraseId]) {
            this.initializePhraseProgress(phraseId);
        }
        
        this.data.phraseProgress[phraseId].attempts.push(attempt);
        
        // Save to localStorage
        this.saveUserProgress();
        
        console.log(`📊 UserProgress: Saved session attempt for ${phraseId}:`, attempt);
    }


    // Initialize session tracking for a phrase if not exists
    initSessionPhrase(phraseId) {
        if (!this.currentSession.phraseAttempts[phraseId]) {
            this.currentSession.phraseAttempts[phraseId] = {
                skipped: false,
                correct: false,
                incorrectCount: 0
            };
        }
    }

    // Check mastery condition and update if mastered
    checkAndProcessMastery(phraseId) {
        const attempt = this.currentSession.phraseAttempts[phraseId];
        
        // Always save the session attempt first
        this.saveSessionAttempt(phraseId);
        
        // Then check for mastery
        if (attempt.skipped && attempt.correct && attempt.incorrectCount === 0) {
            // Mark as mastered
            this.data.phraseProgress[phraseId].level = "mastered";
            console.log(`📊 UserProgress: Phrase mastered: ${phraseId}`);
            
            
            // Save again with mastery status
            this.saveUserProgress();

            // Check if this completed the entire text
            this.checkTextMastery(phraseId);
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
            console.log(`🎉 UserProgress: Text ${textId} is now MASTERED! All phrases completed.`);
            this.eventBus.emit('userProgress:textMastered', textId);
        } else {
            console.log(`📊 UserProgress: Text ${textId} not yet mastered`);
        }
    }

    // Check if phrase is mastered (for ChallengeManager)
    isPhraseMastered(phraseId) {
        if (!this.data.phraseProgress[phraseId]) return false;
        return this.data.phraseProgress[phraseId].level === "mastered";
    }


    
    // Save progress to localStorage
    saveUserProgress() {
        const timestamp = new Date().toISOString();
        console.log(`📊 UserProgress: [${timestamp}] saveUserProgress called`);
        console.log(`📊 UserProgress: [${timestamp}] Data to save:`, this.data);
        
        try {
            console.log(`📊 UserProgress: [${timestamp}] Attempting JSON.stringify...`);
            const jsonString = JSON.stringify(this.data, null, 2);
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
                console.log(`📊 UserProgress: [${timestamp}] Read-back batchStructure:`, parsed.batchStructure);
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
        this.data.phraseProgress[phraseId] = {
            level: 1,
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
    
    // Get current data (for debugging)
    getCurrentData() {
        return this.data;
    }
}
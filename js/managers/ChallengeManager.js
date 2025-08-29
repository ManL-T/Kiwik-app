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

        // Batch Management System - will be set from UserProgress
        this.currentBatch = null;
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
        
        this.eventBus.on('userProgress:ready', () => {
            const timestamp = new Date().toISOString();
            console.log(`🎯 ChallengeManager: [${timestamp}] userProgress:ready event received`);
            this.userProgressReady = true;
            this.checkInitializationReadiness(timestamp);
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
        
        // Generate or load batch structure
        console.log(`🎯 ChallengeManager: [${timestamp}] Proceeding to batch structure initialization...`);
        this.initializeBatchStructure(textPhraseCounts, timestamp);
    }
    
    // Initialize batch structure (generate if first time, load if exists) - OPTION A: Comprehensive logging
    initializeBatchStructure(textPhraseCounts, timestamp = new Date().toISOString()) {
        console.log(`🎯 ChallengeManager: [${timestamp}] initializeBatchStructure called`);
        console.log(`🎯 ChallengeManager: [${timestamp}] Input textPhraseCounts:`, textPhraseCounts);
        console.log(`🎯 ChallengeManager: [${timestamp}] UserProgress ready status:`, this.userProgress.isReady);
        
        // Check if batch structure already exists
        console.log(`🎯 ChallengeManager: [${timestamp}] Checking for existing batch structure...`);
        let batchStructure = this.userProgress.getBatchStructure();
        console.log(`🎯 ChallengeManager: [${timestamp}] Existing batch structure:`, batchStructure);
        
        if (!batchStructure) {
            console.log(`🎯 ChallengeManager: [${timestamp}] No existing batch structure found - generating new one`);
            console.log(`🎯 ChallengeManager: [${timestamp}] Calling generateBatchStructure with phrase counts:`, textPhraseCounts);
            
            batchStructure = this.generateBatchStructure(textPhraseCounts, timestamp);
            
            console.log(`🎯 ChallengeManager: [${timestamp}] Generated batch structure:`, batchStructure);
            console.log(`🎯 ChallengeManager: [${timestamp}] Calling UserProgress.setBatchStructure...`);
            
            const saveSuccess = this.userProgress.setBatchStructure(batchStructure);
            console.log(`🎯 ChallengeManager: [${timestamp}] setBatchStructure returned:`, saveSuccess);
            
            if (!saveSuccess) {
                console.error(`❌ ChallengeManager: [${timestamp}] CRITICAL ERROR: Failed to save batch structure!`);
                return;
            }
        } else {
            console.log(`🎯 ChallengeManager: [${timestamp}] Using existing batch structure with ${batchStructure.length} batches`);
            batchStructure.forEach((batch, index) => {
                const phraseCount = batch.reduce((sum, textNum) => sum + textPhraseCounts[textNum - 1], 0);
                console.log(`🎯 ChallengeManager: [${timestamp}] Existing batch ${index + 1}: texts [${batch.join(', ')}] = ${phraseCount} phrases`);
            });
        }
        
        // Set up current position from UserProgress
        console.log(`🎯 ChallengeManager: [${timestamp}] Getting resume position from UserProgress...`);
        const resumePosition = this.userProgress.getResumePosition();
        console.log(`🎯 ChallengeManager: [${timestamp}] Resume position:`, resumePosition);
        
        this.currentBatch = resumePosition.batch;
        this.currentTextIndex = resumePosition.batch[0] - 1; // Convert to 0-based index
        this.currentPhraseIndex = 0; // Always start at beginning of text
        
        console.log(`🎯 ChallengeManager: [${timestamp}] Set currentBatch:`, this.currentBatch);
        console.log(`🎯 ChallengeManager: [${timestamp}] Set currentTextIndex: ${this.currentTextIndex} (for text_${this.currentTextIndex + 1})`);
        console.log(`🎯 ChallengeManager: [${timestamp}] Set currentPhraseIndex:`, this.currentPhraseIndex);
        
        // Initialize batch completion state from UserProgress
        console.log(`🎯 ChallengeManager: [${timestamp}] Getting batch completion state from UserProgress...`);
        const userData = this.userProgress.getCurrentData();
        if (userData && userData.batchCompletionState) {
            this.batchCompletionState = userData.batchCompletionState;
            console.log(`🎯 ChallengeManager: [${timestamp}] Loaded batch completion state:`, this.batchCompletionState);
        } else {
            console.warn(`⚠️ ChallengeManager: [${timestamp}] No batch completion state found in UserProgress data`);
            console.log(`🎯 ChallengeManager: [${timestamp}] UserProgress data:`, userData);
        }
        
        console.log(`✅ ChallengeManager: [${timestamp}] Batch structure initialization complete`);
    }
    
    // Generate batch structure using phrase-count algorithm - OPTION A: Comprehensive logging
    generateBatchStructure(textPhraseCounts, timestamp = new Date().toISOString()) {
        console.log(`🎯 ChallengeManager: [${timestamp}] generateBatchStructure called`);
        console.log(`🎯 ChallengeManager: [${timestamp}] Input phrase counts: [${textPhraseCounts.join(', ')}]`);
        console.log(`🎯 ChallengeManager: [${timestamp}] Total texts to process: ${textPhraseCounts.length}`);
        console.log(`🎯 ChallengeManager: [${timestamp}] Algorithm: 6-10 phrases per batch with exception handling`);
        
        const batchStructure = [];
        let currentBatch = [];
        let currentPhraseCount = 0;
        
        console.log(`🎯 ChallengeManager: [${timestamp}] Starting batch generation algorithm...`);
        
        for (let i = 0; i < textPhraseCounts.length; i++) {
            const textNum = i + 1; // Convert to 1-based text number
            const phraseCount = textPhraseCounts[i];
            
            console.log(`🎯 ChallengeManager: [${timestamp}] --- Processing text_${textNum} (index ${i}) with ${phraseCount} phrases ---`);
            console.log(`🎯 ChallengeManager: [${timestamp}] Current batch before decision: [${currentBatch.join(', ')}] (${currentPhraseCount} phrases)`);
            
            // Check if adding this text would exceed maximum (10 phrases)
            const wouldExceedMax = currentPhraseCount + phraseCount > 10;
            const currentBatchHasTexts = currentBatch.length > 0;
            
            console.log(`🎯 ChallengeManager: [${timestamp}] Adding ${phraseCount} to ${currentPhraseCount} = ${currentPhraseCount + phraseCount} phrases`);
            console.log(`🎯 ChallengeManager: [${timestamp}] Would exceed max (10)? ${wouldExceedMax}`);
            console.log(`🎯 ChallengeManager: [${timestamp}] Current batch has texts? ${currentBatchHasTexts}`);
            
            if (wouldExceedMax && currentBatchHasTexts) {
                // Current batch would exceed limit, decide whether to close it
                console.log(`🎯 ChallengeManager: [${timestamp}] Would exceed limit - evaluating current batch for closure...`);
                
                if (currentPhraseCount >= 6) {
                    console.log(`🎯 ChallengeManager: [${timestamp}] ✅ RULE SATISFIED: Closing batch [${currentBatch.join(', ')}] with ${currentPhraseCount} phrases (meets 6-10 rule)`);
                    batchStructure.push([...currentBatch]);
                } else {
                    // Current batch is under minimum, check for stranded text scenario
                    console.log(`🎯 ChallengeManager: [${timestamp}] ⚠️  UNDER MINIMUM: Current batch [${currentBatch.join(', ')}] has only ${currentPhraseCount} phrases`);
                    
                    // If the next text is too large to combine, we have a stranded situation
                    const remainingSpace = 10 - currentPhraseCount;
                    const canCombine = phraseCount <= remainingSpace;
                    
                    console.log(`🎯 ChallengeManager: [${timestamp}] Remaining space in batch: ${remainingSpace} phrases`);
                    console.log(`🎯 ChallengeManager: [${timestamp}] Can combine with text_${textNum}? ${canCombine}`);
                    
                    if (!canCombine) {
                        console.warn(`🎯 ChallengeManager: [${timestamp}] 🚨 EXCEPTION: Creating under-minimum batch due to constraints`);
                        console.warn(`🎯 ChallengeManager: [${timestamp}] 🚨 EXCEPTION: Batch [${currentBatch.join(', ')}] with ${currentPhraseCount} phrases cannot be combined with text_${textNum} (${phraseCount} phrases) without exceeding 10-phrase limit`);
                        batchStructure.push([...currentBatch]);
                    } else {
                        console.log(`🎯 ChallengeManager: [${timestamp}] Can still combine - continuing with current batch`);
                        // Don't close the batch yet, continue processing
                        currentBatch.push(textNum);
                        currentPhraseCount += phraseCount;
                        console.log(`🎯 ChallengeManager: [${timestamp}] Added text_${textNum} to current batch: [${currentBatch.join(', ')}] (${currentPhraseCount} phrases)`);
                        continue;
                    }
                }
                
                // Start new batch with current text
                console.log(`🎯 ChallengeManager: [${timestamp}] Starting new batch with text_${textNum}`);
                currentBatch = [textNum];
                currentPhraseCount = phraseCount;
            } else {
                // Add text to current batch
                console.log(`🎯 ChallengeManager: [${timestamp}] ✅ ADDING: text_${textNum} to current batch (within limits)`);
                currentBatch.push(textNum);
                currentPhraseCount += phraseCount;
            }
            
            console.log(`🎯 ChallengeManager: [${timestamp}] Current batch after processing: [${currentBatch.join(', ')}] (${currentPhraseCount} phrases)`);
            console.log(`🎯 ChallengeManager: [${timestamp}] Completed batches so far: ${batchStructure.length}`);
        }
        
        // Close final batch
        console.log(`🎯 ChallengeManager: [${timestamp}] --- Processing final batch ---`);
        console.log(`🎯 ChallengeManager: [${timestamp}] Final batch to close: [${currentBatch.join(', ')}] (${currentPhraseCount} phrases)`);
        
        if (currentBatch.length > 0) {
            if (currentPhraseCount >= 6) {
                console.log(`🎯 ChallengeManager: [${timestamp}] ✅ RULE SATISFIED: Closing final batch [${currentBatch.join(', ')}] with ${currentPhraseCount} phrases (meets 6-10 rule)`);
                batchStructure.push([...currentBatch]);
            } else {
                console.warn(`🎯 ChallengeManager: [${timestamp}] 🚨 EXCEPTION: Final batch under minimum`);
                console.warn(`🎯 ChallengeManager: [${timestamp}] 🚨 EXCEPTION: Final batch [${currentBatch.join(', ')}] has only ${currentPhraseCount} phrases (under 6-phrase minimum)`);
                batchStructure.push([...currentBatch]);
            }
        } else {
            console.log(`🎯 ChallengeManager: [${timestamp}] No final batch to close (empty)`);
        }
        
        console.log(`✅ ChallengeManager: [${timestamp}] Batch generation complete!`);
        console.log(`🎯 ChallengeManager: [${timestamp}] Generated ${batchStructure.length} batches:`, batchStructure);
        
        // Validate batch structure
        console.log(`🎯 ChallengeManager: [${timestamp}] Starting validation...`);
        this.validateBatchStructure(batchStructure, textPhraseCounts, timestamp);
        
        return batchStructure;
    }
    
    // Validate generated batch structure (debug helper) - OPTION A: Comprehensive logging
    validateBatchStructure(batchStructure, textPhraseCounts, timestamp = new Date().toISOString()) {
        console.log(`🔍 ChallengeManager: [${timestamp}] validateBatchStructure called`);
        console.log(`🔍 ChallengeManager: [${timestamp}] Validating ${batchStructure.length} batches...`);
        
        let totalTextsInBatches = 0;
        let totalPhrasesInBatches = 0;
        let exceptionsFound = 0;
        let errorsFound = 0;
        
        batchStructure.forEach((batch, batchIndex) => {
            console.log(`🔍 ChallengeManager: [${timestamp}] --- Validating Batch ${batchIndex + 1} ---`);
            console.log(`🔍 ChallengeManager: [${timestamp}] Batch ${batchIndex + 1} texts: [${batch.join(', ')}]`);
            
            const batchPhraseCounts = batch.map(textNum => textPhraseCounts[textNum - 1]);
            const totalPhrases = batch.reduce((sum, textNum) => {
                return sum + textPhraseCounts[textNum - 1]; // Convert to 0-based index
            }, 0);
            
            console.log(`🔍 ChallengeManager: [${timestamp}] Batch ${batchIndex + 1} phrase counts per text: [${batchPhraseCounts.join(', ')}]`);
            console.log(`🔍 ChallengeManager: [${timestamp}] Batch ${batchIndex + 1} total phrases: ${totalPhrases}`);
            
            totalTextsInBatches += batch.length;
            totalPhrasesInBatches += totalPhrases;
            
            // Validation checks
            if (totalPhrases < 6) {
                console.warn(`⚠️ ChallengeManager: [${timestamp}] Batch ${batchIndex + 1} UNDER MINIMUM: ${totalPhrases} < 6 phrases - EXCEPTION CASE`);
                exceptionsFound++;
            } else if (totalPhrases > 10) {
                console.error(`❌ ChallengeManager: [${timestamp}] Batch ${batchIndex + 1} OVER MAXIMUM: ${totalPhrases} > 10 phrases - ERROR!`);
                errorsFound++;
            } else {
                console.log(`✅ ChallengeManager: [${timestamp}] Batch ${batchIndex + 1} VALID: ${totalPhrases} phrases (within 6-10 range)`);
            }
        });
        
        // Overall validation summary
        console.log(`🔍 ChallengeManager: [${timestamp}] --- Validation Summary ---`);
        console.log(`🔍 ChallengeManager: [${timestamp}] Total batches generated: ${batchStructure.length}`);
        console.log(`🔍 ChallengeManager: [${timestamp}] Total texts in batches: ${totalTextsInBatches} (expected: ${textPhraseCounts.length})`);
        console.log(`🔍 ChallengeManager: [${timestamp}] Total phrases in batches: ${totalPhrasesInBatches} (expected: ${textPhraseCounts.reduce((a, b) => a + b, 0)})`);
        console.log(`🔍 ChallengeManager: [${timestamp}] Exceptions found (under 6 phrases): ${exceptionsFound}`);
        console.log(`🔍 ChallengeManager: [${timestamp}] Errors found (over 10 phrases): ${errorsFound}`);
        
        // Check if all texts are accounted for
        const allTextsInBatches = batchStructure.flat();
        const expectedTexts = Array.from({ length: textPhraseCounts.length }, (_, i) => i + 1);
        const missingTexts = expectedTexts.filter(textNum => !allTextsInBatches.includes(textNum));
        const duplicateTexts = allTextsInBatches.filter((textNum, index) => allTextsInBatches.indexOf(textNum) !== index);
        
        if (missingTexts.length > 0) {
            console.error(`❌ ChallengeManager: [${timestamp}] Missing texts: [${missingTexts.join(', ')}]`);
            errorsFound++;
        }
        
        if (duplicateTexts.length > 0) {
            console.error(`❌ ChallengeManager: [${timestamp}] Duplicate texts: [${duplicateTexts.join(', ')}]`);
            errorsFound++;
        }
        
        if (errorsFound === 0) {
            console.log(`✅ ChallengeManager: [${timestamp}] Batch structure validation PASSED (${exceptionsFound} exceptions within acceptable range)`);
        } else {
            console.error(`❌ ChallengeManager: [${timestamp}] Batch structure validation FAILED with ${errorsFound} errors`);
        }
        
        console.log(`✅ ChallengeManager: [${timestamp}] Validation complete`);
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
        
        // Move to next phrase - UserProgress will handle level progression
        this.currentPhraseIndex++;
        
        // Check if there's a next phrase and continue
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

    
    // Get current phrase ID (using batch structure)
    getCurrentPhraseId() {
        console.log('🎯 ChallengeManager: Finding next available phrase using UserProgress...');
        
        // Get current batch from UserProgress batch cycling
        const currentBatch = this.userProgress.getCurrentBatchFromCycling();
        console.log('🎯 ChallengeManager: Current batch from cycling:', currentBatch);
        
        // Start from current position or beginning of batch
        let textIndex = this.currentTextIndex;
        let phraseIndex = this.currentPhraseIndex;
        
        // Try to find an available phrase starting from current position
        for (let i = 0; i < currentBatch.length; i++) {
            const actualTextIndex = (textIndex + i) % currentBatch.length;
            const textNum = currentBatch[actualTextIndex];
            const textId = `text_${textNum}`;
            
            console.log(`🎯 ChallengeManager: Checking text ${textId} (textNum: ${textNum})`);
            
            // Skip fully mastered texts
            if (this.userProgress.isTextMastered(textId)) {
                console.log(`🎯 ChallengeManager: Skipping ${textId} - fully mastered`);
                continue;
            }
            
            // Get all phrases for this text
            const textPhrases = this.gameData.getPhrasesForText(textId);
            console.log(`🎯 ChallengeManager: ${textId} has ${textPhrases.length} phrases`);
            
            // Start from current phrase index if this is the current text, otherwise start from 0
            const startPhraseIndex = (i === 0) ? phraseIndex : 0;
            
            // Look for available phrases in this text
            for (let j = startPhraseIndex; j < textPhrases.length; j++) {
                const phrase = textPhrases[j];
                const phraseId = phrase.phraseId;
                
                console.log(`🎯 ChallengeManager: Checking phrase ${phraseId}`);
                
                // Skip mastered phrases
                if (this.userProgress.isPhraseMastered(phraseId)) {
                    console.log(`🎯 ChallengeManager: Skipping ${phraseId} - mastered`);
                    continue;
                }
                
                // Found an available phrase!
                console.log(`✅ ChallengeManager: Found available phrase: ${phraseId}`);
                
                // Update current position
                this.currentTextIndex = actualTextIndex;
                this.currentPhraseIndex = j;
                this.currentBatch = currentBatch; // Update cached batch
                
                // Get text level and set current level for challenge creation
                const textLevel = this.userProgress.getTextLevel(textId);
                this.currentLevel = textLevel === 1 ? 'LEVEL_1' : 'LEVEL_2';
                this.currentRecipe = this.recipes[this.currentLevel];
                
                console.log(`🎯 ChallengeManager: Text ${textId} is at level ${textLevel}, using ${this.currentLevel} challenges`);
                
                return phraseId;
            }
            
            console.log(`🎯 ChallengeManager: No available phrases in ${textId}`);
        }
        
        // No available phrases in current batch
        console.log('🎯 ChallengeManager: No available phrases in current batch - advancing to next batch');
        
        // Try to advance to next batch
        const nextBatch = this.userProgress.advanceToNextBatch();
        if (nextBatch) {
            console.log('🎯 ChallengeManager: Advanced to next batch:', nextBatch);
            
            // Reset position and try again
            this.currentTextIndex = 0;
            this.currentPhraseIndex = 0;
            
            // Recursive call to try the new batch
            return this.getCurrentPhraseId();
        }
        
        // No more batches available
        console.log('🎯 ChallengeManager: No more available phrases in any batch - game complete?');
        return null;
    }

    setBatchStructure(batchStructure) {
        console.log(`📊 UserProgress: setBatchStructure called with:`, batchStructure);
        if (!this.data) {
            console.error(`❌ UserProgress: CRITICAL - No data structure when setting batch structure!`);
            return false;
        }
        this.data.batchStructure = batchStructure;
        console.log(`📊 UserProgress: batchStructure set to:`, this.data.batchStructure);
        return this.saveUserProgress();
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
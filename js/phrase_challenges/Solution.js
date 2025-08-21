// js/phrase_challenges/Solution.js - Remove Direct Timer Control
class Solution {
    constructor(eventBus) {
        console.log('🎯 Solution: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Phase state
        this.isActive = false;
        this.selectedIndex = 0;
        this.correctIndex = -1;
        this.options = [];
        this.phraseTarget = '';
        this.feedbackTimeout = null;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ Solution: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Remove existing listeners first to prevent duplicates
        if (this.spaceHandler) {
            this.eventBus.off('navigation:spacePressed', this.spaceHandler);
        }
        if (this.enterHandler) {
            this.eventBus.off('navigation:enterPressed', this.enterHandler);
        }
        if (this.timerExpiredHandler) {
            this.eventBus.off('timer:expired', this.timerExpiredHandler);
        }
        if (this.templateLoadedHandler) {
            this.eventBus.off('ui:templateLoaded', this.templateLoadedHandler);
        }
        
        this.spaceHandler = () => {
            if (!this.isActive) return;
            this.handleSpace();
        };
        
        this.enterHandler = () => {
            if (!this.isActive) return;
            this.handleEnter();
        };
        
        this.timerExpiredHandler = () => {
            if (!this.isActive) return;
            this.handleTimerExpired();
        };
        
        this.templateLoadedHandler = (templatePath) => {
            if (!this.isActive) return;
            if (templatePath.includes('game.html')) {
                this.setupSolutionDisplay();
            }
        };
        
        this.eventBus.on('navigation:spacePressed', this.spaceHandler);
        this.eventBus.on('navigation:enterPressed', this.enterHandler);
        this.eventBus.on('timer:expired', this.timerExpiredHandler);
        this.eventBus.on('ui:templateLoaded', this.templateLoadedHandler);
    }
    
    // Start this phase
    start(data) {
        console.log('🎯 Solution: Starting phase with data:', data);
        this.isActive = false; // Don't activate immediately
        this.selectedIndex = 0;
        this.phraseTarget = data.phraseTarget;
        
        // Prepare answer options
        this.prepareOptions(data);
        
        // Re-establish event listeners to ensure they work
        this.setupEventListeners();
        
        // REMOVED: Timer start - now handled by ChallengeManager
        
        // Set up display and activate after short delay
        setTimeout(() => {
            this.setupSolutionDisplay();
            this.isActive = true;
            console.log('🎯 Solution: Phase activated with', this.options.length, 'options');
        }, 100);
    }
    
    // Setup solution display when template loads
    setupSolutionDisplay() {
        console.log('🎯 Solution: Setting up solution display');
        
        // Show phrase in header (no highlighting)
        this.eventBus.emit('ui:updateHighlightedText', {
            fullSentence: this.phraseTarget,
            unitTarget: ''
        });
        
        // Render multiple choice interface
        this.renderSolutionInterface();
    }
    
    // Prepare shuffled answer options
    prepareOptions(data) {
        const allOptions = [data.primaryTranslation, ...data.distractors.slice(0, 3)];
        this.options = this.shuffleArray([...allOptions]);
        this.correctIndex = this.options.indexOf(data.primaryTranslation);
        
        console.log('🎯 Solution: Options prepared, correct answer at index:', this.correctIndex);
        console.log('🎯 Solution: Solution options:', this.options);
    }
    
    // Shuffle array utility
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    // Render multiple choice interface
    renderSolutionInterface() {
        console.log('🎯 Solution: Rendering solution interface');
        
        const solutionHTML = this.options.map((option, index) => {
            const isSelected = index === this.selectedIndex;
            const cssClass = isSelected ? 'solution-option solution-option-selected' : 'solution-option';
            return `<div class="${cssClass}">${option}</div>`;
        }).join('');
        
        this.eventBus.emit('ui:updateDisplayChoice', solutionHTML);
    }
    
    // Handle Space key (cycle to next answer option)
    handleSpace() {
        console.log('🎯 Solution: handleSpace called, isActive:', this.isActive);
        if (!this.isActive) return;
        
        console.log('🎯 Solution: Space pressed - cycling to next option');
        this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
        console.log('🎯 Solution: Selected index now:', this.selectedIndex);
        
        // Update visual selection
        this.renderSolutionInterface();
    }
    
    // Handle Enter key (submit selected answer)
    handleEnter() {
        console.log('🎯 Solution: handleEnter called, isActive:', this.isActive);
        if (!this.isActive) return;
        
        console.log('🎯 Solution: Enter pressed - submitting answer');
        console.log('🎯 Solution: Selected index:', this.selectedIndex, 'Correct index:', this.correctIndex);
        
        const isCorrect = this.selectedIndex === this.correctIndex;
        
        if (isCorrect) {
            console.log('🎯 Solution: Correct answer! Showing green feedback');
            this.showAnswerFeedback('correct');
        } else {
            console.log('🎯 Solution: Incorrect answer! Showing red feedback');
            this.showAnswerFeedback('incorrect');
        }
    }
    
    // Show answer feedback with colors
    showAnswerFeedback(feedbackType) {
        console.log('🎯 Solution: Showing feedback:', feedbackType);
        
        // Clear any existing timeout
        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
            this.feedbackTimeout = null;
        }
        
        // Render interface with feedback colors
        const solutionHTML = this.options.map((option, index) => {
            let cssClass = 'solution-option';
            
            if (index === this.selectedIndex) {
                // Color the selected option based on correctness
                cssClass += feedbackType === 'correct' ? ' solution-option-correct' : ' solution-option-incorrect';
            }
            
            return `<div class="${cssClass}">${option}</div>`;
        }).join('');
        
        this.eventBus.emit('ui:updateDisplayChoice', solutionHTML);
        
        // Complete phase after feedback duration
        this.feedbackTimeout = setTimeout(() => {
            if (!this.isActive) {
                console.log('🎯 Solution: Timeout fired but phase is inactive - exiting');
                return;
            }
            
            if (feedbackType === 'correct') {
                this.complete('correct');
            } else {
                // For incorrect answers, don't complete - just emit wrongAnswer and reset
                this.eventBus.emit('challenge:wrongAnswer');
                this.resetToSelection();
            }
        }, 1000);
    }
    
    // Handle timer expiration
    handleTimerExpired() {
        console.log('🎯 Solution: Timer expired during solution phase');
        
        // Show time expired overlay
        this.eventBus.emit('ui:showOverlay', {
            templatePath: 'templates/overlays/time-expired.html',
            duration: 2000
        });
        
        // Complete phase after overlay duration
        setTimeout(() => {
            if (!this.isActive) return;
            this.complete('timeout');
        }, 2000);
    }
    
    // Reset to selection mode (after incorrect answer)
    resetToSelection() {
        console.log('🎯 Solution: Resetting to selection mode (same positions)');
        
        if (!this.isActive) {
            console.log('🎯 Solution: resetToSelection called after cleanup - ignoring');
            return;
        }
        
        // Keep same positions, just remove feedback colors
        this.renderSolutionInterface();
    }
    
    // Complete this phase
    complete(result) {
        console.log('🎯 Solution: Completing with result:', result);
        this.isActive = false;
        
        // REMOVED: Timer stop - now handled by ChallengeManager
        
        // Clear any pending timeout
        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
            this.feedbackTimeout = null;
        }
        
        if (result === 'correct') {
            this.eventBus.emit('solution:correct');
        } else {
            this.eventBus.emit('solution:incorrect');
        }
    }
    
    // Cleanup method
    cleanup() {
        console.log('🎯 Solution: Cleaning up...');
        this.isActive = false;
        
        // REMOVED: Timer stop - now handled by ChallengeManager
        
        // Clear any pending timeout
        if (this.feedbackTimeout) {
            clearTimeout(this.feedbackTimeout);
            this.feedbackTimeout = null;
        }
        
        this.eventBus.off('navigation:spacePressed', this.spaceHandler);
        this.eventBus.off('navigation:enterPressed', this.enterHandler);
        this.eventBus.off('timer:expired', this.timerExpiredHandler);
        this.eventBus.off('ui:templateLoaded', this.templateLoadedHandler);
        
        console.log('✅ Solution: Cleanup complete');
    }
}
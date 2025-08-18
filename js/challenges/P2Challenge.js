// js/challenges/P2Challenge.js
// P2Challenge - extends P1Challenge with distinguishing logs for Step 1
class P2Challenge extends P1Challenge {
    constructor(eventBus, uiRenderer, phraseId) {
        console.log('🎯 P2Challenge: Received phraseId parameter:', phraseId);
        console.log('🎯 P2Challenge: Initializing...');
        
        // Call parent constructor
        super(eventBus, uiRenderer, phraseId);
        
        console.log('✅ P2Challenge: Initialization complete');
    }
    
    // Override start method to add distinguishing log
    start() {
        console.log('🎯 P2Challenge: Starting challenge...');
        
        // Call parent start method
        super.start();
        
        console.log('🎯 P2Challenge: Challenge started (P2 mode)');
    }
    
    // Override cleanup method to add distinguishing log
    cleanup() {
        console.log('🎯 P2Challenge: Cleaning up...');
        
        // Call parent cleanup method
        super.cleanup();
        
        console.log('✅ P2Challenge: Cleanup complete (P2 mode)');
    }
}
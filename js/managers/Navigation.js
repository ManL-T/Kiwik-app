// js/managers/Navigation.js
class Navigation {
    constructor(eventBus) {
        console.log('🧭 Navigation: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ Navigation: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyPress(event);
        });
        // Template click events
        document.addEventListener('click', (event) => {
            this.handleClick(event);
        });
    }

    handleClick(event) {
        // Check if clicked element has close-btn class
        if (event.target.classList.contains('close-btn')) {
            event.preventDefault();
            this.goBackToLauncher();
        }
    }
    
    // Central key handling
    handleKeyPress(event) {
        console.log('🧭 Navigation: Key pressed:', event.key); // ADD THIS LINE
        const key = event.key;
        
        // Route keys based on key type
        if (key === 'Escape') {
            event.preventDefault();
            this.goBackToLauncher();  // This works regardless of screen
        } else if (key === 'Enter') {
            event.preventDefault();
            this.eventBus.emit('navigation:enterPressed');
        } else if (key === ' ') {
            event.preventDefault();
            this.eventBus.emit('navigation:spacePressed');
        }
    }
    
    // Navigation actions
    goBackToLauncher() {
        window.location.href = 'launcher.html';
    }
    
}
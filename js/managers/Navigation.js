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
        const currentScreen = this.getCurrentScreen();
        const key = event.key;
        
        // Route keys based on context
        if (key === 'Escape') {
            event.preventDefault();
            this.goBackToLauncher();  // Direct action - get out immediately!
        } else if (key === 'Enter') {
            event.preventDefault();
            this.eventBus.emit(`navigation:enterPressed:${currentScreen}`);
        } else if (key === ' ') {
            event.preventDefault();
            this.eventBus.emit(`navigation:spacePressed:${currentScreen}`);
        }
    }
    
    // Navigation actions
    goBackToLauncher() {
        window.location.href = 'launcher.html';
    }
    
    // Screen detection
    getCurrentScreen() {
        const app = document.getElementById('app');
        if (app.innerHTML.includes('game-load-screen')) {
            return 'gameLoad';
        }
        if (app.innerHTML.includes('game-screen')) {
            return 'gameScreen';
        }
        return 'unknown';
    }
}
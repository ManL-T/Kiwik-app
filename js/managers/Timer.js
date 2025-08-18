// js/managers/Timer.js
class Timer {
    constructor(eventBus) {
        console.log('⏰ Timer: Initializing...');
        
        // Store EventBus reference
        this.eventBus = eventBus;
        
        // Timer state
        this.currentTime = 15;
        this.timeoutId = null;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ Timer: Initialization complete');
    }
    
    // Setup event listeners
    setupEventListeners() {
        this.eventBus.on('timer:start', () => {
            this.start();
        });
        
        this.eventBus.on('timer:pause', () => {
            this.pause();
        });
        
        this.eventBus.on('timer:resume', () => {
            this.resume();
        });
        
        this.eventBus.on('timer:reset', () => {
            this.reset();
        });
        
        this.eventBus.on('timer:stop', () => {
            this.stop();
        });
    }
    
    // Start countdown (schedules first tick)
    start() {
        console.log('⏰ Timer: Starting countdown from', this.currentTime);
        // Emit initial value for display
        this.eventBus.emit('timer:tick', this.currentTime);
        this.scheduleNextTick();
    }
    
    // Pause countdown (clears timeout)
    pause() {
        console.log('⏰ Timer: Pausing countdown');
        this.clearCurrentTimeout();
    }
    
    // Resume countdown (schedules next tick)
    resume() {
        console.log('⏰ Timer: Resuming countdown at', this.currentTime);
        this.scheduleNextTick();
    }
    
    // Reset timer to 15 and emit initial display
    reset() {
        console.log('⏰ Timer: Resetting to 12 seconds');
        this.clearCurrentTimeout();
        this.currentTime = 15;
        
        // Emit initial display value
        // this.eventBus.emit('timer:tick', this.currentTime);
    }
    
    // Stop countdown (clears timeout, doesn't reset value)
    stop() {
        console.log('⏰ Timer: Stopping countdown');
        this.clearCurrentTimeout();
    }
    
    // Schedule next tick using setTimeout
    scheduleNextTick() {
        // Clear any existing timeout first
        this.clearCurrentTimeout();
        
        this.timeoutId = setTimeout(() => {
            this.tick();
        }, 1000);
    }
    
    // Handle tick - decrement and emit, check for expiry
    tick() {
        this.currentTime--;
        console.log('⏰ Timer: Tick -', this.currentTime, 'seconds remaining');
        
        // Emit current time for display update
        this.eventBus.emit('timer:tick', this.currentTime);
        
        // Check if timer expired
        if (this.currentTime <= 0) {
            console.log('⏰ Timer: Time expired!');
            this.clearCurrentTimeout(); // Stop timer immediately to prevent negative values
            this.eventBus.emit('timer:expired');
        } else {
            // Schedule next tick
            this.scheduleNextTick();
        }
    }
    
    // Clear current timeout safely
    clearCurrentTimeout() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }
    
    // Get current time (for debugging)
    getCurrentTime() {
        return this.currentTime;
    }
}
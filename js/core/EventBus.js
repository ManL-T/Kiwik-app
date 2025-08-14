// EventBus - handles communication between modules
class EventBus {
    constructor() {
        console.log('📡 EventBus: Initializing...');
        
        // Store event listeners
        this.events = {};
        
        console.log('✅ EventBus: Initialization complete');
    }
    
    // Register event listener
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }
    
    // Remove event listener
    off(eventName, callback) {
        if (!this.events[eventName]) return;
        
        this.events[eventName] = this.events[eventName].filter(
            listener => listener !== callback
        );
    }
    
    // Emit event to all listeners
    emit(eventName, data) {
        if (!this.events[eventName] || this.events[eventName].length === 0) {
            console.warn(`📡 EventBus: No listeners for event '${eventName}'`);
            return;
        }
        
        this.events[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`📡 EventBus: Error in listener for '${eventName}':`, error);
            }
        });
    }
}
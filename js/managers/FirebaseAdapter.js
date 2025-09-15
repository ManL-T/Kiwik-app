// js/managers/FirebaseAdapter.js - Synchronous Interface with Background Firebase
class FirebaseAdapter {
    constructor() {
        console.log('🔥 FirebaseAdapter: Initializing with sync interface...');
        
        // In-memory cache that acts like localStorage
        this.cache = {};
        this.isFirebaseReady = false;
        this.pendingSaves = [];
        
        // Temporary user ID
        this.currentUserId = 'test-user-frazekraze';
        
        // Initialize Firebase in background
        this.initializeFirebase();
    }

    async waitUntilReady() {
        return new Promise((resolve) => {
            if (this.isFirebaseReady) {
                resolve();
            } else {
                const checkReady = () => {
                    if (this.isFirebaseReady) {
                        resolve();
                    } else {
                        setTimeout(checkReady, 10);
                    }
                };
                checkReady();
            }
        });
    }

    async initializeFirebase() {
        try {
            console.log('🔥 FirebaseAdapter: Loading Firebase SDK in background...');
            
            // Import Firebase modules (added Auth)
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
            const { getFirestore, doc, setDoc, getDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
            const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
            
            // Initialize Firebase
            const app = initializeApp(window.firebaseConfig);
            this.db = getFirestore(app);
            this.auth = getAuth(app);
            this.firestoreMethods = { doc, setDoc, getDoc, deleteDoc };
            this.authMethods = { onAuthStateChanged };
            
            console.log('✅ FirebaseAdapter: Firebase and Auth ready, checking authentication...');
            
            // Set up auth state listener
            this.setupAuthStateListener();
            
            // Wait for initial auth state (important!)
            await this.waitForInitialAuthState();
            
            console.log('✅ FirebaseAdapter: Auth state determined, initializing data...');
            
            // Only load data if user is authenticated
            if (this.auth.currentUser) {
                console.log('✅ FirebaseAdapter: User authenticated, loading data...');
                this.currentUserId = this.auth.currentUser.uid;
                await this.loadToCache();
            } else {
                console.log('⚠️ FirebaseAdapter: No authenticated user, waiting for login...');
                this.currentUserId = null;
            }
            
            this.isFirebaseReady = true;
            this.processPendingSaves();
            
            console.log('✅ FirebaseAdapter: Fully initialized');
            
        } catch (error) {
            console.error('❌ FirebaseAdapter: Firebase failed, using cache-only mode:', error);
            this.isFirebaseReady = false;
        }
    }
    
    async loadToCache() {
        try {
            const { doc, getDoc } = this.firestoreMethods;
            
            // Load main progress
            const progressDoc = await getDoc(doc(this.db, 'users', this.currentUserId, 'data', 'kiwik_userProgress'));
            if (progressDoc.exists()) {
                this.cache['kiwik_userProgress'] = progressDoc.data().value;
                console.log('🔥 FirebaseAdapter: Loaded progress data to cache');
            }
            
            // Load sessions
            const sessionsDoc = await getDoc(doc(this.db, 'users', this.currentUserId, 'data', 'kiwik_sessions'));
            if (sessionsDoc.exists()) {
                this.cache['kiwik_sessions'] = sessionsDoc.data().value;
                console.log('🔥 FirebaseAdapter: Loaded sessions data to cache');
            }
            
        } catch (error) {
            console.error('❌ FirebaseAdapter: Error loading to cache:', error);
        }
    }
    
    // Synchronous interface - works immediately with cache
    setItem(key, value) {
        console.log(`🔥 FirebaseAdapter: Setting ${key} in cache`);
        
        // Store in cache immediately (synchronous)
        this.cache[key] = value;
        
        // Queue for Firebase save
        this.queueSave(key, value);
        
        return true; // Synchronous return like localStorage
    }
    
    getItem(key) {
        const value = this.cache[key] || null;
        console.log(`🔥 FirebaseAdapter: Getting ${key} from cache:`, value ? 'found' : 'not found');
        return value;
    }
    
    removeItem(key) {
        console.log(`🔥 FirebaseAdapter: Removing ${key} from cache`);
        delete this.cache[key];
        this.queueSave(key, null); // Queue deletion
        return true;
    }
    
    queueSave(key, value) {
        this.pendingSaves.push({ key, value, timestamp: Date.now() });
        
        // If Firebase is ready, process immediately
        if (this.isFirebaseReady) {
            this.processPendingSaves();
        }
    }
    
    async processPendingSaves() {
        if (this.pendingSaves.length === 0) return;
        
        console.log(`🔥 FirebaseAdapter: Processing ${this.pendingSaves.length} pending saves`);
        
        const saves = [...this.pendingSaves];
        this.pendingSaves = []; // Clear queue
        
        for (const { key, value } of saves) {
            try {
                await this.saveToFirebase(key, value);
            } catch (error) {
                console.error(`❌ FirebaseAdapter: Failed to save ${key}:`, error);
                // Re-queue failed save
                this.pendingSaves.push({ key, value, timestamp: Date.now() });
            }
        }
        
        if (this.pendingSaves.length > 0) {
            console.log(`🔥 FirebaseAdapter: ${this.pendingSaves.length} saves failed, will retry`);
            // Retry failed saves after delay
            setTimeout(() => this.processPendingSaves(), 5000);
        }
    }
    
    async saveToFirebase(key, value) {
        if (!this.isFirebaseReady) {
            throw new Error('Firebase not ready');
        }
        
        const { doc, setDoc, deleteDoc } = this.firestoreMethods;
        const docRef = doc(this.db, 'users', this.currentUserId, 'data', key);
        
        if (value === null) {
            // Delete
            await deleteDoc(docRef);
            console.log(`🔥 FirebaseAdapter: Deleted ${key} from Firebase`);
        } else {
            // Save
            await setDoc(docRef, {
                value: value,
                updatedAt: new Date().toISOString()
            });
            console.log(`🔥 FirebaseAdapter: Saved ${key} to Firebase`);
        }
    }
    
    // Helper method to clear all data
    clearAllData() {
        console.log('🧹 FirebaseAdapter: Clearing all cached data');
        this.cache = {};
        
        // Queue deletions for Firebase
        this.queueSave('kiwik_userProgress', null);
        this.queueSave('kiwik_sessions', null);
        
        return true;
    }

    // Auth state management
    setupAuthStateListener() {
        const { onAuthStateChanged } = this.authMethods || {};
        if (!onAuthStateChanged) return;
        
        onAuthStateChanged(this.auth, (user) => {
            console.log('🔥 FirebaseAdapter: Auth state changed:', user ? 'logged in' : 'logged out');
            
            if (user) {
                // User logged in
                const oldUserId = this.currentUserId;
                this.currentUserId = user.uid;
                
                console.log(`🔥 FirebaseAdapter: User logged in: ${this.currentUserId}`);
                
                // If user changed, clear cache and reload
                if (oldUserId !== this.currentUserId) {
                    console.log('🔥 FirebaseAdapter: User changed, reloading data...');
                    this.cache = {};
                    this.loadToCache();
                }
            } else {
                // User logged out
                console.log('🔥 FirebaseAdapter: User logged out, clearing cache');
                this.currentUserId = null;
                this.cache = {};
            }
        });
        }

        waitForInitialAuthState() {
            return new Promise((resolve) => {
                const unsubscribe = this.auth.onAuthStateChanged(() => {
                    unsubscribe();
                    resolve();
                });
            });
    }

    // Helper methods for auth status
    isAuthenticated() {
        return this.auth && this.auth.currentUser !== null;
    }

    getCurrentUser() {
        return this.auth ? this.auth.currentUser : null;
    }


}

window.FirebaseAdapter = FirebaseAdapter;
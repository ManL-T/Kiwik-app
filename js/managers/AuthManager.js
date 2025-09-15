// js/managers/AuthManager.js - Authentication Management
class AuthManager {
    constructor(eventBus, firebaseAdapter) {
        console.log('🔐 AuthManager: Initializing...');
        
        // Store references
        this.eventBus = eventBus;
        this.firebaseAdapter = firebaseAdapter;
        
        // Auth state
        this.currentUser = null;
        this.isAuthReady = false;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize auth state monitoring
        this.initializeAuthState();
        
        console.log('✅ AuthManager: Initialization complete');
    }
    
    setupEventListeners() {
        this.eventBus.on('auth:login', (credentials) => {
            this.login(credentials.email, credentials.password);
        });
        
        this.eventBus.on('auth:register', (userData) => {
            this.register(userData.email, userData.password, userData.username);
        });
        
        this.eventBus.on('auth:logout', () => {
            this.logout();
        });
        
        this.eventBus.on('auth:checkStatus', () => {
            this.emitAuthStatus();
        });
    }
    
    async initializeAuthState() {
        try {
            // Wait for FirebaseAdapter to be ready
            await this.firebaseAdapter.waitUntilReady();
            
            // Get current auth state
            const user = this.firebaseAdapter.getCurrentUser();
            this.currentUser = user;
            this.isAuthReady = true;
            
            console.log('🔐 AuthManager: Auth state ready:', user ? 'logged in' : 'logged out');
            
            // Emit initial auth status
            this.emitAuthStatus();
            
        } catch (error) {
            console.error('❌ AuthManager: Error initializing auth state:', error);
            this.isAuthReady = true; // Still mark as ready to prevent blocking
            this.emitAuthStatus();
        }
    }
    
    async login(email, password) {
        try {
            console.log('🔐 AuthManager: Attempting login for:', email);
            
            // Import auth methods
            const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
            
            // Attempt login
            const userCredential = await signInWithEmailAndPassword(this.firebaseAdapter.auth, email, password);
            const user = userCredential.user;
            
            console.log('✅ AuthManager: Login successful:', user.uid);
            
            this.currentUser = user;
            this.eventBus.emit('auth:loginSuccess', { user: user });
            this.emitAuthStatus();
            
        } catch (error) {
            console.error('❌ AuthManager: Login failed:', error);
            
            // Emit user-friendly error message
            let errorMessage = 'Login failed. Please try again.';
            
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email address.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address.';
            }
            
            this.eventBus.emit('auth:loginError', { message: errorMessage });
        }
    }
    
    async register(email, password, username) {
        try {
            console.log('🔐 AuthManager: Attempting registration for:', email);
            
            // Import auth methods
            const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
            
            // Create user account
            const userCredential = await createUserWithEmailAndPassword(this.firebaseAdapter.auth, email, password);
            const user = userCredential.user;
            
            // Update user profile with username
            await updateProfile(user, {
                displayName: username
            });
            
            console.log('✅ AuthManager: Registration successful:', user.uid);
            
            // Save user profile to Firestore
            await this.saveUserProfile(user, username);
            
            this.currentUser = user;
            this.eventBus.emit('auth:registerSuccess', { user: user });
            this.emitAuthStatus();
            
        } catch (error) {
            console.error('❌ AuthManager: Registration failed:', error);
            
            // Emit user-friendly error message
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'An account with this email already exists.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password should be at least 6 characters.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address.';
            }
            
            this.eventBus.emit('auth:registerError', { message: errorMessage });
        }
    }
    
    async saveUserProfile(user, username) {
        try {
            const { doc, setDoc } = this.firebaseAdapter.firestoreMethods;
            
            const profileData = {
                username: username,
                email: user.email,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await setDoc(doc(this.firebaseAdapter.db, 'users', user.uid, 'profile', 'userProfile'), profileData);
            console.log('✅ AuthManager: User profile saved to Firestore');
            
        } catch (error) {
            console.error('❌ AuthManager: Error saving user profile:', error);
        }
    }
    
    async logout() {
        try {
            console.log('🔐 AuthManager: Attempting logout...');
            
            // Import auth methods
            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
            
            await signOut(this.firebaseAdapter.auth);
            
            console.log('✅ AuthManager: Logout successful');
            
            this.currentUser = null;
            this.eventBus.emit('auth:logoutSuccess');
            this.emitAuthStatus();
            
        } catch (error) {
            console.error('❌ AuthManager: Logout failed:', error);
            this.eventBus.emit('auth:logoutError', { message: 'Logout failed. Please try again.' });
        }
    }
    
    emitAuthStatus() {
        const isAuthenticated = this.currentUser !== null;
        console.log('🔐 AuthManager: Emitting auth status:', isAuthenticated ? 'authenticated' : 'not authenticated');
        
        this.eventBus.emit('auth:statusChanged', {
            isAuthenticated: isAuthenticated,
            user: this.currentUser,
            isReady: this.isAuthReady
        });
    }
    
    // Helper methods
    isAuthenticated() {
        return this.currentUser !== null;
    }
    
    getCurrentUser() {
        return this.currentUser;
    }
}

// Make available globally
window.AuthManager = AuthManager;
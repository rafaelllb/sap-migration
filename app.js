/**
 * SAP Migration Control Center - Main Application Controller
 * Orchestrates all modules, handles navigation, modals, and app state
 */

class SAPMigrationApp {
    constructor() {
        this.currentView = 'dashboard';
        this.isInitialized = false;
        this.controllers = {
            dashboard: window.dashboardController,
            tasks: window.tasksController,
            objects: window.objectsController,
			changes: window.changesController,
            settings: window.settingsController
        };
        
        this.toastTimeout = null;
        this.confirmCallback = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initialize());
            } else {
                await this.initialize();
            }
        } catch (error) {
            console.error('Application initialization failed:', error);
            this.showToast('Erro ao inicializar aplicação', 'error');
        }
    }

    /**
     * Main initialization logic
     */
    async initialize() {
        try {
            console.log('Initializing SAP Migration Control Center...');
            
            // Initialize storage manager first
            if (window.storageManager) {
                await window.storageManager.initializeDB();
            }
            
            // Initialize theme
            this.controllers.settings.initializeTheme();
            
            // Bind global events
            this.bindEvents();
            
            // Initialize navigation
            this.initializeNavigation();
            
            // Initialize modals
            this.initializeModals();
            
            // Show initial view
            await this.showView('dashboard');
            
            // Set initialized flag
            this.isInitialized = true;
            
            console.log('Application initialized successfully');
            
            // Show welcome message for first-time users
            await this.checkFirstTimeUser();
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showToast('Erro na inicialização. Verifique o console.', 'error');
        }
    }

    /**
     * Bind global application events
     */
    bindEvents() {
        // Navigation events
        document.addEventListener('click', this.handleGlobalClick.bind(this));
        
        // Keyboard events
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.controllers.settings.toggleTheme();
            });
        }
        
        // Modal backdrop clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.closeActiveModal();
            }
        });
        
        // Data refresh events
        document.addEventListener('dataRefreshNeeded', () => {
            this.refreshCurrentView();
        });
        
        document.addEventListener('dataCleared', () => {
            this.refreshAllViews();
        });
        
        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('error', this.handleGlobalError.bind(this));
    }

    /**
     * Initialize navigation system
     */
    initializeNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                if (view) {
                    this.showView(view);
                }
            });
        });
    }

    /**
     * Initialize modal system
     */
    initializeModals() {
        // Close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeActiveModal();
            });
        });
        
        // Task modal specific events
        const taskCancelBtn = document.getElementById('taskCancelBtn');
        const taskSaveBtn = document.getElementById('taskSaveBtn');
        
        if (taskCancelBtn) {
            taskCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal('taskModal');
            });
        }
        
        if (taskSaveBtn) {
            taskSaveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const form = document.getElementById('taskForm');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            });
        }
        
        // Object modal specific events
        const objectCancelBtn = document.getElementById('objectCancelBtn');
        const objectSaveBtn = document.getElementById('objectSaveBtn');
        
        if (objectCancelBtn) {
            objectCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal('objectModal');
            });
        }
        
        if (objectSaveBtn) {
            objectSaveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const form = document.getElementById('objectForm');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            });
        }

        // Confirm modal events
        const confirmCancelBtn = document.getElementById('confirmCancelBtn');
        const confirmOkBtn = document.getElementById('confirmOkBtn');
        
        if (confirmCancelBtn) {
            confirmCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeModal('confirmModal');
            });
        }
        
        if (confirmOkBtn) {
            confirmOkBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.executeConfirmAction();
            });
        }
    }

    /**
     * Handle global click events
     */
    handleGlobalClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        
        // Global actions
        switch (action) {
            case 'export-data':
                e.preventDefault();
                this.controllers.settings.exportData();
                break;
            case 'import-data':
                e.preventDefault();
                this.controllers.settings.showImportDialog();
                break;
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeydown(e) {
        // Escape key closes modals
        if (e.key === 'Escape') {
            this.closeActiveModal();
        }
        
        // Ctrl+S saves current form (prevent default save)
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                const form = activeModal.querySelector('form');
                if (form) {
                    form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            }
        }
        
        // Keyboard navigation (Alt + number)
        if (e.altKey && e.key >= '1' && e.key <= '6') {
            e.preventDefault();
            const views = ['dashboard', 'tasks', 'objects', 'dependencies', 'changes', 'settings'];
            const viewIndex = parseInt(e.key) - 1;
            if (views[viewIndex]) {
                this.showView(views[viewIndex]);
            }
        }
    }

    /**
     * Show specific view and initialize its controller
     */
    async showView(viewName) {
        try {
            // Validate view name
            const validViews = ['dashboard', 'tasks', 'objects', 'dependencies', 'changes', 'settings'];
            if (!validViews.includes(viewName)) {
                console.error('Invalid view name:', viewName);
                return;
            }
            
            // Hide current view
            const currentView = document.querySelector('.view.active');
            if (currentView) {
                currentView.classList.remove('active');
            }
            
            // Show new view
            const newView = document.getElementById(viewName + 'View');
            if (!newView) {
                console.error('View element not found:', viewName + 'View');
                return;
            }
            
            newView.classList.add('active');
            
            // Update navigation
            this.updateNavigation(viewName);
            
            // Initialize view controller
            if (this.controllers[viewName] && this.controllers[viewName].initialize) {
                await this.controllers[viewName].initialize();
            }
            
            // Update current view
            this.currentView = viewName;
            
            // Update document title
            this.updateDocumentTitle(viewName);
            
            console.log('View changed to:', viewName);
            
        } catch (error) {
            console.error('Failed to show view:', viewName, error);
            this.showToast('Erro ao carregar página', 'error');
        }
    }

    /**
     * Update navigation active state
     */
    updateNavigation(activeView) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === activeView);
        });
    }

    /**
     * Update document title based on current view
     */
    updateDocumentTitle(viewName) {
        const titles = {
            'dashboard': 'Painel Principal',
            'tasks': 'Tarefas',
            'objects': 'Objetos SAP',
            'dependencies': 'Dependências',
            'changes': 'Requests',
            'settings': 'Configurações'
        };
        
        const baseTitle = 'SAP Migration Control';
        const viewTitle = titles[viewName];
        
        document.title = viewTitle ? `${viewTitle} - ${baseTitle}` : baseTitle;
    }

    /**
     * Refresh current view
     */
    async refreshCurrentView() {
        if (this.controllers[this.currentView] && this.controllers[this.currentView].initialize) {
            await this.controllers[this.currentView].initialize();
        }
    }

    /**
     * Refresh all views (after data import/clear)
     */
    async refreshAllViews() {
        for (const [viewName, controller] of Object.entries(this.controllers)) {
            if (controller && controller.initialize) {
                try {
                    await controller.initialize();
                } catch (error) {
                    console.error(`Failed to refresh ${viewName}:`, error);
                }
            }
        }
    }

    /**
     * Show modal by ID
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close modal by ID
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * Close any active modal
     */
    closeActiveModal() {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            activeModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * Show confirmation modal
     */
    showConfirmModal(title, message, callback) {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        
        if (modal && titleEl && messageEl) {
            titleEl.textContent = title;
            messageEl.textContent = message;
            this.confirmCallback = callback;
            this.showModal('confirmModal');
        }
    }

    /**
     * Execute confirmed action
     */
    executeConfirmAction() {
        if (this.confirmCallback) {
            try {
                this.confirmCallback();
            } catch (error) {
                console.error('Error executing confirm action:', error);
                this.showToast('Erro ao executar ação', 'error');
            }
            this.confirmCallback = null;
        }
        this.closeModal('confirmModal');
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 4000) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        // Clear existing timeout
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }

        // Set message and type
        toast.textContent = message;
        toast.className = `toast ${type}`;

        // Show toast
        toast.classList.add('show');

        // Auto hide after duration
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    /**
     * Check if user is first time and show welcome
     */
    async checkFirstTimeUser() {
        try {
            const profile = await window.storageManager.getProfile();
            const tasks = await window.storageManager.getTasks();
            const objects = await window.storageManager.getObjects();
            
            const isEmpty = !profile.nome && tasks.length === 0 && objects.length === 0;
            
            if (isEmpty) {
                setTimeout(() => {
                    this.showToast('Bem-vindo! Configure seu perfil em Configurações para começar.', 'info', 6000);
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to check first time user:', error);
        }
    }

    /**
     * Handle before unload (page refresh/close)
     */
    handleBeforeUnload(e) {
        // Check if there are unsaved changes in modals
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            const message = 'Existem alterações não salvas. Deseja realmente sair?';
            e.returnValue = message;
            return message;
        }
    }

    /**
     * Handle global errors
     */
    handleGlobalError(error) {
        console.error('Global error:', error);
        this.showToast('Erro inesperado na aplicação', 'error');
    }

    /**
     * Get application status
     */
    async getAppStatus() {
        try {
            const summary = await window.storageManager.getDataSummary();
            const profile = await window.storageManager.getProfile();
            
            return {
                initialized: this.isInitialized,
                currentView: this.currentView,
                hasProfile: !!profile.nome,
                dataStatus: summary,
                storageType: window.storageManager.isIndexedDBSupported ? 'IndexedDB + localStorage' : 'localStorage only'
            };
        } catch (error) {
            console.error('Failed to get app status:', error);
            return null;
        }
    }

    /**
     * Export debug information
     */
    async exportDebugInfo() {
        try {
            const status = await this.getAppStatus();
            const debugInfo = {
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                screen: {
                    width: screen.width,
                    height: screen.height
                },
                app: status,
                errors: this.getErrorLog()
            };
            
            const blob = new Blob([JSON.stringify(debugInfo, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `sap-migration-debug-${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Failed to export debug info:', error);
            this.showToast('Erro ao exportar informações de debug', 'error');
        }
    }

    /**
     * Get error log (simplified)
     */
    getErrorLog() {
        // In a full implementation, you'd maintain an error log
        return 'Error logging not implemented in demo version';
    }

    /**
     * Reset application to initial state
     */
    async resetApp() {
        try {
            // Clear all data
            await window.storageManager.clearAllData();
            
            // Reset theme to light
            window.storageManager.saveTheme('light');
            this.controllers.settings.applyTheme('light');
            
            // Refresh all views
            await this.refreshAllViews();
            
            // Go to dashboard
            await this.showView('dashboard');
            
            this.showToast('Aplicação reiniciada com sucesso', 'success');
            
        } catch (error) {
            console.error('Failed to reset app:', error);
            this.showToast('Erro ao reiniciar aplicação', 'error');
        }
    }

    /**
     * Show loading state
     */
    showLoading(message = 'Carregando...') {
        // Could implement a loading overlay here
        console.log('Loading:', message);
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        console.log('Loading finished');
    }

    /**
     * Cleanup when app is destroyed
     */
    destroy() {
        // Clear timeouts
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        
        // Clean up controllers
        Object.values(this.controllers).forEach(controller => {
            if (controller && controller.destroy) {
                controller.destroy();
            }
        });
        
        console.log('Application destroyed');
    }
}

// Initialize application when script loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SAPMigrationApp();
});

// Expose app globally for debugging
window.SAPMigrationApp = SAPMigrationApp;
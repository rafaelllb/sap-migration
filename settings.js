/**
 * SAP Migration Control Center - Settings Controller
 * Handles application settings, profile management, and data operations
 */

class SettingsController {
    constructor() {
        this.storage = window.storageManager;
        this.currentProfile = {};
        this.currentSettings = {};
        this.bindEvents();
    }

    /**
     * Bind settings-related events
     */
    bindEvents() {
        document.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('change', this.handleChange.bind(this));
        
        // Custom events
        document.addEventListener('exportData', () => this.exportData());
        document.addEventListener('importData', () => this.showImportDialog());
        
        // Profile and settings update events
        document.addEventListener('profileUpdated', (e) => {
            this.currentProfile = e.detail;
            this.updateProfileDisplay();
        });
        
        document.addEventListener('settingsUpdated', (e) => {
            this.currentSettings = e.detail;
        });
    }

    /**
     * Handle click events
     */
    handleClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;

        switch (action) {
            case 'save-profile':
                e.preventDefault();
                this.saveProfile();
                break;
            case 'export-data':
                e.preventDefault();
                this.exportData();
                break;
            case 'import-data':
                e.preventDefault();
                this.showImportDialog();
                break;
            case 'clear-all-data':
                e.preventDefault();
                this.confirmClearAllData();
                break;
        }
    }

    /**
     * Handle change events
     */
    handleChange(e) {
        // Auto-save certain settings
        if (e.target.id === 'themeToggle') {
            this.toggleTheme();
        }
    }

    /**
     * Initialize settings view
     */
    async initialize() {
        try {
            await this.loadProfile();
            await this.loadSettings();
            this.updateDataSummary();
            this.updateLastBackupDate();
        } catch (error) {
            console.error('Settings initialization failed:', error);
            this.showError('Erro ao carregar configurações');
        }
    }

    /**
     * Load profile data
     */
    async loadProfile() {
        try {
            this.currentProfile = await this.storage.getProfile();
            this.populateProfileForm();
            this.updateProfileDisplay();
        } catch (error) {
            console.error('Failed to load profile:', error);
            this.currentProfile = this.storage.getDefaultData('profile');
        }
    }

    /**
     * Load settings data
     */
    async loadSettings() {
        try {
            this.currentSettings = await this.storage.getSettings();
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.currentSettings = this.storage.getDefaultData('settings');
        }
    }

    /**
     * Populate profile form with current data
     */
    populateProfileForm() {
        const fields = {
            'consultorNome': this.currentProfile.nome || '',
            'consultorEmpresa': this.currentProfile.empresa || '',
            'inicioProject': this.currentProfile.inicioProject || ''
        };

        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value;
            }
        });
    }

    /**
     * Update profile display in header
     */
    updateProfileDisplay() {
        // This will trigger profile update in other components
        document.dispatchEvent(new CustomEvent('profileDisplayUpdate', {
            detail: this.currentProfile
        }));
    }

    /**
     * Save profile data
     */
    async saveProfile() {
        try {
            const formData = this.getProfileFormData();
            
            if (!this.validateProfileForm(formData)) {
                return;
            }

            const profile = {
                nome: formData.nome,
                empresa: formData.empresa,
                inicioProject: formData.inicioProject,
                cliente: formData.empresa, // Using empresa as cliente for consistency
                avatar: this.currentProfile.avatar || '🚀',
                atualizadoEm: new Date().toISOString()
            };

            await this.storage.saveProfile(profile);
            this.showSuccess('Perfil salvo com sucesso!');
            
        } catch (error) {
            console.error('Failed to save profile:', error);
            this.showError('Erro ao salvar perfil');
        }
    }

    /**
     * Get profile form data
     */
    getProfileFormData() {
        return {
            nome: document.getElementById('consultorNome')?.value.trim() || '',
            empresa: document.getElementById('consultorEmpresa')?.value.trim() || '',
            inicioProject: document.getElementById('inicioProject')?.value || ''
        };
    }

    /**
     * Validate profile form
     */
    validateProfileForm(formData) {
        if (!formData.nome) {
            this.showError('Nome é obrigatório');
            return false;
        }

        if (formData.inicioProject) {
            const startDate = new Date(formData.inicioProject);
            const today = new Date();
            
            if (startDate > today) {
                this.showError('Data de início não pode ser no futuro');
                return false;
            }
        }

        return true;
    }

    /**
     * Export all data to JSON file
     */
    async exportData() {
        try {
            const jsonData = await this.storage.exportData();
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `sap-migration-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            // Update last backup date
            this.storage.setLastBackupDate();
            this.updateLastBackupDate();
            
            this.showSuccess('Dados exportados com sucesso!');
            
        } catch (error) {
            console.error('Failed to export data:', error);
            this.showError('Erro ao exportar dados');
        }
    }

    /**
     * Show import dialog
     */
    showImportDialog() {
        const fileInput = document.getElementById('importFileInput');
        if (!fileInput) return;

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importData(file);
            }
        };

        fileInput.click();
    }

    /**
     * Import data from JSON file
     */
    async importData(file) {
        try {
            if (file.type !== 'application/json') {
                this.showError('Por favor, selecione um arquivo JSON válido');
                return;
            }

            const text = await file.text();
            const result = await this.storage.importData(text);
            
            if (result.success) {
                this.showSuccess(result.message);
                
                // Refresh all data
                await this.loadProfile();
                await this.loadSettings();
                this.updateDataSummary();
                
                // Notify other components
                document.dispatchEvent(new CustomEvent('dataRefreshNeeded'));
                
            } else {
                this.showError(result.message);
            }
            
        } catch (error) {
            console.error('Failed to import data:', error);
            this.showError('Erro ao importar dados: arquivo inválido');
        }
    }

    /**
     * Confirm clear all data
     */
    confirmClearAllData() {
        if (window.app && window.app.showConfirmModal) {
            window.app.showConfirmModal(
                'Limpar Todos os Dados',
                'Esta ação irá remover TODOS os dados da aplicação (perfil, tarefas, objetos, etc.). Esta ação não pode ser desfeita. Tem certeza que deseja continuar?',
                () => this.clearAllData()
            );
        } else {
            if (confirm('Esta ação irá remover TODOS os dados. Tem certeza?')) {
                this.clearAllData();
            }
        }
    }

    /**
     * Clear all application data
     */
    async clearAllData() {
        try {
            const result = await this.storage.clearAllData();
            
            if (result.success) {
                this.showSuccess(result.message);
                
                // Reset current data
                this.currentProfile = this.storage.getDefaultData('profile');
                this.currentSettings = this.storage.getDefaultData('settings');
                
                // Refresh UI
                this.populateProfileForm();
                this.updateDataSummary();
                this.updateLastBackupDate();
                
                // Notify other components
                document.dispatchEvent(new CustomEvent('dataCleared'));
                
            } else {
                this.showError(result.message);
            }
            
        } catch (error) {
            console.error('Failed to clear data:', error);
            this.showError('Erro ao limpar dados');
        }
    }

    /**
     * Update data summary display
     */
    async updateDataSummary() {
        try {
            const summary = await this.storage.getDataSummary();
            
            const summaryTasks = document.getElementById('summaryTasks');
            const summaryObjects = document.getElementById('summaryObjects');
            
            if (summaryTasks) {
                summaryTasks.textContent = summary.totalTasks || 0;
            }
            
            if (summaryObjects) {
                summaryObjects.textContent = summary.totalObjects || 0;
            }
            
        } catch (error) {
            console.error('Failed to update data summary:', error);
        }
    }

    /**
     * Update last backup date display
     */
    updateLastBackupDate() {
        const lastBackupEl = document.getElementById('lastBackup');
        if (!lastBackupEl) return;

        const lastBackupDate = this.storage.getLastBackupDate();
        
        if (lastBackupDate) {
            const date = new Date(lastBackupDate);
            lastBackupEl.textContent = date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else {
            lastBackupEl.textContent = 'Nunca';
        }
    }

    /**
     * Toggle theme between light and dark
     */
    async toggleTheme() {
        const currentTheme = this.storage.getTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        this.storage.saveTheme(newTheme);
        this.applyTheme(newTheme);
    }

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme toggle icons
        const sunIcon = document.getElementById('sunIcon');
        const moonIcon = document.getElementById('moonIcon');
        
        if (sunIcon && moonIcon) {
            if (theme === 'dark') {
                sunIcon.classList.add('hidden');
                moonIcon.classList.remove('hidden');
            } else {
                sunIcon.classList.remove('hidden');
                moonIcon.classList.add('hidden');
            }
        }
    }

    /**
     * Initialize theme on app load
     */
    initializeTheme() {
        const savedTheme = this.storage.getTheme();
        this.applyTheme(savedTheme);
    }

    /**
     * Get application statistics
     */
    async getApplicationStatistics() {
        try {
            const tasks = await this.storage.getTasks();
            const objects = await this.storage.getObjects();
            const requests = await this.storage.getRequests();
            
            return {
                totalItems: tasks.length + objects.length + requests.length,
                tasks: {
                    total: tasks.length,
                    completed: tasks.filter(t => t.status === 'concluido').length,
                    active: tasks.filter(t => t.status !== 'concluido').length
                },
                objects: {
                    total: objects.length,
                    converted: objects.filter(o => o.status === 'convertido').length,
                    pending: objects.filter(o => o.status !== 'convertido').length
                },
                requests: {
                    total: requests.length
                },
                storage: {
                    estimated: this.estimateStorageUsage()
                }
            };
            
        } catch (error) {
            console.error('Failed to get application statistics:', error);
            return null;
        }
    }

    /**
     * Estimate storage usage (rough calculation)
     */
    estimateStorageUsage() {
        try {
            let totalSize = 0;
            
            // Estimate localStorage usage
            Object.values(this.storage.keys).forEach(key => {
                const data = localStorage.getItem(key);
                if (data) {
                    totalSize += data.length * 2; // Rough UTF-16 estimation
                }
            });
            
            // Convert to KB
            return Math.round(totalSize / 1024);
            
        } catch (error) {
            return 0;
        }
    }

    /**
     * Validate imported data structure
     */
    validateImportedData(data) {
        const requiredFields = ['profile', 'tasks', 'objects'];
        
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Arquivo não contém dados válidos' };
        }
        
        const missingFields = requiredFields.filter(field => !(field in data));
        
        if (missingFields.length > 0) {
            return { 
                valid: false, 
                error: `Campos obrigatórios ausentes: ${missingFields.join(', ')}` 
            };
        }
        
        // Validate data types
        if (!Array.isArray(data.tasks)) {
            return { valid: false, error: 'Dados de tarefas inválidos' };
        }
        
        if (!Array.isArray(data.objects)) {
            return { valid: false, error: 'Dados de objetos inválidos' };
        }
        
        return { valid: true };
    }

    /**
     * Reset settings to default
     */
    async resetSettings() {
        try {
            const defaultSettings = this.storage.getDefaultData('settings');
            await this.storage.saveData('settings', defaultSettings);
            this.currentSettings = defaultSettings;
            this.showSuccess('Configurações restauradas para o padrão');
            
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.showError('Erro ao restaurar configurações');
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, 'success');
        } else {
            console.log(message);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, 'error');
        } else {
            console.error(message);
        }
    }

    /**
     * Show warning message
     */
    showWarning(message) {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, 'warning');
        } else {
            console.warn(message);
        }
    }

    /**
     * Clean up settings controller
     */
    destroy() {
        // Clean up event listeners if needed
        const fileInput = document.getElementById('importFileInput');
        if (fileInput) {
            fileInput.onchange = null;
        }
    }
}

// Create global settings controller instance
window.settingsController = new SettingsController();
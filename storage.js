/**
 * SAP Migration Control Center - Storage Management
 * Handles all data persistence using localStorage and IndexedDB
 */

class StorageManager {
    constructor() {
        this.dbName = 'SAPMigrationDB';
        this.dbVersion = 1;
        this.db = null;
        this.isIndexedDBSupported = typeof indexedDB !== 'undefined';
        
        // Storage keys
        this.keys = {
            profile: 'sap_migration_profile',
            settings: 'sap_migration_settings',
            tasks: 'sap_migration_tasks',
            objects: 'sap_migration_objects',
            requests: 'sap_migration_requests',
            theme: 'sap_migration_theme'
        };

        this.initializeDB();
    }

    /**
     * Initialize IndexedDB database
     */
    async initializeDB() {
        if (!this.isIndexedDBSupported) {
            console.warn('IndexedDB not supported, fallback to localStorage only');
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                if (!db.objectStoreNames.contains('tasks')) {
                    const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    tasksStore.createIndex('status', 'status', { unique: false });
                    tasksStore.createIndex('priority', 'priority', { unique: false });
                    tasksStore.createIndex('category', 'category', { unique: false });
                }

                if (!db.objectStoreNames.contains('objects')) {
                    const objectsStore = db.createObjectStore('objects', { keyPath: 'id' });
                    objectsStore.createIndex('type', 'type', { unique: false });
                    objectsStore.createIndex('status', 'status', { unique: false });
                }

                if (!db.objectStoreNames.contains('requests')) {
                    const requestsStore = db.createObjectStore('requests', { keyPath: 'id' });
                    requestsStore.createIndex('status', 'status', { unique: false });
                    requestsStore.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    /**
     * Generic method to save data to both localStorage and IndexedDB
     */
    async saveData(storeName, data) {
        // Always save to localStorage as backup
        try {
            localStorage.setItem(this.keys[storeName], JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }

        // Save to IndexedDB if available
        if (this.db && ['tasks', 'objects', 'requests'].includes(storeName)) {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                // Clear existing data
                await this.clearStore(storeName);
                
                // Add new data
                if (Array.isArray(data)) {
                    for (const item of data) {
                        await store.add(item);
                    }
                }

                return new Promise((resolve, reject) => {
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = () => reject(transaction.error);
                });
            } catch (error) {
                console.error(`Failed to save ${storeName} to IndexedDB:`, error);
            }
        }
    }

    /**
     * Generic method to load data with fallback logic
     */
    async loadData(storeName) {
        // Try IndexedDB first for complex data
        if (this.db && ['tasks', 'objects', 'requests'].includes(storeName)) {
            try {
                const data = await this.getFromIndexedDB(storeName);
                if (data && data.length > 0) {
                    return data;
                }
            } catch (error) {
                console.error(`Failed to load ${storeName} from IndexedDB:`, error);
            }
        }

        // Fallback to localStorage
        try {
            const data = localStorage.getItem(this.keys[storeName]);
            return data ? JSON.parse(data) : this.getDefaultData(storeName);
        } catch (error) {
            console.error(`Failed to load ${storeName} from localStorage:`, error);
            return this.getDefaultData(storeName);
        }
    }

    /**
     * Get data from IndexedDB
     */
    async getFromIndexedDB(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear IndexedDB store
     */
    async clearStore(storeName) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get default data structure for each store
     */
    getDefaultData(storeName) {
        const defaults = {
            profile: {
                nome: '',
                empresa: '',
                inicioProject: '',
                cliente: '',
                avatar: '🚀'
            },
            settings: {
                theme: 'light',
                notifications: true,
                autoSave: true,
                language: 'pt-BR'
            },
            tasks: [],
            objects: [],
            requests: []
        };

        return defaults[storeName] || null;
    }

    // Specific data methods
    
    /**
     * Profile Management
     */
    async getProfile() {
        return await this.loadData('profile');
    }

    async saveProfile(profile) {
        await this.saveData('profile', profile);
        this.dispatchEvent('profileUpdated', profile);
    }

    /**
     * Settings Management
     */
    async getSettings() {
        return await this.loadData('settings');
    }

    async saveSetting(key, value) {
        const settings = await this.getSettings();
        settings[key] = value;
        await this.saveData('settings', settings);
        this.dispatchEvent('settingsUpdated', settings);
    }

    /**
     * Tasks Management
     */
    async getTasks() {
        const tasks = await this.loadData('tasks');
        return Array.isArray(tasks) ? tasks : [];
    }

    async saveTask(task) {
        const tasks = await this.getTasks();
        const existingIndex = tasks.findIndex(t => t.id === task.id);
        
        if (existingIndex >= 0) {
            tasks[existingIndex] = task;
        } else {
            tasks.push(task);
        }
        
        await this.saveData('tasks', tasks);
        this.dispatchEvent('tasksUpdated', tasks);
        return task;
    }

    async deleteTask(taskId) {
        const tasks = await this.getTasks();
        const filteredTasks = tasks.filter(t => t.id !== taskId);
        await this.saveData('tasks', filteredTasks);
        this.dispatchEvent('tasksUpdated', filteredTasks);
    }

    async getTaskById(taskId) {
        const tasks = await this.getTasks();
        return tasks.find(t => t.id === taskId);
    }

    /**
     * Objects Management
     */
    async getObjects() {
        const objects = await this.loadData('objects');
        return Array.isArray(objects) ? objects : [];
    }

    async saveObject(object) {
        const objects = await this.getObjects();
        const existingIndex = objects.findIndex(o => o.id === object.id);
        
        if (existingIndex >= 0) {
            objects[existingIndex] = object;
        } else {
            objects.push(object);
        }
        
        await this.saveData('objects', objects);
        this.dispatchEvent('objectsUpdated', objects);
        return object;
    }

    async deleteObject(objectId) {
        const objects = await this.getObjects();
        const filteredObjects = objects.filter(o => o.id !== objectId);
        await this.saveData('objects', filteredObjects);
        this.dispatchEvent('objectsUpdated', filteredObjects);
    }

    async getObjectById(objectId) {
        const objects = await this.getObjects();
        return objects.find(o => o.id === objectId);
    }

    /**
     * Requests Management
     */
    async getRequests() {
        const requests = await this.loadData('requests');
        return Array.isArray(requests) ? requests : [];
    }

    async saveRequest(request) {
        const requests = await this.getRequests();
        const existingIndex = requests.findIndex(r => r.id === request.id);
        
        if (existingIndex >= 0) {
            requests[existingIndex] = request;
        } else {
            requests.push(request);
        }
        
        await this.saveData('requests', requests);
        this.dispatchEvent('requestsUpdated', requests);
        return request;
    }

    /**
     * Generate unique ID for new items
     */
    generateId(prefix = 'ID') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        return `${prefix}${timestamp.toString().slice(-6)}${random}`;
    }

    /**
     * Generate task ID in the format TSK001, TSK002, etc.
     */
    async generateTaskId() {
        const tasks = await this.getTasks();
        const maxId = tasks.reduce((max, task) => {
            if (task.id && task.id.startsWith('TSK')) {
                const num = parseInt(task.id.replace('TSK', ''));
                return Math.max(max, isNaN(num) ? 0 : num);
            }
            return max;
        }, 0);
        
        return `TSK${String(maxId + 1).padStart(3, '0')}`;
    }

    /**
     * Export all data to JSON
     */
    async exportData() {
        const data = {
            profile: await this.getProfile(),
            settings: await this.getSettings(),
            tasks: await this.getTasks(),
            objects: await this.getObjects(),
            requests: await this.getRequests(),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        return JSON.stringify(data, null, 2);
    }

    /**
     * Import data from JSON
     */
    async importData(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            if (data.profile) await this.saveData('profile', data.profile);
            if (data.settings) await this.saveData('settings', data.settings);
            if (data.tasks) await this.saveData('tasks', data.tasks);
            if (data.objects) await this.saveData('objects', data.objects);
            if (data.requests) await this.saveData('requests', data.requests);
            
            // Dispatch events to update UI
            this.dispatchEvent('dataImported', data);
            
            return { success: true, message: 'Dados importados com sucesso!' };
        } catch (error) {
            console.error('Failed to import data:', error);
            return { success: false, message: 'Erro ao importar dados: ' + error.message };
        }
    }

    /**
     * Clear all data
     */
    async clearAllData() {
        try {
            // Clear localStorage
            Object.values(this.keys).forEach(key => {
                localStorage.removeItem(key);
            });

            // Clear IndexedDB
            if (this.db) {
                const stores = ['tasks', 'objects', 'requests'];
                for (const store of stores) {
                    await this.clearStore(store);
                }
            }

            this.dispatchEvent('dataCleared');
            return { success: true, message: 'Todos os dados foram limpos!' };
        } catch (error) {
            console.error('Failed to clear data:', error);
            return { success: false, message: 'Erro ao limpar dados: ' + error.message };
        }
    }

    /**
     * Get data summary for dashboard
     */
    async getDataSummary() {
        const tasks = await this.getTasks();
        const objects = await this.getObjects();
        const requests = await this.getRequests();

        return {
            totalTasks: tasks.length,
            activeTasks: tasks.filter(t => t.status !== 'concluido').length,
            completedTasks: tasks.filter(t => t.status === 'concluido').length,
            totalHours: tasks.reduce((sum, t) => sum + (t.horasGastas || 0), 0),
            totalObjects: objects.length,
            convertedObjects: objects.filter(o => o.status === 'convertido').length,
            totalRequests: requests.length,
            progressPercentage: tasks.length > 0 
                ? Math.round((tasks.filter(t => t.status === 'concluido').length / tasks.length) * 100)
                : 0
        };
    }

    /**
     * Search functionality
     */
    async searchTasks(query, filters = {}) {
        const tasks = await this.getTasks();
        return tasks.filter(task => {
            const matchesQuery = !query || 
                task.titulo.toLowerCase().includes(query.toLowerCase()) ||
                task.id.toLowerCase().includes(query.toLowerCase()) ||
                (task.descricao && task.descricao.toLowerCase().includes(query.toLowerCase()));

            const matchesStatus = !filters.status || task.status === filters.status;
            const matchesPriority = !filters.priority || task.prioridade === filters.priority;
            const matchesCategory = !filters.category || task.categoria === filters.category;

            return matchesQuery && matchesStatus && matchesPriority && matchesCategory;
        });
    }

    async searchObjects(query, filters = {}) {
        const objects = await this.getObjects();
        return objects.filter(object => {
            const matchesQuery = !query || 
                object.nome.toLowerCase().includes(query.toLowerCase()) ||
                object.id.toLowerCase().includes(query.toLowerCase()) ||
                (object.notas && object.notas.toLowerCase().includes(query.toLowerCase()));

            const matchesType = !filters.type || object.tipo === filters.type;
            const matchesStatus = !filters.status || object.status === filters.status;

            return matchesQuery && matchesType && matchesStatus;
        });
    }

    /**
     * Event dispatcher for reactive updates
     */
    dispatchEvent(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }

    /**
     * Get theme from localStorage
     */
    getTheme() {
        return localStorage.getItem(this.keys.theme) || 'light';
    }

    /**
     * Save theme to localStorage
     */
    saveTheme(theme) {
        localStorage.setItem(this.keys.theme, theme);
        this.dispatchEvent('themeChanged', theme);
    }

    /**
     * Backup functionality
     */
    getLastBackupDate() {
        return localStorage.getItem('sap_migration_last_backup');
    }

    setLastBackupDate() {
        localStorage.setItem('sap_migration_last_backup', new Date().toISOString());
    }

    /**
     * Analytics and reporting data
     */
    async getAnalyticsData(days = 30) {
        const tasks = await this.getTasks();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // This is a simplified version - in a real app you'd track more detailed metrics
        const tasksCreated = tasks.filter(t => new Date(t.prazo) >= startDate);
        const tasksCompleted = tasks.filter(t => t.status === 'concluido');

        return {
            productivity: {
                tasksCreated: tasksCreated.length,
                tasksCompleted: tasksCompleted.length,
                totalHours: tasks.reduce((sum, t) => sum + (t.horasGastas || 0), 0)
            },
            statusDistribution: {
                planejado: tasks.filter(t => t.status === 'planejado').length,
                'em-andamento': tasks.filter(t => t.status === 'em-andamento').length,
                aguardando: tasks.filter(t => t.status === 'aguardando').length,
                concluido: tasks.filter(t => t.status === 'concluido').length
            },
            priorityDistribution: {
                baixa: tasks.filter(t => t.prioridade === 'baixa').length,
                media: tasks.filter(t => t.prioridade === 'media').length,
                alta: tasks.filter(t => t.prioridade === 'alta').length,
                critica: tasks.filter(t => t.prioridade === 'critica').length
            }
        };
    }
}

// Create global instance
window.storageManager = new StorageManager();
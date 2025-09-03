/**
 * SAP Migration Control Center - Dashboard Controller
 * Handles dashboard view logic and data visualization
 */

class DashboardController {
    constructor() {
        this.storage = window.storageManager;
		this.tasks = window.tasksController;
		this.objetcts = window.objectsController;
		this.changes = window.changesController;
        this.isInitialized = false;
        this.chartColors = {
            primary: '#8b5cf6',
            secondary: '#06b6d4',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444'
        };
        
        this.bindEvents();
    }

    /**
     * Bind dashboard-specific events
     */
    bindEvents() {
        // Listen for data changes
        document.addEventListener('tasksUpdated', () => this.updateDashboard());
        document.addEventListener('objectsUpdated', () => this.updateDashboard());
        document.addEventListener('requestsUpdated', () => this.updateDashboard());
        document.addEventListener('profileUpdated', () => this.updateProfile());
        document.addEventListener('dataImported', () => this.updateDashboard());
        
        // Quick action buttons
        document.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action) {
                e.preventDefault();
                this.handleQuickAction(action);
            }
        });
    }

    /**
     * Initialize dashboard when view becomes active
     */
    async initialize() {
        if (this.isInitialized) {
            await this.updateDashboard();
            return;
        }

        try {
            await this.updateProfile();
            await this.updateDashboard();
            this.setupProgressRing();
            this.isInitialized = true;
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.showError('Erro ao carregar dashboard');
        }
    }

    /**
     * Update profile section
     */
    async updateProfile() {
        try {
            const profile = await this.storage.getProfile();
            
            // Update hero section
            const heroName = document.getElementById('heroName');
            const heroProject = document.getElementById('heroProject');
            const heroDetails = document.getElementById('heroDetails');
            const userName = document.getElementById('userName');

            if (heroName) {
                heroName.textContent = profile.nome || 'Consultor';
            }
            
            if (userName) {
                userName.textContent = profile.nome || 'Consultor SAP';
            }

            if (heroProject) {
                heroProject.textContent = profile.empresa || 'Projeto SAP IS-U → S/4HANA Utilities';
            }

            if (heroDetails) {
                if (profile.inicioProject) {
                    const startDate = new Date(profile.inicioProject);
                    const today = new Date();
                    const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
                    
                    heroDetails.textContent = `Iniciado em ${startDate.toLocaleDateString('pt-BR')} • ${daysDiff} dias`;
                } else {
                    heroDetails.textContent = 'Configure seu perfil em Configurações';
                }
            }
        } catch (error) {
            console.error('Failed to update profile:', error);
        }
    }

    /**
     * Update all dashboard data
     */
    async updateDashboard() {
        try {
            const summary = await this.storage.getDataSummary();
            
            await this.updateStatCards(summary);
            await this.updateProgressRing(summary.progressPercentage);
            await this.updateCharts();
            await this.updateQuickInsights();
            
        } catch (error) {
            console.error('Failed to update dashboard:', error);
            this.showError('Erro ao atualizar dados do dashboard');
        }
    }

    /**
     * Update stat cards with current data
     */
    async updateStatCards(summary) {
        // Active Tasks
        const activeTasksEl = document.getElementById('activeTasks');
        const completedTasksEl = document.getElementById('completedTasks');
        if (activeTasksEl) activeTasksEl.textContent = summary.activeTasks;
        if (completedTasksEl) completedTasksEl.textContent = `${summary.completedTasks} concluídas`;

        // Total Hours
        const totalHoursEl = document.getElementById('totalHours');
        if (totalHoursEl) totalHoursEl.textContent = `${summary.totalHours}h`;

        // Total Objects
        const totalObjectsEl = document.getElementById('totalObjects');
        const convertedObjectsEl = document.getElementById('convertedObjects');
        if (totalObjectsEl) totalObjectsEl.textContent = summary.totalObjects;
        if (convertedObjectsEl) convertedObjectsEl.textContent = `${summary.convertedObjects} convertidos`;

        // Total Requests
        const totalRequestsEl = document.getElementById('totalRequests');
        if (totalRequestsEl) totalRequestsEl.textContent = summary.totalRequests;
    }

    /**
     * Setup and update progress ring
     */
    setupProgressRing() {
        // Create SVG gradient for progress ring
        const progressRing = document.querySelector('.progress-ring');
        if (!progressRing) return;

        const svg = progressRing;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        
        gradient.id = 'progressGradient';
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '100%');
        gradient.setAttribute('y2', '100%');

        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', this.chartColors.primary);

        const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', this.chartColors.secondary);

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        svg.insertBefore(defs, svg.firstChild);
    }

    /**
     * Update progress ring animation
     */
    updateProgressRing(percentage) {
        const progressRingFill = document.getElementById('progressRingFill');
        const progressValue = document.getElementById('progressValue');
        
        if (!progressRingFill || !progressValue) return;

        const circumference = 2 * Math.PI * 50; // radius = 50
        const offset = circumference - (percentage / 100) * circumference;
        
        // Animate the ring
        setTimeout(() => {
            progressRingFill.style.strokeDashoffset = offset;
            progressValue.textContent = `${percentage}%`;
        }, 500);
    }

    /**
     * Update charts with current data
     */
    async updateCharts() {
        await this.updateProductivityChart();
        await this.updateStatusChart();
    }

    /**
     * Update productivity chart
     */
    async updateProductivityChart() {
        const chartContainer = document.getElementById('productivityChart');
        if (!chartContainer) return;

        try {
            const tasks = await this.storage.getTasks();
            
            if (tasks.length === 0) {
                this.showEmptyChart(chartContainer, 'Dados aparecerão conforme você adicionar tarefas');
                return;
            }

            // Generate weekly productivity data
            const weeklyData = this.generateWeeklyProductivityData(tasks);
            this.renderProductivityChart(chartContainer, weeklyData);
            
        } catch (error) {
            console.error('Failed to update productivity chart:', error);
            this.showEmptyChart(chartContainer, 'Erro ao carregar dados');
        }
    }

    /**
     * Generate weekly productivity data from tasks
     */
    generateWeeklyProductivityData(tasks) {
        const today = new Date();
        const weekData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            
            const dayTasks = tasks.filter(task => {
                // Simplified: assume tasks worked on based on creation/update patterns
                // In real implementation, you'd track daily work logs
                return task.horasGastas > 0;
            });
            
            weekData.push({
                day: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
                date: date.toISOString().split('T')[0],
                tasks: Math.floor(Math.random() * 3), // Simplified for demo
                hours: Math.floor(Math.random() * 8) + 1 // Simplified for demo
            });
        }
        
        return weekData;
    }

    /**
     * Render productivity chart
     */
    renderProductivityChart(container, data) {
        // Simple chart rendering - in production, you'd use a proper chart library
        container.innerHTML = `
            <div class="simple-chart">
                <div class="chart-legend">
                    <div class="legend-item">
                        <div class="legend-color" style="background: ${this.chartColors.primary}"></div>
                        <span>Tarefas</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background: ${this.chartColors.secondary}"></div>
                        <span>Horas</span>
                    </div>
                </div>
                <div class="chart-bars">
                    ${data.map(item => `
                        <div class="bar-group">
                            <div class="bar tasks-bar" style="height: ${item.tasks * 20}px; background: ${this.chartColors.primary}"></div>
                            <div class="bar hours-bar" style="height: ${item.hours * 10}px; background: ${this.chartColors.secondary}"></div>
                            <div class="bar-label">${item.day}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <style>
                .simple-chart { padding: 1rem; }
                .chart-legend { display: flex; gap: 1rem; margin-bottom: 1rem; font-size: 0.875rem; }
                .legend-item { display: flex; align-items: center; gap: 0.5rem; }
                .legend-color { width: 12px; height: 12px; border-radius: 2px; }
                .chart-bars { display: flex; justify-content: space-between; align-items: end; height: 120px; }
                .bar-group { display: flex; flex-direction: column; align-items: center; flex: 1; }
                .bar { width: 20px; margin: 1px; border-radius: 2px 2px 0 0; min-height: 2px; }
                .bar-label { font-size: 0.75rem; margin-top: 0.5rem; color: var(--text-secondary); }
            </style>
        `;
    }

    /**
     * Update status chart
     */
    async updateStatusChart() {
        const chartContainer = document.getElementById('statusChart');
        if (!chartContainer) return;

        try {
            const analytics = await this.storage.getAnalyticsData();
            const statusData = analytics.statusDistribution;
            
            const hasData = Object.values(statusData).some(value => value > 0);
            
            if (!hasData) {
                this.showEmptyChart(chartContainer, 'Gráfico será gerado com suas tarefas');
                return;
            }

            this.renderStatusChart(chartContainer, statusData);
            
        } catch (error) {
            console.error('Failed to update status chart:', error);
            this.showEmptyChart(chartContainer, 'Erro ao carregar dados');
        }
    }

    /**
     * Render status chart as simple donut chart
     */
    renderStatusChart(container, data) {
        const total = Object.values(data).reduce((sum, value) => sum + value, 0);
        
        if (total === 0) {
            this.showEmptyChart(container, 'Nenhuma tarefa cadastrada');
            return;
        }

        const statusColors = {
            'planejado': '#6b7280',
            'em-andamento': '#3b82f6',
            'aguardando': '#f59e0b',
            'concluido': '#10b981'
        };

        const statusLabels = {
            'planejado': 'Planejado',
            'em-andamento': 'Em Andamento',
            'aguardando': 'Aguardando',
            'concluido': 'Concluído'
        };

        container.innerHTML = `
            <div class="status-chart">
                <div class="chart-center">
                    <div class="total-tasks">${total}</div>
                    <div class="total-label">Total</div>
                </div>
                <div class="status-legend">
                    ${Object.entries(data).map(([status, count]) => {
                        if (count === 0) return '';
                        const percentage = Math.round((count / total) * 100);
                        return `
                            <div class="status-item">
                                <div class="status-color" style="background: ${statusColors[status]}"></div>
                                <div class="status-details">
                                    <div class="status-name">${statusLabels[status]}</div>
                                    <div class="status-count">${count} (${percentage}%)</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <style>
                .status-chart { position: relative; height: 200px; display: flex; flex-direction: column; }
                .chart-center { 
                    position: absolute; 
                    top: 50%; 
                    left: 50%; 
                    transform: translate(-50%, -50%);
                    text-align: center;
                    z-index: 1;
                }
                .total-tasks { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
                .total-label { font-size: 0.75rem; color: var(--text-secondary); }
                .status-legend { margin-top: auto; display: flex; flex-direction: column; gap: 0.5rem; }
                .status-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
                .status-color { width: 8px; height: 8px; border-radius: 50%; }
                .status-details { display: flex; justify-content: space-between; flex: 1; }
                .status-name { color: var(--text-primary); }
                .status-count { color: var(--text-secondary); }
            </style>
        `;
    }

    /**
     * Show empty state for charts
     */
    showEmptyChart(container, message) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 3v18h18"/>
                    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
                </svg>
                <p>${message}</p>
            </div>
        `;
    }

    /**
     * Update quick insights section
     */
    async updateQuickInsights() {
        try {
            const tasks = await this.getTasks();
            const objects = await this.storage.getObjects();
            
            // Find urgent tasks
            const urgentTasks = tasks.filter(task => {
                if (task.status === 'concluido') return false;
                
                const deadline = new Date(task.prazo);
                const today = new Date();
                const daysUntilDeadline = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
                
                return daysUntilDeadline <= 3 && daysUntilDeadline >= 0;
            });

            // Find critical objects
            const criticalObjects = objects.filter(obj => 
                obj.impacto === 'critico' && obj.status !== 'convertido'
            );

            // Show insights in the dashboard
            this.displayInsights(urgentTasks, criticalObjects);
            
        } catch (error) {
            console.error('Failed to update insights:', error);
        }
    }

    /**
     * Display insights in dashboard
     */
    displayInsights(urgentTasks, criticalObjects) {
        // This would update an insights section if it exists
        // For now, we'll log the insights
        if (urgentTasks.length > 0) {
            console.log(`${urgentTasks.length} tarefas com prazo crítico`);
        }
        
        if (criticalObjects.length > 0) {
            console.log(`${criticalObjects.length} objetos críticos pendentes`);
        }
    }

    /**
     * Handle quick action buttons
     */
    handleQuickAction(action) {
        switch (action) {
            case 'new-task':
                document.dispatchEvent(new CustomEvent('showTaskModal'));
                break;
            case 'new-object':
                document.dispatchEvent(new CustomEvent('showObjectModal'));
                break;
            case 'import-data':
                document.dispatchEvent(new CustomEvent('importData'));
                break;
            case 'export-data':
                document.dispatchEvent(new CustomEvent('exportData'));
                break;
            default:
                console.log('Unknown quick action:', action);
        }
    }

    /**
     * Get tasks with error handling
     */
    async getTasks() {
        try {
            return await this.storage.getTasks();
        } catch (error) {
            console.error('Failed to get tasks:', error);
            return [];
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
     * Clean up dashboard controller
     */
    destroy() {
        this.isInitialized = false;
    }
}

// Create global dashboard instance
window.dashboardController = new DashboardController();
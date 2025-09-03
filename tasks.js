/**
 * SAP Migration Control Center - Tasks Controller
 * Handles task management, CRUD operations, and UI interactions
 */

class TasksController {
    constructor() {
        this.storage = window.storageManager;
        this.currentTasks = [];
        this.filteredTasks = [];
        this.currentEditingTask = null;
        this.viewMode = 'cards'; // cards or list
        
        this.statusColors = {
            'planejado': 'gradient-purple',
            'em-andamento': 'gradient-blue',
            'aguardando': 'gradient-orange',
            'concluido': 'gradient-green'
        };

        this.priorityColors = {
            'baixa': 'priority-baixa',
            'media': 'priority-media',
            'alta': 'priority-alta',
            'critica': 'priority-critica'
        };

        this.bindEvents();
    }

    /**
     * Bind task-related events
     */
    bindEvents() {
        // Task modal events
        document.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('submit', this.handleSubmit.bind(this));
		
		const newTaskBtn = document.getElementById('newTaskBtn');
		if (newTaskBtn) {
			newTaskBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.showTaskModal();
			});
		}
		
		const newObjectBtn = document.getElementById('newObjectBtn');
		if (newObjectBtn) {
			newObjectBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.showObjectModal();
			});
		}
        
        // Custom events
        document.addEventListener('showTaskModal', (e) => {
            this.showTaskModal(e.detail);
        });
        
        // Filter events
        this.bindFilterEvents();
        
        // Data change events
        document.addEventListener('tasksUpdated', () => {
            this.loadTasks();
        });

        // View mode toggle
        document.addEventListener('change', this.handleViewModeChange.bind(this));
		
		const saveProfileBtn = document.getElementById('saveProfileBtn');
		const exportDataBtn = document.getElementById('exportDataBtn');  
		const importDataBtn = document.getElementById('importDataBtn');
		const clearAllDataBtn = document.getElementById('clearAllDataBtn');
		const taskSaveBtn = document.getElementById('taskSaveBtn');

		if (saveProfileBtn) {
			saveProfileBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.saveProfile();
			});
		}

		if (exportDataBtn) {
			exportDataBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.exportData();
			});
		}

		if (importDataBtn) {
			importDataBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.showImportDialog();
			});
		}

		if (clearAllDataBtn) {
			clearAllDataBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.confirmClearAllData();
			});
		}
		
		if (taskSaveBtn) {
			taskSaveBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.saveTask();
			});
		}
    }

    /**
     * Bind filter events
     */
    bindFilterEvents() {
        const taskSearch = document.getElementById('taskSearch');
        const statusFilter = document.getElementById('statusFilter');
        const priorityFilter = document.getElementById('priorityFilter');

        if (taskSearch) {
            taskSearch.addEventListener('input', this.debounce(() => {
                this.applyFilters();
            }, 300));
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        if (priorityFilter) {
            priorityFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }
    }

    /**
     * Handle click events
     */
    handleClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const taskId = target.dataset.taskId;

        switch (action) {
            case 'new-task':
            case 'create-task':
                e.preventDefault();
                this.showTaskModal();
                break;
            case 'edit-task':
                e.preventDefault();
                if (taskId) this.editTask(taskId);
                break;
            case 'delete-task':
                e.preventDefault();
                if (taskId) this.confirmDeleteTask(taskId);
                break;
            case 'close-modal':
                e.preventDefault();
                this.closeModal();
                break;
            case 'cancel-task':
                e.preventDefault();
                this.closeModal();
                break;
        }
    }

    /**
     * Handle form submissions
     */
    handleSubmit(e) {
        if (e.target.id === 'taskForm') {
            e.preventDefault();
            this.saveTask();
        }
    }

    /**
     * Handle view mode changes
     */
    handleViewModeChange(e) {
        const toggleBtn = e.target.closest('[data-view-mode]');
        if (!toggleBtn) return;

        const mode = toggleBtn.dataset.viewMode;
        this.setViewMode(mode);
    }

    /**
     * Initialize tasks view
     */
    async initialize() {
        try {
            await this.loadTasks();
            this.setupViewModeToggle();
        } catch (error) {
            console.error('Tasks initialization failed:', error);
            this.showError('Erro ao carregar tarefas');
        }
    }

    /**
     * Load tasks from storage
     */
    async loadTasks() {
        try {
            this.currentTasks = await this.storage.getTasks();
            this.applyFilters();
            this.updateBadges();
        } catch (error) {
            console.error('Failed to load tasks:', error);
            this.currentTasks = [];
            this.filteredTasks = [];
            this.renderTasks();
        }
    }

    /**
     * Apply current filters to tasks
     */
    async applyFilters() {
        try {
            const searchQuery = document.getElementById('taskSearch')?.value || '';
            const statusFilter = document.getElementById('statusFilter')?.value || '';
            const priorityFilter = document.getElementById('priorityFilter')?.value || '';

            const filters = {
                status: statusFilter,
                priority: priorityFilter
            };

            this.filteredTasks = await this.storage.searchTasks(searchQuery, filters);
            this.renderTasks();
        } catch (error) {
            console.error('Failed to apply filters:', error);
            this.filteredTasks = [...this.currentTasks];
            this.renderTasks();
        }
    }

    /**
     * Render tasks in the container
     */
    renderTasks() {
        const container = document.getElementById('tasksContainer');
        if (!container) return;

        if (this.filteredTasks.length === 0) {
            this.renderEmptyState(container);
            return;
        }

        const tasksHTML = this.viewMode === 'cards' 
            ? this.renderTaskCards() 
            : this.renderTaskList();
            
        container.innerHTML = tasksHTML;
    }

    /**
     * Render tasks as cards
     */
    renderTaskCards() {
        return this.filteredTasks.map(task => {
            const daysUntilDeadline = this.calculateDaysUntilDeadline(task.prazo);
            const isOverdue = daysUntilDeadline < 0 && task.status !== 'concluido';
            const isUrgent = daysUntilDeadline <= 3 && daysUntilDeadline >= 0 && task.status !== 'concluido';
            const colorClass = this.statusColors[task.status] || 'gradient-purple';

            return `
                <div class="task-card" data-task-id="${task.id}">
                    <div class="task-header ${colorClass}">
                        <div class="task-id">${task.id}</div>
                        <div class="task-progress-value">${task.progresso || 0}%</div>
                    </div>
                    
                    <div class="task-body">
                        <h3 class="task-title">${this.escapeHtml(task.titulo)}</h3>
                        
                        <div class="task-meta">
                            <span class="task-badge status-${task.status}">${this.getStatusLabel(task.status)}</span>
                            <span class="task-badge ${this.priorityColors[task.prioridade]}">${this.getPriorityLabel(task.prioridade)}</span>
                            <span class="task-badge">${this.getCategoryLabel(task.categoria)}</span>
                        </div>
                        
                        <div class="task-progress">
                            <div class="task-progress-header">
                                <span>Progresso</span>
                                <span>${task.progresso || 0}%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill ${colorClass}" style="width: ${task.progresso || 0}%"></div>
                            </div>
                        </div>
                        
                        <div class="task-info">
                            <div class="task-hours">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 1rem; height: 1rem; margin-right: 0.25rem;">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12,6 12,12 16,14"/>
                                </svg>
                                ${task.horasGastas || 0}h / ${task.estimativa || 0}h
                            </div>
                            <div class="task-deadline ${isOverdue ? 'overdue' : isUrgent ? 'urgent' : ''}">
                                ${this.formatDeadline(task.prazo, task.status)}
                            </div>
                        </div>
                        
                        ${task.objetos && task.objetos.length > 0 ? `
                            <div class="task-objects">
                                <div class="objects-label">Objetos SAP:</div>
                                <div class="objects-list">
                                    ${task.objetos.slice(0, 2).map(obj => `
                                        <span class="object-tag">${obj}</span>
                                    `).join('')}
                                    ${task.objetos.length > 2 ? `
                                        <span class="more-objects">+${task.objetos.length - 2}</span>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="task-actions">
                            <button class="task-edit-btn" data-action="edit-task" data-task-id="${task.id}">
                                Editar
                            </button>
                            <div class="task-action-buttons">
                                <button data-action="delete-task" data-task-id="${task.id}" title="Excluir">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3,6 5,6 21,6"/>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                        <line x1="10" y1="11" x2="10" y2="17"/>
                                        <line x1="14" y1="11" x2="14" y2="17"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render tasks as list (placeholder for future implementation)
     */
    renderTaskList() {
        return `
            <div class="task-list-view">
                <div class="list-header">
                    <div>Tarefa</div>
                    <div>Status</div>
                    <div>Progresso</div>
                    <div>Prazo</div>
                    <div>Ações</div>
                </div>
                ${this.filteredTasks.map(task => `
                    <div class="list-row" data-task-id="${task.id}">
                        <div class="task-info">
                            <div class="task-title">${this.escapeHtml(task.titulo)}</div>
                            <div class="task-id">${task.id}</div>
                        </div>
                        <div class="task-status">
                            <span class="task-badge status-${task.status}">${this.getStatusLabel(task.status)}</span>
                        </div>
                        <div class="task-progress-simple">${task.progresso || 0}%</div>
                        <div class="task-deadline-simple">${this.formatDeadlineSimple(task.prazo)}</div>
                        <div class="task-actions-simple">
                            <button data-action="edit-task" data-task-id="${task.id}">Editar</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render empty state
     */
    renderEmptyState(container) {
        const hasFilters = document.getElementById('taskSearch')?.value || 
                          document.getElementById('statusFilter')?.value || 
                          document.getElementById('priorityFilter')?.value;

        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11H1l6-6 6 6"/>
                    <path d="M21 21v-6.5a3.5 3.5 0 0 0-7 0V21h7z"/>
                </svg>
                <h3>${hasFilters ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa cadastrada'}</h3>
                <p>${hasFilters ? 'Tente ajustar os filtros de busca' : 'Comece criando sua primeira tarefa para organizar o projeto'}</p>
                ${!hasFilters ? `
                    <button class="primary-button" data-action="create-task">
                        Criar Primeira Tarefa
                    </button>
                ` : ''}
            </div>
        `;
    }

    /**
     * Show task modal for creating/editing
     */
    async showTaskModal(taskId = null) {
        const modal = document.getElementById('taskModal');
        const form = document.getElementById('taskForm');
        const title = document.getElementById('taskModalTitle');
        
        if (!modal || !form) return;

        // Reset form
        form.reset();
        
        if (taskId) {
            // Edit mode
            const task = await this.storage.getTaskById(taskId);
            if (!task) {
                this.showError('Tarefa não encontrada');
                return;
            }
            
            this.currentEditingTask = task;
            title.textContent = 'Editar Tarefa';
            this.populateTaskForm(task);
        } else {
            // Create mode
            this.currentEditingTask = null;
            title.textContent = 'Nova Tarefa';
            
            // Set defaults
            const taskId = await this.storage.generateTaskId();
            document.getElementById('taskId').value = taskId;
            
            // Set default deadline (7 days from now)
            const defaultDeadline = new Date();
            defaultDeadline.setDate(defaultDeadline.getDate() + 7);
            document.getElementById('taskDeadline').value = defaultDeadline.toISOString().split('T')[0];
        }

        this.showModal(modal);
    }

    /**
     * Populate form with task data
     */
    populateTaskForm(task) {
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.titulo || '';
        document.getElementById('taskDescription').value = task.descricao || '';
        document.getElementById('taskDeadline').value = task.prazo || '';
        document.getElementById('taskStatus').value = task.status || 'planejado';
        document.getElementById('taskPriority').value = task.prioridade || 'media';
        document.getElementById('taskCategory').value = task.categoria || 'analise';
        document.getElementById('taskProgress').value = task.progresso || 0;
        document.getElementById('taskEstimate').value = task.estimativa || 8;
        document.getElementById('taskSpent').value = task.horasGastas || 0;
        document.getElementById('taskObjects').value = task.objetos ? task.objetos.join(', ') : '';
        document.getElementById('taskNotes').value = task.notas || '';
    }

    /**
     * Save task from form
     */
    async saveTask() {
        try {
            const formData = this.getTaskFormData();
            
            if (!this.validateTaskForm(formData)) {
                return;
            }

            const task = {
                id: formData.id,
                titulo: formData.titulo,
                descricao: formData.descricao,
                prazo: formData.prazo,
                status: formData.status,
                prioridade: formData.prioridade,
                categoria: formData.categoria,
                progresso: parseInt(formData.progresso) || 0,
                estimativa: parseFloat(formData.estimativa) || 0,
                horasGastas: parseFloat(formData.horasGastas) || 0,
                objetos: formData.objetos ? formData.objetos.split(',').map(s => s.trim()).filter(s => s) : [],
                notas: formData.notas,
                criadoEm: this.currentEditingTask ? this.currentEditingTask.criadoEm : new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            };

            await this.storage.saveTask(task);
            this.closeModal();
            this.showSuccess(this.currentEditingTask ? 'Tarefa atualizada com sucesso!' : 'Tarefa criada com sucesso!');
            
        } catch (error) {
            console.error('Failed to save task:', error);
            this.showError('Erro ao salvar tarefa');
        }
    }

    /**
     * Get task form data
     */
    getTaskFormData() {
        return {
            id: document.getElementById('taskId').value,
            titulo: document.getElementById('taskTitle').value.trim(),
            descricao: document.getElementById('taskDescription').value.trim(),
            prazo: document.getElementById('taskDeadline').value,
            status: document.getElementById('taskStatus').value,
            prioridade: document.getElementById('taskPriority').value,
            categoria: document.getElementById('taskCategory').value,
            progresso: document.getElementById('taskProgress').value,
            estimativa: document.getElementById('taskEstimate').value,
            horasGastas: document.getElementById('taskSpent').value,
            objetos: document.getElementById('taskObjects').value.trim(),
            notas: document.getElementById('taskNotes').value.trim()
        };
    }

    /**
     * Validate task form
     */
    validateTaskForm(formData) {
        if (!formData.titulo) {
            this.showError('Título é obrigatório');
            return false;
        }

        if (!formData.prazo) {
            this.showError('Prazo é obrigatório');
            return false;
        }

        return true;
    }

    /**
     * Edit task
     */
    async editTask(taskId) {
        await this.showTaskModal(taskId);
    }

    /**
     * Confirm task deletion
     */
    async confirmDeleteTask(taskId) {
        const task = await this.storage.getTaskById(taskId);
        if (!task) {
            this.showError('Tarefa não encontrada');
            return;
        }

        if (window.app && window.app.showConfirmModal) {
            window.app.showConfirmModal(
                'Excluir Tarefa',
                `Tem certeza que deseja excluir a tarefa "${task.titulo}"? Esta ação não pode ser desfeita.`,
                () => this.deleteTask(taskId)
            );
        } else {
            if (confirm(`Tem certeza que deseja excluir a tarefa "${task.titulo}"?`)) {
                await this.deleteTask(taskId);
            }
        }
    }

    /**
     * Delete task
     */
    async deleteTask(taskId) {
        try {
            await this.storage.deleteTask(taskId);
            this.showSuccess('Tarefa excluída com sucesso!');
        } catch (error) {
            console.error('Failed to delete task:', error);
            this.showError('Erro ao excluir tarefa');
        }
    }

    /**
     * Update navigation badges
     */
    updateBadges() {
        const activeTasks = this.currentTasks.filter(t => t.status !== 'concluido').length;
        const badge = document.getElementById('tasksBadge');
        if (badge) {
            badge.textContent = activeTasks;
            badge.style.display = activeTasks > 0 ? 'flex' : 'none';
        }
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update toggle buttons
        document.querySelectorAll('[data-view-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.viewMode === mode);
        });
        
        this.renderTasks();
    }

    /**
     * Setup view mode toggle
     */
    setupViewModeToggle() {
        document.querySelectorAll('[data-view-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.setViewMode(btn.dataset.viewMode);
            });
        });
    }

    // Utility methods

    /**
     * Calculate days until deadline
     */
    calculateDaysUntilDeadline(deadline) {
        const today = new Date();
        const deadlineDate = new Date(deadline);
        return Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
    }

    /**
     * Format deadline for display
     */
    formatDeadline(deadline, status) {
        if (status === 'concluido') return 'Concluído';
        
        const days = this.calculateDaysUntilDeadline(deadline);
        
        if (days < 0) {
            return `${Math.abs(days)} dias de atraso`;
        } else if (days === 0) {
            return 'Vence hoje';
        } else if (days === 1) {
            return 'Vence amanhã';
        } else {
            return `${days} dias restantes`;
        }
    }

    /**
     * Format deadline simple
     */
    formatDeadlineSimple(deadline) {
        return new Date(deadline).toLocaleDateString('pt-BR');
    }

    /**
     * Get status label
     */
    getStatusLabel(status) {
        const labels = {
            'planejado': 'Planejado',
            'em-andamento': 'Em Andamento',
            'aguardando': 'Aguardando',
            'concluido': 'Concluído'
        };
        return labels[status] || status;
    }

    /**
     * Get priority label
     */
    getPriorityLabel(priority) {
        const labels = {
            'baixa': 'Baixa',
            'media': 'Média',
            'alta': 'Alta',
            'critica': 'Crítica'
        };
        return labels[priority] || priority;
    }

    /**
     * Get category label
     */
    getCategoryLabel(category) {
        const labels = {
            'analise': 'Análise',
            'desenvolvimento': 'Desenvolvimento',
            'teste': 'Teste',
            'documentacao': 'Documentação'
        };
        return labels[category] || category;
    }

    /**
     * Show modal
     */
    showModal(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('taskModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            this.currentEditingTask = null;
        }
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
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
}

// Create global tasks controller instance
window.tasksController = new TasksController();
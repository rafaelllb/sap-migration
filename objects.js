/**
 * SAP Migration Control Center - Objects Controller
 * Handles SAP objects management, CRUD operations, and UI interactions
 */

class ObjectsController {
    constructor() {
        this.storage = window.storageManager;
        this.currentObjects = [];
        this.filteredObjects = [];
        this.currentEditingObject = null;
        
        this.statusColors = {
            'nao-analisado': 'gradient-gray',
            'em-analise': 'gradient-orange',
            'requer-conversao': 'gradient-red',
            'em-conversao': 'gradient-blue',
            'convertido': 'gradient-green'
        };

        this.impactColors = {
            'baixo': 'impact-baixo',
            'medio': 'impact-medio',
            'alto': 'impact-alto',
            'critico': 'impact-critico'
        };

        this.complexityColors = {
            'baixa': 'complexity-baixa',
            'media': 'complexity-media',
            'alta': 'complexity-alta',
            'muito-alta': 'complexity-muito-alta'
        };

        this.bindEvents();
    }

    /**
     * Bind object-related events
     */
    bindEvents() {
        // Object modal events
        document.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('submit', this.handleSubmit.bind(this));
        
        // Custom events
        document.addEventListener('showObjectModal', (e) => {
            this.showObjectModal(e.detail);
        });
        
        // Filter events
        this.bindFilterEvents();
        
        // Data change events
        document.addEventListener('objectsUpdated', () => {
            this.loadObjects();
        });
		
		const objectSaveBtn = document.getElementById('objectSaveBtn');
		
		if (objectSaveBtn) {
			objectSaveBtn.addEventListener('click', (e) => {
				e.preventDefault();
				this.saveObject();
				this.saveObject();
			});
		}
    }

    /**
     * Bind filter events
     */
    bindFilterEvents() {
        const objectSearch = document.getElementById('objectSearch');
        const typeFilter = document.getElementById('typeFilter');
        const objectStatusFilter = document.getElementById('objectStatusFilter');

        if (objectSearch) {
            objectSearch.addEventListener('input', this.debounce(() => {
                this.applyFilters();
            }, 300));
        }

        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.applyFilters();
            });
        }

        if (objectStatusFilter) {
            objectStatusFilter.addEventListener('change', () => {
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
        const objectId = target.dataset.objectId;

        switch (action) {
            case 'new-object':
            case 'create-object':
                e.preventDefault();
                this.showObjectModal();
                break;
            case 'edit-object':
                e.preventDefault();
                if (objectId) this.editObject(objectId);
                break;
            case 'delete-object':
                e.preventDefault();
                if (objectId) this.confirmDeleteObject(objectId);
                break;
            case 'close-object-modal':
                e.preventDefault();
                this.closeModal();
                break;
            case 'cancel-object':
                e.preventDefault();
                this.closeModal();
                break;
        }
    }

    /**
     * Handle form submissions
     */
    handleSubmit(e) {
        if (e.target.id === 'objectForm') {
            e.preventDefault();
            this.saveObject();
        }
    }

    /**
     * Initialize objects view
     */
    async initialize() {
        try {
            await this.loadObjects();
        } catch (error) {
            console.error('Objects initialization failed:', error);
            this.showError('Erro ao carregar objetos');
        }
    }

    /**
     * Load objects from storage
     */
    async loadObjects() {
        try {
            this.currentObjects = await this.storage.getObjects();
            this.applyFilters();
            this.updateBadges();
        } catch (error) {
            console.error('Failed to load objects:', error);
            this.currentObjects = [];
            this.filteredObjects = [];
            this.renderObjects();
        }
    }

    /**
     * Apply current filters to objects
     */
    async applyFilters() {
        try {
            const searchQuery = document.getElementById('objectSearch')?.value || '';
            const typeFilter = document.getElementById('typeFilter')?.value || '';
            const statusFilter = document.getElementById('objectStatusFilter')?.value || '';

            const filters = {
                type: typeFilter,
                status: statusFilter
            };

            this.filteredObjects = await this.storage.searchObjects(searchQuery, filters);
            this.renderObjects();
        } catch (error) {
            console.error('Failed to apply filters:', error);
            this.filteredObjects = [...this.currentObjects];
            this.renderObjects();
        }
    }

    /**
     * Render objects in the container
     */
    renderObjects() {
        const container = document.getElementById('objectsContainer');
        if (!container) return;

        if (this.filteredObjects.length === 0) {
            this.renderEmptyState(container);
            return;
        }

        const objectsHTML = this.renderObjectCards();
        container.innerHTML = objectsHTML;
    }

    /**
     * Render objects as cards
     */
    renderObjectCards() {
        return this.filteredObjects.map(object => {
            const statusColorClass = this.statusColors[object.status] || 'gradient-gray';
            
            return `
                <div class="object-card" data-object-id="${object.id}">
                    <div class="object-header">
                        <div class="object-info">
                            <h3 class="object-name">${this.escapeHtml(object.nome || object.id)}</h3>
                            <div class="object-type">${this.escapeHtml(object.tipo)}</div>
                        </div>
                        <div class="object-badges">
                            <span class="object-badge status-${object.status}">${this.getStatusLabel(object.status)}</span>
                            <span class="object-badge ${this.impactColors[object.impacto]}">${this.getImpactLabel(object.impacto)}</span>
                        </div>
                    </div>
                    
                    <div class="object-details">
                        <div class="object-detail-item">
                            <span class="object-detail-label">Complexidade:</span>
                            <span class="object-detail-value complexity-${object.complexidade}">
                                ${this.getComplexityLabel(object.complexidade)}
                            </span>
                        </div>
                        
                        <div class="object-detail-item">
                            <span class="object-detail-label">Esforço estimado:</span>
                            <span class="object-detail-value">${object.esforco_estimado || 0}h</span>
                        </div>
                        
                        ${object.s4hana_equivalente ? `
                            <div class="object-detail-item">
                                <span class="object-detail-label">S/4HANA:</span>
                                <span class="object-detail-value">${this.escapeHtml(object.s4hana_equivalente)}</span>
                            </div>
                        ` : ''}
                        
                        ${object.tarefas && object.tarefas.length > 0 ? `
                            <div class="object-detail-item">
                                <span class="object-detail-label">Tarefas relacionadas:</span>
                                <div class="related-tasks">
                                    ${object.tarefas.map(taskId => `
                                        <span class="task-tag">${taskId}</span>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${object.notas ? `
                            <div class="object-notes">
                                <div class="notes-label">Observações:</div>
                                <div class="notes-content">${this.escapeHtml(object.notas).substring(0, 150)}${object.notas.length > 150 ? '...' : ''}</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="object-actions">
                        <button class="object-edit-btn" data-action="edit-object" data-object-id="${object.id}">
                            Editar
                        </button>
                        <div class="object-action-buttons">
                            <button data-action="delete-object" data-object-id="${object.id}" title="Excluir">
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
            `;
        }).join('');
    }

    /**
     * Render empty state
     */
    renderEmptyState(container) {
        const hasFilters = document.getElementById('objectSearch')?.value || 
                          document.getElementById('typeFilter')?.value || 
                          document.getElementById('objectStatusFilter')?.value;

        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7l2-7z"/>
                </svg>
                <h3>${hasFilters ? 'Nenhum objeto encontrado' : 'Nenhum objeto cadastrado'}</h3>
                <p>${hasFilters ? 'Tente ajustar os filtros de busca' : 'Adicione objetos SAP conforme identifica no projeto'}</p>
                ${!hasFilters ? `
                    <button class="primary-button" data-action="create-object">
                        Adicionar Primeiro Objeto
                    </button>
                ` : ''}
            </div>
        `;
    }

    /**
     * Show object modal for creating/editing
     */
    async showObjectModal(objectId = null) {
        const modal = document.getElementById('objectModal');
        const form = document.getElementById('objectForm');
        const title = document.getElementById('objectModalTitle');
        
        if (!modal || !form) return;

        // Reset form
        form.reset();
        
        if (objectId) {
            // Edit mode
            const object = await this.storage.getObjectById(objectId);
            if (!object) {
                this.showError('Objeto não encontrado');
                return;
            }
            
            this.currentEditingObject = object;
            title.textContent = 'Editar Objeto SAP';
            this.populateObjectForm(object);
        } else {
            // Create mode
            this.currentEditingObject = null;
            title.textContent = 'Novo Objeto SAP';
            
            // Set defaults
            document.getElementById('objectStatus').value = 'nao-analisado';
            document.getElementById('objectComplexity').value = 'media';
            document.getElementById('objectImpact').value = 'medio';
        }

        this.showModal(modal);
    }

    /**
     * Populate form with object data
     */
    populateObjectForm(object) {
        document.getElementById('objectId').value = object.id || '';
        document.getElementById('objectType').value = object.tipo || '';
        document.getElementById('objectStatus').value = object.status || 'nao-analisado';
        document.getElementById('objectComplexity').value = object.complexidade || 'media';
        document.getElementById('objectImpact').value = object.impacto || 'medio';
        document.getElementById('objectEffort').value = object.esforco_estimado || 0;
        document.getElementById('objectS4Equivalent').value = object.s4hana_equivalente || '';
        document.getElementById('objectNotes').value = object.notas || '';
        document.getElementById('objectTasks').value = object.tarefas ? object.tarefas.join(', ') : '';
    }

    /**
     * Save object from form
     */
    async saveObject() {
        try {
            const formData = this.getObjectFormData();
            
            if (!this.validateObjectForm(formData)) {
                return;
            }

            const object = {
                id: formData.id,
                nome: formData.id, // Use ID as name for consistency
                tipo: formData.tipo,
                status: formData.status,
                complexidade: formData.complexidade,
                impacto: formData.impacto,
                esforco_estimado: parseFloat(formData.esforco) || 0,
                s4hana_equivalente: formData.s4equivalente,
                notas: formData.notas,
                tarefas: formData.tarefas ? formData.tarefas.split(',').map(s => s.trim()).filter(s => s) : [],
                criadoEm: this.currentEditingObject ? this.currentEditingObject.criadoEm : new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            };

            await this.storage.saveObject(object);
            this.closeModal();
            this.showSuccess(this.currentEditingObject ? 'Objeto atualizado com sucesso!' : 'Objeto criado com sucesso!');
            
        } catch (error) {
            console.error('Failed to save object:', error);
            this.showError('Erro ao salvar objeto');
        }
    }

    /**
     * Get object form data
     */
    getObjectFormData() {
        return {
            id: document.getElementById('objectId').value.trim().toUpperCase(),
            tipo: document.getElementById('objectType').value,
            status: document.getElementById('objectStatus').value,
            complexidade: document.getElementById('objectComplexity').value,
            impacto: document.getElementById('objectImpact').value,
            esforco: document.getElementById('objectEffort').value,
            s4equivalente: document.getElementById('objectS4Equivalent').value.trim(),
            notas: document.getElementById('objectNotes').value.trim(),
            tarefas: document.getElementById('objectTasks').value.trim()
        };
    }

    /**
     * Validate object form
     */
    validateObjectForm(formData) {
        if (!formData.id) {
            this.showError('ID do objeto é obrigatório');
            return false;
        }

        if (!formData.tipo) {
            this.showError('Tipo do objeto é obrigatório');
            return false;
        }

        // Check if object ID already exists (for new objects)
        if (!this.currentEditingObject) {
            const existingObject = this.currentObjects.find(obj => obj.id === formData.id);
            if (existingObject) {
                this.showError('Já existe um objeto com este ID');
                return false;
            }
        }

        return true;
    }

    /**
     * Edit object
     */
    async editObject(objectId) {
        await this.showObjectModal(objectId);
    }

    /**
     * Confirm object deletion
     */
    async confirmDeleteObject(objectId) {
        const object = await this.storage.getObjectById(objectId);
        if (!object) {
            this.showError('Objeto não encontrado');
            return;
        }

        if (window.app && window.app.showConfirmModal) {
            window.app.showConfirmModal(
                'Excluir Objeto',
                `Tem certeza que deseja excluir o objeto "${object.id}"? Esta ação não pode ser desfeita.`,
                () => this.deleteObject(objectId)
            );
        } else {
            if (confirm(`Tem certeza que deseja excluir o objeto "${object.id}"?`)) {
                await this.deleteObject(objectId);
            }
        }
    }

    /**
     * Delete object
     */
    async deleteObject(objectId) {
        try {
            await this.storage.deleteObject(objectId);
            this.showSuccess('Objeto excluído com sucesso!');
        } catch (error) {
            console.error('Failed to delete object:', error);
            this.showError('Erro ao excluir objeto');
        }
    }

    /**
     * Update navigation badges
     */
    updateBadges() {
        const totalObjects = this.currentObjects.length;
        const badge = document.getElementById('objectsBadge');
        if (badge) {
            badge.textContent = totalObjects;
            badge.style.display = totalObjects > 0 ? 'flex' : 'none';
        }
    }

    /**
     * Get object statistics for dashboard
     */
    getObjectStatistics() {
        const stats = {
            total: this.currentObjects.length,
            converted: this.currentObjects.filter(obj => obj.status === 'convertido').length,
            critical: this.currentObjects.filter(obj => obj.impacto === 'critico').length,
            highComplexity: this.currentObjects.filter(obj => obj.complexidade === 'alta' || obj.complexidade === 'muito-alta').length
        };

        stats.conversionRate = stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0;
        
        return stats;
    }

    // Utility methods

    /**
     * Get status label
     */
    getStatusLabel(status) {
        const labels = {
            'nao-analisado': 'Não Analisado',
            'em-analise': 'Em Análise',
            'requer-conversao': 'Requer Conversão',
            'em-conversao': 'Em Conversão',
            'convertido': 'Convertido'
        };
        return labels[status] || status;
    }

    /**
     * Get impact label
     */
    getImpactLabel(impact) {
        const labels = {
            'baixo': 'Baixo',
            'medio': 'Médio',
            'alto': 'Alto',
            'critico': 'Crítico'
        };
        return labels[impact] || impact;
    }

    /**
     * Get complexity label
     */
    getComplexityLabel(complexity) {
        const labels = {
            'baixa': 'Baixa',
            'media': 'Média',
            'alta': 'Alta',
            'muito-alta': 'Muito Alta'
        };
        return labels[complexity] || complexity;
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
        const modal = document.getElementById('objectModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            this.currentEditingObject = null;
        }
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (!text) return '';
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

// Create global objects controller instance
window.objectsController = new ObjectsController();
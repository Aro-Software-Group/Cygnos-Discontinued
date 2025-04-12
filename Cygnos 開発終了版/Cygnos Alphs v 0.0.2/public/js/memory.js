/**
 * Cygnos Memory System
 * Handles storing and retrieving conversation history and knowledge items
 */

class MemorySystem {
    constructor() {
        this.conversations = [];
        this.currentConversation = null;
        this.memoryItems = [];
        this.loadFromStorage();
    }

    /**
     * Initialize a new conversation
     * @param {string} title - Conversation title
     * @returns {Object} - New conversation object
     */
    initConversation(title = '新しい会話') {
        const conversation = {
            id: this._generateId(),
            title: title,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.currentConversation = conversation;
        this.conversations.push(conversation);
        this.saveToStorage();
        
        return conversation;
    }

    /**
     * Add a message to the current conversation
     * @param {Object} message - Message object
     * @returns {Object} - Updated conversation
     */
    addMessage(message) {
        if (!this.currentConversation) {
            this.initConversation();
        }
        
        const formattedMessage = {
            id: this._generateId(),
            role: message.role,
            content: message.content,
            timestamp: new Date().toISOString(),
            metadata: message.metadata || {}
        };
        
        this.currentConversation.messages.push(formattedMessage);
        this.currentConversation.updatedAt = new Date().toISOString();
        
        // If it's the first user message, update the conversation title
        if (this.currentConversation.messages.length === 1 && message.role === 'user') {
            this.currentConversation.title = this._generateTitle(message.content);
        }
        
        this.saveToStorage();
        
        return this.currentConversation;
    }

    /**
     * Generate a conversation title from content
     * @param {string} content - Message content
     * @returns {string} - Generated title
     */
    _generateTitle(content) {
        // Get first 30 characters or first line, whichever is shorter
        let title = content.split('\n')[0].trim();
        return title.length > 30 ? title.substring(0, 30) + '...' : title;
    }

    /**
     * Load a specific conversation
     * @param {string} conversationId - Conversation ID
     * @returns {Object} - Loaded conversation
     */
    loadConversation(conversationId) {
        const conversation = this.conversations.find(c => c.id === conversationId);
        if (!conversation) {
            throw new Error('会話が見つかりません');
        }
        
        this.currentConversation = conversation;
        return conversation;
    }

    /**
     * Delete a conversation
     * @param {string} conversationId - Conversation ID
     * @returns {boolean} - Success status
     */
    deleteConversation(conversationId) {
        const index = this.conversations.findIndex(c => c.id === conversationId);
        if (index === -1) {
            return false;
        }
        
        this.conversations.splice(index, 1);
        
        // Reset current conversation if it was deleted
        if (this.currentConversation && this.currentConversation.id === conversationId) {
            this.currentConversation = null;
        }
        
        this.saveToStorage();
        return true;
    }

    /**
     * Get the last N messages from the current conversation
     * @param {number} count - Number of messages to retrieve
     * @returns {Array} - Array of messages
     */
    getRecentMessages(count = CYGNOS_CONFIG.memory.maxMessagesInContext) {
        if (!this.currentConversation) {
            return [];
        }
        
        return this.currentConversation.messages.slice(-count);
    }

    /**
     * Get messages formatted for API context
     * @param {number} count - Number of messages to include
     * @returns {Array} - Array of formatted messages
     */
    getMessagesForContext(count = CYGNOS_CONFIG.memory.maxMessagesInContext) {
        const messages = this.getRecentMessages(count);
        
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    /**
     * Add an item to memory
     * @param {Object} item - Memory item
     * @returns {Object} - Added memory item
     */
    addMemoryItem(item) {
        const memoryItem = {
            id: this._generateId(),
            content: item.content,
            type: item.type || 'text',
            source: item.source || 'user',
            timestamp: new Date().toISOString(),
            metadata: item.metadata || {}
        };
        
        this.memoryItems.push(memoryItem);
        
        // Ensure we don't exceed maximum memory items
        if (this.memoryItems.length > CYGNOS_CONFIG.memory.maxMemoryItems) {
            this.memoryItems.shift(); // Remove oldest item
        }
        
        this.saveToStorage();
        this._updateMemoryDisplay();
        
        return memoryItem;
    }

    /**
     * Get memory items by type
     * @param {string} type - Memory item type
     * @returns {Array} - Array of memory items
     */
    getMemoryItemsByType(type) {
        return this.memoryItems.filter(item => item.type === type);
    }

    /**
     * Remove a memory item
     * @param {string} itemId - Memory item ID
     * @returns {boolean} - Success status
     */
    removeMemoryItem(itemId) {
        const index = this.memoryItems.findIndex(item => item.id === itemId);
        if (index === -1) {
            return false;
        }
        
        this.memoryItems.splice(index, 1);
        this.saveToStorage();
        this._updateMemoryDisplay();
        
        return true;
    }

    /**
     * Search memory items
     * @param {string} query - Search query
     * @returns {Array} - Array of matching memory items
     */
    searchMemory(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.memoryItems.filter(item => 
            item.content.toLowerCase().includes(lowercaseQuery) ||
            (item.metadata && item.metadata.tags && 
             item.metadata.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)))
        );
    }

    /**
     * Get contextually relevant memory items
     * @param {string} context - Context text
     * @param {number} limit - Maximum number of items to return
     * @returns {Array} - Array of relevant memory items
     */
    getRelevantMemory(context, limit = 5) {
        // This is a simple implementation that could be improved with embeddings
        return this.searchMemory(context).slice(0, limit);
    }

    /**
     * Generate a unique ID
     * @returns {string} - Unique ID
     */
    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Save conversations and memory to local storage
     */
    saveToStorage() {
        if (!settingsManager.getUserSetting('saveConversationHistory')) {
            return; // Skip saving if user disabled conversation history
        }
        
        try {
            // Save conversations with proper error handling
            const conversationsToSave = this.conversations.slice(-CYGNOS_CONFIG.memory.maxStoredConversations);
            const serializedConversations = JSON.stringify(conversationsToSave);
            if (serializedConversations) {
                localStorage.setItem(CYGNOS_CONFIG.storageKeys.conversations, serializedConversations);
            }
            
            // Save memory items with proper error handling
            const serializedMemory = JSON.stringify(this.memoryItems);
            if (serializedMemory) {
                localStorage.setItem(CYGNOS_CONFIG.storageKeys.memory, serializedMemory);
            }
        } catch (error) {
            console.error('メモリの保存エラー:', error);
            // Try to clear some space if storage is full
            try {
                this._cleanupStorage();
                // Retry saving after cleanup
                this.saveToStorage();
            } catch (retryError) {
                console.error('ストレージのクリーンアップ後も保存に失敗:', retryError);
                throw new Error('メモリの保存に失敗しました。ブラウザのストレージ容量を確認してください。');
            }
        }
    }
    
    /**
     * Clean up storage when it's full
     * @private
     */
    _cleanupStorage() {
        try {
            // Remove old conversations exceeding the limit
            if (this.conversations.length > CYGNOS_CONFIG.memory.maxStoredConversations) {
                this.conversations = this.conversations.slice(-CYGNOS_CONFIG.memory.maxStoredConversations);
            }
            
            // Remove old memory items exceeding the limit
            if (this.memoryItems.length > CYGNOS_CONFIG.memory.maxMemoryItems) {
                this.memoryItems = this.memoryItems.slice(-CYGNOS_CONFIG.memory.maxMemoryItems);
            }
            
            // Try to clear other non-essential data
            for (const key in localStorage) {
                if (key.startsWith('temp_') || key.includes('cache_')) {
                    localStorage.removeItem(key);
                }
            }
        } catch (error) {
            console.error('ストレージのクリーンアップエラー:', error);
            throw error;
        }
    }

    /**
     * Load conversations and memory from local storage with improved error handling
     */
    loadFromStorage() {
        try {
            // Load conversations with validation
            const savedConversations = localStorage.getItem(CYGNOS_CONFIG.storageKeys.conversations);
            if (savedConversations) {
                const parsed = JSON.parse(savedConversations);
                if (Array.isArray(parsed)) {
                    this.conversations = parsed;
                } else {
                    throw new Error('会話データの形式が無効です');
                }
            }
            
            // Load memory items with validation
            const savedMemory = localStorage.getItem(CYGNOS_CONFIG.storageKeys.memory);
            if (savedMemory) {
                const parsed = JSON.parse(savedMemory);
                if (Array.isArray(parsed)) {
                    this.memoryItems = parsed;
                } else {
                    throw new Error('メモリデータの形式が無効です');
                }
            }
            
            // Validate and repair data if needed
            this._validateAndRepairData();
            
            // Update memory display
            this._updateMemoryDisplay();
        } catch (error) {
            console.error('メモリの読み込みエラー:', error);
            // Reset to safe default state
            this.conversations = [];
            this.memoryItems = [];
            // Notify user of the error
            if (window.uiManager) {
                window.uiManager.showNotification('メモリの読み込み中にエラーが発生しました。データをリセットしました。', 'warning');
            }
        }
    }

    /**
     * Validate and repair memory data if needed
     * @private
     */
    _validateAndRepairData() {
        // Validate conversations
        this.conversations = this.conversations.filter(conv => {
            return conv && typeof conv === 'object' && 
                   typeof conv.id === 'string' &&
                   Array.isArray(conv.messages);
        });

        // Validate memory items
        this.memoryItems = this.memoryItems.filter(item => {
            return item && typeof item === 'object' &&
                   typeof item.id === 'string' &&
                   typeof item.content === 'string';
        });

        // Ensure required properties
        this.conversations.forEach(conv => {
            if (!conv.createdAt) conv.createdAt = new Date().toISOString();
            if (!conv.updatedAt) conv.updatedAt = conv.createdAt;
            if (!conv.title) conv.title = '無題の会話';
        });

        this.memoryItems.forEach(item => {
            if (!item.timestamp) item.timestamp = new Date().toISOString();
            if (!item.type) item.type = 'text';
            if (!item.metadata) item.metadata = {};
        });
    }

    /**
     * Clear all conversations and memory
     */
    clearAll() {
        this.conversations = [];
        this.currentConversation = null;
        this.memoryItems = [];
        this.saveToStorage();
        this._updateMemoryDisplay();
    }

    /**
     * Clear the current conversation
     */
    clearCurrentConversation() {
        if (this.currentConversation) {
            this.currentConversation.messages = [];
            this.currentConversation.updatedAt = new Date().toISOString();
            this.saveToStorage();
        }
    }

    /**
     * Update memory status display
     */
    _updateMemoryDisplay() {
        const memoryBar = document.querySelector('.memory-bar');
        const memoryUsed = document.getElementById('memory-used');
        
        if (memoryBar && memoryUsed) {
            const percentage = (this.memoryItems.length / CYGNOS_CONFIG.memory.maxMemoryItems) * 100;
            memoryBar.style.width = `${percentage}%`;
            memoryUsed.textContent = this.memoryItems.length;
        }
    }

    /**
     * Export all conversations and memory as a JSON file
     */
    exportData() {
        const data = {
            conversations: this.conversations,
            memory: this.memoryItems,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `cygnos-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Import conversations and memory from a JSON file
     * @param {Object} data - Imported data
     * @returns {boolean} - Success status
     */
    importData(data) {
        try {
            if (data.conversations && Array.isArray(data.conversations)) {
                this.conversations = data.conversations;
            }
            
            if (data.memory && Array.isArray(data.memory)) {
                this.memoryItems = data.memory;
            }
            
            this.currentConversation = null;
            this.saveToStorage();
            this._updateMemoryDisplay();
            
            return true;
        } catch (error) {
            console.error('データのインポートエラー:', error);
            return false;
        }
    }
}

// Initialize Memory System
const memorySystem = new MemorySystem();

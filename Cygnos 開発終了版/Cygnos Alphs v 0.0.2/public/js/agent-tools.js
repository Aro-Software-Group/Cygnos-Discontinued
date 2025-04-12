/**
 * Cygnos Agent Tools
 * Advanced tools for autonomous agent capabilities
 */
class AgentTools {
    constructor() {
        this.webSearchCache = new Map();
        this.recentToolCalls = [];
        this.maxCacheAge = 60 * 60 * 1000; // 1 hour in milliseconds
        this.maxCacheSize = 50; // Maximum number of cached search results
        this.toolCallHistory = [];
    }

    /**
     * Search the web for information
     * @param {string} query - Search query
     * @returns {Promise<Object>} - Search results
     */
    async searchWeb(query) {
        // Check cache first
        if (this.webSearchCache.has(query)) {
            const cachedResult = this.webSearchCache.get(query);
            if (Date.now() - cachedResult.timestamp < this.maxCacheAge) {
                this._logToolCall('searchWeb', [query], 'cache_hit');
                return cachedResult.data;
            }
        }

        this._logToolCall('searchWeb', [query], 'executing');

        try {
            // Simulate a web search (in real implementation, this would connect to a search API)
            const searchResults = await this._simulateWebSearch(query);
            
            // Cache results
            this._addToCache(query, searchResults);
            
            // Log successful tool call
            this._logToolCall('searchWeb', [query], 'success');
            
            return searchResults;
        } catch (error) {
            // Log failed tool call
            this._logToolCall('searchWeb', [query], 'error', error.message);
            throw error;
        }
    }

    /**
     * Execute code (currently simulated)
     * @param {string} code - Code to execute
     * @param {string} language - Programming language
     * @returns {Promise<Object>} - Execution results
     */
    async executeCode(code, language = 'javascript') {
        this._logToolCall('executeCode', [code, language], 'executing');

        try {
            if (!settingsManager.getUserSetting('allowCodeExecution')) {
                throw new Error('コード実行は設定で無効になっています');
            }

            let result;
            
            if (language.toLowerCase() === 'javascript') {
                // Extremely simple and limited JavaScript execution in a sandboxed environment
                // WARNING: This is not secure for production use!
                try {
                    // Create a sandbox environment
                    const sandbox = {
                        console: {
                            log: (...args) => {
                                return args.join(' ');
                            }
                        },
                        Math: Math,
                        Date: Date,
                        setTimeout: () => {},
                        setInterval: () => {},
                        result: null
                    };
                    
                    // Add a main function wrapper to capture return value
                    const wrappedCode = `
                        function __main__() {
                            ${code}
                        }
                        sandbox.result = __main__();
                    `;
                    
                    // Create a function from the code and execute it with the sandbox
                    const scriptFunction = new Function('sandbox', wrappedCode);
                    scriptFunction(sandbox);
                    
                    result = {
                        success: true,
                        output: sandbox.result,
                        returnValue: sandbox.result
                    };
                } catch (jsError) {
                    result = {
                        success: false,
                        error: jsError.message,
                        errorType: jsError.name
                    };
                }
            } else {
                // For other languages, simulate execution
                result = this._simulateCodeExecution(code, language);
            }
            
            // Log successful tool call
            this._logToolCall('executeCode', [code, language], 'success');
            
            return result;
        } catch (error) {
            // Log failed tool call
            this._logToolCall('executeCode', [code, language], 'error', error.message);
            throw error;
        }
    }

    /**
     * Process and analyze a file
     * @param {File|string} file - File to analyze or text content
     * @param {string} type - File type
     * @returns {Promise<Object>} - Analysis results
     */
    async analyzeFile(file, type) {
        this._logToolCall('analyzeFile', [file instanceof File ? file.name : 'text', type], 'executing');

        try {
            if (!settingsManager.getUserSetting('allowFileAccess')) {
                throw new Error('ファイルアクセスは設定で無効になっています');
            }

            let content;
            
            if (file instanceof File) {
                // Check file size
                if (file.size > CYGNOS_CONFIG.capabilities.fileProcessing.maxFileSize) {
                    throw new Error('ファイルサイズが上限を超えています');
                }
                
                // Check allowed file types
                if (!CYGNOS_CONFIG.capabilities.fileProcessing.allowedFileTypes.includes(file.type)) {
                    throw new Error('このファイル形式はサポートされていません');
                }
                
                // Read file content
                content = await this._readFileContent(file);
            } else {
                // Assume file is text content
                content = file;
            }
            
            // Analyze content based on type
            const analysis = await this._analyzeContent(content, type);
            
            // Log successful tool call
            this._logToolCall('analyzeFile', [file instanceof File ? file.name : 'text', type], 'success');
            
            return analysis;
        } catch (error) {
            // Log failed tool call
            this._logToolCall('analyzeFile', [file instanceof File ? file.name : 'text', type], 'error', error.message);
            throw error;
        }
    }

    /**
     * Get current context information
     * @returns {Object} - Context information
     */
    getCurrentContext() {
        this._logToolCall('getCurrentContext', [], 'executing');

        try {
            const context = {
                timestamp: new Date().toISOString(),
                browserInfo: {
                    userAgent: navigator.userAgent,
                    language: navigator.language,
                    platform: navigator.platform
                },
                screenInfo: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                memoryStats: {
                    conversationCount: memorySystem.conversations.length,
                    currentConversationId: memorySystem.currentConversation ? memorySystem.currentConversation.id : null,
                    memoryItemCount: memorySystem.memoryItems.length
                },
                processorStats: {
                    hasCurrentTask: !!processorSystem.currentTask,
                    currentTaskStatus: processorSystem.currentTask ? processorSystem.currentTask.status : null,
                    stepCount: processorSystem.steps.length,
                    currentStepIndex: processorSystem.currentStepIndex
                },
                userSettings: {
                    autonomyLevel: settingsManager.getUserSetting('autonomyLevel'),
                    theme: settingsManager.getUserSetting('theme')
                }
            };
            
            // Log successful tool call
            this._logToolCall('getCurrentContext', [], 'success');
            
            return context;
        } catch (error) {
            // Log failed tool call
            this._logToolCall('getCurrentContext', [], 'error', error.message);
            throw error;
        }
    }

    /**
     * Make a decision based on provided options
     * @param {Object} options - Decision options
     * @returns {Promise<Object>} - Decision result
     */
    async makeDecision(options) {
        const { choices, criteria, context } = options;
        
        this._logToolCall('makeDecision', [JSON.stringify(options)], 'executing');

        try {
            // Validate input
            if (!Array.isArray(choices) || choices.length === 0) {
                throw new Error('選択肢は配列で指定し、少なくとも1つの項目を含める必要があります');
            }
            
            // Construct decision prompt
            const decisionPrompt = `
以下の選択肢から最適な決定を行い、その理由を説明してください:

選択肢:
${choices.map((choice, index) => `${index + 1}. ${choice}`).join('\n')}

${criteria ? `判断基準:\n${criteria}\n` : ''}
${context ? `コンテキスト:\n${context}\n` : ''}

以下の形式でJSON回答を提供してください:
{
  "selectedChoice": "選択した項目",
  "selectedIndex": 選択した項目のインデックス（0から始まる）,
  "confidence": 0から1の間の確信度,
  "reasoning": "選択の理由の詳細な説明"
}
`;
            
            // Call API with decision prompt
            const response = await apiService.sendRequest({
                prompt: decisionPrompt,
                systemPrompt: SYSTEM_PROMPTS.reasoning
            });
            
            // Parse decision result
            let decision;
            try {
                decision = JSON.parse(response.text);
            } catch (parseError) {
                // If JSON parsing fails, extract JSON from the response
                const jsonMatch = response.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    decision = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('決定結果の解析に失敗しました');
                }
            }
            
            // Add decision to memory
            await memorySystem.addMemoryItem({
                content: `判断: ${decision.selectedChoice} (確信度: ${decision.confidence})`,
                type: 'decision',
                source: 'agent',
                metadata: {
                    choices: choices,
                    selectedChoice: decision.selectedChoice,
                    selectedIndex: decision.selectedIndex,
                    confidence: decision.confidence,
                    reasoning: decision.reasoning
                }
            });
            
            // Log successful tool call
            this._logToolCall('makeDecision', [JSON.stringify(options)], 'success');
            
            return decision;
        } catch (error) {
            // Log failed tool call
            this._logToolCall('makeDecision', [JSON.stringify(options)], 'error', error.message);
            throw error;
        }
    }

    /**
     * Generate creative content
     * @param {Object} options - Creative options
     * @returns {Promise<string>} - Generated content
     */
    async generateCreativeContent(options) {
        const { type, topic, style, length, additionalInstructions } = options;
        
        this._logToolCall('generateCreativeContent', [JSON.stringify(options)], 'executing');

        try {
            // Construct creative prompt
            const creativePrompt = `
${type}を作成してください:

トピック: ${topic}
スタイル: ${style || '標準的'}
長さ: ${length || '中程度'}
${additionalInstructions ? `追加指示:\n${additionalInstructions}` : ''}

このタスクはCygnos AIエージェントの創造的な生成ツールを使用して処理されています。出力は直接ユーザーに表示されます。
標準的な導入部や説明は省略し、リクエストされたコンテンツのみを提供してください。
`;
            
            // Call API with creative prompt
            const response = await apiService.sendRequest({
                prompt: creativePrompt,
                systemPrompt: `あなたは創造的コンテンツの生成に特化したCygnos AIエージェントです。ユーザーのリクエストに基づき、高品質な${type}を提供してください。`
            });
            
            // Add to memory
            await memorySystem.addMemoryItem({
                content: `${type}を生成: ${topic}`,
                type: 'creative_content',
                source: 'agent',
                metadata: {
                    contentType: type,
                    topic: topic,
                    style: style,
                    length: length
                }
            });
            
            // Log successful tool call
            this._logToolCall('generateCreativeContent', [JSON.stringify(options)], 'success');
            
            return response.text;
        } catch (error) {
            // Log failed tool call
            this._logToolCall('generateCreativeContent', [JSON.stringify(options)], 'error', error.message);
            throw error;
        }
    }

    /**
     * Get recommendations based on criteria
     * @param {Object} options - Recommendation options
     * @returns {Promise<Array>} - Recommendations
     */
    async getRecommendations(options) {
        const { category, criteria, limit, detailLevel } = options;
        
        this._logToolCall('getRecommendations', [JSON.stringify(options)], 'executing');

        try {
            // Construct recommendation prompt
            const recommendationPrompt = `
${category}に関する推奨事項を提供してください。

判断基準: ${criteria}
詳細レベル: ${detailLevel || '中程度'}

以下の形式でJSON回答を提供してください:
{
  "recommendations": [
    {
      "name": "推奨項目名",
      "description": "項目の説明",
      "rating": 0から10の評価,
      "rationale": "推奨理由"
    },
    ...
  ],
  "summary": "推奨事項の要約"
}

最大${limit || 5}項目の推奨事項を提供してください。
`;
            
            // Call API with recommendation prompt
            const response = await apiService.sendRequest({
                prompt: recommendationPrompt,
                systemPrompt: SYSTEM_PROMPTS.reasoning
            });
            
            // Parse recommendations
            let recommendations;
            try {
                recommendations = JSON.parse(response.text);
            } catch (parseError) {
                // If JSON parsing fails, extract JSON from the response
                const jsonMatch = response.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    recommendations = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('推奨事項の解析に失敗しました');
                }
            }
            
            // Add to memory
            await memorySystem.addMemoryItem({
                content: `${category}の推奨事項を生成`,
                type: 'recommendations',
                source: 'agent',
                metadata: {
                    category: category,
                    criteria: criteria,
                    count: recommendations.recommendations ? recommendations.recommendations.length : 0
                }
            });
            
            // Log successful tool call
            this._logToolCall('getRecommendations', [JSON.stringify(options)], 'success');
            
            return recommendations;
        } catch (error) {
            // Log failed tool call
            this._logToolCall('getRecommendations', [JSON.stringify(options)], 'error', error.message);
            throw error;
        }
    }

    /**
     * Simulate web search
     * @param {string} query - Search query
     * @returns {Promise<Object>} - Search results
     * @private
     */
    async _simulateWebSearch(query) {
        await this._simulateDelay(1500);
        
        return {
            query: query,
            totalResults: Math.floor(Math.random() * 1000000) + 1000,
            searchResultItems: [
                {
                    title: `${query}に関する情報 - Wikipedia`,
                    url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(query)}`,
                    snippet: `${query}は、多くの分野で重要な役割を果たしています。詳細な情報や歴史的背景については...`
                },
                {
                    title: `${query}の最新ニュース | NHKニュース`,
                    url: `https://www3.nhk.or.jp/news/special/${encodeURIComponent(query)}/`,
                    snippet: `${query}に関する最新のニュースや動向、専門家の分析をお届けします。`
                },
                {
                    title: `${query}とは？基本から応用まで解説 - 専門サイト`,
                    url: `https://example.com/guide/${encodeURIComponent(query)}`,
                    snippet: `${query}の基本概念から高度な応用まで、分かりやすく解説します。初心者から専門家まで...`
                }
            ],
            relatedQueries: [
                `${query} 歴史`,
                `${query} 使い方`,
                `${query} vs 類似概念`,
                `${query} 最新動向`
            ],
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Simulate code execution
     * @param {string} code - Code to execute
     * @param {string} language - Programming language
     * @returns {Object} - Execution results
     * @private
     */
    _simulateCodeExecution(code, language) {
        // This is a simulation and would not actually execute the code
        return {
            success: true,
            language: language,
            output: `${language.toUpperCase()}コードの実行結果をシミュレートしています。\n実際の出力はAPI統合によって提供されます。`,
            executionTime: `${Math.random() * 0.5 + 0.1}s`
        };
    }

    /**
     * Read file content
     * @param {File} file - File to read
     * @returns {Promise<string>} - File content
     * @private
     */
    async _readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            
            reader.onerror = (error) => {
                reject(new Error('ファイルの読み込みに失敗しました'));
            };
            
            if (file.type.startsWith('text/') || 
                file.type === 'application/json' || 
                file.name.endsWith('.md') || 
                file.name.endsWith('.csv')) {
                reader.readAsText(file);
            } else if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    /**
     * Analyze content based on type
     * @param {string} content - Content to analyze
     * @param {string} type - Content type
     * @returns {Promise<Object>} - Analysis results
     * @private
     */
    async _analyzeContent(content, type) {
        await this._simulateDelay(800);
        
        switch (type) {
            case 'text':
                return this._analyzeTextContent(content);
            case 'code':
                return this._analyzeCodeContent(content);
            case 'data':
                return this._analyzeDataContent(content);
            case 'image':
                return { message: '画像分析は実装されていません' };
            default:
                return { message: '未知のコンテンツタイプです' };
        }
    }

    /**
     * Analyze text content
     * @param {string} content - Text content
     * @returns {Object} - Analysis results
     * @private
     */
    _analyzeTextContent(content) {
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        const sentenceCount = content.split(/[.!?。！？]+/).filter(Boolean).length;
        const paragraphCount = content.split(/\n\s*\n/).filter(Boolean).length;
        
        // Simple keyword extraction (just for simulation)
        const words = content.toLowerCase().split(/\s+/).filter(Boolean);
        const wordFrequency = {};
        
        words.forEach(word => {
            if (word.length > 3) {
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            }
        });
        
        const keywords = Object.entries(wordFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
        
        return {
            type: 'text',
            wordCount,
            sentenceCount,
            paragraphCount,
            keywords,
            averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length,
            averageSentenceLength: wordCount / Math.max(sentenceCount, 1)
        };
    }

    /**
     * Analyze code content
     * @param {string} content - Code content
     * @returns {Object} - Analysis results
     * @private
     */
    _analyzeCodeContent(content) {
        const lineCount = content.split('\n').length;
        
        // Try to detect language (very simple)
        let language = 'unknown';
        
        if (content.includes('function') && (content.includes('{') || content.includes('=>'))) {
            language = 'javascript';
        } else if (content.includes('def ') && content.includes(':')) {
            language = 'python';
        } else if (content.includes('public class') || content.includes('private class')) {
            language = 'java';
        } else if (content.includes('#include')) {
            language = 'c/c++';
        }
        
        // Count functions (very basic)
        const functionMatches = content.match(/function\s+\w+|def\s+\w+|public\s+\w+\s+\w+\s*\(|private\s+\w+\s+\w+\s*\(/g) || [];
        
        return {
            type: 'code',
            language,
            lineCount,
            functionCount: functionMatches.length,
            commentLines: (content.match(/\/\/|#|\/\*|\*\/|"""/g) || []).length
        };
    }

    /**
     * Analyze data content
     * @param {string} content - Data content
     * @returns {Object} - Analysis results
     * @private
     */
    _analyzeDataContent(content) {
        let data;
        let format = 'unknown';
        
        // Try to parse as JSON
        try {
            data = JSON.parse(content);
            format = 'json';
            
            return {
                type: 'data',
                format,
                objectCount: Array.isArray(data) ? data.length : 1,
                structure: this._getDataStructure(data),
                sample: this._getTruncatedSample(data)
            };
        } catch (error) {
            // Not JSON, try CSV
            const lines = content.split('\n').filter(Boolean);
            
            if (lines.length > 0 && lines[0].includes(',')) {
                format = 'csv';
                const headers = lines[0].split(',').map(h => h.trim());
                const rowCount = lines.length - 1; // Excluding header
                
                return {
                    type: 'data',
                    format,
                    headers,
                    rowCount,
                    columnCount: headers.length,
                    sample: lines.slice(0, Math.min(5, lines.length)).join('\n')
                };
            }
            
            // Unknown format
            return {
                type: 'data',
                format,
                content: content.length > 200 ? content.substring(0, 200) + '...' : content
            };
        }
    }

    /**
     * Get data structure
     * @param {*} data - Data to analyze
     * @returns {Object} - Structure information
     * @private
     */
    _getDataStructure(data) {
        if (Array.isArray(data)) {
            return {
                type: 'array',
                length: data.length,
                itemType: data.length > 0 ? typeof data[0] : 'unknown'
            };
        } else if (typeof data === 'object' && data !== null) {
            return {
                type: 'object',
                keys: Object.keys(data),
                keyCount: Object.keys(data).length
            };
        } else {
            return {
                type: typeof data
            };
        }
    }

    /**
     * Get truncated data sample
     * @param {*} data - Data to sample
     * @returns {*} - Truncated data
     * @private
     */
    _getTruncatedSample(data) {
        if (Array.isArray(data)) {
            return data.slice(0, 3);
        } else if (typeof data === 'object' && data !== null) {
            const sample = {};
            const keys = Object.keys(data).slice(0, 5);
            
            keys.forEach(key => {
                sample[key] = data[key];
            });
            
            return sample;
        } else {
            return data;
        }
    }

    /**
     * Add item to cache
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     * @private
     */
    _addToCache(key, data) {
        // Check if cache is at maximum size
        if (this.webSearchCache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const oldestKey = this.webSearchCache.keys().next().value;
            this.webSearchCache.delete(oldestKey);
        }
        
        // Add new entry
        this.webSearchCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Log tool call
     * @param {string} tool - Tool name
     * @param {Array} params - Tool parameters
     * @param {string} status - Call status
     * @param {string} error - Error message (if any)
     * @private
     */
    _logToolCall(tool, params, status, error = null) {
        const toolCall = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2),
            tool,
            params,
            status,
            timestamp: new Date().toISOString()
        };
        
        if (error) {
            toolCall.error = error;
        }
        
        // Add to recent tool calls
        this.recentToolCalls.unshift(toolCall);
        
        // Keep only the last 20 calls
        if (this.recentToolCalls.length > 20) {
            this.recentToolCalls.pop();
        }
        
        // Add to tool call history
        this.toolCallHistory.push(toolCall);
        
        // Log to console
        if (CYGNOS_CONFIG.debug) {
            console.log(`Tool call: ${tool}`, toolCall);
        }
    }

    /**
     * Simulate a delay (for demo purposes)
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} - Promise that resolves after delay
     * @private
     */
    _simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get recent tool calls
     * @param {number} limit - Maximum number of calls to return
     * @returns {Array} - Recent tool calls
     */
    getRecentToolCalls(limit = 10) {
        return this.recentToolCalls.slice(0, limit);
    }

    /**
     * Clear web search cache
     */
    clearCache() {
        this.webSearchCache.clear();
    }
}

// Initialize Agent Tools
const agentTools = new AgentTools();
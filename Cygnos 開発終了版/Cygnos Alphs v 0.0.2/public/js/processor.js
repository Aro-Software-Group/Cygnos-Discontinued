/**
 * Cygnos Processor System
 * Handles task planning, reasoning, and execution
 */
class ProcessorSystem {
    constructor() {
        this.currentTask = null;
        this.steps = [];
        this.currentStepIndex = -1;
        this.isProcessing = false;
        this.processStepsElement = document.getElementById('process-steps');
        this.availableTools = this._initializeTools();
        this.reasoningChain = []; // Store reasoning steps
        this.executionMetrics = {
            startTime: null,
            totalTime: 0,
            stepTimes: [],
            successRate: 0,
            autonomousDecisions: 0
        };
    }

    /**
     * Initialize tools available to the agent
     * @returns {Object} - Dictionary of available tools
     * @private
     */
    _initializeTools() {
        return {
            search_web: {
                name: "search_web",
                description: "Search the web for information on a topic",
                parameters: ["query"],
                execute: async (query) => {
                    // Simple simulation of web search
                    await this._simulateDelay(1000);
                    return `Simulated search results for: ${query}`;
                }
            },
            calculate: {
                name: "calculate",
                description: "Perform a mathematical calculation",
                parameters: ["expression"],
                execute: async (expression) => {
                    try {
                        // Use Function to safely evaluate math expressions
                        // Note: This is still not completely safe for production
                        const result = Function('"use strict";return (' + expression + ')')();
                        return `計算結果: ${result}`;
                    } catch (error) {
                        return `計算エラー: ${error.message}`;
                    }
                }
            },
            get_current_time: {
                name: "get_current_time",
                description: "Get the current date and time",
                parameters: [],
                execute: async () => {
                    const now = new Date();
                    return `現在の日時: ${now.toLocaleString()}`;
                }
            },
            get_agent_status: {
                name: "get_agent_status",
                description: "Get the current status of the agent",
                parameters: [],
                execute: async () => {
                    return {
                        currentTask: this.currentTask ? this.currentTask.description : null,
                        stepCount: this.steps.length,
                        currentStep: this.currentStepIndex,
                        isProcessing: this.isProcessing,
                        memoryCount: memorySystem.memoryItems.length
                    };
                }
            },
            save_to_memory: {
                name: "save_to_memory",
                description: "Save information to agent's memory",
                parameters: ["content", "type", "metadata"],
                execute: async (content, type = "text", metadata = {}) => {
                    const item = await memorySystem.addMemoryItem({
                        content,
                        type,
                        source: 'agent',
                        metadata
                    });
                    return `情報をメモリに保存しました: ${item.id}`;
                }
            }
        };
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
     * Initialize a new task
     * @param {string} taskDescription - Description of the task
     * @returns {Object} - Task object
     */
    initTask(taskDescription) {
        this.currentTask = {
            id: this._generateId(),
            description: taskDescription,
            status: 'planning',
            startTime: new Date().toISOString(),
            endTime: null,
            result: null
        };
        
        this.steps = [];
        this.currentStepIndex = -1;
        this.reasoningChain = [];
        this.executionMetrics = {
            startTime: new Date(),
            totalTime: 0,
            stepTimes: [],
            successRate: 0,
            autonomousDecisions: 0
        };
        this._renderProcessingSteps();
        
        return this.currentTask;
    }

    /**
     * Generate a plan for the current task
     * @param {string} userInput - User input
     * @returns {Promise<Array>} - Array of steps
     */
    async generatePlan(userInput) {
        if (!this.currentTask) {
            this.initTask(userInput);
        }
        
        this.isProcessing = true;
        this._updateTaskStatus('planning');
        
        try {
            // Add planning step
            const planningStep = {
                id: this._generateId(),
                title: 'タスクの計画',
                description: 'タスクを分析して実行計画を生成しています',
                status: 'running',
                startTime: new Date().toISOString(),
                endTime: null,
                result: null
            };
            
            this.steps.push(planningStep);
            this.currentStepIndex = 0;
            this._renderProcessingSteps();
            
            // Add reasoning step before planning
            await this._performReasoning(userInput, "task_analysis");
            
            // Get context from memory
            const recentMessages = memorySystem.getMessagesForContext();
            const relevantMemory = memorySystem.getRelevantMemory(userInput, 5); // Increased from 3 to 5
            
            // Prepare planning prompt
            const planningPrompt = this._createPlanningPrompt(userInput, recentMessages, relevantMemory);
            
            // Call API with planning prompt
            const response = await apiService.sendRequest({
                prompt: planningPrompt,
                systemPrompt: SYSTEM_PROMPTS.planning
            });
            
            // Parse steps from response
            const plan = this._parsePlanFromResponse(response.text);
            
            // Update planning step status
            planningStep.status = 'completed';
            planningStep.endTime = new Date().toISOString();
            planningStep.result = `${plan.length} ステップの計画を生成しました`;
            
            // Add steps from plan
            plan.forEach(stepInfo => {
                this.steps.push({
                    id: this._generateId(),
                    title: stepInfo.title,
                    description: stepInfo.description,
                    status: 'waiting',
                    startTime: null,
                    endTime: null,
                    result: null,
                    requires_confirmation: stepInfo.requires_confirmation || false,
                    tools: stepInfo.tools || [], // Tools that might be useful for this step
                    criticalStep: stepInfo.criticalStep || false // Mark if this is a critical step
                });
            });
            
            // Add self-reflection step at the end
            this.steps.push({
                id: this._generateId(),
                title: '自己評価と改善',
                description: 'タスク実行の結果を評価し、学びを記録します',
                status: 'waiting',
                startTime: null,
                endTime: null,
                result: null,
                requires_confirmation: false
            });
            
            this._renderProcessingSteps();
            this._updateTaskStatus('ready');
            
            return this.steps;
        } catch (error) {
            console.error('計画生成エラー:', error);
            
            if (this.steps.length > 0) {
                this.steps[0].status = 'error';
                this.steps[0].endTime = new Date().toISOString();
                this.steps[0].result = `エラー: ${error.message}`;
            }
            
            this._renderProcessingSteps();
            this._updateTaskStatus('error');
            
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Begin executing the plan
     * @param {boolean} autoExecute - Whether to automatically execute all steps
     * @returns {Promise<Object>} - Execution result
     */
    async executePlan(autoExecute = false) {
        if (!this.currentTask || this.steps.length <= 1) {
            throw new Error('実行可能な計画がありません');
        }
        
        this._updateTaskStatus('executing');
        
        // Skip planning step
        this.currentStepIndex = 1;
        
        try {
            await this._executeCurrentStep();
            
            // If autoExecute is true and autonomy level is high or medium, continue executing steps
            const autonomyLevel = settingsManager.getUserSetting('autonomyLevel');
            if (autoExecute && (autonomyLevel === 'high' || autonomyLevel === 'medium')) {
                return this._continueExecution();
            }
            
            return {
                status: 'paused',
                currentStep: this.currentStepIndex,
                totalSteps: this.steps.length - 1 // Exclude planning step
            };
        } catch (error) {
            console.error('計画実行エラー:', error);
            this._updateTaskStatus('error');
            
            // Try to recover with self-healing
            await this._attemptRecovery(error);
            
            throw error;
        }
    }

    /**
     * Attempt to recover from an error
     * @param {Error} error - The error that occurred
     * @returns {Promise<boolean>} - Success of recovery
     * @private
     */
    async _attemptRecovery(error) {
        // Add recovery attempt to reasoning chain
        this.reasoningChain.push({
            type: "error_recovery",
            description: `エラーから回復を試みています: ${error.message}`,
            timestamp: new Date().toISOString()
        });
        
        try {
            // Create recovery prompt
            const recoveryPrompt = `
エラーが発生しました: "${error.message}"

現在のタスク: ${this.currentTask.description}
現在のステップ: ${this.currentStepIndex > 0 ? this.steps[this.currentStepIndex].title : "なし"}
ステップの説明: ${this.currentStepIndex > 0 ? this.steps[this.currentStepIndex].description : "なし"}

このエラーから回復し、タスクを続行するための方法を考えてください。以下の形式でJSON回答を提供してください:
{
  "recoveryPossible": true/false,
  "recoveryAction": "実行すべきアクション",
  "modifiedStep": { // 現在のステップの修正バージョン（必要な場合）
    "title": "ステップのタイトル",
    "description": "詳細な説明"
  },
  "explanation": "なぜこの回復方法が適切か"
}
`;
            
            // Call API with recovery prompt
            const response = await apiService.sendRequest({
                prompt: recoveryPrompt,
                systemPrompt: SYSTEM_PROMPTS.reasoning
            });
            
            // Parse recovery plan
            let recoveryPlan;
            try {
                recoveryPlan = JSON.parse(response.text);
            } catch (parseError) {
                // If JSON parsing fails, extract JSON from the response
                const jsonMatch = response.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    recoveryPlan = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error("回復計画の解析に失敗しました");
                }
            }
            
            if (recoveryPlan.recoveryPossible) {
                // Add recovery information to memory
                await memorySystem.addMemoryItem({
                    content: `エラー回復: ${recoveryPlan.explanation}`,
                    type: 'error_recovery',
                    source: 'agent',
                    metadata: {
                        error: error.message,
                        recovery_action: recoveryPlan.recoveryAction
                    }
                });
                
                // If step modification is provided, update the current step
                if (recoveryPlan.modifiedStep && this.currentStepIndex > 0) {
                    const currentStep = this.steps[this.currentStepIndex];
                    currentStep.title = recoveryPlan.modifiedStep.title || currentStep.title;
                    currentStep.description = recoveryPlan.modifiedStep.description || currentStep.description;
                    currentStep.status = 'waiting'; // Reset status to try again
                    currentStep.result = null;
                    this._renderProcessingSteps();
                }
                
                return true;
            }
            
            return false;
        } catch (recoveryError) {
            console.error('エラー回復の試みに失敗:', recoveryError);
            return false;
        }
    }

    /**
     * Continue plan execution
     * @returns {Promise<Object>} - Execution result
     */
    async _continueExecution() {
        const autonomyLevel = settingsManager.getUserSetting('autonomyLevel');
        
        while (this.currentStepIndex < this.steps.length - 1) {
            this.currentStepIndex++;
            const currentStep = this.steps[this.currentStepIndex];
            
            // Check if step requires confirmation based on autonomy level
            const requiresConfirmation = currentStep.requires_confirmation || currentStep.criticalStep;
            
            if (requiresConfirmation) {
                if (autonomyLevel === 'high') {
                    // High autonomy: Make a decision and continue
                    await this._makeAutonomousDecision(currentStep);
                    this.executionMetrics.autonomousDecisions++;
                } else if (autonomyLevel === 'medium' && !currentStep.criticalStep) {
                    // Medium autonomy: Continue for non-critical steps that need confirmation
                    await this._makeAutonomousDecision(currentStep);
                    this.executionMetrics.autonomousDecisions++;
                } else {
                    // Low autonomy or critical step with medium autonomy: Pause and wait for user
                    return {
                        status: 'paused',
                        currentStep: this.currentStepIndex,
                        totalSteps: this.steps.length - 1,
                        requiresConfirmation: true,
                        reason: currentStep.criticalStep ? 'critical_step' : 'confirmation_required'
                    };
                }
            }
            
            await this._executeCurrentStep();
        }
        
        // Calculate execution metrics
        this.executionMetrics.totalTime = (new Date() - this.executionMetrics.startTime) / 1000; // in seconds
        const successfulSteps = this.steps.filter(step => step.status === 'completed').length;
        this.executionMetrics.successRate = successfulSteps / (this.steps.length - 1); // Exclude planning step
        
        this._updateTaskStatus('completed');
        this.currentTask.endTime = new Date().toISOString();
        
        // Perform self-reflection at the end
        await this._performSelfReflection();
        
        return {
            status: 'completed',
            currentStep: this.currentStepIndex,
            totalSteps: this.steps.length - 1,
            metrics: this.executionMetrics
        };
    }

    /**
     * Make an autonomous decision about a step that requires confirmation
     * @param {Object} step - The step requiring a decision
     * @returns {Promise<void>}
     * @private
     */
    async _makeAutonomousDecision(step) {
        // Add decision to reasoning chain
        this.reasoningChain.push({
            type: "autonomous_decision",
            description: `ステップ「${step.title}」について自律的な決定を行います`,
            timestamp: new Date().toISOString()
        });
        
        // Create decision prompt
        const decisionPrompt = `
ユーザーの確認が必要な以下のステップについて、自律的に判断してください:

ステップ: ${step.title}
説明: ${step.description}

このステップを実行することの利点とリスクを分析し、以下の形式でJSON回答を提供してください:
{
  "benefits": ["利点1", "利点2", ...],
  "risks": ["リスク1", "リスク2", ...],
  "decision": "proceed" または "skip",
  "confidence": 0から1の間の値,
  "reasoning": "判断理由の説明"
}
`;
        
        // Call API with decision prompt
        const response = await apiService.sendRequest({
            prompt: decisionPrompt,
            systemPrompt: SYSTEM_PROMPTS.reasoning
        });
        
        // Parse decision
        let decision;
        try {
            decision = JSON.parse(response.text);
        } catch (parseError) {
            // If JSON parsing fails, extract JSON from the response
            const jsonMatch = response.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                decision = JSON.parse(jsonMatch[0]);
            } else {
                // Default to safe option if parsing fails
                decision = {
                    decision: "skip",
                    confidence: 0.3,
                    reasoning: "判断情報の解析に失敗したため、安全のためにスキップします"
                };
            }
        }
        
        // Add decision to memory
        await memorySystem.addMemoryItem({
            content: `自律判断: ${decision.reasoning}`,
            type: 'autonomous_decision',
            source: 'agent',
            metadata: {
                step: step.title,
                decision: decision.decision,
                confidence: decision.confidence
            }
        });
        
        // If decision is to skip, mark step as skipped and add explanation
        if (decision.decision === "skip") {
            step.status = 'skipped';
            step.result = `自律判断によりスキップ: ${decision.reasoning}`;
            this._renderProcessingSteps();
        }
        
        // Otherwise, continue with execution (decision is "proceed")
    }

    /**
     * Perform reasoning about a topic
     * @param {string} topic - The topic to reason about
     * @param {string} reasoningType - Type of reasoning to perform
     * @returns {Promise<Object>} - Reasoning results
     * @private
     */
    async _performReasoning(topic, reasoningType) {
        const startTime = new Date();
        
        // Create reasoning prompt
        let reasoningPrompt;
        switch (reasoningType) {
            case "task_analysis":
                reasoningPrompt = `
以下のタスクについて分析してください:
"${topic}"

このタスクを理解するために、以下の質問を検討してください:
1. このタスクの本質的な目的は何ですか？
2. このタスクを成功させるために必要な情報や知識は何ですか？
3. このタスクを実行する際に考えられる潜在的な課題や制約は何ですか？
4. このタスクはどのように分解できますか？
5. このタスクには倫理的または安全上の考慮事項がありますか？

以下の形式でJSON回答を提供してください:
{
  "purpose": "タスクの本質的な目的",
  "requiredKnowledge": ["知識1", "知識2", ...],
  "potentialChallenges": ["課題1", "課題2", ...],
  "decomposition": ["サブタスク1", "サブタスク2", ...],
  "considerations": ["考慮事項1", "考慮事項2", ...],
  "conclusion": "タスク分析の全体的な結論"
}
`;
                break;
            case "problem_solving":
                reasoningPrompt = `
以下の問題について、可能な解決策を探ってください:
"${topic}"

この問題を解決するために、以下のフレームワークを使用してください:
1. 問題の定義: 問題の正確な性質は何ですか？
2. 情報収集: この問題を理解するために必要な情報は何ですか？
3. 解決策の生成: 考えられる解決策はどのようなものですか？
4. 解決策の評価: 各解決策の長所と短所は何ですか？
5. 最適解の選択: どの解決策が最も適切ですか？

以下の形式でJSON回答を提供してください:
{
  "problemDefinition": "問題の明確な定義",
  "requiredInformation": ["情報1", "情報2", ...],
  "possibleSolutions": ["解決策1", "解決策2", ...],
  "evaluationOfSolutions": [
    {"solution": "解決策1", "pros": ["長所1", ...], "cons": ["短所1", ...]},
    ...
  ],
  "optimalSolution": "最適な解決策",
  "rationale": "選択の根拠"
}
`;
                break;
            default:
                reasoningPrompt = `
以下のトピックについて検討してください:
"${topic}"

このトピックに関する思考を、段階的に整理してください。以下の点を考慮してください:
1. このトピックについて知っている重要な事実は何ですか？
2. このトピックに関連する主要な概念や原則は何ですか？
3. どのような仮説を立てることができますか？
4. どのような結論を導き出せますか？

以下の形式でJSON回答を提供してください:
{
  "facts": ["事実1", "事実2", ...],
  "concepts": ["概念1", "概念2", ...],
  "hypotheses": ["仮説1", "仮説2", ...],
  "conclusions": ["結論1", "結論2", ...],
  "summary": "思考プロセスの要約"
}
`;
        }
        
        // Call API with reasoning prompt
        const response = await apiService.sendRequest({
            prompt: reasoningPrompt,
            systemPrompt: SYSTEM_PROMPTS.reasoning
        });
        
        // Parse reasoning result
        let reasoning;
        try {
            reasoning = JSON.parse(response.text);
        } catch (parseError) {
            // If JSON parsing fails, extract JSON from the response
            const jsonMatch = response.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                reasoning = JSON.parse(jsonMatch[0]);
            } else {
                console.error('推論結果の解析エラー:', parseError);
                reasoning = {
                    summary: "推論結果の構造化に失敗しました。テキスト形式で継続します。",
                    text: response.text
                };
            }
        }
        
        const endTime = new Date();
        const duration = (endTime - startTime) / 1000; // in seconds
        
        // Add reasoning to chain
        this.reasoningChain.push({
            type: reasoningType,
            topic: topic,
            result: reasoning,
            duration: duration,
            timestamp: endTime.toISOString()
        });
        
        // Store important insights in memory
        if (reasoning.conclusion || reasoning.summary) {
            await memorySystem.addMemoryItem({
                content: reasoning.conclusion || reasoning.summary,
                type: 'reasoning',
                source: 'agent',
                metadata: {
                    reasoning_type: reasoningType,
                    topic: topic
                }
            });
        }
        
        return reasoning;
    }

    /**
     * Perform self-reflection after task completion
     * @returns {Promise<void>}
     * @private
     */
    async _performSelfReflection() {
        // Find the self-reflection step
        const reflectionStep = this.steps.find(step => step.title === '自己評価と改善');
        if (!reflectionStep) return;
        
        reflectionStep.status = 'running';
        reflectionStep.startTime = new Date().toISOString();
        this._renderProcessingSteps();
        
        // Calculate metrics for the reflection
        const successfulSteps = this.steps.filter(step => step.status === 'completed').length;
        const failedSteps = this.steps.filter(step => step.status === 'error').length;
        const skippedSteps = this.steps.filter(step => step.status === 'skipped').length;
        const totalSteps = this.steps.length - 1; // Exclude planning step
        
        const taskResults = this.steps
            .filter(step => step.status === 'completed' && step.result)
            .map(step => step.result)
            .join("\n\n");
        
        // Create reflection prompt
        const reflectionPrompt = `
タスク "${this.currentTask.description}" の実行が完了しました。以下の情報を基に、自己評価と改善点を分析してください:

実行結果:
${taskResults}

実行統計:
- 合計ステップ数: ${totalSteps}
- 成功したステップ: ${successfulSteps}
- 失敗したステップ: ${failedSteps}
- スキップされたステップ: ${skippedSteps}
- 成功率: ${Math.round((successfulSteps / totalSteps) * 100)}%
- 総実行時間: ${this.executionMetrics.totalTime.toFixed(2)}秒
- 自律的決定回数: ${this.executionMetrics.autonomousDecisions}

以下の形式でJSON回答を提供してください:
{
  "strengths": ["強み1", "強み2", ...],
  "weaknesses": ["弱み1", "弱み2", ...],
  "lessonsLearned": ["学び1", "学び2", ...],
  "improvementIdeas": ["改善案1", "改善案2", ...],
  "overallAssessment": "全体的な評価",
  "score": 1から10の評価スコア
}
`;
        
        // Call API with reflection prompt
        const response = await apiService.sendRequest({
            prompt: reflectionPrompt,
            systemPrompt: SYSTEM_PROMPTS.reasoning
        });
        
        // Parse reflection result
        let reflection;
        try {
            reflection = JSON.parse(response.text);
        } catch (parseError) {
            // If JSON parsing fails, extract JSON from the response
            const jsonMatch = response.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                reflection = JSON.parse(jsonMatch[0]);
            } else {
                reflection = {
                    overallAssessment: response.text,
                    score: 5
                };
            }
        }
        
        // Update reflection step
        reflectionStep.status = 'completed';
        reflectionStep.endTime = new Date().toISOString();
        reflectionStep.result = reflection.overallAssessment;
        this._renderProcessingSteps();
        
        // Store reflection in memory
        await memorySystem.addMemoryItem({
            content: `タスク評価: ${reflection.overallAssessment}`,
            type: 'self_reflection',
            source: 'agent',
            metadata: {
                task_id: this.currentTask.id,
                score: reflection.score,
                strengths: reflection.strengths,
                weaknesses: reflection.weaknesses
            }
        });
    }

    /**
     * Execute next step in plan
     * @returns {Promise<Object>} - Step execution result
     */
    async executeNextStep() {
        if (!this.currentTask || this.currentStepIndex >= this.steps.length - 1) {
            throw new Error('実行可能な次のステップがありません');
        }
        
        this.currentStepIndex++;
        
        try {
            const result = await this._executeCurrentStep();
            
            // If this was the last step, mark task as completed
            if (this.currentStepIndex === this.steps.length - 1) {
                this._updateTaskStatus('completed');
                this.currentTask.endTime = new Date().toISOString();
                this.executionMetrics.totalTime = (new Date() - this.executionMetrics.startTime) / 1000;
                
                // Perform self-reflection
                await this._performSelfReflection();
            }
            
            return result;
        } catch (error) {
            console.error('ステップ実行エラー:', error);
            
            const currentStep = this.steps[this.currentStepIndex];
            currentStep.status = 'error';
            currentStep.endTime = new Date().toISOString();
            currentStep.result = `エラー: ${error.message}`;
            
            this._renderProcessingSteps();
            
            // Try to recover from error
            await this._attemptRecovery(error);
            
            throw error;
        }
    }

    /**
     * Execute current step
     * @returns {Promise<Object>} - Step execution result
     */
    async _executeCurrentStep() {
        const currentStep = this.steps[this.currentStepIndex];
        const stepStartTime = new Date();
        
        currentStep.status = 'running';
        currentStep.startTime = stepStartTime.toISOString();
        this._renderProcessingSteps();
        
        try {
            // Get context from memory
            const recentMessages = memorySystem.getMessagesForContext(5);
            const relevantMemory = memorySystem.getRelevantMemory(currentStep.description, 3);
            
            // Get available tools for this step
            const availableTools = this._getToolsForStep(currentStep);
            
            // Prepare execution prompt
            const executionPrompt = this._createExecutionPrompt(currentStep, recentMessages, relevantMemory, availableTools);
            
            // Call API with execution prompt
            const response = await apiService.sendRequest({
                prompt: executionPrompt,
                systemPrompt: SYSTEM_PROMPTS.execution
            });
            
            // Process execution response and extract tool calls
            const { result, toolCalls } = this._processExecutionResponse(response.text);
            
            // Execute any tool calls
            let toolResults = '';
            if (toolCalls && toolCalls.length > 0) {
                toolResults = await this._executeToolCalls(toolCalls);
            }
            
            // Combine results
            const finalResult = result + (toolResults ? `\n\n**ツール実行結果:**\n${toolResults}` : '');
            
            // Update step status
            currentStep.status = 'completed';
            currentStep.endTime = new Date().toISOString();
            currentStep.result = finalResult;
            
            // Add to memory if meaningful
            if (finalResult && finalResult.length > 10) {
                memorySystem.addMemoryItem({
                    content: finalResult,
                    type: 'step_result',
                    source: 'agent',
                    metadata: {
                        step_title: currentStep.title,
                        task_id: this.currentTask.id
                    }
                });
            }
            
            // Record step execution time
            const stepEndTime = new Date();
            const stepTime = (stepEndTime - stepStartTime) / 1000; // in seconds
            this.executionMetrics.stepTimes.push({
                stepIndex: this.currentStepIndex,
                title: currentStep.title,
                executionTime: stepTime
            });
            
            this._renderProcessingSteps();
            
            return {
                stepId: currentStep.id,
                status: 'completed',
                result: finalResult
            };
        } catch (error) {
            currentStep.status = 'error';
            currentStep.endTime = new Date().toISOString();
            currentStep.result = `エラー: ${error.message}`;
            
            this._renderProcessingSteps();
            
            throw error;
        }
    }

    /**
     * Get available tools for a step
     * @param {Object} step - The current step
     * @returns {Array} - Array of available tools
     * @private
     */
    _getToolsForStep(step) {
        // If step has specific tools defined, use those
        if (step.tools && step.tools.length > 0) {
            return step.tools.map(toolName => this.availableTools[toolName]).filter(tool => tool);
        }
        
        // Otherwise, return all available tools
        return Object.values(this.availableTools);
    }

    /**
     * Execute tool calls extracted from response
     * @param {Array} toolCalls - Array of tool calls
     * @returns {Promise<string>} - Tool execution results
     */
    async _executeToolCalls(toolCalls) {
        const results = [];
        
        for (const call of toolCalls) {
            try {
                // Find the tool
                const tool = this.availableTools[call.name];
                if (!tool) {
                    results.push(`ツール "${call.name}" は利用できません`);
                    continue;
                }
                
                // Execute the tool
                const result = await tool.execute(...call.parameters);
                results.push(`ツール "${call.name}": ${typeof result === 'object' ? JSON.stringify(result) : result}`);
                
                // Add tool usage to memory
                await memorySystem.addMemoryItem({
                    content: `ツール "${call.name}" を使用: ${call.parameters.join(', ')}`,
                    type: 'tool_usage',
                    source: 'agent',
                    metadata: {
                        tool: call.name,
                        parameters: call.parameters,
                        success: true
                    }
                });
            } catch (error) {
                results.push(`ツール "${call.name}" の実行エラー: ${error.message}`);
                
                // Add failed tool usage to memory
                await memorySystem.addMemoryItem({
                    content: `ツール "${call.name}" の実行に失敗: ${error.message}`,
                    type: 'tool_usage',
                    source: 'agent',
                    metadata: {
                        tool: call.name,
                        parameters: call.parameters,
                        success: false,
                        error: error.message
                    }
                });
            }
        }
        
        return results.join('\n');
    }

    /**
     * Create planning prompt
     * @param {string} userInput - User input
     * @param {Array} recentMessages - Recent messages
     * @param {Array} relevantMemory - Relevant memory items
     * @returns {string} - Planning prompt
     */
    _createPlanningPrompt(userInput, recentMessages, relevantMemory) {
        let prompt = `ユーザーからの指示: ${userInput}\n\n`;
        
        // Add context from recent conversation
        if (recentMessages.length > 0) {
            prompt += "最近の会話:\n";
            recentMessages.forEach(msg => {
                prompt += `${msg.role === 'user' ? 'ユーザー' : 'AI'}: ${msg.content}\n`;
            });
            prompt += "\n";
        }
        
        // Add relevant memory items
        if (relevantMemory.length > 0) {
            prompt += "関連する記憶:\n";
            relevantMemory.forEach(item => {
                prompt += `- ${item.content}\n`;
            });
            prompt += "\n";
        }
        
        // Add reasoning chain if available
        if (this.reasoningChain.length > 0) {
            const taskAnalysis = this.reasoningChain.find(r => r.type === 'task_analysis');
            if (taskAnalysis && taskAnalysis.result) {
                prompt += "タスク分析:\n";
                if (taskAnalysis.result.purpose) {
                    prompt += `目的: ${taskAnalysis.result.purpose}\n`;
                }
                if (taskAnalysis.result.decomposition) {
                    prompt += "分解:\n";
                    taskAnalysis.result.decomposition.forEach((item, index) => {
                        prompt += `${index + 1}. ${item}\n`;
                    });
                }
                prompt += "\n";
            }
        }
        
        // Add available tools
        prompt += "利用可能なツール:\n";
        Object.values(this.availableTools).forEach(tool => {
            prompt += `- ${tool.name}: ${tool.description}\n`;
        });
        prompt += "\n";
        
        // Add planning instructions
        prompt += `
あなたはCygnos AIエージェントです。上記の指示を実行するための詳細な計画を立ててください。
各ステップは次の形式で、JSON形式で提供してください:
[
  {
    "title": "ステップのタイトル",
    "description": "詳細な説明",
    "requires_confirmation": true/false,
    "tools": ["tool1", "tool2"], // このステップで使用可能なツール（オプション）
    "criticalStep": true/false // 重要なステップか（デフォルトはfalse）
  },
  ...
]
以下のことを考慮してください:
1. ステップは論理的な順序で並べてください
2. 各ステップは具体的かつ実行可能であるべきです
3. 重要な決定や潜在的なリスクを伴うステップには requires_confirmation を true に設定してください
4. 重大な影響を持つステップには criticalStep を true に設定してください
5. 各ステップに適切なツールを指定してください（該当する場合）
6. 計画は実行可能で、与えられたタスクを完全に解決するものであるべきです
7. 計画は具体的な行動ステップを含み、情報収集と実行の両方をカバーするべきです
JSON形式のみで回答してください。追加の説明は不要です。
`;
        
        return prompt;
    }

    /**
     * Create execution prompt
     * @param {Object} step - Step to execute
     * @param {Array} recentMessages - Recent messages
     * @param {Array} relevantMemory - Relevant memory items
     * @param {Array} availableTools - Available tools for this step
     * @returns {string} - Execution prompt
     */
    _createExecutionPrompt(step, recentMessages, relevantMemory, availableTools) {
        let prompt = `現在実行中のステップ: ${step.title}\n`;
        prompt += `ステップの説明: ${step.description}\n\n`;
        
        // Add context from recent conversation
        if (recentMessages.length > 0) {
            prompt += "関連する会話コンテキスト:\n";
            recentMessages.forEach(msg => {
                prompt += `${msg.role === 'user' ? 'ユーザー' : 'AI'}: ${msg.content}\n`;
            });
            prompt += "\n";
        }
        
        // Add relevant memory items
        if (relevantMemory.length > 0) {
            prompt += "関連する記憶:\n";
            relevantMemory.forEach(item => {
                prompt += `- ${item.content}\n`;
            });
            prompt += "\n";
        }
        
        // Add available tools if any
        if (availableTools && availableTools.length > 0) {
            prompt += "利用可能なツール:\n";
            availableTools.forEach(tool => {
                prompt += `- ${tool.name}: ${tool.description}\n`;
                if (tool.parameters && tool.parameters.length > 0) {
                    prompt += `  パラメータ: ${tool.parameters.join(', ')}\n`;
                }
            });
            prompt += "\nツールを使用するには、以下の形式で応答内に含めてください:\n";
            prompt += "[[ツール: ツール名, パラメータ: パラメータ1, パラメータ2, ...]]\n\n";
        }
        
        // Add execution instructions
        prompt += `
あなたはCygnos AIエージェントです。上記のステップを実行し、その結果を提供してください。
あなたの応答は、このステップの実行結果として直接ユーザーに表示されます。
以下のことを考慮してください:
1. このステップの範囲内でのみ実行してください。将来のステップについて言及しないでください。
2. 明確で具体的な結果を提供してください。
3. ステップの実行に必要な推論や思考プロセスを含めてください。
4. 結論や重要なポイントを強調してください。
5. 必要に応じて利用可能なツールを使用してください。
あなたの応答は、このステップの実行結果として直接ユーザーに表示されます。
`;
        
        return prompt;
    }

    /**
     * Parse plan from API response
     * @param {string} responseText - API response text
     * @returns {Array} - Parsed plan steps
     */
    _parsePlanFromResponse(responseText) {
        try {
            // Try to extract JSON from the response text
            const jsonMatch = responseText.match(/\[\s*\{.*\}\s*\]/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // If no JSON found, try to parse the entire response as JSON
            return JSON.parse(responseText);
        } catch (error) {
            console.error('計画の解析エラー:', error);
            
            // Fallback: extract steps from text format if JSON parsing fails
            const steps = [];
            const stepMatches = responseText.matchAll(/(?:ステップ|Step)\s*(\d+)\s*[:.]\s*([^\n]+)(?:\n|$)((?:.(?!\n(?:ステップ|Step)\s*\d+\s*[:.]))*)/gs);
            
            for (const match of stepMatches) {
                steps.push({
                    title: match[2].trim(),
                    description: match[3].trim(),
                    requires_confirmation: match[3].toLowerCase().includes('確認') || match[3].toLowerCase().includes('リスク')
                });
            }
            
            return steps.length > 0 ? steps : [
                {
                    title: '情報収集',
                    description: 'このタスクに必要な情報を収集します',
                    requires_confirmation: false
                },
                {
                    title: 'タスク実行',
                    description: 'タスクを実行し、結果を生成します',
                    requires_confirmation: false
                }
            ];
        }
    }

    /**
     * Process execution response and extract tool calls
     * @param {string} responseText - API response text
     * @returns {Object} - Processed result and tool calls
     */
    _processExecutionResponse(responseText) {
        // Extract tool calls if any
        const toolCallRegex = /\[\[ツール: ([^,\]]+),\s*パラメータ: ([^\]]*)\]\]/g;
        const toolCalls = [];
        let match;
        
        while ((match = toolCallRegex.exec(responseText)) !== null) {
            const toolName = match[1].trim();
            const paramsStr = match[2].trim();
            
            // Parse parameters
            const params = paramsStr.split(',').map(p => p.trim());
            
            toolCalls.push({
                name: toolName,
                parameters: params
            });
        }
        
        // Remove tool call syntax from the response
        let cleanedResponse = responseText.replace(toolCallRegex, '');
        
        // Clean up any double newlines created by removing tool calls
        cleanedResponse = cleanedResponse.replace(/\n{3,}/g, '\n\n').trim();
        
        return {
            result: cleanedResponse,
            toolCalls: toolCalls
        };
    }

    /**
     * Update task status
     * @param {string} status - New status
     */
    _updateTaskStatus(status) {
        if (this.currentTask) {
            this.currentTask.status = status;
        }
    }

    /**
     * Render processing steps in UI
     */
    _renderProcessingSteps() {
        if (!this.processStepsElement) {
            this.processStepsElement = document.getElementById('process-steps');
            if (!this.processStepsElement) return;
        }
        
        this.processStepsElement.innerHTML = '';
        
        this.steps.forEach((step, index) => {
            const stepEl = document.createElement('div');
            stepEl.className = 'process-step';
            stepEl.dataset.stepId = step.id;
            
            const stepHeader = document.createElement('div');
            stepHeader.className = 'step-header';
            
            const stepTitle = document.createElement('div');
            stepTitle.className = 'step-title';
            stepTitle.textContent = `${index}. ${step.title}`;
            
            const stepStatus = document.createElement('div');
            stepStatus.className = `step-status ${step.status}`;
            
            switch (step.status) {
                case 'waiting':
                    stepStatus.textContent = '待機中';
                    break;
                case 'running':
                    stepStatus.innerHTML = '<span class="loading-spinner"></span> 実行中';
                    break;
                case 'completed':
                    stepStatus.textContent = '完了';
                    break;
                case 'error':
                    stepStatus.textContent = 'エラー';
                    break;
                case 'skipped':
                    stepStatus.textContent = 'スキップ';
                    break;
            }
            
            stepHeader.appendChild(stepTitle);
            stepHeader.appendChild(stepStatus);
            
            const stepDetails = document.createElement('div');
            stepDetails.className = 'step-details';
            stepDetails.textContent = step.description;
            
            stepEl.appendChild(stepHeader);
            stepEl.appendChild(stepDetails);
            
            if (step.result) {
                const stepResult = document.createElement('div');
                stepResult.className = 'step-result';
                
                // Handle markdown formatting if necessary
                if (typeof marked === 'function') {
                    stepResult.innerHTML = marked(step.result);
                } else {
                    stepResult.textContent = step.result;
                }
                
                stepEl.appendChild(stepResult);
            }
            
            this.processStepsElement.appendChild(stepEl);
        });
        
        // Expand panel for visibility if steps are available
        if (this.steps.length > 0) {
            const panelContent = document.querySelector('.panel-content');
            if (panelContent && !panelContent.classList.contains('expanded')) {
                panelContent.classList.add('expanded');
            }
        }
    }

    /**
     * Generate a unique ID
     * @returns {string} - Unique ID
     */
    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}

// System prompts for different functions
const SYSTEM_PROMPTS = {
    planning: `あなたはCygnos AIエージェントで、ユーザーのタスクを実行するための計画を立案する役割を担っています。
タスクを達成するために必要なステップを特定し、論理的な順序で整理してください。
各ステップは具体的で、実行可能で、明確であるべきです。
重要な決定や潜在的なリスクを伴うステップには確認が必要であることを示してください。
自律的に実行できるステップと、ユーザーの入力や確認が必要なステップを区別してください。
計画はJSON形式で返してください。`,

    execution: `あなたはCygnos AIエージェントで、計画の個々のステップを実行する役割を担っています。
現在のステップに集中し、必要な推論や分析を行い、明確な結果を提供してください。
与えられたツールを適切に使用して、タスクを効率的に実行してください。
ツールを使用する場合は、[[ツール: ツール名, パラメータ: パラメータ1, パラメータ2, ...]] の形式で指定してください。
あなたの応答は、このステップの実行結果として直接ユーザーに表示されます。
簡潔かつ情報量豊富な回答を心がけてください。`,

    reasoning: `あなたはCygnos AIエージェントで、推論と問題解決に特化しています。
与えられた情報や状況を分析し、論理的な推論を行って結論を導き出してください。
推論のプロセスを段階的に示し、考慮した仮説や証拠を明示してください。
不確実性がある場合は、それを率直に認め、複数の可能性を検討してください。
問題を複数の視点から検討し、バイアスを避けた分析を提供してください。
要求された場合は、JSON形式で構造化された回答を提供してください。`
};

// Initialize Processor System
const processorSystem = new ProcessorSystem();

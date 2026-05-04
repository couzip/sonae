// 局所的な型定義: browser-use v0.6 は型不足。利用箇所のみカバー。
declare module 'browser-use' {
  export interface AgentHistory {
    structured_output?: unknown;
    final_result?: () => string | undefined;
    extracted_content?: () => unknown[];
    action_results?: () => Array<{
      extracted_content?: unknown;
      long_term_memory?: unknown;
    }>;
    model_actions?: () => unknown[];
    agent_steps?: () => unknown[];
    urls?: () => string[];
  }

  export interface AgentOptions {
    task: string;
    llm: unknown;
    browser_session?: unknown;
    output_model_schema?: unknown;
    use_vision?: boolean;
    use_thinking?: boolean;
    flash_mode?: boolean;
    use_judge?: boolean;
    enable_planning?: boolean;
    max_failures?: number;
    max_actions_per_step?: number;
  }

  export class Agent {
    constructor(options: AgentOptions);
    run(maxSteps: number): Promise<AgentHistory>;
  }
}

declare module 'browser-use/llm/openai' {
  export class ChatOpenAI {
    constructor(options: {
      model: string;
      baseURL: string;
      apiKey: string;
      temperature?: number;
      addSchemaToSystemPrompt?: boolean;
      dontForceStructuredOutput?: boolean;
      removeMinItemsFromSchema?: boolean;
      removeDefaultsFromSchema?: boolean;
      maxCompletionTokens?: number;
      timeout?: number;
    });
  }
}

declare module 'browser-use/browser' {
  export class BrowserProfile {
    constructor(options: { headless?: boolean });
  }
  export class BrowserSession {
    constructor(options: { browser_profile: BrowserProfile });
    kill?(): Promise<void>;
  }
}

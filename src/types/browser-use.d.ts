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
    /** カスタム Controller (action 制限など) */
    controller?: Controller | null;
    /** controller の別名 (browser-use の最近のリビジョン互換) */
    tools?: Controller | null;
    /** エージェント開始前にフレームワーク側で実行する固定アクション列 */
    initial_actions?: Array<Record<string, Record<string, unknown>>> | null;
    /**
     * browser-use 内部の URL 短縮機能の閾値 (デフォルト 25 文字)。これを超える
     * クエリ部を `...` + md5 prefix に置換するので、長い percent-encoded
     * クエリ (Japanese 含む) が壊れる。実質無効化するには非常に大きい値を指定。
     */
    _url_shortening_limit?: number;
    register_new_step_callback?: (
      state: unknown,
      output: unknown,
      step: number,
    ) => void | Promise<void>;
  }

  export class Agent {
    constructor(options: AgentOptions);
    run(maxSteps: number): Promise<AgentHistory>;
  }

  export class Controller {
    constructor(options?: {
      exclude_actions?: string[];
      output_model?: unknown;
      display_files_in_done_text?: boolean;
    });
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

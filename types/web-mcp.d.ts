/**
 * Type declarations for the WebMCP browser API (Chrome 146+).
 *
 * WebMCP allows web pages to register structured tools that in-browser
 * AI agents can discover and invoke via `navigator.modelContext`.
 *
 * @see https://chromestatus.com/feature/webmcp
 */

interface ModelContextToolContent {
  type: 'text';
  text: string;
}

interface ModelContextToolResult {
  content: ModelContextToolContent[];
}

interface ModelContextToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  annotations?: Record<string, string>;
  execute: (args: Record<string, unknown>) => ModelContextToolResult;
}

interface ModelContext {
  registerTool(tool: ModelContextToolDefinition): void;
  unregisterTool(name: string): void;
  provideContext(ctx: { tools: ModelContextToolDefinition[] }): void;
  clearContext(): void;
}

interface Navigator {
  modelContext?: ModelContext;
}

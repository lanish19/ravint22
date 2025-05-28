'use server';

import { z } from 'genkit';

// Tool audit event schemas
const ToolAuditEventSchema = z.object({
  eventId: z.string().describe('Unique identifier for this audit event'),
  timestamp: z.string().describe('ISO timestamp of the event'),
  agentName: z.string().describe('Name of the agent using the tool'),
  toolName: z.string().describe('Name of the tool being used'),
  eventType: z.enum(['before_tool', 'after_tool', 'tool_error']).describe('Type of audit event'),
  sessionId: z.string().optional().describe('Session ID if available'),
  toolInput: z.any().describe('Input provided to the tool'),
  toolOutput: z.any().optional().describe('Output from the tool (for after_tool events)'),
  error: z.string().optional().describe('Error message if tool failed'),
  duration: z.number().optional().describe('Tool execution duration in milliseconds'),
  metadata: z.record(z.any()).optional().describe('Additional metadata'),
});

const ToolCacheEntrySchema = z.object({
  cacheKey: z.string().describe('Cache key based on tool name and input hash'),
  toolName: z.string().describe('Name of the cached tool'),
  inputHash: z.string().describe('Hash of the tool input'),
  output: z.any().describe('Cached tool output'),
  timestamp: z.string().describe('When this was cached'),
  hitCount: z.number().describe('Number of times this cache entry was used'),
  agentName: z.string().describe('Agent that originally created this cache entry'),
});

type ToolAuditEvent = z.infer<typeof ToolAuditEventSchema>;
type ToolCacheEntry = z.infer<typeof ToolCacheEntrySchema>;

// Tool auditing and caching system
class ToolAuditSystem {
  private events: ToolAuditEvent[] = [];
  private cache: Map<string, ToolCacheEntry> = new Map();
  private sessionData: Map<string, any> = new Map();
  private maxCacheSize: number = 1000;
  private maxEventHistory: number = 10000;
  private enableCaching: boolean = true;
  private enableAuditing: boolean = true;

  constructor(options: {
    maxCacheSize?: number;
    maxEventHistory?: number;
    enableCaching?: boolean;
    enableAuditing?: boolean;
  } = {}) {
    this.maxCacheSize = options.maxCacheSize ?? 1000;
    this.maxEventHistory = options.maxEventHistory ?? 10000;
    this.enableCaching = options.enableCaching ?? true;
    this.enableAuditing = options.enableAuditing ?? true;
  }

  // Generate a hash for tool inputs to use as cache key
  private hashInput(input: any): string {
    try {
      const serialized = JSON.stringify(input, Object.keys(input).sort());
      let hash = 0;
      for (let i = 0; i < serialized.length; i++) {
        const char = serialized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(36);
    } catch (error) {
      return 'hash_error_' + Date.now();
    }
  }

  // Validate and sanitize tool inputs
  private validateToolInput(toolName: string, input: any): { isValid: boolean; sanitizedInput?: any; issues?: string[] } {
    const issues: string[] = [];
    let sanitizedInput = input;

    try {
      // Basic validation checks
      if (input === null || input === undefined) {
        issues.push('Tool input is null or undefined');
        return { isValid: false, issues };
      }

      // Check for potentially dangerous patterns
      if (typeof input === 'string') {
        // Check for potential injection patterns
        const dangerousPatterns = [
          /eval\(/i,
          /function\s*\(/i,
          /<script/i,
          /javascript:/i,
          /onload=/i,
          /onerror=/i,
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(input)) {
            issues.push(`Potentially dangerous pattern detected: ${pattern.source}`);
          }
        }

        // Sanitize if needed (basic example)
        sanitizedInput = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }

      // Tool-specific validation
      switch (toolName.toLowerCase()) {
        case 'googlesearch':
        case 'searchagent':
          if (typeof input === 'object' && input.query) {
            if (input.query.length > 1000) {
              issues.push('Search query too long (>1000 characters)');
              sanitizedInput = { ...input, query: input.query.substring(0, 1000) };
            }
          }
          break;
        
        case 'fileread':
        case 'filewrite':
          if (typeof input === 'object' && input.path) {
            // Check for path traversal attempts
            if (input.path.includes('..') || input.path.includes('~')) {
              issues.push('Potential path traversal detected');
            }
          }
          break;
      }

      return {
        isValid: issues.length === 0,
        sanitizedInput,
        issues: issues.length > 0 ? issues : undefined,
      };

    } catch (error) {
      return {
        isValid: false,
        issues: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  // Check if we have a cached result for this tool call
  private getCachedResult(toolName: string, input: any): ToolCacheEntry | null {
    if (!this.enableCaching) return null;

    const inputHash = this.hashInput(input);
    const cacheKey = `${toolName}:${inputHash}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      // Update hit count
      cached.hitCount++;
      return cached;
    }

    return null;
  }

  // Cache a tool result
  private cacheResult(toolName: string, input: any, output: any, agentName: string): void {
    if (!this.enableCaching) return;

    const inputHash = this.hashInput(input);
    const cacheKey = `${toolName}:${inputHash}`;

    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entries (simple LRU)
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => new Date(a[1].timestamp).getTime() - new Date(b[1].timestamp).getTime());
      const toRemove = entries.slice(0, Math.floor(this.maxCacheSize * 0.1));
      toRemove.forEach(([key]) => this.cache.delete(key));
    }

    const cacheEntry: ToolCacheEntry = {
      cacheKey,
      toolName,
      inputHash,
      output,
      timestamp: new Date().toISOString(),
      hitCount: 0,
      agentName,
    };

    this.cache.set(cacheKey, cacheEntry);
  }

  // Record an audit event
  private recordEvent(event: Omit<ToolAuditEvent, 'eventId' | 'timestamp'>): void {
    if (!this.enableAuditing) return;

    const auditEvent: ToolAuditEvent = {
      ...event,
      eventId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    this.events.push(auditEvent);

    // Limit event history size
    if (this.events.length > this.maxEventHistory) {
      this.events = this.events.slice(-this.maxEventHistory);
    }

    // Log important events
    if (event.eventType === 'tool_error') {
      console.error('ToolAuditSystem: Tool error recorded', {
        agentName: event.agentName,
        toolName: event.toolName,
        error: event.error,
      });
    }
  }

  // Before tool callback
  public beforeTool(agentName: string, toolName: string, input: any, sessionId?: string): {
    proceed: boolean;
    modifiedInput?: any;
    cachedResult?: any;
    issues?: string[];
  } {
    const startTime = Date.now();

    try {
      // Check for cached result first
      const cached = this.getCachedResult(toolName, input);
      if (cached) {
        console.log('ToolAuditSystem: Using cached result', {
          agentName,
          toolName,
          cacheKey: cached.cacheKey,
          hitCount: cached.hitCount,
        });

        this.recordEvent({
          agentName,
          toolName,
          eventType: 'before_tool',
          sessionId,
          toolInput: input,
          metadata: { cached: true, hitCount: cached.hitCount },
        });

        return {
          proceed: false, // Don't execute tool, use cache
          cachedResult: cached.output,
        };
      }

      // Validate and sanitize input
      const validation = this.validateToolInput(toolName, input);
      
      // Record the before_tool event
      this.recordEvent({
        agentName,
        toolName,
        eventType: 'before_tool',
        sessionId,
        toolInput: validation.sanitizedInput || input,
        metadata: {
          validationIssues: validation.issues,
          inputModified: validation.sanitizedInput !== input,
        },
      });

      // Log validation issues but don't block execution for minor issues
      if (validation.issues && validation.issues.length > 0) {
        console.warn('ToolAuditSystem: Input validation issues', {
          agentName,
          toolName,
          issues: validation.issues,
        });
      }

      return {
        proceed: validation.isValid,
        modifiedInput: validation.sanitizedInput,
        issues: validation.issues,
      };

    } catch (error: any) {
      console.error('ToolAuditSystem: Error in beforeTool callback', {
        agentName,
        toolName,
        error: error.message,
      });

      return {
        proceed: true, // Allow execution to proceed despite audit error
        issues: [`Audit system error: ${error.message}`],
      };
    }
  }

  // After tool callback
  public afterTool(
    agentName: string,
    toolName: string,
    input: any,
    output: any,
    error?: string,
    startTime?: number,
    sessionId?: string
  ): void {
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : undefined;

    try {
      // Cache successful results
      if (!error && output !== null && output !== undefined) {
        this.cacheResult(toolName, input, output, agentName);
      }

      // Record the after_tool event
      this.recordEvent({
        agentName,
        toolName,
        eventType: error ? 'tool_error' : 'after_tool',
        sessionId,
        toolInput: input,
        toolOutput: error ? undefined : output,
        error,
        duration,
        metadata: {
          outputSize: typeof output === 'string' ? output.length : 
                     typeof output === 'object' ? JSON.stringify(output).length : 
                     undefined,
        },
      });

      // Performance logging for slow tools
      if (duration && duration > 5000) { // 5 seconds
        console.warn('ToolAuditSystem: Slow tool execution detected', {
          agentName,
          toolName,
          duration,
        });
      }

    } catch (auditError: any) {
      console.error('ToolAuditSystem: Error in afterTool callback', {
        agentName,
        toolName,
        auditError: auditError.message,
      });
    }
  }

  // Get audit statistics
  public getAuditStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByAgent: Record<string, number>;
    eventsByTool: Record<string, number>;
    cacheStats: {
      totalEntries: number;
      totalHits: number;
      hitRate: string;
    };
    recentErrors: ToolAuditEvent[];
  } {
    const eventsByType: Record<string, number> = {};
    const eventsByAgent: Record<string, number> = {};
    const eventsByTool: Record<string, number> = {};
    
    this.events.forEach((event: ToolAuditEvent) => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsByAgent[event.agentName] = (eventsByAgent[event.agentName] || 0) + 1;
      eventsByTool[event.toolName] = (eventsByTool[event.toolName] || 0) + 1;
    });

    const totalHits = Array.from(this.cache.values()).reduce((sum: number, entry: ToolCacheEntry) => sum + entry.hitCount, 0);
    const totalRequests = this.events.filter(e => e.eventType === 'before_tool').length;
    const hitRate = totalRequests > 0 ? ((totalHits / totalRequests) * 100).toFixed(2) + '%' : '0%';

    const recentErrors = this.events
      .filter(e => e.eventType === 'tool_error')
      .slice(-10);

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsByAgent,
      eventsByTool,
      cacheStats: {
        totalEntries: this.cache.size,
        totalHits,
        hitRate,
      },
      recentErrors,
    };
  }

  // Clear cache
  public clearCache(): void {
    this.cache.clear();
    console.log('ToolAuditSystem: Cache cleared');
  }

  // Export audit data
  public exportAuditData(): {
    events: ToolAuditEvent[];
    cache: ToolCacheEntry[];
    stats: {
      totalEvents: number;
      eventsByType: Record<string, number>;
      eventsByAgent: Record<string, number>;
      eventsByTool: Record<string, number>;
      cacheStats: {
        totalEntries: number;
        totalHits: number;
        hitRate: string;
      };
      recentErrors: ToolAuditEvent[];
    };
  } {
    return {
      events: [...this.events],
      cache: Array.from(this.cache.values()),
      stats: this.getAuditStats(),
    };
  }

  // Performance insights
  generatePerformanceInsights(): {
    recommendations: string[];
    bottlenecks: string[];
    optimizationSuggestions: string[];
  } {
    const insights = {
      recommendations: [] as string[],
      bottlenecks: [] as string[],
      optimizationSuggestions: [] as string[],
    };

    // Cache hit rate analysis
    const cacheStats = this.getAuditStats().cacheStats;
    const cacheHitRate = typeof cacheStats.hitRate === 'number' ? cacheStats.hitRate : 0;
    if (cacheHitRate < 0.5) {
      insights.recommendations.push('Consider optimizing caching strategy - low cache hit rate detected');
    }

    // Performance bottlenecks
    const afterToolEvents = this.events.filter(e => e.eventType === 'after_tool' && e.duration);
    const totalDuration = afterToolEvents.reduce((sum, event) => sum + (event.duration || 0), 0);
    const averageExecutionTime = afterToolEvents.length > 0 ? totalDuration / afterToolEvents.length : 0;

    if (averageExecutionTime > 5000) {
      insights.bottlenecks.push('High average tool execution time detected');
      insights.optimizationSuggestions.push('Implement parallel tool execution where possible');
    }

    return insights;
  }
}

// Global instance
export const toolAuditSystem = new ToolAuditSystem({
  maxCacheSize: 1000,
  maxEventHistory: 10000,
  enableCaching: true,
  enableAuditing: true,
});

// Helper functions for easy integration with agents
export function createToolCallbacks(agentName: string) {
  return {
    beforeTool: (toolName: string, input: any, sessionId?: string) => {
      return toolAuditSystem.beforeTool(agentName, toolName, input, sessionId);
    },
    afterTool: (toolName: string, input: any, output: any, error?: string, startTime?: number, sessionId?: string) => {
      toolAuditSystem.afterTool(agentName, toolName, input, output, error, startTime, sessionId);
    },
  };
}

// Enhanced tool wrapper that automatically includes auditing
export function createAuditedTool<TInput = any, TOutput = any>(
  agentName: string,
  toolName: string,
  toolFunction: (input: TInput) => Promise<TOutput>,
  sessionId?: string
) {
  return async (input: TInput): Promise<TOutput> => {
    const startTime = Date.now();
    
    // Before tool execution
    const auditResult = toolAuditSystem.beforeTool(agentName, toolName, input, sessionId);
    
    // Use cached result if available
    if (!auditResult.proceed && auditResult.cachedResult !== undefined) {
      return auditResult.cachedResult;
    }

    // Use modified input if validation changed it
    const finalInput = auditResult.modifiedInput !== undefined ? auditResult.modifiedInput : input;

    try {
      // Execute the tool
      const output = await toolFunction(finalInput);
      
      // After tool execution (success)
      toolAuditSystem.afterTool(agentName, toolName, finalInput, output, undefined, startTime, sessionId);
      
      return output;
    } catch (error: any) {
      // After tool execution (error)
      toolAuditSystem.afterTool(agentName, toolName, finalInput, undefined, error.message, startTime, sessionId);
      throw error;
    }
  };
}

export type { ToolAuditEvent, ToolCacheEntry }; 
import { describe, it, expect, vi } from 'vitest';
import { CommandContext } from '../../../../src/context';

// Import all tool registration functions
import { registerMyMessagesTools } from '../../../../src/commands/mcp-tools/my-messages';
import { registerSearchTools } from '../../../../src/commands/mcp-tools/search';
import { registerStatusTools } from '../../../../src/commands/mcp-tools/status';
import { registerReminderTools } from '../../../../src/commands/mcp-tools/reminders';
import { registerThreadReplyTools } from '../../../../src/commands/mcp-tools/thread-replies';
import { registerUserActivityTools } from '../../../../src/commands/mcp-tools/user-activity';
import { registerSystemDatetimeTools } from '../../../../src/commands/mcp-tools/system-datetime';
import { registerUserSearchTool } from '../../../../src/commands/mcp-tools/user-search';
import { registerChannelSearchTool } from '../../../../src/commands/mcp-tools/channel-search';
import { registerUserProfileTool } from '../../../../src/commands/mcp-tools/user-profile';

describe('MCP Tool Descriptions', () => {
  it('should ensure all MCP tools have descriptions', () => {
    // Mock context
    const context = new CommandContext();
    
    // Create a mock server that tracks registered tools
    const registeredTools = new Map<string, any>();
    const mockServer: any = {
      tool: vi.fn((name, schema, _handler) => {
        registeredTools.set(name, { name, schema });
        return mockServer;
      }),
    };
    
    // Register all tools
    registerMyMessagesTools(mockServer, context);
    registerSearchTools(mockServer, context);
    registerStatusTools(mockServer, context);
    registerReminderTools(mockServer, context);
    registerThreadReplyTools(mockServer, context);
    registerUserActivityTools(mockServer, context);
    registerSystemDatetimeTools(mockServer);
    registerUserSearchTool(mockServer, context);
    registerChannelSearchTool(mockServer, context);
    registerUserProfileTool(mockServer, context);
    
    // Verify that there are tools registered
    expect(registeredTools.size).toBeGreaterThan(0);
    
    // Check each tool for a description
    registeredTools.forEach((toolData, toolName) => {
      const schema = toolData.schema;
      
      // Handle tools with no parameters
      if (Object.keys(schema).length === 0) {
        // Tools with no parameters should have a description property
        expect(schema).toHaveProperty('description');
      } else {
        // For tools with parameters, check if the tool has a global description
        // or if all parameters have descriptions
        const hasToolDescription = 'description' in schema;
        
        // If there's no tool-level description, each parameter should have a description
        if (!hasToolDescription) {
          const parameterKeys = Object.keys(schema).filter(key => key !== 'description');
          
          // Skip checking parameterKeys if there's a tool description
          // or if this is a special case (like an empty schema)
          if (parameterKeys.length > 0) {
            parameterKeys.forEach(paramKey => {
              const param = schema[paramKey];
              
              // Check if the parameter has a describe method that was called
              // This is checking for usage of .describe() on Zod types
              const hasDescription = param._def && 
                                    param._def.description !== undefined;
              
              expect(
                hasDescription, 
                `Tool "${toolName}" parameter "${paramKey}" should have a description`
              ).toBe(true);
            });
          }
        }
      }
    });
  });
});
import { describe, it, expect, vi } from 'vitest';
import { mcp_tools } from '../../../../src/commands/mcp-tools/tools-registry';

describe('MCP Tool Descriptions', () => {
  it('should ensure all MCP tools have descriptions', () => {
    // Create a mock server that tracks registered tools
    const registeredTools = new Map<string, any>();
    const mockServer: any = {
      addTool: vi.fn((toolDef) => {
        registeredTools.set(toolDef.name, {
          name: toolDef.name,
          schema: toolDef.parameters,
        });
        return mockServer;
      }),
    };

    // Register all tools directly from the registry
    for (const tool of mcp_tools) {
      mockServer.addTool(tool);
    }

    // Verify that there are tools registered
    expect(registeredTools.size).toBeGreaterThan(0);
    expect(registeredTools.size).toBe(mcp_tools.length);

    // Check each tool for a description
    registeredTools.forEach((toolData, toolName) => {
      const schema = toolData.schema;

      // First ensure every tool has a description property
      const tool = mcp_tools.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      expect(tool?.description).toBeTruthy();

      // For tools with parameters, check that the parameters have descriptions
      if (schema && typeof schema === 'object') {
        // Check if this is a Zod schema with shape property
        if (schema.shape && typeof schema.shape === 'object') {
          const parameterKeys = Object.keys(schema.shape);

          if (parameterKeys.length > 0) {
            parameterKeys.forEach((paramKey) => {
              const param = schema.shape[paramKey];

              // Check if the parameter has a description
              const hasDescription = param && param._def && param._def.description !== undefined;

              expect(
                hasDescription,
                `Tool "${toolName}" parameter "${paramKey}" should have a description`,
              ).toBe(true);
            });
          }
        }
      }
    });
  });
});

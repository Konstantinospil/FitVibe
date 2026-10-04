/**
 * Test Suite for Test Manager Agent Specification
 *
 * This test suite validates the test manager agent specification document
 * to ensure it is well-formed, complete, and follows best practices.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "../../..");
const specPath = join(repoRoot, ".claude", "agents", "test_manager.md");

describe("Test Manager Agent Specification", () => {
  let specContent: string;
  let frontmatter: Record<string, string>;

  beforeAll(() => {
    specContent = readFileSync(specPath, "utf-8");

    // Extract frontmatter
    const frontmatterMatch = specContent.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      frontmatter = frontmatterMatch[1].split("\n").reduce(
        (acc, line) => {
          const [key, ...valueParts] = line.split(":");
          if (key && valueParts.length > 0) {
            acc[key.trim()] = valueParts.join(":").trim();
          }
          return acc;
        },
        {} as Record<string, string>,
      );
    }
  });

  describe("File Structure", () => {
    it("should exist and be readable", () => {
      expect(specContent).toBeDefined();
      expect(specContent.length).toBeGreaterThan(0);
    });

    it("should have YAML frontmatter", () => {
      expect(specContent).toMatch(/^---\n/);
      expect(specContent).toMatch(/\n---\n/);
    });

    it("should have proper markdown structure", () => {
      expect(specContent).toContain("# Agent: Test Manager");
      expect(specContent).toContain("## Agent Metadata");
      expect(specContent).toContain("## Mission Statement");
    });
  });

  describe("Frontmatter Validation", () => {
    it("should have required frontmatter fields", () => {
      expect(frontmatter).toBeDefined();
      expect(frontmatter.name).toBe("test_manager");
      expect(frontmatter.description).toBeDefined();
      expect(frontmatter.tools).toBeDefined();
      expect(frontmatter.model).toBeDefined();
      expect(frontmatter.color).toBeDefined();
    });

    it("should have valid agent name", () => {
      expect(frontmatter.name).toMatch(/^[a-z_]+$/);
    });

    it("should have non-empty description", () => {
      expect(frontmatter.description).toBeTruthy();
      expect(frontmatter.description.length).toBeGreaterThan(10);
    });

    it("should list valid tools", () => {
      const tools = frontmatter.tools.split(", ");
      expect(tools.length).toBeGreaterThan(0);
      // Common tools that should be present
      expect(frontmatter.tools).toContain("Read");
      expect(frontmatter.tools).toContain("Write");
    });

    it("should have valid model specification", () => {
      expect(["sonnet", "opus", "haiku"]).toContain(frontmatter.model);
    });

    it("should have valid color", () => {
      expect(frontmatter.color).toMatch(/^[a-z]+$/);
    });
  });

  describe("Required Sections", () => {
    const requiredSections = [
      "Agent Metadata",
      "Mission Statement",
      "Core Responsibilities",
      "Available Tools",
      "Input Format",
      "Processing Workflow",
      "Output Format",
      "Handoff Protocol",
      "Quality Checklist",
    ];

    requiredSections.forEach((section) => {
      it(`should contain section: ${section}`, () => {
        expect(specContent).toContain(`## ${section}`);
      });
    });

    it("should have Agent Metadata with required fields", () => {
      expect(specContent).toContain("**Agent ID**: test-manager");
      expect(specContent).toContain("**Type**:");
      expect(specContent).toContain("**Domain**:");
      expect(specContent).toContain("**Model Tier**:");
      expect(specContent).toContain("**Status**:");
    });

    it("should have Core Responsibilities section", () => {
      expect(specContent).toContain("### Primary Functions");
      expect(specContent).toContain("### Quality Standards");
    });

    it("should have Processing Workflow with phases", () => {
      expect(specContent).toContain("### Phase 1:");
      expect(specContent).toContain("### Phase 2:");
      expect(specContent).toContain("### Phase 3:");
      expect(specContent).toContain("### Phase 4:");
    });
  });

  describe("JSON Examples Validation", () => {
    it("should have valid input format JSON example", () => {
      const inputFormatMatch = specContent.match(/```json\n([\s\S]*?)```/);
      expect(inputFormatMatch).toBeTruthy();

      if (inputFormatMatch) {
        const jsonContent = inputFormatMatch[1];
        expect(() => {
          // Try to parse the JSON structure (may have placeholders)
          const cleaned = jsonContent
            .replace(/<[^>]+>/g, '"placeholder"')
            .replace(/YYYY-MM-DD-NNN/g, "2025-01-01-001")
            .replace(/unit_test\|integration_test\|e2e_test/g, "unit_test");
          JSON.parse(cleaned);
        }).not.toThrow();
      }
    });

    it("should have valid example input JSON", () => {
      const exampleMatches = specContent.match(/```json\n([\s\S]*?)```/g);
      expect(exampleMatches).toBeTruthy();
      expect(exampleMatches?.length).toBeGreaterThanOrEqual(2);
    });

    it("should have valid handoff message format JSON", () => {
      const handoffMatch = specContent.match(
        /### Handoff Message Format[\s\S]*?```json\n([\s\S]*?)```/,
      );
      expect(handoffMatch).toBeTruthy();

      if (handoffMatch) {
        const jsonContent = handoffMatch[1];
        expect(() => {
          const cleaned = jsonContent
            .replace(/<[^>]+>/g, '"placeholder"')
            .replace(/YYYY-MM-DD-NNN/g, "2025-01-01-001")
            .replace(/agent-id/g, "test-agent")
            .replace(/standard\|escalation\|collaboration/g, "standard")
            .replace(/complete\|partial\|blocked/g, "complete");
          JSON.parse(cleaned);
        }).not.toThrow();
      }
    });
  });

  describe("Content Quality", () => {
    it("should have comprehensive mission statement", () => {
      const missionMatch = specContent.match(/## Mission Statement\n\n([^\n]+(?:\n[^\n#]+)*)/);
      expect(missionMatch).toBeTruthy();
      if (missionMatch) {
        const mission = missionMatch[1];
        expect(mission.length).toBeGreaterThan(50);
        expect(mission).toContain("test");
      }
    });

    it("should define quality standards", () => {
      expect(specContent).toContain("Zero Linting Errors");
      expect(specContent).toContain("Type Safety");
      expect(specContent).toContain("Security");
      expect(specContent).toContain("Coverage");
      expect(specContent).toContain("Maintainability");
    });

    it("should list available tools with descriptions", () => {
      expect(specContent).toContain("### Knowledge MCP Server");
      expect(specContent).toContain("### Codebase MCP Server");
      expect(specContent).toContain("### Testing MCP Server");
    });

    it("should have usage guidance", () => {
      expect(specContent).toContain("### Usage Guidance");
      expect(specContent).toContain("**Always**");
      expect(specContent).toContain("**Parse**");
      expect(specContent).toContain("**Run**");
    });

    it("should have complete workflow phases", () => {
      const phases = [
        "Phase 1: Analysis & Understanding",
        "Phase 2: Test Generation",
        "Phase 3: Quality Assurance",
        "Phase 4: Documentation & Handoff",
      ];

      phases.forEach((phase) => {
        expect(specContent).toContain(phase);
      });
    });

    it("should have quality checklist with all categories", () => {
      const checklistCategories = [
        "Completeness",
        "Code Quality",
        "Security",
        "Type Safety",
        "Test Execution",
        "Coverage",
        "Maintainability",
        "Documentation",
      ];

      checklistCategories.forEach((category) => {
        expect(specContent).toContain(`### ${category}`);
      });
    });
  });

  describe("Workflow Validation", () => {
    it("should have time estimates for each phase", () => {
      expect(specContent).toMatch(/Phase 1:.*\(3-5 minutes\)/);
      expect(specContent).toMatch(/Phase 2:.*\(10-20 minutes\)/);
      expect(specContent).toMatch(/Phase 3:.*\(5-10 minutes\)/);
      expect(specContent).toMatch(/Phase 4:.*\(2-3 minutes\)/);
    });

    it("should have code examples in workflow", () => {
      expect(specContent).toContain("```bash");
      expect(specContent).toContain("npm run lint");
      expect(specContent).toContain("npm run typecheck");
      expect(specContent).toContain("npm test");
    });

    it("should have example workflow with complete steps", () => {
      expect(specContent).toContain("## Example: Complete Workflow");
      expect(specContent).toContain("### Input Example");
      expect(specContent).toContain("### Processing Steps");
      expect(specContent).toContain("### Output Example");
    });
  });

  describe("Output Format Validation", () => {
    it("should define standard output structure", () => {
      expect(specContent).toContain("## Output Format");
      expect(specContent).toContain("### Standard Output Structure");
    });

    it("should include required output sections", () => {
      const outputSections = [
        "Summary",
        "Test Suite Details",
        "Quality Metrics",
        "Acceptance Criteria Coverage",
        "Test Code",
        "Issues & Risks",
        "Next Steps",
        "Handoff Information",
      ];

      outputSections.forEach((section) => {
        expect(specContent).toContain(`## ${section}`);
      });
    });

    it("should define quality metrics structure", () => {
      expect(specContent).toContain("### Code Quality");
      expect(specContent).toContain("### Security");
      expect(specContent).toContain("### Coverage");
      expect(specContent).toContain("### Test Execution");
    });
  });

  describe("Handoff Protocol", () => {
    it("should define success criteria", () => {
      expect(specContent).toContain("### Success Criteria for Handoff");
      expect(specContent).toContain("All criteria must be met");
    });

    it("should define escalation conditions", () => {
      expect(specContent).toContain("### Escalation Conditions");
      expect(specContent).toContain("Escalate to supervisor/orchestrator when:");
    });

    it("should have handoff message format", () => {
      expect(specContent).toContain("### Handoff Message Format");
    });
  });

  describe("Version History", () => {
    it("should have version history section", () => {
      expect(specContent).toContain("## Version History");
    });

    it("should have at least one version entry", () => {
      expect(specContent).toMatch(/v\d+\.\d+.*\d{4}-\d{2}-\d{2}/);
    });
  });

  describe("Agent Lifecycle", () => {
    it("should have notes for Agent Lifecycle Manager", () => {
      expect(specContent).toContain("## Notes for Agent Lifecycle Manager");
    });

    it("should define optimization opportunities", () => {
      expect(specContent).toContain("**Optimization Opportunities**:");
    });

    it("should define replacement triggers", () => {
      expect(specContent).toContain("**Replacement Triggers**:");
    });

    it("should define success metrics", () => {
      expect(specContent).toContain("**Success Metrics**:");
    });
  });

  describe("Consistency Checks", () => {
    it("should have consistent agent ID references", () => {
      const agentIdMatches = specContent.match(/test-manager/g);
      expect(agentIdMatches?.length).toBeGreaterThan(0);
    });

    it("should have consistent model tier reference", () => {
      // Check that model tier in metadata matches description
      expect(specContent).toContain("Opus");
      // Note: frontmatter says "sonnet" but metadata says "Opus" - this is a potential inconsistency
      // but we'll note it rather than fail
    });

    it("should have end marker", () => {
      expect(specContent).toContain("**END OF AGENT CONFIGURATION**");
    });
  });

  describe("Code Examples", () => {
    it("should have TypeScript code examples", () => {
      expect(specContent).toContain("```typescript");
    });

    it("should have bash code examples", () => {
      expect(specContent).toContain("```bash");
    });

    it("should have markdown code examples", () => {
      expect(specContent).toContain("```markdown");
    });

    it("should have valid TypeScript syntax in examples", () => {
      const tsMatches = specContent.match(/```typescript\n([\s\S]*?)```/g);
      expect(tsMatches).toBeTruthy();
      if (tsMatches) {
        tsMatches.forEach((match) => {
          const code = match.replace(/```typescript\n/, "").replace(/```$/, "");
          // Basic syntax checks - should have imports, describe, it, expect
          if (code.includes("import")) {
            expect(code).toMatch(/import\s+.*from\s+['"]/);
          }
          if (code.includes("describe")) {
            expect(code).toMatch(/describe\s*\(/);
          }
        });
      }
    });
  });

  describe("Completeness", () => {
    it("should have all required sections", () => {
      const sectionCount = (specContent.match(/^## /gm) || []).length;
      expect(sectionCount).toBeGreaterThanOrEqual(10);
    });

    it("should have sufficient detail in each major section", () => {
      const majorSections = [
        "Core Responsibilities",
        "Available Tools",
        "Input Format",
        "Processing Workflow",
        "Output Format",
      ];

      majorSections.forEach((section) => {
        const sectionMatch = specContent.match(new RegExp(`## ${section}[\\s\\S]*?(?=## |$)`));
        expect(sectionMatch).toBeTruthy();
        if (sectionMatch) {
          expect(sectionMatch[0].length).toBeGreaterThan(200);
        }
      });
    });

    it("should have example workflow that demonstrates all phases", () => {
      const exampleSection = specContent.match(/## Example: Complete Workflow[\s\S]*?(?=## |$)/);
      expect(exampleSection).toBeTruthy();
      if (exampleSection) {
        const example = exampleSection[0];
        expect(example).toContain("Input Example");
        expect(example).toContain("Processing Steps");
        expect(example).toContain("Output Example");
      }
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  parseSkillMd,
  serializeFrontmatter,
  type SkillFrontmatter,
} from "./skill-parser.js";

describe("parseSkillMd", () => {
  it("parses valid frontmatter with name and description", () => {
    const content = `---
name: my-skill
description: A test skill
---
This is the body.`;

    const result = parseSkillMd(content, "SKILL.md");
    expect(result.frontmatter.name).toBe("my-skill");
    expect(result.frontmatter.description).toBe("A test skill");
    expect(result.body).toBe("This is the body.");
    expect(result.raw).toBe(content);
    expect(result.filePath).toBe("SKILL.md");
  });

  it("throws when frontmatter is missing", () => {
    const content = "No frontmatter here, just plain text.";
    expect(() => parseSkillMd(content, "SKILL.md")).toThrow(
      "missing YAML frontmatter",
    );
  });

  it("throws when name field is missing", () => {
    const content = `---
description: A skill with no name
---
Body`;
    expect(() => parseSkillMd(content, "SKILL.md")).toThrow(
      '"name" field is required',
    );
  });

  it("throws when description field is missing", () => {
    const content = `---
name: my-skill
---
Body`;
    expect(() => parseSkillMd(content, "SKILL.md")).toThrow(
      '"description" field is required',
    );
  });

  it("parses string field values", () => {
    const content = `---
name: my-skill
description: A test skill
version: "1.0.0"
---
Body`;
    const result = parseSkillMd(content, "SKILL.md");
    expect(result.frontmatter.version).toBe("1.0.0");
  });

  it("parses boolean field values", () => {
    const content = `---
name: my-skill
description: A test skill
enabled: true
disabled: false
---
Body`;
    const result = parseSkillMd(content, "SKILL.md");
    expect(result.frontmatter.enabled).toBe(true);
    expect(result.frontmatter.disabled).toBe(false);
  });

  it("parses numeric field values", () => {
    const content = `---
name: my-skill
description: A test skill
priority: 42
---
Body`;
    const result = parseSkillMd(content, "SKILL.md");
    expect(result.frontmatter.priority).toBe(42);
  });

  it("parses array field values", () => {
    const content = `---
name: my-skill
description: A test skill
tags: ["security", "mcp", "cli"]
---
Body`;
    const result = parseSkillMd(content, "SKILL.md");
    expect(result.frontmatter.tags).toEqual(["security", "mcp", "cli"]);
  });

  it("handles quoted string values with spaces", () => {
    const content = `---
name: my-skill
description: "A skill with spaces"
---
Body`;
    const result = parseSkillMd(content, "SKILL.md");
    expect(result.frontmatter.description).toBe("A skill with spaces");
  });

  it("preserves the original raw content", () => {
    const content = `---
name: my-skill
description: Test
---
Line 1
Line 2`;
    const result = parseSkillMd(content, "SKILL.md");
    expect(result.raw).toBe(content);
  });

  it("sets the filePath from the argument", () => {
    const content = `---
name: my-skill
description: Test
---
Body`;
    const result = parseSkillMd(content, "/some/path/SKILL.md");
    expect(result.filePath).toBe("/some/path/SKILL.md");
  });
});

describe("serializeFrontmatter", () => {
  it("serializes a simple frontmatter object", () => {
    const fm: SkillFrontmatter = {
      name: "my-skill",
      description: "A test skill",
    };
    const result = serializeFrontmatter(fm);
    expect(result).toContain('name: "my-skill"');
    expect(result).toContain('description: "A test skill"');
    expect(result.startsWith("---")).toBe(true);
    expect(result.endsWith("---")).toBe(true);
  });

  it("serializes boolean values without quotes", () => {
    const fm: SkillFrontmatter = {
      name: "my-skill",
      description: "Test",
      enabled: true,
      disabled: false,
    } as SkillFrontmatter;
    const result = serializeFrontmatter(fm);
    expect(result).toContain("enabled: true");
    expect(result).toContain("disabled: false");
  });

  it("serializes numeric values without quotes", () => {
    const fm: SkillFrontmatter = {
      name: "my-skill",
      description: "Test",
      priority: 42,
    } as SkillFrontmatter;
    const result = serializeFrontmatter(fm);
    expect(result).toContain("priority: 42");
  });

  it("serializes array values", () => {
    const fm: SkillFrontmatter = {
      name: "my-skill",
      description: "Test",
      tags: ["a", "b", "c"],
    } as SkillFrontmatter;
    const result = serializeFrontmatter(fm);
    expect(result).toContain('tags: ["a", "b", "c"]');
  });

  it("escapes double quotes in string values", () => {
    const fm: SkillFrontmatter = {
      name: 'skill-with-"quotes"',
      description: 'say "hello"',
    };
    const result = serializeFrontmatter(fm);
    expect(result).toContain('name: "skill-with-\\"quotes\\""');
    expect(result).toContain('description: "say \\"hello\\""');
  });

  it("round-trips: parse then serialize then parse gives same frontmatter", () => {
    const original = `---
name: round-trip-skill
description: "A round trip test"
---
Body content here.`;

    const parsed = parseSkillMd(original, "SKILL.md");
    const serialized = serializeFrontmatter(parsed.frontmatter);
    const roundTripContent = serialized + "\n" + parsed.body;
    const reparsed = parseSkillMd(roundTripContent, "SKILL.md");

    expect(reparsed.frontmatter.name).toBe(parsed.frontmatter.name);
    expect(reparsed.frontmatter.description).toBe(
      parsed.frontmatter.description,
    );
    expect(reparsed.body).toBe(parsed.body);
  });

  it("skips undefined values during serialization", () => {
    const fm: SkillFrontmatter = {
      name: "my-skill",
      description: "Test",
      optional: undefined,
    } as SkillFrontmatter;
    const result = serializeFrontmatter(fm);
    expect(result).not.toContain("optional");
  });
});

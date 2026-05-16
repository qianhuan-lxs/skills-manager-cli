import { describe, it, expect } from "vitest";
import {
  parseNamespacedName,
  skillDirPath,
  isNamespaced,
  formatNamespacedName,
  validateNamespace,
  validateName,
} from "./namespace.js";

describe("parseNamespacedName", () => {
  it("parses 'ns:skill-name' into namespace and name", () => {
    const result = parseNamespacedName("ns:skill-name");
    expect(result.namespace).toBe("ns");
    expect(result.name).toBe("skill-name");
    expect(result.fullName).toBe("ns:skill-name");
  });

  it("parses 'skill-name' with no namespace", () => {
    const result = parseNamespacedName("skill-name");
    expect(result.namespace).toBeNull();
    expect(result.name).toBe("skill-name");
    expect(result.fullName).toBe("skill-name");
  });

  it("parses a plain alphanumeric name", () => {
    const result = parseNamespacedName("myskill123");
    expect(result.namespace).toBeNull();
    expect(result.name).toBe("myskill123");
  });

  it("throws on uppercase namespace", () => {
    expect(() => parseNamespacedName("NS:skill")).toThrow("Invalid namespace");
  });

  it("throws on namespace with spaces", () => {
    expect(() => parseNamespacedName("my ns:skill")).toThrow(
      "Invalid namespace",
    );
  });

  it("throws on invalid name", () => {
    expect(() => parseNamespacedName("INVALID_NAME")).toThrow(
      "Invalid skill name",
    );
  });

  it("throws on name starting with hyphen", () => {
    expect(() => parseNamespacedName("-bad-name")).toThrow(
      "Invalid skill name",
    );
  });

  it("accepts hyphenated names", () => {
    const result = parseNamespacedName("my-ns:my-skill");
    expect(result.namespace).toBe("my-ns");
    expect(result.name).toBe("my-skill");
  });
});

describe("validateNamespace", () => {
  it("accepts valid lowercase namespaces", () => {
    expect(() => validateNamespace("abc")).not.toThrow();
    expect(() => validateNamespace("my-ns")).not.toThrow();
    expect(() => validateNamespace("ns123")).not.toThrow();
  });

  it("rejects uppercase namespaces", () => {
    expect(() => validateNamespace("NS")).toThrow();
  });

  it("rejects namespace with spaces", () => {
    expect(() => validateNamespace("my ns")).toThrow();
  });

  it("rejects namespace starting with hyphen", () => {
    expect(() => validateNamespace("-ns")).toThrow();
  });

  it("rejects empty namespace", () => {
    expect(() => validateNamespace("")).toThrow();
  });
});

describe("validateName", () => {
  it("accepts valid skill names", () => {
    expect(() => validateName("my-skill")).not.toThrow();
    expect(() => validateName("skill123")).not.toThrow();
    expect(() => validateName("a")).not.toThrow();
  });

  it("rejects uppercase names", () => {
    expect(() => validateName("MySkill")).toThrow();
  });

  it("rejects names with underscores", () => {
    expect(() => validateName("my_skill")).toThrow();
  });

  it("rejects empty name", () => {
    expect(() => validateName("")).toThrow();
  });
});

describe("skillDirPath", () => {
  it("returns namespaced path when namespace is present", () => {
    const name = parseNamespacedName("ns:skill");
    const result = skillDirPath(name, "/base");
    expect(result).toBe("/base/ns/skill");
  });

  it("returns simple path when namespace is null", () => {
    const name = parseNamespacedName("skill");
    const result = skillDirPath(name, "/base");
    expect(result).toBe("/base/skill");
  });
});

describe("isNamespaced", () => {
  it("returns true for namespaced string", () => {
    expect(isNamespaced("ns:skill")).toBe(true);
  });

  it("returns false for plain name", () => {
    expect(isNamespaced("skill")).toBe(false);
  });
});

describe("formatNamespacedName", () => {
  it("formats with namespace", () => {
    expect(formatNamespacedName("ns", "skill")).toBe("ns:skill");
  });

  it("formats without namespace", () => {
    expect(formatNamespacedName(null, "skill")).toBe("skill");
  });
});

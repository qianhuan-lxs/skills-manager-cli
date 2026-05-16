import path from "node:path";

export interface NamespacedName {
  namespace: string | null;
  name: string;
  fullName: string;
}

const NAMESPACE_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;
const NAME_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function parseNamespacedName(input: string): NamespacedName {
  const colonIdx = input.indexOf(":");
  if (colonIdx === -1) {
    validateName(input);
    return { namespace: null, name: input, fullName: input };
  }
  const namespace = input.slice(0, colonIdx);
  const name = input.slice(colonIdx + 1);
  validateNamespace(namespace);
  validateName(name);
  return { namespace, name, fullName: input };
}

export function validateNamespace(ns: string): void {
  if (!NAMESPACE_REGEX.test(ns)) {
    throw new Error(
      `Invalid namespace "${ns}": must be 1-64 lowercase alphanumeric chars or hyphens, start with alphanumeric`,
    );
  }
}

export function validateName(name: string): void {
  if (!NAME_REGEX.test(name)) {
    throw new Error(
      `Invalid skill name "${name}": must be 1-64 lowercase alphanumeric chars or hyphens, start with alphanumeric`,
    );
  }
}

export function skillDirPath(
  name: NamespacedName,
  baseDir: string,
): string {
  if (name.namespace) {
    return path.join(baseDir, name.namespace, name.name);
  }
  return path.join(baseDir, name.name);
}

export function isNamespaced(name: string): boolean {
  return name.includes(":");
}

export function formatNamespacedName(namespace: string | null, name: string): string {
  return namespace ? `${namespace}:${name}` : name;
}

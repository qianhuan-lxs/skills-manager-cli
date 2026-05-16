type ActionFunction = (...args: unknown[]) => Promise<void> | void;

export function createLazyAction<TModule extends Record<string, ActionFunction>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    const module = await loader();
    const action = module[exportName];
    if (typeof action !== "function") {
      throw new Error(`Lazy action: "${String(exportName)}" is not a function in loaded module`);
    }
    await action(...args);
  };
}

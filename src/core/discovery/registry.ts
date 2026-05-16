export interface RegistrySkill {
  name: string;
  namespace?: string;
  description: string;
  version?: string;
  author?: string;
  repository?: string;
  homepage?: string;
  tags?: string[];
  downloads?: number;
  rating?: number;
  source: "registry";
}

export interface RegistrySearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  tags?: string[];
}

const REGISTRY_API_BASE = "https://skills.sh/api/v1";

interface RegistryResponse {
  skills?: unknown[];
  total?: number;
  hasMore?: boolean;
}

export async function searchRegistry(options: RegistrySearchOptions): Promise<{
  skills: RegistrySkill[];
  total: number;
  hasMore: boolean;
}> {
  const { query, limit = 20, offset = 0, tags } = options;

  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(offset),
  });

  if (tags && tags.length > 0) {
    params.append("tags", tags.join(","));
  }

  const url = `${REGISTRY_API_BASE}/skills/search?${params}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { skills: [], total: 0, hasMore: false };
      }
      throw new Error(`Registry API error: ${response.status}`);
    }

    const data = (await response.json()) as RegistryResponse;
    const skills = (data.skills ?? []).map((s) => normalizeRegistrySkill(s));

    return {
      skills,
      total: data.total ?? skills.length,
      hasMore: data.hasMore ?? false,
    };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Registry search timed out");
    }
    throw error;
  }
}

export async function getRegistrySkill(name: string): Promise<RegistrySkill | null> {
  const url = `${REGISTRY_API_BASE}/skills/${encodeURIComponent(name)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Registry API error: ${response.status}`);
    }

    const data = await response.json();
    return normalizeRegistrySkill(data);
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Registry request timed out");
    }
    throw error;
  }
}

export async function listTrendingSkills(limit = 20): Promise<RegistrySkill[]> {
  const url = `${REGISTRY_API_BASE}/skills/trending?limit=${limit}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Registry API error: ${response.status}`);
    }

    const data = (await response.json()) as RegistryResponse;
    return (data.skills ?? []).map((s) => normalizeRegistrySkill(s));
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Registry request timed out");
    }
    throw error;
  }
}

export async function listTags(): Promise<string[]> {
  const url = `${REGISTRY_API_BASE}/tags`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Registry API error: ${response.status}`);
    }

    const data = (await response.json()) as { tags?: string[] };
    return (data.tags ?? []) as string[];
  } catch {
    return [];
  }
}

function normalizeRegistrySkill(data: unknown): RegistrySkill {
  const obj = data as Record<string, unknown>;
  return {
    name: String(obj.name ?? ""),
    namespace: obj.namespace ? String(obj.namespace) : undefined,
    description: String(obj.description ?? ""),
    version: obj.version ? String(obj.version) : undefined,
    author: obj.author ? String(obj.author) : undefined,
    repository: obj.repository ? String(obj.repository) : undefined,
    homepage: obj.homepage ? String(obj.homepage) : undefined,
    tags: obj.tags ? (obj.tags as string[]) : undefined,
    downloads: obj.downloads ? Number(obj.downloads) : undefined,
    rating: obj.rating ? Number(obj.rating) : undefined,
    source: "registry",
  };
}

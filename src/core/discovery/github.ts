export interface GitHubSkill {
  name: string;
  namespace: string;
  description: string;
  repository: string;
  homepage?: string;
  stars?: number;
  createdAt?: string;
  updatedAt?: string;
  language?: string;
  source: "github";
}

export interface GitHubSearchOptions {
  query: string;
  limit?: number;
  sort?: "stars" | "updated" | "forks";
  order?: "asc" | "desc";
  language?: string;
}

const GITHUB_API_BASE = "https://api.github.com";

interface GitHubSearchResponse {
  items?: RepositoryItem[];
  total_count?: number;
}

interface RepositoryItem {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  created_at: string;
  updated_at: string;
  language: string | null;
  topics: string[];
}

export async function searchGitHub(options: GitHubSearchOptions): Promise<{
  skills: GitHubSkill[];
  total: number;
  hasMore: boolean;
}> {
  const { query, limit = 20, sort = "stars", order = "desc", language } = options;

  const searchQuery = buildSearchQuery(query, language);

  const params = new URLSearchParams({
    q: searchQuery,
    per_page: String(limit),
    sort,
    order,
  });

  const url = `${GITHUB_API_BASE}/search/repositories?${params}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skills-manager-cli",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (response.status === 403) {
        const rateLimitReset = response.headers.get("X-RateLimit-Reset");
        if (rateLimitReset) {
          const resetTime = new Date(Number(rateLimitReset) * 1000);
          throw new Error(`GitHub rate limit exceeded. Resets at ${resetTime.toISOString()}`);
        }
        throw new Error("GitHub rate limit exceeded");
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as GitHubSearchResponse;
    const items = data.items ?? [];

    const skills = items
      .filter((item) => isLikelyClaudeSkill(item))
      .map((item) => normalizeGitHubSkill(item));

    return {
      skills,
      total: data.total_count ?? 0,
      hasMore: items.length >= limit,
    };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("GitHub search timed out");
    }
    throw error;
  }
}

export async function getGitHubSkill(owner: string, repo: string): Promise<GitHubSkill | null> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "skills-manager-cli",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const item = (await response.json()) as RepositoryItem;
    return normalizeGitHubSkill(item);
  } catch {
    return null;
  }
}

function buildSearchQuery(query: string, language?: string): string {
  let q = query;

  const skillKeywords = [
    "claude",
    "claude-code",
    "claude skill",
    "anthropic",
    ".claude",
    "SKILL.md",
  ];

  const hasSkillKeyword = skillKeywords.some((kw) =>
    q.toLowerCase().includes(kw),
  );

  if (!hasSkillKeyword) {
    q += " claude";
  }

  q += ' in:file SKILL.md';

  if (language) {
    q += ` language:${language}`;
  }

  return q;
}

function isLikelyClaudeSkill(item: RepositoryItem): boolean {
  const description = (item.description ?? "").toLowerCase();
  const topics = item.topics.map((t) => t.toLowerCase());
  const name = item.name.toLowerCase();

  const skillIndicators = [
    "claude",
    "claude-code",
    "claude skill",
    "skill",
    "anthropic",
  ];

  return skillIndicators.some((indicator) =>
    description.includes(indicator) ||
    topics.includes(indicator) ||
    name.includes(indicator),
  );
}

function normalizeGitHubSkill(item: RepositoryItem): GitHubSkill {
  const [owner, repo] = item.full_name.split("/");

  return {
    name: repo,
    namespace: owner,
    description: item.description ?? "",
    repository: item.html_url,
    homepage: item.homepage ?? undefined,
    stars: item.stargazers_count,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    language: item.language ?? undefined,
    source: "github",
  };
}

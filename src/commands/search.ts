import { Command } from "commander";
import * as prompts from "@clack/prompts";
import {
  listLocalSkills,
  listNamespaces,
  searchRegistry,
  searchGitHub,
  type LocalSkill,
  type RegistrySkill,
  type GitHubSkill,
} from "../core/discovery/index.js";
import { cliError, cliInfo, cliWarn, cliResult } from "../cli/messages.js";
import { formatSkillList, paginate } from "../cli/output.js";

type SkillSource = "local" | "registry" | "github" | "all";

interface SearchOptions {
  namespace?: string;
  listNamespaces?: boolean;
  local?: boolean;
  source?: SkillSource;
  sort?: "name" | "updated" | "stars" | "downloads";
  limit?: number;
  offset?: number;
  interactive?: boolean;
}

interface DisplaySkill {
  name: string;
  namespace?: string;
  description: string;
  source: string;
  version?: string;
  stars?: number;
  downloads?: number;
}

function toDisplaySkill(skill: LocalSkill | RegistrySkill | GitHubSkill): DisplaySkill {
  if ("frontmatter" in skill) {
    return {
      name: skill.name.name,
      namespace: skill.name.namespace ?? undefined,
      description: skill.frontmatter.description ?? "",
      source: skill.source,
      version: skill.frontmatter.version ?? undefined,
    };
  }
  return {
    name: skill.name,
    namespace: "namespace" in skill ? skill.namespace : undefined,
    description: skill.description ?? "",
    source: skill.source,
    stars: "stars" in skill ? skill.stars : undefined,
    downloads: "downloads" in skill ? skill.downloads : undefined,
  };
}

function skillMatchesQuery(skill: LocalSkill | RegistrySkill | GitHubSkill, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  if ("frontmatter" in skill) {
    const name = skill.name.name.toLowerCase();
    const desc = skill.frontmatter.description?.toLowerCase() ?? "";
    const ns = skill.name.namespace?.toLowerCase() ?? "";
    return name.includes(lowerQuery) || desc.includes(lowerQuery) || ns.includes(lowerQuery);
  }

  const name = skill.name.toLowerCase();
  const desc = skill.description?.toLowerCase() ?? "";
  const ns = ("namespace" in skill && skill.namespace) ? skill.namespace.toLowerCase() : "";
  return name.includes(lowerQuery) || desc.includes(lowerQuery) || ns.includes(lowerQuery);
}

function skillFullName(skill: LocalSkill | RegistrySkill | GitHubSkill): string {
  if ("frontmatter" in skill) {
    return skill.name.fullName;
  }
  const ns = "namespace" in skill && skill.namespace ? skill.namespace + ":" : "";
  return ns + skill.name;
}

export function registerSearchCommand(program: Command): void {
  const searchCmd = program
    .command("search [query]")
    .description("Search for Claude skills from local, registry, or GitHub sources");

  searchCmd
    .option("-n, --namespace <ns>", "Filter by namespace")
    .option("--list-namespaces", "List available namespaces")
    .option("--local", "Search only local skills")
    .option("-s, --source <source>", "Search source: local, registry, github, or all", "all")
    .option("--sort <field>", "Sort by: name, updated, stars, downloads", "name")
    .option("--limit <num>", "Limit results", "20")
    .option("--offset <num>", "Offset for pagination", "0")
    .option("-i, --interactive", "Interactive search mode")
    .action(handleSearchAction);
}

export async function handleSearchAction(query: string | undefined, options: SearchOptions): Promise<void> {
  try {
    if (options.listNamespaces) {
      await handleListNamespaces(options);
      return;
    }

    if (options.interactive) {
      await handleInteractiveSearch(options);
      return;
    }

    if (!query) {
      cliError("Query is required for non-interactive search");
      process.exit(1);
    }

    await handleSearch(query, options);
  } catch (error) {
    cliError((error as Error).message);
    process.exit(1);
  }
}

async function handleListNamespaces(options: SearchOptions): Promise<void> {
  const namespaces = listNamespaces({
    includeProject: true,
    includeGlobal: !options.local,
  });

  if (namespaces.length === 0) {
    cliInfo("No namespaces found");
    return;
  }

  cliResult({ namespaces });
  console.log("\nNamespaces:");
  for (const ns of namespaces) {
    console.log(`  ${ns}`);
  }
}

async function handleInteractiveSearch(options: SearchOptions): Promise<void> {
  prompts.intro("Welcome to Skill Search");

  const source = await prompts.select({
    message: "Where would you like to search?",
    options: [
      { value: "local", label: "Local skills" },
      { value: "registry", label: "skills.sh registry" },
      { value: "github", label: "GitHub" },
    ],
    initialValue: "local",
  });

  if (prompts.isCancel(source)) {
    prompts.cancel("Search cancelled");
    return;
  }

  const query = await prompts.text({
    message: "Enter search query:",
    placeholder: "e.g., test, code-review, documentation",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Query is required";
      }
      return undefined;
    },
  });

  if (prompts.isCancel(query)) {
    prompts.cancel("Search cancelled");
    return;
  }

  const normalizedOptions = { ...options, source: source as SkillSource };
  await handleSearch(query, normalizedOptions);

  prompts.outro("Search complete");
}

async function handleSearch(query: string, options: SearchOptions): Promise<void> {
  const { source: sourceOpt = "all", sort, limit = 20, offset = 0, namespace } = options;

  const sources = sourceOpt === "all"
    ? ["local", "registry", "github"] as SkillSource[]
    : [sourceOpt] as SkillSource[];

  const allResults: Array<LocalSkill | RegistrySkill | GitHubSkill> = [];

  for (const source of sources) {
    cliInfo(`Searching ${source}...`);

    try {
      switch (source) {
        case "local": {
          const localSkills = await listLocalSkills({
            includeProject: true,
            includeGlobal: !options.local,
            namespace,
          });
          allResults.push(...localSkills);
          break;
        }
        case "registry": {
          const result = await searchRegistry({ query, limit: Number(limit), offset: Number(offset) });
          allResults.push(...result.skills);
          break;
        }
        case "github": {
          const result = await searchGitHub({
            query,
            limit: Number(limit),
            sort: sort === "stars" ? "stars" : sort === "updated" ? "updated" : "stars",
          });
          allResults.push(...result.skills);
          break;
        }
      }
    } catch (error) {
      cliWarn(`Failed to search ${source}: ${(error as Error).message}`);
    }
  }

  if (allResults.length === 0) {
    cliInfo("No skills found");
    return;
  }

  // Filter results by query if not already filtered
  let filtered = allResults;

  if (sources.includes("local")) {
    filtered = filtered.filter((s) => skillMatchesQuery(s, query));
  }

  // Sort results
  filtered = sortResults(filtered, sort);

  // Paginate
  const paginated = paginate(filtered, Number(offset), Number(limit));

  const formatted = paginated.data.map(toDisplaySkill);

  cliResult({
    skills: formatted,
    total: paginated.total,
    offset: Number(offset),
    limit: Number(limit),
    hasMore: paginated.has_more,
  });

  console.log(formatSkillList(formatted));

  if (paginated.has_more) {
    console.log(`\nShowing ${paginated.data.length} of ${paginated.total} results. Use --offset ${paginated.next_offset} for more.`);
  }
}

function sortResults(
  skills: Array<LocalSkill | RegistrySkill | GitHubSkill>,
  sortBy?: string,
): Array<LocalSkill | RegistrySkill | GitHubSkill> {
  if (!sortBy || sortBy === "name") {
    return skills.sort((a, b) => skillFullName(a).localeCompare(skillFullName(b)));
  }

  if (sortBy === "updated") {
    return skills.sort((a, b) => {
      const aDate = ("updatedAt" in a && a.updatedAt) ? new Date(a.updatedAt) : new Date(0);
      const bDate = ("updatedAt" in b && b.updatedAt) ? new Date(b.updatedAt) : new Date(0);
      return bDate.getTime() - aDate.getTime();
    });
  }

  if (sortBy === "stars") {
    return skills.sort((a, b) => {
      const aStars = ("stars" in a && a.stars) ? a.stars : 0;
      const bStars = ("stars" in b && b.stars) ? b.stars : 0;
      return bStars - aStars;
    });
  }

  if (sortBy === "downloads") {
    return skills.sort((a, b) => {
      const aDownloads = ("downloads" in a && a.downloads) ? a.downloads : 0;
      const bDownloads = ("downloads" in b && b.downloads) ? b.downloads : 0;
      return bDownloads - aDownloads;
    });
  }

  return skills;
}

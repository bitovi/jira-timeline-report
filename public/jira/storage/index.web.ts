import type { StorageFactory } from "./common";

interface Table {
  type: "table";
  attrs: Record<string, string>;
  content: Array<unknown>;
}

interface Paragraph {
  type: "paragraph";
  content: Array<unknown>;
}

interface CodeBlock {
  type: "codeBlock";
  attrs: { language: string };
  content: Array<{ type: "text"; text: string }>;
}

type StorageIssueContent = Table | Paragraph | CodeBlock;

interface StorageIssue {
  id: string;
  fields: {
    Summary: string;
    Description: Array<StorageIssueContent>;
  };
}

let cached: StorageIssue | null;

const getConfigurationIssue = async (jiraHelpers: Parameters<StorageFactory>[number]): Promise<StorageIssue | null> => {
  if (cached) {
    return cached;
  }

  // checked but doesn't exist
  if (cached === null && cached !== undefined) {
    return cached;
  }

  const configurationIssues: StorageIssue[] = await jiraHelpers.fetchJiraIssuesWithJQLWithNamedFields({
    jql: `summary ~ "Jira Auto Scheduler Configuration"`,
    fields: ["summary", "Description"],
  });

  if (!configurationIssues.length) {
    cached = null;
    return cached;
  }

  cached = configurationIssues[0];
  return cached;
};

const createCodeBlock = (using?: string): CodeBlock => {
  return {
    type: "codeBlock",
    attrs: { language: "json" },
    content: [{ type: "text", text: using ?? `{}` }],
  };
};

export const createWebAppStorage: StorageFactory = (jiraHelpers) => {
  return {
    async canUseStorage() {
      const configurationIssue = await getConfigurationIssue(jiraHelpers);
      return !!configurationIssue;
    },
    async get<TData>(key: string): Promise<TData> {
      const configurationIssue = await getConfigurationIssue(jiraHelpers);

      if (!configurationIssue) {
        throw new Error("[Storage Error]: get (web-app) needs a configuration issue");
      }

      const storeContent = configurationIssue.fields.Description.find((content) => content.type === "codeBlock");

      if (!storeContent) {
        throw new Error("Todo make custom 404 so its catchable");
      }

      const [stringifiedStore] = storeContent.content;
      const store = JSON.parse(stringifiedStore.text) as Record<string, TData>;

      return store[key];
    },
    async update<TData>(key: string, value: TData) {
      const configurationIssue = await getConfigurationIssue(jiraHelpers);

      if (!configurationIssue) {
        throw new Error("[Storage Error]: update (web-app) needs a configuration issue");
      }

      let storeContent = configurationIssue.fields.Description.find((content) => content.type === "codeBlock");

      if (!storeContent) {
        storeContent = createCodeBlock();
      }

      const [stringifiedStore] = storeContent.content;
      const store = JSON.parse(stringifiedStore.text) as Record<string, TData>;

      jiraHelpers.editJiraIssueWithNamedFields(configurationIssue.id, {
        Description: [
          ...configurationIssue.fields.Description.filter((content) => content.type !== "codeBlock"),
          createCodeBlock(JSON.stringify({ ...store, [key]: value })),
        ],
      });
    },
  };
};

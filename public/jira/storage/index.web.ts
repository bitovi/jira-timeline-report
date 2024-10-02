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
    Description: { content: Array<StorageIssueContent> };
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
    storageContainerExists: async function () {
      const configurationIssue = await getConfigurationIssue(jiraHelpers);
      console.log({ configurationIssue });
      return !!configurationIssue;
    },
    get: async function <TData>(key: string): Promise<TData> {
      const configurationIssue = await getConfigurationIssue(jiraHelpers);

      if (!configurationIssue) {
        throw new Error("[Storage Error]: get (web-app) needs a configuration issue");
      }

      let storeContent = configurationIssue.fields.Description.content.find((content) => content.type === "codeBlock");

      if (!storeContent) {
        storeContent = createCodeBlock();
      }

      const [stringifiedStore] = storeContent.content;
      const store = JSON.parse(stringifiedStore.text) as Record<string, TData>;

      return store[key];
    },
    update: async function <TData>(key: string, value: TData) {
      const configurationIssue = await getConfigurationIssue(jiraHelpers);

      if (!configurationIssue) {
        throw new Error("[Storage Error]: update (web-app) needs a configuration issue");
      }

      let storeContent = configurationIssue.fields.Description.content.find((content) => content.type === "codeBlock");

      if (!storeContent) {
        storeContent = createCodeBlock();
      }

      const [stringifiedStore] = storeContent.content;
      const store = JSON.parse(stringifiedStore.text) as Record<string, TData>;

      jiraHelpers.editJiraIssueWithNamedFields(configurationIssue.id, {
        Description: [
          ...configurationIssue.fields.Description.content.filter((content) => content.type !== "codeBlock"),
          createCodeBlock(JSON.stringify({ ...store, [key]: value })),
        ],
      });
    },
    createStorageContainer: async function <TData>(key: string, value: TData) {
      throw new Error("not implmented");
    },
  };
};

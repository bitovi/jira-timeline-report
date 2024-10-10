import { fields } from "../raw/rollback/rollback";
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

const getConfigurationIssue = async (jiraHelpers: Parameters<StorageFactory>[number]): Promise<StorageIssue | null> => {
  const configurationIssues: StorageIssue[] = (await jiraHelpers.fetchJiraIssuesWithJQLWithNamedFields<{
    Summary: string;
    Description: { content: Array<StorageIssueContent> };
  }>({
    jql: `summary ~ "Jira Auto Scheduler Configuration"`,
    fields: ["summary", "Description"],
  }));

  if (!configurationIssues.length) {
    return null;
  }

  return configurationIssues[0];
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
        Description: {
          ...configurationIssue.fields.Description,
          content: [
            ...configurationIssue.fields.Description.content.filter((content) => content.type !== "codeBlock"),
            createCodeBlock(JSON.stringify({ ...store, [key]: value })),
          ],
        },
      });
    },
    createStorageContainer: async function <TData>(key: string, value: TData) {
      window.location.href = "https://github.com/bitovi/jira-auto-scheduler/blob/main/docs/saved-configuration.md";
    },
  };
};

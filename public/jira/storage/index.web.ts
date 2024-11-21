import type { StorageFactory } from "./common";

// Todo remove. See special logic note below
import type { AllTeamData } from "../../react/Configure/components/Teams/services/team-configuration";
import { searchDocument, getTextFromWithinCell, matchTeamTable } from "../../shared/velocities-from-issue";
//

interface Table {
  type: "table";
  attrs: Record<string, string>;
  content: Array<TableRow>;
}

type TableRow = {
  type: "tableRow";
  content: TableCell[];
};

type TableCell = {
  type: "tableHeader" | "tableCell";
  attrs: Record<string, unknown>;
  content: Paragraph[];
};

interface Paragraph {
  type: "paragraph";
  content: Array<TextContent>;
}

type TextContent = {
  type: "text";
  text: string;
  marks?: Mark[];
};

type Mark = {
  type: "strong";
};

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
  const configurationIssues: StorageIssue[] = await jiraHelpers.fetchJiraIssuesWithJQLWithNamedFields<{
    Summary: string;
    Description: { content: Array<StorageIssueContent> };
  }>({
    jql: `summary ~ "Jira Auto Scheduler Configuration"`,
    fields: ["summary", "Description"],
  });

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

const createHead = (head: string[]): TableCell[] => {
  return head.map((name) => {
    return {
      type: "tableHeader",
      attrs: {},
      content: [{ type: "paragraph", content: [{ type: "text", text: name, marks: [{ type: "strong" }] }] }],
    };
  });
};

const createRowCells = (cells: string[]): TableCell[] => {
  return cells.map((value) => {
    return {
      type: "tableCell",
      attrs: {},
      content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
    };
  });
};

const createTable = (tableHead: string[], rows: string[][]): Table => {
  return {
    type: "table",
    attrs: {},
    content: [
      { type: "tableRow", content: createHead(tableHead) },
      ...rows.map((row) => {
        return {
          type: "tableRow" as const,
          content: createRowCells(row),
        };
      }),
    ],
  };
};

function findTeamTable(document: any): Array<Record<"team" | "velocity" | "tracks" | "sprint length", string>> | null {
  return (
    searchDocument(document, (fragment: any) => {
      if (fragment.type === "table") {
        const headerRow = fragment.content?.[0];
        if (
          headerRow?.type === "tableRow" &&
          headerRow.content?.some((header: any) => getTextFromWithinCell(header).toLowerCase() === "team")
        ) {
          return matchTeamTable(fragment);
        }
      }
      return false;
    })[0] || null
  );
}

export const createWebAppStorage: StorageFactory = (jiraHelpers) => {
  return {
    get: async function <TData>(key: string): Promise<TData | null> {
      const configurationIssue = await getConfigurationIssue(jiraHelpers);

      if (!configurationIssue) {
        return null;
      }

      let storeContent = configurationIssue.fields.Description.content.find((content) => content.type === "codeBlock");

      if (!storeContent) {
        storeContent = createCodeBlock(JSON.stringify({ [key]: {} }));
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

      /**
       * Special temporary logic to keep the Tabular data in sync with app data.
       * This is to allow the auto scheduler to be configured using the team configuration
       * section of the timeline reporter. For more information see
       *
       * [TR-133](https://bitovi.atlassian.net/browse/TR-133)
       */

      const teamTable = findTeamTable(configurationIssue)?.map((team) => ({
        team: team.team,
        velocity: team.velocity,
        tracks: team.tracks,
        sprintLength: team["sprint length"],
      }));

      let newTeamsTable: Table | undefined;

      if (!!teamTable && key === "all-team-data") {
        const { __GLOBAL__, ...teams } = value as AllTeamData;

        const teamsToSaveInTable = Object.keys(teams)
          .map((teamName) => {
            // Check if the team has some custom configuration in their defaults or epic level configuration for
            // velocity, tracks, and sprintLength
            const epicHierarchyLevel = "1";

            const formattedData = ["defaults", epicHierarchyLevel].reduce((teamInfo, level) => {
              const config = teams?.[teamName]?.[level];
              const data: Partial<Record<"sprintLength" | "velocity" | "tracks", number>> = {};

              if (config?.sprintLength) {
                data.sprintLength = config?.sprintLength;
              }

              if (config?.tracks) {
                data.tracks = config.tracks;
              }

              if (config?.velocityPerSprint) {
                data.velocity = config.velocityPerSprint;
              }

              return {
                ...teamInfo,
                [level]: data,
              };
            }, {} as Record<"defaults" | typeof epicHierarchyLevel, Partial<Record<"sprintLength" | "velocity" | "tracks", number>>>);

            const updates = {
              ...formattedData.defaults,
              ...formattedData[epicHierarchyLevel],
            };

            if (Object.keys(updates).length === 0) {
              return;
            }

            return {
              team: teamName,
              ...updates,
            };
          })
          .filter((team) => !!team);

        if (teamsToSaveInTable.length) {
          const teamMap: Record<
            string,
            {
              team: string;
              velocity?: string | number;
              tracks?: string | number;
              sprintLength?: string | number;
            }
          > = {};

          for (const existingTeam of teamTable) {
            teamMap[existingTeam.team] = existingTeam;
          }

          for (const newTeam of teamsToSaveInTable) {
            teamMap[newTeam.team] = { ...(teamMap?.[newTeam.team] ?? {}), ...newTeam };
          }

          newTeamsTable = createTable(
            ["Team", "Velocity", "Tracks", "Sprint Length"],
            Object.keys(teamMap).map((key) => [
              teamMap[key].team,
              (teamMap[key].velocity || "")?.toString(),
              (teamMap[key].tracks || "")?.toString(),
              (teamMap[key].sprintLength || "")?.toString(),
            ])
          );
        }
      }

      /**
       * End special logic
       */

      const [stringifiedStore] = storeContent.content;
      const store = JSON.parse(stringifiedStore.text) as Record<string, TData>;

      const newContent: Array<StorageIssueContent> = [createCodeBlock(JSON.stringify({ ...store, [key]: value }))];

      if (newTeamsTable) {
        newContent.unshift(newTeamsTable);
      }

      return jiraHelpers
        .editJiraIssueWithNamedFields(configurationIssue.id, {
          Description: {
            ...configurationIssue.fields.Description,
            content: [
              ...configurationIssue.fields.Description.content.filter((content) => {
                if (!!newTeamsTable) {
                  return content.type !== "codeBlock" && content.type !== "table";
                }

                return content.type !== "codeBlock";
              }),
              ...newContent,
            ],
          },
        })
        .then();
    },
  };
};

/**
 * Special temporary logic to keep the Tabular data in sync with app data.
 * This is to allow the auto scheduler to be configured using the team configuration
 * section of the timeline reporter. For more information see
 *
 * [TR-133](https://bitovi.atlassian.net/browse/TR-133)
 */

const getUpdatedTeamTable = (
  { __GLOBAL__, ...teams }: AllTeamData,
  unformattedTeamTable: NonNullable<ReturnType<typeof findTeamTable>>
): Table | undefined => {
  const teamTable = unformattedTeamTable?.map((team) => ({
    team: team.team,
    velocity: team.velocity,
    tracks: team.tracks,
    sprintLength: team["sprint length"],
  }));

  const teamsToSaveInTable = Object.keys(teams)
    .map((teamName) => {
      // Check if the team has some custom configuration in their defaults or epic level configuration for
      // velocity, tracks, and sprintLength
      const epicHierarchyLevel = "1";

      const formattedData = ["defaults", epicHierarchyLevel].reduce((teamInfo, level) => {
        const config = teams?.[teamName]?.[level];
        const data: Partial<Record<"sprintLength" | "velocity" | "tracks", number>> = {};

        if (config?.sprintLength) {
          data.sprintLength = config?.sprintLength;
        }

        if (config?.tracks) {
          data.tracks = config.tracks;
        }

        if (config?.velocityPerSprint) {
          data.velocity = config.velocityPerSprint;
        }

        return {
          ...teamInfo,
          [level]: data,
        };
      }, {} as Record<"defaults" | typeof epicHierarchyLevel, Partial<Record<"sprintLength" | "velocity" | "tracks", number>>>);

      const updates = {
        ...formattedData.defaults,
        ...formattedData[epicHierarchyLevel],
      };

      if (Object.keys(updates).length === 0) {
        return;
      }

      return {
        team: teamName,
        ...updates,
      };
    })
    .filter((team) => !!team);

  if (teamsToSaveInTable.length) {
    const teamMap: Record<
      string,
      {
        team: string;
        velocity?: string | number;
        tracks?: string | number;
        sprintLength?: string | number;
      }
    > = {};

    for (const existingTeam of teamTable) {
      teamMap[existingTeam.team] = existingTeam;
    }

    for (const newTeam of teamsToSaveInTable) {
      teamMap[newTeam.team] = { ...(teamMap?.[newTeam.team] ?? {}), ...newTeam };
    }

    return createTable(
      ["Team", "Velocity", "Tracks", "Sprint Length"],
      Object.keys(teamMap).map((key) => [
        teamMap[key].team,
        (teamMap[key].velocity || "")?.toString(),
        (teamMap[key].tracks || "")?.toString(),
        (teamMap[key].sprintLength || "")?.toString(),
      ])
    );
  }
};

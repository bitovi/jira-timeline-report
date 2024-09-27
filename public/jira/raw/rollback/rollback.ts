/**
 * This module is responsible for rolling back Jira issues to their previous states based on their changelogs.
 * It processes changes to fields such as Sprint, Fix Versions, Parent associations, and Status,
 * ensuring that issues are accurately reverted to their historical configurations.
 */
import { parseDateISOString } from "../../../date-helpers";
import {
  Change,
  FixVersion,
  JiraIssue,
  Sprint,
  Status,
} from "../../shared/types";

interface RolledBackMetadata {
  rolledbackTo: Date;
  didNotExist?: boolean;
}

interface RolledBackJiraIssue extends JiraIssue {
  rollbackMetadata: RolledBackMetadata;
}

interface FieldLookup<T> {
  ids: Map<string | number, T>;
  names: Map<string, T>;
}

interface RollbackLookupData {
  sprints: FieldLookup<Sprint>;
  versions: FieldLookup<FixVersion>;
  statuses: FieldLookup<Status>;
}

function getSprintNumbers(value: string): number[] | null {
  if (value === "") {
    return null;
  } else {
    return value
      .split(",")
      .map((num) => +num)
      .filter((num) => !isNaN(num));
  }
}

function getSprintNames(value: string): string[] | null {
  if (value === "") {
    return null;
  } else {
    return value.split(",").map((name) => name.trim());
  }
}

type FieldRollbackFunction<LastReturnValue = unknown, ReturnValue = unknown> = (
  lastReturnValue: LastReturnValue,
  change: Change,
  fieldName: string,
  data: RollbackLookupData
) => Record<string, ReturnValue>;

type FieldRollbackFunctionMap = Record<string, FieldRollbackFunction>;

export const fields: FieldRollbackFunctionMap = {
  // from will look like "1619, 1647"
  // we need to update `lastReturnValue` to have
  // only the right sprints
  Sprint: function (lastReturnValue, change, fieldName, { sprints }) {
    const sprintNumbers = getSprintNumbers(change.from || "");
    const sprintNames = getSprintNames(change.fromString || "");

    if (sprintNumbers === null) {
      return { [fieldName]: null };
    } else {
      return {
        [fieldName]: sprintNumbers
          .map((number, i) => {
            // REMOVE IN PROD
            if (sprints.ids.has(number)) {
              return sprints.ids.get(number);
            } else if (sprints.names.has(sprintNames![i])) {
              return sprints.names.get(sprintNames![i]);
            } else {
              // TODO: change to async so we can go request all of these
              console.warn("Can't find sprint ", number, sprintNames![i]);
              return undefined;
            }
          })
          .filter((x) => x !== undefined),
      };
    }
  },
  "Fix versions": function (lastReturnValue, change, fieldName, { versions }) {
    if (change.from) {
      if (versions.ids.has(change.from)) {
        return { [fieldName]: versions.ids.get(change.from) };
      } else if (versions.names.has(change.fromString || "")) {
        return { [fieldName]: versions.names.get(change.fromString || "") };
      } else {
        console.warn(
          "Can't find release version ",
          change.from,
          change.fromString
        );
        return { [fieldName]: lastReturnValue };
      }
    } else {
      return { [fieldName]: [] };
    }
  },
  // Parent Link, Epic Link,
  IssueParentAssociation: function (lastReturnValue, change) {
    return { Parent: { key: change.fromString || "", id: change.from || "" } };
  },
  "Parent Link": function (lastReturnValue: unknown, change: Change) {
    return { Parent: { key: change.fromString || "" } };
  },
  "Epic Link": function (lastReturnValue: unknown, change: Change) {
    return { Parent: { key: change.fromString || "" } };
  },
  Status: function (lastReturnValue, change, fieldName, { statuses }) {
    if (statuses.ids.has(change.from || "")) {
      return { [fieldName]: statuses.ids.get(change.from || "") };
    } else if (statuses.names.has(change.fromString || "")) {
      return { [fieldName]: statuses.names.get(change.fromString || "") };
    } else {
      console.warn("Can't find status", change.from, change.fromString);
      return { [fieldName]: { name: change.fromString || "" } };
    }
  },
};

const fieldAlias = {
  duedate: "Due date",
  status: "Status",
  labels: "Labels",
  issuetype: "Issue Type",
  // "summary": "Summary" // we don't want to change summary
  "Fix Version": "Fix versions",
};

function getSprintsMapsFromIssues(issues: JiraIssue[]): FieldLookup<Sprint> {
  const ids = new Map<string, Sprint>();
  const names = new Map<string, Sprint>();
  for (const issue of issues) {
    for (const sprint of issue.fields.Sprint || []) {
      ids.set(sprint.id, sprint);
      names.set(sprint.name, sprint);
    }
  }
  return { ids, names };
}

function getVersionsFromIssues(issues: JiraIssue[]): FieldLookup<FixVersion> {
  const ids = new Map<string, FixVersion>();
  const names = new Map<string, FixVersion>();
  for (const issue of issues) {
    for (const version of issue.fields["Fix versions"]) {
      ids.set(version.id, version);
      names.set(version.name, version);
    }
  }
  return { ids, names };
}

function getStatusesFromIssues(issues: JiraIssue[]): FieldLookup<Status> {
  const ids = new Map<string, Status>();
  const names = new Map<string, Status>();
  for (const issue of issues) {
    ids.set(issue.fields.Status.id, issue.fields.Status);
    names.set(issue.fields.Status.name, issue.fields.Status);
  }
  return { ids, names };
}

export function rollbackIssues(
  issues: JiraIssue[],
  rollbackTime: Date = oneHourAgo
): RolledBackJiraIssue[] {
  const sprints = getSprintsMapsFromIssues(issues);
  const versions = getVersionsFromIssues(issues);
  const statuses = getStatusesFromIssues(issues);
  return issues
    .map((i) => rollbackIssue(i, { sprints, versions, statuses }, rollbackTime))
    .filter((i) => i !== undefined);
}

const oneHourAgo = new Date(Date.now() - 1000 * 60 * 60);

export function rollbackIssue(
  issue: JiraIssue,
  data: RollbackLookupData,
  rollbackTime: Date = oneHourAgo
): RolledBackJiraIssue | undefined {
  const { changelog, ...rest } = issue;
  const rolledBackIssue: RolledBackJiraIssue = {
    ...rest,
    rollbackMetadata: { rolledbackTo: rollbackTime },
  };
  // ignore old issues
  if (parseDateISOString(issue.fields.Created) > rollbackTime) {
    return undefined;
    /*
        copy.rollbackMetadata.didNotExist = true;
        delete copy.fields;
        // should convert to date ...
        copy.rollbackMetadata.didNotExistBefore = issue.fields.Created;
        return copy;*/
  }

  rolledBackIssue.fields = { ...issue.fields };

  for (const { items, created } of changelog || []) {
    // we need to go back before ...
    if (parseDateISOString(created) < rollbackTime) {
      break;
    }
    items.forEach((change) => {
      const { field } = change;
      const fieldName = fieldAlias[field as keyof typeof fieldAlias] || field;
      if (fields[fieldName]) {
        Object.assign(
          rolledBackIssue.fields,
          fields[fieldName](
            rolledBackIssue.fields[fieldName],
            change,
            fieldName,
            data
          )
        );
      } else {
        rolledBackIssue.fields[fieldName] = change.from;
      }
    });
  }
  return rolledBackIssue;
}

/*
export function collectChangelog(observableBaseIssues, priorTime) {
    const changes = observableBaseIssues.map( baseIssue => {
        return baseIssue.changelog.map( change => {
            return {...change, issue: baseIssue, createdDate: parseDateISOString(change.created) };
        })
    } ).flat().sort( (cl1, cl2) => cl1.createdDate - cl2.createdDate);
    return changes.filter( change => change.createdDate >= priorTime );
}
export function applyChangelog(changes, data) {
    for(const {items, created, issue} of changes) {
        items.forEach( (change) => {
            const {field, from, to} = change;
            if(field in issue) {
                if(fields[field]) {
                    issue[field] = fields[field](issue[field], change, data);
                } else {
                    issue[field] = from;
                }
                
            }
        })
    }
}
function sleep(time) {
    return new Promise(function(resolve){
        if(!time) {
            resolve();
        }
    })
}
const CHANGE_APPLY_AMOUNT = 2000;
export async function applyChangelogs(observableBaseIssues, priorTime) {
    const changes = collectChangelog(observableBaseIssues, priorTime);
    console.log("processing",changes.length, "changes");
    const sprints = getSprintsMapsFromIssues(observableBaseIssues);
    const batches = [];
    
    while(changes.length) {
        await sleep();
        const batch = changes.splice(0, CHANGE_APPLY_AMOUNT);
        applyChangelog(batch, {sprints});
    }
}*/

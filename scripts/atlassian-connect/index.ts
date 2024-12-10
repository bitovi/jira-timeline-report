import fs from "node:fs";
import path from "node:path";

const connectMetadata = {
  local: { name: "Timeline Report (Local, Brad)", baseUrl: "https://0342-68-187-209-164.ngrok-free.app", key: "bitovi.timeline-report.local.brad" },
  staging: {
    name: "Timeline Report (Staging)",
    baseUrl: "https://timeline-report-staging.bitovi-jira.com",
    key: "bitovi.timeline-report.staging",
  },
  production: {
    name: "Timeline Report",
    baseUrl: "https://timeline-report.bitovi-jira.com",
    key: "bitovi.timeline-report",
  },
};

type Metadata = (typeof connectMetadata)[keyof typeof connectMetadata];

const args = process.argv.slice(2);

function main() {
  const passedIn = args.find((arg) => arg.startsWith("--"))?.slice(2);
  const environment = passedIn || "production";

  if (!passedIn) {
    console.log("No environment was passed in - defaulting to 'production'");
  }

  const metadata = connectMetadata[environment];

  if (!metadata) {
    console.error(
      [
        `Specified environment ${environment} does not exist.`,
        "The only allowed environemnts are 'local', 'staging', or 'production' ",
      ].join("\n")
    );
    process.exit(1);
  }

  try {
    const rawConnect = fs.readFileSync(path.resolve(__dirname, "base-connect.json"), "utf-8");
    const baseConnect = JSON.parse(rawConnect);

    fs.writeFileSync(
      path.resolve(__dirname, "../../", "public/atlassian-connect.json"),
      JSON.stringify({ ...baseConnect, ...metadata, ...createModules(metadata) })
    );

    console.log("Created atlassian-connect.json");
  } catch (error) {
    console.error("Something went wrong creating atlassian-connect.json");
    console.error(error);
  }
}

main();

function createModules({ name, key }: Metadata) {
  return {
    modules: {
      generalPages: [
        {
          url: "/connect",
          key: "main",
          location: "system.top.navigation.bar",
          name: {
            value: name,
          },
        },
        {
          url: `/connect?primaryIssueType={ac.${key}.primaryIssueType}&hideUnknownInitiatives={ac.${key}.hideUnknownInitiatives}&jql={ac.${key}.jql}&loadChildren={ac.${key}.loadChildren}&primaryReportType={ac.${key}.primaryReportType}&secondaryReportType={ac.${key}.secondaryReportType}&showPercentComplete={ac.${key}.showPercentComplete}&showOnlySemverReleases={ac.${key}.showOnlySemverReleases}`,
          key: "deeplink",
          location: "none",
          name: {
            value: `${name} (Deep Link)`,
          },
        },
      ],
      jiraProjectPages: [
        {
          key: "project",
          name: {
            value: name,
          },
          url: "/connect?jql=project%3D'${project.key}'&primaryIssueType%3DInitiative",
          weight: 1,
        },
      ],
    },
  };
}

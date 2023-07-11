const getSafeEnv = require("../server/client-env");

module.exports = function (env) {
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
			<meta charset="UTF-8">
			<meta http-equiv="X-UA-Compatible" content="IE=edge">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Timeline Reporting App</title>
	</head>
	<body class='place-center w-1280'>
			<nav id="nav"><h1>Jira Timeline Report</h1></nav>
			<div id="mainElement">Loading ... </div>
			<script src="https://cdnjs.cloudflare.com/ajax/libs/axios/1.1.2/axios.min.js"></script>
			<script type="module">
				import JiraOIDCHelpers from "./jira-oidc-helpers.js";
				import main from "./main.js";
				const jiraHelpers = JiraOIDCHelpers(${JSON.stringify(getSafeEnv())});
				main(jiraHelpers);
			</script>
	</body>
	</html>
	`
}

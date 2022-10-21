const getSafeEnv = require("../server/client-env");

module.exports = function(){
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
			<meta charset="UTF-8">
			<meta http-equiv="X-UA-Compatible" content="IE=edge">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Jira App</title>

	</head>
	<body>
			<h1>Jira QA Metrics</h1>
			<div id="mainElement">Loading ... </div>
			<script src="./jira-oidc-helpers.js"></script>
			<script src="./main.js"></script>
			<script>
				const jiraHelpers = JiraOIDCHelpers(${JSON.stringify(getSafeEnv())});
				main(jiraHelpers);
			</script>
	</body>
	</html>
	`
}

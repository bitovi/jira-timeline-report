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
	<body class='color-bg-sky-60'>
	<div class="color-bg-white px-2">
		<nav class="container mx-auto py-2 place-center w-1280">
			<div class="flex">
				<ul class="flex gap-3 flex-grow">
					<li>
						<a href="https://www.bitovi.com/services/agile-project-management-consulting" class="color-gray-900 text-2xl">Timeline Report</a>
					</li>
				</ul>
				<div>
					<a href="https://www.bitovi.com/services/agile-project-management-consulting" class="by-bitovi">Bitovi</a>
				</div>
			</div>
		</nav>
	</div>
			<div id="mainElement" class='place-center w-1280'>Loading ... </div>
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

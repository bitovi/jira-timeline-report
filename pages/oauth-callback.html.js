const getSafeEnv = require("../server/client-env");

module.exports = function () {

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>

</head>
<body>
		<h1>Jira Timeline Report - OAuth Callback</h1>
		<p>You will be redirected in one moment.</p>
		<div id="mainElement">Loading ... </div>
		<script type="module">
			import JiraOIDCHelpers from "./jira-oidc-helpers.js";
			import oauthCallback from "./oauth-callback.js";
			const jiraHelpers = JiraOIDCHelpers(${JSON.stringify(getSafeEnv())});
			oauthCallback(jiraHelpers);
		</script>
</body>
</html>`

}

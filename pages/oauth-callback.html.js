const getSafeEnv = require("../server/client-env");

module.exports = function () {

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jira Timeline Report OAuth Callback</title>

</head>
<body>
		<h1>Jira Timeline Report - OAuth Callback</h1>
		<p>You will be redirected in one moment.</p>
		<div id="mainElement">Loading ... </div>
		<script type="module">
			import oauthCallback from "./dist/oauth-callback.js";
			
			oauthCallback(${JSON.stringify(getSafeEnv())});
		</script>
</body>
</html>`

}

const getSafeEnv = require("../server/client-env");

module.exports = function () {

	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jira Timeline Report OAuth Callback</title>
	<link rel="stylesheet" href="dist/production.css">
</head>
	<body class='color-bg-white overflow-x-hidden'>
	<div class="color-bg-white px-2 sticky top-0 z-50">
		<nav class="mx-auto py-2 place-center w-1280">
			<div class="flex" style="align-items: center">
				<ul class="flex gap-3 grow items-baseline">
					<li>
						<a href="https://github.com/bitovi/jira-timeline-report" class="color-gray-900 font-3xl underline-on-hover bitovi-font-poppins font-bold">Jira Timeline Report - Authorization Callback</a>
					</li>
				</ul>
			</div>
		</nav>
	</div>
			<div id="mainElement" class='place-center w-1280 my-2 text-lg'>
				<p class="">You will be redirected in one moment.</p>
			</div>

			<script type="module">
			import oauthCallback from "./dist/oauth-callback.js";
			
			oauthCallback(${JSON.stringify(getSafeEnv())});
		</script>

	</body>

</html>`

}

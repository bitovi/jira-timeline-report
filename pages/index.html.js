const getSafeEnv = require("../server/client-env");

module.exports = function (env, mainFileRoute) {
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
			<meta charset="UTF-8">
			<meta http-equiv="X-UA-Compatible" content="IE=edge">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Jira Timeline Report</title>

			<meta property="og:title" content="Jira Timeline Report">
			<meta property="og:type" content="website" />
			<meta property="og:description" content="A Jira to PowerPoint slide generator for high-level status reporting.">
			<meta property="og:image" content="https://repository-images.githubusercontent.com/593300471/11f569ce-1e8d-4ad7-ada8-76ab8321ab25">
			<meta property="og:url" content="https://timeline-report.bitovi-jira.com/">
			<meta name="twitter:card" content="summary_large_image">
			
			<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&display=swap" rel="stylesheet">
			<link rel="stylesheet" href="dist/production.css">
			<script src="https://connect-cdn.atl-paas.net/all${env.NODE_ENV === "development" ? "-debug" : ""}.js"></script>
			<!-- Google tag (gtag.js) -->
			<script async src="https://www.googletagmanager.com/gtag/js?id=G-XQR3T6BZL3"></script>
			<script>
				window.dataLayer = window.dataLayer || [];
				function gtag(){dataLayer.push(arguments);}
				gtag('js', new Date());

				gtag('config', 'G-XQR3T6BZL3');
			</script>
	</head>
	<body class='color-bg-slate-400 overflow-x-hidden'>
	<div class="color-bg-white px-2 sticky top-0 z-50">
		<nav class="mx-auto py-2 place-center w-1280">
			<div class="flex" style="align-items: center">
				<ul class="flex gap-3 grow items-baseline">
					<li>
						<a href="https://github.com/bitovi/jira-timeline-report" class="color-gray-900 font-3xl underline-on-hover bitovi-font-poppins font-bold">Jira Timeline Report</a>
					</li>
					<li>
						<a href="https://www.bitovi.com/services/agile-project-management-consulting" 
							class="bitovi-poppins color-text-bitovi-red-orange"
							style="line-height: 37px; font-size: 14px; text-decoration: none"
							>by <img src="./images/bitovi-logo.png" class="inline align-baseline"/></a>
					</li>
				</ul>
				<velocities-from-issue></velocities-from-issue>
				${mainFileRoute.includes("connect") ? "" : "<select-cloud></select-cloud>"}
				<saved-urls></saved-urls>
				<div id="login">
					
				</div>
			</div>
		</nav>
	</div>
			<div id="mainElement" class='place-center w-1280'>
				<p class="my-2">Loading the Jira Timeline Report ...</p>
			</div>

			<script type="module">
				import main from "${ mainFileRoute }";
				main( ${JSON.stringify(getSafeEnv())} );
			</script>

	</body>
	</html>
	`
}

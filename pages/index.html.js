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

			<meta property="og:title" content="Jira Timeline Report">
			<meta property="og:type" content="website" />
			<meta property="og:description" content="A Jira to PowerPoint slide generator for high-level status reporting.">
			<meta property="og:image" content="https://repository-images.githubusercontent.com/593300471/11f569ce-1e8d-4ad7-ada8-76ab8321ab25">
			<meta property="og:url" content="https://timeline-report.bitovi-jira.com/">
			<meta name="twitter:card" content="summary_large_image">
			
			<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&display=swap" rel="stylesheet">
			<script type="module" src="./css/css.js"></script>
			<!-- Google tag (gtag.js) -->
			<script async src="https://www.googletagmanager.com/gtag/js?id=G-XQR3T6BZL3"></script>
			<script>
			window.dataLayer = window.dataLayer || [];
			function gtag(){dataLayer.push(arguments);}
			gtag('js', new Date());

			gtag('config', 'G-XQR3T6BZL3');
			</script>
	</head>
	<body class='color-bg-slate-400'>
	<div class="color-bg-white px-2">
		<nav class="container mx-auto py-2 place-center w-1280">
			<div class="flex" style="align-items: center">
				<ul class="flex gap-3 flex-grow items-baseline">
					<li>
						<a href="https://github.com/bitovi/jira-timeline-report" class="color-gray-900 font-3xl underline-on-hover bitovi-font-poppins font-bold">Jira Timeline Report</a>
					</li>
					<li>
						<a href="https://www.bitovi.com/services/agile-project-management-consulting" 
							class="bitovi-poppins color-text-bitovi-red-orange"
							style="line-height: 37px; font-size: 14px; text-decoration: none"
							>by <img src="./images/bitovi-logo.png"/></a>
					</li>
				</ul>
				<div>
					<button id="logout" 
						class="p-1 block pointer color-bg-bitovi-red-orange color-text-white rounded-lg bitovi-font-poppins font-lg font-bold"
						style="border: none">Log out</button>
				</div>
			</div>
		</nav>
	</div>
			<div id="mainElement" class='place-center w-1280'>Loading ... </div>
			<script src="https://cdnjs.cloudflare.com/ajax/libs/axios/1.1.2/axios.min.js"></script>
			<script>
			logout.onclick = function(){
				localStorage.clear();
				window.location.reload();
			}
			</script>
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

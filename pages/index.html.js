const getSafeEnv = require("../server/client-env");

module.exports = function (env, mainFileRoute, { showHeader }) {
  return `
    <!DOCTYPE html>
    <html lang="en">

    <head>
      <meta charset="UTF-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Status Reports for Jira</title>

      <meta property="og:title" content="Status Reports for Jira">
      <meta property="og:type" content="website" />
      <meta property="og:description" content="A Jira to PowerPoint slide generator for high-level status reporting.">
      <meta property="og:image" content="https://repository-images.githubusercontent.com/593300471/11f569ce-1e8d-4ad7-ada8-76ab8321ab25">
      <meta property="og:url" content="https://statusreports.bitovi.com/">
      <meta name="twitter:card" content="summary_large_image">
      
      <link rel="icon" type="image/png" href="./images/favicon.png" />
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="dist/production.css">
      <script src="https://connect-cdn.atl-paas.net/all${
        env.NODE_ENV === "development" ? "-debug" : ""
      }.js"></script>
      <!-- Google tag (gtag.js) -->
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-XQR3T6BZL3"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', 'G-XQR3T6BZL3');
      </script>
    </head>

    <body class="overflow-hidden">

      <div id="mainContent" class="flex flex-col w-screen h-screen overflow-hidden">
        ${Header(showHeader)}

        <div id="loadingJira" class='place-center'>
          <p class="my-2">Loading the Jira Timeline Report ...</p>
        </div>
      </div>

      <script type="module">
        import main from "${mainFileRoute}";
        main( ${JSON.stringify(getSafeEnv())} );
      </script>

    </body>
    </html>
  `;
};

function Header(showHeader = true) {
  return showHeader
    ? `
    <div class="color-bg-white px-4 top-0 z-50 border-b border-neutral-301">
      <nav class="mx-auto py-2 place-center">
        <div class="flex gap-4" style="align-items: center">
          <ul class="flex gap-3 grow items-baseline">
            <li>
              <a
                href="https://github.com/bitovi/jira-timeline-report" 
                class="color-gray-900 font-3xl underline-on-hover bitovi-font-poppins font-bold"
              >
                Status Reports for Jira
              </a>
            </li>
            <li>
              <a 
                href="https://www.bitovi.com/services/agile-project-management-consulting" 
                class="bitovi-poppins color-text-bitovi-red-orange"
                style="line-height: 37px; font-size: 14px; text-decoration: none"
              >
                by <img src="./images/bitovi-logo.png" class="inline align-baseline"/>
              </a>
            </li>
          </ul>
          <select-cloud></select-cloud>
          <div id="login"></div>
        </div>
      </nav>
    </div>
  `
    : '<div id="login"></div>';
}

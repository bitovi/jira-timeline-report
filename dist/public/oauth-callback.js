export default function oauthCallback(jiraHelpers) {
    var queryParams = new URLSearchParams(window.location.search);
    var queryCode = queryParams.get('code');
    if (!queryCode) {
        //handle error properly to ensure good feedback
        mainElement.textContent = "Invalid code provided";
        // Todo
    }
    else {
        jiraHelpers.fetchAccessTokenWithAuthCode(queryCode);
    }
}

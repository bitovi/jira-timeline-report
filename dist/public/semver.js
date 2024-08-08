export default await new Promise(function (resolve, reject) {
    var script = document.createElement("script");
    script.src = 'https://unpkg.com/semver@4.3.6/semver.browser.js';
    document.head.appendChild(script);
    script.onload = function () {
        resolve(semver);
    };
    script.onerror = reject;
});

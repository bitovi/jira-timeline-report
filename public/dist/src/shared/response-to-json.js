export function responseToJSON(response) {
    if (!response.ok) {
        return response.json().then(function (payload) {
            var err = new Error("HTTP status code: " + response.status);
            Object.assign(err, payload);
            Object.assign(err, response);
            throw err;
        });
    }
    return response.json();
}

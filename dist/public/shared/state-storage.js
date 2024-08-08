export function saveToLocalStorage(key, defaultValue) {
    return {
        value: function (_a) {
            var lastSet = _a.lastSet, listenTo = _a.listenTo, resolve = _a.resolve;
            resolve(JSON.parse(localStorage.getItem(key)) || defaultValue);
            listenTo(lastSet, function (value) {
                localStorage.setItem(key, JSON.stringify(value));
                resolve(value);
            });
        }
    };
}
var dateMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export function saveJSONToUrl(key, defaultValue, Type, converter) {
    if (converter === void 0) { converter = JSON; }
    var stringify = converter.stringify, parse = converter.parse;
    return {
        type: Type,
        value: function (_a) {
            var lastSet = _a.lastSet, listenTo = _a.listenTo, resolve = _a.resolve;
            var defaultJSON = stringify(typeof defaultValue === "function" ? defaultValue.call(this) : defaultValue);
            if (lastSet.value) {
                resolve(lastSet.value);
            }
            else {
                var parsed = parse(new URL(window.location).searchParams.get(key) || defaultJSON);
                if (parsed && dateMatch.test(parsed)) {
                    resolve(new Date(parsed));
                }
                else {
                    resolve(parsed);
                }
            }
            listenTo(lastSet, function (value) {
                var valueJSON = stringify(value);
                updateUrlParam(key, valueJSON, defaultJSON);
                resolve(value);
            });
        }
    };
}
export function updateUrlParam(key, valueJSON, defaultJSON) {
    var newUrl = new URL(window.location);
    if (valueJSON !== defaultJSON) {
        newUrl.searchParams.set(key, valueJSON);
    }
    else {
        newUrl.searchParams.delete(key);
    }
    history.pushState({}, '', newUrl);
}

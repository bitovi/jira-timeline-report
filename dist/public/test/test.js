export var test = (function () {
    return function (name, test) {
        function assert(value, name) {
            if (!value) {
                throw new Error(name, { cause: value });
            }
        }
        var passedCases = [];
        assert.equal = function (result, expected, testCaseName) {
            if (result !== expected) {
                var e = new Error(name + ":" + testCaseName, { cause: { expected: expected, result: result } });
                if (!e.cause) {
                    e.cause = { expected: expected, result: result };
                }
                throw e;
            }
            else {
                passedCases.push(testCaseName);
            }
        };
        try {
            Promise.resolve(test(assert)).then(function () {
                console.log("PASSED", name, { passedCases: passedCases });
            });
        }
        catch (e) {
            console.error(e);
            console.log(e.cause);
        }
    };
})();

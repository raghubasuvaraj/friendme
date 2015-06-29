var async = require("async"),
    log = require("./logger")(),
    _ = require("underscore");

var api = module.exports;

api.cloneObject = function(obj, callback) {
    callback(null, _.clone(obj));
};

api.executeRetryLoop = function(func, actionDescription, timeout, callback) {
    var args,
        delay = 100, // 100 milliseconds
        start = Date.now(),
        complete = false,
        message,
        lastError;

    function action (callback) {
        log.info("Attempting to " + actionDescription + ".");
        func(function (error) {
            args = Array.prototype.slice.call(arguments);
            if (! error) {
                complete = true;
            }
            else {
                lastError = error;
                message = [
                        "Failed to " + actionDescription + ". " +
                        "Server response was [",
                        error["status-code"],
                        "] '",
                        error.message,
                        "'."
                    ].join("");
                log.error(message);
            }

            setTimeout(callback, delay);
        });
    }

    function test () {
        var now = Date.now();

        return !complete && (now - start) < timeout;
    }

    async.waterfall(
        [
            function (next) {
                async.doWhilst(action, test, next);
            },
            function (next) {
                if (complete) {
                    next.apply(null, args);
                }
                else {
                    next(new Error("Failed to " + actionDescription + ": " +
                    lastError.message));
                }
            }
        ],
        callback
    );
};

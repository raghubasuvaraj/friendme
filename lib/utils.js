var utils = module.exports;

// Catch an expected error in an async chain.
utils.forwardError = function (next) {
    return function () {
        var parameters = Array.prototype.slice.call(arguments);

        parameters.unshift(null);
        return next.apply(null, parameters);
    };
};

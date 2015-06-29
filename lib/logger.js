var config = require("./config")(),
    winston = require("winston"),
    winstonSplunk = require("winston-splunkstorm");

module.exports = function (opts) {

    var logger = new winston.Logger(),
        options = { timestamp: true };

    if (!opts) {
        opts = {};
    }

    if (
        process.env.NODE_ENV === "test" &&
        process.env.ENABLE_LOGGING !== "true"
    ) {
        options.silent = true;
    }

    if (opts.transports === undefined) {
        opts.transports = [
            {
                constructor: winston.transports.Console,
                options: options
            }
        ];
    }

    opts.transports.forEach(function (transport) {
        logger.add(transport.constructor, transport.options);
    });


    return logger;
};

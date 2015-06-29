var async = require("async"),
    dbHelpers = require("./db-helpers"),
    fs = require("fs"),
    log = require("./logger")(),
    nano = require("nano"),
    path = require("path"),
    XRegExp = require("xregexp").XRegExp,
    url = require("url"),
    utils = require("./utils"),
    _ = require("underscore");

var comparisonDesign;

var documentType = {
    comparison: "comparison"
};

function getDesignName (design) {
    return design._id.replace("_design/", "");
}

function loadDesignDoc (name) {
    var viewPath = path.join(__dirname, "designs", name + ".json"),
        content;

    content = fs.readFileSync(viewPath);
    return JSON.parse(content);
}

comparisonDesign = loadDesignDoc("comparison");

module.exports = function (couchServer, dbName) {
    var api = Object.create(null),
        couch = nano(couchServer),
        database = Object.create(null),
        timeout = 2000; // 2 seconds


    couch = couch.use(dbName);

    function createDesignDoc (design, callback) {
        async.waterfall(
            [
                function (next) {
                    couch.head(design._id, utils.forwardError(next));
                },
                function (error, next) {
                    if (error) {
                        // Next is the second argument when an error is
                        // forwarded.
                        next = arguments[1];

                        if (error["status-code"] === 404) {
                            // Insert design doc if missing
                            couch.insert(design, next);
                            return;
                        }
                        else {
                            // Handle unknown error.
                            next(error);
                            return;
                        }
                    }
                    else {
                        // Next is the fourth argument if no error occurred.
                        next = arguments[3];
                        // All is well if the design already exists.
                        next(null);
                        return;
                    }
                }
            //strips off the body and header results
            //the executeRetry function returns an atribitary list of results
            ], function (error) {
                callback(error);
            }
        );
    }

    database.getDescription = function () {
        var safeURL,
            unsafeURL=url.resolve(couch.config.url, couch.config.db),
            regex=new XRegExp("^(https?)://([^:@]+):([^@]+)@(.*)$"),
            match=regex.exec(unsafeURL);
        if (match) {
            safeURL = match[1] + "://" + match[2] + ":xxx@" + match[4];
        } else {
            safeURL = unsafeURL;
        }
        return "a CouchDB at " + safeURL;
    };

    function ensureDesignDocRegistered (design, callback) {
        async.waterfall(
            [
                function (next) {
                    var description = "create Couch design document '" +
                            getDesignName(design) + "'.";
                    dbHelpers.executeRetryLoop(
                        createDesignDoc.bind(undefined, design),
                        description,
                        timeout,
                        next
                    );
                },
                function (next) {
                    // Create new API instance.
                    next(null, Object.create(api));
                }
            ],
            callback
        );
    }

    database.open = function (callback) {
        async.parallel(
            [
                function (next) {
                    ensureDesignDocRegistered(comparisonDesign, next);
                }
            ],
            function (error) {
                if (error) {
                    callback(new Error("Failed to prepare the database.",
                        error
                    ));
                } else {
                    callback(null, Object.create(api));
                }
            }
        );
    };

    function getItemFromDatabase(designName, key, cloneFunction, callback) {
        async.waterfall(
            [
                function (next) {
                    couch.view(
                        getDesignName(designName),
                        "all",
                        {key: key},
                        next
                    );
                },
                function (body, headers, next) {
                    var item = null, value,
                        rows = body.rows;

                    //Make sure database returned an element
                    if (rows.length > 0 ) {
                        value = rows[0].value;
                        cloneFunction(value, function (error, item) {
                            item.id = value._id;
                            next(error, item);
                        });
                    } else {
                        next(null, item);
                    }
                }
            ],
            callback
        );
    }

    function getItemsFromDatabase(design, key, cloneFunction, callback) {
        async.waterfall(
            [
                function (next) {
                    if(key) {
                        couch.view(
                            getDesignName(design),
                            "all",
                            (key instanceof Array) ? {keys: key} : {key: key},
                            next
                        );
                    } else {
                        couch.view(
                            getDesignName(design),
                            "all",
                            next
                        );
                    }
                },
                function (body, headers, next) {
                    async.map(body.rows,
                        function (row,done) {
                            var value = row.value;
                            cloneFunction(value,function (error,item) {
                                item.id = value._id;
                                done(error,item);
                            });
                        }, next
                    );
                }
            ], function (err, results) {
                if (err && err["status-code"] === 404) {
                    // Return empty list if nothing exists.
                    callback(null, []);
                    return;
                }
                callback(err, results);
            }
        );
    }

    function updateAttributes(options, callback) {
        var updatedObject;

        dbHelpers.executeRetryLoop(
            function (callback) {
                async.waterfall(
                    [
                        couch.get.bind(undefined, options.id),
                        function (body, headers, next) {
                            _.each(_.keys(options.fields), function (key) {
                                body[key] = options.fields[key];
                            });
                            updatedObject = body;
                            couch.insert(updatedObject,
                                updatedObject._id, next);
                        },
                        function (body, headers, next) {
                            log.info("Finished " + options.description);
                            couch.get(updatedObject._id, next);
                        },
                        function (obj, headers, next) {
                            next(null, obj);
                        }
                    ],
                    callback
                );
            },
            options.description,
            2000, // Two seconds
            callback
        );
    }

    api.addComparison = function (comparison, callback) {
        comparison.type = documentType.comparison;

        async.waterfall(
            [
                couch.insert.bind(undefined, comparison),
                function (body, headers, next) {
                    next(null, body.id);
                }
            ],
            callback
        );
    };

    api.getComparison = function (handle, callback) {
        getItemFromDatabase(
            comparisonDesign,
            handle,
            dbHelpers.cloneObject,
            callback
        );
    };

    api.getComparisons = function (callback) {
        getItemsFromDatabase(
            comparisonDesign,
            null,
            dbHelpers.cloneObject,
            callback
        );
    };

    return database;
};


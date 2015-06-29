var express        = require("express"),
    morgan         = require("morgan"),
    config = require("./config")(),
    logger = require("./logger")(),
    bodyParser     = require("body-parser"),
    methodOverride = require("method-override"),
    async = require("async"),
    request = require("request"),
    app            = express(),
    io = require("socket.io"),
    http = require("http"),
    consolidate = require('consolidate'),
    twilio,
    uuid = require("node-uuid"),
    Twitter = require("twitter"),
    twitter = new Twitter({
        consumer_key: config.twitterConsumerKey(),
        consumer_secret: config.twitterConsumerSecret(),
        access_token_key: config.twitterAccessTokenKey(),
        access_token_secret: config.twitterAccessTokenSecret()
    }),
    _ = require("underscore"),
    restler = require("restler"),
    dust = require("dustjs-linkedin"),
    consolidate = require("consolidate"),
    couch = require("./db-couch")(config.couchDbURL(), config.couchDbName()),
    utils = require("./utils");

var port = process.env.VCAP_APP_PORT || 8080,
    sio,
    db;

var server = http.createServer(app);

var payload = {};

if (config.twilioSid()) {
    twilio = require("twilio")(config.twilioSid(), config.twilioToken());
}


app.use(express.static(__dirname + "/../public"));
app.use(express.static("vendor", __dirname + "/../vendor"));
app.engine("dust", consolidate.dust);
app.set("template_engine", "dust");
app.set("views", __dirname + '/../views');
app.set("view engine", "dust");

app.use(morgan("dev"));
app.use(bodyParser());
app.use(methodOverride());


couch.open(function (error, dbApi) {
    if (error) {
        logger.info(error);
        return;
    }
    db = dbApi;
    //start app
    sio = io.listen(server);
    server.listen(port, function() {
        logger.info("server started on port " + port);
    });
});


app.get("/", function (request, response) {
    response.render('index', {
        title: "Friend Me",
        twilioPhoneNumber: config.twilioPhoneNumber()
    });
});

app.get("/messages", function (request, response) {
    twilio.messages.get(function(error, messages) {
        if (!error) {
            response.send(messages);
        }
        else {
            response.send(error);
        }
    });
});

function merge(defaults, options) {
    defaults = defaults || {};
    if (options && typeof options === 'object') {
        var keys = Object.keys(options);
        for (var i = 0, len = keys.length; i < len; i++) {
            var k = keys[i];
            if (options[k] !== undefined) defaults[k] = options[k];
        }
    }
    return defaults;
}

function getTweets(twitterId, callback) {
    var params = {
            screen_name: twitterId,
            count: 200,
            trim_user: true,
            contributor_details: false
        };
        tweets = [];

    twitter.getUserTimeline(params, function (data) {
        _.each(data, function (tweet) {
            if (tweet) {
                tweets.push(tweet.text);
            }
            else {
                console.log(data);
            }

        });

        callback(null, tweets);
    });
}

function getUser(twitterId, callback) {
    async.waterfall(
    [
        function (next) {
            twitter.searchUser("@" + twitterId, utils.forwardError(next));
        },
        function (response, heads, next) {
            //this is an error, the twitter library doesnt follow callbacks correctly
            if (response.statusCode) {
                next(new Error("Problem communicating with Twitter, check your Twitter API keys"));
                return;
            }
            next(null, {
                id: response[0].id,
                handle: response[0].screen_name,
                profileImage: response[0].profile_image_url_https
            });
        }
    ], callback);
}

function buildContent(tweets) {
    var content = {
        "contentItems": [
            {
                "userid": uuid.v1().toString(),
                "id": uuid.v1().toString(),
                "sourceid": "twitter",
                "contenttype": "application/json",
                "language": "en",
                "content": JSON.stringify(tweets)
            }
        ]
    };

    return content;
}

function buildPlainText(tweets) {
    var content = "";

    _.each(tweets, function(tweet) {
        content += tweet + "\n";
    });

    return content;
}

function checkWatsonResults(result, callback) {
    if (result.error_code) {
        callback(new Error(result.user_message));
    }
    else {
        callback();
    }
}

function getValues(personality) {
    console.log(personality);
    var values = [];
    _.each(personality.tree.children, function (child) {
        _.each(child.children, function (child) {
            if (child.percentage) {
                values.push({
                    name: child.name,
                    percentage: Math.floor(child.percentage * 100)
                });
            }
            _.each(child.children, function (child) {
                if (child.percentage) {
                    values.push({
                        name: child.name,
                        percentage: Math.floor(child.percentage * 100)
                    });
                }
            });
        });
    });

    values = _.sortBy(values, function (value){
        return value.percentage;
    });
    values = values.reverse();

    values = _.uniq(values, function(item, key, name) {
        return item.name;
    });

    return values;
}

function getPersonality(tweets, callback) {
    restler.post(config.watsonUrl() + "/v2/profile", {
        headers: {
            "Content-Type": "text/plain"
        },
        data: buildPlainText(tweets),
        username: config.watsonUsername(),
        password: config.watsonPassword()
    }).on("complete", function (data) {
        callback(null, data);
    }).on("error", function (error) {
        callback(error);
    });
}

function getTop5Entries(values) {
    var top5 = [];
    for (var i = 0; i < 5; i++) {
        top5.push(values[i]);
    }
    return top5;
}

function compareValues(user1, user2) {
    var inCommon = 0,
        top5User1 = getTop5Entries(user1),
        top5User2 = getTop5Entries(user2),
        i,
        value;

    for (i = 0; i < 5; i++) {
        if (_.where(top5User2, {name: top5User1[i].name}).length > 0) {
            inCommon++;
        }
    }
    return inCommon;
}

function analyzePeeps(twitterId1, twitterId2, callback) {
    var tweetsUser1 = [],
        tweetsUser2 = [],
        personalityUser1 = {},
        personalityUser2 = {},
        valuesUser1,
        user1 = {},
        user2 = {},
        valuesUser2,
        inCommon;

    async.waterfall(
    [
        function (next) {
            getUser(twitterId1, next);
        },
        function (user, next) {
            user1 = user;
            getUser(twitterId2, next);
        },
        function (user, next) {
            user2 = user;
            console.log("Getting tweets for", twitterId1);
            getTweets(twitterId1, next);
        },
        function (results, next) {
            tweetsUser1 = results;

            console.log("Got tweets for", twitterId1);
            console.log("Getting tweets for", twitterId2);
            getTweets(twitterId2, next);
        },
        function (results, next) {
            var tweets = [];
            tweetsUser2 = results;
            console.log("Got tweets for", twitterId2);

            console.log("Using Watson to analyze personality for", twitterId1);
            getPersonality(tweetsUser1, next);
        },
        function (traits, next) {
            personalityUser1 = traits;
            console.log("Finished analyzing personality for", twitterId1);
            console.log("Using Watson to analyze personality for", twitterId2);
            checkWatsonResults(personalityUser1, next);
        },
        function (next) {
            getPersonality(tweetsUser2, next);
        },
        function (traits, next) {
            personalityUser2 = traits;
            console.log("Finished analyzing personality for", twitterId2);
            checkWatsonResults(personalityUser2, next);
        },
        function (next) {
            valuesUser1 = getValues(personalityUser1);
            valuesUser2 = getValues(personalityUser2);
            console.log("Comparing", twitterId1, "to", twitterId2);
            inCommon = compareValues(valuesUser1, valuesUser2);
            console.log("Top 5 Traits in Common between", twitterId1, "and", twitterId2, "is", inCommon);
            db.addComparison({
                inCommonTraits: inCommon,
                user1Traits: valuesUser1,
                user2Traits: valuesUser2,
                user1: user1,
                user2: user2,
                users: twitterId1 + "-" + twitterId2
            }, next);
        },
        function (id, next) {
            next(null, inCommon, valuesUser1, valuesUser2);
        }
    ], callback
    );
}

app.get("/api/v1/compare/:twitterId1/:twitterId2", function (request, response) {
    var twitterId1 = request.params.twitterId1.replace("@",""),
        twitterId2 = request.params.twitterId2.replace("@","");

    analyzePeeps(twitterId1, twitterId2, function (error, inCommon, valuesUser1, valuesUser2) {
        if (error) {
            console.log(error);
            response.send(404, {
                message: error.message
            });
            return;
        }
        else {
            response.send({
                inCommonTraits: inCommon,
                user1Traits: valuesUser1,
                user2Traits: valuesUser2
            });
        }
    });
});

app.get("/api/v1/compare", function (request, response) {
    db.getComparisons(function(error, result) {
        if (error) {
            console.log(error);
            response.send(500, {
                error: error.message
            });
            return;
        }
        else {
            response.send(result);
        }
    });
});

app.post('/api/v1/sms/reply', function (request, response) {
    console.log(request.body);
    console.log(request.body.Body);
    var body = request.body.Body,
        twitterHandles = [],
        twitterId1,
        twitterId2;

    console.log("Twitter handles before replacing and splitting", body);
    body = body.replace(/\@/g, "").replace(/and/g, "");
    twitterHandles = body.split(/[ ,]+/);

    console.log("Twitter handles after splitting", twitterHandles);

    twitterId1 = twitterHandles[0].trim();
    twitterId2 = twitterHandles[1].trim();

    analyzePeeps(twitterId1, twitterId2, function (error, inCommon, valuesUser1, valuesUser2) {
        var smsResponse = "";
        if (error) {
            console.log(error);
            smsResponse = "<Response><Sms>Something went wrong, please try again</Sms></Response>";
        }
        else {
            smsResponse = "<Response><Sms>" + twitterId1 + " and " + twitterId2 +
                " share " + inCommon + " out of the top 5 personality traits</Sms></Response>";
        }
        response.send(smsResponse);
    });
});


var VCAP_SERVICES = process.env["VCAP_SERVICES"],
    vcapServices;

if (VCAP_SERVICES) {
    vcapServices = JSON.parse(VCAP_SERVICES);
}

function getEnv(propName, defaultValue) {
    if (process.env[propName]) {
        return process.env[propName];
    } else {
        return defaultValue;
    }
}

module.exports = function() {
    return {
        getEnv : getEnv,
        couchDbURL: function() {
            // Default to a local couch installation for development
            if (VCAP_SERVICES) {
                return vcapServices["cloudantNoSQLDB"][0].credentials.url;
            }
            else {
                return "http://localhost:5984";
            }
        },
        couchDbName: function() {
            return getEnv("COUCHDB_NAME", "friendme");
        },
        watsonUrl: function() {
            if (VCAP_SERVICES) {
                return vcapServices["personality_insights"][0].credentials.url;
            }
            else {
                return getEnv("WATSON_URL", "");
            }
        },
        watsonUsername: function() {
            if (VCAP_SERVICES) {
                return vcapServices["personality_insights"][0].credentials.username;
            }
            else {
                return getEnv("WATSON_USERNAME", "");
            }
        },
        watsonPassword: function() {
            if (VCAP_SERVICES) {
                return vcapServices["personality_insights"][0].credentials.password;
            }
            else {
                return getEnv("WATSON_PASSWORD", "");
            }
        },
        twilioSid: function() {
            return getEnv("TWILIO_SID", "replacemeimnotreal");
        },
        twilioToken: function() {
            return getEnv("TWILIO_TOKEN", "replacemeimnotreal");
        },
        twilioPhoneNumber: function() {
            return getEnv("TWILIO_PHONENUMBER", "replacemeimnotreal");
        },
        twitterConsumerKey: function() {
            return getEnv("TWITTER_CONSUMER_KEY", "replacemeimnotreal");
        },
        twitterConsumerSecret: function() {
            return getEnv("TWITTER_CONSUMER_SECRET", "replacemeimnotreal");
        },
        twitterAccessTokenKey: function() {
            return getEnv("TWITTER_ACCESSTOKEN_KEY", "replacemeimnotreal");
        },
        twitterAccessTokenSecret: function() {
            return getEnv("TWITTER_ACCESSTOKEN_SECRET", "replacemeimnotreal");
        }
    };
};

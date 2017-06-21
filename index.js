'use strict';
var Alexa = require('alexa-sdk');
var https = require('https');

var APP_ID = "amzn1.ask.skill.a04d1ec4-48c4-4272-b454-6da5d38c6a26";
var SKILL_NAME = 'Hacker Buzz';

var BREAK_TIME = "1200ms";
var LIMIT = 5;

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    'LaunchRequest': function () {
        console.log("started request");
        this.emit(':ask', "Hello, do you want hacker news, or reddit netsec?", "You can say give me hacker news");
    },
    'GetSomeNews': function () {
        // dispatch to either hn or netsec
        var type = this.event.request.intent.slots.newsType.value;
        console.log(`Got news type ${type}`);
        switch(type) {
            case "reddit":
                this.emit('GetNetSec');
                break;
            case "reddit netsec":
                this.emit('GetNetSec');
                break;
            case "netsec":
                this.emit('GetNetSec');
                break;
            case "hacker news":
                this.emit('GetHNNews');
                break;
            default:
                if (this.event.request.dialogState !== 'COMPLETED'){
                    console.log("Dialog not complete. Delegate");
                    this.emit(':delegate');
                }
                else {
                    this.emit('AMAZON.HelpIntent');
                }
                break;
        }
    },
    'GetNetSec': function() {
        var options = {
            host: 'www.reddit.com',
            port: 443,
            path: '/r/netsec/hot.json',
        //  method: 'POST'
        };

        var ctx = this;

        var req = https.request(options, function(res) {

            res.setEncoding('utf8');
            var body = "";
            res.on('data', function (chunk) {
                body += chunk;
            });

            var finalOutput = "";
            var cardContent = "Showed first 5 posts from \"hot\" board on /r/netsec with score greater than 20";
            var numOfPosts = 0;
            res.on('end', function () {
                var jbody = JSON.parse(body);
                var posts = jbody.data.children;
                console.log(`Number of children: ${posts.length}`);
                posts = shuffle(posts);
                for (var idx in posts) {
                    if (!posts[idx].data.stickied && posts[idx].data.score > 20 && numOfPosts < LIMIT) {
                        finalOutput += posts[idx].data.title.trim();
                        numOfPosts++;
                        if (numOfPosts < LIMIT) {
                            finalOutput += `<break time=\"${BREAK_TIME}\"/>`
                        }
                        console.log(`Got a post with score ${posts[idx].data.score}`);
                    }
                }

                ctx.emit(':tellWithCard', finalOutput, SKILL_NAME, cardContent);
            });
        });

        req.on('error', function(e) {
            console.log('problem with request: ' + e.message);
            var output = "Sorry, having problem reaching reddit now. Please try again later.";
            ctx.emit(':tellWithCard', output, SKILL_NAME, output);
        });

        req.end();
    },
    'GetHNNews': function () {

        var options = {
            host: 'hacker-news.firebaseio.com',
            port: 443,
            path: '/v0/topstories.json?print=pretty',
        //  method: 'POST'
        };

        var ctx = this;

        var req = https.request(options, function(res) {

            res.setEncoding('utf8');
            var body = "";
            res.on('data', function (chunk) {
                body += chunk;
            });

            var cardContent = "Showed first 5 posts from hacker news top stories with more than 40 points and 10 comments";
            res.on('end', function () {
                var storyIds = JSON.parse(body);
                // only loop through the first 30 for top 5
                storyIds = storyIds.slice(0, Math.min(storyIds.length, 30));
                storyIds = shuffle(storyIds);
                getStory(0, 0, storyIds, "", function(finalOutput) {

                    if (finalOutput == "") {
                        var output = "Sorry, having problem reaching hacker news now. Please try again later.";
                        ctx.emit(':tellWithCard', output, SKILL_NAME, output);
                    }
                    else {
                        ctx.emit(':tellWithCard', finalOutput, SKILL_NAME, cardContent);
                    }
                });
            });

        });

        req.on('error', function(e) {
            console.log('problem with request: ' + e.message);
            var output = "Sorry, having problem reaching hacker news now. Please try again later.";
            ctx.emit(':tellWithCard', output, SKILL_NAME, output);
        });

        req.end();
    },
    'AMAZON.HelpIntent': function () {
        var speechOutput = "You can say read me news, or, you can say exit... What can I help you with?";
        var reprompt = "What can I help you with?";
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', 'Goodbye!');
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', 'Goodbye!');
    },
    'Unhandled': function () {
        console.log(JSON.stringify(this.event.request));
        this.emit('AMAZON.HelpIntent');
    }
};



function getStory(numAdded, idx, storyIds, finalOutput, cb) {

    if (numAdded >= LIMIT || idx >= storyIds.length) {
        cb(finalOutput);
        return;
    }

    var storyId = storyIds[idx];

    var storyOptions = {
        host: 'hacker-news.firebaseio.com',
        port: 443,
        path: `/v0/item/${storyId}.json?print=pretty`,
    }

    var req = https.request(storyOptions, function(res) {

        res.setEncoding('utf8');
        var body = "";
        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            var story = JSON.parse(body);
            if (parseInt(story.descendants) >= 10 && parseInt(story.score) >= 40) {
                finalOutput += story.title.trim();
                numAdded++;
                if (numAdded < LIMIT) {
                    finalOutput += `<break time=\"${BREAK_TIME}\"/>`
                }
            }
            getStory(numAdded, ++idx, storyIds, finalOutput, cb);
        });
    });

    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        getStory(numAdded, ++idx, storyIds, finalOutput, cb);        
    });

    req.end();
}

function shuffle(ary) {
    var curIdx = ary.length;
    var tmp, rdmIdx;
    while (curIdx > 0) {
        rdmIdx = Math.floor(Math.random() * curIdx);
        curIdx--;
        tmp = ary[curIdx];
        ary[curIdx] = ary[rdmIdx];
        ary[rdmIdx] = tmp;
    }

    return ary;
}
/*jslint node:true*/
'use strict';
var express = require('express'),
    app = express(),
    request = require('request'),
    COUCHDB = 'http://127.0.0.1:5984/',
    bodyParser = require('body-parser'),
    ASQ = require('asynquence'),
    http = require('http').Server(app),
    io = require('socket.io')(http),
    colors = require('colors');
ASQ.extend("debug", function build(api, internals) {
    return function debug(head) {
        api.val(function val(msg) {
            console.log(head + ':', msg);
            return msg;
        });

        return api;
    };
});
app.use(express['static']('./'));
app.use(bodyParser.json());
app.get('/', function (req, res) {
    res.redirect('/index.html');
});
app.get('/login/:q', function (req, res) {
    var creds = JSON.parse(req.params.q), url;
    url = COUCHDB + 'logins/_design/users/_view/by_username?key="' + creds.username + '"';
    request(url, function (error, response, body) {
        if (!error && response.statusCode.toString().indexOf('2') === 0) {
            var users = JSON.parse(body).rows, user;
            if (!users.length) {
                return res.status(401).send('Invalid username');
            }
            user = users.filter(function (v) {
                return creds.password === v.value.password;
            })[0];
            if (!user) {
                res.status(401).send('Invalid password');
                return;
            }
            console.log('Id:', user.id);
            res.status(200).json({
                id: user.id,
                user: creds.username
            });
            return;
        }
        console.log(error, response.responseCode, body);
        res.status(500).send('Bad Stuff Happend: ' + (error || body));
    });
});
app.get('/login-cookie/:q', function (req, res) {
    console.log(req.params);
    var id = req.params.q, url;
    url = COUCHDB + 'logins/_design/users/_view/by_id?key="' + id + '"';
    request(url, function (error, response, body) {
        if (!error && response.statusCode.toString().indexOf('2') === 0) {
            var users = JSON.parse(body).rows, user;
            if (!users.length) {
                return res.status(401).send('Invalid username');
            }
            user = users[0].value;
            if (!user) {
                res.status(401).send('Invalid password');
                return;
            }
            console.log('Id:', user.id);
            res.status(200).json(user);
            return;
        }
        console.log(error, response.responseCode, body);
        res.status(500).send('Bad Stuff Happend: ' + (error || body));
    });
});
app.post('/login', function (req, res) {
    console.log(req.body);
    ASQ(function (done) {
        request(COUCHDB + '_uuids', function (error, response, body) {
            if (!error && response.statusCode.toString().indexOf('2') === 0) {
                done(body);
                return;
            }
            done.fail('Error while getting: ' + COUCHDB + '_uuids' + ': ' + JSON.stringify({code: response.statusCode, error: error || body}));
        });
    }).debug('UUID').then(function (done, msg) {
        request.put({
            url: COUCHDB + 'logins/' + JSON.parse(msg).uuids[0],
            body: JSON.stringify(req.body),
            headers: {
                contentType: 'application/json'
            }
        }, function (error, response, body) {
            if (!error && response.statusCode.toString().indexOf('2') === 0) {
                done(body);
                return;
            }
            done.fail('Error while posting: ' + COUCHDB + 'logins/' + JSON.parse(msg).uuids[0] + ': ' + JSON.stringify({code: response.statusCode, error: error || body}));
        });
    }).debug('Response').then(function (done, msg) {
        console.log(msg);
        res.status(200).send(msg);
        done();
    }).or(function (err) {
        console.log(err);
        res.status(500).send('Error: ' + JSON.stringify(err));
    });
});
http.listen(3000, function (a, b, c, d) {
    console.log('Ready captain');
});
io.on('connection', function (socket) {
    socket.on('chat message', function (msg) {
        io.emit('chat message', msg);
    });
});
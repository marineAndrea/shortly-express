var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');

var session = require('express-session');
var cookie = require('cookie-parser');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'short_secret',
    name: 'short_secret',
    proxy: true,
    resave: true,
    saveUninitialized: false,
}));
app.use(cookie());

app.use(express.static(__dirname + '/public'));

app.get('/', util.restrict, 
function(req, res) {
  res.render('index');
});

app.get('/create', util.restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', util.restrict,
function(req, res) {
  util.getUserId(req.session.username)
  .then(function(id) {
    Links.reset().query('where', 'user_id', '=', id).fetch().then(function(links) {
      res.send(200, links.models);
    });
  });
});

app.get('/logout', 
function(req, res) {
  req.session.destroy(function() {
    res.redirect('/login');
  })
});


app.post('/links', util.restrict,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }
  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        // Once we have a new link to create, we need to get the current session
        // user id to add to the table as well
        util.getUserId(req.session.username)
        .then(function(id) {

          var link = new Link({
            url: uri,
            title: title,
            base_url: req.headers.origin,
            user_id: id
          });

          link.save().then(function(newLink) {
            Links.add(newLink);
            res.send(200, newLink);
          });
        });
        //

      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/


app.get('/login', function (req, res) {
  res.render('login');
});

app.get('/signup', function (req, res) {
  res.render('signup');
});

app.post('/login', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;

  // We query the database for user with username 
  new User( {username: username }).fetch().then(function(exists) {
    // If that user exists
    if (exists) {
      // we get the salt and user password
      var hash = exists.attributes.password;
      // then we has the password
      util.comparePassword(password, hash)
      .then(function(equal) {
        if (equal) {
          // We generate the session and redirect to main page
          req.session.regenerate(function () {
            req.session.username = username;
            res.redirect('/');
          })
        }
        else {
          // We stay on page
          console.log("failed password");
          res.redirect('/login');
        }
      })
      .catch(function(err) {
        console.log("THERE WAS AN ERROR ", err);
        res.status(404).end();
      })

    }
    else {
      // If the user doesn't exist, stay on login page
      res.redirect('/login');
    }
  });
  
});

app.post('/signup', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;

  // We check to see if the username already exists
  //app.userNameExists(username)
  new User({username: username}).fetch()
  .then(function(used) {
    if (!used) {

      new User({username:username, password: password}).save()
      .then(function() {
        res.redirect('/');
      });
    }
    else {
      // nothing happens
      console.log("ERROR - USERNAME ALREADY USED");
    }
  });

});



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);

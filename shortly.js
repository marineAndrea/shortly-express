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
    saveUninitialized: true,
}));
app.use(cookie());

app.use(express.static(__dirname + '/public'));

var restrict = function(req, res, next) {
  console.log(req.session);
  if (req.session.username) {
    next();
  } else {
    //res.session.error('Access denied');
    console.log("Restricted Access");
    res.redirect('/login');
  }
};

app.getSalt = function() {
  return new Promise(function(resolve, reject) {
    bcrypt.genSalt(10, function (err, salt) {
      if (err) reject(err);
      resolve(salt);
    })
  });
};

app.hashPassword = function(password, salt) {
  return new Promise(function(resolve, reject) {
    bcrypt.hash(password, salt, null, function (err, hash) {
      if (err) reject(err);
      resolve(hash);
    });
  });
};

app.comparePassword = function(password, hash) {
  return new Promise(function(resolve, reject) {
    bcrypt.compare(password, hash, function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

app.getUserId = function(username) {
  return new User({username: username}).fetch().then(function(exists) {
    return exists.attributes.id;
  })
};

app.userNameExists = function(username) {
  // returns true if username is already used in database
  return new User({username: username}).fetch().then(function(exists) {
    if (exists) {
      return true;
    }
    else {
      return false;
    }
  })
}

app.get('/', restrict, 
function(req, res) {
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', 
function(req, res) {
  app.getUserId(req.session.username)
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


app.post('/links', 
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

        //
        app.getUserId(req.session.username)
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
      console.log(exists.attributes.salt, " , ", exists.attributes.password);
      // we get the salt and user password
      var salt = exists.attributes.salt;
      var user_pass = exists.attributes.password;
      // then we has the password
      app.comparePassword(password, user_pass)
      .then(function(equal) {
        if (equal) {
          // We redirect to main page
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

    }
  });
  
});

app.post('/signup', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;


  app.userNameExists(username)
  .then(function(used) {
    if (!used) {
      
      app.getSalt()
      .then(function(salt){
        return app.hashPassword(password, salt)
        .then(function(hash) {
          return {salt: salt, hash: hash};
        });
      })
      .then(function(salt_hash) {
        console.log(username, " , ", salt_hash.hash, " , ", salt_hash.salt);
        new User({username: username, password: salt_hash.hash, salt: salt_hash.salt}).save();
        res.redirect('/login');
      });
    }
    else {
      // nothing happens
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

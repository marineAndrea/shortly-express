var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var morgan = require('morgan');

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
app.use(morgan('combined'));

app.use(express.static(__dirname + '/public'));

var restrict = function(req, res, next) {
  //console.log(req.session);
  //new User({username: 'Phillip', password: 'Phillip'}).save();;
  if (req.session.username) {
    console.log("Logged In as: ", req.session.username);
    next();
  } else {
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

app.comparePassword = function(password, hash, salt) {
  console.log("WE ARE COMPARING PASSWORDS: ", password, " THIS WAS THE HASH: ", hash);
  return new Promise(function(resolve, reject) {
    // bcrypt.compare(password, hash, function(err, res) {
    //   console.log("THIS WAS THE ERR: ", err, " THIS WAS THE RES: ", res);
    //   if (err) {
    //     reject(err);
    //   } else {
    //     resolve(res);
    //   }
    // });
    var attempt = bcrypt.hash(password, salt, null, function(err, attemptHash) {
      console.log("We have attempted to hash");
      if (err) reject(err);
      resolve(hash === attemptHash);
    })

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

app.get('/links', restrict,
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


app.post('/links', restrict,
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
    //console.log("laskdjf;alskdfj;asljfd;laskdf ----- ", exists);
    if (exists) {
      // we get the salt and user password
      var salt = exists.attributes.salt;
      var hash = exists.attributes.password;
      // then we has the password
      app.comparePassword(password, hash, salt)
      .then(function(equal) {
        console.log("WAS THIS EQUAL ", equal);
        if (equal) {
          // We generate the session and redirect to main page
          req.session.regenerate(function () {
            req.session.username = username;
            console.log("Logged in with: ", req.session.username);
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
        // First we create
        new User({username: username, password: password}).save()
        .then(function() {
          res.redirect('/');
        });
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

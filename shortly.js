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
  if (req.session.user) {
    next();
  } else {
    //res.session.error('Access denied');
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

app.get('/',
function(req, res) {
  res.render('index');
});

app.get('/create',
function(req, res) {
  res.render('index');
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
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

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
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


  // new User().fetchAll().then(function(found) {
  //   console.log(found);
  // }) 
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
  })
  

  // go to database, look for username
  //console.log(User);
  //console.log(test);
//   new Events()
// .query({where:{id: eventId}})
// .fetch({withRelated: [‘participants’], require: true})
// .then(function(collection) {
// return collection;
// });
  console.log(username);
  // new User({username: username})
  //   .fetch()
  //   .then(function(found) {
  //     if (found) {
  //       // get the salt
  //       var salt = found.attributes.salt;
  //       var user_password = found.attributes.password;
  //       // hash provided password + salt
  //       var hash = bcrypt.hash(password, salt);
  //       // check if hash is same as database password
  //       if (hash === user_password) {
  //         // create session
  //         req.session.regenerate(function() {
  //           req.session.username = username;
  //           res.redirect('/');
  //         });
  //       }
  //     }
  //   });
});

app.post('/signup', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User()
  // go to database, look for username
    .query('where', 'username', '=', username)
    .fetch()
    .then(function(found) {
      if (!found) {
        new User( {username: username, password: password} )
        .save()
        .then(function() {
          // remember to add user to users
          res.redirect('/');
        })
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

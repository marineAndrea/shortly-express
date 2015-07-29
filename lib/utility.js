var request = require('request');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var User = require('../app/models/user');

exports.getUrlTitle = function(url, cb) {
  request(url, function(err, res, html) {
    if (err) {
      console.log('Error reading url heading: ', err);
      return cb(err);
    } else {
      var tag = /<title>(.*)<\/title>/;
      var match = html.match(tag);
      var title = match ? match[1] : url;
      return cb(err, title);
    }
  });
};

var rValidUrl = /^(?!mailto:)(?:(?:https?|ftp):\/\/)?(?:\S+(?::\S*)?@)?(?:(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[0-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))|localhost)(?::\d{2,5})?(?:\/[^\s]*)?$/i;

exports.isValidUrl = function(url) {
  return url.match(rValidUrl);
};

/************************************************************/
// Add additional utility functions below
/************************************************************/

exports.comparePassword = function(password, hash) {
  return new Promise(function(resolve, reject) {
    bcrypt.compare(password, hash, function(err, res) {
      if (err) {
        reject(err);
      }
      else {
        resolve(res);
      }
    });
  });
};

exports.restrict = function (req, res, next) {
  if (req.session.username) {
    //console.log("Logged In as: ", req.session.username);
    next();
  } else {
    res.redirect('/login');
  }
}

exports.getUserId = function (username) {
  return new User({username: username}).fetch()
  .then(function(exists){
    return exists.attributes.id;
  });
}



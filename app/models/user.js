var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tablename: 'users',
  hasTimestamps: true,
  links: function() {
    return this.hasMany(Link);
  },
  initialize: function() {
    this.on('creating', function () {
      var salt = bcrypt.genSalt(10, function (err, salt) {
        var password = model.get('password');
        bcrypt.hash(password, salt, function(err, hash) {
          // put inside database
          model.set('password', hash);
          model.set('salt', salt);
        });
      });
    });
  },
});

module.exports = User;
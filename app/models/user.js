var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  // hasTimestamps: true,
  // links: function() {
  //   return this.hasMany(Link);
  // },
  initialize: function() {
    this.on('creating', function (model) {

      // we get the salt with context of this
      this.getSalt().bind(this)
      .then(function(salt) {
        // the we get the password
        var password = model.get('password');
        // next we get the hash from the password and salt
        return this.hashPassword(password, salt)
        .then(function(hash) {
          // Then we pass both salt and hash back up
          return {salt: salt, hash: hash};
        })
      })
      .then(function(salt_hash) {
        
        // We thus finalize the creating of the model
        model.set('salt', salt_hash.salt);
        model.set('password', salt_hash.hash);
      });

    });
    this.on('created', function(model) {
      // Once we have created the new model, we can then save it.
      model.save();
    })
  },

  getSalt : function() {
    return new Promise(function(resolve, reject) {
      bcrypt.genSalt(10, function (err, salt) {
        if (err) reject(err);
        resolve(salt);
      })
    });
  },

  hashPassword : function(password, salt) {
    return new Promise(function(resolve, reject) {
      bcrypt.hash(password, salt, null, function (err, hash) {
        if (err) reject(err);
        resolve(hash);
      });
    });
  },

});

module.exports = User;
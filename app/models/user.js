var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  // hasTimestamps: true,
  // links: function() {
  //   return this.hasMany(Link);
  // },
  // initialize: function() {
  //   this.on('creating', function (model) {

  //     this.getSalt().bind(this)
  //     .then(function(salt) {
  //       var password = model.get('password');
  //       return this.hashPassword(password, salt)
  //       .then(function(hash) {
  //         return {salt: salt, hash: hash};
  //       })
  //     })
  //     .then(function(salt_hash) {
  //       // return this.setProperty('salt', salt_hash.salt)
  //       //   .then(this.setProperty('hash', salt_hash.hash))
  //       console.log(salt_hash);
  //       model.set('salt', salt_hash.salt);
  //       model.set('password', salt_hash.hash);
  //       console.log("Salt is ", model.get('salt'));
  //     });
  //     // console.log("Model Reset");
  //     // var salt = bcrypt.genSalt(10, function (err, salt) {
  //     //   console.log("Salt Done");
  //     //   var password = model.get('password', function (password) {
  //     //     bcrypt.hash(password, salt, function (err, hash) {
  //     //       // put inside database
  //     //       console.log("Hash Done");
  //     //       model.set('password', hash);
  //     //       model.set('salt', salt);
  //     //     });
  //     //   });
  //     // });

  //   });
  // },

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
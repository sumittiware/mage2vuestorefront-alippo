"use strict";

var RestClient = require("./lib/rest_client").RestClient;
var categories = require("./lib/categories");
var courses = require("./lib/courses");

// TODO : npm packages are not added here!
module.exports.AlippoClient = function (options) {
  var instance = {};

  var client = RestClient(options);
  instance.categories = categories(client);
  instance.courses = courses(client);

  return instance;
};

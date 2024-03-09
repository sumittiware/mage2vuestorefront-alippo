"use strict";
let express = require("express");
let kue = require("kue");

let config = require("../../config");
let AdapterFactory = require("../../adapters/factory");
let factory = new AdapterFactory(config);

let router = express.Router();

// Once any entity is updated in the database the event will be triggered
// to add it to the elastic search
router.post("/update", function (req, res) {
  let skus_array = req.body.itmes;
  let type = req.body.type;

  console.log("Incoming pull request of ${type} for", skus_array);

  if (skus_array.length > 0) {
    let queue = kue.createQueue(
      Object.assign(config.kue, { redis: config.redis })
    );

    queue
      .createJob(type, { skus: skus_array, adapter: "alippo-search" })
      .save();
    res.json({
      status: "done",
      message: type + skus_array + " scheduled to be refreshed",
    });
  } else {
    res.json({
      status: "error",
      message: "Please provide ${type} SKU separated by comma",
    });
  }
});

module.exports = router;

var config = require("../../config");

module.exports = {
  CACHE_KEY_CATEGORY: config.db.indexName + "_cat_%s",
  CACHE_KEY_COURSE: config.db.indexName + "_cou_%s",
};

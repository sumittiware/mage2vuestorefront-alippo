const _slugify = require("./helpers/slugify");

module.exports = {
  kue: {}, // default KUE config works on local redis instance. See KUE docs for non standard redis connections

  db: {
    driver: "elasticsearch",
    url: process.env.DATABASE_URL || "http://localhost:9200",
    indexName: process.env.INDEX_NAME || "alippo_search",
  },

  elasticsearch: {
    apiVersion: process.env.ELASTICSEARCH_API_VERSION || "8.12.2",
  },

  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    auth: process.env.REDIS_AUTH || false,
    db: process.env.REDIS_DB || 0,
  },

  alippo: {
    url: process.env.ALIPPO_URL || "https://app-dev.alippo.com/api",
  },
};

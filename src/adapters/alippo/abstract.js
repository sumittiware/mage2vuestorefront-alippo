"use strict";

let AbstractAdapter = require("../abstract");

class AbstractAlippoAdapter extends AbstractAdapter {
  constructor(config) {
    super(config);

    let AlippoClient = require("./alippo-rest-client").AlippoClient;
    this.api = AlippoClient(this.config.alippo);
  }

  getEntityType() {
    throw new Error("getEntityType must be implemented");
  }

  getCollectionName() {
    return this.getEntityType();
  }

  validateConfig(config) {
    super.validateConfig(config);
  }

  isValidFor(entity_type) {
    return entity_type == this.getEntityType();
  }

  getSourceData() {
    throw new Error("getSourceData must be implemented");
  }

  getLabel(source_item) {
    return source_item.id;
  }

  /**
   * We're transorming the data structure of item to be compliant with Smile.fr Elastic Search Suite
   * @param {object} item  document to be updated in elastic search
   */
  normalizeDocumentFormat(item) {
    return item;
  }
}

module.exports = AbstractAlippoAdapter;

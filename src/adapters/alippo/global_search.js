"use strict";

let AbstractAlippoAdapter = require("./abstract");

// Implement this method in your adapter
// When will this be called?
class GlobalSearchAdapter extends AbstractAlippoAdapter {
  getEntityType() {
    return "global_search";
  }

  getName() {
    return "adapters/alippo/GlobalSearchAdapter";
  }

  getSourceData() {
    return new Promise((resolve, reject) => {
      resolve([
        {
          id: "3",
          title: "Title 3",
          description: "Description 3",
        },
        {
          id: "2",
          title: "Title 2",
          description: "Description 2",
        },
      ]);
    });
  }

  // TODO : Now we have to keep the data
  preProcessItem(item) {
    return new Promise((resolve, reject) => {
      resolve(item);
    });
  }

  normalizeDocumentFormat(item) {
    return item;
  }
}

module.exports = GlobalSearchAdapter;

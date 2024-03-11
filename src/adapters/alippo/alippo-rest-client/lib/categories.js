var util = require("util");

// TODO : update API's here based on the alippo's requirements
module.exports = function (restClient, endpoint) {
  var module = {};

  module.list = function () {
    return restClient.get("custom/categories");
  };

  module.getSingle = function (categoryId) {
    var endpointUrl = util.format("/categories/%d", categoryId);
    return restClient.get(endpointUrl);
  };

  module.create = function (categoryAttributes) {
    return restClient.post("/categories", categoryAttributes);
  };

  module.update = function (categoryId, categoryAttributes) {
    var endpointUrl = util.format("/categories/%d", categoryId);
    return restClient.put(endpointUrl, categoryAttributes);
  };

  module.delete = function (categoryId) {
    var endpointUrl = util.format("/categories/%d", categoryId);
    return restClient.delete(endpointUrl);
  };

  return module;
};

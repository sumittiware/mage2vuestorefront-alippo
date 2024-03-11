var util = require("util");
const logger = require("./log");

// TODO : update API's here based on the alippo's requirements for courses
module.exports = function (restClient, endpoint) {
  var module = {};

  module.list = function (query) {
    return new Promise((resolve, reject) => {
      restClient
        .get(`ui/page/COURSE_ROOT_PAGE?${query}`)
        .then((result) => {
          let coursesData = result.sections[0].payload.courses;

          res = {
            items: coursesData.content,
            total_count: coursesData.totalElements,
          };
          logger.info("Courses list", JSON.stringify(res));
          resolve(res);
        })
        .catch((err) => {
          reject(err);
        });
    });
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

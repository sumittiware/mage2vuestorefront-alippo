"use strict";

let AbstractMagentoAdapter = require("./abstract");
const CacheKeys = require("./cache_keys");
const util = require("util");
const request = require("request");
const _slugify = require("../../helpers/slugify");
const logger = require("../magento/magento2-rest-client/lib/log");

// const _normalizeExtendedData = function (
//   result,
//   generateUrlKey = true,
//   config = null
// ) {
//   if (result.custom_attributes) {
//     for (let customAttribute of result.custom_attributes) {
//       // map custom attributes directly to document root scope
//       result[customAttribute.attribute_code] = customAttribute.value;
//     }
//     delete result.custom_attributes;
//   }
//   if (generateUrlKey) {
//     result.url_key = _slugify(result.name) + "-" + result.id;
//   }
//   result.slug = result.url_key;
//   if (config.seo.useUrlDispatcher) {
//     result.url_path = config.seo.categoryUrlPathMapper(result);
//   } else {
//     result.url_path = result.url_key;
//   }
//   return result;
// };

class CategoryAdapter extends AbstractMagentoAdapter {
  constructor(config) {
    super(config);
  }

  getEntityType() {
    return "category";
  }

  getName() {
    return "adapters/alippo/CategoryAdapter";
  }

  getSourceData(context) {
    return this.api.categories.list().catch((err) => {
      throw new Error(err);
    });
  }

  prepareItems(items) {
    let sections = items.categories;

    logger.info("Sections : ", JSON.stringify(sections));

    return sections;
  }

  getTotalCount(context) {
    context = context
      ? Object.assign(context, { for_total_count: 1 })
      : { for_total_count: 1 };
    return this.getSourceData(context);
  }

  /**
   *
   * @param {Object} item
   */
  // For the items we need to the
  // If in future any preprocessing is required we can do it here
  // for now since we will be storing the direct data which is coming from the source
  preProcessItem(item) {
    return new Promise((resolve, reject) => {
      resolve(item);
    });
  }

  /**
   * We're transorming the data structure of item to be compliant with Smile.fr Elastic Search Suite
   * @param {object} item  document to be updated in elastic search
   */
  normalizeDocumentFormat(item) {
    return item;
  }
}

module.exports = CategoryAdapter;

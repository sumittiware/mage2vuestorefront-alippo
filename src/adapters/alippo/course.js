"use strict";

let AbstractAlippoAdapter = require("./abstract");
const util = require("util");
const CacheKeys = require("./cache_keys");
const moment = require("moment");
const _ = require("lodash");
const request = require("request");
const HTTP_RETRIES = 3;
let kue = require("kue");
const _slugify = require("../../helpers/slugify");
const logger = require("./alippo-rest-client/lib/log");

/*
 * serial executes Promises sequentially.
 * @param {funcs} An array of funcs that return promises.
 * @example
 * const urls = ['/url1', '/url2', '/url3']
 * serial(urls.map(url => () => $.ajax(url)))
 *     .then(console.log(console))
 */
const serial = (funcs) =>
  funcs.reduce(
    (promise, func) =>
      promise.then((result) =>
        func().then(Array.prototype.concat.bind(result))
      ),
    Promise.resolve([])
  );

const optionLabel = (attr, optionId) => {
  if (attr) {
    let opt = attr.options.find((op) => {
      // TODO: cache it in memory
      if (_.toString(op.value) === _.toString(optionId)) {
        return op;
      }
    }); // TODO: i18n support with multi website attribute names
    return opt ? opt.label : optionId;
  } else {
    return optionId;
  }
};

class CourseAdapter extends AbstractAlippoAdapter {
  constructor(config) {
    super(config);
    this.use_paging = true;
    this.is_federated = true; // by default use federated behaviour
  }

  getEntityType() {
    return "course";
  }

  getName() {
    return "adapters/alippo/CourseAdapter";
  }

  getFilterQuery(context) {
    let query = "";

    query += "sectionNames.equals=ALL_COURSES_SUMMARY_SECTION&";
    query += `section1Size.equals=${context.page_size}&`;
    query += `section1Page.equals=${context.page}`;

    return query;
  }

  prepareItems(items) {
    if (!items) return null;

    this.total_count = items.total_count;

    if (this.use_paging) {
      this.page_count = Math.ceil(this.total_count / this.page_size);
      logger.info("Page count", this.page_count);
    }

    return items.items;
  }

  getSourceData(context) {
    const retryHandler = (context, err, reject) => {
      context.retry_count = context.retry_count ? context.retry_count + 1 : 1;
      if (err == null || context.retry_count < HTTP_RETRIES) {
        if (err) {
          logger.error(err);
          logger.info(
            "Retrying getSourceData() request " + context.retry_count
          );
        }

        if (this.config.course) {
          return new Promise((resolve, reject) => {
            this.getCourseSourceData(context)
              .then((result) => {
                resolve(result);
              })
              .catch((err) => {
                retryHandler(context, err, reject);
              });
          });
        } else {
          return this.getCourseSourceData(context).catch((err) => {
            retryHandler(context, err, null);
          });
        }
      } else {
        if (reject) {
          reject(err);
        } else {
          throw err;
        }
      }
    };

    // run the import logick
    return retryHandler(context, null, null);
  }

  getCourseSourceData(context) {
    let query = this.getFilterQuery(context);
    return this.api.courses.list(query).catch((err) => {
      throw new Error(err);
    });
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
      if (!item) {
        reject(item);
      }
      item.id = item.courseId;
      item.courseId = null;
      resolve(item);
    });
  }

  /**
   * We're transorming the data structure of item to be compliant with Smile.fr Elastic Search Suite
   * @param {object} item  document to be updated in elastic search
   */
  normalizeDocumentFormat(item) {
    let prices = new Array();

    /*for (let priceTag of item.tier_prices) {
      prices.push({
        "price": priceTag.value,
        "original_price": priceTag.original_price,
        "customer_group_id": priceTag.customerGroupId,
        "qty": priceTag.qty
      });
    }*/

    if (
      this.config.vuestorefront &&
      this.config.vuestorefront.invalidateCache
    ) {
      request(
        this.config.vuestorefront.invalidateCacheUrl + "P" + item.id,
        {},
        (err, res, body) => {
          if (err) {
            return console.error(err);
          }
          try {
            if (body && JSON.parse(body).code !== 200) console.log(body);
          } catch (e) {
            return console.error(
              "Invalid Cache Invalidation response format",
              e
            );
          }
        }
      );
    }

    let resultItem = Object.assign(item, {
      // "price": prices, // ES stores prices differently
      // TODO: HOW TO GET product stock from Magento API call for product?
    });
    return resultItem;
  }
}

module.exports = CourseAdapter;

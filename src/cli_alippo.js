"use strict";

const program = require("commander");
const fs = require("fs");
const path = require("path");
let AdapterFactory = require("./adapters/factory");

const TIME_TO_EXIT = process.env.TIME_TO_EXIT
  ? process.env.TIME_TO_EXIT
  : 30000; // wait 30s before quiting after task is done

let config = require("./config");
let logger = require("./log");
let factory = new AdapterFactory(config);
const jsonFile = require("jsonfile");
const INDEX_META_PATH = process.env.INDEX_META_PATH
  ? path.join("tmp", process.env.INDEX_META_PATH)
  : path.join("tmp", ".lastIndex.json");

let kue = require("kue");
let queue = kue.createQueue(Object.assign(config.kue, { redis: config.redis }));

const _handleBoolParam = (value) => {
  return JSON.parse(value);
};

const reindexCategories = (
  adapterName,
  removeNonExistent,
  extendedCategories,
  generateUniqueUrlKeys
) => {
  removeNonExistent = _handleBoolParam(removeNonExistent);
  extendedCategories = _handleBoolParam(extendedCategories);
  generateUniqueUrlKeys = _handleBoolParam(generateUniqueUrlKeys);

  return new Promise((resolve, reject) => {
    let adapter = factory.getAdapter(adapterName, "category");
    let tsk = new Date().getTime();

    adapter.run({
      transaction_key: tsk,
      extendedCategories: extendedCategories,
      generateUniqueUrlKeys: generateUniqueUrlKeys,
      done_callback: () => {
        if (removeNonExistent) {
          adapter.cleanUp(tsk);
        }

        logger.info("Task done! Exiting in 30s...");
        setTimeout(process.exit, TIME_TO_EXIT); // let ES commit all changes made
        resolve();
      },
    });
  });
};

function reindexCourses(
  adapterName,
  removeNonExistent,
  partitions,
  partitionSize,
  initQueue,
  skus,
  updatedAfter = null,
  page = null
) {
  removeNonExistent = _handleBoolParam(removeNonExistent);
  initQueue = _handleBoolParam(initQueue);

  let adapter = factory.getAdapter(adapterName, "course");

  if (updatedAfter) {
    logger.info("Delta indexer started for", updatedAfter);
  }

  let tsk = new Date().getTime();

  if (partitions > 1 && adapter.isFederated()) {
    let partition_count = partitions;

    logger.info(
      `Running in MPM (Multi Process Mode) with partitions count = ${partition_count}`
    );

    adapter.getTotalCount({ updated_after: updatedAfter }).then((result) => {
      let total_count = result.total_count;
      let page_size = partitionSize;
      let page_count = Math.ceil(total_count / page_size);

      let transaction_key = new Date().getTime();

      if (initQueue) {
        logger.info("Propagating job queue... ");

        for (let i = 1; i <= page_count; i++) {
          logger.debug(
            `Adding job for: ${i} / ${page_count}, page_size = ${page_size}`
          );
          queue
            .createJob("courses", {
              page_size: page_size,
              page: i,
              updated_after: updatedAfter,
            })
            .save();
        }
      } else {
        logger.info("Not propagating queue - only worker mode!");
      }

      // TODO: separate the execution part to run in multi-tenant env
      // Handle the pagination in this case
      queue.process("courses", partition_count, (job, done) => {
        let adapter = factory.getAdapter(adapterName, "course");
        if (job && job.data.page && job.data.page_size) {
          logger.info(`Processing job: ${job.data.page}`);

          adapter.run({
            transaction_key: transaction_key,
            page_size: job.data.page_size,
            page: job.data.page,
            parent_sync: job.data.updatedAfter !== null,
            updated_after: job.data.updatedAfter,
            done_callback: () => {
              logger.info("Task done!");
              return done();
            },
          });
        } else return done();
      });

      if (initQueue) {
        // if this is not true it meant that process is runing to process the queue in the loop and shouldnt be "killed"
        setInterval(() => {
          queue.inactiveCount((err, total) => {
            // others are activeCount, completeCount, failedCount, delayedCount
            if (total == 0) {
              if (removeNonExistent) {
                logger.info("CleaningUp courses!");
                let adapter = factory.getAdapter(adapterName, "course");
                adapter.cleanUp(transaction_key);
              }

              logger.info("Queue processed. Exiting!");
              setTimeout(process.exit, TIME_TO_EXIT); // let ES commit all changes made
            }
          });
        }, 2000);
      }
    });
  } else {
    logger.info("Running in SPM (Single Process Mode)");
    let context = {
      page: page !== null ? parseInt(page) : null,
      page_size: partitionSize,
      use_paging: true,
      updated_after: updatedAfter,
      transaction_key: tsk,
      parent_sync: updatedAfter !== null,
      done_callback: () => {
        if (removeNonExistent) {
          adapter.cleanUp(tsk);
        }
        logger.info("Task done! Exiting in 30s...");
        setTimeout(process.exit, TIME_TO_EXIT); // let ES commit all changes made
      },
    };
    if (page !== null) logger.info("Current page is: ", page, partitionSize);
    if (skus) {
      context.skus = skus.split(","); // update individual producs
      context.parent_sync = true;
    }

    adapter.run(context);
  }
}

const reindexGlobal = (
  adapterName,
  removeNonExistent,
  extendedCategories,
  generateUniqueUrlKeys
) => {
  removeNonExistent = _handleBoolParam(removeNonExistent);
  extendedCategories = _handleBoolParam(extendedCategories);
  generateUniqueUrlKeys = _handleBoolParam(generateUniqueUrlKeys);

  return new Promise((resolve, reject) => {
    let adapter = factory.getAdapter(adapterName, "global_search");
    let tsk = new Date().getTime();

    adapter.run({
      transaction_key: tsk,
      extendedCategories: extendedCategories,
      generateUniqueUrlKeys: generateUniqueUrlKeys,
      done_callback: () => {
        if (removeNonExistent) {
          adapter.cleanUp(tsk);
        }

        logger.info("Task done! Exiting in 30s...");
        setTimeout(process.exit, TIME_TO_EXIT); // let ES commit all changes made
        resolve();
      },
    });
  });
};

function cleanup(adapterName, cleanupType, transactionKey) {
  let adapter = factory.getAdapter(adapterName, cleanupType);
  let tsk = transactionKey;

  if (tsk) {
    logger.info("Cleaning up for TRANSACTION KEY = " + tsk);
    adapter.connect;
    adapter.cleanUp(tsk);
  } else {
    logger.error('No "transactionKey" given as a parameter');
  }
}

function fullReindex(
  adapterName,
  removeNonExistent,
  partitions,
  partitionSize,
  initQueue,
  skus,
  extendedCategories,
  generateUniqueUrlKeys
) {
  // The sequence is important because commands operate on some cache resources - especially for product/category assignments
  Promise.all([
    reindexCategories(
      adapterName,
      removeNonExistent,
      extendedCategories,
      generateUniqueUrlKeys
    ),
    reindexCourses(adapterName),
  ])
    .then((results) => {
      logger.info("Starting full courses reindex!");
      reindexCourses(
        adapterName,
        removeNonExistent,
        partitions,
        partitionSize,
        initQueue,
        skus
      ); //4. It indexes all the products
    })
    .catch((err) => {
      logger.error(err);
      process.exit(1);
    });
}

/**
 * Run worker listening to "course" command on KUE queue
 */
function runProductsworker(adapterName, partitions) {
  logger.info("Starting `courseworker` worker. Waiting for jobs ...");
  let partition_count = partitions;

  // TODO: separte the execution part to run in multi-tenant env
  queue.process("course", partition_count, (job, done) => {
    if (job && job.data.skus && Array.isArray(job.data.skus)) {
      logger.info("Starting course pull job for " + job.data.skus.join(","));

      let adapter = factory.getAdapter(
        job.data.adapter ? job.data.adapter : adapterName,
        "course"
      );

      adapter.run({
        skus: job.data.skus,
        parent_sync: true,
        done_callback: () => {
          logger.info("Task done!");
          return done();
        },
      });
    } else return done();
  });
}

/**
 * TODO : Understand the use of the flags here, in all the commands
 **/
program
  .command("categories")
  .option("--adapter <adapter>", "name of the adapter", "alippo")
  .option(
    "--removeNonExistent <removeNonExistent>",
    "remove non existent products",
    false
  )
  .option(
    "--extendedCategories <extendedCategories>",
    "extended categories import",
    true
  )
  .option(
    "--generateUniqueUrlKeys <generateUniqueUrlKeys>",
    "make sure that category url keys are uniqe",
    true
  )
  .action(async (cmd) => {
    await reindexCategories(
      cmd.adapter,
      cmd.removeNonExistent,
      cmd.extendedCategories,
      cmd.generateUniqueUrlKeys
    );
  });

program
  .command("courses")
  .option("--adapter <adapter>", "name of the adapter", "alippo")
  .option("--partitions <partitions>", "number of partitions", 1)
  .option("--partitionSize <partitionSize>", "size of the partitions", 50)
  .option("--initQueue <initQueue>", "use the queue", true)
  .option(
    "--skus <skus>",
    "comma delimited list of SKUs to fetch fresh informations from",
    ""
  )
  .option(
    "--removeNonExistent <removeNonExistent>",
    "remove non existent products",
    false
  )
  .option(
    "--updatedAfter <updatedAfter>",
    "timestamp to start the synchronization from",
    ""
  )
  .option("--page <page>", "start from specific page", null)
  .action((cmd) => {
    if (cmd.updatedAfter) {
      reindexCourses(
        cmd.adapter,
        cmd.removeNonExistent,
        cmd.partitions,
        cmd.partitionSize,
        cmd.initQueue,
        cmd.skus,
        new Date(cmd.updatedAfter),
        cmd.page
      );
    } else {
      reindexCourses(
        cmd.adapter,
        cmd.removeNonExistent,
        cmd.partitions,
        cmd.partitionSize,
        cmd.initQueue,
        cmd.skus,
        null,
        cmd.page
      );
    }
  });

program
  .command("global")
  .option("--adapter <adapter>", "name of the adapter", "alippo")
  .option(
    "--removeNonExistent <removeNonExistent>",
    "remove non existent products",
    false
  )
  .option(
    "--extendedCategories <extendedCategories>",
    "extended categories import",
    true
  )
  .option(
    "--generateUniqueUrlKeys <generateUniqueUrlKeys>",
    "make sure that category url keys are uniqe",
    true
  )
  .action(async (cmd) => {
    await reindexGlobal(
      cmd.adapter,
      cmd.removeNonExistent,
      cmd.extendedCategories,
      cmd.generateUniqueUrlKeys
    );
  });

program
  .command("fullreindex")
  .option("--adapter <adapter>", "name of the adapter", "alippo")
  .option("--partitions <partitions>", "number of partitions", 1)
  .option("--partitionSize <partitionSize>", "size of the partitions", 50)
  .option("--initQueue <initQueue>", "use the queue", true)
  .option(
    "--skus <skus>",
    "comma delimited list of SKUs to fetch fresh informations from",
    ""
  )
  .option(
    "--extendedCategories <extendedCategories>",
    "extended categories import",
    true
  )
  .option(
    "--generateUniqueUrlKeys <generateUniqueUrlKeys>",
    "generate unique url_keys",
    true
  )
  .action((cmd) => {
    fullReindex(
      cmd.adapter,
      true,
      cmd.partitions,
      cmd.partitionSize,
      cmd.initQueue,
      cmd.skus,
      cmd.extendedCategories,
      cmd.generateUniqueUrlKeys
    );
  });

program
  .command("productsworker")
  .option("--adapter <adapter>", "name of the adapter", "alippo")
  .option("--partitions <partitions>", "number of partitions", 1)
  .action((cmd) => {
    runProductsworker(cmd.adapter, cmd.partitions);
  });

program
  .command("cleanup")
  .option("--adapter <adapter>", "name of the adapter", "alippo")
  .option(
    "--cleanupType <cleanupType>",
    "type of the entity to clean up: product|category",
    "product"
  )
  .option("--transactionKey <transactionKey>", "transaction key", 0)
  .action((cmd) => {
    cleanup(cmd.adapter, cmd.cleanupType, cmd.transactionKey);
  });

program.on("command:*", () => {
  console.error(
    "Invalid command: %s\nSee --help for a list of available commands.",
    program.args.join(" ")
  );
  process.exit(1);
});

program.parse(process.argv);

process.on("unhandledRejection", (reason, p) => {
  logger.error("Unhandled Rejection at: Promise", p, "reason:", reason);
  // application specific logging, throwing an error, or other logic here
});

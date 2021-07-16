/*
 * @prettier
 */

'use strict';

const _ = require(`lodash`);

const DocumentsDatasets = require(`../../models/documents.datasets.js`);

let Self = {};

// Dataset Status
Self.status = {
  valid: `valid`,
  saved: `saved`
};

/**
 * Check validation of datasets
 * @param {object} opts.data - Options available
 * @param {string} opts.data.id - Datasets id
 * @param {function} cb - Callback function(err, res) (err: error process OR null, res: true if it can be validated OR false)
 * @returns {undefined} undefined
 */
Self.checkValidation = function (opts = {}, cb) {
  if (typeof _.get(opts, `data`) === `undefined`) return cb(new Error(`Missing required data: opts.data`));
  if (typeof _.get(opts, `data.id`) === `undefined`) return cb(new Error(`Missing required data: opts.data.id`));
  // Init transaction
  let transaction = DocumentsDatasets.findOne({ _id: opts.data.id });
  // Execute transaction
  return transaction.exec(function (err, datasets) {
    if (err) return cb(err);
    else if (!datasets) return cb(true);
    let result = true;
    for (let i = 0; i < datasets.current.length; i++) {
      if (datasets.current[i].status !== Self.status.valid) {
        result = false;
        break;
      }
    }
    return cb(null, result);
  });
};

/**
 * Create new dataset JSON object
 * @param {object} opts - JSON containing all data
 * @param {string} opts.id - Dataset id
 * @param {string} opts.dataInstance - DataInstance id
 * @param {string} opts.reuse - Dataset reuse
 * @param {string} opts.notification - Dataset notification
 * @param {string} opts.cert - Dataset cert value (between 0 and 1)
 * @param {string} opts.dataType - Dataset dataType
 * @param {string} opts.subType - Dataset subType
 * @param {string} opts.description - Dataset description
 * @param {string} opts.bestDataFormatForSharing - Dataset best data format for sharing
 * @param {string} opts.mostSuitableRepositories - Dataset most suitable repositories
 * @param {string} opts.DOI - Dataset DOI
 * @param {string} opts.name - Dataset name
 * @param {string} opts.comments - Dataset comments
 * @returns {object} opts - JSON containing all data
 */
Self.createDataset = function (opts = {}) {
  return {
    id: opts.id, // id
    dataInstanceId: opts.dataInstanceId, // dataInstance id
    sentences: Array.isArray(opts.sentences) ? opts.sentences : [], // sentences
    reuse: opts.reuse ? opts.reuse : false, // dataset reuse
    highlight: opts.highlight ? opts.highlight : false, // dataset highlight
    notification: opts.notification ? opts.notification : ``, // dataset notification
    cert: opts.cert ? opts.cert : 0, // cert value (between 0 and 1)
    dataType: opts.dataType ? opts.dataType : ``, // dataType
    subType: opts.subType ? opts.subType : ``, //  subType
    description: opts.description ? opts.description : ``, // description
    bestDataFormatForSharing: opts.bestDataFormatForSharing ? opts.bestDataFormatForSharing : ``, // best data format for sharing
    bestPracticeForIndicatingReUseOfExistingData: opts.bestPracticeForIndicatingReUseOfExistingData
      ? opts.bestPracticeForIndicatingReUseOfExistingData
      : ``, // best practice for indicating re-use of existing data
    mostSuitableRepositories: opts.mostSuitableRepositories ? opts.mostSuitableRepositories : ``, // most suitable repositories
    DOI: opts.DOI ? opts.DOI : ``, // DOI
    name: opts.name ? opts.name : ``, // name
    comments: opts.comments ? opts.comments : ``, // comments
    status: opts.dataType && opts.name && (opts.DOI || opts.comments) ? Self.status.valid : Self.status.saved // status of the dataset
  };
};

/**
 * Get summary of datasets
 * @param {array} datasetsInfos - Array of datasetsInfos
 * @param {object} dataTypes - All dataTypes
 * @returns {array} summary
 */
Self.getSummary = function (datasetsInfos = [], dataTypes = {}) {
  let data = {};
  let result = [];
  datasetsInfos.reduce(function (acc, item) {
    if (typeof acc[item.dataType] === `undefined`)
      acc[item.dataType] = {
        key: item.dataType,
        count: 0,
        list: [],
        type: Self.getDataTypeInfos({ dataType: item.dataType }, dataTypes),
        subTypes: {}
      };
    acc[item.dataType].count++;
    acc[item.dataType].list.push(item);
    if (item.subType) {
      if (typeof acc[item.dataType].subTypes[item.subType] === `undefined`)
        acc[item.dataType].subTypes[item.subType] = { key: item.subType, type: item.type, count: 0 };
      acc[item.dataType].subTypes[item.subType].count++;
    }
    return acc;
  }, data);
  for (let key in data) {
    let item = {
      key: data[key].key,
      count: data[key].count,
      type: data[key].type,
      subTypes: [],
      list: data[key].list
    };
    for (let k in data[key].subTypes) {
      item.subTypes.push(data[key].subTypes[k]);
    }
    result.push(item);
  }
  return result;
};

module.exports = Self;

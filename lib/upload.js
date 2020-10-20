/*
 * @prettier
 */

const request = require('request'),
  conf = require('../conf/conf.json'),
  extractor = require('../lib/extractor.js'),
  Documents = require('../models/documents.js');

const object = {};

object.processFile = function(file, calledProcess, dataTypes, user, cb) {
  extractor.init(dataTypes);
  if (!file) return cb({ 'msg': 'No files were uploaded' });
  if (!file.mimetype) return cb({ 'filename': file.name, 'msg': 'Mimetype unknow' });
  if (file.mimetype !== 'text/xml' && file.mimetype !== 'application/pdf')
    return cb({ 'filename': file.name, 'msg': 'Mimetype must be text/xml or application/pdf' });
  // case send file will be not process
  if (!calledProcess) {
    return object.buildDocument(file.name, file.data, user, cb);
  }
  // case send file will be send to dataseer-ml
  if (calledProcess === 'dataseer-ml') {
    return object.callDataseerML(file, function(err, res) {
      if (err) return cb(err);
      return object.buildDocument(file.name, res, user, cb);
    });
  } else return cb('unknow calledProcess');
};

object.callDataseerML = function(file, cb) {
  let dataseerURL = '';
  if (file.mimetype === 'text/xml') dataseerURL = '/processDataseerTEI';
  else if (file.mimetype === 'application/pdf') dataseerURL = '/processDataseerPDF';
  else return cb({ 'filename': file.name, 'msg': 'Application do not handle this mimetype : ' + file.mimetype });
  return request.post(
    {
      'headers': {
        'enctype': 'multipart/form-data'
      },
      'url': conf.services['dataseer-ml'] + dataseerURL,
      'formData': {
        'input': {
          'value': file.data,
          'options': {
            'filename': file.name,
            'contentType': file.mimetype
          }
        }
      }
    },
    function(error, response, body) {
      if (!error && response.statusCode == 200) {
        return cb(null, { 'file': file, 'pdf': file.data, 'xml': body });
      } else if (error) {
        return cb({ 'filename': file.name, 'msg': error.toString() });
      } else {
        return cb({ 'filename': file.name, 'msg': 'unspecified error' });
      }
    }
  );
};

object.buildDocument = function(name, data, user, cb) {
  return extractor.getNewDocumentFromFile(data, extractor.types.TEI, user, function(err, res) {
    if (err) return cb({ 'filename': name, 'msg': err.toString() });
    Documents.create(res, function(err, post) {
      if (err) return cb({ 'filename': name, 'msg': err.toString() });
      return cb(null, { 'filename': name, 'document': post });
    });
  });
};

module.exports = object;

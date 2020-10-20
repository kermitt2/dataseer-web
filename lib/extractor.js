/*
 * @prettier
 */

const cheerio = require('cheerio'),
  mongoose = require('mongoose'),
  stream = require('stream'),
  DATATYPE_SEPARATOR = ':';

const gridfs = require('mongoose-gridfs');

let object = {};

/**
 * @param binary Buffer
 * returns readableInstanceStream stream.Readable
 */
function bufferToStream(binary) {
  const readableInstanceStream = new stream.Readable({
    read() {
      this.push(binary);
      this.push(null);
    }
  });

  return readableInstanceStream;
}

// Type of source file
object.types = { 'TEI': 'TEI' };

// init extractor with data
object.init = function(data) {
  object.subTypes = data.subTypes;
  object.dataTypes = data.dataTypes;
  object.metadata = data.metadata;
};

// Selectors of each data (datasets & metadata)
object.selectors = {
  'TEI': {
    'datasets': function($) {
      let result = {};
      $('div[subtype=dataseer] s[id]')
        .map(function(i, el) {
          // this === el
          let element = $(el),
            lowerType = element.attr('type', element.attr('type').toLowerCase()), // lowercase to match with metadata returned by dataseer-ml
            id = element.attr('id'),
            sentenceId = element.attr('sentenceId'),
            type = element.attr('type'),
            cert = element.attr('cert') ? element.attr('cert') : '0',
            dataType = object.getDataTypesOf(type);
          result[id] = {
            'id': id,
            'sentenceId': sentenceId,
            'cert': cert,
            'dataType': dataType.dataType,
            'subType': dataType.subType ? dataType.subType : '',
            'description': dataType.description ? dataType.description : '',
            'bestDataFormatForSharing': dataType.bestDataFormatForSharing ? dataType.bestDataFormatForSharing : '',
            'mostSuitableRepositories': dataType.mostSuitableRepositories ? dataType.mostSuitableRepositories : '',
            'DOI': '',
            'name': '',
            'comments': '',
            'text': element.text(),
            'status': 'saved'
          };
          return result[id];
        })
        .get();
      return result;
    }, // text, cert
    'metadata': {
      'articleTitle': function($) {
        return $('TEI > teiHeader > fileDesc > titleStmt > title').text();
      },
      'journal': function($) {
        return $('TEI > teiHeader > fileDesc > publicationStmt > publisher').text();
      },
      'manuscriptId': function($) {
        return $('TEI > teiHeader > fileDesc > sourceDesc > biblStruct > analytic > idno[type=publisher-id]').text();
      },
      'submittingAuthor': function($) {
        return '';
      },
      'submittingAuthoremail': function($) {
        return '';
      },
      'authors': function($) {
        return $('TEI > teiHeader > fileDesc > sourceDesc > biblStruct > analytic > author > persName')
          .map(function(i, el) {
            return (
              $(el)
                .find('surname')
                .text() +
              ' ' +
              $(el)
                .find('forename')
                .text()
            );
          })
          .get();
      },
      'funders': function($) {
        return 'No special funders';
      },
      'institutions': function($) {
        return $(
          'TEI > teiHeader > fileDesc > sourceDesc > biblStruct > analytic > author affiliation address addrLine'
        )
          .map(function(i, el) {
            return $(el).text();
          })
          .get();
      },
      'doi': function($) {
        return '';
      },
      'pmid': function($) {
        return '';
      }
    }
  }
};

// Parse data (transform urls)
object.parseUrls = function(data) {
  if (typeof data !== 'string') return data;
  let begin = data.indexOf('[['),
    end = data.indexOf(']]'),
    replaceUrl = function(str, url) {
      let split = url.split('|'),
        href = split[0],
        txt = split.length === 2 ? split[1] : href;
      str = str.replace('[[' + url + ']]', '<a href="' + href + '">' + txt + '</a>');
      return str;
    };
  while (begin > 0 && end > 0) {
    data = replaceUrl(data, data.substring(begin + 2, end));
    begin = data.indexOf('[[');
    end = data.indexOf(']]');
  }
  return data;
};

/**
 * Build dataTypes with data from dataseerML service
 * @param {Object} data data from dataseerML service
 * @return {Object} Objet JSON Object of dataTypes
 */
object.buildDataTypes = function(data) {
  // extract all dataTypes & subTypes of an object
  const properties = { 'mesh_id': true, 'url': true, 'description': true, 'count': true, 'label': true },
    extractDataTypes = function(key, obj, result, parent, deep = 0) {
      let keys = Object.keys(obj);
      result.metadata[key] = {
        'mesh_id': obj.mesh_id,
        'url': obj.url,
        'description': object.parseUrls(obj.description),
        'bestDataFormatForSharing': object.parseUrls(obj.best_practice),
        'mostSuitableRepositories': object.parseUrls(obj.most_suitable_repositories),
        'label': obj.label,
        'count': obj.count
      };
      if (typeof parent !== 'undefined') {
        if (typeof result.dataTypes[parent] === 'undefined') result.dataTypes[parent] = [];
        result.dataTypes[parent].push(key);
        result.subTypes[key] = parent;
      } else if (typeof result.dataTypes[key] === 'undefined') result.dataTypes[key] = [];
      for (let i = 0; i < keys.length; i++) {
        if (typeof properties[keys[i]] === 'undefined' && typeof obj[keys[i]] === 'object') {
          extractDataTypes(keys[i], obj[keys[i]], result, deep > 1 ? key + ':' + keys[i] : key, deep + 1);
        }
      }
    };
  let result = {
      'subTypes': {},
      'dataTypes': {},
      'metadata': {}
    },
    keys = Object.keys(data);
  for (let i = 0; i < keys.length; i++) {
    extractDataTypes(keys[i], data[keys[i]], result);
  }
  return result;
};

/**
 * Get dataType corresponding with a given type
 * @param {String} type Type attribute of dataset
 * @return {Object} Objet JSON Object of dataType or null
 */
object.getDataTypesOf = function(type) {
  let result = {
      'dataType': '',
      'subType': '',
      'description': '',
      'bestDataFormatForSharing': '',
      'mostSuitableRepositories': ''
    },
    indexOfSeparator = type.indexOf(DATATYPE_SEPARATOR);
  if (typeof type === 'undefined') return result;
  else if (indexOfSeparator > -1) {
    // case there is dataType & subtype
    let dataType = type.substr(0, indexOfSeparator),
      subtype = type.substr(indexOfSeparator + DATATYPE_SEPARATOR.length);
    if (typeof object.dataTypes[dataType] !== 'undefined') {
      result.dataType = dataType;
    } else console.log('type unknow : ' + type);
    if (typeof object.subTypes[subtype] !== 'undefined') {
      result.subType = subtype;
    } else console.log('subtype unknow : ' + subtype);
    if (typeof object.metadata[subtype] !== 'undefined') {
      result.description = object.metadata[subtype].description;
      result.bestDataFormatForSharing = object.metadata[subtype].bestDataFormatForSharing;
      result.mostSuitableRepositories = object.metadata[subtype].mostSuitableRepositories;
    } else if (typeof object.metadata[dataType] !== 'undefined') {
      result.description = object.metadata[dataType].description;
      result.bestDataFormatForSharing = object.metadata[dataType].bestDataFormatForSharing;
      result.mostSuitableRepositories = object.metadata[dataType].mostSuitableRepositories;
    } else console.log('subtype unknow : ' + subtype);
  } else {
    // case there is dataType & not subtype
    if (typeof object.dataTypes[type] !== 'undefined') {
      result.dataType = type;
    } else console.log('type unknow : ' + type);
    if (typeof object.metadata[type] !== 'undefined') {
      result.description = object.metadata[type].description;
      result.bestDataFormatForSharing = object.metadata[type].bestDataFormatForSharing;
      result.mostSuitableRepositories = object.metadata[type].mostSuitableRepositories;
    } else console.log('metadata of type : ' + type + ' unknow');
  }
  return result;
};
/**
 * Build a Document Object with extrated data of file
 * @param {Object} res Object representation of file
 * @param {String} type Type of document (use object.selectors to spécify what kind of document will be processed)
 * @return {Object} Objet JSON Object of Document or null
 */
object.getNewDocumentFromFile = function(res, type, user, cb) {
  const Pdf = gridfs.createModel({
    modelName: 'Pdf',
    connection: mongoose.connection
  });
  const readStream = bufferToStream(res.pdf);
  const options = { filename: res.file.name, contentType: res.file.mimetype };
  Pdf.write(options, readStream, (error, file) => {
    if (error) return cb(error, null);
    let xmlStr = res.xml.toString('utf8'),
      $ = object.load(xmlStr.replace(/\n\s*/gm, '')),
      metadata = object.extractMetadata($, type),
      sentences = { 'chunks': [], 'mapping': {} },
      coords = $('TEI s[coords]')
        .map(function(i, el) {
          $(el).attr('sentenceId', i);
          return {
            'coords': $(el)
              .attr('coords')
              .toString(),
            'datasetId': $(el).attr('id')
          };
        })
        .get()
        .reduce(function(acc, sentence, index, arr) {
          sentences.mapping[index] = [];
          let data = sentence.coords.split(';');
          for (let i = 0; i < data.length; i++) {
            let parts = data[i].split(',');
            sentences.mapping[index].push(acc.length);
            acc.push({
              'index': acc.length,
              'p': parts[0],
              'x': parts[1],
              'y': parts[2],
              'w': parts[3],
              'h': parts[4],
              'sentenceId': index,
              'datasetId': sentence.datasetId
            });
          }
          return acc;
        }, sentences.chunks),
      datasets = object.extractDatasets($, type),
      result = {
        '_id': mongoose.Types.ObjectId(),
        'pdf': { 'id': file._id, 'metadata': { 'sentences': sentences }, 'filename': res.file.name },
        'uploaded_at': Date.now(),
        'modifiedBy': { 'standard_user': {}, 'annotator': {}, 'curator': {} },
        'organisation': user.organisation,
        'metadata': metadata,
        'datasets': { 'deleted': [], 'extracted': datasets, 'current': datasets },
        'status': 'metadata',
        'source': $.xml()
      };
    result.modifiedBy[user.role.label][user.id] = user.username;
    return cb(null, result);
  });
};

/**
 * Parse XML content
 * @param {String} xmlStr String representation of xml document
 * @return {Object} Objet JSON Object of XML document or null
 */
object.load = function(xmlStr) {
  const result = cheerio.load(xmlStr, {
    xmlMode: true
  });
  return Object.keys(result).length > 0 ? result : null;
};

object.extractMetadata = function($, type) {
  let result = {},
    err = object.selectors[type];
  if (!err) return result;
  for (let key in object.selectors[type].metadata) {
    result[key] = object.selectors[type].metadata[key]($);
  }
  return result;
};

object.extractDatasets = function($, type) {
  return object.selectors[type].datasets($);
};

module.exports = object;

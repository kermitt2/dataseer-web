/*
 * @prettier
 */

// API Interface Object
const dataseerML = {
  'extractDatatypeFrom': function(data) {
    console.log(data);
    let classifications =
        data['classifications'].length > 0 &&
        typeof data['classifications'][0] === 'object' &&
        data['classifications'][0].has_dataset > data['classifications'][0].no_dataset
          ? data['classifications'][0]
          : {},
      result = {};
    delete classifications.text;
    delete classifications.has_dataset;
    delete classifications.no_dataset;
    console.log(classifications);
    let keys = Object.keys(classifications);
    console.log(keys);
    if (keys.length > 0) {
      let datatype = keys[0],
        max = classifications[keys[0]];
      for (var i = 1; i < keys.length; i++) {
        if (max < classifications[keys[i]]) {
          max = classifications[keys[i]];
          datatype = keys[i];
        }
      }
      result.datatype = datatype;
      result.cert = max;
    }
    console.log(result);
    return result;
  },
  // Get the dataType of a given sentence
  'getdataType': function(sentence, done) {
    return $.ajax({
      cache: false,
      type: 'POST',
      url: '../api/dataseer-ml/processDataseerSentence',
      data: 'text=' + encodeURIComponent(sentence.text()),
      'complete': function(data) {
        'getdataType complete';
      },
      'success': function(data) {
        let result = dataseerML.extractDatatypeFrom(JSON.parse(data));
        done(null, result);
      },
      'error': function(data) {
        done(true, data);
      }
    });
  }
};
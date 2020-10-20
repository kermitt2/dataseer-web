/*
 * @prettier
 */

// API Interface Object
const MongoDB = {
  // Get the current object
  'getCurrentDocument': function(opts = {}, done) {
    let currentId = jQuery(document.getElementById('document.id')).attr('value');
    jQuery.get('../api/documents/' + currentId + (typeof opts.pdf !== 'undefined' ? '?pdf=true' : ''), function(data) {
      return done(data);
    });
  },
  // Update a gicen document
  'updateDocument': function(doc, user, done) {
    if (typeof user !== 'undefined' && !!user) {
      if (typeof doc.modifiedBy === 'undefined') doc.modifiedBy = {};
      if (typeof doc.modifiedBy[user.role] === 'undefined') doc.modifiedBy[user.role] = {};
      doc.modifiedBy[user.role][user.id] = user.username;
    }
    let copy = Object.assign({}, doc);
    copy.pdf.data = undefined;
    jQuery.ajax({
      'type': 'PUT',
      'contentType': 'application/json; charset=utf-8',
      'headers': {
        'X-HTTP-Method-Override': 'PUT'
      },
      'url': '../api/documents/' + doc._id,
      'data': JSON.stringify(copy),
      'success': function(data) {
        return done(null, data);
      },
      'error': function(data) {
        return done(true, data);
      },
      'dataType': 'json'
    });
  },
  // Get the previous status of current document object
  getPreviousStatus: function(doc) {
    let result = doc.status;
    if (doc.status === 'finish') result = 'datasets';
    else if (doc.status === 'datasets') result = 'metadata';
    return result;
  },
  // Get the next status of current document object
  getNextStatus: function(doc) {
    let result = doc.status;
    if (doc.status === 'metadata') result = 'datasets';
    else if (doc.status === 'datasets') result = 'finish';
    return result;
  }
};

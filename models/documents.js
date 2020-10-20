/*
 * @prettier
 */
const mongoose = require('mongoose');

let DocumentsSchema = new mongoose.Schema({
  '_id': String,
  'pdf': Object,
  'modifiedBy': Object,
  'organisation': String,
  'metadata': Object,
  'datasets': Object,
  'source': String,
  'status': String,
  'isDataSeer': Boolean,
  'updated_at': { 'type': Date, 'default': Date.now },
  'uploaded_at': Date
});

module.exports = mongoose.model('Documents', DocumentsSchema);

/*
 * @prettier
 */

const express = require('express'),
  mongoose = require('mongoose'),
  router = express.Router(),
  AccountsManager = require('../../lib/accountsManager.js'),
  Documents = require('../../models/documents.js');

const gridfs = require('mongoose-gridfs');

/* GET ALL Documents */
router.get('/', function(req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccountAccessRight(req.user))
    return res.status(401).send('Your current role do not grant access to this part of website');
  let limit = parseInt(req.query.limit),
    doi = req.query.doi,
    pmid = req.query.pmid,
    query = {};
  if (typeof doi !== 'undefined') query['doi'] = doi;
  if (typeof pmid !== 'undefined') query['pmid'] = pmid;
  if (isNaN(limit)) limit = 20;
  Documents.find(query)
    .limit(limit)
    .exec(function(err, post) {
      if (err) return next(err);
      return res.json(post);
    });
});

/* GET SINGLE Document BY ID */
router.get('/:id', function(req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccountAccessRight(req.user))
    return res.status(401).send('Your current role do not grant access to this part of website');
  Documents.findById(req.params.id, function(err, post) {
    if (err) return next(err);
    if (req.query.pdf && typeof post.pdf !== 'undefined') {
      const Pdf = gridfs.createModel({
        modelName: 'Pdf',
        connection: mongoose.connection
      });
      Pdf.findById(post.pdf.id, (err, pdf) => {
        if (err) return next(err);
        let arr = [];
        const readstream = pdf.read();
        readstream.on('error', function(err) {
          return next(err);
        });
        readstream.on('data', function(data) {
          arr.push(data);
        });
        readstream.on('close', function(data) {
          post.pdf.data = Buffer.concat(arr);
          return res.json(post);
        });
      });
    } else return res.json(post);
  });
});

/* SAVE Document */
router.post('/', function(req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccountAccessRight(req.user))
    return res.status(401).send('Your current role do not grant access to this part of website');
  Documents.create(req.body, function(err, post) {
    if (err) return next(err);
    return res.json(post);
  });
});

/* UPDATE Document */
router.put('/:id', function(req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccountAccessRight(req.user))
    return res.status(401).send('Your current role do not grant access to this part of website');
  if (typeof req.body.pdf.data !== 'undefined') req.body.pdf.data = undefined;
  Documents.findByIdAndUpdate(req.params.id, req.body, function(err, post) {
    if (err) return next(err);
    return res.json(post);
  });
});

/* DELETE Document */
router.delete('/:id', function(req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccountAccessRight(req.user))
    return res.status(401).send('Your current role do not grant access to this part of website');
  Documents.findByIdAndRemove(req.params.id, req.body, function(err, post) {
    if (err) return next(err);
    return res.json(post);
  });
});

module.exports = router;

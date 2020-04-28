/*
 * @prettier
 */

const express = require('express'),
  router = express.Router(),
  path = require('path'),
  mongoose = require('mongoose'),
  passport = require('passport'),
  AccountsManager = require('../lib/accountsManager.js'),
  Documents = require('../models/documents.js');

const conf = require('../conf/conf.json');

/* GET ALL Documents */
router.get('/', function(req, res, next) {
  if (
    typeof req.user === 'undefined' ||
    !AccountsManager.checkAccountAccessRight(req.user, AccountsManager.roles.annotator, AccountsManager.match.weight)
  )
    return res.status(401).send('Your current role do not grant access to this part of website');
  let limit = parseInt(req.query.limit),
    doi = req.query.doi,
    pmid = req.query.pmid,
    query = {};
  if (typeof doi !== 'undefined' && doi.length > 0) query['metadata.doi'] = doi;
  if (typeof pmid !== 'undefined' && pmid.length > 0) query['metadata.pmid'] = pmid;
  if (isNaN(limit)) limit = 20;
  return Documents.find(query)
    .limit(limit)
    .exec(function(err, post) {
      if (err) return next(err);
      return res.render(path.join('documents', 'all'), {
        'route': 'documents',
        'root': conf.root,
        'search': true,
        'documents': post,
        'current_user': req.user
      });
    });
});

/* GET SINGLE Document BY ID */
router.get('/:id', function(req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccountAccessRight(req.user))
    return res.status(401).send('Your current role do not grant access to this part of website');
  return Documents.findById(req.params.id, function(err, post) {
    if (err) return next(err);
    if (post === null) return res.status(400).send('error 404');
    let author_persons =
      Array.isArray(post.metadata.author_persons) && post.metadata.author_persons.length > 0
        ? post.metadata.author_persons.join(', ')
        : '';
    return res.render(path.join('documents', post.status), {
      'route': 'documents/:id',
      'root': conf.root,
      'document': post,
      'author_persons': author_persons,
      'demo': process.env.DEMO,
      'current_user': req.user
    });
  });
});

module.exports = router;

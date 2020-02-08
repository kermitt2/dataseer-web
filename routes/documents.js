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

/* GET ALL Documents */
router.get('/', function(req, res, next) {
  if (
    typeof req.user === 'undefined' ||
    !AccountsManager.checkAccountAccessRight(req.user, AccountsManager.roles.annotator, AccountsManager.match.weight)
  )
    return res.status(401).send('Your current role do not grant access to this part of website');
  let limit = parseInt(req.query.limit),
    doi = req.query.doi,
    username = req.query.username,
    pmid = req.query.pmid,
    query = {};
  if (typeof doi !== 'undefined' && doi.length > 0) query['doi'] = doi;
  if (typeof username !== 'undefined' && username.length > 0) query['username'] = username;
  if (typeof pmid !== 'undefined' && pmid.length > 0) query['pmid'] = pmid;
  if (isNaN(limit)) limit = 20;
  return Documents.find(query)
    .limit(limit)
    .exec(function(err, post) {
      if (err) return next(err);
      return res.render(path.join('documents', 'all'), {
        'route': '/documents',
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
    return res.render(
      path.join(
        'documents',
        AccountsManager.checkAccountAccessRight(req.user, AccountsManager.roles.curator, AccountsManager.match.role) // If role is curator, force display of step 'datasets'
          ? 'datasets'
          : post.status
      ),
      {
        'document': post,
        'demo': process.env.DEMO,
        'current_user': req.user
      }
    );
  });
});

module.exports = router;

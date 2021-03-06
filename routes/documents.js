/*
 * @prettier
 */

'use strict';

const express = require('express'),
  router = express.Router(),
  path = require('path');

const AccountsManager = require('../lib/accounts.js'),
  JWT = require('../lib/jwt.js'),
  Mailer = require('../lib/mailer.js');

const Organisations = require('../models/organisations.js'),
  Accounts = require('../models/accounts.js'),
  Documents = require('../models/documents.js');

const DocumentsController = require('../controllers/documents.js'),
  DocumentsDatasetsController = require('../controllers/documents.datasets.js');

const conf = require('../conf/conf.json');

/* GET on all documents page */
router.get('/', function (req, res, next) {
  if (
    typeof req.user === 'undefined' ||
    !AccountsManager.checkAccessRight(req.user, AccountsManager.roles.annotator, AccountsManager.match.weight)
  )
    return res.status(401).send('Your current role does not grant you access to this part of the website');
  let limit = parseInt(req.query.limit),
    skip = parseInt(req.query.skip),
    status = req.query.status,
    organisation = req.query.organisation,
    pmid = req.query.pmid,
    doi = req.query.doi,
    uploaded_before = req.query.uploaded_before ? new Date(req.query.uploaded_before) : null,
    uploaded_after = req.query.uploaded_after ? new Date(req.query.uploaded_after) : null,
    updated_before = req.query.updated_before ? new Date(req.query.updated_before) : null,
    updated_after = req.query.updated_after ? new Date(req.query.updated_after) : null,
    user = req.query.user,
    documentId = req.query.documentId,
    query = {},
    isCuractor = AccountsManager.checkAccessRight(req.user, AccountsManager.roles.curator);
  if (isNaN(skip) || skip < 0) skip = 0;
  if (isNaN(limit) || limit < 0) limit = 20;
  // Check uploaded dates
  if (uploaded_before instanceof Date && !isNaN(uploaded_before)) {
    if (query['uploaded_at'] === undefined) query['uploaded_at'] = {};
    query['uploaded_at']['$lte'] = uploaded_before.toISOString();
  }
  if (uploaded_after instanceof Date && !isNaN(uploaded_after)) {
    if (query['uploaded_at'] === undefined) query['uploaded_at'] = {};
    query['uploaded_at']['$gte'] = uploaded_after.toISOString();
  }
  // Check updated dates
  if (updated_before instanceof Date && !isNaN(updated_before)) {
    if (query['updated_at'] === undefined) query['updated_at'] = {};
    query['updated_at']['$lte'] = updated_before.toISOString();
  }
  if (updated_after instanceof Date && !isNaN(updated_after)) {
    if (query['updated_at'] === undefined) query['updated_at'] = {};
    query['updated_at']['$gte'] = updated_after.toISOString();
  }
  if (documentId) query['_id'] = documentId;
  if (status) query['status'] = status;
  if (organisation) query['organisation'] = organisation;
  if (user) query['watchers'] = { '$in': [user] };
  // Annotators access is restricted
  if (!isCuractor) query['organisation'] = req.user.organisation._id;
  // Init transaction
  let transaction = Documents.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .skip(skip)
    .populate('organisation')
    .populate('metadata')
    .populate('owner')
    .populate('tei')
    .populate('pdf')
    .populate('logs');
  // Execute transaction
  return transaction.exec(function (err, documents) {
    if (err) return next(err);
    let accountsQuery = isCuractor ? {} : { organisation: query['organisation'] };
    return Accounts.find(accountsQuery).exec(function (err, accounts) {
      let organisationsQuery = isCuractor ? {} : { _id: query['organisation'] };
      return Organisations.find(organisationsQuery).exec(function (err, organisations) {
        if (err) return next(err);
        let error = req.flash('error'),
          success = req.flash('success'),
          docs = documents;
        if (pmid || doi) {
          docs = documents.filter(function (item) {
            let res = true;
            if (pmid) res &= pmid === item.metadata.pmid;
            if (doi) res &= doi === item.metadata.doi;
            return res;
          });
        }
        // reorder logs
        for (let i = 0; i < docs.length; i++) {
          let doc = docs[i];
          doc.logs = doc.logs.sort(function (a, b) {
            return new Date(b.date) - new Date(a.date);
          });
        }
        return res.render(path.join('documents', 'all'), {
          route: 'documents',
          redirectUrl: `.${req.originalUrl}`,
          conf: conf,
          params: req.query,
          accounts: accounts.sort(function (a, b) {
            return a.username.localeCompare(b.username);
          }),
          organisations: organisations.sort(function (a, b) {
            return a.name.localeCompare(b.name);
          }),
          search: true,
          documents: docs,
          current_user: req.user,
          error: Array.isArray(error) && error.length > 0 ? error : undefined,
          success: Array.isArray(success) && success.length > 0 ? success : undefined
        });
      });
    });
  });
});

/* POST on all documents page */
router.post('/', function (req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccessRight(req.user, AccountsManager.roles.curator))
    return res.status(401).send('Your current role does not grant you access to this part of the website');
  let redirectUrl = typeof req.body.redirectUrl !== 'string' ? './documents' : req.body.redirectUrl;
  if (typeof req.body.update !== 'undefined' && req.body.update === '') {
    if (typeof req.body.organisation !== 'string' || req.body.organisation.length <= 0) {
      req.flash('error', 'Incorrect organisation');
      return res.redirect(redirectUrl);
    }
    if (typeof req.body.id !== 'string' || req.body.id.length <= 0) {
      req.flash('error', 'Incorrect document');
      return res.redirect(redirectUrl);
    }
    return Documents.findOne({ _id: req.body.id }, function (err, doc) {
      if (err) {
        req.flash('error', err.message);
        return res.redirect(redirectUrl);
      }
      doc.organisation = req.body.organisation;
      return doc.save(function (err) {
        if (err) {
          req.flash('error', err.message);
          return res.redirect(redirectUrl);
        }
        req.flash('success', 'Organisation of document ' + doc._id + ' has been successfully updated');
        return res.redirect(redirectUrl);
      });
    });
  } else if (typeof req.body.delete !== 'undefined' && req.body.delete === '') {
    if (typeof req.body.id !== 'string' || req.body.id.length <= 0) {
      req.flash('error', 'Incorrect document');
      return res.redirect(redirectUrl);
    }
    return DocumentsController.delete(req.body.id, function (err) {
      if (err) {
        req.flash('error', err.message);
        return res.redirect(redirectUrl);
      }
      req.flash('success', 'Document ' + req.body.id + ' has been successfully deleted');
      return res.redirect(redirectUrl);
    });
  } else if (typeof req.body.generate_token !== 'undefined' && req.body.generate_token === '') {
    if (typeof req.body.id !== 'string' || req.body.id.length <= 0) {
      req.flash('error', 'Incorrect document');
      return res.redirect(redirectUrl);
    }
    // If privateKey not found
    let privateKey = req.app.get('private.key');
    if (!privateKey) {
      req.flash('error', 'Server unable to create new JWT (private key not found)');
      return res.redirect(redirectUrl);
    }
    return Documents.findOne({ _id: req.body.id }, function (err, doc) {
      if (err) {
        req.flash('error', err.message);
        return res.redirect(redirectUrl);
      }
      return JWT.create(
        { documentId: doc._id, accountId: conf.tokens.documents.accountId },
        privateKey,
        conf.tokens.documents.expiresIn,
        function (err, token) {
          // If JWT error has occured
          if (err) {
            req.flash('error', `Server unable to create new JWT (${err.message})`);
            return res.redirect(redirectUrl);
          }
          doc.token = token;
          return doc.save(function (err) {
            if (err) {
              req.flash('error', err.message);
              return res.redirect(redirectUrl);
            }
            req.flash('success', 'Token of document ' + doc._id + ' has been successfully updated');
            return res.redirect(redirectUrl);
          });
        }
      );
    });
  } else if (typeof req.body.multipleUpdates !== 'undefined' && req.body.multipleUpdates === '') {
    if (typeof req.body.organisation !== 'string' || req.body.organisation.length <= 0) {
      req.flash('error', 'You must select an organisation');
      return res.redirect(redirectUrl);
    }
    if (typeof req.body.ids !== 'string' || req.body.ids.length <= 0) {
      req.flash('error', 'You must select at least one document');
      return res.redirect(redirectUrl);
    }
    let ids = req.body.ids.split(';');
    if (!Array.isArray(ids) || ids.length < 0) {
      req.flash('error', 'You must select at least one document');
      return res.redirect(redirectUrl);
    }
    return Documents.updateMany({ _id: { $in: ids } }, { organisation: req.body.organisation }, function (err, result) {
      if (err) {
        req.flash('error', err.message);
        return res.redirect(redirectUrl);
      }
      if (!result.ok) {
        req.flash('error', 'An error has occured');
        return res.redirect(redirectUrl);
      }
      req.flash('success', 'Organisation of the ' + ids.length + ' selected document(s) has been successfully updated');
      return res.redirect(redirectUrl);
    });
  }
  return res.redirect(redirectUrl);
});

/* GET on given document metadata page */
router.get('/:id/metadata', function (req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccessRight(req.user))
    return res.status(401).send('Your current role does not grant you access to this part of the website');
  // Init transaction
  let transaction = Documents.findOne({ _id: req.params.id }).populate('metadata');
  // Execute transaction
  return transaction.exec(function (err, doc) {
    if (err || !doc) return res.status(404).send('Document not found');
    if (doc.status !== 'metadata') return res.redirect(`./${doc.status}` + AccountsManager.addTokenInURL(req.query));
    else {
      let publicURL = conf.root + 'documents/' + req.params.id + '?documentToken=' + doc.token;
      return res.render(path.join('documents', 'metadata'), {
        route: 'documents/:id/metadata',
        publicURL: publicURL,
        mail: {
          subject: Mailer.getShareWithColleagueSubject(),
          body: Mailer.getShareWithColleagueBodyTxt({
            metadata: doc.metadata,
            url: publicURL
          })
        },
        conf: conf,
        document: doc,
        current_user: req.user
      });
    }
  });
});

/* POST on given document metadata page */
router.post('/:id/metadata', function (req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccessRight(req.user))
    return res.status(401).send('Your current role does not grant you access to this part of the website');
  // Init transaction
  let transaction = Documents.findOne({ _id: req.params.id });
  // Execute transaction
  return transaction.exec(function (err, doc) {
    if (err) return next(err);
    return DocumentsController.updateMetadata(doc, req.user._id, function (err) {
      if (err || !doc) return res.status(404).send('Document not found');
      return res.redirect(`./${doc.status}` + AccountsManager.addTokenInURL(req.query));
    });
  });
});

/* GET on given document datasets page */
router.get('/:id/datasets', function (req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccessRight(req.user))
    return res.status(401).send('Your current role does not grant you access to this part of the website');
  // Init transaction
  let transaction = Documents.findOne({ _id: req.params.id }).populate('datasets');
  // Execute transaction
  return transaction.exec(function (err, doc) {
    if (err || !doc) return res.status(404).send('Document not found');
    if (doc.status !== 'datasets') return res.redirect(`./${doc.status}` + AccountsManager.addTokenInURL(req.query));
    else {
      let publicURL = conf.root + 'documents/' + req.params.id + '?documentToken=' + doc.token;
      return res.render(path.join('documents', 'datasets'), {
        route: 'documents/:id/datasets',
        publicURL: publicURL,
        mail: {
          subject: Mailer.getShareWithColleagueSubject(),
          body: Mailer.getShareWithColleagueBodyTxt({
            metadata: doc.metadata,
            url: publicURL
          })
        },
        conf: conf,
        document: doc,
        current_user: req.user
      });
    }
  });
});

/* GET on given document finish page */
router.get('/:id/finish', function (req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccessRight(req.user))
    return res.status(401).send('Your current role does not grant you access to this part of the website');
  // Init transaction
  let transaction = Documents.findOne({ _id: req.params.id })
    .populate('metadata')
    .populate('datasets')
    .populate('tei')
    .populate('pdf');
  // Execute transaction
  return transaction.exec(function (err, doc) {
    let sortedDatasets = DocumentsController.getSortedDatasets(doc, req.app.get('dataTypes'));
    if (err || !doc) return res.status(404).send('Document not found');
    if (doc.status !== 'finish') return res.redirect(`./${doc.status}` + AccountsManager.addTokenInURL(req.query));
    else {
      let publicURL = conf.root + 'documents/' + req.params.id + '?documentToken=' + doc.token;
      return res.render(path.join('documents', 'finish'), {
        route: 'documents/:id/finish',
        publicURL: publicURL,
        mail: {
          subject: Mailer.getShareWithColleagueSubject(),
          body: Mailer.getShareWithColleagueBodyTxt({
            metadata: doc.metadata,
            url: publicURL
          })
        },
        conf: conf,
        document: doc,
        sortedDatasets: sortedDatasets,
        datasetsSummary: DocumentsDatasetsController.getDatasetsSummary(sortedDatasets.all, req.app.get('dataTypes')),
        bestPractices: DocumentsDatasetsController.getBestPractices(
          [].concat(sortedDatasets.protocols, sortedDatasets.datasets, sortedDatasets.codes, sortedDatasets.reagents),
          req.app.get('dataTypes')
        ),
        current_user: req.user
      });
    }
  });
});

router.get('/:id/finish/report', function (req, res, next) {
  if (
    typeof req.user === 'undefined' ||
    !AccountsManager.checkAccessRight(req.user, AccountsManager.roles.annotator, AccountsManager.match.weight)
  )
    return res.status(401).send('Your current role does not grant you access to this part of the website');
  // Init transaction
  let transaction = Documents.findOne({ _id: req.params.id })
    .populate('metadata')
    .populate('datasets')
    .populate('tei')
    .populate('pdf');
  // Execute transaction
  return transaction.exec(function (err, doc) {
    let sortedDatasets = DocumentsController.getSortedDatasets(doc, req.app.get('dataTypes'));
    if (err || !doc) return res.status(404).send('Document not found');
    if (doc.status !== 'finish') return res.redirect(`./${doc.status}` + AccountsManager.addTokenInURL(req.query));
    else {
      let publicURL = conf.root + 'documents/' + req.params.id + '?documentToken=' + doc.token;
      return res.render(path.join('reports', 'report-1'), {
        publicURL: publicURL,
        conf: conf,
        document: doc,
        sortedDatasets: sortedDatasets,
        datasetsSummary: DocumentsDatasetsController.getDatasetsSummary(sortedDatasets.all, req.app.get('dataTypes')),
        bestPractices: DocumentsDatasetsController.getBestPractices(
          [].concat(sortedDatasets.protocols, sortedDatasets.datasets, sortedDatasets.codes, sortedDatasets.reagents),
          req.app.get('dataTypes')
        ),
        current_user: req.user
      });
    }
  });
});

/* GET SINGLE Document BY ID */
router.get('/:id', function (req, res, next) {
  if (typeof req.user === 'undefined' || !AccountsManager.checkAccessRight(req.user))
    return res.status(401).send('Your current role does not grant you access to this part of the website');
  // Init transaction
  let transaction = Documents.findOne({ _id: req.params.id }).populate('metadata');
  // Execute transaction
  return transaction.exec(function (err, doc) {
    if (err || !doc) return res.status(404).send('Document not found');
    return res.redirect(
      `${conf.root}documents/${doc._id.toString()}/${doc.status}` + AccountsManager.addTokenInURL(req.query)
    );
  });
});

module.exports = router;

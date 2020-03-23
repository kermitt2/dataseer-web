/*
 * @prettier
 */

const express = require('express'),
  router = express.Router(),
  AccountsManager = require('../../lib/accountsManager.js'),
  Documents = require('../../models/documents.js');

/* GET ALL Documents */
router.get('/', function(req, res, next) {
  let doi = req.query.doi,
    pmid = req.query.pmid,
    query = {};
  if (typeof doi !== 'undefined') query['metadata.doi'] = doi;
  if (typeof pmid !== 'undefined') query['metadata.pmid'] = pmid;
  console.log(query);
  Documents.find(query)
    .limit(1)
    .exec(function(err, post) {
      if (err) return next(err);
      if (post.length > 0) {
        return res.json({
          'status': getStatus(post[0]),
          'datasetsCount': Object.keys(post[0].datasets.current).length,
          'doiCount': getDOICount(post[0])
        });
      } else {
        return res.status(404).json({ 'status': 'unknow', 'datasetsCount': 0, 'doiCount': 0 });
      }
    });
});

function getStatus(doc) {
  if (doc.status === 'finished') return 'available';
  else if (doc.status === 'metadata' || doc.status === 'datasets') return 'processing';
  else return 'unknow';
}

function getDOICount(doc) {
  let result = 0;
  for (let key in doc.datasets.current) {
    result += doc.datasets.current[key].DOI !== '';
  }
  return result;
}

module.exports = router;

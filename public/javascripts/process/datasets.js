/*
 * @prettier
 */
(function($) {
  let currentDocument;
  // Get the current Object
  return MongoDB.getCurrentDocument(undefined, function(doc) {
    dataseerML.jsonDataTypes(function(err, data) {
      if (err) return alert('Error : Datatypes unavailable, dataseer-ml service does not respond');
      currentDocument = doc;
      let user = {
          'id': $('#user_id').text(),
          'username': $('#user_username').text(),
          'role': $('#user_role').text()
        },
        subTypes = data.subTypes,
        dataTypes = data.dataTypes,
        metadata = data.metadata,
        _status = {
          'modified': 'modified',
          'saved': 'saved',
          'valid': 'valid'
        },
        defaultDataType = Object.keys(dataTypes).sort(function(a, b) {
          if (metadata[a].count < metadata[b].count) return 1;
          else if (metadata[a].count > metadata[b].count) return -1;
          else return 0;
        })[0],
        defaultDataset = {
          'status': _status.modified,
          'id': '',
          'cert': '0',
          'dataType': defaultDataType,
          'subType': '',
          'description':
            typeof metadata[defaultDataType] !== 'undefined' && metadata[defaultDataType].description
              ? metadata[defaultDataType].description
              : '',
          'bestDataFormatForSharing':
            typeof metadata[defaultDataType] !== 'undefined' && metadata[defaultDataType].bestDataFormatForSharing
              ? metadata[defaultDataType].bestDataFormatForSharing
              : '',
          'mostSuitableRepositories':
            typeof metadata[defaultDataType] !== 'undefined' && metadata[defaultDataType].mostSuitableRepositories
              ? metadata[defaultDataType].mostSuitableRepositories
              : '',
          'name': '',
          'DOI': '',
          'comments': '',
          'text': ''
        },
        getDataType = function(type) {
          if (typeof dataTypes[type] !== 'undefined') return type;
          if (typeof subTypes[type] !== 'undefined') return type;
          return defaultDataType;
        },
        getSubType = function(type) {
          if (typeof subTypes[type] !== 'undefined') return type;
          return '';
        },
        isAnExtractedDataset = function(dataset, extractedDatasets) {
          for (let key in extractedDatasets) {
            if (dataset.text === extractedDatasets[key].text) {
              return true;
            }
          }
          return false;
        },
        getUnsavedDatasets = function(datasets) {
          let result = [];
          for (let key in datasets) {
            if (datasets[key].status !== _status.valid) result.push(key);
          }
          return result;
        },
        getStatusOfDatasets = function(datasets) {
          let result = {};
          for (let key in datasets) {
            result[key] = datasets[key].status;
          }
          return result;
        },
        nextDataset = function(status) {
          let result = IndexOfNextDataset(status);
          if (result.index > -1) return currentDocument.datasets.current[result.key];
          else return null;
        },
        IndexOfNextDataset = function(status) {
          let result = -1,
            keys = Object.keys(currentDocument.datasets.current);
          for (var i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (currentDocument.datasets.current[key] && currentDocument.datasets.current[key].status === status)
              return {
                'index': i,
                'key': keys[i]
              };
          }
          return result;
        },
        saveDataset = function(dataset, status) {
          let fullDataType =
            currentDocument.datasets.current[dataset['dataset.id']].subType === ''
              ? currentDocument.datasets.current[dataset['dataset.id']].dataType
              : currentDocument.datasets.current[dataset['dataset.id']].dataType +
                ':' +
                currentDocument.datasets.current[dataset['dataset.id']].subType;
          documentView.updateDataset(user, dataset['dataset.id'], fullDataType);
          let keys = Object.keys(currentDocument.datasets.current[dataset['dataset.id']]);
          for (var i = 0; i < keys.length; i++) {
            if (typeof dataset['dataset.' + keys[i]] !== 'undefined')
              currentDocument.datasets.current[dataset['dataset.id']][keys[i]] = dataset['dataset.' + keys[i]];
          }
          if (currentDocument.datasets.current[dataset['dataset.id']].name === '')
            currentDocument.datasets.current[dataset['dataset.id']].name = dataset['dataset.id'];
          currentDocument.datasets.current[dataset['dataset.id']].status = status;
          datasetsList.datasets.statusOf(
            dataset['dataset.id'],
            currentDocument.datasets.current[dataset['dataset.id']].status
          );
          currentDocument.source = documentView.source();
          return MongoDB.updateDocument(currentDocument, user, function(err, res) {
            console.log(err, res);
            if (err) return err; // Need to define error behavior
            // Update dataType in XML
            let nextStatus = status === _status.saved ? _status.modified : _status.saved;
            hasChanged = false;
            let next = nextDataset(nextStatus);
            if (next !== null) {
              datasetsList.select(next.id);
              datasetForm.link(next, documentView.color(next.id));
              documentView.views.scrollTo(next.id);
            } else {
              datasetsList.select(dataset['dataset.id']);
              datasetForm.link(
                currentDocument.datasets.current[dataset['dataset.id']],
                documentView.color(dataset['dataset.id'])
              );
              documentView.views.scrollTo(dataset['dataset.id']);
            }
            // return location.reload();
          });
        },
        deleteDataset = function(id) {
          hasChanged = true;
          documentView.deleteDataset(id);
          documentView.deleteAllCorresps(id);
          currentDocument.datasets.current[id].fromDataseerML = isAnExtractedDataset(
            currentDocument.datasets.current[id],
            currentDocument.datasets.extracted
          );
          currentDocument.datasets.deleted.push(currentDocument.datasets.current[id]);
          delete currentDocument.datasets.current[id];
          currentDocument.source = documentView.source();
          return MongoDB.updateDocument(currentDocument, user, function(err, res) {
            console.log(err, res);
            if (err) return err; // Need to define error behavior
            hasChanged = false;
            let keys = Object.keys(currentDocument.datasets.current);
            if (id === datasetForm.id() && keys.length > 0) {
              let key = keys.length > 1 ? keys[1] : keys[0];
              datasetsList.select(key);
              datasetForm.link(currentDocument.datasets.current[key], documentView.color(key));
              documentView.views.scrollTo(key);
            } else {
              datasetForm.link(defaultDataset);
            }
          });
        },
        checkStatusOfDatasets = function() {
          let result = true;
          for (let key in currentDocument.datasets.current) {
            if (currentDocument.datasets.current[key] && currentDocument.datasets.current[key].status !== _status.valid)
              return false;
          }
          return result;
        };

      let hasChanged = false; // tell us if there is some change

      // Save of validation process because it will be insert into datasetList
      let validationBtn = $('<button/>')
          .attr('id', 'datasets_validation')
          .addClass('btn btn-primary')
          .text('This info is correct : Continue'),
        newDatasetBtn = $('#new_dataset').clone(true);

      // All components
      let datasetForm = new DatasetForm({
          // On final validation
          'onValidation': function(dataset) {
            let currentId = datasetForm.id();
            if (user.role === 'curator') {
              datasetsList.datasets.statusOf(currentId, _status.valid);
              return saveDataset(dataset, _status.valid);
            }
            if (
              currentId === '' ||
              typeof currentDocument.datasets.current === 'undefined' ||
              typeof currentDocument.datasets.current[currentId] === 'undefined'
            ) {
              $('#datasets-error-modal-label').html('Final validation');
              $('#datasets-error-modal-body').html('Please, add at least one dataset before validate');
              $('#datasets-error-modal-btn').click();
            } else if (dataset['dataset.DOI'] === '' && dataset['dataset.comments'] === '') {
              $('#datasets-error-modal-label').html('Final validation');
              $('#datasets-error-modal-body').html(
                'To validate, please provide a DOI or enter comments explaining why this dataset cannot be shared'
              );
              $('#datasets-error-modal-btn').click();
            } else if (dataset['dataset.dataType'] === '') {
              $('#datasets-error-modal-label').html('Final validation');
              $('#datasets-error-modal-body').html('To validate, please provide a datatype (predefined or custom)');
              $('#datasets-error-modal-btn').click();
            } else {
              datasetsList.datasets.statusOf(currentId, _status.valid);
              saveDataset(dataset, _status.valid);
            }
          },
          // On save
          'onSave': function(dataset) {
            let currentId = datasetForm.id();
            if (user.role === 'curator') {
              datasetsList.datasets.statusOf(currentId, _status.saved);
              return saveDataset(dataset, _status.saved);
            }
            if (
              currentId === '' ||
              typeof currentDocument.datasets.current === 'undefined' ||
              typeof currentDocument.datasets.current[currentId] === 'undefined'
            ) {
              $('#datasets-error-modal-label').html('Save dataset');
              $('#datasets-error-modal-body').html('Please, add at least one dataset before saving');
              $('#datasets-error-modal-btn').click();
            } else {
              datasetsList.datasets.statusOf(currentId, _status.saved);
              saveDataset(dataset, _status.saved);
            }
          },
          'onIdClick': function(id) {
            datasetsList.select(id);
            datasetForm.link(currentDocument.datasets.current[id], documentView.color(id));
            documentView.views.scrollTo(id);
          },
          'onChange': function(element) {
            datasetsList.datasets.statusOf(datasetForm.id(), _status.modified);
            hasChanged = true;
          },
          'onUnlink': function(element) {
            documentView.deleteCorresp(element);
            let id = element.attr('corresp').substring(1);
            datasetForm.link(currentDocument.datasets.current[id], documentView.color(id));
            documentView.views.scrollTo(id);
          }
        }),
        datasetsList = new DatasetsList(currentDocument.datasets.current, {
          'onNewDataset': function() {
            if (typeof currentDocument.datasets.current === 'undefined') currentDocument.datasets.current = {};
            let index = Object.keys(currentDocument.datasets.current).length + 1,
              newId = 'dataset-' + index;
            while (typeof currentDocument.datasets.current[newId] !== 'undefined') {
              index += 1;
              newId = 'dataset-' + index;
            }
            return documentView.addDataset(user, newId, defaultDataType, function(err, res) {
              if (err) {
                $('#datasets-error-modal-label').html('Add Dataset');
                if (typeof res === 'string') $('#datasets-error-modal-body').html(res);
                else if (typeof res === 'object' && res.status[0] !== '2')
                  $('#datasets-error-modal-body').html(
                    'DataseerML Service : (HTTP ' + res.status + ') ' + res.statusText
                  );
                else $('#datasets-error-modal-body').html('Unknow Error');
                $('#datasets-error-modal-btn').click();
              } else {
                currentDocument.datasets.current[newId] = Object.assign(
                  Object.create(Object.getPrototypeOf(defaultDataset)),
                  defaultDataset
                );
                currentDocument.datasets.current[newId].id = newId;
                currentDocument.datasets.current[newId].cert = res.cert;
                currentDocument.datasets.current[newId].dataType = getDataType(res.datatype);
                currentDocument.datasets.current[newId].subType = getSubType(res.datatype);
                currentDocument.datasets.current[newId].text = documentView.getTextOfDataset(newId);
                currentDocument.datasets.current[newId].status = _status.saved;
                currentDocument.source = documentView.source();
                return MongoDB.updateDocument(currentDocument, user, function(err, res) {
                  console.log(err, res);
                  if (err) return err; // Need to define error behavior
                  hasChanged = false;
                  datasetsList.add(newId, documentView.color(newId), currentDocument.datasets.current[newId].status);
                  datasetsList.select(newId);
                  datasetForm.link(currentDocument.datasets.current[newId], documentView.color(newId));
                  documentView.views.scrollTo(newId);
                });
              }
            });
          },
          'onClick': function(id) {
            datasetsList.select(id);
            datasetForm.link(currentDocument.datasets.current[id], documentView.color(id));
            documentView.views.scrollTo(id);
          },
          'onDelete': function(id) {
            $('#datasets-confirm-modal-label').html('Delete Dataset');
            $('#datasets-confirm-modal-body').html('Did you really want to delete this dataset?');
            $('#datasets-confirm-modal-data').html(id);
            $('#datasets-confirm-modal-btn').click();
          },
          'onLink': function(id) {
            let result = documentView.addCorresp(user, id);
            if (result.err) {
              $('#datasets-error-modal-label').html('Link sentence to Dataset : ' + id);
              $('#datasets-error-modal-body').html('Please select the sentence that will be linked to Dataset : ' + id);
              $('#datasets-error-modal-btn').click();
            } else {
              hasChanged = true;
              currentDocument.source = documentView.source();
              result.res.click();
              return MongoDB.updateDocument(currentDocument, user, function(err, res) {
                console.log(err, res);
                if (err) return err; // Need to define error behavior
                hasChanged = false;
                // return location.reload();
              });
            }
          }
        }), // List of datasets
        documentView = new DocumentView({
          // Interactive view od XML document
          'datasets': {
            'click': function(id, el) {
              datasetsList.select(id);
              datasetForm.link(currentDocument.datasets.current[id], documentView.color(id), jQuery(el));
            }
          },
          'corresps': {
            'click': function(id, el) {
              datasetsList.select(id);
              datasetForm.link(currentDocument.datasets.current[id], documentView.color(id), jQuery(el));
            }
          }
        }),
        keys = currentDocument.datasets.current ? Object.keys(currentDocument.datasets.current) : undefined;
      defaultKey = keys ? keys[0] : undefined;

      documentView.init('#document-view', currentDocument.source);
      if (defaultKey) documentView.views.scrollTo(defaultKey);

      datasetForm.init('#dataset-form');
      datasetForm.loadData(data);
      if (defaultKey) datasetForm.link(currentDocument.datasets.current[defaultKey], documentView.color(defaultKey));

      datasetsList.init('#datasets-list', documentView.colors(), getStatusOfDatasets(currentDocument.datasets.current));
      if (defaultKey) datasetsList.select(defaultKey);

      $('#new_dataset > button').click();

      // get selection
      $('#view-selection input[type=radio]').on('change', function() {
        documentView.views[this.value]();
      });

      // On datasets_validation click
      $('#datasets_validation').click(function() {
        if (checkStatusOfDatasets() || user.role === 'curator') {
          currentDocument.status = MongoDB.getNextStatus(currentDocument);
          currentDocument.source = documentView.source();
          return MongoDB.updateDocument(currentDocument, user, function(err, res) {
            console.log(err, res);
            if (err) return err; // Need to define error behavior
            hasChanged = false;
            return location.reload();
          });
        } else {
          let list = getUnsavedDatasets(currentDocument.datasets.current).map(function(e) {
            return '<li>' + e + '</li>';
          });
          $('#datasets-error-modal-label').html('Continue');
          $('#datasets-error-modal-body').html(
            '<p>Please validate all following datasets to continue</p><ul>' + list.join('') + '</ul>'
          );
          $('#datasets-error-modal-btn').click();
        }
      });

      // On confirm button click od modal
      $('#datasets-confirm-modal-valid').click(function() {
        let id = $('#datasets-confirm-modal-data').html();
        datasetsList.datasets.remove(id);
        deleteDataset(id);
      });

      // If user is annotator
      if (user.role === 'annotator') {
        console.log('annotator');
        let refreshDiv = $('<div/>').addClass('form-row'),
          refreshBtn = $('<button/>')
            .addClass('btn btn-primary btn-sm')
            .text('Refresh Datatypes ')
            .click(function() {
              refreshIcon.addClass('fa-spin');
              dataseerML.resyncJsonDataTypes(function(err, data) {
                refreshIcon.removeClass('fa-spin');
                if (err) return console.log(err);
                subTypes = data.subTypes;
                dataTypes = data.dataTypes;
                metadata = data.metadata;
                datasetForm.loadData(data);
              });
            }),
          refreshIcon = $('<i/>').addClass('fas fa-sync-alt');
        $('#dataset-form .container-fluid').append(refreshDiv.append(refreshBtn.append(refreshIcon)));
      }

      window.onbeforeunload = function() {
        if (hasChanged)
          return confirm('Are you sure you want to navigate away from this page? Changes will not be saved !');
      };
    });
  });
})(jQuery);

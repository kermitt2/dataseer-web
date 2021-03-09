/*
 * @prettier
 */

'use strict';

const DatasetsList = function (data, events) {
  let datasets = {};

  let elements = {
      container: HtmlBuilder.div({
        id: '',
        class: 'datasetListContainer',
        text: ''
      }),
      empty: $(
        `<li class="form-row"><div class="item no-data" value="no-data">DataSeer has not detected any datasets in this document</div></li>`
      ),
      datasetsList: HtmlBuilder.div({
        id: 'datasetsListItems',
        class: '',
        text: ''
      }),
      datasetsListItemsContainer: HtmlBuilder.div({
        id: 'datasetsListItemsContainer',
        class: '',
        text: ''
      }),
      newDataset: HtmlBuilder.div({
        id: 'newDataset',
        class: 'right',
        text: ''
      })
    },
    mapping = {};

  self.datasets = {
    add: function (id) {
      datasets[id] = new View.links.static(
        {
          class: 'form-row',
          text: id,
          value: id,
          style: ''
        },
        {
          onClick: function (id) {
            events.onClick(id);
          },
          onDelete: function (id) {
            events.onDelete(id);
          },
          onLink: function (id) {
            events.onLink(id);
          }
        }
      );
      let _elements = datasets[id].elements(),
        container = _elements.container;
      mapping[id] = container;
      _elements.link.attr('title', 'Link selected sentence to this dataset');
      elements.datasetsListItemsContainer.append(container);
      elements.empty.hide();
    },
    remove: function (id) {
      datasets[id].delete();
      delete datasets[id];
      delete mapping[id];
      if (Object.keys(datasets).length === 0) elements.empty.show();
    },
    statusOf: function (id, value) {
      if (typeof value !== 'undefined') datasets[id].elements().status.value(value);
    },
    styleOf: function (id, value) {
      if (typeof value !== 'undefined') datasets[id].elements().data.attr('style', value);
    }
  };

  // scroll ot dataset position
  let scrollTo = function (id) {
    let position = Math.round(
      mapping[id].position().left + elements.datasetsList.scrollLeft() - mapping[id].width() / 2
    );
    elements.datasetsList.animate({ scrollLeft: position });
  };

  let animationFinished = true;

  elements.datasetsListItemsContainer.get(0).addEventListener(
    'wheel',
    function (e) {
      if (animationFinished) {
        animationFinished = false;
        let scroll = e.deltaY > 0 ? 75 : -75,
          position = Math.round(elements.datasetsList.scrollLeft() + scroll);
        // elements.datasetsList.scrollLeft(position);
        elements.datasetsList.animate({ scrollLeft: position }, function () {
          animationFinished = true;
        });
      }
    },
    { passive: true }
  );

  // Add all elements
  elements.datasetsList.append(elements.datasetsListItemsContainer.append(elements.empty));
  elements.container.append(elements.datasetsList);
  elements.container.append(elements.newDataset);
  let theButton = new View.buttons.add('Add new Dataset');
  theButton.attr('style', 'white-space: normal;');
  elements.newDataset.append(theButton);

  elements.newDataset.find('button').click(function () {
    events.onNewDataset();
  });

  self.select = function (id) {
    elements.container.find('.selected').removeClass('selected');
    mapping[id].addClass('selected');
    scrollTo(id);
  };

  self.add = function (id, style, status) {
    self.datasets.add(id);
    self.datasets.statusOf(id, status);
    self.datasets.styleOf(id, style);
  };

  self.init = function (id, styles, status) {
    jQuery(id).empty().append(elements.container);
    // Add all inputs
    for (let key in data) {
      self.datasets.add(data[key].id);
      self.datasets.statusOf(datasets[key].value(), status[key]);
      self.datasets.styleOf(datasets[key].value(), styles[key]);
    }
  };

  return self;
};

/*
 * @prettier
 */

'use strict';

const workerSrcPath = '../javascripts/pdf.js/build/pdf.worker.js';

if (typeof pdfjsLib === 'undefined' || (!pdfjsLib && !pdfjsLib.getDocument)) {
  console.error('Please build the pdfjs-dist library using\n' + '  `gulp dist-install`');
}
// The workerSrc property shall be specified.
//
else pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrcPath;

const CMAP_URL = '../javascripts/pdf.js/build/generic/web/cmaps/',
  MARGIN_CHUNK = {
    top: 2,
    left: 2,
    bottom: 2,
    right: 2
  },
  MARGIN_IMAGE = {
    top: 15,
    left: 15,
    bottom: 15,
    right: 15
  },
  CMAP_PACKED = true,
  BORDER_WIDTH = 4, // Need to be an even number
  SELECTED_BORDER_WIDTH = 6,
  REMOVED_BORDER_COLOR = false,
  HOVER_BORDER_COLOR = 'rgba(0, 0, 0, 1)',
  SELECTED_BORDER_COLOR = 'rgba(105, 105, 105, 1)';

// Representation of a chunk in PDF
const Chunk = function (data, scale) {
  this.x = Math.floor((parseFloat(data.x) - MARGIN_CHUNK.left) * scale);
  this.y = Math.floor((parseFloat(data.y) - MARGIN_CHUNK.top) * scale);
  this.w = Math.ceil((parseFloat(data.w) + MARGIN_CHUNK.left + MARGIN_CHUNK.right) * scale);
  this.h = Math.ceil((parseFloat(data.h) + MARGIN_CHUNK.top + MARGIN_CHUNK.bottom) * scale);
  this.p = parseInt(data.p, 10);
  return this;
};

// Representation of a line in PDF
const Line = function (first) {
  this.chunks = [];
  this.h = 0;
  this.w = 0;
  this.yMid = { sum: 0, coeff: 0, avg: 0 };
  this.min = { x: Infinity, y: Infinity };
  this.max = { x: -Infinity, y: -Infinity };
  this.p = undefined;
  if (typeof first !== 'undefined') this.addChunk(first);
  return this;
};

// Get all chunks of this Line
Line.prototype.chunks = function () {
  return this.chunks;
};

// Add chunk to this line
Line.prototype.addChunk = function (input) {
  let chunk = input instanceof Chunk ? input : new Chunk(input),
    xMin = chunk.x,
    xMax = chunk.x + chunk.w,
    yMin = chunk.y,
    yMax = chunk.y + chunk.h;
  if (this.min.x > xMin) this.min.x = xMin;
  if (this.max.x < xMax) this.max.x = xMax;
  if (this.min.y > yMin) this.min.y = yMin;
  if (this.max.y < yMax) this.max.y = yMax;
  this.yMid.sum += (chunk.y + chunk.h / 2) * chunk.w;
  this.yMid.coeff += chunk.w;
  this.yMid.avg = this.yMid.sum / this.yMid.coeff;
  this.w = this.max.x - this.min.x;
  this.h = this.max.y - this.min.y;
  if (typeof this.p === 'undefined') this.p = chunk.p;
  this.chunks.push(chunk);
};

// Check if a chunk is in this line
Line.prototype.isIn = function (chunk) {
  if (this.chunks.length <= 0) return true; // If there is no chunk, it will be "in" by default
  let xMin = chunk.x,
    xMax = chunk.x + chunk.w,
    yMin = chunk.y,
    yMax = chunk.y + chunk.h,
    yMiddle = chunk.y + chunk.h / 2,
    samePage = this.p === chunk.p,
    outY = yMiddle > this.max.y || yMiddle < this.min.y,
    outX = xMax < this.min.x;
  return samePage && !outY && !outX;
};

// Representation of multipes lines in PDF (atteched to a given sentence)
const Lines = function (chunks, scale) {
  this.collection = [new Line()];
  if (Array.isArray(chunks)) this.addChunks(chunks, scale);
  return this;
};

// Get of all lines
Lines.prototype.all = function () {
  return this.collection;
};

// Get last line
Lines.prototype.getLast = function () {
  return this.collection[this.collection.length - 1];
};

// Create a new line
Lines.prototype.newLine = function (chunk) {
  return this.collection.push(new Line(chunk));
};

// Add chunk to this group of lines
Lines.prototype.addChunks = function (chunks = [], scale = 1) {
  for (let i = 0; i < chunks.length; i++) {
    let line = this.getLast(),
      item = chunks[i],
      chunk = new Chunk(item, scale);
    if (line.isIn(chunk)) line.addChunk(chunk);
    else this.newLine(chunk);
  }
};

// Represent an Area
const Area = function (opts, first) {
  this.lines = [];
  this.sentenceId = opts.sentenceId;
  this.h = 0;
  this.w = 0;
  this.min = { x: Infinity, y: Infinity };
  this.max = { x: -Infinity, y: -Infinity };
  this.p = undefined;
  if (typeof first !== 'undefined') this.addLine(first);
  return this;
};

// Get All lines of this Area
Area.prototype.getLines = function () {
  return this.lines;
};

// Add line to this Area
Area.prototype.addLine = function (line) {
  let xMin = line.min.x,
    xMax = line.min.x + line.w,
    yMin = line.min.y,
    yMax = line.min.y + line.h;
  if (this.min.x > xMin) this.min.x = xMin;
  if (this.max.x < xMax) this.max.x = xMax;
  if (this.min.y > yMin) this.min.y = yMin;
  if (this.max.y < yMax) this.max.y = yMax;
  this.w = this.max.x - this.min.x;
  this.h = this.max.y - this.min.y;
  if (typeof this.p === 'undefined') this.p = line.p;
  this.lines.push(line);
};

// Check if line is next to this Area
Area.prototype.isNext = function (line, margin) {
  if (this.lines.length === 0) return true; // If there is no lines, it will be "next" by default
  let middle = line.min.y + line.h / 2,
    delta = typeof margin !== 'undefined' ? margin : line.h,
    samePage = this.p === line.p,
    isTooUnder = middle - delta > this.max.y,
    isTooUpper = middle + delta < this.min.y;
  return samePage && !isTooUpper && !isTooUnder;
};

// Represent a group of Areas
const Areas = function (paragraph, interlines) {
  this.collection = [];
  this.sentenceId = paragraph.sentenceId;
  this.interlines = interlines;
  this.newArea();
  if (Array.isArray(paragraph.lines)) this.addLines(paragraph.lines);
  return this;
};

// Create a new Area
Areas.prototype.newArea = function (line) {
  return this.collection.push(new Area({ sentenceId: this.sentenceId }, line));
};

// Get Last Area
Areas.prototype.getLast = function () {
  return this.collection[this.collection.length - 1];
};

// Get all Areas
Areas.prototype.all = function () {
  return this.collection;
};

// Add Lines to Areas
Areas.prototype.addLines = function (lines = []) {
  for (let i = 0; i < lines.length; i++) {
    let area = this.getLast(),
      line = lines[i];
    if (area.isNext(line, this.interlines[lines[i].p])) area.addLine(line);
    else this.newArea(line);
  }
};

const PdfViewer = function (id, screenId, events = {}) {
  let self = this;
  this.containerId = id;
  this.screenId = screenId;
  // HTML elements
  this.screen = $(`#${this.screenId}`);
  this.screenElement = this.screen.get(0);
  this.viewerId = id + 'Viewer';
  this.container = $(`#${this.containerId}`);
  this.containerElement = this.container.get(0);
  this.viewer = $(`<div id="${this.viewerId}" class="pdfViewer"></div>`);
  this.viewerElement = this.viewer.get(0);
  this.infos = $(`<div id="${this.viewerId}Infos" class="display-left"></div>`);
  this.infosElement = this.infos.get(0);
  this.message = $(`<div id="${this.viewerId}Message" class="display-left"></div>`);
  this.messageElement = this.infos.get(0);
  this.scrollMarkers = $(`<div id="${this.viewerId}ScrollMarkers" class="display-left"></div>`);
  this.scrollMarkersElement = this.scrollMarkers.get(0);
  this.container.append(this.infos).append(this.message).append(this.viewer);
  this.scrollMarkersCursor = $('<span class="cursor"></span>');
  this.scrollMarkersCursorElement = this.scrollMarkersCursor.get(0);
  this.scrollMarkers.append(this.scrollMarkersCursor); // Add cursor in scroll Markers
  this.screen.append(this.scrollMarkers);
  // pdf properties
  this.pdfLoaded = false;
  this.pdfDocument;
  this.pdfPages = {}; // cached render pages
  this.currentPage = 0;
  this.sentencesMapping = { object: undefined, array: undefined };
  // metadata properties
  this.metadata = {};
  // links properties
  this.links = {};
  // Events
  this.events = events;
  return this;
};

// Get order of appearance of sentences
PdfViewer.prototype.getSentences = function (selectedSentences, lastSentence) {
  let sentences = [lastSentence].concat(selectedSentences),
    min = Infinity,
    max = -Infinity;
  for (let i = 0; i < sentences.length; i++) {
    let index = this.sentencesMapping.array.indexOf(sentences[i].sentenceId);
    min = index > -1 && index < min ? index : min;
    max = index > -1 && index > max ? index : max;
  }
  if (min !== Infinity && max !== -Infinity) return this.sentencesMapping.array.slice(min, max + 1);
  else return [];
};

// Get order of appearance of sentences
PdfViewer.prototype.getSentencesMapping = function () {
  if (typeof this.sentencesMapping.object !== 'undefined') return this.sentencesMapping.object;
  let result = {},
    sentences = {};
  // Get useful infos about sentences
  for (let page in this.metadata.pages) {
    for (let sentenceId in this.metadata.pages[page].sentences) {
      sentences[sentenceId] = {
        sentenceId: sentenceId,
        page: page,
        minY: this.metadata.sentences[sentenceId].pages[page].min.y,
        column: this.metadata.sentences[sentenceId].pages[page].columns[
          this.metadata.sentences[sentenceId].pages[page].columns.length - 1
        ]
      };
    }
  }
  // Sort sentences & store result
  Object.values(sentences)
    .sort(function (a, b) {
      if (a.page !== b.page) return a.page - b.page;
      else if (a.column !== b.column) return a.column - b.column;
      else if (a.minY !== b.minY) return a.minY - b.minY;
      else return 0;
    })
    .map(function (sentence, index) {
      result[sentence.sentenceId] = index;
    });
  this.sentencesMapping.object = result;
  this.sentencesMapping.array = new Array(Object.keys(result).length);
  for (var key in result) {
    this.sentencesMapping.array[parseInt(result[key])] = key;
  }
  return result;
};

// Render the PDF
PdfViewer.prototype.load = function (pdf, xmlMetadata, cb) {
  console.log('Loading PDF...');
  let self = this;
  this.viewer.empty();
  return this.loadPDF(pdf.url, function (err, pdfDocument) {
    console.log('Load of PDF done.');
    self.pdfLoaded = true;
    self.pdfDocument = pdfDocument;
    let metadata = {
      pages: pdf.metadata.pages,
      sentences: pdf.metadata.sentences,
      links: xmlMetadata.links,
      colors: xmlMetadata.colors
    };
    self.metadata = metadata;
    self.renderPage({ numPage: 1 }, function (err) {
      return cb(err);
    });
  });
};

// show message
PdfViewer.prototype.showMessage = function (text, cb) {
  if (text) this.message.text(text);
  this.message.show('fast', function () {
    return cb();
  });
};

// Hide message
PdfViewer.prototype.hideMessage = function () {
  this.message.hide('fast');
};

// Get Pages of a given datasetId
PdfViewer.prototype.getPagesOfDataset = function (id) {
  if (
    this.links &&
    Array.isArray(this.links[id]) &&
    this.links[id].length &&
    typeof this.metadata.sentences[this.links[id][0]].pages === 'object'
  )
    return Object.keys(this.metadata.sentences[this.links[id][0]].pages).map(function (item) {
      return parseInt(item, 10);
    });
  else return [];
};

// Get Pages of a given sentenceId
PdfViewer.prototype.getPagesOfSentence = function (id) {
  if (this.metadata.sentences)
    return Object.keys(this.metadata.sentences[id].pages).map(function (item) {
      return parseInt(item, 10);
    });
  else return [];
};

// Get Pages
PdfViewer.prototype.getPages = function () {
  if (this.pdfDocument) return Array.from({ length: this.pdfDocument.numPages }, (_, i) => i + 1);
  else return [];
};

// Insert Pages
PdfViewer.prototype.insertPage = function (numPage, page) {
  // delete older version of this page
  $(`#pdfViewer div[data-page-number="${numPage}"]`).remove();
  let inserted = false,
    previous;
  for (let i = numPage - 1; i >= 0; i--) {
    previous = $(`#pdfViewer div[data-page-number="${i}"]`);
    if (previous.get(0)) {
      inserted = true;
      previous.after(page);
      break;
    }
  }
  if (!inserted) this.viewerElement.appendChild(page);
};

// Get PdfPages
PdfViewer.prototype.getPdfPage = function (numPage, cb) {
  let self = this;
  if (this.pdfPages && this.pdfPages[numPage]) return cb(null, this.pdfPages[numPage]);
  else
    return this.pdfDocument
      .getPage(numPage)
      .then(function (pdfPage) {
        self.pdfPages[numPage] = pdfPage;
        return cb(null, pdfPage);
      })
      .catch((err) => {
        console.log(err);
        return cb(err);
      });
};

// Get PdfPages
PdfViewer.prototype.setPage = function (numPage) {
  this.infos.empty().append(`Page ${numPage}/${this.pdfDocument.numPages}`);
};

// hide scroll markers
PdfViewer.prototype.hideMarkers = function () {
  /*this.screen.removeClass('no-scroll');*/
  this.scrollMarkers.hide();
};

// hide scroll markers
PdfViewer.prototype.showMarkers = function () {
  /*this.screen.addClass('no-scroll');*/
  this.scrollMarkers.show();
};

// Refresh scroll cursor
PdfViewer.prototype.refreshScrollCursor = function (scrollInfos) {
  let spanTop = scrollInfos.position,
    spanBottom = spanTop + this.screen.height(),
    markerTop = Math.floor((spanTop * this.screen.height()) / this.container.prop('scrollHeight')),
    markerBottom = Math.floor((spanBottom * this.screen.height()) / this.container.prop('scrollHeight'));
  this.scrollMarkersCursorElement.style.top = markerTop + 'px';
  this.scrollMarkersCursorElement.style.height = markerBottom - markerTop + 'px';
};

// Get PdfPages
PdfViewer.prototype.onScroll = function (scrollInfos, direction) {
  let self = this;
  this.currentPage = this.refreshNumPage(scrollInfos);
  this.refreshScrollCursor(scrollInfos);
  if (direction > 0) {
    this.renderNextPage(function (err, res) {
      self.refreshScrollCursor(scrollInfos);
    });
  } else {
    this.renderPreviousPage(function (err, res) {
      self.refreshScrollCursor(scrollInfos);
    });
  }
};

// Get PdfPages
PdfViewer.prototype.refreshNumPage = function (scrollInfos) {
  let pages = this.viewer.find('div[class="page"]'),
    maxHeight = this.viewer.outerHeight(),
    height = 0,
    coeff = scrollInfos.position / scrollInfos.height,
    numPage = 0;
  for (let i = 0; i < pages.length; i++) {
    let page = pages[i],
      el = $(page);
    height += el.outerHeight();
    numPage = parseInt(el.attr('data-page-number'), 10);
    if (height / maxHeight > coeff) break;
  }
  this.infos.empty().append(`Page ${numPage}/${this.pdfDocument.numPages}`);
  return numPage;
};

// Load PDF file
PdfViewer.prototype.loadPDF = function (url, cb) {
  let self = this;
  let loadingTask = pdfjsLib.getDocument({
    url: url,
    cMapUrl: CMAP_URL,
    cMapPacked: CMAP_PACKED
  });
  return loadingTask.promise
    .then(function (pdfDocument) {
      return cb(null, pdfDocument);
    })
    .catch(function (err) {
      console.log(err);
      self.container.empty().append('<div>An error has occurred while processing the document</div>');
      return cb(err);
    });
};

// Render a given page
PdfViewer.prototype.renderUntilPage = function (numPage, cb) {
  // Loading document
  let self = this;
  return async.eachSeries(
    Array.from({ length: numPage }, (_, i) => i + 1),
    function (numPage, callback) {
      return self.renderPage({ numPage: numPage }, function (err, res) {
        return callback(err);
      });
    },
    function (err) {
      if (err) console.log(err);
      return cb(err);
    }
  );
};

// Render given pages
PdfViewer.prototype.renderPages = function (numPages, cb) {
  // Loading document
  let self = this;
  return async.eachSeries(
    numPages,
    function (numPage, callback) {
      return self.renderPage({ numPage: numPage }, function (err, res) {
        return callback(err);
      });
    },
    function (err) {
      if (err) console.log(err);
      return cb(err);
    }
  );
};

// Render next page (or nothing if all pages already rendered)
PdfViewer.prototype.renderNextPage = function (cb) {
  let self = this;
  let numPage = this.currentPage + 1;
  if (numPage <= this.pdfDocument.numPages) {
    return this.renderPage({ numPage: numPage }, function (err, numPage) {
      return cb(err, numPage);
    });
  } else return cb();
};

// Render next page (or nothing if all pages already rendered)
PdfViewer.prototype.renderPreviousPage = function (cb) {
  let self = this;
  let numPage = this.currentPage - 1;
  if (numPage <= this.pdfDocument.numPages) {
    return this.renderPage({ numPage: numPage }, function (err, numPage) {
      return cb(err, numPage);
    });
  } else return cb();
};

// Refresh markers
PdfViewer.prototype.refreshMarkers = function () {
  let self = this;
  return this.scrollMarkers.find('span.marker').map(function () {
    let marker = $(this),
      markerElement = marker.get(0),
      sentenceId = marker.attr('sentenceId'),
      spanTop = self._scrollToSentence(sentenceId),
      spanBottom = spanTop + parseInt(marker.attr('contour-height')),
      spanLeft = parseInt(marker.attr('contour-left')),
      spanRight = spanLeft + parseInt(marker.attr('contour-width')),
      markerTop = Math.floor((spanTop * self.screen.height()) / self.container.prop('scrollHeight')),
      markerBottom = Math.floor((spanBottom * self.screen.height()) / self.container.prop('scrollHeight')),
      markerLeft = Math.floor((spanLeft * self.screen.width()) / self.container.width()),
      markerRight = Math.floor((spanRight * self.screen.width()) / self.container.width()),
      coeff = self.scrollMarkers.outerWidth() / self.container.outerWidth();
    markerElement.style.top = markerTop + 'px';
    markerElement.style.left = parseInt(markerLeft * coeff) + 'px';
    markerElement.style.height = markerBottom - markerTop + 'px';
    markerElement.style.width = parseInt((markerRight - markerLeft) * coeff) + 'px';
  });
};

// Insert datasets
PdfViewer.prototype.insertDatasets = function (numPage) {
  let self = this,
    links = this.metadata.links;
  for (let i = 0; i < links.length; i++) {
    if (
      this.getPagesOfSentence(links[i].sentenceId).indexOf(numPage) > -1 &&
      this.metadata.colors[links[i].dataset.id] &&
      this.metadata.colors[links[i].dataset.id].background &&
      this.metadata.colors[links[i].dataset.id].background.rgb
    ) {
      self.addDataset(links[i].dataset, links[i].sentenceId);
    }
  }
};

// Render a given page
PdfViewer.prototype.renderPage = function (opts, cb) {
  let self = this,
    force = !!opts.force,
    numPage = opts.numPage;
  if (!numPage) return cb(new Error('numPage required'));
  else if (!force && this.viewer.find(`.page[data-page-number="${numPage}"]`).get(0)) return cb();
  else
    return this.showMessage(`Loading Page ${numPage}...`, function () {
      return self.getPdfPage(numPage, function (err, pdfPage) {
        if (err) return cb(err);
        let desiredWidth = self.viewerElement.offsetWidth,
          viewport_tmp = pdfPage.getViewport({ scale: 1 }),
          the_scale = desiredWidth / viewport_tmp.width,
          viewport = pdfPage.getViewport({ scale: the_scale }),
          page = self.buildEmptyPage(numPage, viewport.width, viewport.height),
          canvas = page.querySelector('canvas'),
          wrapper = page.querySelector('.canvasWrapper'),
          container = page.querySelector('.textLayer'),
          canvasContext = canvas.getContext('2d');
        // Insert page
        self.insertPage(numPage, page);
        return pdfPage
          .render({
            canvasContext: canvasContext,
            viewport: viewport
          })
          .promise.then(function () {
            // Build Contours
            let contours = self.buildAreas(the_scale, numPage);
            // Insert Contours
            contours.map(function (contour) {
              self.insertContours(contour);
            });
            // Insert Sentences
            self.insertSentences(the_scale, numPage);
            self.insertDatasets(numPage);
            // refresh markers scroll
            self.refreshMarkers();
            page.setAttribute('data-loaded', 'true');
            self.hideMessage();
            return cb(null, numPage);
          })
          .catch(function (err) {
            console.log(err);
            return cb(err);
          });
      });
    });
};

// Refresh pdf display
PdfViewer.prototype.refresh = function (cb) {
  if (!self.pdfDocument) {
    // Loading document
    let self = this;
    return async.eachSeries(
      this.getPages(),
      function (numPage, callback) {
        return self.renderPage({ numPage: numPage, force: true }, function (err, res) {
          console.log(err);
          return callback(err);
        });
      },
      function (err) {
        if (err) console.log(err);
        return cb(err);
      }
    );
  } else return cb(new Error('PDF cannot be refreshed'));
};

// Build all Areas
PdfViewer.prototype.buildAreas = function (scale, numPage) {
  let paragraphs = [],
    interlines = {},
    result = [];
  if (this.metadata.pages[numPage] && this.metadata.pages[numPage].sentences) {
    for (let sentenceId in this.metadata.pages[numPage].sentences) {
      if (
        this.metadata.sentences[sentenceId] &&
        this.metadata.sentences[sentenceId].areas &&
        this.metadata.sentences[sentenceId].areas.length > 0
      ) {
        // Calculate interlines
        this.metadata.sentences[sentenceId].areas.map(function (areas) {
          for (let key in areas.interlines) {
            interlines[key] = areas.interlines[key] * scale;
          }
        });
      }
      // Calculate chunks
      let chunks = this.metadata.sentences[sentenceId].chunks.filter(function (chunk) {
        return parseInt(chunk.p, 10) === numPage;
      });
      let lines = {
        'lines': new Lines(chunks, scale).all(),
        'sentenceId': sentenceId
      };
      paragraphs.push(lines);
    }
    // Create new areas
    for (let i = 0; i < paragraphs.length; i++) {
      result.push(new Areas(paragraphs[i], interlines).all());
    }
  }
  return result;
};

// Insert contours of lines
PdfViewer.prototype.insertContours = function (areas) {
  if (Array.isArray(areas)) {
    for (let i = 0; i < areas.length; i++) {
      this.container.find(`.page[data-page-number="${areas[i].p}"] .contoursLayer`).append(this.buildBorders(areas[i]));
    }
    return true;
  } else return null;
};

// Build borders
PdfViewer.prototype.buildBorders = function (area) {
  let container = $('<div>'),
    borders = this.getCanvas(area);
  container
    .attr('sentenceId', area.sentenceId)
    .attr('contour-width', area.w)
    .attr('contour-height', area.h)
    .attr('contour-top', area.min.y)
    .attr('contour-left', area.min.x)
    .attr('class', 'contour');
  borders.map(function (item) {
    return container.append(item);
  });
  return container;
};

// Add sentence
PdfViewer.prototype.insertSentences = function (scale, numPage) {
  let self = this,
    annotationsContainer = this.container.find(`.page[data-page-number="${numPage}"] .annotationsLayer`);
  if (this.metadata.pages[numPage] && this.metadata.pages[numPage].sentences)
    for (let sentenceId in this.metadata.pages[numPage].sentences) {
      let chunks = this.metadata.sentences[sentenceId].chunks.filter(function (chunk) {
        return parseInt(chunk.p, 10) === numPage;
      });
      for (let i = 0; i < chunks.length; i++) {
        let chunk = chunks[i],
          ch = new Chunk(chunk, scale);
        //make events the area
        let element = document.createElement('s'),
          attributes = `width:${ch.w}px; height:${ch.h}px; position:absolute; top:${ch.y}px; left:${ch.x}px;`;
        element.setAttribute('style', attributes);
        element.setAttribute('sentenceId', sentenceId);
        element.setAttribute('isPdf', true);
        // the link here goes to the bibliographical reference
        element.onclick = function () {
          let el = $(this);
          if (typeof self.events.onClick === 'function') return self.events.onClick(el.attr('sentenceId'));
        };
        element.onmouseover = function () {
          let el = $(this);
          if (typeof self.events.onHover === 'function') return self.events.onHover(el.attr('sentenceId'));
        };
        element.onmouseout = function () {
          let el = $(this);
          if (typeof self.events.onEndHover === 'function') return self.events.onEndHover(el.attr('sentenceId'));
        };
        annotationsContainer.append(element);
      }
    }
};

// Build an empty page
PdfViewer.prototype.buildEmptyPage = function (num, width, height) {
  let page = document.createElement('div'),
    canvas = document.createElement('canvas'),
    wrapper = document.createElement('div'),
    textLayer = document.createElement('div'),
    annotationsLayer = document.createElement('div'),
    contoursLayer = document.createElement('div');

  page.className = 'page';
  wrapper.className = 'canvasWrapper';
  textLayer.className = 'textLayer';
  contoursLayer.className = 'contoursLayer';
  annotationsLayer.className = 'annotationsLayer';

  page.setAttribute('data-loaded', 'false');
  page.setAttribute('data-page-number', num);

  canvas.width = width;
  canvas.height = height;
  page.style.width = `${width}px`;
  page.style.height = `${height}px`;
  page.style.border = '0px';
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  textLayer.style.width = `${width}px`;
  textLayer.style.height = `${height}px`;
  contoursLayer.style.width = `${width}px`;
  contoursLayer.style.height = `${height}px`;
  annotationsLayer.style.width = `${width}px`;
  annotationsLayer.style.height = `${height}px`;

  canvas.setAttribute('id', `page${num}`);

  page.appendChild(wrapper);
  page.appendChild(textLayer);
  page.appendChild(contoursLayer);
  page.appendChild(annotationsLayer);
  wrapper.appendChild(canvas);

  return page;
};

// Set events on an element (a contour)
PdfViewer.prototype.setEvents = function (items) {
  let self = this;
  for (let i = 0; i < items.length; i++) {
    let item = items[i];
    let element = item.get(0);
    // the link here goes to the bibliographical reference
    element.onclick = function () {
      let el = $(this);
      if (typeof self.events.onClick === 'function') return self.events.onClick(el.attr('sentenceId'));
    };
    element.onmouseover = function () {
      let el = $(this);
      self.viewer.find(`.contour[sentenceId="${el.attr('sentenceId')}"]`).addClass('hover');
      if (typeof self.events.onHover === 'function') return self.events.onHover(el.attr('sentenceId'));
    };
    element.onmouseout = function () {
      let el = $(this);
      self.viewer.find(`.contour[sentenceId="${el.attr('sentenceId')}"]`).removeClass('hover');
      if (typeof self.events.onEndHover === 'function') return self.events.onEndHover(el.attr('sentenceId'));
    };
  }
};

// Insert marker in scrollbar
PdfViewer.prototype.addMarker = function (dataset) {
  let self = this,
    contours = this.viewer.find(`.contoursLayer > .contour[sentenceId="${dataset.sentenceId}"]`);
  return contours.map(function () {
    let contour = $(this),
      canvas = contour.find('canvas').first(),
      spanTop = self._scrollToSentence(dataset.sentenceId),
      spanBottom = spanTop + parseInt(contour.attr('contour-height')),
      spanLeft = parseInt(contour.attr('contour-left')),
      spanRight = spanLeft + parseInt(contour.attr('contour-width')),
      markerTop = Math.floor((spanTop * self.screen.height()) / self.container.prop('scrollHeight')),
      markerBottom = Math.floor((spanBottom * self.screen.height()) / self.container.prop('scrollHeight')),
      markerLeft = Math.floor((spanLeft * self.screen.width()) / self.container.width()),
      markerRight = Math.floor((spanRight * self.screen.width()) / self.container.width()),
      markerElement = document.createElement('span'),
      marker = $(markerElement),
      coeff = self.scrollMarkers.outerWidth() / self.container.outerWidth();
    markerElement.style.backgroundColor = dataset.color.background.rgb;
    markerElement.style.top = markerTop + 'px';
    markerElement.style.left = parseInt(markerLeft * coeff) + 'px';
    markerElement.style.height = markerBottom - markerTop + 'px';
    markerElement.style.width = parseInt((markerRight - markerLeft) * coeff) + 'px';
    self.scrollMarkersElement.appendChild(markerElement);
    marker.addClass('marker');
    marker.attr('sentenceId', dataset.sentenceId);
    marker.attr('contour-height', contour.attr('contour-height'));
    marker.attr('contour-left', contour.attr('contour-left'));
    marker.attr('contour-width', contour.attr('contour-width'));
    marker.click(function () {
      return canvas.click();
    });
  });
};

// Remove marker in scrollbar
PdfViewer.prototype.removeMarker = function (dataset) {
  this.scrollMarkers.find(`span[sentenceId="${dataset.sentenceId}"]`).remove();
};

// Update marker in scrollbar
PdfViewer.prototype.updateMarker = function (dataset) {
  this.scrollMarkers
    .find(`span[sentenceId="${dataset.sentenceId}"]`)
    .css('background-color', dataset.color.background.rgb);
};

// Set Color to a sentence
PdfViewer.prototype.colorize = function (dataset, sentenceId) {};

// Unset Color to a sentence
PdfViewer.prototype.uncolorize = function (dataInstanceId, sentenceId) {};

// Add a link
PdfViewer.prototype.addLink = function (dataset, sentenceId) {
  if (typeof this.links[dataset.id] === 'undefined') this.links[dataset.id] = [];
  this.links[dataset.id].push(sentenceId);
  this.links[dataset.id].sort();
  let contour = this.viewer.find(`.contoursLayer > .contour[sentenceId="${sentenceId}"]`);
  contour.attr('color', dataset.color.background.rgb);
  let colors = contour.attr('colors') ? JSON.parse(contour.attr('colors')) : {};
  colors[dataset.dataInstanceId] = dataset.color;
  contour.attr('colors', JSON.stringify(colors));
  if (contour.attr('corresp')) {
    contour.attr(
      'datasets',
      (contour.attr('corresp').replace(`#${dataset.dataInstanceId}`, '') + ` #${dataset.dataInstanceId}`).trim()
    );
  } else {
    contour.attr('corresp', `#${dataset.dataInstanceId}`);
  }
  let annotation = this.viewer.find(`.annotationsLayer > s[sentenceId="${sentenceId}"]`);
  if (annotation.attr('corresp')) {
    annotation.attr('corresp', annotation.attr('corresp') + ` #${dataset.dataInstanceId}`);
  } else {
    annotation.attr('corresp', `#${dataset.dataInstanceId}`);
  }
  this.setCanvasColor(sentenceId, BORDER_WIDTH, dataset.color.background.rgb);
  this.addMarker({ sentenceId: sentenceId, color: dataset.color });
};

// Remove a link
PdfViewer.prototype.removeLink = function (dataset, sentenceId) {
  this.links[dataset.id].splice(this.links[dataset.id].indexOf(sentenceId), 1);
  let contour = this.viewer.find(`.contoursLayer > .contour[sentenceId="${sentenceId}"]`);
  let colors = contour.attr('colors') ? JSON.parse(contour.attr('colors')) : {};
  delete colors[dataset.dataInstanceId];
  let keys = Object.keys(colors);
  if (keys.length > 0) {
    let lastColor = colors[keys[keys.length - 1]];
    contour.attr('colors', JSON.stringify(colors));
    contour.attr('color', lastColor.background.rgb);
    this.setCanvasColor(sentenceId, BORDER_WIDTH, lastColor.background.rgb);
    this.updateMarker({ sentenceId: sentenceId, color: lastColor });
  } else {
    contour.removeAttr('colors');
    contour.removeAttr('color');
    this.setCanvasColor(sentenceId, BORDER_WIDTH, REMOVED_BORDER_COLOR);
    this.removeMarker({ sentenceId: sentenceId });
  }
  contour.attr('corresp', contour.attr('corresp').replace(`#${dataset.dataInstanceId}`, '').trim());
  if (contour.attr('corresp') === '') contour.removeAttr('corresp');
  let annotation = this.viewer.find(`.annotationsLayer > s[sentenceId="${sentenceId}"]`);
  annotation.attr('corresp', annotation.attr('corresp').replace(`#${dataset.dataInstanceId}`, '').trim());
  if (annotation.attr('corresp') === '') annotation.removeAttr('corresp');
};

// Remove some links
PdfViewer.prototype.removeLinks = function (dataset) {
  let ids = [...this.links[dataset.id]];
  for (let i = 0; i < ids.length; i++) {
    this.removeLink(dataset, ids[i]);
  }
};

// Add a dataset
PdfViewer.prototype.addDataset = function (dataset, sentenceId) {
  this.addLink(dataset, sentenceId);
};

// Remove a dataset
PdfViewer.prototype.removeDataset = function (dataset) {
  this.removeLinks(dataset);
};

// Scroll to a sentence
PdfViewer.prototype.scrollToDataset = function (datasetId) {
  let element = this.viewer.find(`s[datasetId="${datasetId}"]`).first(),
    numPage = parseInt(element.parent().parent().attr('data-page-number'), 10),
    pages = this.viewer.find('div[class="page"]'),
    height = 0;
  for (let i = 0; i < pages.length; i++) {
    let page = pages[i],
      el = $(page),
      currentNumPage = parseInt(el.attr('data-page-number'), 10);
    if (currentNumPage === numPage) break;
    height += el.outerHeight();
  }
  this.currentPage = numPage;
  return height + element.position().top;
};

// Select a sentence
PdfViewer.prototype.scrollToSentence = function (id, cb) {
  let self = this,
    pages = this.getPagesOfSentence(id),
    allPages = this.getPages(),
    maxPage = Math.max(...pages);
  if (maxPage > 0) {
    let numPages = [];
    if (maxPage > 1) numPages.push(maxPage - 1);
    numPages.push(maxPage);
    if (allPages.length > 2 && maxPage < allPages[allPages.length - 2]) numPages.push(maxPage + 1);
    this.renderPages(numPages, function (err) {
      if (err) return cb(err);
      return cb(self._scrollToSentence(id));
    });
  } else return cb(new Error('invalid sentence id'));
};

// Scroll to a sentence
PdfViewer.prototype._scrollToSentence = function (sentenceId) {
  let element = this.viewer.find(`s[sentenceId="${sentenceId}"]`).first(),
    numPage = parseInt(element.parent().parent().attr('data-page-number'), 10),
    pages = this.viewer.find('div[class="page"]'),
    height = 0;
  for (let i = 0; i < pages.length; i++) {
    let page = pages[i],
      el = $(page),
      currentNumPage = parseInt(el.attr('data-page-number'), 10);
    if (currentNumPage === numPage) break;
    height += el.outerHeight();
  }
  this.currentPage = numPage;
  return height + element.position().top;
};

// selectSentence
PdfViewer.prototype.selectSentence = function (sentence) {
  let sentenceElement = this.viewer.find(`s[sentenceId="${sentence.sentenceId}"]`),
    contourElement = this.viewer.find(`.contoursLayer > .contour[sentenceId="${sentence.sentenceId}"]`);
  if (sentenceElement) sentenceElement.addClass('selected');
  if (contourElement) {
    contourElement.addClass('selected');
    this.selectCanvas(sentence.sentenceId, contourElement.attr('color'));
  }
};

// unselectSentence
PdfViewer.prototype.unselectSentence = function (sentence) {
  let sentenceElement = this.viewer.find(`s[sentenceId="${sentence.sentenceId}"]`),
    contourElement = this.viewer.find(`.contoursLayer > .contour[sentenceId="${sentence.sentenceId}"]`);
  if (sentenceElement) sentenceElement.removeClass('selected');
  if (contourElement) {
    contourElement.removeClass('selected');
    this.unselectCanvas(sentence.sentenceId);
  }
};

// hoverSentence
PdfViewer.prototype.hoverSentence = function (sentence) {
  return this.hoverCanvas(sentence.sentenceId, sentence.isSelected);
};

// endHoverSentence
PdfViewer.prototype.endHoverSentence = function (sentence) {
  this.endHoverCanvas(sentence.sentenceId, sentence.isSelected);
};

// displayLeft
PdfViewer.prototype.displayLeft = function () {
  this.infos.removeClass().addClass('display-left');
  this.message.removeClass().addClass('display-left');
  this.scrollMarkers.removeClass().addClass('display-left');
};

// displayRight
PdfViewer.prototype.displayRight = function () {
  this.infos.removeClass().addClass('display-right');
  this.message.removeClass().addClass('display-right');
  this.scrollMarkers.removeClass().addClass('display-right');
};

// Build borders
PdfViewer.prototype.unselectCanvas = function (sentenceId) {
  let color = this.viewer.find(`.contoursLayer > .contour[sentenceId="${sentenceId}"]`).attr('color');
  this.setCanvasColor(sentenceId, BORDER_WIDTH, color ? color : REMOVED_BORDER_COLOR);
};

// Build borders
PdfViewer.prototype.selectCanvas = function (sentenceId, color) {
  this.setCanvasColor(sentenceId, SELECTED_BORDER_WIDTH, color ? color : SELECTED_BORDER_COLOR, true);
};

// Build borders
PdfViewer.prototype.hoverCanvas = function (sentenceId, isSelected) {
  let color = this.viewer.find(`.contoursLayer > .contour[sentenceId="${sentenceId}"]`).attr('color');
  this.setCanvasColor(
    sentenceId,
    isSelected ? SELECTED_BORDER_WIDTH : BORDER_WIDTH,
    isSelected ? (color ? color : SELECTED_BORDER_COLOR) : color ? color : HOVER_BORDER_COLOR,
    isSelected
  );
};

// Build borders
PdfViewer.prototype.endHoverCanvas = function (sentenceId, isSelected) {
  let color = this.viewer.find(`.contoursLayer > .contour[sentenceId="${sentenceId}"]`).attr('color');
  this.setCanvasColor(
    sentenceId,
    isSelected ? SELECTED_BORDER_WIDTH : BORDER_WIDTH,
    isSelected ? (color ? color : SELECTED_BORDER_COLOR) : color ? color : REMOVED_BORDER_COLOR,
    isSelected
  );
};

// Build borders
PdfViewer.prototype.getSentenceDataURL = function (sentenceId) {
  let contour = this.viewer.find(`.contoursLayer > .contour[sentenceId="${sentenceId}"]`),
    p = this.getPagesOfSentence(sentenceId)[0],
    w = parseInt(contour.attr('contour-width')) + MARGIN_IMAGE.left + MARGIN_IMAGE.right,
    h = parseInt(contour.attr('contour-height')) + MARGIN_IMAGE.top + MARGIN_IMAGE.bottom,
    y = parseInt(contour.attr('contour-top')) - MARGIN_IMAGE.top,
    x = parseInt(contour.attr('contour-left')) - MARGIN_IMAGE.left;
  let mainCanvas = this.container.find(`canvas#page${p}`).get(0),
    newCanvas = $('<canvas>').attr('style', `width:${w}px; height:${h}px; position:absolute; top:${y}px; left:${x}px;`),
    canvasElement = newCanvas.get(0),
    ctx = canvasElement.getContext('2d');
  canvasElement.width = newCanvas.width();
  canvasElement.height = newCanvas.height();
  ctx.drawImage(mainCanvas, x, y, w, h, 0, 0, w, h);
  return canvasElement.toDataURL('image/jpeg');
};

// Draw multiple lines
PdfViewer.prototype.drawLines = function (canvas, lines, width, color = false, linedash = false) {
  let canvasElement = canvas.get(0),
    ctx = canvasElement.getContext('2d'),
    img = new Image();
  img.src = canvas.attr('data-url');
  img.onload = function () {
    ctx.drawImage(img, 0, 0);
    if (color) {
      if (linedash) ctx.setLineDash([15, 5]);
      else ctx.setLineDash([]);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      for (let i = 0; i < lines.length; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.floor(lines[i].x0), Math.floor(lines[i].y0));
        ctx.lineTo(Math.floor(lines[i].x1), Math.floor(lines[i].y1));
        ctx.stroke();
        ctx.closePath();
      }
    }
  };
};

// Set color to a canvas
PdfViewer.prototype.setCanvasColor = function (sentenceId, width, color, linedash = false) {
  let self = this,
    canvas = this.container
      .find(`.contour[sentenceId="${sentenceId}"] canvas[sentenceId="${sentenceId}"]`)
      .map(function () {
        let element = $(this);
        self.drawLines(element, JSON.parse(element.attr('borders')), width, color, linedash);
      });
};

// Build canvas
PdfViewer.prototype.buildCanvas = function (_x, _y, _w, _h, p, sentenceId, borders = []) {
  let x = Math.floor(_x),
    y = Math.floor(_y),
    w = Math.floor(_w),
    h = Math.floor(_h);
  let mainCanvas = this.container.find(`canvas#page${p}`).get(0),
    newCanvas = $('<canvas>')
      .attr('style', `width:${w}px; height:${h}px; position:absolute; top:${y}px; left:${x}px;`)
      .attr('sentenceId', sentenceId)
      .attr('borders', JSON.stringify(borders)),
    canvasElement = newCanvas.get(0),
    ctx = canvasElement.getContext('2d');
  canvasElement.width = newCanvas.width();
  canvasElement.height = newCanvas.height();
  ctx.drawImage(mainCanvas, x, y, w, h, 0, 0, w, h);
  newCanvas.attr('data-url', canvasElement.toDataURL('image/jpeg'));
  return newCanvas;
};

// Get squares of given area (usefull to display borders)
PdfViewer.prototype.getCanvas = function (area) {
  let self = this,
    lines = area.getLines(),
    container = {
      min: { x: Infinity, y: Infinity },
      max: { x: -Infinity, y: -Infinity },
      w: 0,
      h: 0
    },
    canvas = [];
  let sortedLines = lines.sort(function (a, b) {
    if (a.min.y === b.min.y) {
      return a.min.x < b.min.x;
    } else return a.min.y < b.min.y;
  });
  // calculate min/max values
  for (let i = 0; i < sortedLines.length; i++) {
    let square = sortedLines[i],
      min = {
        x: square.min.x - BORDER_WIDTH / 2,
        y: square.min.y - BORDER_WIDTH / 2
      },
      max = {
        x: square.max.x + BORDER_WIDTH / 2,
        y: square.max.y + BORDER_WIDTH / 2
      };
    container.min.x = min.x < container.min.x ? min.x : container.min.x;
    container.min.y = min.y < container.min.y ? min.y : container.min.y;
    container.max.x = max.x > container.max.x ? max.x : container.max.x;
    container.max.y = max.y > container.max.y ? max.y : container.max.y;
  }
  // height & width
  container.w = container.max.x - container.min.x;
  container.h = container.max.y - container.min.y;
  // Consctruction du contour
  let firstLine = sortedLines[0],
    secondLine = sortedLines.length === 1 ? sortedLines[0] : sortedLines[1],
    beforeLastLine = sortedLines.length < 2 ? sortedLines[sortedLines.length - 1] : sortedLines[sortedLines.length - 2],
    lastLine = sortedLines[sortedLines.length - 1],
    centerSquare = {};
  // calculate center square corners
  centerSquare.topLeftCorner = { x: firstLine.min.x, y: Math.round((secondLine.min.y + firstLine.max.y) / 2) };
  centerSquare.bottomRightCorner = { x: lastLine.max.x, y: Math.round((lastLine.min.y + beforeLastLine.max.y) / 2) };
  centerSquare.topRightCorner = { x: centerSquare.bottomRightCorner.x, y: centerSquare.topLeftCorner.y };
  centerSquare.bottomLeftCorner = { x: centerSquare.topLeftCorner.x, y: centerSquare.bottomRightCorner.y };
  // "round" shape of contour
  if (Math.abs(centerSquare.topLeftCorner.x - container.min.x) <= 2 * BORDER_WIDTH)
    centerSquare.topLeftCorner.x = container.min.x;
  if (Math.abs(centerSquare.topLeftCorner.y - container.min.y) <= 2 * BORDER_WIDTH)
    centerSquare.topLeftCorner.y = container.min.y;
  if (Math.abs(centerSquare.topRightCorner.x - container.max.x) <= 2 * BORDER_WIDTH)
    centerSquare.topRightCorner.x = container.max.x;
  if (Math.abs(centerSquare.topRightCorner.y - container.min.y) <= 2 * BORDER_WIDTH)
    centerSquare.topRightCorner.y = container.min.y;
  if (Math.abs(centerSquare.bottomLeftCorner.x - container.min.x) <= 2 * BORDER_WIDTH)
    centerSquare.bottomLeftCorner.x = container.min.x;
  if (Math.abs(centerSquare.bottomLeftCorner.y - container.max.y) <= 2 * BORDER_WIDTH)
    centerSquare.bottomLeftCorner.y = container.max.y;
  if (Math.abs(centerSquare.bottomRightCorner.x - container.max.x) <= 2 * BORDER_WIDTH)
    centerSquare.bottomRightCorner.x = container.max.x;
  if (Math.abs(centerSquare.bottomRightCorner.y - container.max.y) <= 2 * BORDER_WIDTH)
    centerSquare.bottomRightCorner.y = container.max.y;
  // Detect shape of contour-
  if (sortedLines.length === 2 && centerSquare.bottomRightCorner.x < centerSquare.topLeftCorner.x) {
    /*
     * case:
     * 0 1
     * 1 0
     * -> 2 canvas on 2 lines
     * shape is 2 different squares
     */
    canvas.push({
      min: { x: firstLine.min.x, y: container.min.y },
      max: { x: container.max.x, y: firstLine.max.y },
      borders: [
        { x0: firstLine.min.x, y0: container.min.y, x1: container.max.x, y1: container.min.y },
        { x0: container.max.x, y0: firstLine.max.y, x1: firstLine.min.x, y1: firstLine.max.y },
        { x0: firstLine.min.x, y0: container.min.y, x1: firstLine.min.x, y1: firstLine.max.y }
      ]
    });
    canvas.push({
      min: { x: lastLine.min.x, y: lastLine.min.y },
      max: { x: lastLine.max.x, y: container.max.y },
      borders: [
        { x0: lastLine.min.x, y0: lastLine.min.y, x1: lastLine.max.x, y1: lastLine.min.y },
        { x0: lastLine.max.x, y0: lastLine.min.y, x1: lastLine.max.x, y1: container.max.y },
        { x0: lastLine.min.x, y0: container.max.y, x1: lastLine.max.x, y1: container.max.y }
      ]
    });
  } else if (
    sortedLines.length === 1 ||
    (centerSquare.topLeftCorner.x === container.min.x &&
      centerSquare.bottomLeftCorner.x === container.min.x &&
      centerSquare.topRightCorner.x === container.max.x &&
      centerSquare.bottomRightCorner.x === container.max.x)
  ) {
    /*
     * case:
     * 1 1
     * 1 1
     * -> 1 canvas on 1 to N lines
     * shape is a square
     */
    canvas.push({
      min: { x: container.min.x, y: container.min.y },
      max: { x: container.max.x, y: container.max.y },
      borders: [
        { x0: container.min.x, y0: container.min.y, x1: container.max.x, y1: container.min.y },
        { x0: container.max.x, y0: container.min.y, x1: container.max.x, y1: container.max.y },
        { x0: container.max.x, y0: container.max.y, x1: container.min.x, y1: container.max.y },
        { x0: container.min.x, y0: container.max.y, x1: container.min.x, y1: container.min.y }
      ]
    });
  } else if (
    centerSquare.topLeftCorner.x === container.min.x &&
    centerSquare.bottomLeftCorner.x === container.min.x &&
    centerSquare.topRightCorner.x < container.max.x &&
    centerSquare.bottomRightCorner.x < container.max.x
  ) {
    /*
     * case:
     * 1 1
     * 1 0
     * -> 2 canvas
     */
    canvas.push({
      min: { x: container.min.x, y: container.min.y },
      max: { x: container.max.x, y: centerSquare.bottomRightCorner.y },
      borders: [
        { x0: container.min.x, y0: centerSquare.bottomRightCorner.y, x1: container.min.x, y1: container.min.y },
        { x0: container.min.x, y0: container.min.y, x1: container.max.x, y1: container.min.y },
        { x0: container.max.x, y0: container.min.y, x1: container.max.x, y1: centerSquare.bottomRightCorner.y },
        {
          x0: container.max.x,
          y0: centerSquare.bottomRightCorner.y,
          x1: centerSquare.bottomRightCorner.x - BORDER_WIDTH / 2,
          y1: centerSquare.bottomRightCorner.y
        }
      ]
    });
    canvas.push({
      min: { x: container.min.x, y: centerSquare.bottomRightCorner.y },
      max: { x: centerSquare.bottomRightCorner.x, y: container.max.y },
      borders: [
        { x0: container.min.x, y0: centerSquare.bottomRightCorner.y, x1: container.min.x, y1: container.max.y },
        { x0: container.min.x, y0: container.max.y, x1: centerSquare.bottomRightCorner.x, y1: container.max.y },
        {
          x0: centerSquare.bottomRightCorner.x,
          y0: container.max.y,
          x1: centerSquare.bottomRightCorner.x,
          y1: centerSquare.bottomRightCorner.y - BORDER_WIDTH / 2
        }
      ]
    });
  } else if (
    centerSquare.topLeftCorner.x > container.min.x &&
    centerSquare.bottomLeftCorner.x > container.min.x &&
    centerSquare.topRightCorner.x === container.max.x &&
    centerSquare.bottomRightCorner.x === container.max.x
  ) {
    /*
     * case:
     * 0 1
     * 1 1
     * -> 2 canvas
     */
    canvas.push({
      min: { x: centerSquare.topLeftCorner.x, y: container.min.y },
      max: { x: container.max.x, y: centerSquare.topLeftCorner.y },
      borders: [
        {
          x0: centerSquare.topLeftCorner.x,
          y0: centerSquare.topLeftCorner.y + BORDER_WIDTH / 2,
          x1: centerSquare.topLeftCorner.x,
          y1: container.min.y
        },
        { x0: centerSquare.topLeftCorner.x, y0: container.min.y, x1: container.max.x, y1: container.min.y },
        {
          x0: container.max.x,
          y0: container.min.y,
          x1: container.max.x,
          y1: centerSquare.topLeftCorner.y + BORDER_WIDTH / 2
        }
      ]
    });
    canvas.push({
      min: { x: container.min.x, y: centerSquare.topLeftCorner.y },
      max: { x: container.max.x, y: container.max.y },
      borders: [
        {
          x0: centerSquare.topLeftCorner.x + BORDER_WIDTH / 2,
          y0: centerSquare.topLeftCorner.y,
          x1: container.min.x,
          y1: centerSquare.topLeftCorner.y
        },
        { x0: container.min.x, y0: centerSquare.topLeftCorner.y, x1: container.min.x, y1: container.max.y },
        { x0: container.min.x, y0: container.max.y, x1: container.max.x, y1: container.max.y },
        {
          x0: container.max.x,
          y0: container.max.y,
          x1: container.max.x,
          y1: centerSquare.topRightCorner.y - BORDER_WIDTH / 2
        }
      ]
    });
  } else {
    if (centerSquare.topLeftCorner.x > centerSquare.bottomRightCorner.x) {
      /*
       * case:
       * 0 0 1
       * 1 1 1
       * 1 0 0
       * 3 canvas
       */
      // Be careful, here topLeftCorner is on the right of topRightCorner, so do not trust variable names
      canvas.push({
        min: { x: centerSquare.topLeftCorner.x, y: container.min.y },
        max: { x: container.max.x, y: centerSquare.topLeftCorner.y },
        borders: [
          {
            x0: centerSquare.topLeftCorner.x,
            y0: centerSquare.topLeftCorner.y + BORDER_WIDTH / 2,
            x1: centerSquare.topLeftCorner.x,
            y1: container.min.y
          },
          { x0: centerSquare.topLeftCorner.x, y0: container.min.y, x1: container.max.x, y1: container.min.y },
          {
            x0: container.max.x,
            y0: container.min.y,
            x1: container.max.x,
            y1: centerSquare.topLeftCorner.y + BORDER_WIDTH / 2
          }
        ]
      });
      // Be careful, here topLeftCorner is on the right of topRightCorner, so do not trust variable names
      canvas.push({
        min: { x: container.min.x, y: centerSquare.topLeftCorner.y },
        max: { x: container.max.x, y: centerSquare.bottomRightCorner.y },
        borders: [
          {
            x0: centerSquare.topLeftCorner.x + BORDER_WIDTH / 2,
            y0: centerSquare.topLeftCorner.y,
            x1: container.min.x,
            y1: centerSquare.topLeftCorner.y
          },
          {
            x0: container.min.x,
            y0: centerSquare.topLeftCorner.y,
            x1: container.min.x,
            y1: centerSquare.bottomRightCorner.y
          },
          {
            x0: centerSquare.bottomRightCorner.x - BORDER_WIDTH / 2,
            y0: centerSquare.bottomRightCorner.y,
            x1: container.max.x,
            y1: centerSquare.bottomRightCorner.y
          },
          {
            x0: container.max.x,
            y0: centerSquare.bottomRightCorner.y,
            x1: container.max.x,
            y1: centerSquare.topLeftCorner.y
          }
        ]
      });
      // Be careful, here topLeftCorner is on the right of topRightCorner, so do not trust variable names
      canvas.push({
        min: { x: container.min.x, y: centerSquare.bottomRightCorner.y },
        max: { x: centerSquare.bottomRightCorner.x, y: container.max.y },
        borders: [
          {
            x0: container.min.x,
            y0: centerSquare.bottomRightCorner.y - BORDER_WIDTH / 2,
            x1: container.min.x,
            y1: container.max.y
          },
          { x0: container.min.x, y0: container.max.y, x1: centerSquare.bottomRightCorner.x, y1: container.max.y },
          {
            x0: centerSquare.bottomRightCorner.x,
            y0: container.max.y,
            x1: centerSquare.bottomRightCorner.x,
            y1: centerSquare.bottomRightCorner.y - BORDER_WIDTH / 2
          }
        ]
      });
    } else {
      /*
       * case:
       * 0 1 1
       * 1 1 1
       * 1 1 0
       * 2 canvas
       */
      canvas.push({
        min: { x: centerSquare.topLeftCorner.x, y: container.min.y },
        max: { x: container.max.x, y: centerSquare.bottomRightCorner.y },
        borders: [
          {
            x0: centerSquare.topLeftCorner.x,
            y0: centerSquare.topLeftCorner.y,
            x1: centerSquare.topLeftCorner.x,
            y1: container.min.y
          },
          { x0: centerSquare.topLeftCorner.x, y0: container.min.y, x1: container.max.x, y1: container.min.y },
          { x0: container.max.x, y0: container.min.y, x1: container.max.x, y1: centerSquare.bottomRightCorner.y },
          {
            x0: container.max.x,
            y0: centerSquare.bottomRightCorner.y,
            x1: centerSquare.bottomRightCorner.x - BORDER_WIDTH / 2,
            y1: centerSquare.bottomRightCorner.y
          }
        ]
      });
      canvas.push({
        min: { x: container.min.x, y: centerSquare.topLeftCorner.y },
        max: { x: centerSquare.bottomRightCorner.x, y: container.max.y },
        borders: [
          {
            x0: centerSquare.topLeftCorner.x + BORDER_WIDTH / 2,
            y0: centerSquare.topLeftCorner.y,
            x1: container.min.x,
            y1: centerSquare.topLeftCorner.y
          },
          { x0: container.min.x, y0: centerSquare.topLeftCorner.y, x1: container.min.x, y1: container.max.y },
          { x0: container.min.x, y0: container.max.y, x1: centerSquare.bottomRightCorner.x, y1: container.max.y },
          {
            x0: centerSquare.bottomRightCorner.x,
            y0: container.max.y,
            x1: centerSquare.bottomRightCorner.x,
            y1: centerSquare.bottomRightCorner.y - BORDER_WIDTH / 2
          }
        ]
      });
      /*
        3 canvas
        canvas.push({
            min: { x: centerSquare.topLeftCorner.x, y: container.min.y },
            max: { x: container.max.x, y: centerSquare.topRightCorner.y },
            borders: [
              {
                x0: centerSquare.topLeftCorner.x,
                y0: centerSquare.topLeftCorner.y + BORDER_WIDTH / 2,
                x1: centerSquare.topLeftCorner.x,
                y1: container.min.y
              },
              { x0: centerSquare.topLeftCorner.x, y0: container.min.y, x1: container.max.x, y1: container.min.y },
              { x0: container.max.x, y0: container.min.y, x1: container.max.x, y1: centerSquare.topRightCorner.y }
            ]
          });
          canvas.push({
            min: { x: container.min.x, y: centerSquare.topLeftCorner.y },
            max: { x: container.max.x, y: centerSquare.bottomRightCorner.y },
            borders: [
              {
                x0: centerSquare.topLeftCorner.x + BORDER_WIDTH / 2,
                y0: centerSquare.topLeftCorner.y,
                x1: container.min.x,
                y1: centerSquare.topLeftCorner.y
              },
              {
                x0: container.min.x,
                y0: centerSquare.topLeftCorner.y,
                x1: container.min.x,
                y1: centerSquare.bottomRightCorner.y
              },
              {
                x0: centerSquare.bottomRightCorner.x - BORDER_WIDTH / 2,
                y0: centerSquare.bottomRightCorner.y,
                x1: container.max.x,
                y1: centerSquare.bottomRightCorner.y
              },
              {
                x0: container.max.x,
                y0: centerSquare.bottomRightCorner.y,
                x1: container.max.x,
                y1: centerSquare.topRightCorner.y
              }
            ]
          });
          canvas.push({
            min: { x: container.min.x, y: centerSquare.bottomLeftCorner.y },
            max: { x: centerSquare.bottomRightCorner.x, y: container.max.y },
            borders: [
              {
                x0: container.min.x,
                y0: centerSquare.bottomLeftCorner.y - BORDER_WIDTH / 2,
                x1: container.min.x,
                y1: container.max.y
              },
              {
                x0: container.min.x,
                y0: container.max.y,
                x1: centerSquare.bottomRightCorner.x,
                y1: container.max.y
              },
              {
                x0: centerSquare.bottomRightCorner.x,
                y0: container.max.y,
                x1: centerSquare.bottomRightCorner.x,
                y1: centerSquare.bottomRightCorner.y
              }
            ]
          });
        */
    }
  }
  // update canvas coordinates values relative to the container
  canvas = canvas.map(function (item) {
    let w = item.max.x - item.min.x,
      h = item.max.y - item.min.y,
      borders = item.borders.map(function (border) {
        return {
          x0: border.x0 - item.min.x,
          y0: border.y0 - item.min.y,
          x1: border.x1 - item.min.x,
          y1: border.y1 - item.min.y
        };
      });
    return self.buildCanvas(item.min.x, item.min.y, w, h, area.p, area.sentenceId, borders);
  });
  // set events on canvas
  this.setEvents(canvas);
  return canvas;
};

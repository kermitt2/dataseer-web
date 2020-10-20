/*
 * @prettier
 */

(function($) {
  // Get the current Object
  return MongoDB.getCurrentDocument(undefined, function(currentDocument) {
    // On previous click
    $('#previous_step').click(function() {
      return MongoDB.getCurrentDocument(undefined, function(currentDocument) {
        currentDocument.status = MongoDB.getPreviousStatus(currentDocument);
        MongoDB.updateDocument(currentDocument, null, function(err, res) {
          console.log(err, res);
          if (err) return err; // Need to define error behavior
          return location.reload();
        });
      });
    });

    // On next click
    $('#next_step').click(function() {
      return MongoDB.getCurrentDocument(undefined, function(currentDocument) {
        currentDocument.status = MongoDB.getNextStatus(currentDocument);
        MongoDB.updateDocument(currentDocument, null, function(err, res) {
          console.log(err, res);
          if (err) return err; // Need to define error behavior
          return location.reload();
        });
      });
    });
  });
})(jQuery);

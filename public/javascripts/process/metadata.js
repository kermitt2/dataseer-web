(function($) {
  // Get the current Object
  return MongoDB.getCurrentDocument(undefined, function(currentDocument) {
    // On metadata_validation click
    $('#metadata_validation').click(function() {
      currentDocument.status = MongoDB.getNextStatus(currentDocument);
      MongoDB.updateDocument(currentDocument, null, function(err, res) {
        console.log(err, res);
        if (err) return err; // Need to define error behavior
        return location.reload();
      });
    });
  });
})(jQuery);

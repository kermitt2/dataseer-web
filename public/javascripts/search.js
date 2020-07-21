/*
 * @prettier
 */

(function($) {
  // init attr data of each 'searchable' row
  $('.list .row[data]').map(function() {
    let row = $(this),
      txt = '';
    row.children().map(function() {
      txt += $(this).text() + ';';
    });
    row.attr('data', txt);
  });
  let filter = function() {
    // Declare variables
    let input = $(this),
      filter = input.val().toLowerCase();
    $('.list .row[data]').map(function() {
      let row = $(this),
        txt = row.attr('data');
      if (txt.length) {
        if (txt.toLowerCase().indexOf(filter) > -1) {
          row.removeClass('hidden');
        } else {
          row.addClass('hidden');
        }
      }
    });
    return $('.count-list').text($('.list .row[data]:not(.hidden)').length + ' Result(s)');
  };
  $('#search').change(filter);
})(jQuery);

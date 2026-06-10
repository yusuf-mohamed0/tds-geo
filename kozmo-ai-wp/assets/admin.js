/**
 * KOZMO AI WP — Admin Scripts
 */
(function($) {
    'use strict';

    // Toggle context JSON in log viewer
    $(document).on('click', '.toggle-context', function() {
        var pre = $(this).next('pre');
        if (pre.length) {
            pre.slideToggle(150);
            $(this).text(pre.is(':visible') ? 'Hide' : 'Show');
        }
    });

    // Copy-to-clipboard for API keys
    $(document).on('click', '[data-copy]', function() {
        var text = $(this).data('copy');
        navigator.clipboard.writeText(text).then(function() {
            var btn = $(this);
            btn.text('Copied!');
            setTimeout(function() { btn.text('Copy'); }, 2000);
        }.bind(this));
    });

})(jQuery);

/**
 * KOZMO AI WP — Admin Scripts
 */
(function($) {
    'use strict';

    $('.kozmo-reveal').each(function(index) {
        this.style.animationDelay = (index * 0.05) + 's';
    });

    // Toggle context JSON in log viewer
    $(document).on('click', '.toggle-context', function() {
        var pre = $(this).next('pre');
        if (pre.length) {
            pre.slideToggle(150);
            var $btn = $(this);
            setTimeout(function() {
                $btn.text(pre.is(':visible') ? 'Hide' : 'Show');
            }, 160);
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

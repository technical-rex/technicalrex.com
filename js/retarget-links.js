(function() {
    var siteUrl = 'http://technicalrex.com';
    var siteUrlLen = siteUrl.length;
    var links = document.getElementsByTagName('a');
    var len = links.length;
    for (var i = 0; i < len; i++) {
        var link = links[i];
        if ((link.href.slice(0, 5) === 'http:' || link.href.slice(0, 6) === 'https:')
                && link.href.slice(0, siteUrlLen) !== siteUrl) {
            link.target = '_blank';
        }
    }
})();

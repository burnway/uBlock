/*******************************************************************************

    µBlock - a browser extension to block requests.
    Copyright (C) 2014 Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

/* jshint bitwise: false */
/* global vAPI, uDom */

/******************************************************************************/

(function() {

'use strict';

/******************************************************************************/

var messager = vAPI.messaging.channel('devtools.js');

/******************************************************************************/

var renderPageSelector = function(targetTabId) {
    var selectedTabId = targetTabId || uDom('#pageSelector').val();
    var onDataReceived = function(pageTitles) {
        if ( pageTitles.hasOwnProperty(selectedTabId) === false ) {
            selectedTabId = pageTitles[0];
        }
        var select = uDom('#pageSelector').empty();
        var option;
        for ( var tabId in pageTitles ) {
            if ( pageTitles.hasOwnProperty(tabId) === false ) {
                continue;
            }
            option = uDom('<option>').text(pageTitles[tabId])
                                     .prop('value', tabId);
            if ( tabId === selectedTabId ) {
                option.prop('selected', true);
            }
            select.append(option);
        }
        // This must be done after inserting all option tags, or else Firefox
        // will refuse values which do not exist yet.
        select.prop('value', selectedTabId);
        selectPage();
    };
    messager.send({ what: 'getPageDetails' }, onDataReceived);
};

/******************************************************************************/

var pageSelectorChanged = function() {
    selectPage();
};

/******************************************************************************/

var selectPage = function() {
    var tabId = uDom('#pageSelector').val() || '';
    var inspector = uDom('#content');
    var currentSrc = inspector.attr('src');
    var targetSrc = 'devtool-log.html?tabId=' + tabId;
    if ( targetSrc === currentSrc ) {
        return;
    }
    inspector.attr('src', targetSrc);
    uDom('#popup').attr('src', tabId ? 'popup.html?tabId=' + tabId : '');

    // This is useful for when the user force-refresh the page: this will
    // prevent a reset to the original request log.
    // This is also useful for an outside observer to find out which tab is
    // being logged, i.e. the popup menu can initialize itself according to
    // what tab is currently being logged.
    window.history.pushState(
        {},
        '',
        window.location.href.replace(/^(.+[\?&])tabId=([^&]+)(.*)$/, '$1tabId=' + tabId + '$3')
    );
};

/******************************************************************************/

var toggleTool = function() {
    var button = uDom(this);
    button.toggleClass('enabled', !button.hasClass('enabled'));

    // Special case: we want the frame of the popup to be filled-in if and
    // only if the popup is visible.
    if ( this.id === 'popupToggler' ) {
        var tabId = uDom('#pageSelector').val() || '';
        var body = uDom('body');
        body.toggleClass('popupEnabled');
        if ( body.hasClass('popupEnabled') === false ) {
            tabId = '';
        }
        uDom('#popup').attr(
            'src',
            button.hasClass('enabled') && tabId ? 'popup.html?tabId=' + tabId : ''
        );
    }
};

/******************************************************************************/

var evaluateStaticFiltering = (function() {
    var uglyTypeNames = {
          'css': 'stylesheet',
          'doc': 'main_frame',
        'frame': 'sub_frame',
          'xhr': 'xmlhttprequest'
    };

    var onResultReceived = function(response) {
        var result = response && response.result.slice(3);
        uDom('#filteringResult')
            .text(result || '\u00A0')
            .toggleClass('empty', result === '');

        var input = uDom('#filterMatcher input').at(0);
        if ( input.val().trim() === '' ) {
            input.val(response && response.contextURL || '');
        }
    };

    var timer = null;
    var onTimerElapsed = function() {
        timer = null;

        var inputs = uDom('#filterMatcher input');
        var prettyTypeName = inputs.at(2).val().trim();

        messager.send({
            what: 'evaluateStaticFiltering',
            tabId: uDom('#pageSelector').val() || '',
            contextURL: inputs.at(0).val().trim(),
            requestURL: inputs.at(1).val().trim(),
            requestType: uglyTypeNames[prettyTypeName] || prettyTypeName,
        }, onResultReceived);
    };

    return function() {
        if ( timer === null ) {
            setTimeout(onTimerElapsed, 750);
        }
    };
})();

/******************************************************************************/

var resizePopup = function() {
    var popup = document.getElementById('popup');
    popup.style.width = popup.contentWindow.document.body.clientWidth + 'px';
    popup.style.height = popup.contentWindow.document.body.clientHeight + 'px';
};

/******************************************************************************/

var onPopupLoaded = function() {
    resizePopup();

    if ( popupObserver !== null ) {
        popupObserver.disconnect();
    }

    var popup = document.getElementById('popup');
    if ( popup.contentDocument === null ) {
        return;
    }
    var popupBody = popup.contentDocument.body;
    if ( popupBody === null ) {
        return;
    }
    var popupPanes = popup.contentDocument.getElementById('panes');
    if ( popupPanes === null ) {
        return;
    }

    if ( popupObserver === null ) {
        popupObserver = new MutationObserver(resizePopup);
    }

    var details = {
        childList: false,
        attributes: true,
        attributeFilter: ['class']
    };
    popupObserver.observe(popupBody, details);
    popupObserver.observe(popupPanes, details);
};

var popupObserver = null;

/******************************************************************************/

uDom.onLoad(function() {
    var tabId;

    // Extract the tab id of the page we need to pull the log
    var matches = window.location.search.match(/[\?&]tabId=([^&]+)/);
    if ( matches && matches.length === 2 ) {
        tabId = matches[1];
    }

    uDom('.toolToggler').on('click', toggleTool);
    uDom('#popup').on('load', onPopupLoaded);

    renderPageSelector(tabId);

    uDom('#pageSelector').on('change', pageSelectorChanged);
    uDom('#refresh').on('click', function() { renderPageSelector(); });
    uDom('#filterMatcher input').on('input', evaluateStaticFiltering);
});

/******************************************************************************/

})();


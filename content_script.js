// content_script.js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    sendResponse(window.getSelection().toString());
});
// Popup script for Neutral Summarizer extension
// This script runs when the extension icon is clicked

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup script loaded');
  // Immediately send a message to toggle the sidebar
  chrome.runtime.sendMessage({ type: 'TOGGLE_SIDEBAR' }, function(response) {
    console.log('Popup sent TOGGLE_SIDEBAR message, response:', response);
    // Close the popup immediately after sending the message
    window.close();
  });
});

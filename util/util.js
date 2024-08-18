const term = require('terminal-kit').terminal;

function log(message, color) { // green is default unless specified otherwise
    term[color || 'green'](message);
}

module.exports = {
    log
};
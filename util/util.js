const term = require('terminal-kit').terminal;
const fs = require('fs/promises');
const { existsSync } = require('fs');

/**
 * Logs a message to the terminal.
 * 
 * @param {string} message - The message to be logged.
 * @param {string} color - The color of the message.
 */
function log(message, color) { // brightGreen is default unless specified otherwise
    term[color || 'brightGreen'](message);
}

/**
 * Waits for a response and displays a dialogue on the terminal.
 *
 * @param {string} dialogue - The dialogue to be displayed.
 * @param {number} delay - The delay in milliseconds before typing each character.
 * @param {number} baseColumn - The base column position on the terminal.
 * @param {number} baseLine - The base line position on the terminal.
 * @param {number} nextLine - The next line position on the terminal.
 * @param {string} nextAction - The next action to be taken after the response is given (e.g. another dialogue).
 */
async function waitForResponse(dialogue, delay, baseColumn, baseLine, nextLine) {
    term.moveTo(baseColumn, baseLine);
    await term.slowTyping(dialogue, {delay})
    term.nextLine(nextLine); // i will likely have to make it check how many lines the dialogue is eventually
    const maxColumns = term.width;
    let responseColumn = (maxColumns - baseColumn) / 2; // center the response input
    responseColumn -= responseColumn * 0.33; // helps with centering the response input, may be subject to change 
    responseColumn += baseColumn; // add the base column to the centered response input
    term.column(responseColumn);
    return new Promise((resolve, reject) => {
        term.inputField({cancelable: false}, (error, input) => {
            if (error) {
                log("Error: " + error, 'red');
            } else {
                term.nextLine(nextLine);
                term.column(baseColumn);
                resolve(input);
            }
        });
    });
}


/**
 * Displays ASCII art and a message on the terminal.
 * 
 * @param {string} ASCII - The ASCII art to be displayed.
 * @param {string} message - The message to be displayed.
 */
async function asciiLook(ASCII, message) {
    term.clear();
    const mid = Math.floor(term.width / 2);
    const regex = new RegExp(`.{1,${term.width - mid + 1}}`,'g')
    const lines = await message.match(regex);
    await logDebug(lines);
    log(ASCII); // ASCII art will be printed on the left side
    term.moveTo(mid, 1); // move to the middle of the terminal
    // term.column(mid + 1); // using the middle of the terminal as a wall
    lines.forEach(line => {
        line = line.trim(); // remove useless whitespace
        logDebug(line);
        term.column(mid);
        log(line)
        term.nextLine(1);
        term.column(mid); // we are doing column again because, what if the next line isn't a message line and doesn't end up calling term.column?
    });
}

async function logDebug(message) { // used for debugging since using the terminal isn't ideal for this project
    // message = message.toString();
    const stack = new Error().stack;
    const caller = stack.split('\n')[2].trim();
    message = `${new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })} - ${message} (${caller})\n`;
    if (!existsSync('./log.txt')) {
        await fs.writeFile('./log.txt', message);
    } else {
        await fs.appendFile('./log.txt', message);
    }
}

async function savePlayer(data) {
    await fs.writeFile('./player/player.json', JSON.stringify(data));
}

module.exports = {
    log,
    waitForResponse,
    savePlayer,
    logDebug,
    asciiLook
};
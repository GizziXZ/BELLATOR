const term = require('terminal-kit').terminal;
const fs = require('fs/promises');

/**
 * Logs a message to the terminal.
 * 
 * @param {string} message - The message to be logged.
 * @param {string} color - The color of the message.
 */
function log(message, color) { // green is default unless specified otherwise
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

async function savePlayer(data) {
    await fs.writeFile('./player/player.json', JSON.stringify(data));
}

module.exports = {
    log,
    waitForResponse,
    savePlayer
};
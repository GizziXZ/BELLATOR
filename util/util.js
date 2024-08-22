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
 * @param {boolean} center - Whether the message should be centered.
 */
async function asciiLook(ASCII, message, center) {
    term.clear();
    const mid = Math.floor(term.width / 2);
    const regex = new RegExp(`.{1,${term.width - mid + 1}}`,'g')
    const segments = message.split('\n');
    // const lines = await message.match(regex);
    // await logDebug(segments);
    log(ASCII); // ASCII art will be printed on the left side
    if (center) term.moveTo(mid, term.height / 2.5); // move to the middle vertically aswell
    else term.moveTo(mid, 1); // move to the middle of the terminal
    // term.column(mid + 1); // using the middle of the terminal as a wall
    let lineAmount = 0;
    segments.forEach(segment => {
        const lines = segment.match(regex);
        if (segment === '') {
            term.nextLine(1);
            lineAmount++;
            return;
        }
        lines.forEach(line => {
            line = line.trim(); // remove useless whitespace
            lineAmount++;
            // logDebug(line);
            term.column(mid);
            log(line)
            term.nextLine(1);
            term.column(mid); // we are doing column again because, what if the next line isn't a message line and doesn't end up calling term.column?
        });
    });
    return lineAmount; // return total number of lines
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

// Audic caching because it takes too long to play audio
let AudicInstance;
let footsteps;

async function playSound(sound) {
    if (!AudicInstance) {
        const { default: Audic } = await import('audic');
        AudicInstance = Audic;
        footsteps = new Audic('./audio/indoor-footsteps.mp3');
    }
    if (sound === 'footsteps') {
        await footsteps.play();
    }
}

module.exports = {
    log,
    waitForResponse,
    savePlayer,
    logDebug,
    asciiLook,
    playSound
};
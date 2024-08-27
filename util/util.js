const term = require('terminal-kit').terminal;
const fs = require('fs/promises');
const { existsSync } = require('fs');
const { player } = require('../player/playerManager.js');
const itemsJSON = require('../data/items.json');
const enemiesJSON = require('../data/enemies.json');
const Room = require('../data/Room.js');
const roomsJSON = require('../data/rooms.json');

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


// Audic caching because it takes too long to play audio otherwise (no idea if there's a better way to do this but maybe i'll figure it out later)
let AudicInstance;
let footsteps;
let ambientHorn;
let combatMusic;
let hitHurt;
let miss;

async function playSound(sound, loop) {
    if (!AudicInstance) {
        const { default: Audic } = await import('audic');
        AudicInstance = Audic;
        footsteps = new AudicInstance('./audio/indoor-footsteps.wav');
        ambientHorn = new AudicInstance('./audio/horn-ambience.wav');
        combatMusic = new AudicInstance('./audio/BELLATOR_1.2.wav');
        hitHurt = new AudicInstance('./audio/hitHurt.wav');
        miss = new AudicInstance('./audio/miss.wav');
    }
    if (sound === 'footsteps') {
        footsteps.volume = 1;
        await footsteps.play();
    } else if (sound === 'ambientHorn') {
        ambientHorn.volume = 1;
        await ambientHorn.play();
    } else if (sound === 'combat music') {
        combatMusic.volume = 1;
        await combatMusic.play();
        combatMusic.loop = loop; // loop the combat music
    } else if (sound === 'hitHurt') {
        hitHurt.volume = 1;
        await hitHurt.play();
    } else if (sound === 'miss') {
        miss.volume = 0.6; // this is a little loud lol
        await miss.play();
    }
}

// fades out the current audio
async function fadeOut() {
    if (!AudicInstance) return;
    let currentAudio;
    if (footsteps.playing) {
        currentAudio = footsteps;
    } else if (ambientHorn.playing) {
        currentAudio = ambientHorn;
    } else if (combatMusic.playing) {
        currentAudio = combatMusic;
    } else if (hitHurt.playing) {
        currentAudio = hitHurt;
    } else if (miss.playing) {
        currentAudio = miss;
    } else {
        return;
    }
    let volume = currentAudio.volume;
    while (volume > 0.1) {
        volume -= 0.1;
        currentAudio.volume = volume;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    currentAudio.pause();
    currentAudio.currentTime = 0; // reset the audio
}

function stopMusic() {
    if (!AudicInstance) return;
    let currentAudio;
    if (footsteps.playing) {
        currentAudio = footsteps;
    } else if (ambientHorn.playing) {
        currentAudio = ambientHorn;
    } else if (combatMusic.playing) {
        currentAudio = combatMusic;
    }
    currentAudio.pause();
    currentAudio.currentTime = 0; // reset the audio
}

// function to generate a random room
function generateRandomRoom() {
    const roomNames = ["Cave", "Dungeon", "Hall", "Chamber", "Crypt"];
    const roomDescriptions = [
        "A dark and damp cave.",
        "A cold and eerie dungeon.",
        "A grand hall with high ceilings.",
        "A small chamber with flickering torches.",
        "A crypt with ancient tombs."
    ];

    // const randomIndex = Math.floor(Math.random() * roomNames.length);
    // const roomName = roomNames[randomIndex] + Math.floor(Math.random() * 1000);
    // const roomDescription = roomDescriptions[randomIndex];
    // let newRoom = new Room(roomName, roomDescription);
    const items = Object.keys(itemsJSON);
    let newRoom;

    if (Math.random() < 0.1) { // 10% chance of generating a special room
        const specialRooms = Object.keys(roomsJSON).map(room => roomsJSON[room]).filter(room => room.special);
        while (specialRooms.length > 0) {
            const randomSpecialRoom = specialRooms[Math.floor(Math.random() * specialRooms.length)];
            if (randomSpecialRoom.special) {
                newRoom = new Room(randomSpecialRoom.name, randomSpecialRoom.description, randomSpecialRoom.items, randomSpecialRoom.enemies, randomSpecialRoom.exits);
                break;
            }
        }
        return newRoom;
    }

    // If no special room was selected, generate a random room
    if (!newRoom) {
        const randomIndex = Math.floor(Math.random() * roomNames.length);
        const roomName = roomNames[randomIndex] + Math.floor(Math.random() * 1000);
        const roomDescription = roomDescriptions[randomIndex];
        newRoom = new Room(roomName, roomDescription);
    }

    // add random enemies to the room using rng
    const enemies = Object.keys(enemiesJSON);
    enemies.forEach(enemy => {
        if (Math.random() < enemiesJSON[enemy].spawn) { // Randomly decide whether to add an enemy (based off the enemy's spawn chance)
            newRoom.enemies[enemiesJSON[enemy].name] = enemy;
        }
    });

    // add random items to the room using rng
    items.forEach(item => {
        if (itemsJSON[item].unique && player.uniques.includes(item)) return; // Skip adding unique items that the player has already found
        if (Math.random() < itemsJSON[item].rarity) { // Randomly decide whether to add an item (based off the item's rarity)
            newRoom.items[itemsJSON[item].name] = item;
        }
    });

    // add random exits to the room using rng
    const directions = ["north", "south", "east", "west"];
    function setDirections() {
        const from = player.from;
        directions.forEach(direction => {
            if (Math.random() > 0.5) { // Randomly decide whether to add an exit
                const targetRoom = roomNames[Math.floor(Math.random() * roomNames.length)] + Math.floor(Math.random() * 1000);
                // prevent backtracking
                if (direction === 'north' && from === 'south') return;
                if (direction === 'south' && from === 'north') return;
                if (direction === 'east' && from === 'west') return;
                if (direction === 'west' && from === 'east') return;
                newRoom.exits[direction] = targetRoom;
            }
        });
        if (Object.keys(newRoom.exits).length === 0) setDirections(); // if no exits were added, try again
        return newRoom;
    }
    return setDirections();
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
    let mid = Math.floor(term.width / 2);
    // if (center) mid = Math.floor(term.width / 1.6);
    const regex = new RegExp(`.{1,${term.width - mid + 1}}`,'g')
    const segments = message.split('\n');
    // const lines = await message.match(regex);
    // await logDebug(segments);
    const midheight = term.height / 2;
    // term.moveTo(1, midheight * 0.25); // move to the middle vertically
    if (center) term.moveTo(term.width / 0.25, midheight * 0.25); // move to the middle vertically for the ASCII art
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
    if (center) lineAmount = term.height / 2.5 + lineAmount;
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

async function displayEssence() {
    const location = await term.getCursorLocation(); // await is necessary
    term.moveTo(term.width - 13, 1);
    term.bgWhite.black(`Essence: ${Math.round(player.essence)}`); // display the player's essence in the top right corner
    term.moveTo(location.x, location.y); // move back where we were after displaying essence
}

module.exports = {
    log,
    waitForResponse,
    savePlayer,
    logDebug,
    asciiLook,
    playSound,
    fadeOut,
    stopMusic,
    generateRandomRoom,
    displayEssence
};
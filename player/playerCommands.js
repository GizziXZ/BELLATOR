const term = require('terminal-kit').terminal;
const rooms = require('../data/rooms.json');
const fs = require('fs');
const { log, savePlayer, logDebug, asciiLook } = require('../util/util');

let player;
let hasAsciiArt = false; // Global variable to track ASCII art availability
let lines; // Global variable to store the amount of lines in the ASCII message

class Room {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.exits = {};
        this.items = {};
    }
}

class Player {
    constructor(startRoom) {
        this.currentRoom = startRoom;
        this.path = [startRoom.name];
    }
    
    move(exit) {
        if (this.currentRoom.exits[exit]) {
            this.currentRoom = this.currentRoom.exits[exit];
            this.path.push(this.currentRoom.name);
        } else {
            const newRoom = generateRandomRoom();
            this.currentRoom.exits[exit] = newRoom;
            this.currentRoom = newRoom;
            this.path.push(newRoom.name);
        }
    }
}

// temporary function to generate a random room
function generateRandomRoom() {
    const roomNames = ["Cave", "Dungeon", "Hall", "Chamber", "Crypt"];
    const roomDescriptions = [
        "A dark and damp cave.",
        "A cold and eerie dungeon.",
        "A grand hall with high ceilings.",
        "A small chamber with flickering torches.",
        "A crypt with ancient tombs."
    ];
    
    const randomIndex = Math.floor(Math.random() * roomNames.length);
    const roomName = roomNames[randomIndex] + Math.floor(Math.random() * 1000);
    const roomDescription = roomDescriptions[randomIndex];

    logDebug(`${roomName}, ${roomDescription}`);

    const newRoom = new Room(roomName, roomDescription);

    // add random exits to the room using rng
    const directions = ["north", "south", "east", "west"];
    directions.forEach(direction => {
        if (Math.random() > 0.5) { // Randomly decide whether to add an exit
            const targetRoom = roomNames[Math.floor(Math.random() * roomNames.length)] + Math.floor(Math.random() * 1000);
            newRoom.exits[direction] = targetRoom;
        }
    });

    if (Object.keys(newRoom.exits).length === 0) { // if there are no exits after the direction foreach rng, just add a singular random exit
        const targetRoom = roomNames[Math.floor(Math.random() * roomNames.length)] + Math.floor(Math.random() * 1000);
        newRoom.exits[directions] = targetRoom;
        const randomDirection = directions[Math.floor(Math.random() * directions.length)];
        newRoom.exits[randomDirection] = targetRoom;
    }

    return newRoom;
}

function updatePlayerVariable(data) {
    if (!data) return player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));
    fs.writeFileSync('./player/player.json', JSON.stringify(data));
    return player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));
}

const commands = {
    look: async (item) => {
        updatePlayerVariable();
        const room = rooms[player.room] || player.room;
        let roomDescription = room.description;
        hasAsciiArt = false; // Reset the ASCII art flag
        if (fs.existsSync(`./ASCII/${player.room}.txt`)) { // if there is an ASCII art file for the room that we are in, display it
            hasAsciiArt = true;
            // lines = await asciiLook(fs.readFileSync(`./ASCII/${player.room}.txt`, 'utf8'), roomDescription);
            // return;
        }

        let exits = room.exits ? Object.keys(room.exits).join(', ') : '';
        let items = room.items ? Object.keys(room.items).join(', ') : '';
        if (exits) roomDescription += `\n\nExits: ${exits}`;
        if (items) roomDescription += `\n\nItems: ${items}`;

        if (!item) {
            // logDebug(JSON.stringify(room))
            if (!hasAsciiArt) {
                lines = undefined;
                log(roomDescription, 'yellow');
            } else {
                logDebug('ASCII art exists');
                lines = await asciiLook(fs.readFileSync(`./ASCII/${player.room}.txt`, 'utf8'), roomDescription);
                term.column(term.width / 2);
                term.nextLine(1);
                term.column(term.width / 2);
            }
        } else if (room.items && room.items[item]) {
            log(room.items[item].description, 'yellow'); // if looking at an item
        } else {
            log('I don\'t see that here.', 'red');
        }
    },
    move: async (exit) => {
        if (!exit) return log("Where would you like to move to?", 'yellow');
        const room = rooms[player.room] || player.room;
        let targetRoom = room.exits[exit];

        if (!targetRoom) return log("I don't see that exit.", 'red');
    
        if (rooms[player.room].exits[exit]) { // If the target room is predefined
            player.room = targetRoom;
            updatePlayerVariable(player);
            log(commands['look']());
        } else { // If the target room is random
            player.room = generateRandomRoom();
            updatePlayerVariable(player);
            log(commands['look']());
        }
    },
    interact: (item) => {
        if (!item) return log("What would you like to interact with?", 'yellow');
        const room = rooms[player.room];
        const interact = room.items[item].interact;
        if (interact) {
            log(interact.description, 'yellow');
            if (interact.effect) {
                const effect = interact.effect;
                if (effect.type === 'move') {
                    player.room = effect.value;
                    updatePlayerVariable(player);
                }
            }
        } else if (!interact) {
            log("You can't interact with that.", 'red');
        } else {
            log("I don't see that here.", 'red');
        }
    },
    help: () => {
        log(`Commands: ${Object.keys(commands)}`, 'yellow');
    }
};

function handleCommand(command) {
    const [action, target] = command.split(' ');
    if (commands[action]) {
        commands[action](target);
    } else {
        term.nextLine(1);
        log("I don't understand that command.", 'red');
    }
}

function gameWaitForInput(pause) {
    if (pause === false) return;
    // term.nextLine(1);
    logDebug(lines);
    if (!hasAsciiArt && !lines) term.nextLine(2);
    term.inputField({
        autoComplete: Object.keys(commands),
        autoCompleteHint: true,
    }, (error, input) => {
        if (error) {
            log(error, 'red');
        }
        if (player.room === 'gameSTART') return startGame(); // if the player is in the starting call, we will start the game
        term.clear();
        handleCommand(input);
        gameWaitForInput();
    });
}

async function startGameplay(pause) {
    updatePlayerVariable();
    term.clear();
    await commands['look'](); // on game launch, we will run the look command to display the current room to continue where we left off
    // term.nextLine(2);
    gameWaitForInput(pause);
}

async function startGame() { // this function will be called when the game is ACTUALLY, ACTUALLY starting. so we are now procedurally generating and all that
    term.clear();
    updatePlayerVariable();
    player.room = generateRandomRoom();
    updatePlayerVariable(player);
    await commands['look'](); // on game launch, we will run the look command to display the current room to continue where we left off
    // term.nextLine(2);
    gameWaitForInput();
}

module.exports = {
    startGameplay
};
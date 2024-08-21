const term = require('terminal-kit').terminal;
const rooms = require('../data/rooms.json');
const fs = require('fs');
const { log, savePlayer, logDebug, asciiLook } = require('../util/util');
const itemsJSON = require('../data/items.json');

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
    
    const randomIndex = Math.floor(Math.random() * roomNames.length);
    const roomName = roomNames[randomIndex] + Math.floor(Math.random() * 1000);
    const roomDescription = roomDescriptions[randomIndex];

    // logDebug(`${roomName}, ${roomDescription}`);

    const newRoom = new Room(roomName, roomDescription);
    const items = Object.keys(itemsJSON);

    // add random items to the room using rng
    items.forEach(item => {
        if (Math.random() > 0.5) { // Randomly decide whether to add an item
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

function updatePlayerVariable(data) {
    if (!data) return player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));
    fs.writeFileSync('./player/player.json', JSON.stringify(data));
    return player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));
}

function resetVariables() {
    hasAsciiArt = false;
    lines = undefined;
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
                resetVariables();
                log(roomDescription, 'yellow');
                term.nextLine(2);
            } else {
                lines = await asciiLook(fs.readFileSync(`./ASCII/${player.room}.txt`, 'utf8'), roomDescription);
                term.column(term.width / 2);
            }
        } else if (room.items && room.items[item]) {
            resetVariables();
            log(room.items[item].description, 'yellow'); // if looking at an item
            term.nextLine(2);
        } else {
            resetVariables();
            log('I don\'t see that here.', 'red');
            term.nextLine(2);
        }
    },
    move: async (exit) => {
        if (!exit) return log("Where would you like to move to?", 'yellow');
        const room = rooms[player.room] || player.room;
        let targetRoom = room.exits[exit];

        if (!targetRoom) {
            log("I don't see that exit.", 'red');
            term.nextLine(2);
            return;
        }
        player.from = exit;
    
        if (rooms[player.room] && rooms[player.room].exits[exit]) { // If the target room is predefined
            player.room = targetRoom;
            updatePlayerVariable(player);
            await commands['look']();
        } else { // If the target room is random
            player.room = generateRandomRoom();
            updatePlayerVariable(player);
            await commands['look']();
        }
    },
    interact: (item) => {
        resetVariables();
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
    inventory: () => {
        resetVariables();
        const inventory = player.inventory;
        const inventorySize = inventory.size;
        if (inventorySize === 0) {
            log("Your inventory is empty.", 'yellow');
            term.nextLine(2);
        } else {
            log("Inventory:", 'yellow');
            const itemCounts = inventory.reduce((counts, item) => {
                counts[item] = (counts[item] || 0) + 1;
                return counts;
            }, {});
            for (const [item, count] of Object.entries(itemCounts)) {
                log(`\n- ${item} x${count} (${itemsJSON[item].description})`, 'yellow');
            }
            term.nextLine(2);
        }
    },
    take: (item) => {
        resetVariables();
        if (!item) return log("What would you like to take?", 'yellow');
        item = item.toLowerCase();
        const room = player.room;
        if (rooms[room]) return log("You can't take that.", 'red'); // if the room is predefined, you can't take anything
        const roomItems = Object.keys(room.items).reduce((acc, key) => {
            acc[key.toLowerCase()] = key;
            return acc;
        }, {});
        if (roomItems[item]) {
            const originalItemName = roomItems[item];
            player.inventory.push(originalItemName);
            delete room.items[originalItemName];
            updatePlayerVariable(player);
            log(`You took the ${originalItemName}.`, 'yellow');
            term.nextLine(2);
        } else {
            log("I don't see that here.", 'red');
            term.nextLine(2);
        }
    },
    use: (item) => {
        resetVariables();
        if (!item) return log("What would you like to use?", 'yellow');
        item = item.toLowerCase();
        const inventory = player.inventory.map(i => i.toLowerCase());
        const itemIndex = inventory.indexOf(item);
        if (itemIndex === -1) {
            log("You don't have that item.", 'red');
            term.nextLine(2);
        } else {
            const originalItemName = player.inventory[itemIndex];
            const itemData = itemsJSON[originalItemName];
            if (itemData.effect) {
                log(`You used ${originalItemName}`, 'yellow');
                term.nextLine(2);
                if (itemData.type === 'consumable') player.inventory.splice(itemIndex, 1); // remove the item from the inventory if it's a consumable
                const effect = itemData.effect;
                if (effect.type === 'heal') {
                    player.health += effect.value;
                    updatePlayerVariable(player);
                }
            } else {
                log("You can't use that item.", 'red');
                term.nextLine(2);
            }
        }
    },
    stats: () => { // TODO - add ascii art for player stats
        resetVariables();
        log(`Name: ${player.name}\nEssence: ${player.health}\nLevel: ${player.level}\nXP: ${player.experience}\nSouls: ${player.souls}`, 'yellow');
        term.nextLine(2);
    },
    // help: () => {
    //     log(`Commands: ${Object.keys(commands)}`, 'yellow');
    // }
};

// aliases
commands.go = commands.move;
commands.walk = commands.move;
commands.examine = commands.look;
commands.inspect = commands.look;
commands.see = commands.look;
commands.check = commands.look;
commands.ls = commands.look; // for you linux fellas
commands.inv = commands.inventory;

async function handleCommand(command) {
    const [action, target] = command.split(' ');
    if (commands[action]) {
        await commands[action](target);
    } else {
        log("I don't understand that command.", 'red');
        term.nextLine(1);
    }
}

function gameWaitForInput(pause) {
    if (pause === false) return;
    const options = {
        autoComplete: Object.keys(commands),
        autoCompleteHint: true,
    }
    if (!hasAsciiArt && !lines) options.y + 2;
    else {
        options.y = lines + 2;
        options.x = term.width / 2;
    }
    term.inputField(options, async (error, input) => {
        if (error) {
            log(error, 'red');
        }
        if (player.room === 'gameSTART') return startGame(); // if the player is in the starting call, we will start the game
        term.clear();
        await handleCommand(input);
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
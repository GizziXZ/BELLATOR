const term = require('terminal-kit').terminal;
const rooms = require('../data/rooms.json');
const fs = require('fs');
const { log, savePlayer } = require('../util/util');

let player;

function updatePlayerVariable(data) {
    if (!data) return player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));
    fs.writeFileSync('./player/player.json', JSON.stringify(data));
    return player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));
}

const commands = {
    look: (item) => {
        updatePlayerVariable();
        const room = rooms[player.room];
        let roomDescription = `${room.description}`;
        if (!item) {
            if (fs.existsSync(`./ASCII/${player.room}.txt`)) { // if there is an ASCII art file for the room that we are in, display it
                log(fs.readFileSync(`./ASCII/${player.room}.txt`, 'utf8'));
                term.nextLine(1);
            }
            let exits = room.exits ? room.exits.map(item => typeof item === 'string' ? item : Object.keys(item)).join(', ') : '';
            let items = room.items ? Object.keys(room.items).join(', ') : '';
            if (exits) roomDescription += `\n\nExits: ${exits}`;
            if (items) roomDescription += `\n\nItems: ${items}`;
            log(roomDescription, 'yellow');
        } else if (room.items && room.items[item]) {
            log(room.items[item].description, 'yellow'); // if looking at an item
        } else {
            log('I don\'t see that here.', 'red');
        }
    },
    move: (exit) => {
        if (!exit) return log("Where would you like to move to?", 'yellow');
        const room = rooms[player.room];
        let targetRoom;
    
        // find the exit in the current room
        const foundExit = room.exits.find(item => typeof item === 'string' ? item === exit : Object.keys(item)[0] === exit);
    
        if (typeof foundExit === 'string') {
            targetRoom = foundExit; // If the exit is a string, use it directly
        } else if (typeof foundExit === 'object') {
            targetRoom = Object.values(foundExit)[0]; // If the exit is an object, extract the room name
        }
    
        if (targetRoom && rooms[targetRoom]) { // If the target room is predefined
            player.room = targetRoom;
            // savePlayer(player);
            updatePlayerVariable(player);
            log(commands['look']());
        } else { // If the target room is random
            function getRandomRoom() {
                const randomRoomIndex = Math.floor(Math.random() * Object.keys(rooms).length);
                const randomRoom = Object.values(rooms)[randomRoomIndex];
                if (!randomRoom.random) return getRandomRoom();
                return randomRoom;
            }
            const randomRoom = getRandomRoom();
            if (!player.generatedPath[player.room]) {
                player.generatedPath[player.room] = {};
            }
            // player.generatedPath[player.room][exit] = Object.keys(rooms).find(key => rooms[key] === randomRoom);
            // FIXME this is so complicated, am i even doing this right or is there an easier way to do what im trying to do
            Object.values(room.exits).forEach(exit => { // exit is the exit name
                if (!player.generatedPath[player.room]) {
                    player.generatedPath[player.room] = {};
                }
                if (!player.generatedPath[player.room][exit]) {
                    player.generatedPath[player.room][exit] = {};
                }
                if (randomRoom) {
                    player.generatedPath[player.room][exit][randomRoom] = {};
                }
            });
            player.room = Object.keys(rooms).find(key => rooms[key] === randomRoom);
            // savePlayer(player);
            updatePlayerVariable(player);
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
    if (pause === false) return; // i think it makes more sense to have startGame(false) stop the game than startGame(true). also, this just stops it from running commands so we can do cutscenes or something
    term.inputField({
        autoComplete: Object.keys(commands), // autocomplete the commands
        autoCompleteHint: true
    }, (error, input) => {
        if (error) {
            log(error, 'red');
        }
        term.clear();
        handleCommand(input);
        term.nextLine(2);
        gameWaitForInput();
    });
}

function startGame(pause) {
    term.clear();
    log(commands['look']()); // on game launch, we will run the look command to display the current room to continue where we left off
    term.nextLine(2);
    gameWaitForInput(pause);
}

module.exports = {
    startGame
};
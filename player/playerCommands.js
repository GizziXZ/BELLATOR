const term = require('terminal-kit').terminal;
const rooms = require('../data/rooms.json');
const fs = require('fs');
const { log, savePlayer } = require('../util/util');

let player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));

const commands = {
    look: (item) => {
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
        const exit = room.exits[exit];
        if (typeof exit === 'object' && Object.values(room.exits)[0]) { // the exit already has a predefined room, meaning it's not random
            player.room = Object.values(room.exits)[0];
            savePlayer(player);
            log(commands['look']());
        } else { // the exit is random so we need to determine the room
            function getRandomRoom() {
                const randomRoomIndex = Math.floor(Math.random() * Object.keys(rooms).length);
                const randomRoom = Object.values(rooms)[randomRoomIndex]; // get a random room
                if (!randomRoom.random) return getRandomRoom(); // if the room can't be randomly generated, try again
                return randomRoom;
            }
            const targetRoom = getRandomRoom();
            if (!player.generatedPath[player.room]) {
                player.generatedPath[player.room] = {};
            }
            player.generatedPath[player.room][exit] = Object.keys(rooms).find(key => rooms[key] === targetRoom);
            player.room = Object.keys(rooms).find(key => rooms[key] === targetRoom);
            savePlayer(player);
        }
        // player.room = targetRoom;
        // savePlayer(player);
        // log(commands['look']());
    },
    interact: (item) => {
        if (!item) return log("What would you like to interact with?", 'yellow');
        const interact = room.items[item].interact;
        if (interact) {
            log(interact, 'yellow');
            if (interact.effect) {
                // TODO: implement effect
            }
        } else if (!interact) {
            log("You can't interact with that.", 'red');
        } else {
            log("I don't see that here.", 'red');
        }
    },
    help: () => {
        log("Commands: look, move, help, interact", 'yellow');
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
        autoComplete: ['look', 'move'],
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
    log(commands['look']()); // on game launch, we will run the look command to display the current room to continue where we left off
    term.nextLine(2);
    gameWaitForInput(pause);
}

module.exports = {
    startGame
};
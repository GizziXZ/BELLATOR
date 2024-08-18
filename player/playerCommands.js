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
            let exits = room.exits ? Object.keys(room.exits).join(', ') : '';
            let items = room.items ? Object.keys(room.items).join(', ') : ''; // FIXME - look works twice in a row
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
        const targetroom = rooms[player.room].exits[exit];
        player.room = targetroom;
        savePlayer(player);
        log(`You move to ${exit}`);
    },
    help: () => {
        log("Commands: look, move, help", 'yellow');
    }
};

function handleCommand(command) {
    const [action, target] = command.split(' ');
    if (commands[action]) {
        term.clear();
        commands[action](target);
    } else {
        log("I don't understand that command.", 'red');
    }
}

function startGame(pause) {
    if (pause === false) return; // i think it makes more sense to have startGame(false) stop the game than startGame(true). also, this just stops it from running commands so we can do cutscenes or something
    log(commands['look']());
    term.nextLine(1);
    term.inputField({
        autoComplete: ['look', 'move'],
        autoCompleteHint: true
    }, (error, input) => {
        if (error) {
            log("Error: " + error, 'red');
        }
        // term.clear();
        handleCommand(input);
        // term.nextLine(1);
        startGame();
    });
}

module.exports = {
    startGame
};
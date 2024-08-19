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
            let exits = room.exits ? Object.keys(room.exits).join(', ') : '';
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
        const targetroom = room.exits[exit];
        player.room = targetroom;
        savePlayer(player);
        log(`You move to ${exit}`);
    },
    interact: (item) => {
        if (!item) return log("What would you like to interact with?", 'yellow');
        if (room.items[item]) {
            log(room.items[item].interact, 'yellow');
        } else if (!room.items[item].interact) {
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
const term = require('terminal-kit').terminal;
const rooms = require('../data/rooms.json');
const { log, savePlayer } = require('../util/util');

let player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));

const commands = {
    look: () => {
        log(rooms[player.room].description, 'yellow');
    },
    move: (exit) => {
        const targetroom = rooms[player.room].exits[exit].value;
        player.room = targetroom;
        savePlayer(player);
        log(`You move to ${exit}`);
    }
};

function startGame() {
    term.inputField({
        autoComplete: ['look', 'move'],
        autoCompleteHint: true
    }, (error, input) => {

    });
}

module.exports = {
    startGame
};
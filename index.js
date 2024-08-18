const fs = require('fs');
const term = require('terminal-kit').terminal;
const { log, waitForResponse, savePlayer } = require('./util/util.js');

let player;

if (fs.existsSync('./player/player.json')) {
    player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));
} else {
    fs.copyFileSync('./player/template.json', './player/player.json');
    player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));
}

term.fullscreen(true);
term.grabInput({ mouse: 'button' });

term.on('key', (name) => {
    if (name === 'CTRL_C') {
        term.fullscreen(false);
        term.grabInput(false);
    }
});

log("Set your terminal to full screen and press any key to continue...");

term.once('key', async () => {
    if (!player.name) {
        term.clear();
        log(fs.readFileSync('./ASCII/start.txt', 'utf8'));
        const input = await waitForResponse("Welcome back. Warrior. What is your name?", 80, 150, 25, 2);
        player.name = input;
        player.room = "start";
        savePlayer(player);
        await term.slowTyping(`...${input}, that is your name? Interesting.`, {delay: 80});
    }
    term.once('key', () => {
        term.clear();
        log("You glance at your surroundings, the smell of damp earth fills your nostrils. You are in a dark cave. You have no memory of how you got here. You see a lit doorway.");
        // start game commands here
    });
});
const fs = require('fs');
const term = require('terminal-kit').terminal;
const { log, waitForResponse } = require('./util/util.js');

term.fullscreen(true);
term.grabInput({ mouse: 'button' });

term.on('key', (name) => {
    if (name === 'CTRL_C') {
        term.fullscreen(false);
        term.grabInput(false);
    }
});

log("Set your terminal to full screen and press any key to continue...");

term.once('key', () => {
    term.clear();
    log(fs.readFileSync('./ASCII/start.txt', 'utf8'));
    waitForResponse("Welcome back. Warrior. What is your name?", 80, 150, 25, 2, (input) => term.slowTyping(`...${input}, that is your name? Interesting.`, { delay: 80 }))
    term.once('key', () => {
        term.clear();
        log("You glance at your surroundings, the smell of damp earth fills your nostrils. You are in a dark cave. You have no memory of how you got here. You see a lit doorway. Do you go through it? (Y/N)");
    });
});
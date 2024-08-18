const fs = require('fs');
const term = require('terminal-kit').terminal;
const { log } = require('./util/util.js');
const { error } = require('console');

term.fullscreen(true);
term.grabInput({ mouse: 'button' });

term.on('key', (name) => {
    if (name === 'CTRL_C') {
        term.fullscreen(false);
        term.grabInput(false);
    }
});

log("Set your terminal to full screen and press any key to continue...");
term.on('key', () => {
    term.clear();
    log(fs.readFileSync('./ASCII/start.txt', 'utf8'));
    term.moveTo(150, 25);
    term.slowTyping("Welcome back. Warrior. What is your name?").then(() => {
        term.inputField({ cancelable: false }, (error, input) => {
            if (error) {
                term.red("Error: " + error);
            } else {
                term.slowTyping(`...${input}..., that is your name? Interesting.`, { delay: 50 }).then(() => {
                    console.log('the end, for now');
                });
            }
        })
    });
});

// log(fs.readFileSync('./ASCII/start.txt', 'utf8'));

// term.slowTyping('Welcome to the game!').then(() => {
//   log('Type "start" to begin');
// });
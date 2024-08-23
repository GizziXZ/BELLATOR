const fs = require('fs');

let player;
updatePlayerVariable(); // initialize player variable

function updatePlayerVariable(data) {
    if (!data) return player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));
    fs.writeFileSync('./player/player.json', JSON.stringify(data));
    updateLevel();
    return player = JSON.parse(fs.readFileSync('./player/player.json', 'utf8'));
}

function resetVariables() {
    global.hasAsciiArt = false;
    global.lines = undefined;
}

function updateLevel() {
    if (player.experience >= player.level * 80) {
        player.level++;
        player.experience - player.level * 80;
        player.essence = 100;
        log(`You have leveled up to level ${player.level}!`, 'green');
        term.nextLine(1);
    }
}

module.exports = {
    updatePlayerVariable,
    resetVariables,
    updateLevel,
    player
};
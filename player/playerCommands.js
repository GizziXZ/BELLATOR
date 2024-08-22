const term = require('terminal-kit').terminal;
const rooms = require('../data/rooms.json');
const fs = require('fs');
const { log, savePlayer, logDebug, asciiLook } = require('../util/util');
const itemsJSON = require('../data/items.json');
const enemiesJSON = require('../data/enemies.json');

let player;
let hasAsciiArt = false; // Global variable to track ASCII art availability
let lines; // Global variable to store the amount of lines in the ASCII message
let isFighting;

// TODO - leveling/XP system
// TODO - music/sound effects for ambiance and dialogue
// TODO - combat system
// TODO - death store

class Room {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.exits = {};
        this.items = {};
        this.enemies = {};
    }
}

class Enemy {
    constructor(name, health, damage, experience, loot, souls) {
        this.name = name;
        this.health = health;
        this.damage = damage;
        this.experience = experience;
        this.loot = {};
        this.souls = 0;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
    }

    isAlive() {
        return this.health > 0;
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

    // add random enemies to the room using rng
    const enemies = Object.keys(enemiesJSON);
    enemies.forEach(enemy => {
        if (Math.random() < enemiesJSON[enemy].spawn) { // Randomly decide whether to add an enemy (based off the enemy's spawn chance)
            newRoom.enemies[enemiesJSON[enemy].name] = enemy;
        }
    });

    // add random items to the room using rng
    items.forEach(item => {
        if (itemsJSON[item].unique && player.uniques.includes(item)) return; // Skip adding unique items that the player has already found
        if (Math.random() < itemsJSON[item].rarity) { // Randomly decide whether to add an item (based off the item's rarity)
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
        let items = room.items ? Object.keys(room.items).map(itemName => {
            const itemData = itemsJSON[itemName];
            return itemData.interactOnly ? `${itemName} (interact)` : itemName; // this just tells you that you can interact with the item instead of taking it
        }).join(', ') : '';
        let enemies = room.enemies ? Object.keys(room.enemies).join(', ') : '';
        if (exits) roomDescription += `\n\nExits: ${exits}`;
        if (items) roomDescription += `\n\nItems: ${items}`;
        if (enemies) roomDescription += `\n\nEnemies: ${enemies}`;

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
            log("I don't see that here.", 'red');
            term.nextLine(2);
        }
    },
    move: async (exit) => {
        if (!exit) {
            log("You need to specify somewhere to move to.", 'red');
            return term.nextLine(2);
        }
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
        if (!item) {
            log("You need to specify what to use.", 'red');
            return term.nextLine(2);
        }
        item = item.toLowerCase();
        const room = player.room;
        if (rooms[room]) return log("You can't take that.", 'red'); // if the room is predefined, you can't take anything
        const roomItems = Object.keys(room.items).reduce((acc, key) => { // make the room items lowercase for easier comparison
            acc[key.toLowerCase()] = key;
            return acc;
        }, {});
        if (roomItems[item]) { // if the item exists in the room
            const originalItemName = roomItems[item]; // get the original item name
            const interact = itemsJSON[originalItemName].interact;
            const itemData = itemsJSON[originalItemName];
            if (interact) {
                if (itemsJSON[originalItemName].unique) player.uniques.push(room.items[originalItemName]); // add the unique item to the player's list of found uniques
                delete room.items[originalItemName]; // remove the item from the room
                log(interact, 'yellow');
                term.nextLine(2);
                // effects
                if (itemData.effect) {
                    const effect = itemData.effect;
                    if (effect.type === 'move') {
                        player.room = effect.value;
                        updatePlayerVariable(player);
                    }
                    if (effect.type === 'level') {
                        player.level += effect.value;
                        updatePlayerVariable(player);
                    }
                }
            } else if (!interact) {
                log("You can't interact with that.", 'red');
                term.nextLine(2);
            }
        } else {
            log("I don't see that here.", 'red');
            term.nextLine(2);
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
        if (!item) {
            log("You need to specify something to take.", 'red');
            return term.nextLine(2);
        }
        item = item.toLowerCase().trim();
        const room = player.room;
        if (rooms[room]) return log("You can't take that.", 'red'); // if the room is predefined, you can't take anything
        const roomItems = Object.keys(room.items).reduce((acc, key) => { // make the room items lowercase for easier comparison
            acc[key.toLowerCase()] = key;
            return acc;
        }, {});
        if (roomItems[item]) { // if the item exists in the room
            const originalItemName = roomItems[item]; // get the original item name
            if (itemsJSON[originalItemName].interactOnly) {
                log("Try interacting with that item instead.", 'red');
                return term.nextLine(2);
            }
            player.inventory.push(originalItemName); // add the item to the player's inventory
            if (itemsJSON[originalItemName].unique) player.uniques.push(room.items[originalItemName]); // add the unique item to the player's list of found uniques
            delete room.items[originalItemName]; // remove the item from the room
            updatePlayerVariable(player);
            log(`You took the ${originalItemName}.`, 'yellow');
            term.nextLine(2);
        } else {
            log("I don't see that here.", 'red');
            term.nextLine(2);
        }
    },
    use: async (item) => {
        resetVariables();
        if (!item) {
            log("You need to specify something to use", 'red');
            return term.nextLine(2);
        }
        item = item.toLowerCase();
        const inventory = player.inventory.map(i => i.toLowerCase()); // make the inventory items lowercase for easier comparison
        const itemIndex = inventory.indexOf(item);
        if (itemIndex === -1) {
            log("You don't have that item.", 'red');
            term.nextLine(2);
        } else {
            const originalItemName = player.inventory[itemIndex]; // get the original item name
            const itemData = itemsJSON[originalItemName];
            if (itemData.effect) {
                log(`You used ${originalItemName}\n${itemData.use}`, 'yellow');
                term.nextLine(2);
                if (itemData.type === 'consumable') player.inventory.splice(itemIndex, 1); // remove the item from the inventory if it's a consumable
                const effect = itemData.effect;
                // effects
                if (effect.type === 'heal') {
                    player.health += effect.value;
                    await updatePlayerVariable(player);
                    if (isFighting) return effect;
                }
                if (effect.type === 'experience') {
                    player.experience += effect.value;
                    await updatePlayerVariable(player);
                    if (isFighting) return effect;
                }
                if (effect.type === 'damage') {
                    await updatePlayerVariable(player);
                    if (isFighting) return effect;
                } else if (effect.type === 'damage' && !isFighting) {
                    log("You can't use that item here.", 'red');
                    term.nextLine(2);
                }
            } else {
                log("You can't use that item.", 'red');
                term.nextLine(2);
            }
        }
    },
    stats: () => {
        resetVariables();
        asciiLook(fs.readFileSync('./ASCII/stats.txt'),`Name: ${player.name}\nEssence: ${player.health}\nLevel: ${player.level}\nXP: ${player.experience}\nSouls: ${player.souls}\nAbilities: ${Object.keys(player.abilities).join(', ')}`, 'yellow', true);
        term.nextLine(2);
        term.column(term.width / 2);
    },
    fight: async (enemy) => {
        updatePlayerVariable();
        resetVariables();

        // function used for combat
        async function getPlayerInput() {
            return new Promise((resolve) => {
                term.inputField({cancelable: false}, (error, input) => {
                    if (error) {
                        log("Error: " + error, 'red');
                    } else {
                        term.nextLine(1);
                        term.column(1);
                        resolve(input);
                    }
                });
            });
        }

        enemy = enemy.toLowerCase().trim();
        const enemyKey = Object.keys(enemiesJSON).find(key => key.toLowerCase() === enemy);
        const enemyData = enemiesJSON[enemyKey];
        if (!enemyData) {
            log("I don't see that enemy here.", 'red');
            return term.nextLine(2);
        }

        enemy = new Enemy(enemyData.name, enemyData.health, enemyData.damage, enemyData.experience, enemyData.loot, enemyData.souls);

        log(`You are fighting ${enemy.name}!`, 'yellow'); // ascii log for combat eventually
        term.nextLine(2);
        let usedAbilities = [];
        while (player.health > 0 && enemy.health > 0) {
            const location = await term.getCursorLocation();
            if (location.y > term.height - 2) {
                term.clear();
                term.moveTo(1, 1);
            }
            // Player turn
            log("Your turn!", 'yellow');
            // logDebug(location.y);
            term.nextLine(1);
            let turnEnded = false;
            let validAction = false;
            while (!turnEnded) {
                const action = await getPlayerInput();
                const args = action.split(' ');
                player.defending = false; // reset defending status
                if (action === 'hit') {
                    const playerDamage = Math.floor(Math.random() * player.level) + 1;
                    enemy.health -= playerDamage;
                    log(`You hit ${enemy.name} for ${playerDamage} damage!`);
                    term.nextLine(1);
                    turnEnded = true;
                } else if (action === 'defend') {
                    log("You brace yourself for the next attack.");
                    term.nextLine(1);
                    player.defending = true;
                    turnEnded = true;
                } else if (args[0] === 'use') {
                    if (args[1]) {
                        const effect = await commands['use'](args.slice(1).join(' ')) || null;
                        if (effect === null) continue; // the use command will log the "you don't have that item" message
                        // await logDebug(effect);
                        // we shouldn't have an if statement for every effect since it's already done in the use command (except damage type)
                        if (effect.type === 'damage') {
                            enemy.health -= effect.value;
                            log(`You hit ${enemy.name} for ${effect.value} damage!`);
                            term.nextLine(1);
                        }
                        if (effect.cost) effect.cost.forEach(cost => {
                            if (cost.type === 'essence') player.essence -= cost.value;
                            if (cost.type === 'souls') player.souls -= cost.value;
                        });
                        turnEnded = true;
                    }
                    // term.nextLine(1);
                    // log("You use a health potion.");
                    // player.essence += 20;
                    // turnEnded = true;
                } else if (action === 'abilities') {
                    term.singleColumnMenu(Object.keys(player.abilities), (error, response) => {
                        if (error) {
                            log("Error: " + error, 'red');
                        } else {
                            const ability = player.abilities[response.selectedText];
                            if (usedAbilities.includes(response.selectedText)) {
                                log("You have already used that ability once.", 'red');
                                term.nextLine(1);
                            } else {
                                log(`You use ${response.selectedText}.\n${ability.use}`);
                                usedAbilities.push(response.selectedText);
                                term.nextLine(1);
                            }
                            if (ability.effect.type === 'heal') player.essence += ability.effect.value;
                            if (ability.effect.type === 'damage') enemy.health -= ability.effect.value;
                            if (ability.cost) ability.cost.forEach(cost => {
                                if (cost.type === 'essence') player.essence -= cost.value;
                                if (cost.type === 'souls') player.souls -= cost.value;
                            });
                            updatePlayerVariable(player);
                            turnEnded = true;
                        }
                    });
                    validAction = true;
                } else if (!validAction) {
                    log("Invalid action.", 'red');
                    term.nextLine(1);
                    continue;
                }
            }

            if (enemy.health <= 0) {
                log(`You have defeated ${enemy.name}!`, 'green');
                player.experience += enemy.experience;
                delete player.room.enemies[enemy.name]; 
                term.nextLine(2);
                break;
            }

            // Enemy turn
            log(`${enemy.name}'s turn!`, 'yellow');
            term.nextLine(1);
            const enemyAction = Math.random() > 0.5 ? 'hit' : 'special'; // temporary enemy action
            if (enemyAction === 'hit') {
                const enemyDamage = Math.floor(Math.random() * enemy.damage) + 1;
                player.essence -= enemyDamage;
                log(`${enemy.name} hits you for ${enemyDamage} damage!`, 'red');
                term.nextLine(1);
            } else if (enemyAction === 'special') {
                log(`${enemy.name} uses a special attack!`, 'red');
                term.nextLine(1);
                player.essence -= enemyDamage + 2;
                // implement special attack logic
            }

            if (player.essence <= 0) {
                log("You have been defeated.", 'red');
                // implement game over logic
                updatePlayerVariable(player);
                term.nextLine(2);
                break;
            }
        }
        term.nextLine(2);
    }
    // help: () => {
    //     log(`Commands: ${Object.keys(commands)}`, 'yellow');
    // }
};

// aliases
commands.go = commands.move;
commands.cd = commands.move; // for you linux fellas
commands.walk = commands.move;
commands.examine = commands.look;
commands.inspect = commands.look;
commands.see = commands.look;
commands.check = commands.look;
commands.ls = commands.look; // for you linux fellas
commands.inv = commands.inventory;
commands.attack = commands.fight;
commands.kill = commands.fight;

async function handleCommand(command) {
    const [action, ...targetWords] = command.split(' ');
    const target = targetWords.join(' ');
    if (commands[action]) {
        await commands[action](target);
    } else {
        log("I don't understand that command.", 'red');
        term.nextLine(2);
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
const term = require('terminal-kit').terminal;
const rooms = require('../data/rooms.json');
const fs = require('fs');
const { log, logDebug, asciiLook, playSound, fadeOut, stopMusic, generateRandomRoom, displayEssence } = require('../util/util.js');
const { updatePlayerVariable, player } = require('./playerManager.js');
const itemsJSON = require('../data/items.json');
const enemiesJSON = require('../data/enemies.json');
const Enemy = require('../data/Enemy.js');

let hasAsciiArt = false; // Global variable to track ASCII art availability
let lines; // Global variable to store the amount of lines in the ASCII message
let isFighting; // Global variable to track if the player is in combat

// TODO - music/sound effects for ambiance and dialogue (we can play a single sound on loop during dialogue and then stop it when the dialogue ends)
// TODO - buy abilities from the store

function resetVariables() {
    hasAsciiArt = false;
    lines = undefined;
}

const commands = {
    look: {
        description: "Look around the current room or at an item.",
        execute: async (item) => {
            await updatePlayerVariable();
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
                const itemData = itemsJSON[itemName] || room.items[itemName];
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
                    let center = false;
                    if (player.room === 'store') center = true;
                    lines = await asciiLook(fs.readFileSync(`./ASCII/${player.room}.txt`, 'utf8'), roomDescription, center);
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
        }
    },
    move: {
        description: "Move to a different room.",
        execute: async (exit) => {
            if (!exit) {
                log("You need to specify somewhere to move to.", 'red');
                return term.nextLine(2);
            }
            let proceed = true;
            if (player.room === 'store') {
                proceed = await new Promise((resolve) => {
                    // confirm if the player wants to leave the store
                    log("Are you sure you want to leave the store? You can't come back unless you die again. (Y/N) ", 'yellow');
                    term.inputField({cancelable: true}, async (error, input) => {
                        if (error) {
                            log("Error: " + error, 'red');
                        } else {
                            if (input.toLowerCase() == 'no' || input.toLowerCase() == 'n') {
                                await handleCommand('look');
                                resolve(false);
                            } else if (input.toLowerCase() == 'yes' || input.toLowerCase() == 'y') {
                                resetVariables();
                                term.nextLine(1);
                                log("You leave the store.", 'yellow');
                                term.nextLine(2);
                                resolve(true);
                            } else { // invalid input
                                await handleCommand('look');
                                resolve(false);
                            }
                        }
                    });
                });
            };
            if (!proceed) return;

            const room = rooms[player.room] || player.room;
            let targetRoom = room.exits[exit];
            if (exit === 'forward' && player.room === 'gameSTART') {
                await startGame();
                return;
            }
            if (!targetRoom) {
                log("I don't see that exit.", 'red');
                term.nextLine(2);
                return;
            }
            player.from = exit;
            if (rooms[player.room] && rooms[player.room].exits[exit]) { // If the target room is predefined
                player.room = targetRoom;
                await updatePlayerVariable(player);
                await handleCommand('look');
            } else { // If the target room is random
                player.room = generateRandomRoom();
                await updatePlayerVariable(player);
                await handleCommand('look');
            }
            playSound('footsteps');
        }
    },
    interact: {
        description: "Interact with an item in the room.",
        execute: async (item) => {
            resetVariables();
            if (!item) {
                log("You need to specify what to use.", 'red');
                return term.nextLine(2);
            }
            item = item.toLowerCase();
            const room = rooms[player.room] || player.room;
            const roomItems = Object.keys(room.items).reduce((acc, key) => { // make the room items lowercase for easier comparison
                acc[key.toLowerCase()] = key;
                return acc;
            }, {});
            if (roomItems[item]) { // if the item exists in the room
                const originalItemName = roomItems[item]; // get the original item name
                item = itemsJSON[originalItemName] || room.items[originalItemName];
                const interact = item.interact;
                if (interact) {
                    if (item.unique) player.uniques.push(room.items[originalItemName]); // add the unique item to the player's list of found uniques
                    delete room.items[originalItemName]; // remove the item from the room
                    log(interact.description || interact, 'yellow');
                    term.nextLine(2);
                    // effects
                    if (item.effect) {
                        const effect = item.effect;
                        if (effect.type === 'move') {
                            player.room = effect.value;
                            await updatePlayerVariable(player);
                        }
                        if (effect.type === 'level') {
                            player.level += effect.value;
                            await updatePlayerVariable(player);
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
        }
    },
    inventory: {
        description: "View the items in your inventory.",
        execute: () => {
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
        }
    },
    take: {
        description: "Take an item from the room.",
        execute: (item) => {
            resetVariables();
            if (!item) {
                log("You need to specify something to take.", 'red');
                return term.nextLine(2);
            }
            item = item.toLowerCase().trim();
            const room = player.room;
            if (rooms[room]) {
                log("You can't take that.", 'red'); // if the room is predefined, you can't take anything
                term.nextLine(1);
                return;
            }
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
        }
    },
    use: {
        description: "Use an item from your inventory.",
        execute: async (item) => {
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
                        player.essence += effect.value;
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
        }
    },
    stats: {
        description: "View your character's stats.",
        execute: () => {
            resetVariables();
            asciiLook(fs.readFileSync('./ASCII/stats.txt'),`Name: ${player.name}\nEssence: ${player.essence}\nLevel: ${player.level}\nXP: ${player.experience}/${player.level * 80}\nSouls: ${player.souls}\nAbilities: ${Object.keys(player.abilities).join(', ')}`, 'yellow', true);
            term.nextLine(2);
            term.column(term.width / 2);
        }
    },
    fight: {
        description: "Fight an enemy in the room.",
        execute: async (enemy) => {
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

            if (!enemy) {
                log("You need to specify an enemy to fight.", 'red');
                return term.nextLine(2);
            }
            playSound('combat music', true);
            enemy = enemy.toLowerCase().trim();
            const enemyKey = Object.keys(enemiesJSON).find(key => key.toLowerCase() === enemy);
            const enemyData = enemiesJSON[enemyKey];
            if (!player.room.enemies[enemyKey]) {
                log("I don't see that enemy here.", 'red');
                return term.nextLine(2);
            }

            enemy = new Enemy(enemyData.name, enemyData.health, enemyData.level, enemyData.damage, {});

            let pendingMessage;

            if (fs.existsSync(`./ASCII/${enemy.name}.txt`)) { // if there is an ASCII art file for the enemy that we are fighting, display it
                hasAsciiArt = true;
                log(fs.readFileSync(`./ASCII/${enemy.name}.txt`, 'utf8'));
            } else log(`You are fighting ${enemy.name}!`, 'yellow');
            term.nextLine(2);
            let usedAbilities = [];
            while (player.essence > 0 && enemy.health > 0) {
                await displayEssence();
                const location = await term.getCursorLocation(); // it says await is unnecessary but it doesn't work properly without it
                term.moveTo(location.x, location.y); // move back after displaying essence
                if (location.y > term.height - 2) {
                    term.clear();
                    await displayEssence();
                    if (hasAsciiArt) {
                        log(fs.readFileSync(`./ASCII/${enemy.name}.txt`, 'utf8'));
                        term.nextLine(1);
                    }
                    log(pendingMessage.message, pendingMessage.color);
                    term.nextLine(2);
                }
                // Player turn
                log("Your turn!", 'yellow');
                term.nextLine(2);
                let turnEnded = false;
                let validAction = false;
                while (!turnEnded) {
                    const action = await getPlayerInput();
                    const args = action.split(' ');
                    player.defending = false; // reset defending status
                    if (action === 'help') {
                        await handleCommand('fightHelp');
                        continue;
                    }

                    if (action === 'hit') {
                        const critical = Math.random() < 0.08; // 8% chance of a critical hit
                        const miss = Math.random() < 0.05; // 5% chance of a miss
                        let playerDamage = Math.floor(Math.random() * player.level) + 1;
                        if (miss) {
                            playSound('miss');
                            playerDamage = 0;
                            pendingMessage = { message: "You missed!", color: 'red' };
                            log(pendingMessage.message, pendingMessage.color);
                        } else if (critical) {
                            playSound('hitHurt');
                            Math.floor(playerDamage *= 1.4); // 40% increase in damage for a critical hit
                            pendingMessage = { message: `Critical hit!, You hit ${enemy.name} for ${playerDamage} damage!`, color: 'yellow' };
                            log(pendingMessage.message, pendingMessage.color);
                        } else {
                            playSound('hitHurt');
                            pendingMessage = { message: `You hit ${enemy.name} for ${playerDamage} damage!` };
                            log(pendingMessage.message);
                        }
                        enemy.health -= playerDamage;
                        term.nextLine(2);
                        turnEnded = true;
                    } else if (action === 'defend') {
                        pendingMessage = { message: "You brace yourself for the next attack." };
                        log(pendingMessage.message);
                        term.nextLine(2);
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
                                term.nextLine(2);
                            }
                            if (effect.cost) effect.cost.forEach(cost => {
                                if (cost.type === 'essence') player.essence -= cost.value;
                                if (cost.type === 'souls') player.souls -= cost.value;
                            });
                            turnEnded = true;
                        }
                    } else if (action === 'abilities') {
                        const abilities = Object.keys(player.abilities).map(key => `${key} - ${player.abilities[key].description}`);
                        term.singleColumnMenu(abilities, async (error, response) => {
                            if (error) {
                                log("Error: " + error, 'red');
                            } else {
                                response.selectedText = response.selectedText.split(' - ')[0];
                                const ability = player.abilities[response.selectedText];
                                if (usedAbilities.includes(response.selectedText)) {
                                    pendingMessage = { message: "You have already used that ability once.", color: 'red' };
                                    log(pendingMessage.message, pendingMessage.color);
                                    term.nextLine(2);
                                } else {
                                    pendingMessage = { message: `You use ${response.selectedText}.\n${ability.use}` };
                                    log(pendingMessage.message);
                                    usedAbilities.push(response.selectedText);
                                    term.nextLine(2);
                                }
                                if (ability.effect.type === 'heal') player.essence += ability.effect.value;
                                if (ability.effect.type === 'damage') enemy.health -= ability.effect.value;
                                if (ability.effect.type === 'stun') enemy.status.stunned += ability.effect.value;
                                if (ability.cost) ability.cost.forEach(cost => {
                                    if (cost.type === 'essence') player.essence -= cost.value;
                                    if (cost.type === 'souls') player.souls -= cost.value;
                                });
                                updatePlayerVariable(player);
                                turnEnded = true;
                            }
                        });
                        validAction = true;
                    } else if (action == 'flee' || action == 'run') {
                        pendingMessage = { message: "You attempt to flee from the battle.", color: 'yellow' };
                        log(pendingMessage.message, pendingMessage.color);
                        term.nextLine(1);
                        const fleeChance = Math.random() * (player.level - enemy.level + 1) * 0.4; // calculate the chance of fleeing based on the level difference, multiplied by 0.4 for better balance
                        // await logDebug(fleeChance);
                        if (fleeChance > 0.5) {
                            hasAsciiArt = false;
                            await updatePlayerVariable(player);
                            fadeOut();
                            term.clear()
                            pendingMessage = { message: "You successfully fled from the battle!\n\nWhat will you do now?"};
                            log(pendingMessage.message);
                            term.nextLine(2);
                            return;
                        } else {
                            pendingMessage = { message: "You failed to flee from the battle.", color: 'red' };
                            log(pendingMessage.message, pendingMessage.color);
                            term.nextLine(2);
                            turnEnded = true;
                        }
                    } else if (!validAction) {
                        log("Invalid action.", 'red');
                        term.nextLine(1);
                        continue;
                    }
                }

                if (enemy.health <= 0) {
                    hasAsciiArt = false;
                    player.experience += enemyData.experience;
                    player.souls += enemyData.souls;
                    delete player.room.enemies[enemy.name];
                    fadeOut();
                    await updatePlayerVariable(player);
                    term.clear();
                    log(`You have defeated ${enemy.name}. +${enemyData.experience} experience and +${enemyData.souls} souls\n\nWhat will you do now?`);
                    term.nextLine(2);
                    return;
                }

                // Enemy turn
                log(`${enemy.name}'s turn!`, 'yellow');
                term.nextLine(1);
                if (enemy.status.stunned) {
                    log(`${enemy.name} is stunned and cannot attack!`, 'red');
                    term.nextLine(2);
                    enemy.status.stunned--;
                    continue;
                }
                const enemyAction = Math.random() > 0.2 ? 'hit' : 'special'; // 20% chance to use a special attack
                let critical;
                if (enemyData['criticals']) critical = Math.random() < 0.08; // 8% chance of a critical hit if the enemy is allowed crits
                const miss = Math.random() < 0.05; // 5% chance of a miss
                if (miss) {
                    playSound('miss');
                    log(`${enemy.name} missed their attack!`, 'red');
                    term.nextLine(2);
                } else if (enemyAction === 'hit') {
                    playSound('hitHurt');
                    let enemyDamage = Math.floor(Math.random() * enemy.damage) + 1;
                    if (critical) {
                        Math.floor(enemyDamage *= 1.4); // 40% increase in damage for a critical hit
                        log(`${enemy.name} lands a critical hit on you for ${enemyDamage} damage!`, 'red');
                    } else log(`${enemy.name} hits you for ${enemyDamage} damage!`, 'red');
                    player.essence -= enemyDamage;
                    term.nextLine(2);
                } else if (enemyAction === 'special') {
                    playSound('hitHurt');
                    const specials = Object.keys(enemyData.specials);
                    const specialIndex = specials[Math.floor(Math.random() * specials.length)];
                    const special = enemyData.specials[specialIndex];
                    const enemyDamage = special.effect.value; // eventually when special attacks have different effects, we will need to change this
                    log(`${enemy.name} uses a special attack: ${specialIndex}\n${special.description}\n`, 'red');
                    if (special.effect.type === 'damage') log(`You take ${enemyDamage} damage!`, 'red');
                    term.nextLine(2);
                    player.essence -= enemyDamage;
                }

                if (player.essence <= 0) {
                    term.clear();
                    hasAsciiArt = false;
                    player.room = 'store';
                    player.essence = 30;
                    await updatePlayerVariable(player);
                    stopMusic();
                    log("You have died.", 'red');
                    playSound('ambientHorn');
                    term.nextLine(2);
                    return await handleCommand('look');
                }
            }
            term.nextLine(2);
            },
            abilities: () => { // basically a help command for abilities
                resetVariables();
                log("Abilities:", 'yellow');
                term.nextLine(1);
                for (const [ability, data] of Object.entries(player.abilities)) {
                    log(`   - ${ability}: ${data.description}\n`, 'yellow');
                }
                term.nextLine(1)
            },
            store: async (action) => {
                if (player.room !== 'store') {
                    log("You are not in the store.", 'red');
                    return term.nextLine(2);
                }
                resetVariables();
                
                if (!action) {
                    log("You need to specify an action.", 'red');
                    return term.nextLine(2);
                }

                action = action.toLowerCase().trim();

                if (action === 'view') {
                    term.clear();
                    log('The storekeeper remains unresponsive. You can still see the items on display.');
                    term.nextLine(1);
                    log(`You have ${player.souls} souls.`, 'yellow');
                    term.nextLine(1);
                    log(`Items for sale:`);
                    term.nextLine(1);
                    for (const [item, data] of Object.entries(itemsJSON)) {
                        if (!data.price) continue;
                        if (player.uniques.includes(item)) continue; // don't show unique items that the player has already found
                        log(`   - (${data.price} souls) ${item}: ${data.description}\n`);
                    }
                    term.nextLine(2);
                } else if (action.startsWith('buy')) { // there's definitely a better way to do this without startsWith() but i've been trying to figure it out and i can't for some reason lol
                    let item = action.split(' ')[1];
                    logDebug(item);
                    if (!item) { // if the player didn't specify an item to buy
                        log("You keep trying to get the storekeeper's attention by asking if you can buy something, without specifying what. He remains unresponsive.", 'red');
                        return term.nextLine(2);
                    }
                    item = item.toLowerCase().trim();
                    const itemKey = Object.keys(itemsJSON).find(key => key.toLowerCase() === item);
                    const itemData = itemsJSON[itemKey];

                    if (!itemKey) { // if the item doesn't exist
                        log("The storekeeper remains unresponsive. You give up on trying to buy the item.", 'red');
                        return term.nextLine(2);
                    }

                    if (player.souls < itemData.price) { // if the player doesn't have enough souls
                        log("The storekeeper remains unresponsive. The amount of souls you wave in front of him is not enough.", 'red');
                        return term.nextLine(2);
                    }

                    player.souls -= itemData.price;
                    player.inventory.push(itemKey);
                    await updatePlayerVariable(player);
                    log(`The storekeeper finally acknowledges your presence and hands you the ${itemKey}. You hand over ${itemData.price} souls. (${player.souls} souls remaining)`);
                    term.nextLine(2);   
                } else {
                    log("Invalid action.", 'red');
                    term.nextLine(2);
                }
            }
        },
    help: {
        description: "Display a list of commands.",
        execute: () => {
            // log(`Commands: ${Object.keys(commands)}`, 'yellow');
            log("Commands:", 'yellow');
            term.nextLine(1);
            for (const [commandName, command] of Object.entries(commands)) {
                const commandAliases = Object.entries(aliases).filter(([alias, cmd]) => cmd === commandName).map(([alias, cmd]) => alias).join(', ');
                if (!aliases[commandName]) {
                    if (commandAliases.length > 0) {
                        log(`   - ${commandName}: ${command.description} (${commandAliases})\n`, 'yellow');
                    } else {
                        log(`   - ${commandName}: ${command.description}\n`, 'yellow');
                    }
                }
            }
            term.nextLine(2);
        }
    },
    fightHelp: { // this might be changed eventually
        description: "Display a list of commands for combat.",
        execute: () => {
            log("Combat Commands:\n", 'yellow');
            log("   - hit: Attack the enemy.\n", 'yellow');
            log("   - defend: Defend against the enemy's next attack.\n", 'yellow');
            log("   - use <item>: Use an item from your inventory.\n", 'yellow');
            log("   - ability <name>: Use a special ability.\n", 'yellow');
            log("   - fightHelp: Display this help message.\n", 'yellow');
            term.nextLine(1);
        }
    }
};

// aliases
const aliases = {
    go: 'move',
    cd: 'move', // for you linux fellas
    walk: 'move',
    exit: 'move',
    examine: 'look', // for you monacle-wearing fellas
    inspect: 'look', // for you detective fellas
    see: 'look',
    check: 'look',
    ls: 'look', // for you linux fellas
    inv: 'inventory',
    attack: 'fight',
    kill: 'fight'
}

Object.entries(aliases).forEach(([alias, command]) => {
    commands[alias] = commands[command];
});

async function handleCommand(command) {
    const [action, ...targetWords] = command.split(' ');
    const target = targetWords.join(' ');
    if (commands[action]) {
        await commands[action].execute(target);
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
        term.clear();
        await handleCommand(input);
        gameWaitForInput();
    });
}

async function startGameplay(pause) {
    updatePlayerVariable();
    term.clear();
    await handleCommand('look'); // on game launch, we will run the look command to display the current room to continue where we left off
    // term.nextLine(2);
    gameWaitForInput(pause);
}

async function startGame() { // this function will be called when the game is ACTUALLY, ACTUALLY starting. so we are now procedurally generating and all that
    term.clear();
    player.room = generateRandomRoom();
    await handleCommand('look'); // on game launch, we will run the look command to display the current room to continue where we left off
    // term.nextLine(2);
}

module.exports = {
    startGameplay
};
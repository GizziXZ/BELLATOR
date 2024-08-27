class Room {
	constructor(name, description, items, enemies, exits) {
		this.name = name;
		this.description = description;
		this.items = items || {};
		this.enemies = enemies || {};
		this.exits = exits || {};
	}
}

module.exports = Room;
class Room {
	constructor(name, description, items, enemies, exits) {
		this.name = name;
		this.description = description;
		this.items = {};
		this.enemies = {};
		this.exits = {};
	}
}

module.exports = Room;
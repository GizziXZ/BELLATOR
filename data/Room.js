class Room {
	constructor(name, description) {
		this.name = name;
		this.description = description;
		this.exits = {};
		this.items = {};
		this.enemies = {};
	}
}

module.exports = Room;
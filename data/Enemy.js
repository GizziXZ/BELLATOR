class Enemy {
    constructor(name, health, level, damage, status) {
        this.name = name;
        this.health = health;
        this.level = level;
        this.damage = damage;
        this.status = {};
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
    }

    isAlive() {
        return this.health > 0;
    }
}

module.exports = Enemy;
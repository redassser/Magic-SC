import { MolangVariableMap, system, world, MinecraftBlockTypes, ItemStack, DynamicPropertiesDefinition, MinecraftEntityTypes } from "@minecraft/server"
import { ActionFormData } from "@minecraft/server-ui"

world.afterEvents.worldInitialize.subscribe((event) => {
    const propertiesDefinition = new DynamicPropertiesDefinition();
    propertiesDefinition.defineNumber('manaUsed', 0);
    propertiesDefinition.defineNumber('manaMax', 100);
    event.propertyRegistry.registerEntityTypeDynamicProperties(propertiesDefinition, MinecraftEntityTypes.player);
});

//  Mana Regeneration
system.runInterval(() => {
    world.getAllPlayers().forEach(player => {
        changeMana(player, 5, false)
    });
}, 30)

//  spells
const spellDict = {
    "§r§1Block Laser": {
        manaCost: 15,
        cast: function(player) {
            const block = player.getBlockFromViewDirection({ maxDistance: 13, includeLiquidBlocks: false, includePassableBlocks: false });
            if (!block) return;
            if (changeMana(player, this.manaCost, true)) return
            const loc1 = player.getHeadLocation(), loc2 = block.block.location;
            loc1.y -= 0.5;
            loc2.x += block.faceLocation.x; loc2.y += block.faceLocation.y; loc2.z += block.faceLocation.z
            const intervalx = (loc2.x - loc1.x) / 20, intervaly = (loc2.y - loc1.y) / 20, intervalz = (loc2.z - loc1.z) / 20;
            //Laser particles
            const vars = new MolangVariableMap();
            for (let i = 0; i < 20; i++) {
                player.dimension.spawnParticle("minecraft:colored_flame_particle", loc1, vars.setColorRGB("variable.color", { red: 0, green: 0.1, blue: 0.7, alpha: 1 }));
                loc1.x += intervalx; loc1.y += intervaly; loc1.z += intervalz;
            }
            //Destroy
            block.block.dimension.spawnItem(new ItemStack(block.block.type.id), loc2);
            block.block.setType(MinecraftBlockTypes.get("minecraft:air"));
        }
    },
    "§r§4Entity Laser": {
        manaCost: 10,
        cast: function(player) {
            const entity = player.getEntitiesFromViewDirection({ maxDistance: 13 });
            if (!entity[0]) return;
            if (entity[0].entity.hasComponent("minecraft:item")) return;
            if (changeMana(player, this.manaCost, true)) return
            const loc1 = player.getHeadLocation(), loc2 = entity[0].entity.getHeadLocation();
            loc1.y -= 0.5; loc2.y -= 0.2;
            const intervalx = (loc2.x - loc1.x) / 20, intervaly = (loc2.y - loc1.y) / 20, intervalz = (loc2.z - loc1.z) / 20;
            //Laser particles
            const vars = new MolangVariableMap();
            for (let i = 0; i < 20; i++) {
                player.dimension.spawnParticle("minecraft:colored_flame_particle", loc1, vars.setColorRGB("variable.color", { red: 1, green: 0, blue: 0, alpha: 1 }));
                loc1.x += intervalx; loc1.y += intervaly; loc1.z += intervalz;
            }
            //Kill
            entity[0].entity.applyDamage(5, { cause: "magic", damagingEntity: player })
            entity[0].entity.setOnFire(5, true);
        }
    },
    "§r§2Jump": {
        manaCost: 65,
        cast: function (player) {
            if (changeMana(player, this.manaCost, true)) return
            const playerDir = player.getViewDirection();
            player.applyKnockback(playerDir.x, playerDir.z, ((1 - Math.abs(playerDir.y)) * 8), playerDir.y * 2);
            system.runTimeout(() => {
                player.addEffect('resistance', 60, {amplifier: 3, showParticles: false});
            }, 20)
        }
    }
}

const spellNameArray = Object.keys(spellDict);

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;

    //  Check wand
    const heldItem = player.getComponent("minecraft:inventory").container.getSlot(player.selectedSlot);
    if (!heldItem || heldItem.typeId != "magic:wood_wand") return
    const wandSpells = heldItem.getLore()

    if (wandSpells.length === 0) return;

    //  Sneak + Right Click to cycle between spells
    if (player.isSneaking) {
        const newSpell = changeSpells(heldItem, true)
        player.onScreenDisplay.setActionBar("Now Using " + newSpell);

    } else spellDict[wandSpells[0]].cast(player); // Right Click to cast the spell
});

world.afterEvents.itemStartUseOn.subscribe((event) => {
    if (!event.itemStack || !event.block || event.block.typeId != "magic:crystal_ball") return;

    const player = event.source;
    const heldItem = player.getComponent("minecraft:inventory").container.getSlot(player.selectedSlot);
    if (!heldItem || heldItem.typeId != "magic:wood_wand") return

    const form = new ActionFormData();
    form.title("Choose");
    for (const spell in spellDict) {
        form.button(spell);
    }
    form.show(player).then((res) => {
        if (res.canceled) return -1;
        const spellLore = heldItem.getLore();
        spellLore.push(spellNameArray[res.selection]);
        heldItem.setLore(spellLore)
    })
});
world.beforeEvents.itemUseOn.subscribe((event) => {
    if (!event.itemStack || !event.block) return;
    if (!event.block || event.itemStack.typeId != "magic:wood_wand" || event.block.typeId != "magic:crystal_ball") return;
    event.cancel = true;
});

function changeMana(player, amount, useMana) {
    if (amount === 0) return false;
    const manaUsed = player.getDynamicProperty('manaUsed');
    const manaMax = player.getDynamicProperty('manaMax');
    switch (useMana) {
        case true:
            if (manaMax - manaUsed < amount) return true; // Not enough mana
            else {
                player.setDynamicProperty('manaUsed', manaUsed + amount);
                player.onScreenDisplay.setActionBar("Mana: "+(manaMax-(manaUsed+amount))+"/"+manaMax);
                return false;
            }
        default:
            if (manaUsed === 0) return true; // Cant add mana
            else {
                if (manaUsed-amount < 0) {
                    player.setDynamicProperty('manaUsed', 0);
                    player.onScreenDisplay.setActionBar("Mana: "+0+"/"+manaMax);
                    return false;
                } else {
                    player.setDynamicProperty('manaUsed', (manaUsed-amount));
                    player.onScreenDisplay.setActionBar("Mana: "+(manaMax-manaUsed+amount)+"/"+manaMax);
                    return false;
                }
            }
    }
}
function changeSpells(wandSlot, nextSpell, spellArray = wandSlot.getLore()) {
    if (nextSpell) spellArray.push(spellArray.shift());
    wandSlot.setLore(spellArray);
    return spellArray[0];
}
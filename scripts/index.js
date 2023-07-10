import { MolangVariableMap, system, world, MinecraftBlockTypes, ItemStack, DynamicPropertiesDefinition, MinecraftEntityTypes } from "@minecraft/server"
import { ModalFormData } from "@minecraft/server-ui";

world.afterEvents.worldInitialize.subscribe((event) => {
    const propertiesDefinition = new DynamicPropertiesDefinition();
    propertiesDefinition.defineNumber('manaUsed');
    propertiesDefinition.defineNumber('manaMax');
    event.propertyRegistry.registerEntityTypeDynamicProperties(propertiesDefinition, MinecraftEntityTypes.player);
});

system.runInterval(() => {
    world.getAllPlayers().forEach(player => {
        changeMana(player, 5, false)
    });
}, 30)

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;

    //  spells
    const spells = ["Block Laser", "Entity Laser"];

    //  Check wand
    const heldItem = player.getComponent("minecraft:inventory").container.getItem(player.selectedSlot); 
    if (!heldItem || heldItem != "magic:wood_wand") return
    
    if (heldItem.typeId === "magic:crystal_ball") {
        let form = new ModalFormData();
        form.title("Choose your Spells!");
        for (let i = 0; i < buttons.length; i++) {
            let opts = [];
            for (let j = 0; j < options.length; j++) {
                if (j === player.getDynamicProperty(spells[i])) opts.push("§l§6"+options[j]);
                else opts.push(options[j])
            }
            form.dropdown(buttons[i], opts, player.getDynamicProperty(spells[i]));
        }
        form.show(player).then(res => {
            if (!res.formValues || res.selection === 0) return;
            for (let j = 0; j < options.length; j++) {
                player.setDynamicProperty(spells[j], res.formValues[j]);
            }
        }).catch(e => {
            console.error(e, e.stack);
        })
    }
    if (heldItem.typeId === "magic:wood_wand") {
        if (player.isSneaking) {
            player.setDynamicProperty('spellSwitch', !spellSwitch);
            spellName = !spellSwitch ? "Main Spell" : "Secondary Spell";
            player.onScreenDisplay.setActionBar("Now Using §l§4" + spellName);
            return;
        }
        switch (player.getDynamicProperty(spellType)) {
            case 0: // Block Laser
                {
                    const block = player.getBlockFromViewDirection({ maxDistance: 13, includeLiquidBlocks: false, includePassableBlocks: false });
                    if (!block) return;
                    if (changeMana(player, 15, true)) return
                    const loc1 = player.getHeadLocation(), loc2 = block.location;
                    loc1.y -= 0.5; loc2.x += 0.5; loc2.y += 0.5; loc2.z += 0.5;
                    const intervalx = (loc2.x - loc1.x) / 20, intervaly = (loc2.y - loc1.y) / 20, intervalz = (loc2.z - loc1.z) / 20;
                    //Laser particles
                    const vars = new MolangVariableMap();
                    for (let i = 0; i < 20; i++) {
                        player.dimension.spawnParticle("minecraft:colored_flame_particle", loc1, vars.setColorRGB("variable.color", { red: 0, green: 0.1, blue: 0.7, alpha: 1 }));
                        loc1.x += intervalx; loc1.y += intervaly; loc1.z += intervalz;
                    }
                    //Destroy
                    block.dimension.spawnItem(new ItemStack(block.type.id), loc2);
                    block.setType(MinecraftBlockTypes.get("minecraft:air"));
                }
                break;
            case 1: // Entity Laser
                {
                    const entity = player.getEntitiesFromViewDirection({ maxDistance: 13 });
                    if (!entity[0]) return;
                    if (changeMana(player, 15, true)) return
                    const loc1 = player.getHeadLocation(), loc2 = entity[0].getHeadLocation();
                    loc1.y -= 0.5; loc2.y -= 0.2;
                    const intervalx = (loc2.x - loc1.x) / 20, intervaly = (loc2.y - loc1.y) / 20, intervalz = (loc2.z - loc1.z) / 20;
                    //Laser particles
                    const vars = new MolangVariableMap();
                    for (let i = 0; i < 20; i++) {
                        player.dimension.spawnParticle("minecraft:colored_flame_particle", loc1, vars.setColorRGB("variable.color", { red: 1, green: 0, blue: 0, alpha: 1 }));
                        loc1.x += intervalx; loc1.y += intervaly; loc1.z += intervalz;
                    }
                    //Kill
                    entity[0].applyDamage(5, { cause: "magic", damagingEntity: player })
                    entity[0].setOnFire(5, true);
                }
                break;
            default:
                return;
        }
    }
})
function changeMana(player, amount, useMana) {
    if (amount === 0) return false;
    const manaUsed = player.getDynamicProperty('manaUsed');
    const manaMax = player.getDynamicProperty('manaMax');
    if (!manaUsed) player.setDynamicProperty('manaUsed', 0);
    if (!manaMax) player.setDynamicProperty('manaMax', 100);
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
                    player.setDynamicProperty('manaUsed', manaUsed-amount);
                    player.onScreenDisplay.setActionBar("Mana: "+(manaMax-manaUsed+amount)+"/"+manaMax);
                    return false;
                }
            }
    }
}
function changeSpells(wandStack, spellArray, nextSpell) {
    if (nextSpell) spellArray.push(spellArray.shift());
    wandStack.setLore([spellArray]);
}
addLayer("g", {
    name: "galaxy", // This is optional, only used in a few places, If absent it just uses the layer id
    symbol: "Galaxy Generator", // This appears on the layer's node. Default is the id with the first letter capitalized
    symbolI18N: "Galaxy Generator", // Second name of symbol for internationalization (i18n) if internationalizationMod is enabled
    position: 0, // Horizontal position within a row. By default it uses the layer id and sorts in alphabetical order
    row: 0, // Row the layer is in on the tree (0 is the first row)
    startData() { return {
        unlocked: true,
		points: new Decimal(0),
		meta: new Decimal(0),
    }},
    color: "#00FFFF",
    requires: new Decimal(0), // Can be a function that takes requirement increases into account
    layerShown(){return true},
    resource: "Galaxies", // Name of prestige currency
    resourceI18N: "Galaxies", // Second name of the resource for internationalization (i18n) if internationalizationMod is enabled
    baseAmount() {return player.points}, // Get the current amount of baseResource
    type: "none", // normal: cost to gain currency depends on amount gained. static: cost depends on how much you already have
    update(diff) {
        gGain = new Decimal(diff);
        if(hasUpgrade("g",11)) gGain = gGain.mul(player.g.points.div(2).add(1));
        if(hasUpgrade("g",12)) gGain = gGain.mul(20);
        if(hasUpgrade("g",21)) gGain = gGain.pow(player.g.meta.add(1));
        player.g.points = player.g.points.add(gGain);
        if(hasUpgrade("g",13))
        {
            metaGain = new Decimal(diff * 0.01);
            if(hasUpgrade("g",22)) metaGain = metaGain.mul(player.g.meta.add(100));
            if(hasUpgrade("g",23)) metaGain = metaGain.mul(100);
            player.g.meta = player.g.meta.add(metaGain);
        }
    },
    upgrades: {
        11: {
            title: "U-R0-0",
            titleI18N: "U-R0-0", // Second name of title for internationalization (i18n) if internationalizationMod is enabled
            description() {return "Boost Galaxy Generation based on Galaxies.<br>Currently: ×" + format(player.g.points.div(2).add(1))},
            descriptionI18N() {return "Boost Galaxy Generation based on Galaxies.<br>Currently: ×" + format(player.g.points.div(2).add(1))}, // Second name of description for internationalization (i18n) if internationalizationMod is enabled
            cost:function(){return new Decimal(10)},
            unlocked(){return true}
        },
        12: {
            title: "U-R0-1",
            titleI18N: "U-R0-1", // Second name of title for internationalization (i18n) if internationalizationMod is enabled
            description: "Vigintuple Galaxy Generation.",
            descriptionI18N: "Vigintuple Galaxy Generation.", // Second name of description for internationalization (i18n) if internationalizationMod is enabled
            cost:function(){return new Decimal(10000)},
            unlocked(){return true}
        },
        13: {
            title: "U-R0-2",
            titleI18N: "U-R0-2", // Second name of title for internationalization (i18n) if internationalizationMod is enabled
            description: "Unlock Meta-Galaxy.",
            descriptionI18N: "Unlock Meta-Galaxy.", // Second name of description for internationalization (i18n) if internationalizationMod is enabled
            cost:function(){return new Decimal(1e100)},
            unlocked(){return true}
        },
        21: {
            title: "U-R0-3",
            titleI18N: "U-R0-3", // Second name of title for internationalization (i18n) if internationalizationMod is enabled
            description() {return "Boost Galaxy Generation based on Meta-Galaxies.<br>Currently: ^" + format(player.g.meta.add(1))},
            descriptionI18N() {return "Boost Galaxy Generation based on Meta-Galaxies.<br>Currently: ^" + format(player.g.meta.add(1))}, // Second name of description for internationalization (i18n) if internationalizationMod is enabled
            cost:function(){return new Decimal(2).pow(1024)},
            unlocked(){return hasUpgrade("g",13)}
        },
        22: {
            title: "U-R0-4",
            titleI18N: "U-R0-4", // Second name of title for internationalization (i18n) if internationalizationMod is enabled
            description() {return "Boost Meta-Galaxy Generation based on Meta-Galaxies.<br>Currently: ×" + format(player.g.meta.add(100))},
            descriptionI18N() {return "Boost Meta-Galaxy Generation based on Meta-Galaxies.<br>Currently: ×" + format(player.g.meta.add(100))}, // Second name of description for internationalization (i18n) if internationalizationMod is enabled
            cost:function(){return new Decimal("e1e100")},
            unlocked(){return hasUpgrade("g",13)}
        },
        23: {
            title: "U-R0-5",
            titleI18N: "U-R0-5", // Second name of title for internationalization (i18n) if internationalizationMod is enabled
            description: "Centuple Meta-Galaxy Generation.",
            descriptionI18N: "Centuple Meta-Galaxy Generation.", // Second name of description for internationalization (i18n) if internationalizationMod is enabled
            cost:function(){return new Decimal("e1e1000")},
            unlocked(){return hasUpgrade("g",13)}
        },
        24: {
            title: "U-R0-6",
            titleI18N: "U-R0-6", // Second name of title for internationalization (i18n) if internationalizationMod is enabled
            description: "Unlock <font color='FF0000'>RETRIBUTION</font>.",
            descriptionI18N: "Unlock <font color='FF0000'>RETRIBUTION</font>.", // Second name of description for internationalization (i18n) if internationalizationMod is enabled
            cost:function(){return new Decimal("e1e10000")},
            unlocked(){return hasUpgrade("g",23)}
        },
    },
    bars: {
        retributionProgress: {
            direction: RIGHT,
            width: 1000,
            height: 50,
            fillStyle: {'background-color' : "#FF0000"},
            unlocked() { return hasUpgrade("g",24) },
            display() { return "Progress to Retribution: " + format(player.points.slog().log10().min(100)) + "%" },
            progress() { return player.points.slog().log10().div(100) },
            instant: true
        },
    },
    hotkeys: [],
    microtabs:{
        tab:{
            "main":{
                name(){return 'Upgrades'}, // Name of tab button
                nameI18N(){return 'Upgrades'}, // Second name for internationalization (i18n) if internationalizationMod is enabled
                content:[
                    ["display-text",
                        function() { return 'Your Galaxies boost Energy gain ×<font color="#00FFFF">' + format(new Decimal(2).pow(player.g.points)) + '</font>' },],
                    ["row", [["upgrade", 11], ["upgrade", 12], ["upgrade", 13]]],
                ],
            },
            "meta":{
                name(){return 'Meta-Galaxy'},
                nameI18N(){return 'Meta-Galaxy'},
                unlocked() {return hasUpgrade("g",13)},
                content:[
                    ["display-text",
                        function() { return 'You have <font color="#00C0FF">' + format(player.g.meta) + '</font> Meta-Galaxies, Energy gain ↑↑<font color="#00C0FF">' + format(player.g.meta.add(1)) + '</font>' },],
                    ["row", [["upgrade", 21], ["upgrade", 22], ["upgrade", 23], ["upgrade", 24]]],
                    "blank",
                    ["bar", "retributionProgress"],
                ],
            }
        },
    },
    tabFormat: [
       ["display-text", function() { return getPointsDisplay() }],
       "main-display",
       "prestige-button",
       "blank",
       ["microtabs","tab"]
    ]
})
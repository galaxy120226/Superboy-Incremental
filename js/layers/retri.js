var retributionRequirements = [
    "player.points.gte(new Decimal(10).tetrate(1e100))",
    "false"
]

var retributionActions = [
    "alert('没做完')"
]

addLayer("retri", {
    name: "retri", // This is optional, only used in a few places, If absent it just uses the layer id
    symbol: "Retribution", // This appears on the layer's node. Default is the id with the first letter capitalized
    symbolI18N: "Retribution", // Second name of symbol for internationalization (i18n) if internationalizationMod is enabled
    position: 0, // Horizontal position within a row. By default it uses the layer id and sorts in alphabetical order
    row: 99, // Row the layer is in on the tree (0 is the first row)
    startData() { return {
        unlocked: true,
		points: new Decimal(0),
    }},
    color: "#FF0000",
    requires: new Decimal(0), // Can be a function that takes requirement increases into account
    layerShown(){return true},
    resource: "Retributions", // Name of prestige currency
    resourceI18N: "Retributions", // Second name of the resource for internationalization (i18n) if internationalizationMod is enabled
    baseAmount() {return player.points}, // Get the current amount of baseResource
    type: "none", // normal: cost to gain currency depends on amount gained. static: cost depends on how much you already have
    buyables: {
        11: {
            display() {return "<h1>[RETRIBUTION]</h1>"},
            canAfford() {return eval(retributionRequirements[player.retributions]);},
            buy() {return eval(retributionActions[player.retributions]);}
        }
    },
    microtabs:{
        tab:{
            "main":{
                name(){return 'Retribution'}, // Name of tab button
                nameI18N(){return 'Retribution'}, // Second name for internationalization (i18n) if internationalizationMod is enabled
                content:[
                    ['buyable', 11],
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
function deduceDisplay() {
    if(!player.retribution) {
        if(player.points.lte(new Decimal(10).tetrate(9e99))) return format(player.points);
        return "ω"
    }
}
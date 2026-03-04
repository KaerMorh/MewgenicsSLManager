use serde_json::Value;

// Embed all ability JSON files at compile time
const BASIC_MOVE: &str = include_str!("../data/abilities/en/basic_move.json");
const BASIC_ATTACK: &str = include_str!("../data/abilities/en/basic_attack.json");
const DISORDER: &str = include_str!("../data/abilities/en/disorder.json");

const COLORLESS_ACTIVE: &str = include_str!("../data/abilities/en/colorless_active.json");
const COLORLESS_PASSIVE: &str = include_str!("../data/abilities/en/colorless_passive.json");
const MAGE_ACTIVE: &str = include_str!("../data/abilities/en/mage_active.json");
const MAGE_PASSIVE: &str = include_str!("../data/abilities/en/mage_passive.json");
const FIGHTER_ACTIVE: &str = include_str!("../data/abilities/en/fighter_active.json");
const FIGHTER_PASSIVE: &str = include_str!("../data/abilities/en/fighter_passive.json");
const HUNTER_ACTIVE: &str = include_str!("../data/abilities/en/hunter_active.json");
const HUNTER_PASSIVE: &str = include_str!("../data/abilities/en/hunter_passive.json");
const THIEF_ACTIVE: &str = include_str!("../data/abilities/en/thief_active.json");
const THIEF_PASSIVE: &str = include_str!("../data/abilities/en/thief_passive.json");
const TANK_ACTIVE: &str = include_str!("../data/abilities/en/tank_active.json");
const TANK_PASSIVE: &str = include_str!("../data/abilities/en/tank_passive.json");
const MEDIC_ACTIVE: &str = include_str!("../data/abilities/en/medic_active.json");
const MEDIC_PASSIVE: &str = include_str!("../data/abilities/en/medic_passive.json");
const MONK_ACTIVE: &str = include_str!("../data/abilities/en/monk_active.json");
const MONK_PASSIVE: &str = include_str!("../data/abilities/en/monk_passive.json");
const BUTCHER_ACTIVE: &str = include_str!("../data/abilities/en/butcher_active.json");
const BUTCHER_PASSIVE: &str = include_str!("../data/abilities/en/butcher_passive.json");
const DRUID_ACTIVE: &str = include_str!("../data/abilities/en/druid_active.json");
const DRUID_PASSIVE: &str = include_str!("../data/abilities/en/druid_passive.json");
const TINKERER_ACTIVE: &str = include_str!("../data/abilities/en/tinkerer_active.json");
const TINKERER_PASSIVE: &str = include_str!("../data/abilities/en/tinkerer_passive.json");
const NECROMANCER_ACTIVE: &str = include_str!("../data/abilities/en/necromancer_active.json");
const NECROMANCER_PASSIVE: &str = include_str!("../data/abilities/en/necromancer_passive.json");
const PSYCHIC_ACTIVE: &str = include_str!("../data/abilities/en/psychic_active.json");
const PSYCHIC_PASSIVE: &str = include_str!("../data/abilities/en/psychic_passive.json");
const JESTER_ACTIVE: &str = include_str!("../data/abilities/en/jester_active.json");
const JESTER_PASSIVE: &str = include_str!("../data/abilities/en/jester_passive.json");

const MUTATIONS_ALL: &str = include_str!("../data/mutations/en/all.json");
const FURNITURE_DB: &str = include_str!("../data/furniture/en/furniture_db.json");

pub fn get_ability_db() -> Value {
    let mut map = serde_json::Map::new();

    map.insert("basic_move".into(), serde_json::from_str(BASIC_MOVE).unwrap_or(Value::Null));
    map.insert("basic_attack".into(), serde_json::from_str(BASIC_ATTACK).unwrap_or(Value::Null));
    map.insert("disorder".into(), serde_json::from_str(DISORDER).unwrap_or(Value::Null));

    let classes = [
        "colorless", "mage", "fighter", "hunter", "thief", "tank",
        "medic", "monk", "butcher", "druid", "tinkerer", "necromancer",
        "psychic", "jester",
    ];
    let active_strs = [
        COLORLESS_ACTIVE, MAGE_ACTIVE, FIGHTER_ACTIVE, HUNTER_ACTIVE,
        THIEF_ACTIVE, TANK_ACTIVE, MEDIC_ACTIVE, MONK_ACTIVE,
        BUTCHER_ACTIVE, DRUID_ACTIVE, TINKERER_ACTIVE, NECROMANCER_ACTIVE,
        PSYCHIC_ACTIVE, JESTER_ACTIVE,
    ];
    let passive_strs = [
        COLORLESS_PASSIVE, MAGE_PASSIVE, FIGHTER_PASSIVE, HUNTER_PASSIVE,
        THIEF_PASSIVE, TANK_PASSIVE, MEDIC_PASSIVE, MONK_PASSIVE,
        BUTCHER_PASSIVE, DRUID_PASSIVE, TINKERER_PASSIVE, NECROMANCER_PASSIVE,
        PSYCHIC_PASSIVE, JESTER_PASSIVE,
    ];

    for (i, cls) in classes.iter().enumerate() {
        let active_key = format!("{}_active", cls);
        let passive_key = format!("{}_passive", cls);
        map.insert(active_key, serde_json::from_str(active_strs[i]).unwrap_or(Value::Null));
        map.insert(passive_key, serde_json::from_str(passive_strs[i]).unwrap_or(Value::Null));
    }

    Value::Object(map)
}

pub fn get_mutation_db() -> Value {
    serde_json::from_str(MUTATIONS_ALL).unwrap_or(Value::Null)
}

pub fn get_furniture_db() -> Value {
    serde_json::from_str(FURNITURE_DB).unwrap_or(Value::Null)
}

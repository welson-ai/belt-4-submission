use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec, Map};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceSnapshot {
    pub price: i128,
    pub timestamp: u64,
    pub cumulative_price: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PricePair {
    pub token_a: Address,
    pub token_b: Address,
    pub last_snapshot: PriceSnapshot,
    pub price_history: Vec<PriceSnapshot>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    PricePair(Address, Address),
}

const MAX_HISTORY_LENGTH: u32 = 100;
const TWAP_WINDOW: u64 = 3600; // 1 hour in seconds

#[contract]
pub struct PriceOracle;

#[contractimpl]
impl PriceOracle {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn record_price(env: Env, token_a: Address, token_b: Address, price: i128, timestamp: u64) {
        Self::require_admin(env.clone());
        
        if price <= 0 {
            panic!("price must be positive");
        }

        let pair_key = Self::get_pair_key(token_a.clone(), token_b.clone());
        let current_time = env.ledger().timestamp();

        let mut price_pair: PricePair = if env.storage().instance().has(&pair_key) {
            env.storage().instance().get(&pair_key).unwrap()
        } else {
            PricePair {
                token_a: token_a.clone(),
                token_b: token_b.clone(),
                last_snapshot: PriceSnapshot {
                    price: 0,
                    timestamp: 0,
                    cumulative_price: 0,
                },
                price_history: Vec::new(&env),
            }
        };

        // Calculate cumulative price for TWAP
        let time_elapsed = if price_pair.last_snapshot.timestamp > 0 {
            current_time.saturating_sub(price_pair.last_snapshot.timestamp)
        } else {
            0
        };

        let new_cumulative_price = if time_elapsed > 0 {
            price_pair.last_snapshot.cumulative_price
                .checked_add(price.checked_mul(time_elapsed as i128).unwrap_or_else(|| panic!("overflow")))
                .unwrap_or_else(|| panic!("overflow"))
        } else {
            price_pair.last_snapshot.cumulative_price
        };

        let new_snapshot = PriceSnapshot {
            price,
            timestamp: current_time,
            cumulative_price: new_cumulative_price,
        };

        // Update price history (keep only recent snapshots)
        price_pair.price_history.push_back(new_snapshot.clone());
        
        // Trim history if too long
        while price_pair.price_history.len() > MAX_HISTORY_LENGTH {
            price_pair.price_history.remove(0);
        }

        price_pair.last_snapshot = new_snapshot;

        env.storage().instance().set(&pair_key, &price_pair);

        let topics = (Symbol::short("RECORD_PRICE"), token_a, token_b, price, current_time);
        env.events().publish(topics, ());
    }

    pub fn get_twap(env: Env, token_a: Address, token_b: Address, period: u64) -> i128 {
        let pair_key = Self::get_pair_key(token_a.clone(), token_b.clone());
        
        if !env.storage().instance().has(&pair_key) {
            panic!("price pair not found");
        }

        let price_pair: PricePair = env.storage().instance().get(&pair_key).unwrap();
        let current_time = env.ledger().timestamp();

        if price_pair.price_history.is_empty() {
            return 0;
        }

        // Find the oldest snapshot within the period
        let mut oldest_timestamp = current_time.saturating_sub(period);
        let mut cumulative_price_in_period = 0i128;
        let mut total_time_in_period = 0u64;

        for snapshot in price_pair.price_history.iter() {
            if snapshot.timestamp >= oldest_timestamp {
                let next_timestamp = if let Some(next_snapshot) = price_pair.price_history.iter()
                    .find(|s| s.timestamp > snapshot.timestamp) {
                    next_snapshot.timestamp
                } else {
                    current_time
                };

                let time_diff = next_timestamp.saturating_sub(snapshot.timestamp);
                if time_diff > 0 {
                    cumulative_price_in_period = cumulative_price_in_period
                        .checked_add(snapshot.price.checked_mul(time_diff as i128).unwrap_or_else(|| panic!("overflow")))
                        .unwrap_or_else(|| panic!("overflow"));
                    total_time_in_period += time_diff;
                }
            }
        }

        if total_time_in_period == 0 {
            return price_pair.last_snapshot.price;
        }

        cumulative_price_in_period.checked_div(total_time_in_period as i128)
            .unwrap_or_else(|| panic!("division error"))
    }

    pub fn get_latest_price(env: Env, token_a: Address, token_b: Address) -> i128 {
        let pair_key = Self::get_pair_key(token_a.clone(), token_b.clone());
        
        if !env.storage().instance().has(&pair_key) {
            panic!("price pair not found");
        }

        let price_pair: PricePair = env.storage().instance().get(&pair_key).unwrap();
        price_pair.last_snapshot.price
    }

    pub fn get_price_history(env: Env, token_a: Address, token_b: Address, limit: u32) -> Vec<PriceSnapshot> {
        let pair_key = Self::get_pair_key(token_a.clone(), token_b.clone());
        
        if !env.storage().instance().has(&pair_key) {
            return Vec::new(&env);
        }

        let price_pair: PricePair = env.storage().instance().get(&pair_key).unwrap();
        let history_len = price_pair.price_history.len();
        
        if limit == 0 || limit >= history_len {
            return price_pair.price_history;
        }

        let start_idx = history_len.saturating_sub(limit);
        let mut result = Vec::new(&env);
        
        for i in start_idx..history_len {
            result.push_back(price_pair.price_history.get(i as u32).unwrap());
        }

        result
    }

    pub fn get_all_pairs(env: Env) -> Vec<(Address, Address)> {
        // Note: In a production environment, you might want to maintain
        // a separate list of all tracked pairs for efficiency
        Vec::new(&env)
    }

    fn get_pair_key(token_a: Address, token_b: Address) -> DataKey {
        // Always store pairs in a consistent order (lexicographically)
        if token_a < token_b {
            DataKey::PricePair(token_a, token_b)
        } else {
            DataKey::PricePair(token_b, token_a)
        }
    }

    fn require_admin(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("not initialized"));
        admin.require_auth();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Address, Env};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let admin = Address::generate(&env);
        
        PriceOracle::initialize(env.clone(), admin.clone());
    }

    #[test]
    fn test_record_and_get_price() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let token_a = Address::generate(&env);
        let token_b = Address::generate(&env);
        
        PriceOracle::initialize(env.clone(), admin.clone());
        
        let price = 1500000i128; // 1.5 with 6 decimals
        let timestamp = env.ledger().timestamp();
        
        PriceOracle::record_price(env.clone(), token_a.clone(), token_b.clone(), price, timestamp);
        
        let latest_price = PriceOracle::get_latest_price(env.clone(), token_a.clone(), token_b.clone());
        assert_eq!(latest_price, price);
    }

    #[test]
    fn test_twap_calculation() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let token_a = Address::generate(&env);
        let token_b = Address::generate(&env);
        
        PriceOracle::initialize(env.clone(), admin.clone());
        
        // Record multiple prices over time
        let base_time = 1000000u64;
        
        PriceOracle::record_price(env.clone(), token_a.clone(), token_b.clone(), 1000000, base_time);
        PriceOracle::record_price(env.clone(), token_a.clone(), token_b.clone(), 2000000, base_time + 1000);
        PriceOracle::record_price(env.clone(), token_a.clone(), token_b.clone(), 1500000, base_time + 2000);
        
        // Get TWAP over the entire period
        let twap = PriceOracle::get_twap(env.clone(), token_a.clone(), token_b.clone(), 2000);
        
        // TWAP should be somewhere between 1000000 and 2000000
        assert!(twap >= 1000000 && twap <= 2000000);
    }

    #[test]
    fn test_price_history() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let token_a = Address::generate(&env);
        let token_b = Address::generate(&env);
        
        PriceOracle::initialize(env.clone(), admin.clone());
        
        // Record multiple prices
        for i in 0..5 {
            let price = (i + 1) * 1000000i128;
            let timestamp = 1000000u64 + i * 1000;
            PriceOracle::record_price(env.clone(), token_a.clone(), token_b.clone(), price, timestamp);
        }
        
        let history = PriceOracle::get_price_history(env.clone(), token_a.clone(), token_b.clone(), 3);
        assert_eq!(history.len(), 3);
        
        // Should get the last 3 prices
        assert_eq!(history.get(0).unwrap().price, 3000000);
        assert_eq!(history.get(1).unwrap().price, 4000000);
        assert_eq!(history.get(2).unwrap().price, 5000000);
    }

    #[test]
    fn test_pair_key_consistency() {
        let env = Env::default();
        let token_a = Address::generate(&env);
        let token_b = Address::generate(&env);
        
        let key1 = PriceOracle::get_pair_key(token_a.clone(), token_b.clone());
        let key2 = PriceOracle::get_pair_key(token_b.clone(), token_a.clone());
        
        // Should be the same regardless of order
        assert_eq!(key1, key2);
    }
}

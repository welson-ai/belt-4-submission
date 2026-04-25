use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, Symbol, token};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AllowanceValue {
    pub amount: i128,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(Address, Address),
    TotalSupply,
    Metadata,
}

#[contract]
pub struct LpToken;

#[contractimpl]
impl LpToken {
    pub fn initialize(env: Env, admin: Address, name: String, symbol: String, decimals: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
        
        let metadata = (name, symbol, decimals);
        env.storage().instance().set(&DataKey::Metadata, &metadata);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        Self::require_admin(env.clone());
        
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let total_supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        let new_total_supply = total_supply.checked_add(amount).unwrap_or_else(|| panic!("overflow"));
        env.storage().instance().set(&DataKey::TotalSupply, &new_total_supply);

        Self::receive(env, to, amount);
        
        let topics = (Symbol::short("MINT"), to, amount);
        env.events().publish(topics, ());
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        Self::require_admin(env.clone());
        
        if amount <= 0 {
            panic!("amount must be positive");
        }

        Self::spend(env.clone(), from.clone(), amount);

        let total_supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        let new_total_supply = total_supply.checked_sub(amount).unwrap_or_else(|| panic!("insufficient supply"));
        env.storage().instance().set(&DataKey::TotalSupply, &new_total_supply);
        
        let topics = (Symbol::short("BURN"), from, amount);
        env.events().publish(topics, ());
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }

        Self::spend(env.clone(), from.clone(), amount);
        Self::receive(env, to, amount);
        
        let topics = (Symbol::short("TRANSFER"), from, to, amount);
        env.events().publish(topics, ());
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance: AllowanceValue = env.storage().instance().get(&allowance_key).unwrap_or_else(|| AllowanceValue {
            amount: 0,
            expires_at: 0,
        });

        let current_time = env.ledger().timestamp();
        if allowance.expires_at > 0 && allowance.expires_at < current_time {
            panic!("allowance expired");
        }

        if allowance.amount < amount {
            panic!("insufficient allowance");
        }

        let new_allowance = allowance.amount - amount;
        if new_allowance == 0 {
            env.storage().instance().remove(&allowance_key);
        } else {
            let updated_allowance = AllowanceValue {
                amount: new_allowance,
                expires_at: allowance.expires_at,
            };
            env.storage().instance().set(&allowance_key, &updated_allowance);
        }

        Self::spend(env.clone(), from.clone(), amount);
        Self::receive(env, to, amount);
        
        let topics = (Symbol::short("TRANSFER_FROM"), from, to, amount);
        env.events().publish(topics, ());
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expires_at: u64) {
        from.require_auth();
        
        let allowance = AllowanceValue {
            amount,
            expires_at,
        };
        
        let allowance_key = DataKey::Allowance(from, spender);
        if amount == 0 {
            env.storage().instance().remove(&allowance_key);
        } else {
            env.storage().instance().set(&allowance_key, &allowance);
        }
        
        let topics = (Symbol::short("APPROVE"), from, spender, amount, expires_at);
        env.events().publish(topics, ());
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().instance().get(&DataKey::Balance(id)).unwrap_or(0)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> AllowanceValue {
        let allowance: AllowanceValue = env.storage().instance()
            .get(&DataKey::Allowance(from, spender))
            .unwrap_or_else(|| AllowanceValue {
                amount: 0,
                expires_at: 0,
            });
        
        let current_time = env.ledger().timestamp();
        if allowance.expires_at > 0 && allowance.expires_at < current_time {
            return AllowanceValue {
                amount: 0,
                expires_at: 0,
            };
        }
        
        allowance
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    pub fn decimals(env: Env) -> u32 {
        let metadata: (String, String, u32) = env.storage().instance()
            .get(&DataKey::Metadata)
            .unwrap_or_else(|| panic!("not initialized"));
        metadata.2
    }

    pub fn name(env: Env) -> String {
        let metadata: (String, String, u32) = env.storage().instance()
            .get(&DataKey::Metadata)
            .unwrap_or_else(|| panic!("not initialized"));
        metadata.0
    }

    pub fn symbol(env: Env) -> String {
        let metadata: (String, String, u32) = env.storage().instance()
            .get(&DataKey::Metadata)
            .unwrap_or_else(|| panic!("not initialized"));
        metadata.1
    }

    fn receive(env: Env, to: Address, amount: i128) {
        let balance_key = DataKey::Balance(to);
        let balance: i128 = env.storage().instance().get(&balance_key).unwrap_or(0);
        let new_balance = balance.checked_add(amount).unwrap_or_else(|| panic!("overflow"));
        env.storage().instance().set(&balance_key, &new_balance);
    }

    fn spend(env: Env, from: Address, amount: i128) {
        let balance_key = DataKey::Balance(from.clone());
        let balance: i128 = env.storage().instance().get(&balance_key).unwrap_or(0);
        
        if balance < amount {
            panic!("insufficient balance");
        }
        
        let new_balance = balance - amount;
        if new_balance == 0 {
            env.storage().instance().remove(&balance_key);
        } else {
            env.storage().instance().set(&balance_key, &new_balance);
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
        
        LpToken::initialize(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "Liquidity Pool Token"),
            String::from_str(&env, "LPT"),
            7,
        );

        assert_eq!(LpToken::name(env.clone()), String::from_str(&env, "Liquidity Pool Token"));
        assert_eq!(LpToken::symbol(env.clone()), String::from_str(&env, "LPT"));
        assert_eq!(LpToken::decimals(env.clone()), 7);
    }

    #[test]
    fn test_mint_burn() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        
        LpToken::initialize(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "LP Token"),
            String::from_str(&env, "LPT"),
            7,
        );

        LpToken::mint(env.clone(), user.clone(), 1000);
        assert_eq!(LpToken::balance(env.clone(), user.clone()), 1000);
        assert_eq!(LpToken::total_supply(env.clone()), 1000);

        LpToken::burn(env.clone(), user.clone(), 300);
        assert_eq!(LpToken::balance(env.clone(), user.clone()), 700);
        assert_eq!(LpToken::total_supply(env.clone()), 700);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);
        
        LpToken::initialize(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "LP Token"),
            String::from_str(&env, "LPT"),
            7,
        );

        LpToken::mint(env.clone(), user1.clone(), 1000);
        
        LpToken::transfer(env.clone(), user1.clone(), user2.clone(), 300);
        assert_eq!(LpToken::balance(env.clone(), user1.clone()), 700);
        assert_eq!(LpToken::balance(env.clone(), user2.clone()), 300);
    }

    #[test]
    fn test_approve_transfer_from() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let recipient = Address::generate(&env);
        
        LpToken::initialize(
            env.clone(),
            admin.clone(),
            String::from_str(&env, "LP Token"),
            String::from_str(&env, "LPT"),
            7,
        );

        LpToken::mint(env.clone(), owner.clone(), 1000);
        
        LpToken::approve(env.clone(), owner.clone(), spender.clone(), 500, 0);
        
        let allowance = LpToken::allowance(env.clone(), owner.clone(), spender.clone());
        assert_eq!(allowance.amount, 500);

        LpToken::transfer_from(env.clone(), spender.clone(), owner.clone(), recipient.clone(), 200);
        
        assert_eq!(LpToken::balance(env.clone(), owner.clone()), 800);
        assert_eq!(LpToken::balance(env.clone(), recipient.clone()), 200);
        
        let allowance = LpToken::allowance(env.clone(), owner.clone(), spender.clone());
        assert_eq!(allowance.amount, 300);
    }
}

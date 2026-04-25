use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, contractclient,
};

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

        let total_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        let new_total_supply = total_supply
            .checked_add(amount)
            .unwrap_or_else(|| panic!("overflow"));
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &new_total_supply);

        Self::receive(env.clone(), to.clone(), amount);

        let topics = (symbol_short!("MINT"), to, amount);
        env.events().publish(topics, ());
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        Self::require_admin(env.clone());

        if amount <= 0 {
            panic!("amount must be positive");
        }

        Self::spend(env.clone(), from.clone(), amount);

        let total_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        let new_total_supply = total_supply
            .checked_sub(amount)
            .unwrap_or_else(|| panic!("insufficient supply"));
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &new_total_supply);

        let topics = (symbol_short!("BURN"), from, amount);
        env.events().publish(topics, ());
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }

        Self::spend(env.clone(), from.clone(), amount);
        Self::receive(env.clone(), to.clone(), amount);

        let topics = (symbol_short!("TRANSFER"), from, to, amount);
        env.events().publish(topics, ());
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance: AllowanceValue = env
            .storage()
            .instance()
            .get(&allowance_key)
            .unwrap_or_else(|| AllowanceValue {
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
            env.storage()
                .instance()
                .set(&allowance_key, &updated_allowance);
        }

        Self::spend(env.clone(), from.clone(), amount);
        Self::receive(env.clone(), to.clone(), amount);

        let topics = (Symbol::new(&env, "transfer_from"), from, to, amount);
        env.events().publish(topics, ());
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, expires_at: u64) {
        from.require_auth();

        let allowance = AllowanceValue { amount, expires_at };

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        if amount == 0 {
            env.storage().instance().remove(&allowance_key);
        } else {
            env.storage().instance().set(&allowance_key, &allowance);
        }

        let topics = (symbol_short!("APPROVE"), from, spender, amount, expires_at);
        env.events().publish(topics, ());
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> AllowanceValue {
        let allowance: AllowanceValue = env
            .storage()
            .instance()
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
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn decimals(env: Env) -> u32 {
        let metadata: (String, String, u32) = env
            .storage()
            .instance()
            .get(&DataKey::Metadata)
            .unwrap_or_else(|| panic!("not initialized"));
        metadata.2
    }

    pub fn name(env: Env) -> String {
        let metadata: (String, String, u32) = env
            .storage()
            .instance()
            .get(&DataKey::Metadata)
            .unwrap_or_else(|| panic!("not initialized"));
        metadata.0
    }

    pub fn symbol(env: Env) -> String {
        let metadata: (String, String, u32) = env
            .storage()
            .instance()
            .get(&DataKey::Metadata)
            .unwrap_or_else(|| panic!("not initialized"));
        metadata.1
    }

    fn receive(env: Env, to: Address, amount: i128) {
        let balance_key = DataKey::Balance(to);
        let balance: i128 = env.storage().instance().get(&balance_key).unwrap_or(0);
        let new_balance = balance
            .checked_add(amount)
            .unwrap_or_else(|| panic!("overflow"));
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
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("not initialized"));
        admin.require_auth();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
        Address, Env, String,
    };

    fn setup() -> (Env, Address, LpTokenClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, LpToken);
        let client = LpTokenClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        (env, admin, client)
    }

    #[test]
    fn test_initialize() {
        let (env, admin, client) = setup();
        client.initialize(
            &admin,
            &String::from_str(&env, "Liquidity Pool Token"),
            &String::from_str(&env, "LPT"),
            &7u32,
        );
        assert_eq!(client.name(), String::from_str(&env, "Liquidity Pool Token"));
        assert_eq!(client.symbol(), String::from_str(&env, "LPT"));
        assert_eq!(client.decimals(), 7u32);
        assert_eq!(client.total_supply(), 0i128);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize_panics() {
        let (env, admin, client) = setup();
        client.initialize(
            &admin,
            &String::from_str(&env, "LP Token"),
            &String::from_str(&env, "LPT"),
            &7u32,
        );
        // Second call must panic
        client.initialize(
            &admin,
            &String::from_str(&env, "LP Token"),
            &String::from_str(&env, "LPT"),
            &7u32,
        );
    }

    #[test]
    fn test_mint_and_burn() {
        let (env, admin, client) = setup();
        let user = Address::generate(&env);

        client.initialize(
            &admin,
            &String::from_str(&env, "LP Token"),
            &String::from_str(&env, "LPT"),
            &7u32,
        );

        client.mint(&user, &1000i128);
        assert_eq!(client.balance(&user), 1000i128);
        assert_eq!(client.total_supply(), 1000i128);

        client.burn(&user, &400i128);
        assert_eq!(client.balance(&user), 600i128);
        assert_eq!(client.total_supply(), 600i128);
    }

    #[test]
    fn test_transfer() {
        let (env, admin, client) = setup();
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        client.initialize(
            &admin,
            &String::from_str(&env, "LP Token"),
            &String::from_str(&env, "LPT"),
            &7u32,
        );
        client.mint(&user1, &1000i128);
        client.transfer(&user1, &user2, &300i128);

        assert_eq!(client.balance(&user1), 700i128);
        assert_eq!(client.balance(&user2), 300i128);
    }

    #[test]
    fn test_approve_and_transfer_from() {
        let (env, admin, client) = setup();
        let owner   = Address::generate(&env);
        let spender = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.initialize(
            &admin,
            &String::from_str(&env, "LP Token"),
            &String::from_str(&env, "LPT"),
            &7u32,
        );
        client.mint(&owner, &1000i128);
        client.approve(&owner, &spender, &500i128, &0u64);

        let allowance = client.allowance(&owner, &spender);
        assert_eq!(allowance.amount, 500i128);

        client.transfer_from(&spender, &owner, &recipient, &200i128);

        assert_eq!(client.balance(&owner), 800i128);
        assert_eq!(client.balance(&recipient), 200i128);
        assert_eq!(client.allowance(&owner, &spender).amount, 300i128);
    }

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_transfer_insufficient_balance_panics() {
        let (env, admin, client) = setup();
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        client.initialize(
            &admin,
            &String::from_str(&env, "LP Token"),
            &String::from_str(&env, "LPT"),
            &7u32,
        );
        client.mint(&user1, &100i128);
        client.transfer(&user1, &user2, &999i128); // must panic
    }
}

#[contractclient(name = "LpTokenClient")]
pub trait LpToken {
    fn initialize(env: &Env, admin: &Address, name: &String, symbol: &String, decimals: &u32);
    fn mint(env: &Env, to: &Address, amount: &i128);
    fn burn(env: &Env, from: &Address, amount: &i128);
    fn transfer(env: &Env, from: &Address, to: &Address, amount: &i128);
    fn transfer_from(env: &Env, spender: &Address, from: &Address, to: &Address, amount: &i128);
    fn approve(env: &Env, owner: &Address, spender: &Address, amount: &i128, expires_at: &u64);
    fn balance(env: &Env, id: &Address) -> i128;
    fn allowance(env: &Env, from: &Address, spender: &Address) -> AllowanceValue;
    fn name(env: &Env) -> String;
    fn symbol(env: &Env) -> String;
    fn decimals(env: &Env) -> u32;
    fn total_supply(env: &Env) -> i128;
}

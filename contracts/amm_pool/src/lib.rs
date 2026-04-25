use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Vec, Symbol, IntoVal, contractclient,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolInfo {
    pub token_a: Address,
    pub token_b: Address,
    pub lp_token: Address,
    pub reserve_a: i128,
    pub reserve_b: i128,
    pub total_lp_supply: i128,
    pub admin: Address,
}

#[contracttype]
pub enum DataKey {
    PoolInfo,
    Oracle,
}

const FEE_BASIS_POINTS: i128 = 30;
const BASIS_POINTS_MULTIPLIER: i128 = 10000;

fn integer_sqrt(n: i128) -> i128 {
    if n < 0 {
        panic!("sqrt of negative");
    }
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

#[contract]
pub struct AmmPool;

#[contractimpl]
impl AmmPool {
    pub fn initialize(
        env: Env,
        token_a: Address,
        token_b: Address,
        lp_token: Address,
        oracle: Address,
    ) {
        if env.storage().instance().has(&DataKey::PoolInfo) {
            panic!("already initialized");
        }

        if token_a == token_b {
            panic!("tokens must be different");
        }

        let admin = env.current_contract_address();

        let pool_info = PoolInfo {
            token_a: token_a.clone(),
            token_b: token_b.clone(),
            lp_token: lp_token.clone(),
            reserve_a: 0,
            reserve_b: 0,
            total_lp_supply: 0,
            admin: admin.clone(),
        };

        env.storage().instance().set(&DataKey::PoolInfo, &pool_info);
        env.storage().instance().set(&DataKey::Oracle, &oracle);
    }

    pub fn add_liquidity(
        env: Env,
        user: Address,
        amount_a: i128,
        amount_b: i128,
        min_lp: i128,
    ) -> i128 {
        user.require_auth();

        if amount_a <= 0 || amount_b <= 0 {
            panic!("amounts must be positive");
        }

        let mut pool_info: PoolInfo = env
            .storage()
            .instance()
            .get(&DataKey::PoolInfo)
            .unwrap_or_else(|| panic!("not initialized"));

        let lp_amount = if pool_info.total_lp_supply == 0 {
            // First liquidity provider - set the initial price
            let product = amount_a
                .checked_mul(amount_b)
                .unwrap_or_else(|| panic!("overflow"));
            integer_sqrt(product)
        } else {
            // Calculate optimal amount based on current reserves
            let optimal_b = amount_a
                .checked_mul(pool_info.reserve_b)
                .unwrap_or_else(|| panic!("overflow"))
                .checked_div(pool_info.reserve_a)
                .unwrap_or_else(|| panic!("division error"));

            if optimal_b <= amount_b {
                amount_a
                    .checked_mul(pool_info.total_lp_supply)
                    .unwrap_or_else(|| panic!("overflow"))
                    .checked_div(pool_info.reserve_a)
                    .unwrap_or_else(|| panic!("division error"))
            } else {
                let optimal_a = amount_b
                    .checked_mul(pool_info.reserve_a)
                    .unwrap_or_else(|| panic!("overflow"))
                    .checked_div(pool_info.reserve_b)
                    .unwrap_or_else(|| panic!("division error"));

                optimal_a
                    .checked_mul(pool_info.total_lp_supply)
                    .unwrap_or_else(|| panic!("overflow"))
                    .checked_div(pool_info.reserve_a)
                    .unwrap_or_else(|| panic!("division error"))
            }
        };

        if lp_amount < min_lp {
            panic!("insufficient LP tokens");
        }

        // Transfer tokens from user to pool
        Self::transfer_tokens(
            env.clone(),
            user.clone(),
            env.current_contract_address(),
            pool_info.token_a.clone(),
            amount_a,
        );
        Self::transfer_tokens(
            env.clone(),
            user.clone(),
            env.current_contract_address(),
            pool_info.token_b.clone(),
            amount_b,
        );

        // Update reserves
        pool_info.reserve_a = pool_info
            .reserve_a
            .checked_add(amount_a)
            .unwrap_or_else(|| panic!("overflow"));
        pool_info.reserve_b = pool_info
            .reserve_b
            .checked_add(amount_b)
            .unwrap_or_else(|| panic!("overflow"));
        pool_info.total_lp_supply = pool_info
            .total_lp_supply
            .checked_add(lp_amount)
            .unwrap_or_else(|| panic!("overflow"));

        env.storage().instance().set(&DataKey::PoolInfo, &pool_info);

        // Mint LP tokens to user
        Self::mint_lp_tokens(
            env.clone(),
            user.clone(),
            lp_amount,
            pool_info.lp_token.clone(),
        );

        let topics = (
            Symbol::new(&env, "add_liquidity"),
            user,
            amount_a,
            amount_b,
            lp_amount,
        );
        env.events().publish(topics, ());

        lp_amount
    }

    pub fn remove_liquidity(
        env: Env,
        user: Address,
        lp_amount: i128,
        min_a: i128,
        min_b: i128,
    ) -> (i128, i128) {
        user.require_auth();

        if lp_amount <= 0 {
            panic!("LP amount must be positive");
        }

        let mut pool_info: PoolInfo = env
            .storage()
            .instance()
            .get(&DataKey::PoolInfo)
            .unwrap_or_else(|| panic!("not initialized"));

        if pool_info.total_lp_supply < lp_amount {
            panic!("insufficient LP supply");
        }

        // Calculate amounts to return
        let amount_a = lp_amount
            .checked_mul(pool_info.reserve_a)
            .unwrap_or_else(|| panic!("overflow"))
            .checked_div(pool_info.total_lp_supply)
            .unwrap_or_else(|| panic!("division error"));

        let amount_b = lp_amount
            .checked_mul(pool_info.reserve_b)
            .unwrap_or_else(|| panic!("overflow"))
            .checked_div(pool_info.total_lp_supply)
            .unwrap_or_else(|| panic!("division error"));

        if amount_a < min_a || amount_b < min_b {
            panic!("insufficient output amounts");
        }

        // Burn LP tokens
        Self::burn_lp_tokens(
            env.clone(),
            user.clone(),
            lp_amount,
            pool_info.lp_token.clone(),
        );

        // Update reserves
        pool_info.reserve_a = pool_info
            .reserve_a
            .checked_sub(amount_a)
            .unwrap_or_else(|| panic!("underflow"));
        pool_info.reserve_b = pool_info
            .reserve_b
            .checked_sub(amount_b)
            .unwrap_or_else(|| panic!("underflow"));
        pool_info.total_lp_supply = pool_info
            .total_lp_supply
            .checked_sub(lp_amount)
            .unwrap_or_else(|| panic!("underflow"));

        env.storage().instance().set(&DataKey::PoolInfo, &pool_info);

        // Transfer tokens to user
        Self::transfer_tokens(
            env.clone(),
            env.current_contract_address(),
            user.clone(),
            pool_info.token_a.clone(),
            amount_a,
        );
        Self::transfer_tokens(
            env.clone(),
            env.current_contract_address(),
            user.clone(),
            pool_info.token_b.clone(),
            amount_b,
        );

        let topics = (
            Symbol::new(&env, "remove_liquidity"),
            user,
            amount_a,
            amount_b,
            lp_amount,
        );
        env.events().publish(topics, ());

        (amount_a, amount_b)
    }

    pub fn swap(
        env: Env,
        user: Address,
        token_in: Address,
        amount_in: i128,
        min_amount_out: i128,
    ) -> i128 {
        user.require_auth();

        if amount_in <= 0 {
            panic!("amount must be positive");
        }

        let mut pool_info: PoolInfo = env
            .storage()
            .instance()
            .get(&DataKey::PoolInfo)
            .unwrap_or_else(|| panic!("not initialized"));

        let (reserve_in, reserve_out, token_out) = if token_in == pool_info.token_a {
            (
                pool_info.reserve_a,
                pool_info.reserve_b,
                pool_info.token_b.clone(),
            )
        } else if token_in == pool_info.token_b {
            (
                pool_info.reserve_b,
                pool_info.reserve_a,
                pool_info.token_a.clone(),
            )
        } else {
            panic!("invalid token");
        };

        if reserve_in == 0 || reserve_out == 0 {
            panic!("insufficient liquidity");
        }

        // Calculate amount out with fee
        let amount_in_with_fee = amount_in
            .checked_mul(BASIS_POINTS_MULTIPLIER - FEE_BASIS_POINTS)
            .unwrap_or_else(|| panic!("overflow in fee calc"));

        let numerator = amount_in_with_fee
            .checked_mul(reserve_out)
            .unwrap_or_else(|| panic!("overflow in numerator"));

        let denominator = reserve_in
            .checked_mul(BASIS_POINTS_MULTIPLIER)
            .and_then(|v| v.checked_add(amount_in_with_fee))
            .unwrap_or_else(|| panic!("overflow in denominator"));

        let amount_out = numerator
            .checked_div(denominator)
            .unwrap_or_else(|| panic!("division by zero"));

        if amount_out < min_amount_out {
            panic!("insufficient output amount");
        }

        // Transfer tokens
        Self::transfer_tokens(
            env.clone(),
            user.clone(),
            env.current_contract_address(),
            token_in.clone(),
            amount_in,
        );
        Self::transfer_tokens(
            env.clone(),
            env.current_contract_address(),
            user.clone(),
            token_out.clone(),
            amount_out,
        );

        // Update reserves
        if token_in == pool_info.token_a {
            pool_info.reserve_a = reserve_in
                .checked_add(amount_in)
                .unwrap_or_else(|| panic!("overflow"));
            pool_info.reserve_b = reserve_out
                .checked_sub(amount_out)
                .unwrap_or_else(|| panic!("underflow"));
        } else {
            pool_info.reserve_b = reserve_in
                .checked_add(amount_in)
                .unwrap_or_else(|| panic!("overflow"));
            pool_info.reserve_a = reserve_out
                .checked_sub(amount_out)
                .unwrap_or_else(|| panic!("underflow"));
        }

        env.storage().instance().set(&DataKey::PoolInfo, &pool_info);

        // Record price in oracle
        let oracle: Address = env.storage().instance().get(&DataKey::Oracle).unwrap();
        let price = Self::calculate_price(env.clone(), token_in.clone(), amount_in);
        let timestamp = env.ledger().timestamp();
        Self::record_price_in_oracle(
            env.clone(),
            oracle,
            pool_info.token_a.clone(),
            pool_info.token_b.clone(),
            price,
            timestamp,
        );

        let topics = (
            symbol_short!("SWAP"),
            user,
            token_in,
            amount_in,
            token_out,
            amount_out,
        );
        env.events().publish(topics, ());

        amount_out
    }

    pub fn get_price(env: Env, token_in: Address, amount_in: i128) -> i128 {
        let pool_info: PoolInfo = env
            .storage()
            .instance()
            .get(&DataKey::PoolInfo)
            .unwrap_or_else(|| panic!("not initialized"));

        Self::calculate_price(env, token_in, amount_in)
    }

    pub fn get_reserves(env: Env) -> (i128, i128) {
        let pool_info: PoolInfo = env
            .storage()
            .instance()
            .get(&DataKey::PoolInfo)
            .unwrap_or_else(|| panic!("not initialized"));
        (pool_info.reserve_a, pool_info.reserve_b)
    }

    pub fn get_pool_info(env: Env) -> PoolInfo {
        env.storage()
            .instance()
            .get(&DataKey::PoolInfo)
            .unwrap_or_else(|| panic!("not initialized"))
    }

    fn calculate_price(env: Env, token_in: Address, amount_in: i128) -> i128 {
        let pool_info: PoolInfo = env
            .storage()
            .instance()
            .get(&DataKey::PoolInfo)
            .unwrap_or_else(|| panic!("not initialized"));

        let (reserve_in, reserve_out) = if token_in == pool_info.token_a {
            (pool_info.reserve_a, pool_info.reserve_b)
        } else if token_in == pool_info.token_b {
            (pool_info.reserve_b, pool_info.reserve_a)
        } else {
            panic!("invalid token");
        };

        if reserve_in == 0 || reserve_out == 0 {
            return 0;
        }

        // Calculate amount out with fee
        let amount_in_with_fee = amount_in
            .checked_mul(BASIS_POINTS_MULTIPLIER - FEE_BASIS_POINTS)
            .unwrap_or_else(|| panic!("overflow in fee calc"));

        let numerator = amount_in_with_fee
            .checked_mul(reserve_out)
            .unwrap_or_else(|| panic!("overflow in numerator"));

        let denominator = reserve_in
            .checked_mul(BASIS_POINTS_MULTIPLIER)
            .and_then(|v| v.checked_add(amount_in_with_fee))
            .unwrap_or_else(|| panic!("overflow in denominator"));

        let amount_out = numerator
            .checked_div(denominator)
            .unwrap_or_else(|| panic!("division by zero"));

        amount_out
    }

    fn transfer_tokens(env: Env, from: Address, to: Address, token: Address, amount: i128) {
        let client = token::Client::new(&env, &token);
        client.transfer(&from, &to, &amount);
    }

    fn mint_lp_tokens(env: Env, to: Address, amount: i128, lp_token_contract: Address) {
        let lp_token = LpTokenClient::new(&env, &lp_token_contract);
        lp_token.mint(&env, &to, &amount);
    }

    fn burn_lp_tokens(env: Env, from: Address, amount: i128, lp_token_contract: Address) {
        let lp_token = LpTokenClient::new(&env, &lp_token_contract);
        lp_token.burn(&env, &from, &amount);
    }

    fn record_price_in_oracle(
        env: Env,
        oracle: Address,
        token_a: Address,
        token_b: Address,
        price: i128,
        timestamp: u64,
    ) {
        let oracle_client = PriceOracleClient::new(&env, &oracle);
        oracle_client.record_price(&env, &token_a, &token_b, &price, &timestamp);
    }
}

// Contract client interfaces for inter-contract calls
#[derive(Clone)]
struct LpTokenClient {
    address: Address,
}

impl LpTokenClient {
    fn new(env: &Env, address: &Address) -> Self {
        Self {
            address: address.clone(),
        }
    }

    fn mint(&self, env: &Env, to: &Address, amount: &i128) {
        let args = (to.clone(), *amount).into_val(env);
        env.invoke_contract::<()>(&self.address, &symbol_short!("mint"), args);
    }

    fn burn(&self, env: &Env, from: &Address, amount: &i128) {
        let args = (from.clone(), *amount).into_val(env);
        env.invoke_contract::<()>(&self.address, &symbol_short!("burn"), args);
    }
}

#[derive(Clone)]
struct PriceOracleClient {
    address: Address,
}

impl PriceOracleClient {
    fn new(env: &Env, address: &Address) -> Self {
        Self {
            address: address.clone(),
        }
    }

    fn record_price(&self, env: &Env, token_a: &Address, token_b: &Address, price: &i128, timestamp: &u64) {
        let args = (token_a.clone(), token_b.clone(), *price, *timestamp).into_val(env);
        env.invoke_contract::<()>(&self.address, &Symbol::new(env, "record_price"), args);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    fn setup(env: &Env) -> (
        Address,          // token_a
        Address,          // token_b
        Address,          // lp_token contract
        Address,          // oracle contract
        AmmPoolClient,    // amm client
    ) {
        env.mock_all_auths();

        let token_a  = Address::generate(env);
        let token_b  = Address::generate(env);

        // Register dependent contracts so inter-contract calls resolve
        let lp_token_id = env.register_contract(None, crate::lp_token::LpToken);
        let oracle_id   = env.register_contract(None, crate::price_oracle::PriceOracle);
        let amm_id      = env.register_contract(None, AmmPool);

        let lp_client     = crate::lp_token::LpTokenClient::new(env, &lp_token_id);
        let oracle_client = crate::price_oracle::PriceOracleClient::new(env, &oracle_id);
        let amm_client    = AmmPoolClient::new(env, &amm_id);

        let admin = Address::generate(env);
        lp_client.initialize(
            &admin,
            &String::from_str(env, "LP Token"),
            &String::from_str(env, "LPT"),
            &7u32,
        );
        oracle_client.initialize(&admin);
        amm_client.initialize(&token_a, &token_b, &lp_token_id, &oracle_id);

        (token_a, token_b, lp_token_id, oracle_id, amm_client)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let (token_a, token_b, lp, oracle, client) = setup(&env);

        let info = client.get_pool_info();
        assert_eq!(info.token_a, token_a);
        assert_eq!(info.token_b, token_b);
        assert_eq!(info.lp_token, lp);
        assert_eq!(info.oracle, oracle);
    }

    #[test]
    fn test_add_and_remove_liquidity() {
        let env = Env::default();
        let (_, _, _, _, client) = setup(&env);
        let user = Address::generate(&env);

        let lp_received = client.add_liquidity(&user, &1_000_000i128, &2_000_000i128, &0i128);
        assert!(lp_received > 0);

        let (reserves_a, reserves_b) = client.get_reserves();
        assert_eq!(reserves_a, 1_000_000i128);
        assert_eq!(reserves_b, 2_000_000i128);

        let (out_a, out_b) = client.remove_liquidity(&user, &(lp_received / 2), &0i128, &0i128);
        assert!(out_a > 0);
        assert!(out_b > 0);
    }

    #[test]
    fn test_swap_changes_reserves() {
        let env = Env::default();
        let (token_a, _, _, _, client) = setup(&env);
        let user = Address::generate(&env);

        // Seed liquidity first
        client.add_liquidity(&user, &10_000_000i128, &10_000_000i128, &0i128);

        let (r_a_before, r_b_before) = client.get_reserves();
        let amount_out = client.swap(&token_a, &1_000_000i128, &0i128);

        let (r_a_after, r_b_after) = client.get_reserves();
        assert!(amount_out > 0);
        assert!(r_a_after > r_a_before);   // token_a reserve increased
        assert!(r_b_after < r_b_before);   // token_b reserve decreased
    }

    #[test]
    fn test_fee_stays_in_pool() {
        let env = Env::default();
        let (token_a, _, _, _, client) = setup(&env);
        let user = Address::generate(&env);

        client.add_liquidity(&user, &10_000_000i128, &10_000_000i128, &0i128);

        let amount_in = 1_000_000i128;
        let amount_out = client.swap(&token_a, &amount_in, &0i128);

        // With 0.3% fee, output must be less than a zero-fee swap
        let zero_fee_out = amount_in * 10_000_000 / (10_000_000 + amount_in);
        assert!(amount_out < zero_fee_out);
    }

    #[test]
    fn test_get_price_quote() {
        let env = Env::default();
        let (token_a, _, _, _, client) = setup(&env);
        let user = Address::generate(&env);

        client.add_liquidity(&user, &10_000_000i128, &10_000_000i128, &0i128);

        let quote = client.get_price(&token_a, &1_000_000i128);
        assert!(quote > 0);
        // With equal reserves, quote should be just under 1:1 due to fee
        assert!(quote < 1_000_000i128);
    }
}

#[contractclient(name = "AmmPoolClient")]
pub trait AmmPool {
    fn initialize(env: &Env, token_a: &Address, token_b: &Address, lp_token: &Address, oracle: &Address);
    fn add_liquidity(env: &Env, user: &Address, amount_a: &i128, amount_b: &i128, min_lp: &i128) -> i128;
    fn remove_liquidity(env: &Env, user: &Address, lp_amount: &i128, min_a: &i128, min_b: &i128) -> (i128, i128);
    fn swap(env: &Env, user: &Address, token_in: &Address, amount_in: &i128, min_out: &i128) -> i128;
    fn get_price(env: &Env, token_in: &Address, amount_in: &i128) -> i128;
    fn get_reserves(env: &Env) -> (i128, i128);
    fn get_pool_info(env: &Env) -> PoolInfo;
}

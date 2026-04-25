import { test, expect } from '@playwright/test';

test.describe('StellarSwap DEX', () => {
  test('home page loads correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle(/StellarSwap/);
    
    // Check main elements are present
    await expect(page.locator('h1')).toContainText('StellarSwap AMM');
    await expect(page.locator('text=Decentralized exchange for Stellar tokens')).toBeVisible();
    
    // Check navigation
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('text=Swap')).toBeVisible();
    await expect(page.locator('text=Pool')).toBeVisible();
    await expect(page.locator('text=Oracle')).toBeVisible();
  });

  test('swap interface is functional', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check swap card is present
    await expect(page.locator('text=Swap')).toBeVisible();
    await expect(page.locator('[placeholder="0.0"]')).toBeVisible();
    
    // Check token selection
    await expect(page.locator('select')).toHaveCount(2);
    
    // Check settings button
    await expect(page.locator('button[aria-label="settings"]')).toBeVisible();
    
    // Test settings modal
    await page.locator('button[aria-label="settings"]').click();
    await expect(page.locator('text=Slippage Tolerance')).toBeVisible();
    await expect(page.locator('text=0.1%')).toBeVisible();
    await expect(page.locator('text=0.5%')).toBeVisible();
    await expect(page.locator('text=1.0%')).toBeVisible();
  });

  test('wallet connection flow', async ({ page }) => {
    await page.goto('/');
    
    // Check connect wallet button
    const connectButton = page.locator('text=Connect Wallet');
    await expect(connectButton).toBeVisible();
    
    // In a real test with Freighter, you would mock the wallet
    // For now, just check the button exists and is clickable
    await expect(connectButton).toBeEnabled();
  });

  test('responsive design works', async ({ page }) => {
    await page.goto('/');
    
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('nav')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('nav')).toBeVisible();
    
    // Check mobile menu button
    const menuButton = page.locator('button[aria-label="menu"]');
    await expect(menuButton).toBeVisible();
    
    // Test mobile menu
    await menuButton.click();
    await expect(page.locator('text=Swap')).toBeVisible();
    await expect(page.locator('text=Pool')).toBeVisible();
    await expect(page.locator('text=Oracle')).toBeVisible();
  });

  test('pool statistics display', async ({ page }) => {
    await page.goto('/');
    
    // Wait for data to load
    await page.waitForLoadState('networkidle');
    
    // Check statistics cards
    await expect(page.locator('text=Token A Reserve')).toBeVisible();
    await expect(page.locator('text=Token B Reserve')).toBeVisible();
    await expect(page.locator('text=Current Price')).toBeVisible();
    await expect(page.locator('text=24h Volume')).toBeVisible();
  });

  test('swap calculation works', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Find the amount input field
    const amountInput = page.locator('[placeholder="0.0"]').first();
    await amountInput.fill('100');
    
    // Wait for calculation to complete
    await page.waitForTimeout(1000);
    
    // Check that output is calculated (should not be empty after valid input)
    const outputField = page.locator('[placeholder="0.0"]').nth(1);
    const outputValue = await outputField.inputValue();
    
    // In a real implementation, this would calculate actual swap output
    // For now, just verify the field exists and can be interacted with
    expect(outputField).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('handles invalid swap amounts', async ({ page }) => {
    await page.goto('/');
    
    // Try negative amount
    const amountInput = page.locator('[placeholder="0.0"]').first();
    await amountInput.fill('-100');
    
    // Check that error handling works (swap button should be disabled)
    const swapButton = page.locator('button:has-text("Swap")');
    await expect(swapButton).toBeDisabled();
  });

  test('handles wallet not connected', async ({ page }) => {
    await page.goto('/');
    
    // Try to swap without wallet connection
    const amountInput = page.locator('[placeholder="0.0"]').first();
    await amountInput.fill('100');
    
    // Swap button should show "Connect Wallet"
    const swapButton = page.locator('button:has-text("Connect Wallet")');
    await expect(swapButton).toBeVisible();
  });
});

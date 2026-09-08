import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Bobbies Homie - End-to-End Comprehensive System Tests', () => {
  const timestamp = Date.now();
  const user1Username = `owner_${timestamp}`;
  const user1Email = `owner_${timestamp}@bobbies.com`;
  const user1Pass = 'password123';
  const householdName = `Bobbies Home ${timestamp}`;

  const user2Username = `partner_${timestamp}`;
  const user2Email = `partner_${timestamp}@bobbies.com`;
  const user2Pass = 'password123';

  let sharedInviteCode = '';

  test('Journey 1: Owner Registration, Household Creation, Theme/Account, Batch Shopping, Calendar, Pets, Finances & Logout', async ({ page }) => {
    // 1. Visit Register Page
    await page.goto('/register');
    await expect(page).toHaveURL(/.*register/);

    const textInputs = page.locator('form input[type="text"]');
    // Field 0: Full Name
    await textInputs.nth(0).fill('Owner Bobbie');
    // Field 1: Username
    await textInputs.nth(1).fill(user1Username);
    // Email
    await page.locator('form input[type="email"]').fill(user1Email);
    // Password & Confirm Password
    const passInputs = page.locator('form input[type="password"]');
    await passInputs.nth(0).fill(user1Pass);
    await passInputs.nth(1).fill(user1Pass);
    // Household name (Field 2)
    await textInputs.nth(2).fill(householdName);

    // Submit Registration
    await page.click('form button[type="submit"]');

    // Should redirect to Dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
    await expect(page.locator('h1')).toBeVisible();

    // 2. Avatar Button on Dashboard leading to Account / Profile Page
    const avatarBtn = page.locator('a[href="/profile"]');
    await expect(avatarBtn).toBeVisible();
    await avatarBtn.click();
    await expect(page).toHaveURL(/.*profile/);

    // 3. Extract Real Generated Invite Code on Profile Page
    const inviteCodeElem = page.locator('code').first();
    await expect(inviteCodeElem).toBeVisible({ timeout: 10000 });
    // Wait until invite code is loaded (not '...' and not empty)
    await expect(inviteCodeElem).not.toHaveText('...', { timeout: 15000 });
    await expect(inviteCodeElem).not.toHaveText('', { timeout: 5000 });
    sharedInviteCode = (await inviteCodeElem.innerText()).trim();
    console.log(`[TEST] Successfully generated household invite code: "${sharedInviteCode}"`);
    expect(sharedInviteCode.length).toBeGreaterThanOrEqual(6);

    // 4. Test Theme Switcher (Dark Mode Deep Warm Brown: #1F1511 / #2D1E18)
    const darkThemeBtn = page.locator('button:has-text("Dark"), button:has-text("มืด")').first();
    if (await darkThemeBtn.isVisible()) {
      await darkThemeBtn.click();
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(isDark).toBe(true);
    }

    // Switch back to light
    const lightThemeBtn = page.locator('button:has-text("Light"), button:has-text("สว่าง")').first();
    if (await lightThemeBtn.isVisible()) {
      await lightThemeBtn.click();
      const isLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
      expect(isLight).toBe(true);
    }

    // 5. Shopping Page: Verify .no-scrollbar and Create Batch Multi-Item List
    await page.goto('/shopping');
    await expect(page).toHaveURL(/.*shopping/);
    await page.waitForLoadState('networkidle');

    const scrollContainer = page.locator('.no-scrollbar').first();
    await expect(scrollContainer).toBeAttached();

    // Open Batch Creator Modal
    const newBatchBtn = page.locator('button:has-text("สร้างลิสต์ซื้อของ"), button:has-text("New Shopping List")').first();
    await newBatchBtn.click();

    // Fill Batch List Title & Location
    await page.fill('input[placeholder*="ของสด"], input[placeholder*="Weekly Groceries"]', 'ตลาดสดเย็นนี้');
    const locInput = page.locator('input[placeholder*="เช่น Lotus"], input[placeholder*="Supermarket"]');
    if (await locInput.isVisible()) {
      await locInput.fill('Lotus Supermarket');
    }

    // Modal initializes with 2 rows by default:
    // Fill Row 1 item title
    const itemTitleInputs = page.locator('input[placeholder*="ชื่อของ"], input[placeholder*="Item name"]');
    await itemTitleInputs.nth(0).fill('อกไก่สด 1 กก.');
    // Fill Row 2 item title
    await itemTitleInputs.nth(1).fill('ผักกาดขาว');

    // Submit batch shopping list
    await page.click('form button[type="submit"]');

    // Verify list and items appear on page
    await expect(page.locator('text=ตลาดสดเย็นนี้').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=อกไก่สด 1 กก.').first()).toBeVisible();
    await expect(page.locator('text=ผักกาดขาว').first()).toBeVisible();

    // Toggle item to purchased
    const firstItemBtn = page.locator('button:has-text("อกไก่สด 1 กก.")').first();
    await firstItemBtn.click();

    // 6. Unified Calendar Page
    await page.goto('/calendar');
    await expect(page).toHaveURL(/.*calendar/);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=กิจกรรมรวมในบ้าน').first()).toBeVisible();

    // Add Event Modal
    const addEventBtn = page.locator('button:has-text("เพิ่มนัดหมาย"), button:has-text("Add Event")').first();
    await addEventBtn.click();
    await page.fill('input[placeholder*="ชื่อกิจกรรม"], input[placeholder*="Event Title"]', 'ประชุมวางแผนบ้าน');
    await page.click('form button[type="submit"]');

    await expect(page.locator('text=ประชุมวางแผนบ้าน').first()).toBeVisible({ timeout: 10000 });

    // 7. Pet Management Page
    await page.goto('/pets');
    await expect(page).toHaveURL(/.*pets/);
    await page.waitForLoadState('networkidle');

    const addPetBtn = page.locator('button:has-text("เพิ่มสัตว์เลี้ยง"), button:has-text("Add Pet")').first();
    await addPetBtn.click();
    await page.fill('input[placeholder*="ชื่อสัตว์เลี้ยง"], input[placeholder*="Pet Name"]', 'Milo Dog');
    const breedInput = page.locator('input[placeholder*="สายพันธุ์"], input[placeholder*="Breed"]');
    if (await breedInput.isVisible()) {
      await breedInput.fill('Corgi');
    }
    await page.click('form button[type="submit"]');
    await expect(page.locator('text=Milo Dog').first()).toBeVisible({ timeout: 10000 });

    // Add Care Log
    const addLogBtn = page.locator('button:has-text("เพิ่มบันทึกการดูแล"), button:has-text("Add Log")').first();
    if (await addLogBtn.isVisible()) {
      await addLogBtn.click();
      await page.fill('input[placeholder*="ชื่อการดูแล"], input[placeholder*="Care Task"]', 'ฉีดวัคซีนประจำปี');
      await page.click('form button[type="submit"]');
      await expect(page.locator('text=ฉีดวัคซีนประจำปี').first()).toBeVisible({ timeout: 10000 });
    }

    // 8. Shared Finances Page
    await page.goto('/finances');
    await expect(page).toHaveURL(/.*finances/);
    await page.waitForLoadState('networkidle');

    const addExpenseBtn = page.locator('button:has-text("เพิ่มบิลค่าใช้จ่าย"), button:has-text("Add Expense")').first();
    await addExpenseBtn.click();
    await page.fill('input[placeholder*="ชื่อรายการค่าใช้จ่าย"], input[placeholder*="Expense Title"]', 'ค่าไฟเดือนนี้');
    await page.fill('input[type="number"]', '850');
    await page.click('form button[type="submit"]');

    await expect(page.locator('text=ค่าไฟเดือนนี้').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=฿850.00').first()).toBeVisible();

    // 9. Logout via Profile Page
    await page.goto('/profile');
    await expect(page).toHaveURL(/.*profile/);
    const logoutBtn = page.locator('button:has-text("ออกจากระบบ"), button:has-text("Log Out")');
    await logoutBtn.click();
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
  });

  test('Journey 2: Username & Password Login System Verification', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);

    // Login using Owner's clean alphanumeric username (tests get_email_by_username RPC)
    const identifierInput = page.locator('form input[type="text"]');
    await identifierInput.fill(user1Username);

    const passInput = page.locator('form input[type="password"]');
    await passInput.fill(user1Pass);

    await page.click('form button[type="submit"]');

    // Should successfully authenticate and redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
    await expect(page.locator('h1')).toBeVisible();

    // Sign out to prepare for Journey 3 (Partner)
    await page.goto('/profile');
    const logoutBtn = page.locator('button:has-text("ออกจากระบบ"), button:has-text("Log Out")');
    await logoutBtn.click();
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
  });

  test('Journey 3: Partner Registration with Invite Code & Household Co-Management Verification', async ({ page }) => {
    // 1. Visit Register Page as Partner
    await page.goto('/register');
    await expect(page).toHaveURL(/.*register/);

    const textInputs = page.locator('form input[type="text"]');
    await textInputs.nth(0).fill('Partner Bobbie');
    await textInputs.nth(1).fill(user2Username);
    await page.locator('form input[type="email"]').fill(user2Email);

    const passInputs = page.locator('form input[type="password"]');
    await passInputs.nth(0).fill(user2Pass);
    await passInputs.nth(1).fill(user2Pass);

    // Switch to "มีรหัสคำเชิญแล้ว" (Join Household with Invite Code)
    const joinTab = page.locator('button:has-text("มีรหัสคำเชิญแล้ว"), button:has-text("Have invite code")').first();
    await joinTab.click();

    // Enter User 1's Real Invite Code
    const inviteInput = page.locator('input[placeholder*="รหัสคำเชิญ"], input[placeholder*="Invite Code"]');
    await inviteInput.fill(sharedInviteCode);

    // Submit Registration
    await page.click('form button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });

    // 2. Verify Partner Sees Shared Shopping List created by Owner
    await page.goto('/shopping');
    await expect(page.locator('text=ตลาดสดเย็นนี้').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=อกไก่สด 1 กก.').first()).toBeVisible();
    await expect(page.locator('text=ผักกาดขาว').first()).toBeVisible();

    // 3. Verify Partner Sees Shared Calendar Event
    await page.goto('/calendar');
    await expect(page.locator('text=ประชุมวางแผนบ้าน').first()).toBeVisible({ timeout: 10000 });

    // 4. Verify Partner Sees Shared Pet & Care Log
    await page.goto('/pets');
    await expect(page.locator('text=Milo Dog').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=ฉีดวัคซีนประจำปี').first()).toBeVisible({ timeout: 10000 });

    // 5. Verify Partner Sees Shared Finance Bill
    await page.goto('/finances');
    await expect(page.locator('text=ค่าไฟเดือนนี้').first()).toBeVisible({ timeout: 10000 });
  });
});

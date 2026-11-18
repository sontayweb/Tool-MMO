import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        page.on('console', lambda msg: print(f'[BROWSER CONSOLE] {msg.text}'))
        page.on('request', lambda req: print(f'[BROWSER REQ] {req.method} {req.url}') if '/api/' in req.url else None)

        await page.goto('http://localhost:3000/#accounts')
        await page.evaluate('''() => {
            localStorage.setItem('arms_token', 'mock_token');
            localStorage.setItem('arms_user', JSON.stringify({
                username: 'admin',
                role: 'OWNER',
                team: 'ALL',
                display_name: 'Quản Lý Tổng (Owner)'
            }));
            localStorage.setItem('arms_active_tab', 'accounts');
        }''')
        await page.reload()
        await page.wait_for_timeout(2000)

        tiktok_btn = page.locator('button:has-text("TIKTOK MMO")')
        count = await tiktok_btn.count()
        print('TikTok buttons count:', count)
        if count > 0:
            print('Clicking TikTok button...')
            await tiktok_btn.first.click()
            await page.wait_for_timeout(2000)

        await browser.close()

asyncio.run(main())


"""Shop regression probe: run the whole shop job in a real browser and save screenshots.

    python3 scripts/shop-flow.py [http://localhost:3000]

Walks: walk into the shop (we are behind the counter) -> a customer at the counter asks the price ->
we quote -> we scan the item with the scanner in our hand -> cash payment -> next customer, who
walks in through the door and joins the line. Fails (exit 1) on any page error or missing step.
"""
import asyncio
import sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
NO_SPEECH = ("Object.defineProperty(window,'speechSynthesis',{get:()=>undefined});"
             "window.webkitSpeechRecognition=undefined; window.SpeechRecognition=undefined;")
SHOTS = 'scripts/shots'
ERRORS = []


async def settle(page):
    """Wait until the client has finished both the request and playing the reply."""
    await page.wait_for_timeout(700)
    await page.wait_for_function('() => !window.__fw.isBusy()', timeout=30000)


async def chip(page, label, wait=600):
    await settle(page)
    await page.wait_for_selector(f'.chips button:has-text("{label}")', timeout=15000)
    await page.click(f'.chips button:has-text("{label}")')
    await page.wait_for_timeout(wait)
    await settle(page)
    line = ' '.join((await page.inner_text('#bubbleText')).split())
    st = await page.evaluate("() => window.__fw.getState().sceneState")
    print(f'  {label!r} -> {line[:150]}')
    print(f'    stage={st["stage"]} price={st["price"]} scanned={st["scanned"]} served={st["customerServed"]} item={st["customerItem"]}')
    return line, st


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=GL)
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 800})
        await ctx.add_init_script(NO_SPEECH)
        page = await ctx.new_page()
        page.on('pageerror', lambda e: ERRORS.append(str(e)))
        page.on('console', lambda m: ERRORS.append('console: ' + m.text) if m.type == 'error' else None)

        await page.goto(BASE + '/#/')
        await page.wait_for_selector('#playBtn'); await page.wait_for_timeout(900)
        await page.click('#playBtn'); await page.wait_for_selector('#newBtn'); await page.wait_for_timeout(500)
        await page.click('#newBtn')
        await page.fill('input[name=name]', 'Tisha'); await page.select_option('select[name=age]', '5')
        await page.click('.pet-choice button[data-pet=cat]'); await page.fill('input[name=pin]', '1234')
        await page.wait_for_timeout(300); await page.click('#newForm .btn.big'); await page.wait_for_timeout(8000)

        await page.click('.scene-dock button[data-scene=shop]'); await page.wait_for_timeout(10000)
        queue = await page.evaluate("() => [...window.__fw.world.actors.values()].filter(a => a.data && a.data.role === 'customer').map(a => a.data.name + ':' + a.data.queue)")
        cam = await page.evaluate("() => window.__fw.engine.camera.position.toArray().map(v => +v.toFixed(2))")
        print(f'  behind the counter at {cam}; the line: {queue}')
        await page.screenshot(path=f'{SHOTS}/shop-staff-view.png')
        await settle(page)

        # easy zoom: the on-screen buttons must move us further out and back in again
        await page.click('#zoomOutBtn'); await page.wait_for_timeout(300); await page.click('#zoomOutBtn')
        await page.wait_for_timeout(1800)
        zoomed = await page.evaluate("() => +window.__fw.engine.cam.dist.toFixed(2)")
        print(f'  zoom out -> camera distance {zoomed}')
        await page.screenshot(path=f'{SHOTS}/shop-zoomed-out.png')
        await page.click('#zoomInBtn'); await page.wait_for_timeout(300); await page.click('#zoomInBtn')
        await page.wait_for_timeout(1500)
        print(f'  zoom back in -> camera distance {await page.evaluate("() => +window.__fw.engine.cam.dist.toFixed(2)")}')

        await chip(page, 'How much is it?'); await page.screenshot(path=f'{SHOTS}/shop-1-price.png')
        await chip(page, 'Scan it'); await page.screenshot(path=f'{SHOTS}/shop-2-scan.png')
        await chip(page, 'Take the money'); await page.screenshot(path=f'{SHOTS}/shop-3-paid.png')
        await chip(page, 'Next customer'); await page.wait_for_timeout(2500)
        line2 = await page.evaluate("() => [...window.__fw.world.actors.values()].filter(a => a.data && a.data.role === 'customer').map(a => a.data.name + ':' + a.data.queue + '@' + a.g.position.toArray().map(v => v.toFixed(1)))")
        print(f'  the line now: {line2}')
        await page.screenshot(path=f'{SHOTS}/shop-4-next.png')

        # look around: a full turn on our own spot
        for i, (dx, dy) in enumerate([(260, 0), (-520, 0), (-520, 90)]):
            await page.mouse.move(640, 300); await page.mouse.down()
            await page.mouse.move(640 + dx, 300 + dy, steps=10); await page.mouse.up()
            await page.wait_for_timeout(1500)
            await page.screenshot(path=f'{SHOTS}/shop-look-{i}.png')

        await browser.close()

    print('ERRORS', ERRORS) if ERRORS else print('  ✓ no page errors')
    return 1 if ERRORS else 0


sys.exit(asyncio.run(main()))

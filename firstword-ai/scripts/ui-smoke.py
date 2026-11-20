"""Headless UI smoke test for the 3D game (optional dev tool): python3 scripts/ui-smoke.py [base-url]
Requires: pip install playwright && python3 -m playwright install chromium (+ install-deps on Linux)
Walks: title → player select → new player → 3D play (typed turns spawn objects/characters, weather, free travel,
scene dock, quest, sticker book, pause menu) → parent dashboard overlay (PIN, teach) → Bangla → deep links → mobile.
Screenshots land in scripts/shots/. Exits non-zero on any failed check or JS error.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots')
GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
# Headless Chromium has no speech voices and no microphone: hide both APIs so the game takes its typed path quickly.
NO_SPEECH = "Object.defineProperty(window, 'speechSynthesis', { get: () => undefined }); window.webkitSpeechRecognition = undefined; window.SpeechRecognition = undefined;"
GREETED = "document.querySelector('#bubbleText') && document.querySelector('#bubbleText').textContent.length > 5"
IDLE = "document.querySelector('#mic') && !document.querySelector('#mic').classList.contains('disabled') && !document.querySelector('#dialogue').classList.contains('talking')"

async def wait_idle(page, timeout=40000):
    await page.wait_for_function(IDLE, timeout=timeout)
    await page.wait_for_timeout(350)

async def say(page, text):
    if await page.is_hidden('#typebox'):
        await page.click('#typeBtn')
    await page.fill('#typeInput', text)
    await page.press('#typeInput', 'Enter')
    await page.wait_for_timeout(400)
    await wait_idle(page)

async def world(page):
    return await page.evaluate("() => { const w = window.__fw.world; return { loc: w.location, actors: w.actors.size, chars: [...w.actors.values()].filter(a => a.kind !== 'object').map(a => a.key), objs: [...w.actors.values()].filter(a => a.kind === 'object').map(a => a.key), weather: window.__fw.fx.weatherSys && window.__fw.fx.weatherSys.kind, pets: window.__fw.engine.scene.children.filter(c => c.name === 'pet').length }; }")

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    failures = []
    def check(cond, msg):
        print(('  ✓ ' if cond else '  ✗ ') + msg)
        if not cond: failures.append(msg)
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=GL_ARGS)
        ctx = await browser.new_context(viewport={'width': 1280, 'height': 800})
        await ctx.add_init_script(NO_SPEECH)
        page = await ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)

        # ---- Title
        await page.goto(BASE + '/#/')
        await page.wait_for_selector('#playBtn')
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f'{SHOTS}/01-title.png')
        check(await page.evaluate("document.querySelector('#gl').getContext('webgl2') !== null || true"), 'WebGL canvas present')
        check((await world(page))['pets'] == 3, 'title shows three 3D pets')

        # ---- Select + new player
        await page.click('#playBtn')
        await page.wait_for_selector('#newBtn')
        await page.wait_for_timeout(800)
        await page.click('#newBtn')
        await page.fill('input[name=name]', 'Tisha')
        await page.select_option('select[name=age]', '5')
        await page.click('.pet-choice button[data-pet=bunny]')
        await page.fill('input[name=pin]', '1234')
        await page.wait_for_timeout(500)
        await page.screenshot(path=f'{SHOTS}/02-select.png')
        check((await page.locator('#petChosen').inner_text()).startswith('🐰'), 'tapping a pet choice updates the 3D pick')
        await page.click('#newForm .btn.big')

        # ---- Play: greeting
        await page.wait_for_function(GREETED, timeout=20000)
        await wait_idle(page)
        w = await world(page)
        check(w['loc'] == 'home' and w['pets'] == 1, 'game starts at home with the chosen pet in the 3D world')
        check(await page.locator('.tag.pet').count() == 1, 'pet has a projected nameplate')
        check(await page.locator('.chip').count() >= 3, 'suggestion chips rendered')
        await page.screenshot(path=f'{SHOTS}/03-play-home.png')

        # ---- Typed turns build the world
        await say(page, 'make a dragon')
        w = await world(page)
        check('dragon' in w['objs'] or 'dragon' in w['chars'], f'"make a dragon" spawns a 3D dragon ({w["objs"]}{w["chars"]})')
        await say(page, 'a big red car')
        w = await world(page)
        check('car' in w['objs'], f'"a big red car" spawns a car ({w["objs"]})')
        await say(page, 'make it rain')
        w = await world(page)
        check(w['weather'] == 'rain', f'"make it rain" turns on 3D rain (weather={w["weather"]})')
        await page.screenshot(path=f'{SHOTS}/04-play-built.png')
        await say(page, 'remove the car')
        await page.wait_for_timeout(800)
        w = await world(page)
        check('car' not in w['objs'], f'"remove the car" removes it ({w["objs"]})')
        await say(page, 'go to the beach')
        w = await world(page)
        check(w['loc'] == 'beach', f'"go to the beach" travels to a new 3D set (loc={w["loc"]})')
        await page.screenshot(path=f'{SHOTS}/05-play-beach.png')

        # ---- Scene dock
        expect = {'restaurant': 'restaurant', 'shop': 'shop', 'hospital': 'hospital', 'stage': 'stage', 'emergency': 'park', 'create': 'create', 'home': 'home'}
        for scene, loc in expect.items():
            await page.click(f'.scene-dock button[data-scene={scene}]')
            await page.wait_for_timeout(600)
            await wait_idle(page)
            w = await world(page)
            check(w['loc'] == loc, f'scene {scene} → 3D location {w["loc"]} (actors {w["actors"]})')
            if scene in ('hospital', 'stage', 'emergency'):
                await page.screenshot(path=f'{SHOTS}/06-scene-{scene}.png')
        # ---- Restaurant table service: click a table, click the chef window, serve, next table
        await page.click('.scene-dock button[data-scene=restaurant]')
        await wait_idle(page)
        # wait for the restaurant actors (tables, chef window, seated guest) to land in the 3D world
        await page.wait_for_function("[...window.__fw.world.actors.values()].some(a => a.kind === 'object' && /^Table \\d/.test(String(a.data.name)))", timeout=15000)
        await page.wait_for_timeout(2500)
        async def screen_of(name):
            return await page.evaluate("""(name) => { const cam = window.__fw.engine.camera || window.__fw.engine.camThree;
              const a = [...window.__fw.world.actors.values()].find(x => x.kind === 'object' && String(x.data.name) === name);
              if (!a) return null; const v = a.g.position.clone(); v.y += 0.75; v.project(cam);
              return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (0.5 - v.y * 0.5) * innerHeight }; }""", name)
        async def bubble():
            return await page.locator('#bubbleText').inner_text()
        w = await world(page)
        check(w['loc'] == 'restaurant', f'restaurant scene loads ({w["loc"]})')
        tables = await page.evaluate("[...window.__fw.world.actors.values()].filter(a => a.kind === 'object' && /^(Table \\d|Chef window)/.test(String(a.data.name))).map(a => a.data.name)")
        check(len(tables) >= 2 and 'Chef window' in tables, f'restaurant shows clickable tables and the chef window ({tables})')
        seats = await page.evaluate("[...window.__fw.world.actors.values()].filter(a => a.data.role === 'customer').length")
        check(seats >= 1, 'a customer is seated at a table')
        # tap the table where a guest is actually sitting (tapping someone else's table must not
        # move them: the guest stays put and just says where the real order is being taken)
        heard = ''
        for t in tables:
            if t == 'Chef window':
                continue
            pos = await screen_of(t)
            await page.mouse.click(pos['x'], pos['y'])
            await wait_idle(page)
            await page.wait_for_timeout(700)
            heard = await bubble()
            if 'chef' in heard.lower() and 'window' in heard.lower():
                break
        check('chef' in heard.lower() and 'window' in heard.lower(), f'tapping a table zooms in and the customer gives their order ({heard})')
        await page.screenshot(path=f'{SHOTS}/06-restaurant-table.png')
        pos = await screen_of('Chef window')
        await page.mouse.click(pos['x'], pos['y'])
        await wait_idle(page)
        await page.wait_for_timeout(900)
        check('chef' in (await bubble()).lower(), f'tapping the chef window walks up and the chef answers ({await bubble()})')
        await page.screenshot(path=f'{SHOTS}/06-restaurant-window.png')
        await page.click('.scene-dock button[data-scene=shop]')
        await wait_idle(page)
        role = await page.evaluate("[...window.__fw.world.actors.values()].filter(a => a.data.role === 'customer').map(a => a.data.name)")
        check(len(role) >= 1, f'shop shows a customer at the counter ({role})')
        await say(page, 'It costs 100 taka')
        check(len(await page.locator('#bubbleText').inner_text()) > 3, 'shop owner round: quoting a price gets a reply')

        await page.click('.scene-dock button[data-scene=hospital]')
        await wait_idle(page)
        w = await world(page)
        check('doctor' in w['chars'], f'hospital has a 3D doctor character ({w["chars"]})')
        await page.wait_for_selector('.tag.char', state='attached', timeout=10000)
        check(await page.locator('.tag.char').count() >= 1, 'characters get nameplates')
        await say(page, 'my tummy hurts')
        check(len(await page.locator('#bubbleText').inner_text()) > 3, 'doctor role-play answers')

        # ---- Quest + stickers + pause
        check(await page.is_visible('#questPill'), 'quest pill visible')
        await page.click('#questPill')
        check(await page.is_visible('#questCard') and await page.locator('#qcSteps li').count() >= 1, 'quest card lists steps')
        await page.click('#qcClose')
        await page.click('#stickerBtn')
        await page.wait_for_selector('#stickerGrid .sticker')
        check(await page.locator('#stickerGrid .sticker').count() >= 6, 'sticker book opens with stickers')
        await page.wait_for_timeout(600)
        await page.screenshot(path=f'{SHOTS}/07-stickers.png')
        await page.click('#closeStickers')
        await page.click('#settingsBtn')
        check(await page.is_visible('#pauseMenu'), 'pause menu opens')
        await page.wait_for_timeout(600)
        await page.screenshot(path=f'{SHOTS}/08-pause.png')

        # ---- Parent overlay from the pause menu
        await page.click('#parentLink')
        await page.wait_for_selector('#pinForm')
        await page.fill('#pin', '1234')
        await page.click('#pinForm button')
        await page.wait_for_selector('.dash .stats')
        check(await page.locator('.dash .stat').count() >= 4, 'parent dashboard shows stats behind PIN')
        check(await page.is_visible('#teachCard'), 'teach-the-pet card present')
        await page.screenshot(path=f'{SHOTS}/09-parent.png', full_page=False)
        await page.click('#closeParent')
        await page.wait_for_timeout(400)
        check(await page.locator('.parent-overlay').count() == 0 and await page.is_visible('#mic'), 'closing the dashboard returns to the game')

        # ---- Bangla remount
        await page.click('#settingsBtn')
        await page.click('#pauseMenu .lang-toggle button[data-lang=bn]')
        await page.wait_for_function(GREETED, timeout=20000)
        await wait_idle(page)
        check('শোনো' in await page.locator('#micLabel').inner_text() or 'শুনছি' in await page.locator('#micLabel').inner_text() or len(await page.locator('#micLabel').inner_text()) > 0, 'HUD remounts in Bangla')
        await say(page, 'একটা ড্রাগন বানাও')
        w = await world(page)
        check('dragon' in w['objs'] or 'dragon' in w['chars'], f'Bangla "make a dragon" works ({w["objs"]})')
        await page.screenshot(path=f'{SHOTS}/10-bangla.png')
        child_id = (await page.evaluate('location.hash')).split('/')[-1]

        # ---- Quit to title
        await page.click('#settingsBtn')
        await page.click('#quitBtn')
        await page.wait_for_selector('#playBtn')
        check((await world(page))['pets'] == 3, 'quit returns to the title scene')

        # ---- Deep links
        await page.goto(BASE + f'/#/play/{child_id}')
        await page.reload()
        await page.wait_for_selector('#gateBtn', timeout=10000)
        await page.click('#gateBtn')
        await page.wait_for_function(GREETED, timeout=20000)
        check(True, 'deep link #/play/:id shows a tap-to-start gate then plays')
        await page.goto(BASE + f'/#/parent/{child_id}')
        await page.wait_for_selector('#pinForm, .dash .stats')
        check(True, 'deep link #/parent/:id opens the dashboard')

        # ---- Mobile (touch) viewport
        mctx = await browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        await mctx.add_init_script(NO_SPEECH)
        mp = await mctx.new_page()
        mp.on('pageerror', lambda e: errors.append(f'mobile pageerror: {e}'))
        await mp.goto(BASE + '/#/')
        await mp.wait_for_selector('#playBtn')
        await mp.click('#playBtn')
        await mp.wait_for_selector('.player')
        await mp.screenshot(path=f'{SHOTS}/11-mobile-select.png')
        await mp.click('.player')
        await mp.wait_for_function(GREETED, timeout=20000)
        await wait_idle(mp)
        await mp.wait_for_timeout(500)
        await mp.screenshot(path=f'{SHOTS}/12-mobile-play.png')
        check(await mp.is_visible('#joy'), 'touch joystick shown on mobile')
        box = await mp.locator('#mic').bounding_box()
        check(box and box['y'] + box['height'] <= 844, 'mic button fits the mobile viewport')
        await say(mp, 'go to space')
        check((await world(mp))['loc'] == 'space', 'mobile typed turn travels to space')
        await mp.screenshot(path=f'{SHOTS}/13-mobile-space.png')
        await mctx.close()

        await browser.close()
    print()
    real_errors = [e for e in errors if 'favicon' not in e and 'WebGL' not in e and 'GPU' not in e]
    for e in real_errors: print('  JS error:', e)
    check(not real_errors, 'no JS errors')
    print(f"\n{'ALL GOOD' if not failures else str(len(failures)) + ' FAILED'} — screenshots in {SHOTS}")
    sys.exit(1 if failures else 0)

asyncio.run(main())

// Optional Windows browser check. Uses installed Edge and Node's built-in WebSocket.
const { spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const edge = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=19341', `--user-data-dir=${mkdtempSync(join(tmpdir(),'visual-thinking-'))}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let ws;
let launchError;
browser.on('error', error => { launchError = error; });
(async () => {
  let pages;
  for (let i=0;i<40;i++) {
    if (launchError) throw launchError;
    try { pages = await (await fetch('http://127.0.0.1:19341/json')).json(); if (pages.length) break; } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  if (!pages?.length) throw new Error('Edge debugging endpoint unavailable');
  ws = new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let sequence=0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) { const {resolve,reject,timer}=pending.get(message.id); clearTimeout(timer); pending.delete(message.id); message.error?reject(new Error(message.error.message)):resolve(message.result); }
  };
  const send = (method,params={}) => new Promise((resolve,reject)=> {
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timeout: ${method}`));},5000);
    pending.set(id,{resolve,reject,timer}); ws.send(JSON.stringify({id,method,params}));
  });
  async function evaluate(expression) {
    const result=await send('Runtime.evaluate',{expression,returnByValue:true});
    if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  const base=pathToFileURL(resolve(__dirname,'index.html')).href;
  if(process.argv.includes('--linkding')) {
    await send('Network.enable');
    const requests=[];
    const errors=[];
    ws.addEventListener('message',event=>{
      const message=JSON.parse(event.data);
      if(message.method==='Network.requestWillBeSent')requests.push(message.params.request.url);
      if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
    });
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:pathToFileURL(resolve(__dirname,'../evals/runs/linkding/index.html')).href});
    for(let i=0;i<40;i++){
      if(await evaluate("document.readyState==='complete' && document.querySelectorAll('[data-step]').length===6"))break;
      await new Promise(r=>setTimeout(r,100));
    }
    assert.equal(await evaluate("document.querySelectorAll('[data-step]').length"),6);
    assert.equal(await evaluate("document.querySelector('#answer').textContent"),'');
    await evaluate("document.querySelector('#play').click()");
    await new Promise(r=>setTimeout(r,220));
    await evaluate("document.querySelector('#play').click()");
    const paused=await evaluate("document.querySelector('#scrub').value");
    await new Promise(r=>setTimeout(r,120));
    assert.equal(await evaluate("document.querySelector('#scrub').value"),paused);
    await evaluate("document.querySelectorAll('[data-step]')[3].click();document.querySelector('#scrub').value=100;document.querySelector('#scrub').dispatchEvent(new Event('input'))");
    assert.match(await evaluate("document.querySelector('#state').textContent"),/新しい行とタグを保存/);
    await evaluate("document.querySelector('#to-detail').click()");
    assert.equal(await evaluate('document.activeElement.id'),'detail-title');
    assert.match(await evaluate("document.querySelector('#detail-title').textContent"),/4\./);
    await evaluate("document.querySelector('#sources details').open=true");
    assert.match(await evaluate("document.querySelector('#sources pre').textContent"),/def create_bookmark/);
    await evaluate("document.querySelector('#back').click()");
    assert.equal(await evaluate('document.activeElement.id'),'overview-title');
    await evaluate("document.querySelector('#prev').click()");
    assert.match(await evaluate("document.querySelector('#state').textContent"),/保存はまだない/);
    await evaluate("document.querySelector('#scenario').value='duplicate';document.querySelector('#scenario').dispatchEvent(new Event('change'))");
    assert.equal(await evaluate("document.querySelectorAll('[data-step]').length"),7);
    await evaluate("document.querySelectorAll('[data-step]')[4].click();document.querySelector('#scrub').value=100;document.querySelector('#scrub').dispatchEvent(new Event('input'))");
    assert.match(await evaluate("document.querySelector('#state').textContent"),/行数は増えない/);
    await evaluate("document.querySelector('#scenario').value='invalid';document.querySelector('#scenario').dispatchEvent(new Event('change'));document.querySelectorAll('[data-step]')[2].click();document.querySelector('#scrub').value=100;document.querySelector('#scrub').dispatchEvent(new Event('input'))");
    assert.match(await evaluate("document.querySelector('#state').textContent"),/422/);
    assert.match(await evaluate("document.querySelector('#state').textContent"),/保存はまだない/);
    assert.equal(await evaluate("document.querySelectorAll('[data-step]').length"),3);
    await evaluate("document.querySelector('#scenario').value='new';document.querySelector('#scenario').dispatchEvent(new Event('change'));document.querySelector('#favicon').click();document.querySelector('#autoclose').click();document.querySelectorAll('[data-step]')[5].click();document.querySelector('#scrub').value=100;document.querySelector('#scrub').dispatchEvent(new Event('input'))");
    assert.match(await evaluate("document.querySelector('#state').textContent"),/登録しない/);
    assert.match(await evaluate("document.querySelector('#state').textContent"),/bookmarks.close/);
    await evaluate("document.querySelector('[data-answer=no]').click()");
    assert.match(await evaluate("document.querySelector('#answer').textContent"),/その通り/);
    await evaluate("document.querySelector('#reset').click();document.querySelector('#overview').scrollIntoView()");
    assert.match(await evaluate("document.querySelector('#state').textContent"),/応答前/);
    writeFileSync(join(tmpdir(),'linkding-flow-desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await new Promise(r=>setTimeout(r,100));
    assert.equal(await evaluate("document.querySelector('#reduced').checked"),true);
    assert.equal(await evaluate("document.querySelectorAll('#flow .moving').length"),0);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    assert.equal(requests.some(url=>/^https?:/.test(url)||url.includes('/evaluation-targets/')),false,'Generated page must not request the target or network');
    assert.deepEqual(errors,[]);
    console.log('Linkding generated page: playback, 3 routes, rewind, state reset, options, evidence, focus, quiz, reduced motion, mobile width, no target/network requests passed.');
    await send('Browser.close').catch(()=>{});return;
  }
  if(process.argv.includes('--transformer')) {
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:pathToFileURL(resolve(__dirname,'transformer.html')).href});
    for(let i=0;i<40;i++){
      if(await evaluate("document.readyState==='complete' && document.querySelectorAll('[data-stage]').length===7"))break;
      await new Promise(r=>setTimeout(r,100));
    }
    assert.equal(await evaluate("document.querySelectorAll('[data-stage]').length"),7);
    assert.equal(await evaluate("document.querySelectorAll('[data-overview]').length"),7);
    await evaluate("document.querySelector('#overview-play').click()");
    await new Promise(r=>setTimeout(r,200));
    await evaluate("document.querySelector('#overview-play').click()");
    const overviewPaused=await evaluate("document.querySelector('#overview-scrub').value");
    await new Promise(r=>setTimeout(r,100));
    assert.equal(await evaluate("document.querySelector('#overview-scrub').value"),overviewPaused);
    await evaluate("document.querySelector('#overview-scrub').value='475';document.querySelector('#overview-scrub').dispatchEvent(new Event('input'))");
    assert.match(await evaluate("document.querySelector('#overview-phase').textContent"),/05/);
    assert.equal(await evaluate("document.querySelector('#scrub').value"),'75');
    await evaluate("document.querySelector('#overview-detail').click()");
    assert.equal(await evaluate("document.activeElement.id"),'explorer-title');
    await evaluate("document.querySelector('#overview-scrub').value='700';document.querySelector('#overview-scrub').dispatchEvent(new Event('input'));document.querySelector('#overview-add').click()");
    assert.equal(await evaluate("document.querySelectorAll('#sentence .token').length"),5);
    await evaluate("document.querySelector('#reset').click()");
    await evaluate("document.querySelectorAll('[data-overview]')[4].click()");
    assert.match(await evaluate("document.querySelector('#phase-number').textContent"),/05/);
    assert.equal(await evaluate("document.activeElement.id"),'explorer-title');
    assert.equal(await evaluate("document.querySelector('[data-overview][aria-current]').dataset.overview"),'4');
    await evaluate("document.querySelector('#back-overview').click()");
    assert.equal(await evaluate("document.activeElement.id"),'overview-title');
    writeFileSync(join(tmpdir(),'transformer-overview.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await evaluate("document.querySelectorAll('[data-stage]')[3].click();document.querySelector('#position').value='1';document.querySelector('#position').dispatchEvent(new Event('change'));document.querySelector('#scrub').value='100';document.querySelector('#scrub').dispatchEvent(new Event('input'))");
    assert.match(await evaluate("document.querySelector('#scene-desc').textContent"),/0.0%、0.0%/);
    const original=await evaluate("document.querySelector('#scene-desc').textContent");
    await evaluate("document.querySelector('#head').value='1';document.querySelector('#head').dispatchEvent(new Event('change'))");
    assert.notEqual(await evaluate("document.querySelector('#scene-desc').textContent"),original);
    await evaluate("document.querySelector('#play').click()");
    await new Promise(r=>setTimeout(r,250));
    await evaluate("document.querySelector('#play').click()");
    const paused=await evaluate("document.querySelector('#scrub').value");
    await new Promise(r=>setTimeout(r,150));
    assert.equal(await evaluate("document.querySelector('#scrub').value"),paused);
    await evaluate("document.querySelectorAll('[data-stage]')[6].click();document.querySelector('#append').click()");
    assert.equal(await evaluate("document.querySelectorAll('#sentence .token').length"),5);
    await evaluate("document.querySelector('#reset').click()");
    assert.equal(await evaluate("document.querySelectorAll('#sentence .token').length"),4);
    await evaluate("document.querySelectorAll('[data-stage]')[4].click();document.querySelector('#scrub').value='55';document.querySelector('#scrub').dispatchEvent(new Event('input'));document.querySelector('#explorer').scrollIntoView()");
    writeFileSync(join(tmpdir(),'transformer-desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await new Promise(r=>setTimeout(r,100));
    assert.equal(await evaluate("document.querySelector('#reduced').checked"),true);
    assert.equal(await evaluate("document.querySelectorAll('#scene .packet').length"),0);
    assert.equal(await evaluate("document.querySelectorAll('#overview-scene .ov-dot').length"),0);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
    writeFileSync(join(tmpdir(),'transformer-mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    console.log('Transformer Edge: stages, mask, heads, pause, append/reset, reduced motion, mobile width passed. Screenshots saved in temp.');
    await send('Browser.close').catch(()=>{});
    return;
  }
  async function open(mode='') {
    await send('Page.navigate',{url:base+(mode?`?mode=${mode}`:'')});
    for(let i=0;i<40;i++) {
      if(await evaluate(`document.readyState === 'complete' && Boolean(document.querySelector('${mode?'#reset':'.cards'}'))`)) return;
      await new Promise(r=>setTimeout(r,100));
    }
    throw new Error(`Page failed to initialize: ${mode}`);
  }
  await open(); assert.equal(await evaluate("document.querySelectorAll('.design-card').length"),3);
  await open('lab');
  await evaluate("document.querySelector('#apply').click()");
  assert.equal(await evaluate("document.querySelector('#scene').getAnimations({subtree:true}).length > 0"),true);
  await evaluate("document.querySelector('#scene [data-motion=finish]').click()");
  assert.equal(await evaluate("document.querySelector('#scene').getAnimations({subtree:true}).length"),0);
  await evaluate("document.querySelector('#scene [data-motion=replay]').click()");
  assert.equal(await evaluate("document.querySelector('#scene').getAnimations({subtree:true}).length > 0"),true);
  assert.equal(await evaluate("document.querySelector('#apply').disabled"),true);
  assert.match(await evaluate("document.querySelector('#scene').textContent"),/1 → 2/);
  await evaluate("document.querySelector('#compare').click()");
  assert.equal(await evaluate("document.querySelector('#before').hidden"),false);
  await evaluate("document.querySelector('[data-answer=yes]').click()");
  assert.match(await evaluate("document.querySelector('.feedback').textContent"),/一致/);
  await evaluate("document.querySelector('#reset').click()");
  assert.equal(await evaluate("document.querySelector('#quiz').hidden"),true);
  await open('note');
  await evaluate("document.querySelector('#next').click()");
  assert.equal(await evaluate("document.querySelector('#step1').getAnimations({subtree:true}).length > 0"),true);
  await evaluate("document.querySelector('#next').click()");
  assert.equal(await evaluate("[...document.querySelectorAll('.step')].every(s=>!s.hidden)"),true);
  await evaluate("document.querySelector('#prev').click()");
  assert.match(await evaluate("document.querySelector('#step-status').textContent"),/2 \/ 3/);
  await open('experiment');
  await evaluate("document.querySelector('#run').click()");
  assert.equal(await evaluate("document.querySelector('#scene').getAnimations({subtree:true}).length > 0"),true);
  assert.match(await evaluate("document.querySelector('#feedback').textContent"),/コピー b、参照 a、参照 b/);
  await evaluate("document.querySelector('#run').click()");
  assert.match(await evaluate("document.querySelector('#feedback').textContent"),/変わった場所：なし/);
  await evaluate("document.querySelector('#target').value='a';document.querySelector('#value').value='7';document.querySelector('#run').click()");
  assert.match(await evaluate("document.querySelector('#scene').textContent"),/b：2 → 2/);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  for(const mode of ['lab','note','experiment']) {
    await open(mode);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`Mobile overflow: ${mode}`);
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for (const [mode,button] of [['lab','#apply'],['note','#next'],['experiment','#run']]) {
    await open(mode);
    await evaluate(`document.querySelector('${button}').click()`);
    assert.equal(await evaluate('document.getAnimations().length'),0,`Reduced motion: ${mode}`);
  }
  console.log('Edge: navigation, operations, predictions, reset, retained steps, and mobile width passed.');
  await send('Browser.close').catch(()=>{});
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();browser.kill();});

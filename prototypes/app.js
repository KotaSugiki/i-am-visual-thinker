/* Shared teaching model: numbers in a flat list; assignment changes an element, not a name. */
function applyOperation(state, target, value) {
  return { copy: { ...state.copy, [target]: value }, shared: { a: value, b: value } };
}
function initialState() { return { copy: { a: 1, b: 1 }, shared: { a: 1, b: 1 } }; }
function changes(before, after) {
  return ['copy', 'shared'].flatMap(kind => ['a', 'b'].filter(name => before[kind][name] !== after[kind][name]).map(name => `${kind}.${name}`));
}
if (typeof module !== 'undefined') module.exports = { applyOperation, initialState, changes };
if (typeof document !== 'undefined') start();

function start() {
  const app = document.querySelector('#app');
  const mode = new URLSearchParams(location.search).get('mode');
  const names = { lab: '比較ラボ', note: 'ステップノート', experiment: '条件実験室' };
  const initial = initialState();
  const afterB = applyOperation(initial, 'b', 2);
  document.body.className = mode in names ? mode : '';
  document.querySelectorAll('nav a').forEach(a => { if (a.search === `?mode=${mode}`) a.setAttribute('aria-current', 'page'); });
  if (!(mode in names)) {
    app.innerHTML = `<div class="eyebrow">THREE WAYS TO UNDERSTAND</div><h1>違いが見える、その先へ。</h1><p class="lead">同じ「コピーと参照」を、3つの体験で。実際に触って、読みやすさと考えやすさを比べてください。</p><div class="cards">${[
      ['lab','01','比較ラボ','a → □　b → □','並べて、一緒に動かす。','一つの操作が、左右で違う結果を生む。その場所を見つけます。'],
      ['note','02','ステップノート','① → ② → ③','前の状態を、残しながら。','短い説明を一段階ずつ読み、前後の図を見返せます。'],
      ['experiment','03','条件実験室','条件 → 予想 → 結果','変えて、予想して、確かめる。','操作する名前や値を選び、どこが変わるかを試します。']
    ].map(([key,no,title,mini,tag,desc]) => `<a class="design-card" href="?mode=${key}"><span class="eyebrow">DESIGN ${no}</span><div class="mini" aria-hidden="true">${mini}</div><h2>${title}</h2><strong>${tag}</strong><p>${desc}</p><span>試してみる →</span></a>`).join('')}</div>`;
    app.insertAdjacentHTML('beforeend','<section class="panel"><span class="eyebrow">NEW EXPLAINER</span><h2>Transformer：次のひとことが生まれるまで</h2><p>トークンからAttention、次の予測まで。段階と数値を追えるアニメーション教材です。</p><a href="transformer.html">Transformerの動きを見る →</a></section>');
    return;
  }
  document.title = `${names[mode]} — コピーと参照`;
  const intro = `<div class="eyebrow">${{lab:'01 / COMPARE',note:'02 / STEP BY STEP',experiment:'03 / EXPLORE'}[mode]} · ${names[mode]}</div><h1>同じ値。でも、同じ箱？</h1><p class="lead">コピーと参照の共有。<code>b[0]</code> を書き換えたとき、<code>a</code> から見える値も変わるでしょうか。</p><p class="muted">矢印は「名前が指すリスト」。箱番号は説明用で、左右の図は別々の例です。箱の中の値を変えても、矢印の接続は変わりません。</p>`;
  function diagram(kind, values, before) {
    const shared = kind === 'shared';
    const title = shared ? '参照の共有' : 'コピー';
    const changed = name => before && before[name] !== values[name];
    const box = (y,name,id) => `<g data-box="${shared?'shared':name}"><rect class="box ${changed(name)?'changed':''}" x="160" y="${y}" width="132" height="62" rx="9"/><text class="id" x="174" y="${y+19}">${id}</text>${changed(name)?`<text class="value old-value" aria-hidden="true" x="242" y="${y+41}" text-anchor="middle">${before[name]}</text>`:''}<text class="value ${changed(name)?'new-value':''}" x="242" y="${y+41}" text-anchor="middle">${values[name]}</text></g>`;
    return `<article class="concept"><header><h3>${title}</h3><span>${shared?'箱は1つ':'箱は2つ'}</span></header><svg class="diagram" viewBox="0 0 330 190" role="img" aria-label="${title}：aは${values.a}、bは${values.b}。${shared?'同じ箱を参照':'別々の箱を参照'}"><text class="name" x="30" y="64">a</text><text class="name" x="30" y="144">b</text>${shared?'<path class="wire" d="M60 57 H110 V94 H153 M60 137 H110 V94"/><path class="wire" d="M145 88 L153 94 L145 100"/>':'<path class="wire" d="M60 57 H153 M145 51 L153 57 L145 63 M60 137 H153 M145 131 L153 137 L145 143"/>'}${shared?box(63,'a','#1'):box(26,'a','#1')+box(106,'b','#2')}</svg><p class="delta">${before?['a','b'].map(n=>`${n}：${before[n]} → ${values[n]}（${changed(n)?'変更':'同じ'}）`).join(' ／ '):`a：${values.a} ／ b：${values.b}（現在の値）`}</p><details class="source"><summary>図の根拠：${shared?'b = a':'b = a.copy()'}</summary><pre>a = [1]\n${shared?'b = a  # 同じリストを指す':'b = a.copy()  # 別のリストを作る'}</pre><p>教材用Pythonコードの静的読解。${shared?'a と b は同じ箱に付いた二つの名前です。':'値が等しくても、a と b が指す箱は別です。'}</p></details></article>`;
  }
  function pair(state, before, target='b') { return `<div class="visual" data-target="${target}"><div class="pair">${diagram('copy',state.copy,before?.copy)}${diagram('shared',state.shared,before?.shared)}</div>${before?'<div class="motion-controls"><button data-motion="replay">変化をもう一度見る</button><button data-motion="finish">動きを止めて結果を見る</button><span class="muted">箱を強調 → 値を更新（説明用の演出）</span></div>':''}</div>`; }
  function finishMotion(container) {
    container.getAnimations({subtree:true}).forEach(animation => animation.cancel());
  }
  function playMotion(container) {
    finishMotion(container);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const visuals = container.matches('.visual') ? [container] : container.querySelectorAll('.visual');
    visuals.forEach(visual => {
      if (!visual.querySelector('[data-motion]')) return;
      const target = visual.dataset.target;
      // Highlight the written box, never imply that a value travels from b to a.
      visual.querySelectorAll(`[data-box="${target}"] .box, [data-box="shared"] .box`).forEach(box => {
        box.animate([{strokeWidth:1.5},{strokeWidth:5,offset:.25},{strokeWidth:5,offset:.55},{strokeWidth:1.5}],{duration:1200,easing:'ease-in-out'});
      });
      visual.querySelectorAll('.old-value').forEach(value => value.animate([{opacity:1},{opacity:1,offset:.4},{opacity:0,offset:.65},{opacity:0}],{duration:1200}));
      visual.querySelectorAll('.new-value').forEach(value => value.animate([{opacity:0},{opacity:0,offset:.4},{opacity:1,offset:.65},{opacity:1}],{duration:1200}));
    });
  }
  app.onclick = event => {
    const button = event.target.closest('[data-motion]');
    if (!button) return;
    const visual = button.closest('.visual');
    if (button.dataset.motion === 'finish') finishMotion(visual);
    else playMotion(visual);
  };
  const insight = '<p class="insight">違いを生むのは、<strong>同じ箱を指しているか</strong>。参照の共有では、b を通じて書き換えた箱を a も見ています。</p>';
  function source(operation) { return `<details class="source"><summary>この操作の根拠を読む</summary><pre>${operation}</pre><p>上の初期化に続けて行う教材上の操作です。ブラウザ上では数値と参照関係をモデル化しています。Pythonを実行した観測記録ではありません。</p></details>`; }
  function quiz(container) {
    container.innerHTML = `<div class="quiz"><span class="eyebrow">TRY ANOTHER CASE</span><h2>次は a の中身を 7 にしたら？</h2><p><code>b[0] = 2</code> の後に <code>a[0] = 7</code> を行います。<strong>b から見える値</strong>を、コピー／参照の順に選んでください。</p><div class="toolbar"><button data-answer="yes">2 ／ 7</button><button data-answer="no">7 ／ 7</button><button data-answer="no">2 ／ 2</button></div><div class="feedback" aria-live="polite"></div></div>`;
    container.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
      container.querySelectorAll('[data-answer]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      container.querySelector('.feedback').innerHTML = `<p>${button.dataset.answer==='yes'?'予想と一致しました。':'結果は「2 ／ 7」です。'} コピーでは b の箱は別なので 2 のまま。共有では a と b が指す同じ箱が 7 になります。</p>${pair(applyOperation(afterB,'a',7),afterB,'a')}${source('b[0] = 2\na[0] = 7')}`;
      playMotion(container.querySelector('.feedback'));
    }));
  }
  if (mode === 'lab') {
    app.innerHTML = intro + `<section class="panel"><div class="toolbar"><button id="apply" class="primary">b の中身を 2 にする</button><button id="compare" aria-expanded="false">操作前と比較</button><button id="reset">最初に戻す</button></div><p id="status" class="status" aria-live="polite">操作前 · 両方とも値は 1</p><div id="before" class="comparison" hidden><h3>操作前の状態</h3>${pair(initial)}</div><div id="scene">${pair(initial)}</div>${source('b[0] = 2')}<div id="conclusion" hidden>${insight}</div><div id="quiz" hidden></div></section>`;
    const apply = document.querySelector('#apply');
    apply.onclick = () => {
      document.querySelector('#scene').innerHTML = pair(afterB,initial);
      playMotion(document.querySelector('#scene'));
      document.querySelector('#status').textContent = '操作後 · コピーの a は同じ、参照の a は変更';
      document.querySelector('#conclusion').hidden = false;
      document.querySelector('#quiz').hidden = false;
      apply.disabled = true;
    };
    document.querySelector('#compare').onclick = event => {
      const before = document.querySelector('#before'); before.hidden = !before.hidden;
      event.currentTarget.setAttribute('aria-expanded',String(!before.hidden));
    };
    document.querySelector('#reset').onclick = () => start();
    quiz(document.querySelector('#quiz'));
  }
  if (mode === 'note') {
    app.innerHTML = intro + `<section id="step0" class="panel step current" tabindex="-1"><div class="step-heading"><span>1</span><h2>同じ値を用意する</h2></div><p>どちらも値は 1。まずは、名前と箱のつながりを見てください。</p>${pair(initial)}</section><section id="step1" class="panel step" tabindex="-1" hidden><div class="step-heading"><span>2</span><h2>b が指す箱を書き換える</h2></div><p>左右に同じ <code>b[0] = 2</code> を加えます。ひとつ前の図も、そのまま残ります。</p>${pair(afterB,initial)}${insight}${source('b[0] = 2')}</section><section id="step2" class="panel step" tabindex="-1" hidden><div class="step-heading"><span>3</span><h2>別の操作を予想する</h2></div><div id="quiz"></div></section><div class="navigation"><button id="prev" disabled>← 前へ</button><span id="step-status" aria-live="polite">1 / 3 · 同じ値を用意する</span><button id="next" class="primary">次へ →</button><button id="reset">最初に戻す</button></div>`;
    let step = 0;
    function move(amount) {
      document.querySelector(`#step${step}`).classList.remove('current'); step += amount;
      const section = document.querySelector(`#step${step}`); section.hidden = false; section.classList.add('current'); section.focus();
      finishMotion(app);
      playMotion(section);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) section.animate([{opacity:.4,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
      document.querySelector('#prev').disabled = step===0; document.querySelector('#next').disabled = step===2;
      document.querySelector('#step-status').textContent = `${step+1} / 3 · ${['同じ値を用意する','b を書き換える','別の操作を予想する'][step]}`;
    }
    document.querySelector('#prev').onclick = () => move(-1);
    document.querySelector('#next').onclick = () => move(1);
    document.querySelector('#reset').onclick = () => start();
    quiz(document.querySelector('#quiz'));
  }
  if (mode === 'experiment') {
    let state = initialState();
    app.innerHTML = intro + `<div class="workbench"><aside class="controls"><span class="eyebrow">CONDITIONS</span><h2>ひとつ変えてみる</h2><label for="target">変更する名前</label><select id="target"><option value="b">b が指す箱</option><option value="a">a が指す箱</option></select><p class="muted">新しい値：<span id="value-label">2</span></p><details><summary>値も変えて試す</summary><label for="value">新しい値（−99〜99の整数）</label><input id="value" type="number" min="-99" max="99" step="1" value="2"></details><div class="toolbar"><button id="reset">最初に戻す</button></div><p class="muted">実行するたび、現在の状態に操作を加えます。同じ値を入れる場合も試せます。</p></aside><section class="results"><div id="scene">${pair(state)}</div><section class="panel"><h2>どこから見える値が変わる？</h2><p class="muted">予想する場所をすべて選びます。何も変わらない予想なら、選ばずに実行できます。</p><div class="checks">${[['copy.a','コピー a'],['copy.b','コピー b'],['shared.a','参照 a'],['shared.b','参照 b']].map(([id,label])=>`<label><input type="checkbox" value="${id}"> ${label}</label>`).join('')}</div><button id="run" class="primary">予想して試す</button><div id="feedback" class="feedback" aria-live="polite"></div></section><div id="history" hidden></div><div id="operation-source">${source('b[0] = 2')}</div></section></div>`;
    const input = document.querySelector('#value');
    const target = document.querySelector('#target');
    function updateSource() {
      if (!input.checkValidity() || input.value==='') return;
      document.querySelector('#value-label').textContent = input.value;
      document.querySelector('#operation-source').innerHTML = source(`${target.value}[0] = ${Number(input.value)}`);
    }
    input.required = true; input.oninput = updateSource; target.onchange = updateSource;
    document.querySelector('#run').onclick = () => {
      if (!input.reportValidity()) return;
      const before = state; state = applyOperation(state,target.value,Number(input.value));
      const actual = changes(before,state);
      const predicted = [...document.querySelectorAll('.checks input:checked')].map(i=>i.value);
      const correct = actual.length===predicted.length && actual.every(id=>predicted.includes(id));
      document.querySelector('#scene').innerHTML = pair(state,before,target.value);
      playMotion(document.querySelector('#scene'));
      const labels = {'copy.a':'コピー a','copy.b':'コピー b','shared.a':'参照 a','shared.b':'参照 b'};
      document.querySelector('#feedback').textContent = `${correct?'予想と一致しました。':'予想と違う場所を、上の図で見比べてください。'} 今回変わった場所：${actual.map(id=>labels[id]).join('、') || 'なし'}。コピーでは操作した名前の箱だけ、共有では両方が指す箱を書き換えます。同じ数値を書き込んだ場所は、見える値が変わりません。`;
      const history = document.querySelector('#history'); history.hidden = false;
      history.innerHTML = `<details class="comparison"><summary>直前の状態と比較する</summary>${pair(before)}</details>`;
      document.querySelectorAll('.checks input').forEach(i=>{i.checked=false;});
    };
    document.querySelector('#reset').onclick = () => start();
  }
}

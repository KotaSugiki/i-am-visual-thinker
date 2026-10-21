/* A deterministic, untrained decoder block. All displayed numerical results use this model. */
const VOCAB = ['猫','は','窓辺','で','眠る','。','犬'];
const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
const add = (a,b) => a.map((v,i)=>v+b[i]);
const matrix = (rows,cols,seed) => Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>Math.sin((i+1)*7+(j+1)*3+seed)*.65));
const project = (x,w) => w[0].map((_,j)=>x.reduce((s,v,i)=>s+v*w[i][j],0));
function softmax(values) {
  const max=Math.max(...values), exps=values.map(v=>Math.exp(v-max)), total=exps.reduce((a,b)=>a+b,0);
  return exps.map(v=>v/total);
}
function norm(x) {
  const mean=x.reduce((a,b)=>a+b,0)/x.length;
  const variance=x.reduce((s,v)=>s+(v-mean)**2,0)/x.length;
  return x.map(v=>(v-mean)/Math.sqrt(variance+1e-5));
}
function forward(tokens) {
  const x=tokens.map((token,pos)=>Array.from({length:4},(_,j)=>Math.sin((VOCAB.indexOf(token)+1)*(j+1)*.8)+(j%2===0?Math.sin(pos/10000**(2*Math.floor(j/2)/4)):Math.cos(pos/10000**(2*Math.floor(j/2)/4)))));
  const heads=[0,1].map(head=>{
    const q=x.map(v=>project(v,matrix(4,2,head*9+1)));
    const k=x.map(v=>project(v,matrix(4,2,head*9+3)));
    const v=x.map(v=>project(v,matrix(4,2,head*9+6)));
    const scores=q.map((query,i)=>k.map((key,j)=>j>i?-Infinity:dot(query,key)/Math.sqrt(2)));
    const weights=scores.map(softmax);
    const outputs=weights.map(row=>[0,1].map(d=>row.reduce((s,w,j)=>s+w*v[j][d],0)));
    return {q,k,v,scores,weights,outputs};
  });
  const attention=x.map((_,i)=>project([...heads[0].outputs[i],...heads[1].outputs[i]],matrix(4,4,12)));
  const residual=x.map((v,i)=>norm(add(v,attention[i])));
  const ffn=residual.map(v=>project(project(v,matrix(4,8,20)).map(n=>Math.max(0,n)),matrix(8,4,27)));
  const output=residual.map((v,i)=>norm(add(v,ffn[i])));
  const logits=project(output.at(-1),matrix(4,VOCAB.length,32)).map((v,i)=>v+(i===4?1.6:0));
  const probabilities=softmax(logits);
  return {x,heads,attention,residual,ffn,output,logits,probabilities};
}
if(typeof module!=='undefined') module.exports={forward,softmax,VOCAB};
if(typeof document!=='undefined') initTransformer();

function initTransformer() {
  const $=selector=>document.querySelector(selector);
  const stages=[
    ['分ける','TOKENIZE','文章を、扱える単位に。','入力をトークンの列として扱います。ここでは「猫 / は / 窓辺 / で」という4つの区切りを固定しています。実際のトークンは、単語より短いこともあります。','各トークンの位置は、この先も変わりません。変わるのは、各位置が持つ数値です。'],
    ['数値にする','EMBED + POSITION','言葉と位置を、数値にする。','トークンごとの埋め込みベクトルに、並び順を示す位置情報を加えます。この教材では4成分。数値の色や大きさが違っても、それぞれに固定の「意味」があるわけではありません。','同じ言葉でも位置情報が異なります。緑の4本の棒は、4つの数値成分を表します。'],
    ['照合する','QUERY × KEY','いまの位置は、どこを見る？','同じ入力表現から、別々の学習パラメータでQuery・Key・Valueを作ります。選んだ位置のQueryと、各位置のKeyの内積を計算します。右側の位置には因果マスクをかけます。','位置を「は」にすると、右の「窓辺」「で」は対象外。ヘッドを変えると、使う変換も変わります。'],
    ['重みにする','MASK + SOFTMAX','スコアを、混ぜる割合に。','内積をKeyの次元数の平方根で割り、softmaxで合計1の重みにします。未来のスコアは −∞ にするので、その重みは0です。重みはこのQueryとKeyから計算した値です。','高い棒ほど、その位置のValueを大きな割合で使います。重みが高いことを、判断理由そのものとは扱いません。'],
    ['混ぜる','WEIGHTED SUM','情報を、重みに応じて集める。','各位置のValueに重みを掛けて足します。選んだヘッドの2成分の出力を表示しています。実際には2ヘッドをそれぞれ計算し、結合して出力射影します。','点はValueの寄与を表す説明用の動きです。トークン自体は移動しません。ほかの位置でも同じ計算を行います。'],
    ['更新する','RESIDUAL + FFN','集めた情報で、表現を更新。','Attentionの出力を元の表現へ足し、正規化します。続くFFNは各位置に同じ変換を適用します。さらに残差加算と正規化を行い、次の層へ渡す表現になります。','位置同士が情報を混ぜるのはAttention。FFNは位置ごとに独立して働きます。この教材は1層だけです。'],
    ['予測する','NEXT TOKEN','最後の位置から、続きを選ぶ。','右端の表現を語彙ごとのスコアへ変換し、softmaxで候補の確率を出します。ここでは最大確率のトークンを選びます。実用では確率に従ってサンプリングする方法も使われます。','選んだトークンを入力に追加すると、次の予測を始められます。表示値は未学習の教材モデルの計算結果です。']
  ];
  let tokens=['猫','は','窓辺','で'], position=3, head=0, stage=0, progress=0, playing=false, lastTime=0, frame=0;
  let model=forward(tokens);
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  $('#reduced').checked=motion.matches;
  $('#overview-reduced').checked=motion.matches;
  motion.addEventListener('change',event=>{$('#reduced').checked=event.matches;$('#overview-reduced').checked=event.matches;stop();draw();});
  const fmt=v=>Number.isFinite(v)?v.toFixed(2):'−∞';
  const percent=v=>(v*100).toFixed(1)+'%';
  const vector=v=>'['+v.map(fmt).join(', ')+']';
  const xpos=i=>95+i*(610/Math.max(tokens.length-1,1));
  const rect=(x,y,w,h,text,cls='frame')=>`<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/><text class="label" x="${x+w/2}" y="${y+h/2+5}" text-anchor="middle">${text}</text>`;
  const line=(x,y,xx,yy,cls='route')=>`<path class="${cls}" d="M${x} ${y} L${xx} ${yy}"/>`;
  function bars(values,x,y,width=60) {
    return values.map((v,j)=>`<rect x="${x+j*(width/values.length)}" y="${y+23-Math.min(20,Math.abs(v)*9)}" width="${width/values.length-3}" height="${Math.max(2,Math.min(20,Math.abs(v)*9))}" rx="2" fill="${v>=0?'#54804e':'#b96835'}"/><text class="tiny" x="${x+j*(width/values.length)+5}" y="${y+40}" text-anchor="middle">${v.toFixed(1)}</text>`).join('');
  }
  function packet(x,y,xx,yy,t,r=5) { return `<circle class="packet" cx="${x+(xx-x)*t}" cy="${y+(yy-y)*t}" r="${r}"/>`; }
  function drawOverview() {
    const reduced=$('#reduced').checked, t=reduced?1:progress;
    const cx=i=>83+i*157;
    const active=model.heads[head], weights=active.weights[position];
    const winner=model.probabilities.indexOf(Math.max(...model.probabilities));
    const label=(x,y,text,cls='ov-small')=>`<text class="${cls}" x="${x}" y="${y}" text-anchor="middle">${text}</text>`;
    let svg=`<title id="overview-svg-title">Transformerの7段階：${stages[stage][0]}</title><desc id="overview-svg-desc">${tokens.join('、')}の入力から次の候補まで。現在は${stage+1}、${stages[stage][2]}。選択する候補は${VOCAB[winner]}。生成トークンを入力列に追加すると次の予測へ進みます。</desc>`;
    svg+=`<path class="ov-wire" d="M12 47 H304 M326 47 H774 M797 47 H932 M955 47 H1096"/>`;
    svg+=label(158,32,'入力を準備')+label(550,32,'Attention：参照先から情報を集める')+label(865,32,'位置ごとに更新')+label(1025,32,'次を選ぶ');
    for(let i=0;i<7;i++) {
      const x=cx(i), local=i===stage?Math.min(1,t/.65):1;
      svg+=`<g opacity="${i<=stage?1:.48}"><rect x="${x-71}" y="68" width="142" height="172" rx="10" fill="${i===stage?'#eaf2e2':'#fffefb'}" stroke="${i===stage?'#54804e':'#bdcdb5'}" stroke-width="${i===stage?2:1}"/>`;
      svg+=label(x,91,`0${i+1}　${stages[i][0]}`,'ov-title');
      if(i===0){
        tokens.forEach((token,j)=>{const xx=x-42+(j%3)*42,yy=117+Math.floor(j/3)*37;svg+=`<g opacity="${i===stage?.25+.75*Math.min(1,local*tokens.length-j+1):1}"><rect x="${xx-18}" y="${yy}" width="36" height="29" rx="4" fill="#f0f5e9" stroke="#bdcdb5"/>${label(xx,yy+20,token)}</g>`;});
        svg+=label(x,216,`${tokens.length} 個のトークン`);
      } else if(i===1){
        model.x[position].forEach((v,j)=>{const h=(10+Math.abs(v)*12)*(.2+.8*local);svg+=`<rect x="${x-46+j*25}" y="${184-h}" width="17" height="${h}" rx="3" fill="${v>=0?'#54804e':'#b96835'}"/>`;});
        svg+=label(x,210,`「${tokens[position]}」の4成分`)+label(x,228,'埋め込み ＋ 位置');
      } else if(i===2){
        svg+=label(x-37,134,`Q${position+1}`,'ov-title');
        tokens.forEach((_,j)=>{const yy=112+j*70/Math.max(1,tokens.length-1);svg+=`<path class="ov-wire" d="M${x-17} 133 L${x+21} ${yy}"/>`+label(x+39,yy+5,`K${j+1}`);if(i===stage&&t<.65&&!reduced)svg+=`<circle class="ov-dot" cx="${x-17+38*local}" cy="${133+(yy-133)*local}" r="3"/>`;});
        svg+=label(x,211,'Q × K → スコア')+label(x,228,`位置 ${position+1} / ヘッド ${head+1}`);
      } else if(i===3){
        weights.forEach((w,j)=>{const bw=105/weights.length,h=w*85*(.15+.85*local);svg+=`<rect x="${x-52+j*bw}" y="${186-h}" width="${bw-5}" height="${Math.max(1,h)}" rx="2" fill="#54804e"/>`;});
        svg+=label(x,211,'合計 100%')+label(x,228,'未来の重みは 0');
      } else if(i===4){
        weights.forEach((w,j)=>{const xx=x-50+j*100/Math.max(1,weights.length-1);svg+=`<path class="ov-wire" d="M${xx} 119 L${x} 176"/>`;if(w>0&&i===stage&&t<.65&&!reduced)svg+=`<circle class="ov-dot" cx="${xx+(x-xx)*local}" cy="${119+57*local}" r="${2+w*5}"/>`;});
        svg+=`<rect x="${x-37}" y="177" width="74" height="22" rx="4" fill="#f6e8da" stroke="#c48b61"/>`+label(x,193,'加重和')+label(x,217,'各ヘッド → 結合')+label(x,232,'→ 出力射影');
      } else if(i===5){
        ['＋ 元の表現','正規化 → FFN','＋ 残差 → 正規化'].forEach((text,j)=>{svg+=`<rect x="${x-58}" y="${109+j*35}" width="116" height="27" rx="4" fill="${i===stage&&Math.min(2,Math.floor(local*3))===j?'#d4e4c8':'#f0f4eb'}"/>`+label(x,127+j*35,text);});
        svg+=label(x,228,'文脈を含む表現');
      } else {
        const ranked=model.probabilities.map((p,j)=>({p,j})).sort((a,b)=>b.p-a.p);
        ranked.slice(0,3).forEach(({p,j},n)=>{const yy=118+n*27;svg+=label(x-44,yy+12,VOCAB[j])+`<rect x="${x-20}" y="${yy}" width="${Math.max(1,p*95*(.1+.9*local))}" height="14" rx="2" fill="${n===0?'#54804e':'#bdcdb5'}"/>`;});
        svg+=label(x,212,`最大候補「${VOCAB[winner]}」`)+label(x,230,'上位3候補を表示');
      }
      svg+='</g>';
      if(i<6){svg+=`<path class="ov-wire" d="M${x+72} 154 H${x+85} l-5 -4 m5 4 l-5 4"/>`;if(i===stage&&t>.65&&!reduced)svg+=`<circle class="ov-dot" cx="${x+72+13*(t-.65)/.35}" cy="154" r="4"/>`;}
    }
    svg+=`<path class="ov-wire" d="M${cx(6)} 246 V300 H${cx(1)} V246 l-5 7 m5 -7 l5 7"/>`;
    svg+=label(635,282,'選んだトークンを入力列に追加 → ②から次の予測へ');
    svg+=label(560,354,'③〜⑥を1層として表示。多層モデルは層を重ねてから⑦へ。');
    if(stage===6){
      const travel=reduced?1:Math.max(0,(t-.65)/.35), length=54+(cx(6)-cx(1))+54, distance=travel*length;
      let x=cx(6),y=246;
      if(distance<54)y+=distance;else if(distance<length-54){y=300;x-=distance-54;}else{x=cx(1);y=300-(distance-(length-54));}
      svg+=`<g><rect x="${x-26}" y="${y-15}" width="52" height="30" rx="5" fill="#f6e8da" stroke="#b96835"/>${label(x,y+5,VOCAB[winner],'ov-title')}</g>`;
    }
    $('#overview-scene').innerHTML=svg;
    $('#overview-scrub').value=Math.round((stage+progress)*100);
  }
  function draw() {
    const t=$('#reduced').checked?1:progress;
    const selected=model.heads[head], weights=selected.weights[position];
    let svg=`<title id="scene-title">${stages[stage][2]}</title><desc id="scene-desc">${stage>=2&&stage<=4?`${tokens[position]}、位置${position+1}、ヘッド${head+1}の重み：${weights.map(percent).join('、')}。未来の位置の重みは0です。`:stages[stage][4]}</desc>`;
    svg+=tokens.map((token,i)=>`<g opacity="${stage===0?.3+.7*Math.min(1,Math.max(0,t*tokens.length-i+1)):1}">${rect(xpos(i)-35,24,70,48,token,i===(stage===6?tokens.length-1:position)?'selected':'frame')}<text class="tiny" x="${xpos(i)}" y="94" text-anchor="middle">位置 ${i+1}</text></g>`).join('');
    if(stage===0){
      svg+=`<text class="large" x="400" y="230" text-anchor="middle">猫 は 窓辺 で …</text><text class="tiny" x="400" y="270" text-anchor="middle">入力は固定した4トークン。次のトークンはまだありません。</text>`;
      tokens.forEach((_,i)=>{svg+=line(400,195,xpos(i),112);if(t<1)svg+=packet(400,195,xpos(i),112,t);});
    } else if(stage===1){
      tokens.forEach((_,i)=>{
        svg+=line(xpos(i),107,xpos(i),191)+rect(xpos(i)-39,200,78,72,'','frame');
        svg+=bars(model.x[i],xpos(i)-28,218,60);
        svg+=`<text class="tiny" x="${xpos(i)}" y="155" text-anchor="middle">埋め込み</text><text class="tiny" x="${xpos(i)}" y="177" text-anchor="middle">＋ 位置</text>`;
        if(t<1)svg+=packet(xpos(i),108,xpos(i),199,t);
      });
      svg+=`<text class="label" x="400" y="350" text-anchor="middle">X = トークン埋め込み + 位置情報</text><text class="tiny" x="400" y="380" text-anchor="middle">緑：正の成分 ／ 茶：負の成分。バーの高さは絶対値（表示上限あり）。</text>`;
    } else if(stage===2){
      tokens.forEach((_,i)=>{
        svg+=line(xpos(i),106,xpos(i),139)+rect(xpos(i)-41,143,82,55,`K${i+1}`,i>position?'frame':'selected');
        svg+=line(xpos(position),329,xpos(i),204,i>position?'route masked':'route');
        svg+=`<text class="tiny" x="${xpos(i)}" y="229" text-anchor="middle">${i>position?'未来：除外':fmt(selected.scores[position][i])}</text>`;
        if(i<=position&&t<1)svg+=packet(xpos(position),329,xpos(i),204,t,4);
      });
      svg+=rect(xpos(position)-45,337,90,53,`Q${position+1}`,'warm');
      svg+=`<text class="tiny" x="400" y="433" text-anchor="middle">Q = XWq　 K = XWk　 V = XWv　 ／　表示スコア = Q・K ÷ √2</text>`;
    } else if(stage===3){
      tokens.forEach((_,i)=>{
        const height=weights[i]*190*(.1+.9*t);
        svg+=line(xpos(i),106,xpos(i),141);
        svg+=`<rect x="${xpos(i)-24}" y="${340-height}" width="48" height="${Math.max(1,height)}" rx="4" fill="${i>position?'#dce3d7':'#54804e'}"/><text class="label" x="${xpos(i)}" y="${320-height}" text-anchor="middle">${percent(weights[i])}</text><text class="tiny" x="${xpos(i)}" y="366" text-anchor="middle">${i>position?'マスク':'参照可能'}</text>`;
      });
      svg+=`<text class="label" x="400" y="425" text-anchor="middle">softmax(スコア + 因果マスク)　→　合計 100%</text>`;
    } else if(stage===4){
      tokens.forEach((_,i)=>{
        svg+=line(xpos(i),106,xpos(i),132)+rect(xpos(i)-38,137,76,68,'',i>position?'frame':'selected')+bars(selected.v[i],xpos(i)-23,148,56);
        svg+=`<text class="tiny" x="${xpos(i)}" y="125" text-anchor="middle">V${i+1}</text>`;
        svg+=line(xpos(i),207,400,340,i>position?'route masked':'route');
        svg+=`<text class="tiny" x="${xpos(i)}" y="233" text-anchor="middle">× ${percent(weights[i])}</text>`;
        if(i<=position&&t<1)svg+=packet(xpos(i),207,400,340,t,3+weights[i]*9);
      });
      svg+=rect(266,350,268,58,vector(selected.outputs[position]),'warm');
      svg+=`<text class="tiny" x="400" y="439" text-anchor="middle">ヘッド ${head+1} の出力 = Σ（重み × Value）</text>`;
    } else if(stage===5){
      const labels=['2ヘッドを結合 → 出力射影','元の X を足す → LayerNorm','FFN：4 → 8 → 4 成分','残差を足す → LayerNorm'];
      svg+=line(xpos(position),106,400,133);
      labels.forEach((label,i)=>{
        svg+=rect(228,140+i*65,344,46,label,Math.floor(t*4)===i?'selected':'frame');
        if(i<3){svg+=line(400,187+i*65,400,204+i*65);}
      });
      if(t<1)svg+=packet(598,140,598,381,t);
      svg+=`<text class="tiny" x="400" y="429" text-anchor="middle">図は選択位置の処理。実際の教材計算はすべての位置に同じ処理を適用。</text>`;
    } else {
      svg+=line(xpos(tokens.length-1),106,400,147)+rect(243,152,314,46,'最後の位置 → 語彙スコア → softmax','selected');
      const ranked=model.probabilities.map((p,i)=>({p,token:VOCAB[i]})).sort((a,b)=>b.p-a.p);
      ranked.forEach(({p,token},i)=>{
        const y=225+i*27;
        svg+=`<text class="tiny" x="190" y="${y+13}" text-anchor="end">${token}</text><rect x="208" y="${y}" width="${Math.max(1,p*460*(.1+.9*t))}" height="17" rx="3" fill="${i===0?'#54804e':'#bdcdb5'}"/><text class="tiny" x="${220+p*460}" y="${y+13}">${percent(p)}</text>`;
      });
      svg+=`<text class="tiny" x="400" y="451" text-anchor="middle">全7候補を表示。最大の候補「${ranked[0].token}」を次の入力に追加できます。</text>`;
    }
    $('#scene').innerHTML=svg;
    $('#scrub').value=Math.round(progress*100);
    drawOverview();
  }
  function refresh() {
    $('#overview-phase').textContent=`0${stage+1} / ${stages[stage][0]}`;
    $('#overview-caption').textContent=stages[stage][2];
    $('#overview-steps').innerHTML=stages.map((s,i)=>`<button data-overview-step="${i}" ${i===stage?'aria-current="step"':''}>${i+1} ${s[0]}</button>`).join('');
    $('#overview-prev').disabled=stage===0;$('#overview-next').disabled=stage===6;
    $('#overview-add').disabled=stage!==6||tokens.length>=6;
    $('#overview-add').textContent=tokens.length>=6?'教材は6トークンまで':'候補を入力に追加 →';
    $('#overview-play').textContent=playing?'Ⅱ 一時停止':'▶ 全体を再生';
    document.querySelectorAll('[data-overview]').forEach(link=>{
      if(Number(link.dataset.overview)===stage)link.setAttribute('aria-current','step');
      else link.removeAttribute('aria-current');
    });
    $('#sentence').innerHTML=tokens.map((token,i)=>`<span class="token ${i>=4?'generated':''}">${token}</span>`).join('');
    $('#position').innerHTML=tokens.map((token,i)=>`<option value="${i}" ${i===position?'selected':''}>${i+1}：${token}</option>`).join('');
    $('#stages').innerHTML=stages.map((s,i)=>`<button data-stage="${i}" class="${i<stage?'done':''}" ${i===stage?'aria-current="step"':''}><span>0${i+1}</span>${s[0]}</button>`).join('');
    $('#phase-number').textContent=`STEP 0${stage+1} / 07`;
    $('#view-label').textContent=`0${stage+1} / ${stages[stage][1]}`;
    $('#phase-title').textContent=stages[stage][2];$('#phase-body').textContent=stages[stage][3];$('#phase-observe').textContent=stages[stage][4];
    $('#attention-tools').style.visibility=stage>=2&&stage<=5?'visible':'hidden';
    const selected=model.heads[head];
    const rows=stage===0?['入力数：'+tokens.length]:stage===1?['選択位置の X',vector(model.x[position])]:stage===2?['Q = '+vector(selected.q[position]),'K = '+vector(selected.k[position])]:stage===3?['重みの合計 = '+selected.weights[position].reduce((a,b)=>a+b,0).toFixed(6)]:stage===4?['ヘッド1：'+vector(model.heads[0].outputs[position]),'ヘッド2：'+vector(model.heads[1].outputs[position])]:stage===5?['入力 X：'+vector(model.x[position]),'更新後：'+vector(model.output[position])]:['予測元：最後の位置 '+tokens.length,'選択方法：最大確率（greedy）'];
    $('#numbers').innerHTML=rows.map(row=>`<p>${row}</p>`).join('')+(stage===6?`<button id="append" ${tokens.length>=6?'disabled':''}>${tokens.length>=6?'教材は6トークンまで':'選んだトークンを追加 →'}</button>`:'');
    $('#prev').disabled=stage===0;$('#next').disabled=stage===6;
    $('#play').textContent=playing?'Ⅱ 一時停止':'▶ 再生';
    draw();
  }
  function stop() {playing=false;cancelAnimationFrame(frame);$('#play').textContent='▶ 再生';$('#overview-play').textContent='▶ 全体を再生';}
  function go(value) {stop();stage=value;progress=$('#reduced').checked?1:0;refresh();$('#status').textContent=`段階 ${stage+1}：${stages[stage][2]}`;}
  function tick(time) {
    if(!playing)return;
    progress=Math.min(1,progress+(time-lastTime)/4600*Number($('#speed').value));lastTime=time;
    if(progress>=1){if(stage===6){draw();stop();$('#status').textContent='予測まで到着。トークンを追加して、次の一巡を試せます。';return;}stage++;progress=0;refresh();$('#status').textContent=`段階 ${stage+1}：${stages[stage][2]}`;}
    draw();frame=requestAnimationFrame(tick);
  }
  $('#play').onclick=()=>{
    if(playing){stop();return;}
    if(stage===6&&progress>=1){stage=0;progress=0;}
    playing=true;lastTime=performance.now();refresh();frame=requestAnimationFrame(tick);
  };
  $('#overview-play').onclick=()=>$('#play').click();
  $('#overview-prev').onclick=()=>go(Math.max(0,stage-1));
  $('#overview-next').onclick=()=>go(Math.min(6,stage+1));
  $('#overview-replay').onclick=()=>go(0);
  $('#overview-add').onclick=()=>$('#append')?.click();
  $('#overview-steps').onclick=event=>{const button=event.target.closest('[data-overview-step]');if(button)go(Number(button.dataset.overviewStep));};
  $('#overview-scrub').oninput=()=>{stop();const value=Number($('#overview-scrub').value)/100;stage=Math.min(6,Math.floor(value));progress=value-stage;refresh();};
  $('#overview-detail').onclick=event=>{event.preventDefault();stop();$('#explorer').scrollIntoView();$('#explorer-title').focus({preventScroll:true});};
  $('#overview-reduced').onchange=()=>{$('#reduced').checked=$('#overview-reduced').checked;stop();draw();};
  $('#prev').onclick=()=>go(Math.max(0,stage-1));$('#next').onclick=()=>go(Math.min(6,stage+1));
  $('#stages').onclick=event=>{const button=event.target.closest('[data-stage]');if(button)go(Number(button.dataset.stage));};
  document.querySelectorAll('[data-overview]').forEach(link=>link.onclick=event=>{
    event.preventDefault();go(Number(link.dataset.overview));
    $('#explorer').scrollIntoView();$('#explorer-title').focus({preventScroll:true});
  });
  $('#back-overview').onclick=event=>{
    event.preventDefault();stop();$('#overview').scrollIntoView();$('#overview-title').focus({preventScroll:true});
  };
  $('#scrub').oninput=()=>{stop();progress=Number($('#scrub').value)/100;draw();};
  $('#reduced').onchange=()=>{$('#overview-reduced').checked=$('#reduced').checked;stop();draw();};
  $('#position').onchange=()=>{position=Number($('#position').value);stop();progress=0;refresh();};
  $('#head').onchange=()=>{head=Number($('#head').value);stop();progress=0;refresh();};
  $('#reset').onclick=()=>{tokens=['猫','は','窓辺','で'];position=3;head=0;$('#head').value='0';model=forward(tokens);go(0);};
  $('#numbers').onclick=event=>{
    if(event.target.id!=='append'||tokens.length>=6)return;
    const index=model.probabilities.indexOf(Math.max(...model.probabilities));
    tokens.push(VOCAB[index]);position=tokens.length-1;model=forward(tokens);go(0);
    $('#status').textContent=`「${VOCAB[index]}」を追加しました。この入力で次の予測を始められます。`;
  };
  document.querySelectorAll('[data-answer]').forEach(button=>button.onclick=()=>{
    $('#answer').textContent=button.dataset.answer==='no'?'その通り。因果マスクで、右側の位置の重みは0になります。':'このデコーダ型では参照できません。因果マスクで、右側の位置の重みを0にします。';
    position=1;go(3);progress=1;draw();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  refresh();
}

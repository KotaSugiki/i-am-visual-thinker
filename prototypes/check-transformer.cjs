const assert=require('node:assert/strict');
const {forward,softmax,VOCAB}=require('./transformer.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
near(softmax([1,1])[0],.5);
assert.deepEqual(softmax([0,-Infinity]),[1,0]);
const tokens=['猫','は','窓辺','で'];
const result=forward(tokens);
for(const head of result.heads){
  head.weights.forEach((row,i)=>{
    near(row.reduce((a,b)=>a+b),1);
    row.forEach((v,j)=>{if(j>i)assert.equal(v,0);});
    for(let d=0;d<2;d++)near(head.outputs[i][d],row.reduce((sum,w,j)=>sum+w*head.v[j][d],0));
  });
}
// Causality must hold across the entire block, not only the displayed weights.
const modified=forward(['猫','は','犬','眠る']);
assert.deepEqual(result.output.slice(0,2),modified.output.slice(0,2));
assert.notDeepEqual(result.heads[0].weights[3],result.heads[1].weights[3]);
near(result.probabilities.reduce((a,b)=>a+b),1);
assert.equal(result.probabilities.length,VOCAB.length);
assert.ok(result.output.flat().every(Number.isFinite));
const generated=VOCAB[result.probabilities.indexOf(Math.max(...result.probabilities))];
assert.equal(forward([...tokens,generated]).output.length,5);
console.log('Transformer: softmax, masking, weighted sums, causality, heads, and generation passed.');

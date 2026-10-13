import {beforeEach,afterEach,expect,it} from 'vitest';
import {HttpActionExecutor} from '@qaick/http-executor';
import {NodeHttpTransport} from '@qaick/http-executor/node';
import type {ExecutionPackage,ExecutionStep} from '@qaick/executor';
import {createRuntime} from './runtime.js';
import {startFixture} from '../../QAICK_Runner_FE/scripts/regression/http-fixture.mjs';

let fixture:Awaited<ReturnType<typeof startFixture>>;
beforeEach(async()=>{fixture=await startFixture(0);});
afterEach(async()=>{await fixture.close();});
const declare=(name:string,required=false,defaultValue='default')=>({name,type:'string' as const,required,defaultValue});
const flowPackage=(steps:ExecutionStep[]):ExecutionPackage=>({schemaVersion:7,ordering:'routine',packageId:'clear-http',definitions:[],target:{kind:'flow',id:'f',name:'F'},executionContext:{scope:'flow',mode:'standalone'},steps});
function http(at:ExecutionStep['structuralAddress'],consume=false):ExecutionStep {
 return {id:'http',name:'HTTP proof',kind:'action',action:'http.produce',output:{},structuralAddress:at,
  staticInputs:{url:`${fixture.url}/produce/clearing`,method:'POST',headers:{'Content-Type':'application/json'},query:{namespace:'clearing-native',...(consume?{value:'{{inputs.value}}'}:{})},body:JSON.stringify({literal:null,items:[null,false,0]})},
  bindings:consume?{value:{type:'input',path:['s']}}:{}};
}
const runtime=()=>createRuntime({actionExecutors:[new HttpActionExecutor(new NodeHttpTransport())]});
const rootAddress={scope:'flow' as const,segments:[{kind:'step' as const,position:1}]};

it.each([['absent',{},'default'],['replacement',{s:'replacement'},'replacement'],['string-null',{s:'null'},'null'],['whitespace',{s:'  '},'  ']] as const)('actual HTTP preserves %s selection',async(name,inputs,expected)=>{
 const pkg={...flowPackage([http(rootAddress,true)]),inputDeclarations:[declare('s')]};
 const result=await(await runtime().execute({requestId:name,executionPackage:pkg,inputs:{...inputs},environment:'test'})).result;
 expect(result.state).toBe('completed');expect(result.steps[0].inputs.value).toBe(expected);
 expect(fixture.receipts).toHaveLength(1);expect(fixture.receipts[0].query.value).toBe(expected);
 expect(fixture.receipts[0].parsedBody).toEqual({literal:null,items:[null,false,0]});
});

it.each([['number',0],['boolean',false]] as const)('actual HTTP preserves %s falsey values',async(type,value)=>{
 const pkg={...flowPackage([http(rootAddress,true)]),inputDeclarations:[{name:'s',type,required:true}]};
 const result=await(await runtime().execute({requestId:type,executionPackage:pkg,inputs:{s:value},environment:'test'})).result;
 expect(result.state).toBe('completed');expect(result.steps[0].inputs.value).toBe(value);
 expect(fixture.receipts).toHaveLength(1);expect(fixture.receipts[0].query.value).toBe(String(value));
});

it.each([null,'',undefined])('required explicit clear %s suppresses a meaningful default with zero HTTP',async s=>{
 const pkg={...flowPackage([http(rootAddress,true)]),inputDeclarations:[declare('s',true)]};
 const before=JSON.stringify(fixture.receipts);
 const result=await(await runtime().execute({requestId:'required',executionPackage:pkg,inputs:{s},environment:'test'})).result;
 expect(result.state).toBe('failed');expect(result.issues?.some(issue=>issue.code==='MISSING_INPUT')).toBe(true);
 expect(JSON.stringify(fixture.receipts)).toBe(before);
});

it.each([null,''])('optional consumed clear %s fails binding without HTTP or default resurrection',async s=>{
 const pkg={...flowPackage([http(rootAddress,true)]),inputDeclarations:[declare('s')]};
 const before=JSON.stringify(fixture.receipts);
 const result=await(await runtime().execute({requestId:'bound-clear',executionPackage:pkg,inputs:{s},environment:'test'})).result;
 expect(result.state).toBe('failed');expect(result.steps[0].error?.code).toBe('BINDING_RESOLUTION_ERROR');
 expect(JSON.stringify(fixture.receipts)).toBe(before);
});

it('root/Flow omission and Operation clearing coexist with independent defaults and actual HTTP',async()=>{
 const rt=runtime();
 const pkg:ExecutionPackage={...flowPackage([]),target:{kind:'project',id:'p',name:'P'},executionContext:{scope:'routine',mode:'routine'},inputDeclarations:[declare('s',false,'root-default')],flows:[1,2].map(position=>{
  const at={scope:'routine' as const,segments:[{kind:'flow' as const,position},{kind:'step' as const,position:1}]};
  const child=http({...at,segments:[...at.segments,{kind:'body'},{kind:'step',position:1}]});
  child.bindings={value:{type:'input',path:['other']}};
  (child.staticInputs!.query as Record<string,string>).value='{{inputs.value}}';
  return {id:`f${position}`,name:`F${position}`,structuralPosition:position,inputDeclarations:[declare('s',false,`flow${position}`),declare('other',true,`other${position}`)],steps:[{id:'op',name:'Operation',kind:'operation' as const,action:'operation',output:{},structuralAddress:at,inputDeclarations:[declare('mode',false,'operation-default')],staticInputs:{mode:null},children:[child]}]};
 })};
 const result=await(await rt.execute({requestId:'boundaries',executionPackage:pkg,inputs:{s:null},environment:'test'})).result;
 expect(result.state).toBe('completed');expect(fixture.receipts.map(r=>r.query.value)).toEqual(['other1','other2']);
 // Original execution must also expose missing Flow lexical s, not just replay snapshots.
 for(const position of [1,2]) {
  const probe=structuredClone(pkg);
  for(const flow of probe.flows!) {
   if(flow.structuralPosition!==position) flow.steps=[];
   else {
    const op=flow.steps[0];
    op.children=[http({...op.structuralAddress,segments:[...op.structuralAddress.segments,{kind:'body'},{kind:'step',position:1}]},true)];
   }
  }
  const before=JSON.stringify(fixture.receipts);
  const original=await(await rt.execute({requestId:`original-scope-${position}`,executionPackage:probe,inputs:{s:null},environment:'test'})).result;
  expect(original.state).toBe('failed');
  expect(original.children![position-1].steps[0].children![0].error?.code).toBe('BINDING_RESOLUTION_ERROR');
  expect(JSON.stringify(fixture.receipts)).toBe(before);
 }
 for(const position of [1,2]) {
  const operation=result.children![position-1].steps[0];expect(operation.inputs).not.toHaveProperty('mode');
  expect(operation.children![0].inputs.value).toBe(`other${position}`);
  const address=operation.structuralAddress;
  if(!address) throw new Error('Expected Operation structural address');
  const replay=await(await rt.retryOperation('boundaries',{structuralAddress:address,iterations:[]})).result;
  expect(replay.state).toBe('completed');expect(replay.inputs).not.toHaveProperty('mode');
  expect(replay.lexicalScope).not.toHaveProperty('s');expect(replay.lexicalScope).not.toHaveProperty('mode');
  expect(replay.lexicalScope.other).toBe(`other${position}`);
 }
 expect(fixture.receipts.map(r=>r.query.value)).toEqual(['other1','other2','other1','other2']);
 expect(fixture.receipts.every(r=>r.status===200)).toBe(true);
 const serialized=JSON.parse(JSON.stringify(result));
 expect(serialized.children[0].steps[0].structuralAddress).toEqual({scope:'routine',segments:[{kind:'flow',position:1},{kind:'step',position:1}]});
 expect(serialized.children[0].steps[0].inputs).not.toHaveProperty('mode');
});

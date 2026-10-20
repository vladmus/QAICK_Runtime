import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {it,expect,vi} from 'vitest';
import {createExecutor} from '@qaick/executor';
import {HttpActionExecutor} from '@qaick/http-executor';
import {NodeHttpTransport} from '@qaick/http-executor/node';
import {createRuntime} from './runtime.js';
import type {ExecutorRequestV8} from './index.js';
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/v8-standalone-operation.json',import.meta.url),'utf8')) as ExecutorRequestV8['executionPackage'];
const request=(executionPackage:ExecutorRequestV8['executionPackage'],extra:Partial<ExecutorRequestV8>={}):ExecutorRequestV8=>({requestId:crypto.randomUUID(),executionPackage,inputs:{},environment:'test',...extra});

it('forwards v8 through the injected published Executor, retaining occurrence/hash/scope and event/result APIs',async()=>{
 const doc=fixture(),dispatch=vi.fn(async()=>({outputs:{value:17}}));doc.nodes[1].output={value:null};
 const executor=createExecutor({actionExecutors:[{supports:()=>true,execute:dispatch}]}),runtime=createRuntime({executor}),r=request(doc),h=await runtime.execute(r),result=await h.result;
 expect(result.resultVersion).toBe(2);expect(result.scope).toEqual(doc.selection.root);expect(result.source).toEqual(doc.source);expect(result.steps[0].occurrence).toBe(doc.context.root);expect(result.steps[0].children?.[0].outputs.value).toBe(17);expect(dispatch).toHaveBeenCalledTimes(1);expect(await runtime.result(r.requestId)).toEqual(result);expect(runtime.controlState(r.requestId)).toBe('completed');
 const events=[];for await(const event of runtime.events(r.requestId))events.push(event);expect(events.every(e=>'eventVersion'in e&&e.eventVersion===2)).toBe(true);expect(events.at(-1)?.type).toBe('run_finished');
});
it('preserves v8 admission rejection and preflight failed evidence as distinct zero-dispatch boundaries',async()=>{
 const dispatch=vi.fn(),runtime=createRuntime({actionExecutors:[{supports:()=>true,execute:dispatch}]}),invalid=fixture();invalid.nodes[0].id='wrong';await expect(runtime.execute(request(invalid))).rejects.toMatchObject({code:'INVALID_EXECUTION_DOCUMENT'});
 const doc=fixture();doc.selection.runtimeRequirements=['unavailable'];const r=await(await runtime.execute(request(doc))).result;expect(r.resultVersion).toBe(2);expect(r.state).toBe('failed');expect(r.steps).toEqual([]);expect(r.issues?.[0].code).toBe('MISSING_RUNTIME_VALUE');expect(dispatch).not.toHaveBeenCalled();
});
it('composes the existing script backend for a selected v8 Action without executing its parent',async()=>{
 const doc=fixture(),action=doc.nodes[1];action.action='script.compute';action.output={value:null};action.staticInputs={value:false};action.adapterConfig={source:'function run(args) {return {value:args.value};}',outputNames:['value']};doc.selection.root={kind:'occurrence',key:action.occurrence};
 const backend=vi.fn(async job=>new Function(`${job.source};return run;`)()(job.inputs));const runtime=createRuntime({scriptBackend:backend});const result=await(await runtime.execute(request(doc))).result;
 expect(result.state).toBe('completed');expect(result.steps).toHaveLength(1);expect(result.steps[0].occurrence).toBe(action.occurrence);expect(result.steps[0].iterations).toEqual([]);expect(result.steps[0].outputs.value).toBe(false);expect(backend).toHaveBeenCalledTimes(1);
});
it('does not fabricate script success when no backend is configured',async()=>{
 const doc=fixture();doc.nodes[1].action='script.compute';doc.nodes[1].adapterConfig={source:'function run(args) {return {value:1};}',outputNames:['value']};const r=await(await createRuntime().execute(request(doc))).result;expect(r.state).toBe('failed');expect(r.steps[0].children?.[0].error?.code).toBe('UNSUPPORTED_SCRIPT_EXECUTION');
});
for(const stop of [false,true])it(`forwards occurrence breakpoints and ${stop?'Stop':'Resume'} to the same execution lifecycle`,async()=>{
 const doc=fixture(),action=doc.nodes[1],dispatch=vi.fn(async()=>({outputs:{}})),runtime=createRuntime({actionExecutors:[{supports:()=>true,execute:dispatch}]}),r=request(doc,{debugSession:{breakpoints:[action.occurrence]}}),h=await runtime.execute(r);
 for await(const event of runtime.events(r.requestId))if(event.control?.type==='pause')break;
 expect(runtime.controlState(r.requestId)).toBe('paused');expect(dispatch).not.toHaveBeenCalled();await runtime.control(r.requestId,{type:stop?'stop':'resume'});const result=await h.result;expect(result.resultVersion).toBe(2);expect(result.state).toBe(stop?'cancelled':'completed');expect(dispatch).toHaveBeenCalledTimes(stop?0:1);
});
for(const external of [false,true])it(`published dependency chain native v8 HTTP: ${external?'external evidence rejected':'exact output transfer'}`,async()=>{
 const receipts:Array<{url:string;body:string}>=[],token=crypto.randomUUID(),server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;receipts.push({url:req.url??'',body});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({token}));});await new Promise<void>((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
 try{
  const endpoint=`http://127.0.0.1:${(server.address() as {port:number}).port}`,doc=fixture(),producer=doc.nodes[1],source=doc.context.nodes[2];producer.action='http.request';producer.output={value:null};producer.staticInputs={url:endpoint+'/produce',method:'GET'};producer.adapterConfig={responseFields:{value:'$.token'}};
  const locator=structuredClone(source.locator);if(locator.kind!=='source')throw Error('Expected source locator');locator.path[locator.path.length-1]={kind:'node',id:'b'};const key=JSON.stringify(locator);
  doc.context.nodes.push({...source,key,locator,name:'Consumer'});doc.context.nodes[1].children.push(key);doc.context.nodes[1].sequence!.push(key);doc.nodes[0].children!.push(key);doc.nodes.push({...structuredClone(producer),occurrence:key,id:'b',name:'Consumer',staticInputs:{url:endpoint+'/consume',method:'POST',body:'{"token":"{{inputs.value}}"}'},bindings:{value:{type:'occurrence-output',producer:producer.occurrence,iterations:[],outputName:'value'}}});if(external)doc.selection.root={kind:'occurrence',key};
  const before=structuredClone(doc),runtime=createRuntime({actionExecutors:[new HttpActionExecutor(new NodeHttpTransport())]}),result=await(await runtime.execute(request(doc))).result;
  expect(doc).toEqual(before);expect(result.resultVersion).toBe(2);
  if(external){expect(result.state).toBe('failed');expect(result.issues?.[0].code).toBe('UNAVAILABLE_SCOPE_DEPENDENCY');expect(receipts).toEqual([]);}else{expect(result.state).toBe('completed');expect(receipts.map(r=>r.url)).toEqual(['/produce','/consume']);expect(JSON.parse(receipts[1].body).token).toBe(token);expect(result.steps[0].children?.[1].inputs.value).toBe(token);}
 }finally{await new Promise<void>((ok,no)=>server.close(error=>error?no(error):ok()));}
},10000);

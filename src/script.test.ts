import {describe,expect,it,vi} from 'vitest';
import {ScriptActionExecutor,scriptJsonIssue,scriptResultIssue,SCRIPT_WORKER_SOURCE} from './script.js';
import {createRuntime} from './runtime.js';
const context=(source='function run(args) { return {value:42}; }')=>({action:'script.compute',inputs:{amount:7},environment:'test',runtimeValues:{},step:{id:'same',name:'Compute',action:'script.compute',output:{value:null},adapterConfig:{source,outputNames:['value']}},signal:new AbortController().signal});
describe('shared script adapter',()=>{
 it('headless scripts explicitly require a backend',async()=>{await expect(new ScriptActionExecutor().execute(context())).rejects.toMatchObject({code:'UNSUPPORTED_SCRIPT_EXECUTION'});});
 it('clones arguments and publishes named outputs independently for repeated calls',async()=>{
  const input=context();const backend=vi.fn(async(job)=>{job.inputs.amount+=1;return {value:job.inputs.amount};});
  const adapter=new ScriptActionExecutor(backend);
  expect(await adapter.execute(input)).toEqual({outputs:{value:8}});expect(await adapter.execute(input)).toEqual({outputs:{value:8}});expect(input.inputs.amount).toBe(7);
 });
 it.each([NaN,Infinity,undefined,()=>1,new Date(),{x:undefined},[undefined],Promise.resolve(1)])('rejects invalid JSON without conversion: %s',value=>{expect(scriptJsonIssue(value)).toBeDefined();});
 it('rejects cycles, accessors, sparse arrays and invalid limits',()=>{
  const cycle:any={};cycle.self=cycle;expect(scriptJsonIssue(cycle)).toBeDefined();
  expect(scriptJsonIssue({get value(){throw Error('must not invoke');}})).toBeDefined();
  expect(scriptJsonIssue(new Array(2))).toBeDefined();expect(scriptJsonIssue(new Array(1001).fill(1))).toBeDefined();
  expect(scriptResultIssue({value:'x'.repeat(100001)},['value'])).toBeDefined();
 });
 it('preserves JSON null and verifies declared names',()=>{expect(scriptResultIssue({value:null,nested:[null]},['value'])).toBeUndefined();expect(scriptResultIssue({},['value'])).toContain('Missing');});
 it('bounds the entire accepted job, aborts backend, suppresses late outputs',async()=>{
  vi.useFakeTimers();let signal:AbortSignal|undefined;let release:(v:unknown)=>void=()=>{};
  const adapter=new ScriptActionExecutor((_job,s)=>{signal=s;return new Promise(resolve=>release=resolve);});
  const promise=adapter.execute(context());const rejected=expect(promise).rejects.toMatchObject({code:'SCRIPT_TIMEOUT'});
  await vi.advanceTimersByTimeAsync(1000);await rejected;expect(signal!.aborted).toBe(true);release({value:99});await Promise.resolve();vi.useRealTimers();
 });
 it('cancels independently, aborts backend and rejects late completion',async()=>{
  const controller=new AbortController();let signal:AbortSignal|undefined;
  const adapter=new ScriptActionExecutor((_job,s)=>{signal=s;return new Promise(()=>{});});
  const promise=adapter.execute({...context(),signal:controller.signal});await Promise.resolve();controller.abort();
  await expect(promise).rejects.toMatchObject({code:'ACTION_CANCELLED'});expect(signal!.aborted).toBe(true);
 });
 it('rejects oversized source and missing output instead of placeholders',async()=>{
  const adapter=new ScriptActionExecutor(async()=>({}));
  await expect(adapter.execute(context())).rejects.toMatchObject({code:'SCRIPT_INVALID_OUTPUT'});
  await expect(adapter.execute(context('function run(args) {}'+' '.repeat(20000)))).rejects.toMatchObject({code:'SCRIPT_INVALID_SOURCE'});
 });
 it('registers unsupported script dispatch in default Runtime, distinct from static execution',async()=>{
  const address={scope:'flow' as const,segments:[{kind:'step' as const,position:1}]};
  const run=await createRuntime().execute({requestId:'headless-script',inputs:{},environment:'headless',executionPackage:{schemaVersion:7,ordering:'routine',packageId:'script',executionContext:{scope:'flow',mode:'standalone'},target:{kind:'flow',id:'f',name:'f'},definitions:[{kind:'action',id:'script.compute',name:'Compute'}],requiredInputs:[],steps:[{...context().step,structuralAddress:address}]}});
  const result=await run.result;expect(result.state).toBe('failed');expect(result.steps[0].error?.code).toBe('UNSUPPORTED_SCRIPT_EXECUTION');
 });
 it('Worker program validates before posting results and defines only run(args)',()=>{expect(SCRIPT_WORKER_SOURCE).toContain('scriptResultIssue(result, outputNames)');expect(SCRIPT_WORKER_SOURCE).toContain('new Function');});
});

it('Web Worker backend terminates, revokes its URL and suppresses late messages on abort',async()=>{
 const {executeWebWorkerScript}=await import('./script.js');
 let instance:any;
 const terminate=vi.fn();const revoke=vi.fn();
 class FakeWorker {onmessage:any;onerror:any;postMessage=vi.fn();terminate=terminate;constructor(){instance=this;}}
 vi.stubGlobal('Worker',FakeWorker);
 const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test');
 const revoked=vi.spyOn(URL,'revokeObjectURL').mockImplementation(revoke);
 try{
  const controller=new AbortController();const promise=executeWebWorkerScript({source:'function run(args){return {value:42};}',inputs:{},outputNames:['value']},controller.signal);
  controller.abort();await expect(promise).rejects.toMatchObject({code:'ACTION_CANCELLED'});
  instance.onmessage({data:{ok:true,result:{value:99}}});expect(terminate).toHaveBeenCalledTimes(1);expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test');
 }finally{create.mockRestore();revoked.mockRestore();vi.unstubAllGlobals();}
});

it('self-contained Worker freezes nested arguments before execution',()=>{
 let response:any;
 const workerSelf={postMessage:(value:any)=>{response=value;},onmessage:undefined as any};
 new Function('self',SCRIPT_WORKER_SOURCE)(workerSelf);
 workerSelf.onmessage({data:{source:'function run(args){args.nested.value=99; args.items[0].value=99; return {value:args.nested.value, item:args.items[0].value, frozen:Object.isFrozen(args.nested)&&Object.isFrozen(args.items[0])};}',inputs:{nested:{value:7},items:[{value:8}]},outputNames:['value','item','frozen']}});
 expect(response).toEqual({ok:true,result:{value:7,item:8,frozen:true}});
 expect(SCRIPT_WORKER_SOURCE).not.toContain('toString()');
});

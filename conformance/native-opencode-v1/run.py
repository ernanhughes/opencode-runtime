"""Exact-version isolated native OpenCode harness; no callback-dispatch RPC."""
import argparse,base64,hashlib,http.server,json,os,pathlib,re,socket,subprocess,threading,time,urllib.request,urllib.parse,urllib.error

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--binary',required=True)
    parser.add_argument('--projects',default='C:/Projects')
    parser.add_argument('--out',required=True)
    parser.add_argument('--cases',required=True)
    args=parser.parse_args()
    out=pathlib.Path(args.out).resolve()
    out.mkdir(parents=True,exist_ok=False)
    projects=pathlib.Path(args.projects).resolve()
    binary=pathlib.Path(args.binary).resolve()
    version=subprocess.check_output([str(binary),'--version']).decode().strip()
    if version!='opencode v2.0.22':raise RuntimeError('runtime must be exactly 2.0.22: '+version)
    for d in ['project','home','appdata','localappdata','config','global-config','cache','data','state','stores','observer','raw']:(out/d).mkdir()
    for label,flags in [('cli-help',['--help']),('run-help',['run','--help']),('api-help',['api','--help'])]:
        (out/'raw'/f'{label}.txt').write_bytes(subprocess.check_output([str(binary),*flags]))
    cases=json.loads(pathlib.Path(args.cases).read_text())
    (out/'cases.json').write_text(json.dumps(cases,indent=2),encoding='utf-8')
    (out/'observer/index.ts').write_bytes(pathlib.Path(__file__).with_name('observer.ts').read_bytes())
    (out/'observer/package.json').write_text(json.dumps({'name':'native-acceptance-observer-v1','type':'module','main':'index.ts'}))
    repo=out/'project'
    (repo/'README.md').write_text('Disposable native acceptance fixture. Build passes. Deployment requires approval.\n')
    subprocess.run(['git','init','--quiet',str(repo)],check=True)
    subprocess.run(['git','-C',str(repo),'add','README.md'],check=True)
    subprocess.run(['git','-C',str(repo),'-c','user.name=Native Acceptance','-c','user.email=fixture@example.invalid','commit','--quiet','-m','test: disposable native boundary fixture'],check=True)
    names=['opencode-lens','opencode-relate','opencode-radar','opencode-authority','opencode-evidence','opencode-verify','opencode-proof','opencode-remembering','project-context-compiler','opencode-vfs','project-context-opencode']
    plugins=[{'package':(projects/n).as_uri(),'options':{'storage':{'repo':str(out/'stores/vfs'),'autoCommit':False,'push':False}}} if n=='opencode-vfs' else (projects/n).as_uri() for n in names]
    config={'plugins':plugins+[(out/'observer').as_uri()],'model':'native-fixture/scripted','permissions':[{'action':'*','resource':'*','effect':'allow'},{'action':'native-probe-deny','resource':'*','effect':'deny'},{'action':'native-probe-ask','resource':'*','effect':'ask'},{'action':'edit','resource':'*','effect':'ask'},{'action':'edit','resource':'deny-probe.txt','effect':'deny'}],'share':'disabled','update':'disable','snapshots':False,'lsp':False,'formatter':False}
    (repo/'opencode.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
    env=os.environ.copy()
    for k in list(env):
        if k.endswith(('API_KEY','TOKEN')) or k.startswith(('OPENCODE_','REMEMBERING_','AUTHORITY_','PROJECT_CONTEXT_')):env.pop(k,None)
    env.update({'USERPROFILE':str(out/'home'),'HOME':str(out/'home'),'APPDATA':str(out/'appdata'),'LOCALAPPDATA':str(out/'localappdata'),'OPENCODE_CONFIG_DIR':str(out/'global-config'),'XDG_CONFIG_HOME':str(out/'config'),'XDG_DATA_HOME':str(out/'data'),'XDG_STATE_HOME':str(out/'state'),'XDG_CACHE_HOME':str(out/'cache'),'NATIVE_RUN_ROOT':str(out),'NATIVE_SDK_PATH':str(projects/'opencode-vfs/node_modules/@opencode/plugin/dist/promise/index.js'),'PROJECT_CONTEXT_CAPTURE':'0','PROJECT_CONTEXT_RUNTIME':'off','REMEMBERING_EMBEDDING_PROVIDER':'hashing','REMEMBERING_ALLOW_TEST_EMBEDDINGS':'1','REMEMBERING_STORAGE_MODE':'json','REMEMBERING_JSON_PATH':str(out/'stores/memory'),'REMEMBERING_PROJECT_ID':out.name,'AUTHORITY_TRACE_DIR':str(out/'stores/authority'),'AUTHORITY_CANARY_DIR':str(out/'stores/canary')})
    for provider in ['EVIDENCE','VERIFY','PROOF']:env[f'OPENCODE_{provider}_DIR']=str(out/'stores'/provider.lower())
    policy={'version':'native-canary-wave1','data_use':[{'id':'target','purpose':'authority-canary','data_scope':['canary:target:*'],'permitted_operations':['ACCESS']}],'actions':[{'id':'write','purpose':'authority-canary','action_scope':['canary-write'],'approval':'none'}]}
    (out/'canary-policy.json').write_text(json.dumps(policy,indent=2),encoding='utf-8')
    env['AUTHORITY_POLICY_FILE']=str(out/'canary-policy.json')
    emitted=set()
    class Fixture(http.server.BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_POST(self):
            body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            match=re.search(r'\[native-case:([a-zA-Z0-9_-]+)\]',json.dumps(body['messages']))
            if not match:self.send_error(400,'missing native fixture marker');return
            key=match[1];case=next(c for c in json.loads((out/'cases.json').read_text()) if c['id']==key)
            first=key not in emitted;emitted.add(key)
            with (out/'fixture-requests.jsonl').open('a',encoding='utf-8') as log:log.write(json.dumps({'case':key,'path':self.path,'body':body,'inference':False})+'\n')
            if case.get('direct'):
                name=case['tool'];arguments=case['args']
            else:
                name='execute';arguments={'code':f"return await tools[{json.dumps(case['tool'])}]({json.dumps(case['args'])});"}
            delta={'role':'assistant','tool_calls':[{'index':0,'id':'native-'+key,'type':'function','function':{'name':name,'arguments':json.dumps(arguments)}}]} if first else {'role':'assistant','content':'Native fixture completed.'}
            chunk={'id':'fixture-'+key,'object':'chat.completion.chunk','created':0,'model':'scripted','choices':[{'index':0,'delta':delta,'finish_reason':None}]}
            end={**chunk,'choices':[{'index':0,'delta':{},'finish_reason':'tool_calls' if first else 'stop'}],'usage':{'prompt_tokens':0,'completion_tokens':0,'total_tokens':0}}
            payload='data: '+json.dumps(chunk)+'\n\ndata: '+json.dumps(end)+'\n\ndata: [DONE]\n\n'
            with (out/'fixture-responses.jsonl').open('a',encoding='utf-8') as log:log.write(json.dumps({'case':key,'first':first,'chunks':[chunk,end]})+'\n')
            self.send_response(200);self.send_header('Content-Type','text/event-stream');self.send_header('Content-Length',str(len(payload.encode())));self.end_headers();self.wfile.write(payload.encode())
    fixture=http.server.ThreadingHTTPServer(('127.0.0.1',0),Fixture)
    fixture_thread=threading.Thread(target=fixture.serve_forever,daemon=True);fixture_thread.start()
    env['NATIVE_FIXTURE_URL']=f'http://127.0.0.1:{fixture.server_address[1]}/v1'
    sources={}
    for name in names:
        directory=projects/name
        files=subprocess.check_output(['git','-C',str(directory),'ls-files','-z']).decode().split('\0')
        sources[name]={p:hashlib.sha256((directory/p).read_bytes()).hexdigest() for p in files if p and (p.startswith('src/') or p in ('index.ts','package.json','package-lock.json','bun.lock')) and (directory/p).is_file()}
    identity={'run_id':out.name,'version':version,'binary':str(binary),'binary_sha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'config':str(repo/'opencode.json'),'config_sha256':hashlib.sha256((repo/'opencode.json').read_bytes()).hexdigest(),'environment':{k:v for k,v in env.items() if k.startswith(('NATIVE_','XDG_','REMEMBERING_','AUTHORITY_','PROJECT_CONTEXT_','OPENCODE_'))},'model_inference_calls':0,'proposal_source':'scripted_loopback_chat_fixture','repositories':{n:subprocess.check_output(['git','-C',str(projects/n),'rev-parse','HEAD']).decode().strip() for n in names},'source_hashes':sources,'observer_sha256':hashlib.sha256((out/'observer/index.ts').read_bytes()).hexdigest(),'runner_sha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()}
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    command=[str(binary),'serve','--hostname','127.0.0.1','--port',str(port),'--log-level','debug','--print-logs']
    server=subprocess.Popen(command,cwd=repo,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
    identity.update({'pid':server.pid,'command':command,'base_url':f'http://127.0.0.1:{port}'})
    (out/'identity.json').write_text(json.dumps(identity,indent=2),encoding='utf-8')
    secret=['']
    (out/'events.jsonl').touch()
    def logger():
        with (out/'server.log').open('w',encoding='utf-8') as log:
            for line in server.stdout:
                m=re.search(r'server password (\S+)',line)
                if m:secret[0]=m[1]
                log.write(re.sub(r'server password \S+','server password [REDACTED]',line));log.flush()
    worker=threading.Thread(target=logger,daemon=True);worker.start()
    def request(label,method,path,body=None,scoped=True):
        url=identity['base_url']+path
        if scoped:url+=('&' if '?' in url else '?')+urllib.parse.urlencode({'location[directory]':str(repo)})
        headers={'Authorization':'Basic '+base64.b64encode(('opencode:'+secret[0]).encode()).decode()}
        if body is not None:headers['Content-Type']='application/json'
        (out/'raw'/f'{label}.request.json').write_text(json.dumps({'method':method,'path':path,'body':body},indent=2),encoding='utf-8')
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers=headers,data=None if body is None else json.dumps(body).encode(),method=method),timeout=20) as response:status=response.status;raw=response.read().decode()
        except urllib.error.HTTPError as e:status=e.code;raw=e.read().decode()
        try:value=json.loads(raw) if raw else None
        except ValueError:value=raw
        result={'status':status,'body':value}
        with (out/'api-exchanges.jsonl').open('a',encoding='utf-8') as log:log.write(json.dumps({'at':time.time(),'label':label,'method':method,'path':path,'request':body,'response':result})+'\n')
        (out/'raw'/f'{label}.response.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        return result
    try:
        for i in range(150):
            if server.poll() is not None:raise RuntimeError('host exited before readiness')
            if secret[0]:
                try:
                    if request('info','GET','/api/info',scoped=False)['status']==200:break
                except OSError:pass
            time.sleep(.2)
        else:raise RuntimeError('host readiness timeout')
        request('openapi','GET','/openapi.json',scoped=False)
        request('config','GET','/api/config')
        created=request('initial-session','POST','/api/session',{'title':'Initialize native fixture'})
        for i in range(200):
            loaded=request('plugins','GET','/api/plugin')
            active=[p for p in loaded['body'].get('data',[]) if p.get('source',{}).get('type')=='local' and p.get('state',{}).get('status')=='active']
            if len(active)==len(names)+1:break
            time.sleep(.2)
        else:raise RuntimeError('plugins did not all activate')
        inventory=request('inventory','POST','/api/rpc/native-acceptance-v1/inventory',{'input':{}})
        # Respect actual registered availability. A caller's explicit mode still
        # wins, including deliberate unavailable-Code-Mode rejection probes.
        tools={t['id']:t for t in inventory['body']['output']['tools']}
        for case in cases:
            if 'direct' not in case and (tools.get(case['tool'],{}).get('options') or {}).get('codemode') is False:
                case['direct']=True
                case['transport_selection']='registered codemode:false'
        receipts=[]
        results={}
        def resolve(value):
            if isinstance(value,dict) and set(value)=={'$result'}:
                keys=value['$result'].split('.');item=results[keys[0]]
                for k in keys[1:]:item=item[int(k)] if isinstance(item,list) else item[k]
                return item
            if isinstance(value,dict):return {k:resolve(v) for k,v in value.items()}
            if isinstance(value,list):return [resolve(v) for v in value]
            if isinstance(value,str):return value.replace('${PROJECT}',str(repo)).replace('${CANARY}',str(out/'stores/canary')).replace('${FILE_HASH}',hashlib.sha256((repo/'README.md').read_bytes()).hexdigest())
            return value
        for case in cases:
            case['args']=resolve(case['args'])
            (out/'cases.json').write_text(json.dumps(cases,indent=2),encoding='utf-8')
            session=request(case['id']+'-session','POST','/api/session',{'title':case['id'],'model':{'providerID':'native-fixture','id':'scripted'}})
            if session['status']!=200:raise RuntimeError('session creation failed: '+str(session))
            sid=session['body']['data']['id']
            response=request(case['id']+'-prompt','POST',f'/api/session/{sid}/prompt',{'text':f"[native-case:{case['id']}] Execute the isolated acceptance fixture.",'resume':True})
            for i in range(100):
                messages=request(case['id']+'-messages','GET',f'/api/session/{sid}/message')
                events=[json.loads(line) for line in (out/'events.jsonl').read_text().splitlines()]
                permissions=request(case['id']+'-permissions','GET',f'/api/session/{sid}/permission')
                pending=permissions['body'].get('data',[]) if isinstance(permissions['body'],dict) else []
                for permission in pending:
                    if case.get('permission_reply'):
                        reply=request(case['id']+'-reply','POST',f"/api/session/{sid}/permission/{permission['id']}/reply",{'decision':case['permission_reply']})
                        if reply['status'] not in (200,204):raise RuntimeError('permission fixture reply failed: '+str(reply))
                if 'Native fixture completed.' in json.dumps(messages) or any(m.get('type')=='idle' and m.get('outcome')=='failed' for m in messages['body'].get('data',[])):break
                time.sleep(.2)
            receipts.append({'case':case['id'],'provider':case['provider'],'tool':case['tool'],'session_id':sid,'prompt_status':response['status'],'messages':f"raw/{case['id']}-messages.response.json"})
            returned=[e for e in events if e['stage']=='CALLBACK_RETURNED' and e['data'].get('sessionID')==sid and e['data'].get('tool')==case['tool']]
            if returned:
                content=returned[-1]['data']['result'].get('content')
                if isinstance(content,str):
                    try:results[case['id']]=json.loads(content)
                    except ValueError:results[case['id']]=content
            (out/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
            request(case['id']+'-session-final','GET',f'/api/session/{sid}')
            request(case['id']+'-log','GET',f'/api/experimental/session/{sid}/log')
            print(json.dumps(receipts[-1]),flush=True)
        (out/'sessions.json').write_text(json.dumps(receipts,indent=2),encoding='utf-8')
    finally:
        try:request('shutdown','POST','/api/location/reload',{},scoped=False)
        except Exception:pass
        server.terminate();server.wait(timeout=10);worker.join(timeout=2);fixture.shutdown();fixture.server_close()
        (out/'stopped.json').write_text(json.dumps({'pid':server.pid,'exit_code':server.returncode}),encoding='utf-8')
        manifest={str(p.relative_to(out)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in out.rglob('*') if p.is_file() and '.git' not in p.parts and p.name!='manifest.json'}
        (out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')

if __name__=='__main__':main()

"""Conservative receipts derived from independent native observations."""
import argparse,hashlib,json,pathlib

STAGES=['PLUGIN_LOADED','INTERFACE_DISCOVERED','NATIVE_REQUEST_PROPOSED','NATIVE_ADMISSION_OBSERVED','PERMISSION_DECISION_OBSERVED','CALLBACK_ENTERED','EFFECT_OBSERVED','RESULT_RETURNED','HOOK_OBSERVED']
def at(value,path):
    for key in path.split('.'):value=value[int(key)] if isinstance(value,list) else value[key]
    return value
def analyze(case,session,events,messages,result,loaded,discovered,proposed,effects):
    sid=session['session_id'];tool=case['tool']
    matched=[e for e in events if e['data'].get('sessionID')==sid and e['data'].get('tool')==tool]
    entered=any(e['stage']=='CALLBACK_ENTERED' for e in matched)
    returned=next((e for e in reversed(matched) if e['stage']=='CALLBACK_RETURNED'),None)
    before=any(e['stage']=='TOOL_execute.before' for e in matched)
    after=any(e['stage']=='TOOL_execute.after' for e in matched)
    permissions=[e['data'] for e in events if e['stage']=='PERMISSION_DECISION_OBSERVED' and e['data'].get('sessionID')==sid]
    # An explicit session permission error is also evidence of a decision;
    # it must not be misreported as a permission-hook event.
    for m in messages.get('data',[]):
        for part in m.get('content',[]):
            error=part.get('state',{}).get('error',{})
            if error.get('type')=='permission.rejected':permissions.append({'effect':'deny','source':'session_permission_error','error':error})
    texts=[p['text'] for m in messages.get('data',[]) for part in m.get('content',[]) for p in part.get('state',{}).get('content',[]) if p.get('type')=='text']
    content=returned['data']['result'].get('content') if returned else None
    exact=bool(isinstance(content,str) and content in texts)
    error_text='\n'.join(texts)+'\n'+json.dumps(messages)
    expected=case.get('expected','success')
    checks={}
    for path,value in case.get('result_equals',{}).items():
        try:checks[path]=at(result,path)==value
        except (KeyError,TypeError,IndexError):checks[path]=False
    rejected=(expected=='permission_rejection' and any(p['effect']=='deny' for p in permissions) and 'permission' in error_text.lower()) or (not entered and (
        (expected=='schema_rejection' and 'Invalid arguments for tool' in error_text) or
        (expected=='admission_rejection' and 'currently available' in error_text) or
        (expected=='hook_rejection' and 'authority blocked canary invocation: REFORMULATE' in error_text)))
    stages={s:'UNKNOWN' for s in STAGES}
    stages.update(PLUGIN_LOADED='PASS' if loaded else 'UNKNOWN',INTERFACE_DISCOVERED='PASS' if discovered else 'UNKNOWN',NATIVE_REQUEST_PROPOSED='PASS' if proposed else 'UNKNOWN',NATIVE_ADMISSION_OBSERVED='PASS' if entered else 'FAIL' if rejected else 'UNKNOWN',PERMISSION_DECISION_OBSERVED='PASS' if permissions else 'UNKNOWN',CALLBACK_ENTERED='PASS' if entered else 'FAIL' if rejected else 'UNKNOWN',EFFECT_OBSERVED='PASS' if effects and all(effects.values()) else 'FAIL' if effects else 'UNKNOWN',RESULT_RETURNED='PASS' if exact or rejected else 'UNKNOWN',HOOK_OBSERVED='PASS' if before and after else 'UNKNOWN')
    passed=all([loaded,discovered,proposed,entered,returned,exact,all(checks.values()),bool(effects),all(effects.values()),before,after]) if expected=='success' else all([loaded,discovered,proposed,rejected,all(effects.values())])
    return {'case':case['id'],'provider':case['provider'],'tool':tool,'session_id':sid,'stages':stages,'overall':'PASS' if passed else 'FAIL','expected':expected,'expected_rejection_observed':rejected,'permission_decisions':permissions,'result_checks':checks,'effect_checks':effects,'exact_callback_result_in_session':exact,'evidence':[session['messages'],'events.jsonl','fixture-responses.jsonl','raw/inventory.response.json','raw/plugins.response.json']}

def build(root):
    read=lambda p:json.loads((root/p).read_text(encoding='utf-8'))
    cases=read('cases.json');results=read('results.json');sessions=read('sessions.json')
    events=[json.loads(l) for l in (root/'events.jsonl').read_text().splitlines()]
    proposals=[json.loads(l) for l in (root/'fixture-responses.jsonl').read_text().splitlines()]
    plugins=read('raw/plugins.response.json')['body']['data']
    tools=read('raw/inventory.response.json')['body']['output']['tools']
    receipts=[]
    for case,session in zip(cases,sessions,strict=True):
        case={**case,'result_equals':{k:v.replace('${FILE_HASH}',hashlib.sha256((root/'project/README.md').read_bytes()).hexdigest()) if isinstance(v,str) else v for k,v in case.get('result_equals',{}).items()}}
        result=results.get(case['id']);effects={}
        if case.get('effect_file'):effects['file_exists']=(root/case['effect_file']).is_file()
        if case.get('absent_file'):effects['file_absent']=not (root/case['absent_file']).exists()
        if case.get('store') and result:
            artifact=at(result,case['artifact_path'])
            paths=list((root/'stores'/case['store']).rglob('*.json'))
            effects['artifact_matches_store']=any(json.loads(p.read_text())==artifact for p in paths)
        if case['provider']=='opencode-remembering' and result:
            all_json='\n'.join(p.read_text() for p in (root/'stores/memory').rglob('*.json'))
            if case['id']=='memory_setup':effects['memory_store_created']=bool(all_json)
            if case['id'] in ('memory_remember','memory_retry'):effects['record_present_in_store']=result.get('record_id','missing-id') in all_json
            if case['id']=='memory_search':effects['retrieved_marker']=bool(result.get('items')) and 'amber-finch' in json.dumps(result['items'])
        if not effects and case.get('expected')=='success':effects['session_artifact']=result is not None
        provider_loaded=case['provider']=='harness' or any(p.get('state',{}).get('status')=='active' and case['provider'] in p.get('source',{}).get('path','') for p in plugins)
        discovered=any(t['id']==case['tool'] for t in tools)
        proposed=any(p['case']==case['id'] and p['first'] for p in proposals)
        message=read(session['messages'])['body']
        receipts.append(analyze(case,session,events,message,result,provider_loaded,discovered,proposed,effects))
    identity=read('identity.json')
    output={'schema':'opencode.native_acceptance.v1','run_id':identity['run_id'],'runtime_version':'2.0.22','proposal_source':'scripted_loopback_chat_fixture','model_inference_calls':0,'scripted_transport_requests':len(proposals),'claims_excluded':['real model tool choice','model context influence','provider permission evaluation where no event occurred','full release acceptance','fresh installation','restart persistence'],'receipts':receipts}
    (root/'receipts.json').write_text(json.dumps(output,indent=2),encoding='utf-8')
    return output

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('root');a=p.parse_args();output=build(pathlib.Path(a.root))
    print(json.dumps({r['case']:{'overall':r['overall'],'checks':r['result_checks'],'effects':r['effect_checks']} for r in output['receipts']},indent=2))
    raise SystemExit(0 if all(r['overall']=='PASS' for r in output['receipts']) else 1)

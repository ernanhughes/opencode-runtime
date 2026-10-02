"""Build caller-declared inputs from canonical source fixtures, never goldens."""
import argparse,json,pathlib
def build(projects):
    cases=[]
    def add(id,provider,tool,args,**checks):cases.append(dict(id=id,provider=provider,tool=tool,args=args,**checks))
    ref=lambda p:{'$result':p}
    for effect in ['allow','deny','ask']:
        add('probe_'+effect,'harness','native_probe_'+effect,{},direct=True,expected='admission_rejection' if effect=='deny' else 'success',effect_file=f'probe-{effect}.txt' if effect!='deny' else None)
    add('builtin_write','harness','write',{'path':'${PROJECT}/permission-probe.txt','content':'native-boundary-fixture'},direct=True,expected='success',permission_reply='once',effect_file='project/permission-probe.txt')
    add('builtin_write_deny','harness','write',{'path':'${PROJECT}/deny-probe.txt','content':'must-not-write'},direct=True,expected='permission_rejection',absent_file='project/deny-probe.txt')
    add('closed_schema_min','harness','native_schema_probe',{'known':'kept','unexpected':'must-reject'},direct=True,expected='schema_rejection')
    text='Build passes. Deployment requires approval.'
    add('lens_source','opencode-lens','lens_render',{'source':{'id':'native-source','kind':'text','content':text},'purpose':'inspect build status','mode':'SOURCE'},expected='success',result_equals={'artifact.representation':text})
    add('lens_schema_reject','opencode-lens','lens_render',{'purpose':'missing required source','mode':'SOURCE'},expected='schema_rejection')
    add('relate_unknown','opencode-relate','relate',{'left_text':text,'right_text':'Focus mode batches everything into the morning digest.','left':{'id':'native-source','kind':'text'},'right':{'id':'focus-note','kind':'text'}},expected='success',result_equals={'observation.relation':'UNKNOWN'})
    add('radar_unknown','opencode-radar','radar_decide',{'id':'native-radar','task_relevance':'high','novelty':'UNKNOWN','evidential_validity':'unknown','urgency':'routine','cost':'low','note':'Caller-declared inputs; no inferred relationship or novelty.'},expected='success')
    policy=json.loads((projects/'opencode-authority/examples/policy.json').read_text())
    proposal={'proposal_id':'native-first-search','purpose':'book-travel','external_operation':{'kind':'ACT','action':'search-flights'},'data_uses':[{'source':{'id':'calendar:travel-window','kind':'calendar'},'operation':'ACCESS','necessary':True}]}
    add('authority_check','opencode-authority','authority_check',{'proposal':proposal,'policy':policy},expected='success',result_equals={'receipt.verdict':'ALLOW'})
    add('authority_approval','opencode-authority','authority_check',{'proposal':{**proposal,'external_operation':{'kind':'ACT','action':'purchase-flight'}},'policy':policy},expected='success',result_equals={'receipt.verdict':'REQUIRE_APPROVAL'})
    add('authority_metadata_reject','opencode-authority','authority_check',{'proposal':proposal,'policy':{**policy,'example_expected_rule':'Historical fixture metadata must not be admitted.'}},expected='schema_rejection')
    add('canary_allow','opencode-authority','authority_canary_write',{'marker':'wave1-canary','target':'allow.txt'},expected='success',effect_file='stores/canary/allow.txt')
    add('canary_deny','opencode-authority','authority_canary_write',{'marker':'must-not-write','target':'deny.txt','context_sources':['mailbox:all']},expected='hook_rejection',absent_file='stores/canary/deny.txt')
    add('evidence_file','opencode-evidence','evidence_file',{'path':'${PROJECT}/README.md'},expected='success',result_equals={'record.observation.file_hash':'${FILE_HASH}'},store='evidence',artifact_path='record')
    add('evidence_get','opencode-evidence','evidence_get',{'evidence_id':ref('evidence_file.record.evidence_id')},expected='success')
    claim={'statement':'The disposable README has the independently computed digest.','subject':'${PROJECT}/README.md'}
    criterion={'kind':'evidence_field','evidence_kind':'file_observation','path':'observation.file_hash','operator':'EQUALS','expected':'${FILE_HASH}'}
    add('verify_pass','opencode-verify','verify_check',{'claim':claim,'criterion':criterion,'evidence':[ref('evidence_file.record')]},expected='success',result_equals={'receipt.verdict':'PASS'},store='verify',artifact_path='receipt')
    add('verify_inconclusive','opencode-verify','verify_check',{'claim':claim,'criterion':criterion,'evidence':[]},expected='success',result_equals={'receipt.verdict':'INCONCLUSIVE'})
    add('verify_fail','opencode-verify','verify_check',{'claim':claim,'criterion':{**criterion,'expected':'0'*64},'evidence':[ref('evidence_file.record')]},expected='success',result_equals={'receipt.verdict':'FAIL'})
    add('proof_build','opencode-proof','proof_build',{'claim':ref('verify_pass.receipt.claim'),'proof_class':'EMPIRICAL','obligations':[{'description':'Recorded digest equals independently computed digest.','claim_id':ref('verify_pass.receipt.claim.claim_id'),'criterion':criterion,'evidence_ids':[ref('evidence_file.record.evidence_id')],'verification_id':ref('verify_pass.receipt.verification_id'),'required':True}],'evidence':[ref('evidence_file.record')],'verifications':[ref('verify_pass.receipt')]},expected='success',result_equals={'artifact.status':'COMPLETE'},store='proof',artifact_path='artifact')
    add('proof_replay','opencode-proof','proof_replay',{'proof_id':ref('proof_build.artifact.proof_id')},expected='success')
    add('memory_setup','opencode-remembering','memory_setup',{},expected='success')
    remember={'action':'remember','content':'Wave1 native memory marker amber-finch. Deployment requires approval.','role':'ordinary','idempotency_key':'wave1-amber-finch'}
    add('memory_remember','opencode-remembering','memory_remember',remember,expected='success',result_equals={'record.standing_ceiling':'FULL'})
    add('memory_retry','opencode-remembering','memory_remember',remember,expected='success',result_equals={'duplicate':True})
    add('memory_search','opencode-remembering','memory_search',{'query':'amber-finch','limit':3},expected='success')
    fixture=projects/'project-context-compiler/conformance/compiler-v1'
    add('compiler_compile','project-context-compiler','context_compiler_compile',{'request':(fixture/'heterogeneous-basic.request.json').read_text(),'candidates':(fixture/'heterogeneous-basic.candidates.json').read_text(),'policy':(fixture/'compiler-policy-v1.json').read_text(),'include_rendered':True},expected='success',result_equals={'ok':True,'success':True})
    return cases
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--projects',default='C:/Projects');p.add_argument('--out',required=True);a=p.parse_args()
    pathlib.Path(a.out).write_text(json.dumps(build(pathlib.Path(a.projects)),indent=2),encoding='utf-8')

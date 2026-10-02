import unittest
from receipts import analyze

class ConservativeReceipts(unittest.TestCase):
    def setUp(self):
        self.case={'id':'c','provider':'fixture','tool':'t','expected':'success'}
        self.session={'session_id':'s','messages':'raw/c-messages.response.json'}
    def check(self,events,messages,**kwargs):
        return analyze(self.case,self.session,events,messages,{},True,True,True,{'artifact':True},**kwargs)
    def test_discovery_or_before_hook_never_proves_admission(self):
        r=self.check([{'stage':'TOOL_execute.before','data':{'sessionID':'s','tool':'t'}}],{})
        self.assertEqual(r['stages']['NATIVE_ADMISSION_OBSERVED'],'UNKNOWN')
        self.assertEqual(r['overall'],'FAIL')
    def test_callback_without_session_result_is_not_pass(self):
        es=[{'stage':s,'data':{'sessionID':'s','tool':'t','result':{'content':'artifact'}}} for s in ['TOOL_execute.before','CALLBACK_ENTERED','CALLBACK_RETURNED','TOOL_execute.after']]
        r=self.check(es,{})
        self.assertEqual(r['stages']['RESULT_RETURNED'],'UNKNOWN');self.assertEqual(r['overall'],'FAIL')
    def test_permission_is_unknown_without_evaluation(self):
        es=[{'stage':s,'data':{'sessionID':'s','tool':'t','result':{'content':'artifact'}}} for s in ['TOOL_execute.before','CALLBACK_ENTERED','CALLBACK_RETURNED','TOOL_execute.after']]
        r=self.check(es,{'data':[{'content':[{'state':{'content':[{'type':'text','text':'artifact'}]}}]}]})
        self.assertEqual(r['overall'],'PASS');self.assertEqual(r['stages']['PERMISSION_DECISION_OBSERVED'],'UNKNOWN')
    def test_expected_schema_rejection_does_not_promote_admission(self):
        self.case['expected']='schema_rejection'
        r=self.check([],{'data':[{'content':[{'state':{'content':[{'type':'text','text':'Invalid arguments for tool "t"'}]}}]}]})
        self.assertTrue(r['expected_rejection_observed']);self.assertEqual(r['stages']['NATIVE_ADMISSION_OBSERVED'],'FAIL')
    def test_other_session_callback_does_not_count(self):
        r=self.check([{'stage':'CALLBACK_ENTERED','data':{'sessionID':'another','tool':'t'}}],{})
        self.assertEqual(r['stages']['CALLBACK_ENTERED'],'UNKNOWN')
    def test_native_permission_error_is_a_decision_without_a_hook_claim(self):
        self.case['expected']='permission_rejection'
        r=self.check([{'stage':'CALLBACK_ENTERED','data':{'sessionID':'s','tool':'t'}}],{'data':[{'content':[{'state':{'error':{'type':'permission.rejected','message':'Permission denied: edit'}}}]}]})
        self.assertEqual(r['overall'],'PASS');self.assertEqual(r['permission_decisions'][0]['source'],'session_permission_error')

if __name__=='__main__':unittest.main()

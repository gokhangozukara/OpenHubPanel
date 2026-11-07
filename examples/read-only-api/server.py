"""Independent read-only OpenHubPanel 1.0 example using Python's standard library."""
import hmac,json,os,uuid
from http.server import BaseHTTPRequestHandler,HTTPServer
token=os.environ.get('API_TOKEN','')
if len(token)<32:raise ValueError('API_TOKEN must have at least 32 random characters')
manifest={'id':'python-content-example','name':'Python read-only example','contractVersion':'1.0','resources':[{'id':'articles','name':'Articles','capabilities':['list','read']}]}
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def reply(self,status,value):
  if 'error' in value:value={'error':{'code':value['error']['code'],'message':'The request could not be completed.','requestId':str(uuid.uuid4())}}
  data=json.dumps(value).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','private, no-store');self.end_headers();self.wfile.write(data)
 def do_GET(self):
  if not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+token):return self.reply(401,{'error':{'code':'UNAUTHORIZED'}})
  route=self.path.removeprefix('/hubpanel/v1')
  if route=='/health':return self.reply(200,{'status':'ok','contractVersion':'1.0'})
  if route=='/manifest':return self.reply(200,manifest)
  article={'id':'welcome','title':'Independent read-only service','status':'published','version':1}
  if route=='/articles':return self.reply(200,{'items':[article]})
  if route=='/articles/welcome':return self.reply(200,article)
  self.reply(404,{'error':{'code':'NOT_FOUND'}})
 def do_PATCH(self):self.reply(405,{'error':{'code':'READ_ONLY'}})
HTTPServer(('127.0.0.1',int(os.environ.get('PORT','3902'))),Handler).serve_forever()

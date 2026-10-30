import subprocess, os, urllib.request, urllib.error, time, json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
if (ROOT/'wanwan').is_dir(): ROOT=ROOT/'wanwan'
port='18765';token='test-'+('a'*26)
env={**os.environ,'PORT':port,'WANWAN_ADMIN_TOKEN':token}
proc=subprocess.Popen(['node','server.js'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
base='http://127.0.0.1:'+port

def check(path,method='GET',body=None,headers=None):
    req=urllib.request.Request(base+path,data=body,headers=headers or {},method=method)
    try:
        with urllib.request.urlopen(req,timeout=8) as r:return r.status
    except urllib.error.HTTPError as e:return e.code
try:
    for _ in range(50):
        try:
            if check('/')==200:break
        except Exception:time.sleep(.1)
    else:raise RuntimeError('server failed to start')
    tests={
      'entry_html':check('/'),
      'local_dexie':check('/js/dexie.min.js'),
      'static_server_source_denied':check('/server.js'),
      'hidden_path_denied':check('/.gitignore'),
      'encoded_traversal_denied':check('/%2e%2e/%2e%2e/etc/passwd'),
      'bad_escape_rejected':check('/%Z1'),
      'admin_required':check('/api/memory/sync','POST',b'{}',{'Content-Type':'application/json'}),
      'foreign_origin_rejected':check('/api/memory/sync','POST',b'{}',{'Origin':'https://evil.invalid','x-wanwan-admin-token':token}),
      'admin_route_reaches_optional_bridge':check('/api/memory/sync','POST',b'{}',{'x-wanwan-admin-token':token}),
      'empty_cookie_no_write':check('/api/music-cookie','POST',b'{"cookie":""}',{'x-wanwan-admin-token':token})
    }
    expected=[200,200,403,403,403,400,401,403,502,400]
    assert list(tests.values())==expected,(tests,expected)
    print(json.dumps(tests,ensure_ascii=False))
finally:
    proc.terminate()
    try:proc.wait(timeout=5)
    except subprocess.TimeoutExpired:proc.kill()

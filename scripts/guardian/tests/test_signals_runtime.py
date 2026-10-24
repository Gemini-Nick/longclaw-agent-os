"""Real shell supervisor with temporary mock workers; never touches launchd/services."""
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time
import unittest

SCRIPT = Path(__file__).resolve().parents[3] / 'apps/runtime/bin/signals-runtime.sh'


class SignalsRuntimeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.pids = self.root / 'pids'
        (self.root/'scripts').mkdir()
        self.preflight=self.root/'scripts/python.sh'
        self.preflight.write_text('#!/bin/bash\nexit 0\n')
        self.worker = self.root / 'worker.sh'
        self.worker.write_text('#!/bin/bash\ntrap "exit 0" TERM INT\nprintf "%s %s\\n" "$$" "${SIGNALS_RUNTIME_STARTUP_PROFILE:-normal}" >>"$MOCK_STARTS"\nwhile true; do sleep 1; done\n')
        self.worker.chmod(0o755)
        self.env = {**os.environ, 'LONGCLAW_SIGNALS_REPO_ROOT':str(self.root),'LONGCLAW_LOG_DIR':str(self.root/'logs'), 'LONGCLAW_PID_DIR':str(self.pids), 'SIGNALS_WEB_SCRIPT':str(self.worker), 'SIGNALS_SYNC_SCRIPT':str(self.worker), 'SIGNALS_POSTMARKET_SCRIPT':str(self.worker), 'MOCK_STARTS':str(self.root/'starts'), 'SIGNALS_RUNTIME_START_LANES':'true', 'SIGNALS_RUNTIME_START_POSTMARKET':'true', 'SIGNALS_RUNTIME_START_SYNC':'false'}
        self.supervisor = None

    def tearDown(self):
        if self.supervisor is not None:
            if self.supervisor.poll() is None:
                os.killpg(self.supervisor.pid, signal.SIGTERM)
            try:
                self.supervisor.wait(timeout=8)
            except subprocess.TimeoutExpired:
                os.killpg(self.supervisor.pid, signal.SIGKILL)
                self.supervisor.wait(timeout=3)
        self.tmp.cleanup()

    def wait_for(self, condition, timeout=10):
        deadline=time.monotonic()+timeout
        while time.monotonic()<deadline:
            if condition(): return
            time.sleep(.05)
        self.fail('condition did not become true')

    def start(self):
        self.supervisor = subprocess.Popen(['bash',str(SCRIPT)], env=self.env, start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.wait_for(lambda:len(list(self.pids.glob('signals-*.pid')))==7)
        self.wait_for(lambda:(self.root/'starts').exists() and len((self.root/'starts').read_text().splitlines())==6)

    def snapshot(self):
        return {p.name:p.read_text() for p in self.pids.glob('signals-*.pid')}

    def test_restart_web_preserves_other_workers(self):
        self.start()
        before=self.snapshot()
        result=subprocess.run(['bash',str(SCRIPT),'restart-child','web'],env=self.env,text=True,capture_output=True,timeout=15)
        self.assertEqual(result.returncode,0,result.stderr)
        after=self.snapshot()
        self.assertNotEqual(before['signals-web.pid'],after['signals-web.pid'])
        for key in before:
            if key!='signals-web.pid': self.assertEqual(before[key],after[key],key)
        self.assertIsNone(self.supervisor.poll())
        self.wait_for(lambda:len((self.root/'starts').read_text().splitlines())==7)
        self.assertTrue((self.root/'starts').read_text().splitlines()[-1].endswith(' bounded_readonly'))

    def test_missing_bounded_protocol_does_not_stop_web(self):
        self.start()
        before=self.snapshot()
        self.preflight.write_text('#!/bin/bash\nexit 1\n')
        r=subprocess.run(['bash',str(SCRIPT),'restart-web'],env=self.env,capture_output=True,timeout=5)
        self.assertEqual(r.returncode,2)
        self.assertEqual(before,self.snapshot())
        self.assertIsNone(self.supervisor.poll())

    def test_unsupported_or_stale_supervisor_refused(self):
        r=subprocess.run(['bash',str(SCRIPT),'restart-web'],env=self.env,capture_output=True)
        self.assertEqual(r.returncode,2)
        (self.pids/'signals-runtime-control.pid').write_text(f'{os.getpid()}\ninvalid-start-time\n')
        r=subprocess.run(['bash',str(SCRIPT),'restart-web'],env=self.env,capture_output=True)
        self.assertEqual(r.returncode,2)

    def test_unexpected_child_exit_still_stops_supervisor(self):
        self.start()
        pid=int((self.pids/'signals-lane-quote_lane.pid').read_text())
        os.kill(pid,signal.SIGTERM)
        self.supervisor.wait(timeout=12)
        self.assertEqual(self.supervisor.returncode,1)


if __name__=='__main__': unittest.main()

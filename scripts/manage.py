#!/usr/bin/env python3
"""macOS project-local installer and launchd lifecycle controller."""
import argparse, fcntl, hashlib, json, os, platform, plistlib, shutil, socket
import subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source'
RUNTIME = ROOT / '.runtime'
NODE = RUNTIME / 'node' / 'bin' / 'node'
NPM = RUNTIME / 'node' / 'lib' / 'node_modules' / 'npm' / 'bin' / 'npm-cli.js'
LOGS = ROOT / 'logs'
VERSION = '24.21.0'
CHECKSUMS = {
    'arm64': 'bed7eea5325e1108f32ce5228ddd6a5f0f08a499ee42aa7442aea583702f6057',
    'x86_64': '1462cb3b3046b815cf8ea436d3da450ec1a9f11dac7e5a46b0ada5305d7e8097',
}
LABEL = 'local.gods-eye-view.' + hashlib.sha256(str(ROOT).encode()).hexdigest()[:12]
SERVICE = 'gui/%s/%s' % (os.getuid(), LABEL)
URL = 'http://127.0.0.1:4173'

def run(args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, **kwargs)

def loaded():
    return subprocess.run(['launchctl', 'print', SERVICE], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode == 0

def healthy():
    try:
        with urllib.request.urlopen(URL + '/api/setup/status', timeout=2) as response:
            return response.status == 200 and 'application/json' in response.headers.get('Content-Type', '')
    except (OSError, urllib.error.URLError):
        return False

def stop():
    if loaded():
        run(['launchctl', 'bootout', SERVICE])
        for _ in range(50):
            if not loaded(): break
            time.sleep(.1)
        if loaded(): raise RuntimeError('服務停止逾時；未移除任何安裝檔。')
        print('已停止本專案服務。', flush=True)
    else:
        print('本專案未啟動。', flush=True)

def install_node():
    machine = platform.machine()
    if platform.system() != 'Darwin' or machine not in CHECKSUMS:
        raise RuntimeError('此腳本支援 Apple Silicon 與 Intel macOS。')
    if NODE.exists():
        version = subprocess.check_output([str(NODE), '--version'], text=True).strip()
        if version == 'v' + VERSION: return
    RUNTIME.mkdir(exist_ok=True)
    arch = 'arm64' if machine == 'arm64' else 'x64'
    name = f'node-v{VERSION}-darwin-{arch}'
    archive = RUNTIME / (name + '.tar.gz')
    print('下載並驗證專案專用 Node.js ' + VERSION, flush=True)
    run(['curl', '--fail', '--location', '--retry', '3', '--connect-timeout', '20',
         '--max-time', '300', 'https://nodejs.org/dist/v' + VERSION + '/' + archive.name,
         '-o', archive])
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest != CHECKSUMS[machine]:
        archive.unlink()
        raise RuntimeError('Node.js SHA-256 不符，已中止。')
    run(['tar', '-xzf', archive, '-C', RUNTIME])
    if NODE.parent.parent.exists(): shutil.rmtree(NODE.parent.parent)
    (RUNTIME / name).rename(RUNTIME / 'node')
    archive.unlink()

def npm(*args):
    env = dict(os.environ)
    env['PATH'] = str(NODE.parent) + os.pathsep + env.get('PATH', '')
    env['PUPPETEER_SKIP_DOWNLOAD'] = 'true'
    # Avoid inheriting production-only npm settings that omit Vite.
    run([NODE, NPM, *args], cwd=SOURCE, env=env)

def start(open_browser=True):
    if not NODE.exists() or not (SOURCE / 'node_modules/vite/bin/vite.js').exists():
        raise RuntimeError('尚未部署；請先執行 01-一鍵部署.command。')
    if loaded():
        if not healthy():
            raise RuntimeError('服務已載入但未就緒；請查看 logs/server.log，或先停止後重啟。')
        print('服務已啟動：' + URL, flush=True)
    else:
        with socket.socket() as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try: sock.bind(('127.0.0.1', 4173))
            except OSError: raise RuntimeError('4173 埠已被其他程式占用；未停止其他服務。')
        LOGS.mkdir(exist_ok=True)
        RUNTIME.mkdir(exist_ok=True)
        config = {
            'Label': LABEL,
            'ProgramArguments': [str(NODE), str(SOURCE / 'node_modules/vite/bin/vite.js'),
                                 '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
            'WorkingDirectory': str(SOURCE),
            'EnvironmentVariables': {
                'PATH': str(NODE.parent) + ':/usr/bin:/bin:/usr/sbin:/sbin',
                'HOST': '127.0.0.1', 'PORT': '4173',
            },
            'RunAtLoad': True,
            'StandardOutPath': str(LOGS / 'server.log'),
            'StandardErrorPath': str(LOGS / 'server.log'),
        }
        plist = RUNTIME / 'service.plist'
        plist.write_bytes(plistlib.dumps(config))
        run(['launchctl', 'bootstrap', 'gui/%s' % os.getuid(), plist])
        for _ in range(60):
            if healthy(): break
            time.sleep(1)
        else:
            stop()
            raise RuntimeError('啟動逾時；請查看 logs/server.log。')
        print('已啟動：' + URL, flush=True)
    if open_browser: run(['open', URL])

def deploy(open_browser=True):
    if not (SOURCE / 'package-lock.json').exists():
        raise RuntimeError('找不到 source/package-lock.json。')
    stop()
    install_node()
    print('依鎖定版本安裝依賴…', flush=True)
    npm('ci', '--include=dev', '--no-audit', '--no-fund')
    print('驗證建置…', flush=True)
    npm('run', 'build')
    start(open_browser)

def uninstall():
    stop()
    # Fixed generated targets only. Source, reports, .env and evidence survive.
    for target in [SOURCE / 'node_modules', SOURCE / 'dist', RUNTIME, LOGS]:
        if target.is_symlink(): target.unlink()
        elif target.exists(): shutil.rmtree(target)
    print('已移除專用 Node.js、依賴、建置與執行日誌。原始碼、報告及 API 設定保留。', flush=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['deploy','start','stop','uninstall','status'])
    parser.add_argument('--no-open', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    with (ROOT / '.launcher.lock').open('a') as lock:
        try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise RuntimeError('另一個部署／管理程序正在執行，請稍後再試。')
        if args.action == 'deploy': deploy(not args.no_open)
        elif args.action == 'start': start(not args.no_open)
        elif args.action == 'stop': stop()
        elif args.action == 'uninstall': uninstall()
        else:
            active = loaded()
            print(json.dumps({'loaded': active, 'ready': active and healthy(), 'url': URL,
                              'installed': NODE.exists(), 'service': SERVICE}, ensure_ascii=False))

if __name__ == '__main__':
    try: main()
    except (RuntimeError, OSError, subprocess.CalledProcessError) as exc:
        print('錯誤：' + str(exc), file=sys.stderr)
        sys.exit(1)

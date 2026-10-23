#!/usr/bin/env python3
"""
GitHub API 推送脚本
使用 Python urllib 代替 wget/curl，完整实现 Git Blobs API 流程
"""

import os
import json
import base64
import urllib.request
import urllib.error
import sys

# 配置
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO = "cxy242/draw-guess-game"
BRANCH = "main"
SOURCE_DIR = "/opt/wanwan/"
API_BASE = "https://api.github.com"

# 排除的文件/目录
EXCLUDE = {".git", "__pycache__", ".pyc", "wanwan.apk"}


def api_request(method, url, data=None):
    """发送 GitHub API 请求"""
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Python-GitHub-Pusher"
    }

    if data:
        headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method=method)
    else:
        req = urllib.request.Request(url, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"API Error {e.code}: {e.reason}")
        print(e.read().decode())
        sys.exit(1)


def get_file_sha(path):
    """获取文件的 git blob SHA（用于判断是否需要更新）"""
    import hashlib
    with open(path, "rb") as f:
        content = f.read()
    header = f"blob {len(content)}\0".encode()
    return hashlib.sha1(header + content).hexdigest()


def should_exclude(filepath):
    """检查是否应该排除"""
    name = os.path.basename(filepath)
    return name in EXCLUDE


def collect_files(directory):
    """收集目录下所有文件"""
    files = []
    for root, dirs, filenames in os.walk(directory):
        # 排除 .git 等目录
        dirs[:] = [d for d in dirs if d not in EXCLUDE]
        for filename in filenames:
            if should_exclude(filename):
                continue
            filepath = os.path.join(root, filename)
            relpath = os.path.relpath(filepath, SOURCE_DIR)
            files.append((relpath, filepath))
    return files


def main():
    if not GITHUB_TOKEN:
        print("错误: 请设置环境变量 GITHUB_TOKEN")
        print("  export GITHUB_TOKEN=your_token_here")
        sys.exit(1)

    print(f"=== GitHub API 推送工具 ===")
    print(f"仓库: {REPO}")
    print(f"分支: {BRANCH}")
    print(f"源目录: {SOURCE_DIR}")

    # 1. 获取当前 ref
    print("\n[1/6] 获取当前 ref...")
    ref_url = f"{API_BASE}/repos/{REPO}/git/refs/heads/{BRANCH}"
    try:
        ref_data = api_request("GET", ref_url)
        latest_commit_sha = ref_data["object"]["sha"]
        print(f"  当前 HEAD: {latest_commit_sha[:8]}")
    except SystemExit:
        print(f"  分支 {BRANCH} 不存在，将创建新分支...")
        latest_commit_sha = None

    # 2. 获取当前 commit（如果存在）
    tree_sha = None
    if latest_commit_sha:
        print("\n[2/6] 获取当前 commit...")
        commit_url = f"{API_BASE}/repos/{REPO}/git/commits/{latest_commit_sha}"
        commit_data = api_request("GET", commit_url)
        tree_sha = commit_data["tree"]["sha"]
        print(f"  当前 tree: {tree_sha[:8]}")
    else:
        print("\n[2/6] 跳过（新分支）")

    # 3. 收集并上传文件
    print("\n[3/6] 收集文件...")
    files = collect_files(SOURCE_DIR)
    print(f"  找到 {len(files)} 个文件")

    print("\n[4/6] 上传文件 blob...")
    base_tree = []
    for i, (relpath, filepath) in enumerate(files, 1):
        print(f"  [{i}/{len(files)}] {relpath}")

        # 读取文件内容
        with open(filepath, "rb") as f:
            content = f.read()

        # 判断是否为二进制文件
        is_binary = b"\x00" in content[:8192]

        # 创建 blob
        blob_data = {
            "content": base64.b64encode(content).decode() if is_binary else content.decode("utf-8", errors="replace"),
            "encoding": "base64" if is_binary else "utf-8"
        }
        blob_url = f"{API_BASE}/repos/{REPO}/git/blobs"
        blob_result = api_request("POST", blob_url, blob_data)

        base_tree.append({
            "path": relpath,
            "mode": "100644",
            "type": "blob",
            "sha": blob_result["sha"]
        })

    # 4. 创建新 tree
    print("\n[5/6] 创建新 tree...")
    tree_data = {"base_tree": tree_sha, "tree": base_tree}
    tree_url = f"{API_BASE}/repos/{REPO}/git/trees"
    new_tree = api_request("POST", tree_url, tree_data)
    print(f"  新 tree: {new_tree['sha'][:8]}")

    # 5. 创建 commit
    print("\n[6/6] 创建 commit...")
    commit_data = {
        "message": f"Update files from push_github.py",
        "tree": new_tree["sha"],
        "parents": [latest_commit_sha] if latest_commit_sha else []
    }
    commit_url = f"{API_BASE}/repos/{REPO}/git/commits"
    new_commit = api_request("POST", commit_url, commit_data)
    print(f"  新 commit: {new_commit['sha'][:8]}")

    # 6. 更新 ref
    if latest_commit_sha:
        # PATCH 更新现有 ref
        print("\n更新 ref...")
        ref_data = {"sha": new_commit["sha"], "force": True}
        api_request("PATCH", ref_url, ref_data)
    else:
        # POST 创建新 ref
        print("\n创建 ref...")
        ref_data = {"ref": f"refs/heads/{BRANCH}", "sha": new_commit["sha"]}
        api_request("POST", f"{API_BASE}/repos/{REPO}/git/refs", ref_data)

    print(f"\n✅ 推送成功！")
    print(f"   https://github.com/{REPO}/tree/{BRANCH}")


if __name__ == "__main__":
    main()

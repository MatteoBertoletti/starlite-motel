#!/usr/bin/env bash
# ffmpeg without depending on a healthy apt mirror: use the runner's copy if there is one,
# else apt with a hard time limit, else a static build.
set -u
if command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null; then ffmpeg -version | head -1; exit 0; fi
A="-o DPkg::Lock::Timeout=120 -o Acquire::Retries=2 -o Acquire::http::Timeout=20"
if timeout 240 sudo apt-get $A install -y -qq ffmpeg; then ffmpeg -version | head -1; exit 0; fi
echo "apt failed, using a static ffmpeg build"
cd /tmp && curl -fsSL --retry 3 -o ff.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
  && tar -xf ff.tar.xz && sudo cp ffmpeg-*-amd64-static/ffmpeg ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ && ffmpeg -version | head -1

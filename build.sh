#!/bin/bash
# index.html は Artifact として公開するための断片で、doctype も head も持たない。
# GitHub Pages など素のウェブサーバーに置くときは、同じスケルトンで包んで
# 単体のページにする必要があるので、ここで dist/ を組み立てる。
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist
mkdir -p dist
cat tools/page-head.html index.html tools/page-tail.html > dist/index.html
cp geometry.js dist/geometry.js

echo "dist/index.html  $(wc -c < dist/index.html | tr -d ' ') bytes"
echo "dist/geometry.js $(wc -c < dist/geometry.js | tr -d ' ') bytes"

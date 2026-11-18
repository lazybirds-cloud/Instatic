#!/bin/sh
set -eu
cd /tmp
echo "[1/7] download crane"
bun -e '
const r = await fetch("https://api.github.com/repos/google/go-containerregistry/releases/latest");
const rel = await r.json();
const asset = rel.assets.find(a => a.name.endsWith("Linux_arm64.tar.gz"));
if (!asset) throw new Error("no linux arm64 asset");
await Bun.write("/tmp/go-containerregistry.tgz", await (await fetch(asset.browser_download_url)).arrayBuffer());
console.log("crane:", asset.name);
'
tar xzf go-containerregistry.tgz crane && chmod +x crane
echo "[2/7] fetch repo tarball"
bun -e '
const r = await fetch("https://github.com/lazybirds-cloud/Instatic/archive/refs/heads/main.tar.gz");
if (!r.ok) throw new Error("repo tarball: " + r.status);
await Bun.write("/tmp/main.tar.gz", await r.arrayBuffer());
'
tar xzf main.tar.gz
cd Instatic-main
echo "[3/7] install + build (arm64 native)"
bun install --frozen-lockfile
bun run build
echo "[4/7] prod deps"
rm -rf node_modules
bun install --frozen-lockfile --production
echo "[5/7] split layers"
# disjoint layer tars so each registry PATCH stays small (gateway 504s big uploads)
rm -rf /tmp/split
mkdir -p /tmp/split/l1/app/node_modules /tmp/split/l2/app/node_modules/@modelcontextprotocol /tmp/split/l3/app/node_modules /tmp/split/l4/app/node_modules /tmp/split/l5/app
mv node_modules/@img /tmp/split/l1/app/node_modules/ 2>/dev/null || true
mv node_modules/@modelcontextprotocol /tmp/split/l2/app/node_modules/ 2>/dev/null || true
mv node_modules/happy-dom node_modules/jsdom node_modules/@tiptap /tmp/split/l3/app/node_modules/ 2>/dev/null || true
find node_modules -mindepth 1 -maxdepth 1 -exec mv {} /tmp/split/l4/app/node_modules/ \; 2>/dev/null || true
mv dist /tmp/split/l5/app/dist
cp -R server /tmp/split/l5/app/server
cp -R src /tmp/split/l5/app/src
cp package.json bun.lock /tmp/split/l5/app/
cp tsconfig*.json /tmp/split/l5/app/ 2>/dev/null || true
mkdir -p /tmp/split/l5/app/uploads /tmp/split/l5/app/data
for f in l1 l2 l3 l4 l5; do
  tar czf /tmp/layer-$f.tgz --owner 1000 --group 1000 -C /tmp/split/$f app
done
ls -la /tmp/layer-*.tgz
echo "[6/7] auth"
RUSER=$(grep -A3 'auth:' /etc/rancher/k3s/registries.yaml | grep 'username:' | head -1 | sed 's/.*username: *//' | tr -d '"' | tr -d "'")
RPASS=$(grep -A3 'auth:' /etc/rancher/k3s/registries.yaml | grep 'password:' | head -1 | sed 's/.*password: *//' | tr -d '"' | tr -d "'")
if [ -z "$RUSER" ] || [ -z "$RPASS" ]; then echo "no registry creds found in registries.yaml"; exit 3; fi
export HOME=/tmp
crane auth login registry-direct.lazybirds.cloud -u "$RUSER" -p "$RPASS"
echo "[7/7] append layers + config"
crane append -b oven/bun:1.4.2 \
  -f /tmp/layer-l1.tgz -f /tmp/layer-l2.tgz -f /tmp/layer-l3.tgz -f /tmp/layer-l4.tgz -f /tmp/layer-l5.tgz \
  -t registry-direct.lazybirds.cloud/lazybirds/instatic:v0.0.27-sitedata
crane mutate registry-direct.lazybirds.cloud/lazybirds/instatic:v0.0.27-sitedata \
  --entrypoint /usr/local/bin/bun \
  --cmd bun,run,server/index.ts \
  --user bun \
  --workdir /app \
  --env NODE_ENV=production \
  --env PORT=3001 \
  --env STATIC_DIR=/app/dist \
  --env UPLOADS_DIR=/app/uploads \
  -t registry-direct.lazybirds.cloud/lazybirds/instatic:v0.0.27-sitedata
echo IMAGE_OK

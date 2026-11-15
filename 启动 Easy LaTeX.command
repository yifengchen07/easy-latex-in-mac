#!/bin/zsh
set -eu

cd -- "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
tex_bin="${EASY_LATEX_TEX_BIN:-/Library/TeX/texbin}"

node_bin=$(command -v node || true)
if [[ -z "$node_bin" ]] || ! "$node_bin" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  print -u2 "请安装 Node.js 22 或更高版本，再打开此文件。"
  exit 1
fi

for tool in latex xelatex dvisvgm; do
  if [[ ! -x "$tex_bin/$tool" ]]; then
    print -u2 "在 $tex_bin 找不到 $tool。请安装完整的 MacTeX。"
    exit 1
  fi
done

target="$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef"
mkdir -p "$target"
if ! cmp -s manifest.xml "$target/EasyLaTeX.xml"; then
  install -m 644 manifest.xml "$target/EasyLaTeX.xml"
  print "已为当前用户安装 Easy LaTeX。若菜单未出现，请重新打开 Word。"
fi

print "在 Word 选择「开始 → 加载项 → 开发人员加载项 → Easy LaTeX」。"
print "使用期间请保留此窗口。按 Control+C 停止排版服务。"
exec "$node_bin" server.mjs

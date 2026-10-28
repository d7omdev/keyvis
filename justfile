# gtk4-layer-shell must be preloaded before GTK touches Wayland
gjs := "LD_PRELOAD=libgtk4-layer-shell.so gjs -m dist/main.js"

default:
    @just --list

build:
    bun install
    bun run esbuild.js

run *args: build
    {{gjs}} {{args}}

# Rebuilds and restarts on every change in src/ (needs entr)
dev *args:
    bun install
    find src -name '*.ts' ! -name '*.test.ts' | entr -r sh -c 'bun run esbuild.js && {{gjs}} --debug {{args}}'

test:
    bun test src

install:
    ./install.sh

uninstall:
    ./uninstall.sh

import Gtk from "gi://Gtk?version=4.0";
import Gdk from "gi://Gdk?version=4.0";
import GLib from "gi://GLib";
import { DEBUG, debug, fail } from "./cli";
import { keyIcon, keyText, type Group } from "./keys";
import { anchorsOf, savePlacement, type Placement } from "./placement";

const CLEAR_TIMEOUT = 1500;
const FADE_TIMEOUT = 300;

// gtk4-layer-shell needs LD_PRELOAD=libgtk4-layer-shell.so (set by the launcher);
// without it, or on compositors without layer-shell (GNOME), we fall back to a plain window.
const LAYER_SHELL_GIR: string = "gi://Gtk4LayerShell?version=1.0";
let LayerShell: any = null;
try {
    LayerShell = (await import(LAYER_SHELL_GIR)).default;
} catch (e: any) {
    debug("INFO", `gtk4-layer-shell unavailable: ${e.message}`);
}

const CSS = `
    window {
        background: transparent;
        opacity: 0;
        transition: opacity ${FADE_TIMEOUT}ms ease-out;
    }
    window.shown { opacity: 1; }

    .bar {
        background-color: rgba(20, 20, 23, 0.9);
        border-radius: 10px;
        padding: 7px 9px 10px;
    }
    window.debug .bar { background-color: #BDAC89; }
    window.dragging .bar { box-shadow: inset 0 0 0 1px #71717a; }

    .keycap {
        min-width: 26px;
        min-height: 26px;
        padding: 0 8px 3px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background-image: linear-gradient(to bottom, #38383e, #2c2c31);
        box-shadow:
            inset 0 1px rgba(255, 255, 255, 0.08),
            inset 0 -3px rgba(0, 0, 0, 0.45),
            0 2px 3px rgba(0, 0, 0, 0.6);
        color: #e4e4e7;
        font-family: "Rubik", "Geist", "Inter", "Symbols Nerd Font", sans-serif;
        font-size: 15px;
        font-weight: 500;
    }
    .keycap.icon {
        font-family: "Symbols Nerd Font";
        font-size: 17px;
    }

    .plus {
        color: #e4e4e7;
        font-size: 18px;
        font-weight: 700;
        margin: 0 1px 3px;
    }
    window.debug .plus { color: #18181b; }
`;

export class KeyOverlay {
    #window: Gtk.Window;
    #bar = new Gtk.Box({ spacing: 10, css_classes: ["bar"] });
    #placement: Placement;
    #isLayer = false;
    #pointerInside = false;
    #onCleared: () => void;
    #clearTimeout: number | null = null;
    #fadeTimeout: number | null = null;

    constructor(app: Gtk.Application, placement: Placement, onCleared: () => void) {
        this.#placement = placement;
        this.#onCleared = onCleared;

        const display = Gdk.Display.get_default();
        if (!display) fail("failed to get display");
        const css = new Gtk.CssProvider();
        css.load_from_data(CSS, -1);
        Gtk.StyleContext.add_provider_for_display(
            display,
            css,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        );

        this.#window = new Gtk.Window({
            application: app,
            title: "Key Visualizer",
            decorated: false,
            resizable: false,
        });
        if (DEBUG) this.#window.add_css_class("debug");
        this.#window.set_child(this.#bar);
        this.#window.set_cursor_from_name("grab");

        if (LayerShell?.is_supported()) {
            LayerShell.init_for_window(this.#window);
            LayerShell.set_namespace(this.#window, "keyvis");
            LayerShell.set_layer(this.#window, LayerShell.Layer.OVERLAY);
            LayerShell.set_keyboard_mode(this.#window, LayerShell.KeyboardMode.NONE);
            // Margins count from the real screen edge, not from the edge of bars like waybar.
            LayerShell.set_exclusive_zone(this.#window, -1);
            this.#isLayer = true;
            this.#applyPlacement();
        } else {
            debug("INFO", "Layer shell not supported, using a regular window");
        }

        this.#setupPointer();
    }

    display(groups: readonly Group[]): void {
        this.#render(groups);
        this.#reveal();
        if (!this.#pointerInside) this.#startClearTimeout();
    }

    #render(groups: readonly Group[]): void {
        for (let child = this.#bar.get_first_child(); child; child = this.#bar.get_first_child()) {
            this.#bar.remove(child);
        }
        for (const group of groups) {
            const box = new Gtk.Box({ spacing: 4, valign: Gtk.Align.CENTER });
            group.forEach((key, i) => {
                if (i > 0) box.append(new Gtk.Label({ label: "+", css_classes: ["plus"] }));
                const icon = keyIcon(key);
                box.append(
                    new Gtk.Label({
                        label: icon ?? keyText(key),
                        css_classes: icon ? ["keycap", "icon"] : ["keycap"],
                    }),
                );
            });
            this.#bar.append(box);
        }
    }

    #reveal(): void {
        this.#cancelTimeouts();
        this.#window.set_visible(true);
        this.#window.add_css_class("shown");
    }

    #applyPlacement(): void {
        const { Edge } = LayerShell;
        const anchors = anchorsOf(this.#placement.position);
        const { marginX, marginY } = this.#placement;
        const edges: [number, boolean, number][] = [
            [Edge.LEFT, anchors.left, marginX],
            [Edge.RIGHT, anchors.right, marginX],
            [Edge.TOP, anchors.top, marginY],
            [Edge.BOTTOM, anchors.bottom, marginY],
        ];
        for (const [edge, anchored, margin] of edges) {
            LayerShell.set_anchor(this.#window, edge, anchored);
            LayerShell.set_margin(this.#window, edge, anchored ? margin : 0);
        }
    }

    // Drag offsets are relative to the grab point inside the surface, and the surface moves with
    // each update, so every offset is only the movement not yet applied: add it, don't replace.
    #setupPointer(): void {
        const drag = new Gtk.GestureDrag();

        drag.connect("drag-begin", (_gesture, x, y) => {
            if (this.#isLayer) {
                this.#window.add_css_class("dragging");
                return;
            }
            const toplevel = this.#window.get_surface() as Gdk.Toplevel | null;
            const device = drag.get_current_event_device();
            if (toplevel && device) {
                toplevel.begin_move(device, drag.get_current_button(), x, y, drag.get_current_event_time());
            }
        });

        drag.connect("drag-update", (_gesture, dx, dy) => {
            if (!this.#isLayer) return;
            const anchors = anchorsOf(this.#placement.position);
            const moveX = anchors.left ? dx : anchors.right ? -dx : 0;
            const moveY = anchors.top ? dy : anchors.bottom ? -dy : 0;
            this.#placement = {
                ...this.#placement,
                marginX: Math.max(0, Math.round(this.#placement.marginX + moveX)),
                marginY: Math.max(0, Math.round(this.#placement.marginY + moveY)),
            };
            this.#applyPlacement();
        });

        drag.connect("drag-end", () => {
            if (!this.#isLayer) return;
            this.#window.remove_css_class("dragging");
            savePlacement(this.#placement);
        });

        const hover = new Gtk.EventControllerMotion();
        hover.connect("enter", () => {
            this.#pointerInside = true;
            this.#reveal();
        });
        hover.connect("leave", () => {
            this.#pointerInside = false;
            this.#startClearTimeout();
        });

        this.#window.add_controller(drag);
        this.#window.add_controller(hover);
    }

    #cancelTimeouts(): void {
        if (this.#clearTimeout) GLib.source_remove(this.#clearTimeout);
        if (this.#fadeTimeout) GLib.source_remove(this.#fadeTimeout);
        this.#clearTimeout = null;
        this.#fadeTimeout = null;
    }

    // Fade out first, then unmap: an invisible-but-mapped surface would still eat clicks.
    #startClearTimeout(): void {
        this.#cancelTimeouts();
        this.#clearTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CLEAR_TIMEOUT, () => {
            this.#clearTimeout = null;
            this.#onCleared();
            this.#window.remove_css_class("shown");
            this.#fadeTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, FADE_TIMEOUT, () => {
                this.#fadeTimeout = null;
                this.#window.set_visible(false);
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        });
    }
}

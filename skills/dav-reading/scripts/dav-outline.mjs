// Generated from apps/vscode/src/skill/outlineEntry.ts. Do not edit.
import { readFileSync as e } from "node:fs";
// src/model/types.ts
var t = /* @__PURE__ */ "server.container.function.runtime.database.cache.queue.storage.lb.firewall.cdn.cloud.building.router.hub.wifi.external.auth.ai.api.mail.monitor.schedule.search.logic.webhook.payment.key.screen.modal.browser.desktop.mobile.terminal.device.printer.chat.sheet.file.user.users.bot".split(".");
function n(e) {
	return t.includes(e);
}
var r = [
	"red",
	"orange",
	"yellow",
	"green",
	"teal",
	"blue",
	"purple",
	"pink",
	"gray"
];
function i(e) {
	return r.includes(e);
}
var a = "none", o = [
	"dav",
	"title",
	"group",
	"node",
	"step",
	"desc",
	"focus",
	"state",
	"animate",
	"true",
	"false"
];
function s(e, t) {
	return `${e}->${t}`;
}
var c = {
	node: {
		icon: "icon",
		sub: "string",
		badge: "string",
		visible: "bool",
		color: "color"
	},
	group: { color: "color" },
	edge: {
		id: "ident",
		visible: "bool",
		color: "color"
	},
	state: {
		badge: "string",
		visible: "bool",
		color: "stateColor"
	},
	animate: {
		icon: "icon",
		color: "color",
		parallel: "bool",
		desc: "string",
		code: "string"
	}
}, l = {
	node: /* @__PURE__ */ new Set([
		"badge",
		"visible",
		"color"
	]),
	group: /* @__PURE__ */ new Set(["color"]),
	edge: /* @__PURE__ */ new Set(["visible", "color"])
}, u = [
	"-->",
	"..>",
	"<->",
	"<.>"
], d = {
	"-->": {
		style: "solid",
		direction: "forward"
	},
	"..>": {
		style: "dashed",
		direction: "forward"
	},
	"<->": {
		style: "solid",
		direction: "bidirectional"
	},
	"<.>": {
		style: "dashed",
		direction: "bidirectional"
	}
};
new Set(o);
// src/dsl/suggest.ts
function f(e, t) {
	let n, r = 3, i = e.toLowerCase();
	for (let e of t) {
		let t = e.length <= 3 ? 1 : 2, a = p(i, e);
		a <= t && a < r && (n = e, r = a);
	}
	return n;
}
function p(e, t) {
	let n = Array.from({ length: t.length + 1 }, (e, t) => t);
	for (let r = 1; r <= e.length; r++) {
		let i = n[0] ?? 0, a = r;
		n[0] = a;
		for (let o = 1; o <= t.length; o++) {
			let s = n[o] ?? 0, c = e[r - 1] === t[o - 1] ? 0 : 1;
			a = Math.min(s + 1, a + 1, i + c), n[o] = a, i = s;
		}
	}
	return n[t.length] ?? 0;
}
// src/model/text.ts
function m(e, t) {
	let n = e.replace(/\r\n?/g, "\n").replace(/\t/g, "  ");
	if (!t?.stripAllOuterBlankLines && !n.includes("\n")) return n.trim();
	let r = n.split("\n");
	if (t?.stripAllOuterBlankLines) {
		for (; r.length > 0 && r[0]?.trim() === "";) r.shift();
		for (; r.length > 0 && r[r.length - 1]?.trim() === "";) r.pop();
		if (r.length === 0) return "";
	} else r.length > 0 && r[0]?.trim() === "" && r.shift(), r.length > 0 && r[r.length - 1]?.trim() === "" && r.pop();
	let i = r.map((e) => e.trimEnd()), a = Infinity;
	for (let e of i) {
		if (e.length === 0) continue;
		let t = /^ */.exec(e)?.[0].length ?? 0;
		t < a && (a = t);
	}
	return !Number.isFinite(a) || a === 0 ? i.join("\n") : i.map((e) => e.length > 0 ? e.slice(a) : "").join("\n");
}
// ../../node_modules/@lezer/common/dist/index.js
var h = 1024, g = 0, _ = class {
	constructor(e, t) {
		this.from = e, this.to = t;
	}
}, v = class {
	constructor(e = {}) {
		this.id = g++, this.perNode = !!e.perNode, this.deserialize = e.deserialize || (() => {
			throw Error("This node type doesn't define a deserialize function");
		}), this.combine = e.combine || null;
	}
	add(e) {
		if (this.perNode) throw RangeError("Can't add per-node props to node types");
		return typeof e != "function" && (e = x.match(e)), (t) => {
			let n = e(t);
			return n === void 0 ? null : [this, n];
		};
	}
};
v.closedBy = new v({ deserialize: (e) => e.split(" ") }), v.openedBy = new v({ deserialize: (e) => e.split(" ") }), v.group = new v({ deserialize: (e) => e.split(" ") }), v.isolate = new v({ deserialize: (e) => {
	if (e && e != "rtl" && e != "ltr" && e != "auto") throw RangeError("Invalid value for isolate: " + e);
	return e || "auto";
} }), v.contextHash = new v({ perNode: !0 }), v.lookAhead = new v({ perNode: !0 }), v.mounted = new v({ perNode: !0 });
var y = class {
	constructor(e, t, n, r = !1) {
		this.tree = e, this.overlay = t, this.parser = n, this.bracketed = r;
	}
	static get(e) {
		return e && e.props && e.props[v.mounted.id];
	}
}, b = Object.create(null), x = class e {
	constructor(e, t, n, r = 0) {
		this.name = e, this.props = t, this.id = n, this.flags = r;
	}
	static define(t) {
		let n = t.props && t.props.length ? Object.create(null) : b, r = +!!t.top | (t.skipped ? 2 : 0) | (t.error ? 4 : 0) | (t.name == null ? 8 : 0), i = new e(t.name || "", n, t.id, r);
		if (t.props) {
			for (let e of t.props) if (Array.isArray(e) || (e = e(i)), e) {
				if (e[0].perNode) throw RangeError("Can't store a per-node prop on a node type");
				n[e[0].id] = e[1];
			}
		}
		return i;
	}
	prop(e) {
		return this.props[e.id];
	}
	get isTop() {
		return (this.flags & 1) > 0;
	}
	get isSkipped() {
		return (this.flags & 2) > 0;
	}
	get isError() {
		return (this.flags & 4) > 0;
	}
	get isAnonymous() {
		return (this.flags & 8) > 0;
	}
	is(e) {
		if (typeof e == "string") {
			if (this.name == e) return !0;
			let t = this.prop(v.group);
			return t ? t.indexOf(e) > -1 : !1;
		}
		return this.id == e;
	}
	static match(e) {
		let t = Object.create(null);
		for (let n in e) for (let r of n.split(" ")) t[r] = e[n];
		return (e) => {
			for (let n = e.prop(v.group), r = -1; r < (n ? n.length : 0); r++) {
				let i = t[r < 0 ? e.name : n[r]];
				if (i) return i;
			}
		};
	}
};
x.none = new x("", Object.create(null), 0, 8);
var S = class e {
	constructor(e) {
		this.types = e;
		for (let t = 0; t < e.length; t++) if (e[t].id != t) throw RangeError("Node type ids should correspond to array positions when creating a node set");
	}
	extend(...t) {
		let n = [];
		for (let e of this.types) {
			let r = null;
			for (let n of t) {
				let t = n(e);
				if (t) {
					r ||= Object.assign({}, e.props);
					let n = t[1], i = t[0];
					i.combine && i.id in r && (n = i.combine(r[i.id], n)), r[i.id] = n;
				}
			}
			n.push(r ? new x(e.name, r, e.id, e.flags) : e);
		}
		return new e(n);
	}
}, C = /* @__PURE__ */ new WeakMap(), w = /* @__PURE__ */ new WeakMap(), T;
(function(e) {
	e[e.ExcludeBuffers = 1] = "ExcludeBuffers", e[e.IncludeAnonymous = 2] = "IncludeAnonymous", e[e.IgnoreMounts = 4] = "IgnoreMounts", e[e.IgnoreOverlays = 8] = "IgnoreOverlays", e[e.EnterBracketed = 16] = "EnterBracketed";
})(T ||= {});
var E = class e {
	constructor(e, t, n, r, i) {
		if (this.type = e, this.children = t, this.positions = n, this.length = r, this.props = null, i && i.length) {
			this.props = Object.create(null);
			for (let [e, t] of i) this.props[typeof e == "number" ? e : e.id] = t;
		}
	}
	toString() {
		let e = y.get(this);
		if (e && !e.overlay) return e.tree.toString();
		let t = "";
		for (let e of this.children) {
			let n = e.toString();
			n && (t && (t += ","), t += n);
		}
		return this.type.name ? (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) + (t.length ? "(" + t + ")" : "") : t;
	}
	cursor(e = 0) {
		return new F(this.topNode, e);
	}
	cursorAt(e, t = 0, n = 0) {
		let r = new F(C.get(this) || this.topNode);
		return r.moveTo(e, t), C.set(this, r._tree), r;
	}
	get topNode() {
		return new M(this, 0, 0, null);
	}
	resolve(e, t = 0) {
		let n = A(C.get(this) || this.topNode, e, t, !1);
		return C.set(this, n), n;
	}
	resolveInner(e, t = 0) {
		let n = A(w.get(this) || this.topNode, e, t, !0);
		return w.set(this, n), n;
	}
	resolveStack(e, t = 0) {
		return ie(this, e, t);
	}
	iterate(e) {
		let { enter: t, leave: n, from: r = 0, to: i = this.length } = e, a = e.mode || 0, o = (a & T.IncludeAnonymous) > 0;
		for (let e = this.cursor(a | T.IncludeAnonymous);;) {
			let a = !1;
			if (e.from <= i && e.to >= r && (!o && e.type.isAnonymous || t(e) !== !1)) {
				if (e.firstChild()) continue;
				a = !0;
			}
			for (; a && n && (o || !e.type.isAnonymous) && n(e), !e.nextSibling();) {
				if (!e.parent()) return;
				a = !0;
			}
		}
	}
	prop(e) {
		return e.perNode ? this.props ? this.props[e.id] : void 0 : this.type.prop(e);
	}
	get propValues() {
		let e = [];
		if (this.props) for (let t in this.props) e.push([+t, this.props[t]]);
		return e;
	}
	balance(t = {}) {
		return this.children.length <= 8 ? this : z(x.none, this.children, this.positions, 0, this.children.length, 0, this.length, (t, n, r) => new e(this.type, t, n, r, this.propValues), t.makeTree || ((t, n, r) => new e(x.none, t, n, r)));
	}
	static build(e) {
		return ae(e);
	}
};
E.empty = new E(x.none, [], [], 0);
var D = class e {
	constructor(e, t) {
		this.buffer = e, this.index = t;
	}
	get id() {
		return this.buffer[this.index - 4];
	}
	get start() {
		return this.buffer[this.index - 3];
	}
	get end() {
		return this.buffer[this.index - 2];
	}
	get size() {
		return this.buffer[this.index - 1];
	}
	get pos() {
		return this.index;
	}
	next() {
		this.index -= 4;
	}
	fork() {
		return new e(this.buffer, this.index);
	}
}, O = class e {
	constructor(e, t, n) {
		this.buffer = e, this.length = t, this.set = n;
	}
	get type() {
		return x.none;
	}
	toString() {
		let e = [];
		for (let t = 0; t < this.buffer.length;) e.push(this.childString(t)), t = this.buffer[t + 3];
		return e.join(",");
	}
	childString(e) {
		let t = this.buffer[e], n = this.buffer[e + 3], r = this.set.types[t], i = r.name;
		if (/\W/.test(i) && !r.isError && (i = JSON.stringify(i)), e += 4, n == e) return i;
		let a = [];
		for (; e < n;) a.push(this.childString(e)), e = this.buffer[e + 3];
		return i + "(" + a.join(",") + ")";
	}
	findChild(e, t, n, r, i) {
		let { buffer: a } = this, o = -1;
		for (let s = e; s != t && !(k(i, r, a[s + 1], a[s + 2]) && (o = s, n > 0)); s = a[s + 3]);
		return o;
	}
	slice(t, n, r) {
		let i = this.buffer, a = new Uint16Array(n - t), o = 0;
		for (let e = t, s = 0; e < n;) {
			a[s++] = i[e++], a[s++] = i[e++] - r;
			let n = a[s++] = i[e++] - r;
			a[s++] = i[e++] - t, o = Math.max(o, n);
		}
		return new e(a, o, this.set);
	}
};
function k(e, t, n, r) {
	switch (e) {
		case -2: return n < t;
		case -1: return r >= t && n < t;
		case 0: return n < t && r > t;
		case 1: return n <= t && r > t;
		case 2: return r > t;
		case 4: return !0;
	}
}
function A(e, t, n, r) {
	for (; e.from == e.to || (n < 1 ? e.from >= t : e.from > t) || (n > -1 ? e.to <= t : e.to < t);) {
		let t = !r && e instanceof M && e.index < 0 ? null : e.parent;
		if (!t) return e;
		e = t;
	}
	let i = r ? 0 : T.IgnoreOverlays;
	if (r) for (let r = e, a = r.parent; a; r = a, a = r.parent) r instanceof M && r.index < 0 && a.enter(t, n, i)?.from != r.from && (e = a);
	for (;;) {
		let r = e.enter(t, n, i);
		if (!r) return e;
		e = r;
	}
}
var j = class {
	cursor(e = 0) {
		return new F(this, e);
	}
	getChild(e, t = null, n = null) {
		let r = ee(this, e, t, n);
		return r.length ? r[0] : null;
	}
	getChildren(e, t = null, n = null) {
		return ee(this, e, t, n);
	}
	resolve(e, t = 0) {
		return A(this, e, t, !1);
	}
	resolveInner(e, t = 0) {
		return A(this, e, t, !0);
	}
	matchContext(e) {
		return N(this.parent, e);
	}
	enterUnfinishedNodesBefore(e) {
		let t = this.childBefore(e), n = this;
		for (; t;) {
			let e = t.lastChild;
			if (!e || e.to != t.to) break;
			e.type.isError && e.from == e.to ? (n = t, t = e.prevSibling) : t = e;
		}
		return n;
	}
	get node() {
		return this;
	}
	get next() {
		return this.parent;
	}
}, M = class e extends j {
	constructor(e, t, n, r) {
		super(), this._tree = e, this.from = t, this.index = n, this._parent = r;
	}
	get type() {
		return this._tree.type;
	}
	get name() {
		return this._tree.type.name;
	}
	get to() {
		return this.from + this._tree.length;
	}
	nextChild(t, n, r, i, a = 0) {
		for (let o = this;;) {
			for (let { children: s, positions: c } = o._tree, l = n > 0 ? s.length : -1; t != l; t += n) {
				let l = s[t], u = c[t] + o.from, d;
				if (a & T.EnterBracketed && l instanceof E && (d = y.get(l)) && !d.overlay && d.bracketed && r >= u && r <= u + l.length || k(i, r, u, u + l.length)) {
					if (l instanceof O) {
						if (a & T.ExcludeBuffers) continue;
						let e = l.findChild(0, l.buffer.length, n, r - u, i);
						if (e > -1) return new P(new te(o, l, t, u), null, e);
					} else if (a & T.IncludeAnonymous || !l.type.isAnonymous || I(l)) {
						let s;
						if (!(a & T.IgnoreMounts) && (s = y.get(l)) && !s.overlay) return new e(s.tree, u, t, o);
						let c = new e(l, u, t, o);
						return a & T.IncludeAnonymous || !c.type.isAnonymous ? c : c.nextChild(n < 0 ? l.children.length - 1 : 0, n, r, i, a);
					}
				}
			}
			if (a & T.IncludeAnonymous || !o.type.isAnonymous || (t = o.index >= 0 ? o.index + n : n < 0 ? -1 : o._parent._tree.children.length, o = o._parent, !o)) return null;
		}
	}
	get firstChild() {
		return this.nextChild(0, 1, 0, 4);
	}
	get lastChild() {
		return this.nextChild(this._tree.children.length - 1, -1, 0, 4);
	}
	childAfter(e) {
		return this.nextChild(0, 1, e, 2);
	}
	childBefore(e) {
		return this.nextChild(this._tree.children.length - 1, -1, e, -2);
	}
	prop(e) {
		return this._tree.prop(e);
	}
	enter(t, n, r = 0) {
		let i;
		if (!(r & T.IgnoreOverlays) && (i = y.get(this._tree)) && i.overlay) {
			let a = t - this.from, o = r & T.EnterBracketed && i.bracketed;
			for (let { from: t, to: r } of i.overlay) if ((n > 0 || o ? t <= a : t < a) && (n < 0 || o ? r >= a : r > a)) return new e(i.tree, i.overlay[0].from + this.from, -1, this);
		}
		return this.nextChild(0, 1, t, n, r);
	}
	nextSignificantParent() {
		let e = this;
		for (; e.type.isAnonymous && e._parent;) e = e._parent;
		return e;
	}
	get parent() {
		return this._parent ? this._parent.nextSignificantParent() : null;
	}
	get nextSibling() {
		return this._parent && this.index >= 0 ? this._parent.nextChild(this.index + 1, 1, 0, 4) : null;
	}
	get prevSibling() {
		return this._parent && this.index >= 0 ? this._parent.nextChild(this.index - 1, -1, 0, 4) : null;
	}
	get tree() {
		return this._tree;
	}
	toTree() {
		return this._tree;
	}
	toString() {
		return this._tree.toString();
	}
};
function ee(e, t, n, r) {
	let i = e.cursor(), a = [];
	if (!i.firstChild()) return a;
	if (n != null) {
		for (let e = !1; !e;) if (e = i.type.is(n), !i.nextSibling()) return a;
	}
	for (;;) {
		if (r != null && i.type.is(r)) return a;
		if (i.type.is(t) && a.push(i.node), !i.nextSibling()) return r == null ? a : [];
	}
}
function N(e, t, n = t.length - 1) {
	for (let r = e; n >= 0; r = r.parent) {
		if (!r) return !1;
		if (!r.type.isAnonymous) {
			if (t[n] && t[n] != r.name) return !1;
			n--;
		}
	}
	return !0;
}
var te = class {
	constructor(e, t, n, r) {
		this.parent = e, this.buffer = t, this.index = n, this.start = r;
	}
}, P = class e extends j {
	get name() {
		return this.type.name;
	}
	get from() {
		return this.context.start + this.context.buffer.buffer[this.index + 1];
	}
	get to() {
		return this.context.start + this.context.buffer.buffer[this.index + 2];
	}
	constructor(e, t, n) {
		super(), this.context = e, this._parent = t, this.index = n, this.type = e.buffer.set.types[e.buffer.buffer[n]];
	}
	child(t, n, r) {
		let { buffer: i } = this.context, a = i.findChild(this.index + 4, i.buffer[this.index + 3], t, n - this.context.start, r);
		return a < 0 ? null : new e(this.context, this, a);
	}
	get firstChild() {
		return this.child(1, 0, 4);
	}
	get lastChild() {
		return this.child(-1, 0, 4);
	}
	childAfter(e) {
		return this.child(1, e, 2);
	}
	childBefore(e) {
		return this.child(-1, e, -2);
	}
	prop(e) {
		return this.type.prop(e);
	}
	enter(t, n, r = 0) {
		if (r & T.ExcludeBuffers) return null;
		let { buffer: i } = this.context, a = i.findChild(this.index + 4, i.buffer[this.index + 3], n > 0 ? 1 : -1, t - this.context.start, n);
		return a < 0 ? null : new e(this.context, this, a);
	}
	get parent() {
		return this._parent || this.context.parent.nextSignificantParent();
	}
	externalSibling(e) {
		return this._parent ? null : this.context.parent.nextChild(this.context.index + e, e, 0, 4);
	}
	get nextSibling() {
		let { buffer: t } = this.context, n = t.buffer[this.index + 3];
		return n < (this._parent ? t.buffer[this._parent.index + 3] : t.buffer.length) ? new e(this.context, this._parent, n) : this.externalSibling(1);
	}
	get prevSibling() {
		let { buffer: t } = this.context, n = this._parent ? this._parent.index + 4 : 0;
		return this.index == n ? this.externalSibling(-1) : new e(this.context, this._parent, t.findChild(n, this.index, -1, 0, 4));
	}
	get tree() {
		return null;
	}
	toTree() {
		let e = [], t = [], { buffer: n } = this.context, r = this.index + 4, i = n.buffer[this.index + 3];
		if (i > r) {
			let a = n.buffer[this.index + 1];
			e.push(n.slice(r, i, a)), t.push(0);
		}
		return new E(this.type, e, t, this.to - this.from);
	}
	toString() {
		return this.context.buffer.childString(this.index);
	}
};
function ne(e) {
	if (!e.length) return null;
	let t = 0, n = e[0];
	for (let r = 1; r < e.length; r++) {
		let i = e[r];
		(i.from > n.from || i.to < n.to) && (n = i, t = r);
	}
	let r = n instanceof M && n.index < 0 ? null : n.parent, i = e.slice();
	return r ? i[t] = r : i.splice(t, 1), new re(i, n);
}
var re = class {
	constructor(e, t) {
		this.heads = e, this.node = t;
	}
	get next() {
		return ne(this.heads);
	}
};
function ie(e, t, n) {
	let r = e.resolveInner(t, n), i = null;
	for (let e = r instanceof M ? r : r.context.parent; e; e = e.parent) if (e.index < 0) {
		let a = e.parent;
		(i ||= [r]).push(a.resolve(t, n)), e = a;
	} else {
		let a = y.get(e.tree);
		if (a && a.overlay && a.overlay[0].from <= t && a.overlay[a.overlay.length - 1].to >= t) {
			let o = new M(a.tree, a.overlay[0].from + e.from, -1, e);
			(i ||= [r]).push(A(o, t, n, !1));
		}
	}
	return i ? ne(i) : r;
}
var F = class {
	get name() {
		return this.type.name;
	}
	constructor(e, t = 0) {
		if (this.buffer = null, this.stack = [], this.index = 0, this.bufferNode = null, this.mode = t & ~T.EnterBracketed, e instanceof M) this.yieldNode(e);
		else {
			this._tree = e.context.parent, this.buffer = e.context;
			for (let t = e._parent; t; t = t._parent) this.stack.unshift(t.index);
			this.bufferNode = e, this.yieldBuf(e.index);
		}
	}
	yieldNode(e) {
		return e ? (this._tree = e, this.type = e.type, this.from = e.from, this.to = e.to, !0) : !1;
	}
	yieldBuf(e, t) {
		this.index = e;
		let { start: n, buffer: r } = this.buffer;
		return this.type = t || r.set.types[r.buffer[e]], this.from = n + r.buffer[e + 1], this.to = n + r.buffer[e + 2], !0;
	}
	yield(e) {
		return e ? e instanceof M ? (this.buffer = null, this.yieldNode(e)) : (this.buffer = e.context, this.yieldBuf(e.index, e.type)) : !1;
	}
	toString() {
		return this.buffer ? this.buffer.buffer.childString(this.index) : this._tree.toString();
	}
	enterChild(e, t, n) {
		if (!this.buffer) return this.yield(this._tree.nextChild(e < 0 ? this._tree._tree.children.length - 1 : 0, e, t, n, this.mode));
		let { buffer: r } = this.buffer, i = r.findChild(this.index + 4, r.buffer[this.index + 3], e, t - this.buffer.start, n);
		return i < 0 ? !1 : (this.stack.push(this.index), this.yieldBuf(i));
	}
	firstChild() {
		return this.enterChild(1, 0, 4);
	}
	lastChild() {
		return this.enterChild(-1, 0, 4);
	}
	childAfter(e) {
		return this.enterChild(1, e, 2);
	}
	childBefore(e) {
		return this.enterChild(-1, e, -2);
	}
	enter(e, t, n = this.mode) {
		return this.buffer ? n & T.ExcludeBuffers ? !1 : this.enterChild(1, e, t) : this.yield(this._tree.enter(e, t, n));
	}
	parent() {
		if (!this.buffer) return this.yieldNode(this.mode & T.IncludeAnonymous ? this._tree._parent : this._tree.parent);
		if (this.stack.length) return this.yieldBuf(this.stack.pop());
		let e = this.mode & T.IncludeAnonymous ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
		return this.buffer = null, this.yieldNode(e);
	}
	sibling(e) {
		if (!this.buffer) return this._tree._parent ? this.yield(this._tree.index < 0 ? null : this._tree._parent.nextChild(this._tree.index + e, e, 0, 4, this.mode)) : !1;
		let { buffer: t } = this.buffer, n = this.stack.length - 1;
		if (e < 0) {
			let e = n < 0 ? 0 : this.stack[n] + 4;
			if (this.index != e) return this.yieldBuf(t.findChild(e, this.index, -1, 0, 4));
		} else {
			let e = t.buffer[this.index + 3];
			if (e < (n < 0 ? t.buffer.length : t.buffer[this.stack[n] + 3])) return this.yieldBuf(e);
		}
		return n < 0 && this.yield(this.buffer.parent.nextChild(this.buffer.index + e, e, 0, 4, this.mode));
	}
	nextSibling() {
		return this.sibling(1);
	}
	prevSibling() {
		return this.sibling(-1);
	}
	atLastNode(e) {
		let t, n, { buffer: r } = this;
		if (r) {
			if (e > 0) {
				if (this.index < r.buffer.buffer.length) return !1;
			} else for (let e = 0; e < this.index; e++) if (r.buffer.buffer[e + 3] < this.index) return !1;
			({index: t, parent: n} = r);
		} else ({index: t, _parent: n} = this._tree);
		for (; n; {index: t, _parent: n} = n) if (t > -1) for (let r = t + e, i = e < 0 ? -1 : n._tree.children.length; r != i; r += e) {
			let e = n._tree.children[r];
			if (this.mode & T.IncludeAnonymous || e instanceof O || !e.type.isAnonymous || I(e)) return !1;
		}
		return !0;
	}
	move(e, t) {
		if (t && this.enterChild(e, 0, 4)) return !0;
		for (;;) {
			if (this.sibling(e)) return !0;
			if (this.atLastNode(e) || !this.parent()) return !1;
		}
	}
	next(e = !0) {
		return this.move(1, e);
	}
	prev(e = !0) {
		return this.move(-1, e);
	}
	moveTo(e, t = 0) {
		for (; (this.from == this.to || (t < 1 ? this.from >= e : this.from > e) || (t > -1 ? this.to <= e : this.to < e)) && this.parent(););
		for (; this.enterChild(1, e, t););
		return this;
	}
	get node() {
		if (!this.buffer) return this._tree;
		let e = this.bufferNode, t = null, n = 0;
		if (e && e.context == this.buffer) scan: for (let r = this.index, i = this.stack.length; i >= 0;) {
			for (let a = e; a; a = a._parent) if (a.index == r) {
				if (r == this.index) return a;
				t = a, n = i + 1;
				break scan;
			}
			r = this.stack[--i];
		}
		for (let e = n; e < this.stack.length; e++) t = new P(this.buffer, t, this.stack[e]);
		return this.bufferNode = new P(this.buffer, t, this.index);
	}
	get tree() {
		return this.buffer ? null : this._tree._tree;
	}
	iterate(e, t) {
		for (let n = 0;;) {
			let r = !1;
			if (this.type.isAnonymous || e(this) !== !1) {
				if (this.firstChild()) {
					n++;
					continue;
				}
				this.type.isAnonymous || (r = !0);
			}
			for (;;) {
				if (r && t && t(this), r = this.type.isAnonymous, !n) return;
				if (this.nextSibling()) break;
				this.parent(), n--, r = !0;
			}
		}
	}
	matchContext(e) {
		if (!this.buffer) return N(this.node.parent, e);
		let { buffer: t } = this.buffer, { types: n } = t.set;
		for (let r = e.length - 1, i = this.stack.length - 1; r >= 0; i--) {
			if (i < 0) return N(this._tree, e, r);
			let a = n[t.buffer[this.stack[i]]];
			if (!a.isAnonymous) {
				if (e[r] && e[r] != a.name) return !1;
				r--;
			}
		}
		return !0;
	}
};
function I(e) {
	return e.children.some((e) => e instanceof O || !e.type.isAnonymous || I(e));
}
function ae(e) {
	let { buffer: t, nodeSet: n, maxBufferLength: r = h, reused: i = [], minRepeatType: a = n.types.length } = e, o = Array.isArray(t) ? new D(t, t.length) : t, s = n.types, c = 0, l = 0;
	function u(e, t, h, v, y, b) {
		let { id: x, start: S, end: C, size: w } = o, T = l, E = c;
		if (w < 0) {
			if (o.next(), w == -1) {
				let t = i[x];
				h.push(t), v.push(S - e);
				return;
			}
			if (w == -3) {
				c = x;
				return;
			}
			if (w == -4) {
				l = x;
				return;
			}
			throw RangeError(`Unrecognized record size: ${w}`);
		}
		let D = s[x], k, A, j = S - e;
		if (C - S <= r && (A = g(o.pos - t, y))) {
			let t = new Uint16Array(A.size - A.skip), r = o.pos - A.size, i = t.length;
			for (; o.pos > r;) i = _(A.start, t, i);
			k = new O(t, C - A.start, n), j = A.start - e;
		} else {
			let e = o.pos - w;
			o.next();
			let t = [], s = [], c = x >= a ? x : -1, h = 0, g = C, _ = T;
			for (; o.pos > e;) c >= 0 && o.id == c && o.size >= 0 ? (o.end <= g - r && (p(t, s, S, h, o.end, g, c, _, E), h = t.length, g = o.end, _ = l), o.next()) : b > 2500 ? d(S, e, t, s) : (c >= 0 && o.size == -1 && i[o.id].type == n.types[c] && (h < t.length && p(t, s, S, h, o.end, g, c, _, E), h = t.length + 1, g = o.start, _ = l), u(S, e, t, s, c, b + 1));
			if (c >= 0 && h > 0 && h < t.length && p(t, s, S, h, S, g, c, _, E), t.reverse(), s.reverse(), c > -1 && h > 0) {
				let e = f(D, E);
				k = z(D, t, s, 0, t.length, 0, C - S, e, e);
			} else k = m(D, t, s, C - S, T - C, E);
		}
		h.push(k), v.push(j);
	}
	function d(e, t, i, a) {
		let s = [], c = 0, l = -1;
		for (; o.pos > t;) {
			let { id: e, start: t, end: n, size: i } = o;
			if (i > 4) o.next();
			else if (l > -1 && t < l) break;
			else l < 0 && (l = n - r), s.push(e, t, n), c++, o.next();
		}
		if (c) {
			let t = new Uint16Array(c * 4), r = s[s.length - 2];
			for (let e = s.length - 3, n = 0; e >= 0; e -= 3) t[n++] = s[e], t[n++] = s[e + 1] - r, t[n++] = s[e + 2] - r, t[n++] = n;
			i.push(new O(t, s[2] - r, n)), a.push(r - e);
		}
	}
	function f(e, t) {
		return (n, r, i) => {
			let a = 0, o = n.length - 1, s, c;
			if (o >= 0 && (s = n[o]) instanceof E) {
				if (!o && s.type == e && s.length == i) return s;
				(c = s.prop(v.lookAhead)) && (a = r[o] + s.length + c - i);
			}
			return m(e, n, r, i, a, t);
		};
	}
	function p(e, t, r, i, a, o, s, c, l) {
		let u = [], d = [];
		for (; e.length > i;) u.push(e.pop()), d.push(t.pop() + r - a);
		e.push(m(n.types[s], u, d, o - a, c - o, l)), t.push(a - r);
	}
	function m(e, t, n, r, i, a, o) {
		if (a) {
			let e = [v.contextHash, a];
			o = o ? [e].concat(o) : [e];
		}
		if (i > 25) {
			let e = [v.lookAhead, i];
			o = o ? [e].concat(o) : [e];
		}
		return new E(e, t, n, r, o);
	}
	function g(e, t) {
		let n = o.fork(), i = 0, s = 0, c = 0, l = n.end - r, u = {
			size: 0,
			start: 0,
			skip: 0
		};
		scan: for (let r = n.pos - e; n.pos > r;) {
			let e = n.size;
			if (n.id == t && e >= 0) {
				u.size = i, u.start = s, u.skip = c, c += 4, i += 4, n.next();
				continue;
			}
			let o = n.pos - e;
			if (e < 0 || o < r || n.start < l) break;
			let d = n.id >= a ? 4 : 0, f = n.start;
			for (n.next(); n.pos > o;) {
				if (n.size < 0) {
					if (n.size == -3 || n.size == -4) d += 4;
					else break scan;
				} else n.id >= a && (d += 4);
				n.next();
			}
			s = f, i += e, c += d;
		}
		return (t < 0 || i == e) && (u.size = i, u.start = s, u.skip = c), u.size > 4 ? u : void 0;
	}
	function _(e, t, n) {
		let { id: r, start: i, end: s, size: u } = o;
		if (o.next(), u >= 0 && r < a) {
			let a = n;
			if (u > 4) {
				let r = o.pos - (u - 4);
				for (; o.pos > r;) n = _(e, t, n);
			}
			t[--n] = a, t[--n] = s - e, t[--n] = i - e, t[--n] = r;
		} else u == -3 ? c = r : u == -4 && (l = r);
		return n;
	}
	let y = [], b = [];
	for (; o.pos > 0;) u(e.start || 0, e.bufferStart || 0, y, b, -1, 0);
	let x = e.length ?? (y.length ? b[0] + y[0].length : 0);
	return new E(s[e.topID], y.reverse(), b.reverse(), x);
}
var L = /* @__PURE__ */ new WeakMap();
function R(e, t) {
	if (!e.isAnonymous || t instanceof O || t.type != e) return 1;
	let n = L.get(t);
	if (n == null) {
		n = 1;
		for (let r of t.children) {
			if (r.type != e || !(r instanceof E)) {
				n = 1;
				break;
			}
			n += R(e, r);
		}
		L.set(t, n);
	}
	return n;
}
function z(e, t, n, r, i, a, o, s, c) {
	let l = 0;
	for (let n = r; n < i; n++) l += R(e, t[n]);
	let u = Math.ceil(l * 1.5 / 8), d = [], f = [];
	function p(t, n, r, i, o) {
		for (let s = r; s < i;) {
			let r = s, l = n[s], m = R(e, t[s]);
			for (s++; s < i; s++) {
				let n = R(e, t[s]);
				if (m + n >= u) break;
				m += n;
			}
			if (s == r + 1) {
				if (m > u) {
					let e = t[r];
					p(e.children, e.positions, 0, e.children.length, n[r] + o);
					continue;
				}
				d.push(t[r]);
			} else {
				let i = n[s - 1] + t[s - 1].length - l;
				d.push(z(e, t, n, r, s, l, i, null, c));
			}
			f.push(l + o - a);
		}
	}
	return p(t, n, r, i, 0), (s || c)(d, f, o);
}
var oe = class {
	startParse(e, t, n) {
		return typeof e == "string" && (e = new se(e)), n = n ? n.length ? n.map((e) => new _(e.from, e.to)) : [new _(0, 0)] : [new _(0, e.length)], this.createParse(e, t || [], n);
	}
	parse(e, t, n) {
		let r = this.startParse(e, t, n);
		for (;;) {
			let e = r.advance();
			if (e) return e;
		}
	}
}, se = class {
	constructor(e) {
		this.string = e;
	}
	get length() {
		return this.string.length;
	}
	chunk(e) {
		return this.string.slice(e);
	}
	get lineChunks() {
		return !1;
	}
	read(e, t) {
		return this.string.slice(e, t);
	}
};
new v({ perNode: !0 });
// ../../node_modules/@lezer/lr/dist/index.js
var ce = class e {
	constructor(e, t, n, r, i, a, o, s, c, l = 0, u) {
		this.p = e, this.stack = t, this.state = n, this.reducePos = r, this.pos = i, this.score = a, this.buffer = o, this.bufferBase = s, this.curContext = c, this.lookAhead = l, this.parent = u;
	}
	toString() {
		return `[${this.stack.filter((e, t) => t % 3 == 0).concat(this.state)}]@${this.pos}${this.score ? "!" + this.score : ""}`;
	}
	static start(t, n, r = 0) {
		let i = t.parser.context;
		return new e(t, [], n, r, r, 0, [], 0, i ? new le(i, i.start) : null, 0, null);
	}
	get context() {
		return this.curContext ? this.curContext.context : null;
	}
	pushState(e, t) {
		this.stack.push(this.state, t, this.bufferBase + this.buffer.length), this.state = e;
	}
	reduce(e) {
		let t = e >> 19, n = e & 65535, { parser: r } = this.p, i = this.reducePos < this.pos - 25 && this.setLookAhead(this.pos), a = r.dynamicPrecedence(n);
		if (a && (this.score += a), t == 0) {
			n < r.minRepeatTerm && this.reducePos < this.pos && (this.reducePos = this.pos), this.pushState(r.getGoto(this.state, n, !0), this.reducePos), n < r.minRepeatTerm && this.storeNode(n, this.reducePos, this.reducePos, i ? 8 : 4, !0), this.reduceContext(n, this.reducePos);
			return;
		}
		let o = this.stack.length - (t - 1) * 3 - (e & 262144 ? 6 : 0), s = o ? this.stack[o - 2] : this.p.ranges[0].from;
		n < r.minRepeatTerm && s == this.reducePos && this.reducePos < this.pos && (this.reducePos = this.pos);
		let c = this.reducePos - s;
		c >= 2e3 && !this.p.parser.nodeSet.types[n]?.isAnonymous && (s == this.p.lastBigReductionStart ? (this.p.bigReductionCount++, this.p.lastBigReductionSize = c) : this.p.lastBigReductionSize < c && (this.p.bigReductionCount = 1, this.p.lastBigReductionStart = s, this.p.lastBigReductionSize = c));
		let l = o ? this.stack[o - 1] : 0, u = this.bufferBase + this.buffer.length - l;
		if (n < r.minRepeatTerm || e & 131072) {
			let e = r.stateFlag(this.state, 1) ? this.pos : this.reducePos;
			this.storeNode(n, s, e, u + 4, !0);
		}
		if (e & 262144) this.state = this.stack[o];
		else {
			let e = this.stack[o - 3];
			this.state = r.getGoto(e, n, !0);
		}
		for (; this.stack.length > o;) this.stack.pop();
		this.reduceContext(n, s);
	}
	storeNode(e, t, n, r = 4, i = !1) {
		if (e == 0 && (!this.stack.length || this.stack[this.stack.length - 1] < this.buffer.length + this.bufferBase)) {
			let e = this.buffer.length;
			if (e > 0 && this.buffer[e - 4] == 0 && this.buffer[e - 1] > -1) {
				if (t == n) return;
				if (this.buffer[e - 2] >= t) {
					this.buffer[e - 2] = n;
					return;
				}
			}
		}
		if (!i || this.pos == n) this.buffer.push(e, t, n, r);
		else {
			let i = this.buffer.length;
			if (i > 0 && (this.buffer[i - 4] != 0 || this.buffer[i - 1] < 0)) {
				let e = !1;
				for (let t = i; t > 0 && this.buffer[t - 2] > n; t -= 4) if (this.buffer[t - 1] >= 0) {
					e = !0;
					break;
				}
				if (e) for (; i > 0 && this.buffer[i - 2] > n;) this.buffer[i] = this.buffer[i - 4], this.buffer[i + 1] = this.buffer[i - 3], this.buffer[i + 2] = this.buffer[i - 2], this.buffer[i + 3] = this.buffer[i - 1], i -= 4, r > 4 && (r -= 4);
			}
			this.buffer[i] = e, this.buffer[i + 1] = t, this.buffer[i + 2] = n, this.buffer[i + 3] = r;
		}
	}
	shift(e, t, n, r) {
		if (e & 131072) this.pushState(e & 65535, this.pos);
		else if (e & 262144) this.pos = r, this.shiftContext(t, n), t <= this.p.parser.maxNode && this.buffer.push(t, n, r, 4);
		else {
			let i = e, { parser: a } = this.p;
			this.pos = r;
			let o = a.stateFlag(i, 1);
			!o && (r > n || t <= a.maxNode) && (this.reducePos = r), this.pushState(i, o ? n : Math.min(n, this.reducePos)), this.shiftContext(t, n), t <= a.maxNode && this.buffer.push(t, n, r, 4);
		}
	}
	apply(e, t, n, r) {
		e & 65536 ? this.reduce(e) : this.shift(e, t, n, r);
	}
	useNode(e, t, n) {
		let r = this.p.reused.length - 1;
		(r < 0 || this.p.reused[r] != e) && (this.p.reused.push(e), r++);
		let i = this.reducePos = this.pos = n + e.length;
		this.pushState(t, n), this.buffer.push(r, n, i, -1), this.curContext && this.updateContext(this.curContext.tracker.reuse(this.curContext.context, e, this, this.p.stream.reset(this.pos - e.length)));
	}
	split() {
		let t = this, n = t.buffer.length;
		for (n && t.buffer[n - 4] == 0 && (n -= 4); n > 0 && t.buffer[n - 2] > t.reducePos;) n -= 4;
		let r = t.buffer.slice(n), i = t.bufferBase + n;
		for (; t && i == t.bufferBase;) t = t.parent;
		return new e(this.p, this.stack.slice(), this.state, this.reducePos, this.pos, this.score, r, i, this.curContext, this.lookAhead, t);
	}
	recoverByDelete(e, t) {
		let n = e <= this.p.parser.maxNode;
		n && this.storeNode(e, this.pos, t, 4), this.storeNode(0, this.pos, t, n ? 8 : 4), this.pos = this.reducePos = t, this.score -= 190;
	}
	canShift(e) {
		for (let t = new ue(this);;) {
			let n = this.p.parser.stateSlot(t.state, 4) || this.p.parser.hasAction(t.state, e);
			if (n == 0) return !1;
			if (!(n & 65536)) return !0;
			t.reduce(n);
		}
	}
	recoverByInsert(e) {
		if (this.stack.length >= 300) return [];
		let t = this.p.parser.nextStates(this.state);
		if (t.length > 8 || this.stack.length >= 120) {
			let n = [];
			for (let r = 0, i; r < t.length; r += 2) (i = t[r + 1]) != this.state && this.p.parser.hasAction(i, e) && n.push(t[r], i);
			if (this.stack.length < 120) for (let e = 0; n.length < 8 && e < t.length; e += 2) {
				let r = t[e + 1];
				n.some((e, t) => t & 1 && e == r) || n.push(t[e], r);
			}
			t = n;
		}
		let n = [];
		for (let e = 0; e < t.length && n.length < 4; e += 2) {
			let r = t[e + 1];
			if (r == this.state) continue;
			let i = this.split();
			i.pushState(r, this.pos), i.storeNode(0, i.pos, i.pos, 4, !0), i.shiftContext(t[e], this.pos), i.reducePos = this.pos, i.score -= 200, n.push(i);
		}
		return n;
	}
	forceReduce() {
		let { parser: e } = this.p, t = e.stateSlot(this.state, 5);
		if (!(t & 65536)) return !1;
		if (!e.validAction(this.state, t)) {
			let n = t >> 19, r = t & 65535, i = this.stack.length - n * 3;
			if (i < 0 || e.getGoto(this.stack[i], r, !1) < 0) {
				let e = this.findForcedReduction();
				if (e == null) return !1;
				t = e;
			}
			this.storeNode(0, this.pos, this.pos, 4, !0), this.score -= 100;
		}
		return this.reducePos = this.pos, this.reduce(t), !0;
	}
	findForcedReduction() {
		let { parser: e } = this.p, t = [], n = (r, i) => {
			if (!t.includes(r)) return t.push(r), e.allActions(r, (t) => {
				if (!(t & 393216)) {
					if (t & 65536) {
						let n = (t >> 19) - i;
						if (n > 1) {
							let r = t & 65535, i = this.stack.length - n * 3;
							if (i >= 0 && e.getGoto(this.stack[i], r, !1) >= 0) return n << 19 | 65536 | r;
						}
					} else {
						let e = n(t, i + 1);
						if (e != null) return e;
					}
				}
			});
		};
		return n(this.state, 0);
	}
	forceAll() {
		for (; !this.p.parser.stateFlag(this.state, 2);) if (!this.forceReduce()) {
			this.storeNode(0, this.pos, this.pos, 4, !0);
			break;
		}
		return this;
	}
	get deadEnd() {
		if (this.stack.length != 3) return !1;
		let { parser: e } = this.p;
		return e.data[e.stateSlot(this.state, 1)] == 65535 && !e.stateSlot(this.state, 4);
	}
	restart() {
		this.storeNode(0, this.pos, this.pos, 4, !0), this.state = this.stack[0], this.stack.length = 0;
	}
	sameState(e) {
		if (this.state != e.state || this.stack.length != e.stack.length) return !1;
		for (let t = 0; t < this.stack.length; t += 3) if (this.stack[t] != e.stack[t]) return !1;
		return !0;
	}
	get parser() {
		return this.p.parser;
	}
	dialectEnabled(e) {
		return this.p.parser.dialect.flags[e];
	}
	shiftContext(e, t) {
		this.curContext && this.updateContext(this.curContext.tracker.shift(this.curContext.context, e, this, this.p.stream.reset(t)));
	}
	reduceContext(e, t) {
		this.curContext && this.updateContext(this.curContext.tracker.reduce(this.curContext.context, e, this, this.p.stream.reset(t)));
	}
	emitContext() {
		let e = this.buffer.length - 1;
		(e < 0 || this.buffer[e] != -3) && this.storeNode(this.curContext.hash, this.reducePos, this.reducePos, -3, !0);
	}
	emitLookAhead() {
		let e = this.buffer.length - 1;
		(e < 0 || this.buffer[e] != -4) && this.buffer.push(this.lookAhead, this.pos, this.pos, -4);
	}
	updateContext(e) {
		if (e != this.curContext.context) {
			let t = new le(this.curContext.tracker, e);
			t.hash != this.curContext.hash && this.emitContext(), this.curContext = t;
		}
	}
	setLookAhead(e) {
		return e <= this.lookAhead ? !1 : (this.emitLookAhead(), this.lookAhead = e, !0);
	}
	close() {
		this.curContext && this.curContext.tracker.strict && this.emitContext(), this.lookAhead > 0 && this.emitLookAhead();
	}
}, le = class {
	constructor(e, t) {
		this.tracker = e, this.context = t, this.hash = e.strict ? e.hash(t) : 0;
	}
}, ue = class {
	constructor(e) {
		this.start = e, this.state = e.state, this.stack = e.stack, this.base = this.stack.length;
	}
	reduce(e) {
		let t = e & 65535, n = e >> 19;
		n == 0 ? (this.stack == this.start.stack && (this.stack = this.stack.slice()), this.stack.push(this.state, 0, 0), this.base += 3) : this.base -= (n - 1) * 3;
		let r = this.start.p.parser.getGoto(this.stack[this.base - 3], t, !0);
		this.state = r;
	}
}, de = class e {
	constructor(e, t, n) {
		this.stack = e, this.pos = t, this.index = n, this.buffer = e.buffer, this.index == 0 && this.maybeNext();
	}
	static create(t, n = t.bufferBase + t.buffer.length) {
		return new e(t, n, n - t.bufferBase);
	}
	maybeNext() {
		let e = this.stack.parent;
		e != null && (this.index = this.stack.bufferBase - e.bufferBase, this.stack = e, this.buffer = e.buffer);
	}
	get id() {
		return this.buffer[this.index - 4];
	}
	get start() {
		return this.buffer[this.index - 3];
	}
	get end() {
		return this.buffer[this.index - 2];
	}
	get size() {
		return this.buffer[this.index - 1];
	}
	next() {
		this.index -= 4, this.pos -= 4, this.index == 0 && this.maybeNext();
	}
	fork() {
		return new e(this.stack, this.pos, this.index);
	}
};
function B(e, t = Uint16Array) {
	if (typeof e != "string") return e;
	let n = null;
	for (let r = 0, i = 0; r < e.length;) {
		let a = 0;
		for (;;) {
			let t = e.charCodeAt(r++), n = !1;
			if (t == 126) {
				a = 65535;
				break;
			}
			t >= 92 && t--, t >= 34 && t--;
			let i = t - 32;
			if (i >= 46 && (i -= 46, n = !0), a += i, n) break;
			a *= 46;
		}
		n ? n[i++] = a : n = new t(a);
	}
	return n;
}
var V = class {
	constructor() {
		this.start = -1, this.value = -1, this.end = -1, this.extended = -1, this.lookAhead = 0, this.mask = 0, this.context = 0;
	}
}, H = new V(), fe = class {
	constructor(e, t) {
		this.input = e, this.ranges = t, this.chunk = "", this.chunkOff = 0, this.chunk2 = "", this.chunk2Pos = 0, this.next = -1, this.token = H, this.rangeIndex = 0, this.pos = this.chunkPos = t[0].from, this.range = t[0], this.end = t[t.length - 1].to, this.readNext();
	}
	resolveOffset(e, t) {
		let n = this.range, r = this.rangeIndex, i = this.pos + e;
		for (; i < n.from;) {
			if (!r) return null;
			let e = this.ranges[--r];
			i -= n.from - e.to, n = e;
		}
		for (; t < 0 ? i > n.to : i >= n.to;) {
			if (r == this.ranges.length - 1) return null;
			let e = this.ranges[++r];
			i += e.from - n.to, n = e;
		}
		return i;
	}
	clipPos(e) {
		if (e >= this.range.from && e < this.range.to) return e;
		for (let t of this.ranges) if (t.to > e) return Math.max(e, t.from);
		return this.end;
	}
	peek(e) {
		let t = this.chunkOff + e, n, r;
		if (t >= 0 && t < this.chunk.length) n = this.pos + e, r = this.chunk.charCodeAt(t);
		else {
			let t = this.resolveOffset(e, 1);
			if (t == null) return -1;
			if (n = t, n >= this.chunk2Pos && n < this.chunk2Pos + this.chunk2.length) r = this.chunk2.charCodeAt(n - this.chunk2Pos);
			else {
				let e = this.rangeIndex, t = this.range;
				for (; t.to <= n;) t = this.ranges[++e];
				this.chunk2 = this.input.chunk(this.chunk2Pos = n), n + this.chunk2.length > t.to && (this.chunk2 = this.chunk2.slice(0, t.to - n)), r = this.chunk2.charCodeAt(0);
			}
		}
		return n >= this.token.lookAhead && (this.token.lookAhead = n + 1), r;
	}
	acceptToken(e, t = 0) {
		let n = t ? this.resolveOffset(t, -1) : this.pos;
		if (n == null || n < this.token.start) throw RangeError("Token end out of bounds");
		this.token.value = e, this.token.end = n;
	}
	acceptTokenTo(e, t) {
		this.token.value = e, this.token.end = t;
	}
	getChunk() {
		if (this.pos >= this.chunk2Pos && this.pos < this.chunk2Pos + this.chunk2.length) {
			let { chunk: e, chunkPos: t } = this;
			this.chunk = this.chunk2, this.chunkPos = this.chunk2Pos, this.chunk2 = e, this.chunk2Pos = t, this.chunkOff = this.pos - this.chunkPos;
		} else {
			this.chunk2 = this.chunk, this.chunk2Pos = this.chunkPos;
			let e = this.input.chunk(this.pos), t = this.pos + e.length;
			this.chunk = t > this.range.to ? e.slice(0, this.range.to - this.pos) : e, this.chunkPos = this.pos, this.chunkOff = 0;
		}
	}
	readNext() {
		return this.next = this.chunkOff >= this.chunk.length && (this.getChunk(), this.chunkOff == this.chunk.length) ? -1 : this.chunk.charCodeAt(this.chunkOff);
	}
	advance(e = 1) {
		for (this.chunkOff += e; this.pos + e >= this.range.to;) {
			if (this.rangeIndex == this.ranges.length - 1) return this.setDone();
			e -= this.range.to - this.pos, this.range = this.ranges[++this.rangeIndex], this.pos = this.range.from;
		}
		return this.pos += e, this.pos >= this.token.lookAhead && (this.token.lookAhead = this.pos + 1), this.readNext();
	}
	setDone() {
		return this.pos = this.chunkPos = this.end, this.range = this.ranges[this.rangeIndex = this.ranges.length - 1], this.chunk = "", this.next = -1;
	}
	reset(e, t) {
		if (t ? (this.token = t, t.start = e, t.lookAhead = e + 1, t.value = t.extended = -1) : this.token = H, this.pos != e) {
			if (this.pos = e, e == this.end) return this.setDone(), this;
			for (; e < this.range.from;) this.range = this.ranges[--this.rangeIndex];
			for (; e >= this.range.to;) this.range = this.ranges[++this.rangeIndex];
			e >= this.chunkPos && e < this.chunkPos + this.chunk.length ? this.chunkOff = e - this.chunkPos : (this.chunk = "", this.chunkOff = 0), this.readNext();
		}
		return this;
	}
	read(e, t) {
		if (e >= this.chunkPos && t <= this.chunkPos + this.chunk.length) return this.chunk.slice(e - this.chunkPos, t - this.chunkPos);
		if (e >= this.chunk2Pos && t <= this.chunk2Pos + this.chunk2.length) return this.chunk2.slice(e - this.chunk2Pos, t - this.chunk2Pos);
		if (e >= this.range.from && t <= this.range.to) return this.input.read(e, t);
		let n = "";
		for (let r of this.ranges) {
			if (r.from >= t) break;
			r.to > e && (n += this.input.read(Math.max(r.from, e), Math.min(r.to, t)));
		}
		return n;
	}
}, U = class {
	constructor(e, t) {
		this.data = e, this.id = t;
	}
	token(e, t) {
		let { parser: n } = t.p;
		W(this.data, e, t, this.id, n.data, n.tokenPrecTable);
	}
};
U.prototype.contextual = U.prototype.fallback = U.prototype.extend = !1;
var pe = class {
	constructor(e, t, n) {
		this.precTable = t, this.elseToken = n, this.data = typeof e == "string" ? B(e) : e;
	}
	token(e, t) {
		let n = e.pos, r = 0;
		for (;;) {
			let n = e.next < 0, i = e.resolveOffset(1, 1);
			if (W(this.data, e, t, 0, this.data, this.precTable), e.token.value > -1) break;
			if (this.elseToken == null) return;
			if (n || r++, i == null) break;
			e.reset(i, e.token);
		}
		r && (e.reset(n, e.token), e.acceptToken(this.elseToken, r));
	}
};
pe.prototype.contextual = U.prototype.fallback = U.prototype.extend = !1;
function W(e, t, n, r, i, a) {
	let o = 0, s = 1 << r, { dialect: c } = n.p.parser;
	scan: for (; (s & e[o]) != 0;) {
		let n = e[o + 1];
		for (let r = o + 3; r < n; r += 2) if ((e[r + 1] & s) > 0) {
			let n = e[r];
			if (c.allows(n) && (t.token.value == -1 || t.token.value == n || he(n, t.token.value, i, a))) {
				t.acceptToken(n);
				break;
			}
		}
		let r = t.next, l = 0, u = e[o + 2];
		if (t.next < 0 && u > l && e[n + u * 3 - 3] == 65535) {
			o = e[n + u * 3 - 1];
			continue scan;
		}
		for (; l < u;) {
			let i = l + u >> 1, a = n + i + (i << 1), s = e[a], c = e[a + 1] || 65536;
			if (r < s) u = i;
			else if (r >= c) l = i + 1;
			else {
				o = e[a + 2], t.advance();
				continue scan;
			}
		}
		break;
	}
}
function me(e, t, n) {
	for (let r = t, i; (i = e[r]) != 65535; r++) if (i == n) return r - t;
	return -1;
}
function he(e, t, n, r) {
	let i = me(n, r, t);
	return i < 0 || me(n, r, e) < i;
}
var G = typeof process < "u" && process.env && /\bparse\b/.test(process.env.LOG), ge = null;
function _e(e, t, n) {
	let r = e.cursor(T.IncludeAnonymous);
	for (r.moveTo(t);;) if (!(n < 0 ? r.childBefore(t) : r.childAfter(t))) for (;;) {
		if ((n < 0 ? r.to < t : r.from > t) && !r.type.isError) return n < 0 ? Math.max(0, Math.min(r.to - 1, t - 25)) : Math.min(e.length, Math.max(r.from + 1, t + 25));
		if (n < 0 ? r.prevSibling() : r.nextSibling()) break;
		if (!r.parent()) return n < 0 ? 0 : e.length;
	}
}
var ve = class {
	constructor(e, t) {
		this.fragments = e, this.minRepeat = t, this.i = 0, this.fragment = null, this.safeFrom = -1, this.safeTo = -1, this.trees = [], this.start = [], this.index = [], this.lastRepeat = null, this.lastRepeatPos = -1, this.nextFragment();
	}
	nextFragment() {
		let e = this.fragment = this.i == this.fragments.length ? null : this.fragments[this.i++];
		if (e) {
			for (this.safeFrom = e.openStart ? _e(e.tree, e.from + e.offset, 1) - e.offset : e.from, this.safeTo = e.openEnd ? _e(e.tree, e.to + e.offset, -1) - e.offset : e.to; this.trees.length;) this.trees.pop(), this.start.pop(), this.index.pop();
			this.trees.push(e.tree), this.start.push(-e.offset), this.index.push(0), this.nextStart = this.safeFrom;
		} else this.nextStart = 1e9;
	}
	nodeAt(e) {
		if (e < this.nextStart) return null;
		for (; this.fragment && this.safeTo <= e;) this.nextFragment();
		if (!this.fragment) return null;
		for (;;) {
			let t = this.trees.length - 1;
			if (t < 0) return this.nextFragment(), null;
			if (e < this.safeFrom) return null;
			let n = this.trees[t], r = this.index[t];
			if (r == n.children.length) {
				this.trees.pop(), this.start.pop(), this.index.pop();
				continue;
			}
			let i = n.children[r], a = this.start[t] + n.positions[r];
			if (a > e) return this.nextStart = a, null;
			if (i instanceof E) {
				let n = a > this.lastRepeatPos && i.type.id >= this.minRepeat;
				if (a == e || n) {
					let t = a + i.length, r;
					if (a >= this.safeFrom && t <= this.safeTo && (!(r = i.prop(v.lookAhead)) || t + r < this.fragment.to) && (n && (this.lastRepeat = i, this.lastRepeatPos = a), a == e)) return i;
				}
				this.index[t]++, a + i.length >= Math.max(this.safeFrom, e) && (this.trees.push(i), this.start.push(a), this.index.push(0));
			} else this.index[t]++, this.nextStart = a + i.length;
		}
	}
}, ye = class {
	constructor(e, t) {
		this.stream = t, this.tokens = [], this.mainToken = null, this.actions = [], this.tokens = e.tokenizers.map((e) => new V());
	}
	getActions(e) {
		let t = 0, n = null, { parser: r } = e.p, { tokenizers: i } = r, a = r.stateSlot(e.state, 3), o = e.curContext ? e.curContext.hash : 0, s = 0;
		for (let r = 0; r < i.length; r++) {
			if (!(1 << r & a)) continue;
			let c = i[r], l = this.tokens[r];
			if ((!n || c.fallback) && ((c.contextual || l.start != e.pos || l.mask != a || l.context != o) && (this.updateCachedToken(l, c, e), l.mask = a, l.context = o), l.lookAhead > l.end + 25 && (s = Math.max(l.lookAhead, s)), l.value != 0)) {
				let r = t;
				if (l.extended > -1 && (t = this.addActions(e, l.extended, l.end, t)), t = this.addActions(e, l.value, l.end, t), !c.extend && (n = l, t > r)) break;
			}
		}
		for (; this.actions.length > t;) this.actions.pop();
		return s && e.setLookAhead(s), !n && e.pos == this.stream.end && (n = new V(), n.value = e.p.parser.eofTerm, n.start = n.end = e.pos, t = this.addActions(e, n.value, n.end, t)), this.mainToken = n, this.actions;
	}
	getMainToken(e) {
		if (this.mainToken) return this.mainToken;
		let t = new V(), { pos: n, p: r } = e;
		return t.start = n, t.end = Math.min(n + 1, r.stream.end), t.value = n == r.stream.end ? r.parser.eofTerm : 0, t;
	}
	updateCachedToken(e, t, n) {
		let r = this.stream.clipPos(n.pos);
		if (t.token(this.stream.reset(r, e), n), e.value > -1) {
			let { parser: t } = n.p;
			for (let r = 0; r < t.specialized.length; r++) if (t.specialized[r] == e.value) {
				let i = t.specializers[r](this.stream.read(e.start, e.end), n);
				if (i >= 0 && n.p.parser.dialect.allows(i >> 1)) {
					i & 1 ? e.extended = i >> 1 : e.value = i >> 1;
					break;
				}
			}
		} else e.value = 0, e.end = this.stream.clipPos(r + 1);
	}
	putAction(e, t, n, r) {
		for (let t = 0; t < r; t += 3) if (this.actions[t] == e) return r;
		return this.actions[r++] = e, this.actions[r++] = t, this.actions[r++] = n, r;
	}
	addActions(e, t, n, r) {
		let { state: i } = e, { parser: a } = e.p, { data: o } = a;
		for (let e = 0; e < 2; e++) for (let s = a.stateSlot(i, e ? 2 : 1);; s += 3) {
			if (o[s] == 65535) {
				if (o[s + 1] == 1) s = K(o, s + 2);
				else {
					r == 0 && o[s + 1] == 2 && (r = this.putAction(K(o, s + 2), t, n, r));
					break;
				}
			}
			o[s] == t && (r = this.putAction(K(o, s + 1), t, n, r));
		}
		return r;
	}
}, be = class {
	constructor(e, t, n, r) {
		this.parser = e, this.input = t, this.ranges = r, this.recovering = 0, this.nextStackID = 9812, this.minStackPos = 0, this.reused = [], this.stoppedAt = null, this.lastBigReductionStart = -1, this.lastBigReductionSize = 0, this.bigReductionCount = 0, this.stream = new fe(t, r), this.tokens = new ye(e, this.stream), this.topTerm = e.top[1];
		let { from: i } = r[0];
		this.stacks = [ce.start(this, e.top[0], i)], this.fragments = n.length && this.stream.end - i > e.bufferLength * 4 ? new ve(n, e.minRepeatTerm) : null;
	}
	get parsedPos() {
		return this.minStackPos;
	}
	advance() {
		let e = this.stacks, t = this.minStackPos, n = this.stacks = [], r, i;
		if (this.bigReductionCount > 300 && e.length == 1) {
			let [t] = e;
			for (; t.forceReduce() && t.stack.length && t.stack[t.stack.length - 2] >= this.lastBigReductionStart;);
			this.bigReductionCount = this.lastBigReductionSize = 0;
		}
		for (let a = 0; a < e.length; a++) {
			let o = e[a];
			for (;;) {
				if (this.tokens.mainToken = null, o.pos > t) n.push(o);
				else if (this.advanceStack(o, n, e)) continue;
				else {
					r || (r = [], i = []), r.push(o);
					let e = this.tokens.getMainToken(o);
					i.push(e.value, e.end);
				}
				break;
			}
		}
		if (!n.length) {
			let e = r && we(r);
			if (e) return G && console.log("Finish with " + this.stackID(e)), this.stackToTree(e);
			if (this.parser.strict) throw G && r && console.log("Stuck with token " + (this.tokens.mainToken ? this.parser.getName(this.tokens.mainToken.value) : "none")), SyntaxError("No parse at " + t);
			this.recovering ||= 5;
		}
		if (this.recovering && r) {
			let e = this.stoppedAt != null && r[0].pos > this.stoppedAt ? r[0] : this.runRecovery(r, i, n);
			if (e) return G && console.log("Force-finish " + this.stackID(e)), this.stackToTree(e.forceAll());
		}
		if (this.recovering) {
			let e = this.recovering == 1 ? 1 : this.recovering * 3;
			if (n.length > e) for (n.sort((e, t) => t.score - e.score); n.length > e;) n.pop();
			n.some((e) => e.reducePos > t) && this.recovering--;
		} else if (n.length > 1) {
			outer: for (let e = 0; e < n.length - 1; e++) {
				let t = n[e];
				for (let r = e + 1; r < n.length; r++) {
					let i = n[r];
					if (t.sameState(i) || t.buffer.length > 500 && i.buffer.length > 500) {
						if ((t.score - i.score || t.buffer.length - i.buffer.length) > 0) n.splice(r--, 1);
						else {
							n.splice(e--, 1);
							continue outer;
						}
					}
				}
			}
			n.length > 12 && (n.sort((e, t) => t.score - e.score), n.splice(12, n.length - 12));
		}
		this.minStackPos = n[0].pos;
		for (let e = 1; e < n.length; e++) n[e].pos < this.minStackPos && (this.minStackPos = n[e].pos);
		return null;
	}
	stopAt(e) {
		if (this.stoppedAt != null && this.stoppedAt < e) throw RangeError("Can't move stoppedAt forward");
		this.stoppedAt = e;
	}
	tryReuse(e, t, n, r) {
		if (!n) return null;
		let i = e.curContext && e.curContext.tracker.strict, a = i ? e.curContext.hash : 0;
		for (; n;) {
			let o = this.parser.nodeSet.types[n.type.id] == n.type ? this.parser.getGoto(e.state, n.type.id) : -1;
			if (o > -1 && n.length && (!i || (n.prop(v.contextHash) || 0) == a)) return e.useNode(n, o, t), n;
			if (n.children.length == 0 || n.positions[0] > 0) break;
			let s = n.children[0];
			if (s instanceof E && (!r || s.type.id >= this.parser.minRepeatTerm)) n = s;
			else break;
		}
		return null;
	}
	advanceStack(e, t, n) {
		let r = e.pos, { parser: i } = this, a = G ? this.stackID(e) + " -> " : "";
		if (this.stoppedAt != null && r > this.stoppedAt) return e.forceReduce() ? e : null;
		if (this.fragments) {
			let t = e.reducePos < r && e.buffer.length && e.buffer[e.buffer.length - 2] <= e.reducePos && this.fragments.lastRepeatPos == e.reducePos && this.tryReuse(e, e.reducePos, this.fragments.lastRepeat, !0) || this.tryReuse(e, r, this.fragments.nodeAt(r), !1);
			if (t) return G && console.log(a + this.stackID(e) + ` (via reuse of ${i.getName(t.type.id)})`), !0;
		}
		let o = i.stateSlot(e.state, 4);
		if (o > 0) return e.reduce(o), G && console.log(a + this.stackID(e) + ` (via always-reduce ${i.getName(o & 65535)})`), !0;
		if (e.stack.length >= 8400) for (; e.stack.length > 6e3 && e.forceReduce(););
		let s = this.tokens.getActions(e);
		for (let o = 0; o < s.length;) {
			let c = s[o++], l = s[o++], u = s[o++], d = o == s.length || !n, f = d ? e : e.split(), p = this.tokens.mainToken;
			if (f.apply(c, l, p ? p.start : f.pos, u), G && console.log(a + this.stackID(f) + ` (via ${c & 65536 ? `reduce of ${i.getName(c & 65535)}` : "shift"} for ${i.getName(l)} @ ${r}${f == e ? "" : ", split"})`), d) return !0;
			f.pos > r ? t.push(f) : n.push(f);
		}
		return !1;
	}
	advanceFully(e, t) {
		let n = e.pos;
		for (;;) {
			if (!this.advanceStack(e, null, null)) return !1;
			if (e.pos > n) return xe(e, t), !0;
		}
	}
	runRecovery(e, t, n) {
		let r = null, i = !1;
		for (let a = 0; a < e.length; a++) {
			let o = e[a], s = t[a << 1], c = t[(a << 1) + 1], l = G ? this.stackID(o) + " -> " : "";
			if (o.deadEnd && (i || (i = !0, o.restart(), G && console.log(l + this.stackID(o) + " (restarted)"), this.advanceFully(o, n)))) continue;
			let u = o.split(), d = l;
			for (let e = 0; e < 10 && u.forceReduce() && (G && console.log(d + this.stackID(u) + " (via force-reduce)"), !this.advanceFully(u, n)); e++) G && (d = this.stackID(u) + " -> ");
			for (let e of o.recoverByInsert(s)) G && console.log(l + this.stackID(e) + " (via recover-insert)"), this.advanceFully(e, n);
			this.stream.end > o.pos ? (c == o.pos && (c++, s = 0), o.recoverByDelete(s, c), G && console.log(l + this.stackID(o) + ` (via recover-delete ${this.parser.getName(s)})`), xe(o, n)) : (!r || r.score < u.score) && (r = u);
		}
		return r;
	}
	stackToTree(e) {
		return e.close(), E.build({
			buffer: de.create(e),
			nodeSet: this.parser.nodeSet,
			topID: this.topTerm,
			maxBufferLength: this.parser.bufferLength,
			reused: this.reused,
			start: this.ranges[0].from,
			length: e.pos - this.ranges[0].from,
			minRepeatType: this.parser.minRepeatTerm
		});
	}
	stackID(e) {
		let t = (ge ||= /* @__PURE__ */ new WeakMap()).get(e);
		return t || ge.set(e, t = String.fromCodePoint(this.nextStackID++)), t + e;
	}
};
function xe(e, t) {
	for (let n = 0; n < t.length; n++) {
		let r = t[n];
		if (r.pos == e.pos && r.sameState(e)) {
			t[n].score < e.score && (t[n] = e);
			return;
		}
	}
	t.push(e);
}
var Se = class {
	constructor(e, t, n) {
		this.source = e, this.flags = t, this.disabled = n;
	}
	allows(e) {
		return !this.disabled || this.disabled[e] == 0;
	}
}, Ce = class e extends oe {
	constructor(e) {
		if (super(), this.wrappers = [], e.version != 14) throw RangeError(`Parser version (${e.version}) doesn't match runtime version (14)`);
		let t = e.nodeNames.split(" ");
		this.minRepeatTerm = t.length;
		for (let n = 0; n < e.repeatNodeCount; n++) t.push("");
		let n = Object.keys(e.topRules).map((t) => e.topRules[t][1]), r = [];
		for (let e = 0; e < t.length; e++) r.push([]);
		function i(e, t, n) {
			r[e].push([t, t.deserialize(String(n))]);
		}
		if (e.nodeProps) for (let t of e.nodeProps) {
			let e = t[0];
			typeof e == "string" && (e = v[e]);
			for (let n = 1; n < t.length;) {
				let r = t[n++];
				if (r >= 0) i(r, e, t[n++]);
				else {
					let a = t[n + -r];
					for (let o = -r; o > 0; o--) i(t[n++], e, a);
					n++;
				}
			}
		}
		this.nodeSet = new S(t.map((t, i) => x.define({
			name: i >= this.minRepeatTerm ? void 0 : t,
			id: i,
			props: r[i],
			top: n.indexOf(i) > -1,
			error: i == 0,
			skipped: e.skippedNodes && e.skippedNodes.indexOf(i) > -1
		}))), e.propSources && (this.nodeSet = this.nodeSet.extend(...e.propSources)), this.strict = !1, this.bufferLength = h;
		let a = B(e.tokenData);
		this.context = e.context, this.specializerSpecs = e.specialized || [], this.specialized = new Uint16Array(this.specializerSpecs.length);
		for (let e = 0; e < this.specializerSpecs.length; e++) this.specialized[e] = this.specializerSpecs[e].term;
		this.specializers = this.specializerSpecs.map(Te), this.states = B(e.states, Uint32Array), this.data = B(e.stateData), this.goto = B(e.goto), this.maxTerm = e.maxTerm, this.tokenizers = e.tokenizers.map((e) => typeof e == "number" ? new U(a, e) : e), this.topRules = e.topRules, this.dialects = e.dialects || {}, this.dynamicPrecedences = e.dynamicPrecedences || null, this.tokenPrecTable = e.tokenPrec, this.termNames = e.termNames || null, this.maxNode = this.nodeSet.types.length - 1, this.dialect = this.parseDialect(), this.top = this.topRules[Object.keys(this.topRules)[0]];
	}
	createParse(e, t, n) {
		let r = new be(this, e, t, n);
		for (let i of this.wrappers) r = i(r, e, t, n);
		return r;
	}
	getGoto(e, t, n = !1) {
		let r = this.goto;
		if (t >= r[0]) return -1;
		for (let i = r[t + 1];;) {
			let t = r[i++], a = t & 1, o = r[i++];
			if (a && n) return o;
			for (let n = i + (t >> 1); i < n; i++) if (r[i] == e) return o;
			if (a) return -1;
		}
	}
	hasAction(e, t) {
		let n = this.data;
		for (let r = 0; r < 2; r++) for (let i = this.stateSlot(e, r ? 2 : 1), a;; i += 3) {
			if ((a = n[i]) == 65535) {
				if (n[i + 1] == 1) a = n[i = K(n, i + 2)];
				else if (n[i + 1] == 2) return K(n, i + 2);
				else break;
			}
			if (a == t || a == 0) return K(n, i + 1);
		}
		return 0;
	}
	stateSlot(e, t) {
		return this.states[e * 6 + t];
	}
	stateFlag(e, t) {
		return (this.stateSlot(e, 0) & t) > 0;
	}
	validAction(e, t) {
		return !!this.allActions(e, (e) => e == t || null);
	}
	allActions(e, t) {
		let n = this.stateSlot(e, 4), r = n ? t(n) : void 0;
		for (let n = this.stateSlot(e, 1); r == null; n += 3) {
			if (this.data[n] == 65535) {
				if (this.data[n + 1] == 1) n = K(this.data, n + 2);
				else break;
			}
			r = t(K(this.data, n + 1));
		}
		return r;
	}
	nextStates(e) {
		let t = [];
		for (let n = this.stateSlot(e, 1);; n += 3) {
			if (this.data[n] == 65535) {
				if (this.data[n + 1] == 1) n = K(this.data, n + 2);
				else break;
			}
			if (!(this.data[n + 2] & 1)) {
				let e = this.data[n + 1];
				t.some((t, n) => n & 1 && t == e) || t.push(this.data[n], e);
			}
		}
		return t;
	}
	configure(t) {
		let n = Object.assign(Object.create(e.prototype), this);
		if (t.props && (n.nodeSet = this.nodeSet.extend(...t.props)), t.top) {
			let e = this.topRules[t.top];
			if (!e) throw RangeError(`Invalid top rule name ${t.top}`);
			n.top = e;
		}
		return t.tokenizers && (n.tokenizers = this.tokenizers.map((e) => {
			let n = t.tokenizers.find((t) => t.from == e);
			return n ? n.to : e;
		})), t.specializers && (n.specializers = this.specializers.slice(), n.specializerSpecs = this.specializerSpecs.map((e, r) => {
			let i = t.specializers.find((t) => t.from == e.external);
			if (!i) return e;
			let a = Object.assign(Object.assign({}, e), { external: i.to });
			return n.specializers[r] = Te(a), a;
		})), t.contextTracker && (n.context = t.contextTracker), t.dialect && (n.dialect = this.parseDialect(t.dialect)), t.strict != null && (n.strict = t.strict), t.wrap && (n.wrappers = n.wrappers.concat(t.wrap)), t.bufferLength != null && (n.bufferLength = t.bufferLength), n;
	}
	hasWrappers() {
		return this.wrappers.length > 0;
	}
	getName(e) {
		return this.termNames ? this.termNames[e] : String(e <= this.maxNode && this.nodeSet.types[e].name || e);
	}
	get eofTerm() {
		return this.maxNode + 1;
	}
	get topNode() {
		return this.nodeSet.types[this.top[1]];
	}
	dynamicPrecedence(e) {
		let t = this.dynamicPrecedences;
		return t == null ? 0 : t[e] || 0;
	}
	parseDialect(e) {
		let t = Object.keys(this.dialects), n = t.map(() => !1);
		if (e) for (let r of e.split(" ")) {
			let e = t.indexOf(r);
			e >= 0 && (n[e] = !0);
		}
		let r = null;
		for (let e = 0; e < t.length; e++) if (!n[e]) for (let n = this.dialects[t[e]], i; (i = this.data[n++]) != 65535;) (r ||= new Uint8Array(this.maxTerm + 1))[i] = 1;
		return new Se(e, n, r);
	}
	static deserialize(t) {
		return new e(t);
	}
};
function K(e, t) {
	return e[t] | e[t + 1] << 16;
}
function we(e) {
	let t = null;
	for (let n of e) {
		let e = n.p.stoppedAt;
		(n.pos == n.p.stream.end || e != null && n.pos > e) && n.p.parser.stateFlag(n.state, 2) && (!t || t.score < n.score) && (t = n);
	}
	return t;
}
function Te(e) {
	if (e.external) {
		let t = +!!e.extend;
		return (n, r) => e.external(n, r) << 1 | t;
	}
	return e.get;
}
// src/dsl/grammar/dav.grammar
var Ee = {
	__proto__: null,
	dav: 10,
	title: 16,
	group: 22,
	desc: 36,
	true: 44,
	false: 46,
	node: 58,
	step: 68,
	focus: 76,
	state: 80,
	animate: 84,
	code: 91
}, De = Ce.deserialize({
	version: 14,
	states: ".WQkQPOOOrQPO'#CzOOQO'#Dg'#DgOOQO'#D^'#D^QYQPOOQYQPOOOwQPO'#C_O|QPO'#CcO!RQPO'#CxO!WQPO'#CfO!]QPO'#C}O!bQPO,59fOOQO-E7[-E7[OOQO,58y,58yOOQO,58},58}O!gQPO,59dO#UQPO,59QO#aQPO,59iO#fQPO1G/QOOQO'#Ch'#ChO$QQPO'#CkOOQO1G/O1G/OO$]QPO1G/OO$wQPO'#CwOOQO1G.l1G.lO#[QPO1G.lO#XQPO1G.lO%SQPO'#DPOOQO1G/T1G/TO%eQPO'#C|OOQO7+$l7+$lO%jQPO7+$lOOQO'#Cm'#CmO&RQPO'#ClOOQO,59V,59VO&WQPO,59VOOQO7+$j7+$jOOQO'#D`'#D`O&`QPO,59cOOQO,59c,59cOOQO7+$W7+$WO#[QPO7+$WOOQO'#Di'#DiOOQO'#Da'#DaO&kQPO,59kOOQO,59k,59kO&|QPO'#DQO'RQPO'#DRO'WQPO'#DTO']QPO'#DVOOQO,59h,59hOOQO<<HW<<HWO'bQPO,59WO'vQPO1G.qO(RQPO1G.qOOQO1G.q1G.qOOQO-E7^-E7^OOQO1G.}1G.}OOQO<<Gr<<GrOOQO-E7_-E7_OOQO1G/V1G/VOOQO,59l,59lO(ZQPO,59mO(oQPO,59oO(tQPO,59qOOQO'#Dh'#DhOOQO1G.r1G.rOOQO'#Cq'#CqOOQO,59y,59yOOQO7+$]7+$]O(yQPO7+$]OOQO-E7]-E7]O)UQPO'#DbO)ZQPO1G/XOOQO1G/Z1G/ZO)oQPO1G/]OOQO<<Gw<<GwP)tQPO'#D_OOQO,59|,59|OOQO-E7`-E7`O)|QPO7+$wO*hQPO'#DXOOQO<<Hc<<HcO*sQPO<<HcO+XQPO<<HcOOQO'#Dc'#DcO+`QPO,59sOOQO,59s,59sO+kQPO'#DYOOQOAN=}AN=}O+yQPOAN=}OOQO-E7a-E7aOOQO1G/_1G/_OOQO'#D['#D[O,_QPO,59tOOQO,59t,59tO,mQPO,59tOOQOG23iG23iOOQO1G/`1G/`O,uQPO1G/`OOQO7+$z7+$z",
	stateData: "-T~O!YOSPOS~OSPOWVOZXOmWOrYO~OTUO~PYOoZO~OU]O~OX^O~OS_O~OS`O~OXaO~OSbO~OXcO^dOSlaWlaZlamlarla!Wlaila~OXcO^dOjgO~OjkO~O^dOcmOSniWniZnimnirni!Wni~OSpO]rObpO~O^dOSliWliZlimlirli!Wliili~OZXOiwOmWO~Ob!OOi}Ov!POx!QOz!RO~OX!SO~O^dOSnqWnqZnqmnqrnq!Wnq~Oc!UO~O]!XOh!VO~OZXOi!ZOmWO~Ob!OOi!^Ov!POx!QOz!RO~OX!_O~OS!`O~OS!aO~OS!bO~OS!cOU!cOX!cOd!cOf!eOg!eO~OSpO]!gObpO~O]!gOh!hO~Oh!jObuaiuavuaxuazua~O^dO~Oo!mO~OSpO]!nObpO~OS!pO~Oh!jObuiiuivuixuizui~OS!rO~OSpObpO~O^dOcmOj!sObyqiyqvyqxyqzyq~Ob!OOi!yO}!zO~Oj!sObyyiyyvyyxyyzyy~O^dO~P*sOb!OOi#OO}!zO~OS#POT#POX#QO!P#RO~Oj!sOby!Riy!Rvy!Rxy!Rzy!R~O!P#UOb|ai|a}|a~OX#VO!P#UO~O!P#WOb|ii|i}|i~O",
	goto: "%u!^PPP!_PPP!bPP!gP!pPP!v#c#kPPP#qPPPPP#t!gP!bP$O!bP$U$X$aP$aP$aP$e$]P$oP$r$y%P%V%]%cPPP%i%n%qRTOVQOSTUQOSTTugvQf_Rj`Qe_Qi`QnbQtfQyjQ!ToQ!l!aQ!u!rR!|!vQsdV!f!V!h!oXqd!V!h!oR!c!UQh`SxijR![yQobR!v!rRlaSzk|T!w!s!xTzk|Q!t!rS!{!u!vR#T!|R#S!zSSOTR[SQ!WsR!i!WQvgR!YvQ|kR!]|Q!k!`R!q!kQ!x!sR!}!xVROSTR!d!UT{k|",
	nodeNames: "⚠ LineComment Document Header Identifier dav Number Title title String Group group Label ] [ Attributes Attribute AttrName desc : Color Boolean true false , } { GroupBody Node node Edge Arrow EdgeLabel Step step StepBody Desc Focus focus State state Animate animate AnimateBody Code code CodeLang CodeFence",
	maxTerm: 59,
	nodeProps: [[
		"openedBy",
		13,
		"[",
		25,
		"{"
	], [
		"closedBy",
		14,
		"]",
		26,
		"}"
	]],
	skippedNodes: [0, 1],
	repeatNodeCount: 6,
	tokenData: "*h~RkX^!vpq!vrs#kst%_|}%y}!O&O!O!P&}!P!Q'T!Q![&d![!]'r!^!_'w!c!}(Q!}#O(c#P#Q(h#R#S(Q#S#T(m#T#o(Q#o#p*^#q#r*c#y#z!v$f$g!v#BY#BZ!v$IS$I_!v$I|$JO!v$JT$JU!v$KV$KW!v&FU&FV!v~!{Y!Y~X^!vpq!v#y#z!v$f$g!v#BY#BZ!v$IS$I_!v$I|$JO!v$JT$JU!v$KV$KW!v&FU&FV!v~#nWOY#kZr#krs$Ws#O#k#O#P$]#P;'S#k;'S;=`%X<%lO#k~$]OX~~$`RO;'S#k;'S;=`$i;=`O#k~$lXOY#kZr#krs$Ws#O#k#O#P$]#P;'S#k;'S;=`%X;=`<%l#k<%lO#k~%[P;=`<%l#k~%bR!Q![%k!c!}%k#T#o%k~%pRd~!Q![%k!c!}%k#T#o%k~&OOh~~&RQ}!O&X!Q![&d~&[P!`!a&_~&dOo~~&iQU~!O!P&o!Q![&d~&rP!Q![&u~&zPU~!Q![&u~'QP!O!P&X~'WP!P!Q'Z~'`SP~OY'ZZ;'S'Z;'S;=`'l<%lO'Z~'oP;=`<%l'Z~'wOc~~'zQ}!O&X!O!P&X~(VSS~!Q![(Q!c!}(Q#R#S(Q#T#o(Q~(hO^~~(mO]~~(pP#S#T(s~(vP#S#T(y~(|TO#S(y#S#T)]#T;'S(y;'S;=`*W<%lO(y~)`TO#S(y#S#T)o#T;'S(y;'S;=`*W<%lO(y~)rTO#S(y#S#T*R#T;'S(y;'S;=`*W<%lO(y~*WO!P~~*ZP;=`<%l(y~*cOj~~*hOi~",
	tokenizers: [0],
	topRules: { Document: [0, 2] },
	specialized: [{
		term: 4,
		get: (e) => Ee[e] || -1
	}],
	tokenPrec: 0
}), Oe = /* @__PURE__ */ new Set([
	"String",
	"Number",
	"Color",
	"Identifier",
	"Boolean"
]);
function ke(e) {
	return De.parse(e);
}
function q(e) {
	let t = [];
	for (let n = e.firstChild; n; n = n.nextSibling) t.push(n);
	return t;
}
function Ae(e) {
	for (let t = e.firstChild; t; t = t.nextSibling) if (Oe.has(t.name)) return t;
	return null;
}
function J(e, t) {
	return e.slice(t.from, t.to);
}
function je(e) {
	let t = [], n = e.length >= 2 && e.endsWith("\""), r = e.slice(1, n ? -1 : void 0), i = "";
	for (let e = 0; e < r.length; e++) {
		let n = r[e];
		if (n !== "\\") {
			i += n;
			continue;
		}
		let a = r[e + 1];
		switch (a) {
			case "\"":
				i += "\"";
				break;
			case "\\":
				i += "\\";
				break;
			case "n":
				i += "\n";
				break;
			case "t":
				i += "	";
				break;
			default: t.push({
				offset: e + 1,
				sequence: `\\${a ?? ""}`
			}), i += `\\${a ?? ""}`;
		}
		e++;
	}
	return {
		value: i,
		invalid: t
	};
}
function Me(e) {
	let t = e.startsWith("```"), n = e.length >= (t ? 6 : 3) && e.endsWith("```");
	return m(e.slice(t ? 3 : 0, n ? -3 : void 0));
}
// src/dsl/attributes.ts
var Ne = {
	string: "\"...\"",
	bool: "true | false",
	color: r.join(" | "),
	stateColor: [...r, a].join(" | "),
	icon: t.join(" | "),
	ident: "identifier"
};
function Pe(e, t, n) {
	let { value: r, invalid: i } = je(J(e, t));
	for (let e of i) {
		let r = t.from + e.offset;
		n("invalid-escape", "error", {
			from: r,
			to: r + e.sequence.length
		}, { sequence: e.sequence });
	}
	return r;
}
function Fe(e, t, n, r) {
	let i = /* @__PURE__ */ new Map();
	if (t) {
		let a = c[n], o = /* @__PURE__ */ new Set();
		for (let s of t.getChildren("Attribute")) {
			let t = s.getChild("AttrName"), c = Ae(s);
			if (!t || !c) continue;
			let l = J(e, t), u = Object.hasOwn(a, l) ? a[l] : void 0;
			if (!u) {
				r("unknown-attribute", "warning", t, {
					name: l,
					owner: n
				});
				continue;
			}
			o.has(l) && r("duplicate-attribute", "warning", t, { name: l }), o.add(l);
			let d = Ie(e, l, u, c, r);
			d !== void 0 && i.set(l, {
				value: d,
				node: c
			});
		}
	}
	return {
		entries: i,
		get: (e) => i.get(e),
		value: (e) => i.get(e)?.value
	};
}
function Ie(e, t, n, r, i) {
	let a = J(e, r), o = () => {
		i("invalid-attribute-value", "error", r, {
			name: t,
			expected: Ne[n]
		});
	};
	switch (n) {
		case "string": return r.name === "String" ? Pe(e, r, i) : o();
		case "bool": return r.name === "Boolean" ? a === "true" : o();
		case "ident": return r.name === "Identifier" ? a : o();
		case "color":
		case "stateColor": return r.name !== "Identifier" && r.name !== "Color" ? o() : Le(a, r, n === "stateColor", i);
		case "icon": return r.name === "Identifier" ? Re(a, r, i) : o();
	}
}
function Le(e, t, n, o) {
	let s = e.toLowerCase();
	if (i(s)) return s;
	if (n && s === "none") return a;
	o("invalid-color", "error", t, {
		value: e,
		suggestion: (t.name === "Color" ? void 0 : f(e, r)) ?? "",
		names: (n ? [...r, a] : r).join(", ")
	});
}
function Re(e, r, i) {
	let a = e.toLowerCase();
	if (n(a)) return a;
	i("unknown-icon", "error", r, {
		icon: e,
		suggestion: f(e, t) ?? ""
	});
}
// src/dsl/sourceMap.ts
function Y(e) {
	return {
		from: e.from,
		to: e.to
	};
}
// src/dsl/analyze.ts
var ze = {
	style: "solid",
	direction: "forward"
};
function Be(e) {
	return new Ve(e).run();
}
var Ve = class {
	text;
	diagnostics = [];
	elements = /* @__PURE__ */ new Map();
	stepRanges = [];
	references = [];
	stateChecks = [];
	doc = {
		version: 1,
		title: "",
		groups: [],
		nodes: [],
		edges: [],
		steps: []
	};
	titleSeen = !1;
	reportFn = (e, t, n, r = {}) => {
		this.report(e, t, n, r);
	};
	constructor(e) {
		this.text = e;
	}
	run() {
		let e = ke(this.text).topNode;
		this.collectSyntaxErrors(e);
		let t = e.getChild("Header");
		t ? this.readHeader(t) : this.report("missing-header", "error", {
			from: 0,
			to: 0
		});
		for (let t of q(e)) switch (t.name) {
			case "Title":
				this.readTitle(t);
				break;
			case "Group":
				this.readGroup(t, void 0);
				break;
			case "Node":
				this.readNode(t, void 0);
				break;
			case "Edge":
				this.readEdge(t);
				break;
			case "Step": this.readStep(t);
		}
		return this.resolveReferences(), this.diagnostics.sort((e, t) => e.from - t.from || e.to - t.to), {
			document: this.doc,
			diagnostics: this.diagnostics,
			sourceMap: {
				elements: this.elements,
				steps: this.stepRanges
			}
		};
	}
	collectSyntaxErrors(e) {
		let t = /* @__PURE__ */ new Set(), n = e.cursor();
		do {
			if (!n.type.isError || t.has(n.from)) continue;
			if (t.add(n.from), n.from >= this.text.trimEnd().length) {
				if (t.size > 1) continue;
				let e = this.text.length;
				this.report("unexpected-eof", "error", {
					from: e,
					to: e
				});
				continue;
			}
			let e = n.to > n.from ? J(this.text, n) : /^\S+/.exec(this.text.slice(n.from))?.[0] ?? "", r = e.length > 24 ? `${e.slice(0, 24)}…` : e;
			this.report("syntax-error", "error", {
				from: n.from,
				to: Math.max(n.to, n.from + e.length)
			}, { token: r.split("\n")[0] ?? "" });
		} while (n.next());
	}
	readHeader(e) {
		let t = e.getChild("Number");
		if (!t) return;
		let n = J(this.text, t);
		this.doc.version = Number(n), n !== "1" && this.report("unsupported-version", "error", t, { version: n });
	}
	readTitle(e) {
		let t = e.getChild("String");
		t && (this.titleSeen && this.report("duplicate-title", "warning", e), this.titleSeen = !0, this.doc.title = this.readString(t));
	}
	readGroup(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = J(this.text, n), i = this.readAttributes(e.getChild("Attributes"), "group"), a = {
			id: r,
			label: this.readChildString(e, "Label") ?? r
		};
		t && (a.parentId = t);
		let o = i.value("color");
		o !== void 0 && (a.color = o);
		let s = this.declare({
			kind: "group",
			id: r,
			from: e.from,
			to: e.to,
			idRange: Y(n)
		});
		s && this.doc.groups.push(a);
		let c = e.getChild("GroupBody");
		if (!c) return;
		let l = s ? r : t;
		for (let e of q(c)) e.name === "Group" ? this.readGroup(e, l) : e.name === "Node" && this.readNode(e, l);
	}
	readNode(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = J(this.text, n), i = this.readAttributes(e.getChild("Attributes"), "node"), a = {
			id: r,
			label: this.readChildString(e, "Label") ?? r,
			icon: i.value("icon") ?? "server",
			visible: i.value("visible") ?? !0
		};
		t && (a.parentId = t);
		let o = i.value("sub");
		o !== void 0 && (a.sub = o);
		let s = i.value("badge");
		s !== void 0 && (a.badge = s);
		let c = i.value("color");
		c !== void 0 && (a.color = c), this.declare({
			kind: "node",
			id: r,
			from: e.from,
			to: e.to,
			idRange: Y(n)
		}) && this.doc.nodes.push(a);
	}
	readEdge(e) {
		let t = e.getChildren("Identifier"), n = e.getChild("Arrow"), [r, i] = t;
		if (!r || !i || !n) return;
		let a = J(this.text, r), o = J(this.text, i), c = J(this.text, n), l = d[c] ?? ze;
		a === o && l.direction === "bidirectional" && this.report("invalid-self-arrow", "error", n, {
			arrow: c,
			suggestion: l.style === "dashed" ? "..>" : "-->"
		});
		let u = this.readAttributes(e.getChild("Attributes"), "edge"), f = u.get("id"), p = {
			id: f?.value ?? s(a, o),
			explicitId: f !== void 0,
			from: a,
			to: o,
			style: l.style,
			direction: l.direction,
			visible: u.value("visible") ?? !0
		}, m = this.readChildString(e, "EdgeLabel");
		m !== void 0 && (p.label = m);
		let h = u.value("color");
		h !== void 0 && (p.color = h), f ? this.declare({
			kind: "edge",
			id: p.id,
			from: e.from,
			to: e.to,
			idRange: Y(f.node)
		}) : this.elements.has(p.id) ? this.report("duplicate-edge", "error", e, {
			from: a,
			to: o
		}) : this.elements.set(p.id, {
			kind: "edge",
			id: p.id,
			from: e.from,
			to: e.to
		}), this.references.push({
			id: a,
			range: Y(r),
			allowed: ["node"]
		}, {
			id: o,
			range: Y(i),
			allowed: ["node"]
		}), this.doc.edges.push(p);
	}
	readStep(e) {
		let t = {
			index: this.doc.steps.length,
			title: this.readChildString(e) ?? "",
			description: "",
			focus: [],
			states: [],
			animations: []
		}, n = e.getChild("StepBody");
		for (let e of n ? q(n) : []) switch (e.name) {
			case "Focus":
				for (let n of e.getChildren("Identifier")) {
					let e = J(this.text, n);
					t.focus.push(e), this.references.push({
						id: e,
						range: Y(n),
						allowed: ["node", "group"]
					});
				}
				break;
			case "State":
				this.readState(e, t);
				break;
			case "Animate": this.readAnimate(e, t);
		}
		t.description = this.readDescList(n).join("\n"), this.stepRanges.push({
			from: e.from,
			to: e.to
		}), this.doc.steps.push(t);
	}
	readState(e, t) {
		let n = e.getChild("Identifier");
		if (!n) return;
		let r = J(this.text, n), i = e.getChild("Attributes"), a = this.readAttributes(i, "state");
		i && i.getChildren("Attribute").length === 0 && this.report("empty-state", "warning", e);
		let o = { target: r }, s = a.value("visible");
		s !== void 0 && (o.visible = s);
		let c = a.value("badge");
		c !== void 0 && (o.badge = c);
		let l = a.value("color");
		l !== void 0 && (o.color = l), t.states.push(o), this.references.push({
			id: r,
			range: Y(n),
			allowed: [
				"node",
				"group",
				"edge"
			]
		}), this.stateChecks.push({
			target: r,
			attrs: a.entries
		});
	}
	readAnimate(e, t) {
		let [n, r] = e.getChildren("Identifier"), i = e.getChild("Arrow");
		if (!n || !r || !i) return;
		let a = J(this.text, i), o = d[a] ?? ze;
		o.style === "dashed" ? this.report("invalid-animate-arrow", "error", i, {
			arrow: a,
			suggestion: o.direction === "bidirectional" ? "<->" : "-->"
		}) : o.direction === "bidirectional" && J(this.text, n) === J(this.text, r) && this.report("invalid-self-arrow", "error", i, {
			arrow: a,
			suggestion: "-->"
		});
		let s = this.readAttributes(e.getChild("Attributes"), "animate"), c = {
			from: J(this.text, n),
			to: J(this.text, r),
			direction: o.direction,
			parallel: s.value("parallel") ?? !1
		}, l = this.readChildString(e, "EdgeLabel");
		l !== void 0 && (c.label = l);
		let u = s.value("color");
		u !== void 0 && (c.color = u);
		let f = s.value("icon");
		f !== void 0 && (c.icon = f);
		let p = [], m = s.value("desc");
		m !== void 0 && m.length > 0 && p.push(m);
		let h = e.getChild("AnimateBody");
		p.push(...this.readDescList(h)), p.length > 0 && (c.description = p.join("\n"));
		let g = !1, _, v = s.get("code");
		if (v !== void 0 && (g = !0, v.value.trim().length > 0 && (_ = { body: v.value })), h) for (let e of q(h)) {
			if (e.name !== "Code") continue;
			g && this.report("duplicate-code", "warning", e), g = !0;
			let t = this.readCode(e);
			t !== void 0 && (_ = t);
		}
		_ !== void 0 && (c.code = _), t.animations.push(c), this.references.push({
			id: c.from,
			range: Y(n),
			allowed: ["node"]
		}, {
			id: c.to,
			range: Y(r),
			allowed: ["node"]
		});
	}
	readCode(e) {
		let t = e.getChild("CodeLang"), n = e.getChild("String"), r = e.getChild("CodeFence"), i, a;
		if (r ? (n && (i = this.readString(n)), a = Me(J(this.text, r))) : n && (a = this.readString(n)), a === void 0 || a.trim().length === 0) return;
		let o = { body: a };
		return t && (o.lang = J(this.text, t)), i !== void 0 && (o.title = i), o;
	}
	readString(e) {
		return Pe(this.text, e, this.reportFn);
	}
	readChildString(e, t) {
		let n = (t ? e.getChild(t) : e)?.getChild("String");
		return n ? this.readString(n) : void 0;
	}
	readDescList(e) {
		if (!e) return [];
		let t = [];
		for (let n of q(e)) if (n.name === "Desc") {
			let e = this.readChildString(n);
			e !== void 0 && t.push(e);
		}
		return t;
	}
	readAttributes(e, t) {
		return Fe(this.text, e, t, this.reportFn);
	}
	declare(e) {
		return this.elements.has(e.id) ? (this.report("duplicate-id", "error", e.idRange ?? e, { id: e.id }), !1) : (this.elements.set(e.id, e), !0);
	}
	resolveReferences() {
		for (let e of this.references) {
			let t = this.elements.get(e.id);
			t ? e.allowed.includes(t.kind) || this.report("reference-kind-mismatch", "error", e.range, {
				id: e.id,
				actual: t.kind,
				expected: e.allowed.join("|")
			}) : this.report("undefined-reference", "error", e.range, { id: e.id });
		}
		for (let e of this.stateChecks) {
			let t = this.elements.get(e.target);
			if (!t) continue;
			let n = l[t.kind];
			for (let [r, i] of e.attrs) n.has(r) || this.report("attribute-not-applicable", "warning", i.node, {
				name: r,
				kind: t.kind
			});
		}
	}
	report(e, t, n, r = {}) {
		this.diagnostics.push({
			code: e,
			severity: t,
			from: n.from,
			to: n.to,
			args: r
		});
	}
}, X = u.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
new RegExp(X), RegExp(`(?:${X})\\s*\\w*$`), RegExp(`${X}|^\\s*animate\\b`);
// src/dsl/diagnostics.ts
var He = {
	ja: {
		"syntax-error": "構文エラー: \"{token}\" は解釈できません",
		"unexpected-eof": "入力が途中で終わっています（\"}\" や \"]\" の閉じ忘れの可能性があります）",
		"missing-header": "先頭に \"dav 1\" が必要です",
		"unsupported-version": "DSL バージョン {version} には対応していません（対応: 1）",
		"duplicate-title": "title は1回だけ指定できます",
		"duplicate-id": "ID \"{id}\" は既に使われています",
		"duplicate-edge": "\"{from}\" から \"{to}\" へのエッジが重複しています。2本目以降は [id: ...] を指定してください",
		"undefined-reference": "\"{id}\" は定義されていません",
		"reference-kind-mismatch": "\"{id}\" は{actual}です（{expected}を指定してください）",
		"unknown-attribute": "属性 \"{name}\" は{owner}では使えません",
		"duplicate-attribute": "属性 \"{name}\" が重複しています（後の値が使われます）",
		"invalid-attribute-value": "属性 \"{name}\" の値が不正です（期待: {expected}）",
		"unknown-icon": "アイコン \"{icon}\" は存在しません{suggestion}",
		"invalid-color": "色 \"{value}\" は不正です{suggestion}（使用可: {names}）",
		"invalid-animate-arrow": "animate では点線の矢印 \"{arrow}\" は使えません{suggestion}",
		"invalid-self-arrow": "自己ループに双方向の矢印 \"{arrow}\" は使えません{suggestion}",
		"invalid-escape": "エスケープシーケンス \"{sequence}\" は使えません（使用可: \\\" \\\\ \\n \\t）",
		"attribute-not-applicable": "属性 \"{name}\" は{kind}には適用されません",
		"empty-state": "state に属性が指定されていません",
		"duplicate-code": "code は1つの animate に1つだけ指定できます（後の値が使われます）"
	},
	en: {
		"syntax-error": "Syntax error: unexpected \"{token}\"",
		"unexpected-eof": "Unexpected end of input (a closing \"}\" or \"]\" may be missing)",
		"missing-header": "The document must start with \"dav 1\"",
		"unsupported-version": "DSL version {version} is not supported (supported: 1)",
		"duplicate-title": "title can only be specified once",
		"duplicate-id": "ID \"{id}\" is already in use",
		"duplicate-edge": "Duplicate edge from \"{from}\" to \"{to}\". Specify [id: ...] for additional edges",
		"undefined-reference": "\"{id}\" is not defined",
		"reference-kind-mismatch": "\"{id}\" is a {actual} (expected {expected})",
		"unknown-attribute": "Attribute \"{name}\" is not allowed on {owner}",
		"duplicate-attribute": "Duplicate attribute \"{name}\" (the last value wins)",
		"invalid-attribute-value": "Invalid value for attribute \"{name}\" (expected {expected})",
		"unknown-icon": "Unknown icon \"{icon}\"{suggestion}",
		"invalid-color": "Invalid color \"{value}\"{suggestion}. Use one of: {names}",
		"invalid-animate-arrow": "Dashed arrow \"{arrow}\" cannot be used in animate{suggestion}",
		"invalid-self-arrow": "Bidirectional arrow \"{arrow}\" cannot form a self-loop{suggestion}",
		"invalid-escape": "Invalid escape sequence \"{sequence}\" (allowed: \\\" \\\\ \\n \\t)",
		"attribute-not-applicable": "Attribute \"{name}\" does not apply to a {kind}",
		"empty-state": "state has no attributes",
		"duplicate-code": "Only one code block is allowed per animate (the last value wins)"
	}
}, Ue = {
	ja: {
		node: "ノード",
		group: "グループ",
		edge: "エッジ",
		state: "state",
		animate: "animate"
	},
	en: {
		node: "node",
		group: "group",
		edge: "edge",
		state: "state",
		animate: "animate"
	}
}, We = {
	ja: "（もしかして \"{value}\"？）",
	en: " (did you mean \"{value}\"?)"
}, Ge = /* @__PURE__ */ new Set([
	"owner",
	"kind",
	"actual",
	"expected"
]);
function Ke(e, t = "en") {
	return He[t][e.code].replace(/\{(\w+)\}/g, (n, r) => {
		let i = e.args[r] ?? "";
		return r === "suggestion" ? i ? We[t].replace("{value}", i) : "" : Ge.has(r) ? i.split(/\s*\|\s*/).map((e) => Ue[t][e] ?? e).join(t === "ja" ? "・" : " or ") : i;
	});
}
// src/skill/packets.ts
var qe = (e, t) => e.from === t.from && e.to === t.to || e.direction === "bidirectional" && e.from === t.to && e.to === t.from, Je = "Usage: node dav-outline.mjs [--json] <file.dav>", Z = 0, Ye = 1, Xe = 2, Q = (e) => e.direction === "bidirectional" ? e.style === "dashed" ? "<.>" : "<->" : e.style === "dashed" ? "..>" : "-->";
function $(e, t) {
	let n = e.steps.find((e) => e.states.some((e) => e.target === t && e.visible));
	return n ? n.index + 1 : 0;
}
function Ze(e, t) {
	let n = [];
	for (let e of t.animations) {
		let t = n[n.length - 1];
		e.parallel && t ? t.push(e) : n.push([e]);
	}
	return n.flatMap((t, n) => t.map((r, i) => {
		let a = e.edges.find((e) => qe(e, r)), o = {
			number: `${n + 1}${t.length > 1 ? String.fromCharCode(97 + i) : ""}`,
			from: r.from,
			to: r.to,
			roundTrip: r.direction === "bidirectional"
		};
		return r.label && (o.label = r.label), r.description && (o.desc = r.description), r.icon && (o.icon = r.icon), r.color && (o.color = r.color), r.code?.body.trim() && (o.code = { body: r.code.body.trim() }, r.code.lang && (o.code.lang = r.code.lang), r.code.title && (o.code.title = r.code.title)), a && (o.edge = `${a.from} ${Q(a)} ${a.to}`), o;
	}));
}
function Qe(e) {
	let t = (t) => {
		let n = {
			id: t.id,
			label: t.label,
			icon: t.icon
		};
		return t.sub && (n.sub = t.sub), t.badge && (n.badge = t.badge), t.color && (n.color = t.color), t.visible || (n.shownFromStep = $(e, t.id)), n;
	}, n = (r) => {
		let i = e.groups.find((e) => e.id === r), a = {
			id: r,
			label: i?.label ?? r,
			zones: e.groups.filter((e) => e.parentId === r).map((e) => n(e.id)),
			nodes: e.nodes.filter((e) => e.parentId === r).map(t)
		};
		return i?.color && (a.color = i.color), a;
	}, r = e.edges.map((t) => {
		let n = {
			from: t.from,
			to: t.to,
			arrow: Q(t)
		};
		return t.label && (n.label = t.label), t.explicitId && (n.id = t.id), t.color && (n.color = t.color), t.visible || (n.shownFromStep = $(e, t.id)), n;
	}), i = e.edges.filter((e) => e.from !== e.to), a = (e) => i.some((t) => t.to === e), o = (e) => i.some((t) => t.from === e), s = /* @__PURE__ */ new Map(), c = e.steps.map((t) => {
		let n = t.index + 1, r = t.states.map((e) => {
			let t = [];
			e.visible !== void 0 && t.push(e.visible ? "shown" : "hidden"), e.badge !== void 0 && t.push(e.badge ? `badge "${e.badge}"` : "badge removed"), e.color !== void 0 && t.push(e.color === "none" ? "color back to its own" : `color ${e.color}`);
			let r = { ...s.get(e.target) };
			return e.badge !== void 0 && (e.badge ? r.badge = {
				value: e.badge,
				since: n
			} : delete r.badge), e.color !== void 0 && (e.color === "none" ? delete r.color : r.color = {
				value: e.color,
				since: n
			}), s.set(e.target, r), `${e.target}: ${t.join(", ")}`;
		}), i = [...s].flatMap(([e, t]) => {
			let r = [t.badge && t.badge.since < n ? `badge "${t.badge.value}" (since step ${t.badge.since})` : "", t.color && t.color.since < n ? `color ${t.color.value} (since step ${t.color.since})` : ""].filter(Boolean);
			return r.length > 0 ? [`${e}: ${r.join(", ")}`] : [];
		}), a = {
			number: n,
			title: t.title,
			focus: t.focus,
			changes: r,
			stillShowing: i,
			phases: Ze(e, t)
		};
		return t.description.trim() && (a.desc = t.description.trim()), a;
	}), l = new Set(e.steps.flatMap((e) => [
		...e.focus,
		...e.states.map((e) => e.target),
		...e.animations.flatMap((e) => [e.from, e.to])
	])), u = (t) => e.steps.some((e) => e.animations.some((e) => qe(t, e)));
	return {
		title: e.title,
		counts: {
			nodes: e.nodes.length,
			zones: e.groups.length,
			edges: e.edges.length,
			steps: e.steps.length
		},
		zones: e.groups.filter((e) => e.parentId === void 0).map((e) => n(e.id)),
		nodes: e.nodes.filter((e) => e.parentId === void 0).map(t),
		edges: r,
		entryPoints: e.nodes.filter((e) => o(e.id) && !a(e.id)).map((e) => e.id),
		endPoints: e.nodes.filter((e) => a(e.id) && !o(e.id)).map((e) => e.id),
		unconnected: e.nodes.filter((e) => !a(e.id) && !o(e.id)).map((e) => e.id),
		steps: c,
		neverInAStep: e.steps.length > 0 ? e.nodes.filter((e) => !l.has(e.id)).map((e) => e.id) : [],
		edgesWithoutPackets: e.steps.length > 0 ? e.edges.filter((e) => !u(e)).map((e) => `${e.from} ${Q(e)} ${e.to}`) : []
	};
}
function $e(e, t, n) {
	let r = new Map(t.nodes.map((e) => [e.id, e.label])), i = (e) => r.has(e) ? `${r.get(e)} (${e})` : e, a = (e) => e.from === e.to ? `${i(e.from)} ↻ (on itself)` : `${i(e.from)} ${e.roundTrip ? "⇄" : "→"} ${i(e.to)}`, o = [], { counts: s } = n;
	o.push(`# ${n.title || "(no title)"}`), o.push(""), o.push(`${e}: ${s.nodes} nodes, ${s.zones} zones, ${s.edges} edges, ${s.steps} steps`);
	let c = (e) => e === void 0 ? "" : e === 0 ? "; hidden, and no step shows it" : `; hidden until step ${e}`, l = (e, t) => `${t}- ${e.label} (${e.id}): ${e.icon}${e.sub ? `; ${e.sub}` : ""}${e.badge ? `; badge "${e.badge}"` : ""}${e.color ? `; ${e.color}` : ""}${c(e.shownFromStep)}`, u = (e, t) => {
		o.push(`${t}- Zone "${e.label}" (${e.id})${e.color ? ` [${e.color}]` : ""}`);
		for (let n of e.zones) u(n, `${t}  `);
		for (let n of e.nodes) o.push(l(n, `${t}  `));
	};
	o.push("", "## Zones and nodes", "");
	for (let e of n.zones) u(e, "");
	if (n.nodes.length > 0) {
		n.zones.length > 0 && o.push("- Outside every zone");
		for (let e of n.nodes) o.push(l(e, n.zones.length > 0 ? "  " : ""));
	}
	o.push("", "## Connections", ""), o.push("`-->` one way, `<->` both ways, `..>` and `<.>` the same drawn dashed.", "");
	for (let e of n.edges) {
		let t = [
			e.id ? `id ${e.id}` : "",
			e.color ?? "",
			c(e.shownFromStep).slice(2)
		].filter(Boolean);
		o.push(`- ${i(e.from)} ${e.arrow} ${i(e.to)}${e.label ? ` : "${e.label}"` : ""}${t.length > 0 ? ` [${t.join("; ")}]` : ""}`);
	}
	let d = (e, t, n = i) => {
		t.length > 0 && o.push(`${e}: ${t.map(n).join(", ")}`);
	};
	if (o.push(""), d("Entry points (nothing points at them)", n.entryPoints), d("End points (they point at nothing)", n.endPoints), d("Not connected to anything", n.unconnected), n.steps.length > 0) {
		o.push("", "## Steps", ""), o.push("Packets are listed in the order they travel. Packets with the same number and a letter (2a, 2b) travel at the same time.");
		for (let e of n.steps) {
			o.push("", `### Step ${e.number}: ${e.title}`, ""), e.desc && o.push(e.desc.replace(/\n/g, " "), ""), e.focus.length > 0 && o.push(`Focus: ${e.focus.map(i).join(", ")}`);
			for (let t of e.changes) o.push(`Changes from this step on: ${t}`);
			for (let t of e.stillShowing) o.push(`Still showing: ${t}`);
			e.focus.length + e.changes.length + e.stillShowing.length > 0 && o.push("");
			for (let t of e.phases) {
				let e = [
					t.icon ? `carries ${t.icon}` : "",
					t.color ?? "",
					t.edge ? "" : "no declared edge"
				].filter(Boolean).join("; ");
				if (o.push(`${t.number}. ${a(t)}${t.label ? ` : "${t.label}"` : ""}${t.roundTrip ? " (there and back)" : ""}${e ? ` [${e}]` : ""}`), t.desc && o.push(`   ${t.desc.replace(/\n/g, " ")}`), t.code) {
					let e = [t.code.lang, t.code.title].filter(Boolean).join(" · ");
					o.push(`   code${e ? ` (${e})` : ""}:`);
					for (let e of t.code.body.split("\n")) o.push(`     ${e}`);
				}
			}
			e.phases.length === 0 && o.push("No packet travels in this step.");
		}
	}
	return (n.neverInAStep.length > 0 || n.edgesWithoutPackets.length > 0) && (o.push("", "## Not part of any step", ""), d("Nodes no step touches", n.neverInAStep), d("Edges no packet rides", n.edgesWithoutPackets, (e) => e)), `${o.join("\n")}\n`;
}
function et(t, n = Je) {
	if (t.includes("--help") || t.includes("-h")) return console.log(n), Z;
	let r = t.filter((e) => e !== "--json"), [i] = r;
	if (r.length !== 1 || !i || i.startsWith("-")) return console.error(n), Xe;
	let a;
	try {
		a = e(i, "utf8").replace(/^﻿/, "");
	} catch (e) {
		return console.error(`${i}: ${e instanceof Error ? e.message : String(e)}`), Xe;
	}
	let { document: o, diagnostics: s } = Be(a), c = Qe(o);
	console.log(t.includes("--json") ? JSON.stringify(c, null, 2) : $e(i, o, c));
	let l = s.filter((e) => e.severity === "error");
	for (let e of l) console.error(`${i}: error ${e.code}: ${Ke(e)}`);
	return l.length > 0 ? Ye : Z;
}
// src/skill/outlineEntry.ts
process.exitCode = et(process.argv.slice(2));
